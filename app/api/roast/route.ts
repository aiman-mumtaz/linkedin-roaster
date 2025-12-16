import { NextResponse } from "next/server";
import { chromium as playwrightChromium, Route } from "playwright-core";
import chromium_serverless from "@sparticuz/chromium";

// Shared context cache. Crucial for subsequent requests.
let cachedContext: any = null;

/**
 * Initializes or reuses an authenticated Playwright context by loading a saved session state.
 */
async function getAuthenticatedContext() {
  // 1. Re-use cached context
  if (cachedContext) {
    try {
      // QUICK TEST: Check if the context is alive.
      const page = await cachedContext.newPage();
      await page.goto("about:blank", { timeout: 1000 });
      await page.close();
      console.log("Reusing cached context. Cache hit!");
      return cachedContext;
    } catch (e) {
      console.error("Cached context stale, initiating new session.", e);
      cachedContext = null;
    }
  }

  // 2. Setup Launch Logic
  const isProduction = process.env.NODE_ENV === 'production' || process.env.NETLIFY === 'true';

  let launchOptions: any = { headless: true, timeout: 25000 };

  // --- FIX: Load Session State ---
  const contextOptions: any = {
    ignoreHTTPSErrors: true,
    slowMo: 0,
    // CRITICAL: Load the saved session state file on Netlify
    storageState: isProduction ? './linkedin_state.json' : undefined, 
  };
  // --- END FIX ---

  let browserExecutable = playwrightChromium;

  if (isProduction) {
    // Netlify Production Setup
    launchOptions = {
      ...launchOptions,
      args: chromium_serverless.args.concat(['--disable-setuid-sandbox']), 
      executablePath: await chromium_serverless.executablePath(),
    };
  } else {
    // Local Development Setup
    try {
      const { chromium } = require('playwright');
      browserExecutable = chromium;
    } catch (e) {
      throw new Error("Local environment setup failed.");
    }
  }

  // 3. Launch Browser and Create Context
  const browser = await browserExecutable.launch(launchOptions);
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  // HIGH PERFORMANCE: Block non-essential resources on the context level
  await context.route('**/*', (route: Route) => {
    const resource = route.request().resourceType();
    if (resource === 'image' || resource === 'stylesheet' || resource === 'font') {
      route.abort();
    } else {
      route.continue();
    }
  });

  // 4. Test Session State and Login
  console.log("Testing saved session state...");
  
  // Try navigating to the feed. If the state loaded, we should be logged in instantly.
  await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 15000 });
  
  // If we are already logged in, skip the manual credential entry
  if (page.url().includes("feed")) {
      console.log("Session state loaded successfully. Bypassing manual login.");
      await page.close();
      cachedContext = context;
      return context;
  }
  
  // Fallback: If redirected (session expired or missing state file), perform manual login (risky)
  console.log("Session expired or invalid. Performing manual login...");
  
  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;

  if (!email || !password) {
    await context.close();
    await browser.close();
    throw new Error("Missing LinkedIn credentials.");
  }
  
  // Navigate to login page if we aren't already there
  if (!page.url().includes("login")) {
      await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded", timeout: 15000 });
  }

  await page.fill('input[name="session_key"]', email);
  await page.fill('input[name="session_password"]', password);
  await page.click('button[type="submit"]');

  // Robust Login Check (same as before)
  try {
    await page.waitForURL("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 20000 });
    console.log("Login successful via URL check.");
    
  } catch (e) {
    try {
        await page.waitForSelector('nav[aria-label="Primary"] a[href="/feed/"]', { timeout: 10000 });
        console.log("Login successful via element check.");
        
    } catch(e2) {
        const currentUrl = await page.url();
        console.error("Login failed: Checkpoint detected. URL:", currentUrl);
        await context.close();
        await browser.close();
        throw new Error(`Login failed: Checkpoint detected at ${currentUrl}. Update 'linkedin_state.json'.`);
    }
  }
  
  // Save the newly successful state for the next run (overwriting the old one)
  if (isProduction) {
      // NOTE: This only works if your function has write access to its own directory.
      // If it fails, you will need to manually update the file and commit again.
      try {
        await context.storageState({ path: './linkedin_state.json' });
        console.log("Updated session state saved.");
      } catch(e) {
        console.error("Could not save new state file to Netlify environment. Will rely on manual updates.");
      }
  }

  await page.close();
  cachedContext = context;
  return context;
}

export async function POST(request: Request) {
  const { profile } = await request.json();
  let profileData = "";

  // 5. Scrape Logic
  if (profile.includes("linkedin.com")) {
    let context: any;
    let page: any;
    try {
      context = await getAuthenticatedContext(); 
      page = await context.newPage();

      let profileUrl = profile;
      if (!profileUrl.startsWith("http")) {
        profileUrl = "https://" + profileUrl;
      }
      
      console.log(`Scraping profile: ${profileUrl}`);
      await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
      
      await page.waitForTimeout(1000); 

      const profileText = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        return bodyText
          .replace(/Follow|Connect|Message|Premium|Promoted|Skip to main content/g, '')
          .replace(/\s\s+/g, ' ')
          .trim();
      });

      profileData = profileText;
      await page.close();

    } catch (error: any) {
      console.error("Scraping error:", error.message);
      cachedContext = null; 
      return NextResponse.json(
        { error: `Scraping failed: ${error.message}.` },
        { status: 400 }
      );
    }
  } else {
    profileData = profile;
  }

  // 6. Groq / AI Logic (Unchanged)
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_tokens: 350,
        messages: [
          {
            role: "system",
            content: `
                You are a brutally honest roaster who exposes LinkedIn's delusional narratives with surgical precision.

                Rules:
                - Address the person DIRECTLY in second person (\"you\", \"your\", not \"they\")
                - Be VICIOUSLY savage and unforgiving about their shortcomings
                - Call out SPECIFIC gaps: same role/company for 2+ years (stagnation), underqualified, overskilled for the role, weak education, lack of real impact
                - Demolish humble-bragging and inflated accomplishments - expose the reality
                - Mock Tier 2/3 college graduates claiming to be \"ivy league material\"
                - Highlight skills inflation - listing 50 skills but none are proven or impactful
                - Roast people stuck in the same role/salary band for years as if they're climbing
                - Point out generic buzzwords (\"synergy\", \"innovative\", \"disruptive\") as cover for actual mediocrity
                - If they claim to be a \"leader\" but have never managed anyone, annihilate them
                - Be personal, specific to THEIR profile details - name their actual company, role, or claims
                - Keep it SHORT - 4 to 5 punchy sentences max
                - Sprinkle in emojis 😂🔥💀😭🚩🤡
                - Write as one flowing paragraph
                - No slurs, no hate, no protected classes
                - Make it so accurate it stings
              `,
          },
          {
            role: "user",
            content: `Roast this LinkedIn profile based on this data:\n\n${profileData.substring(0, 10000)}`,
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "Groq API error");
    }
    return NextResponse.json({ roast: data.choices?.[0]?.message?.content });

  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return NextResponse.json(
      { error: "Failed to generate roast." },
      { status: 500 }
    );
  }
}