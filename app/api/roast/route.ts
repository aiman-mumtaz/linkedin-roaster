import { NextResponse } from "next/server";
import { chromium as playwrightChromium, Response, Route } from "playwright-core";
import chromium_serverless from "@sparticuz/chromium";
import * as path from 'path';
import * as fs from 'fs';

// Shared context cache. Crucial for subsequent requests (warm starts).
let cachedContext: any = null;
// Stores the parsed JavaScript Object from the state file.
let savedStorageState: object | undefined = undefined; 

/**
 * Reads the 'linkedin_state.json' file content, parses it, and caches the object.
 */
function loadStorageState(): object | undefined {
  if (savedStorageState) {
    return savedStorageState;
  }
  
  try {
    const filePath = path.join(process.cwd(), 'linkedin_state.json');
    const fileContentString = fs.readFileSync(filePath, 'utf-8');
    
    // CRITICAL FIX: Parse the string into a JavaScript OBJECT
    savedStorageState = JSON.parse(fileContentString);
    
    console.log("Successfully loaded and PARSED storage state object.");
    return savedStorageState;
  } catch (e) {
    console.error("CRITICAL: Failed to load or parse linkedin_state.json. Falling back to manual login.", e);
    return undefined;
  }
}

/**
 * Initializes or reuses an authenticated Playwright context, prioritizing saved state.
 */
async function getAuthenticatedContext() {
  // 1. Re-use cached context
  if (cachedContext) {
    try {
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
  
  const storageStateObject = isProduction ? loadStorageState() : undefined;

  const contextOptions: any = {
    ignoreHTTPSErrors: true,
    slowMo: 0,
    // Pass the actual JAVASCRIPT OBJECT to storageState
    storageState: storageStateObject, 
  };
  
  let browserExecutable = playwrightChromium;

  if (isProduction) {
    // Netlify Production Setup
    launchOptions = {
      ...launchOptions,
      args: chromium_serverless.args.concat(['--disable-setuid-sandbox']), 
      executablePath: await chromium_serverless.executablePath(),
    };
  } else {
    // Local Development Setup (requires local 'playwright' package)
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

  // HIGH PERFORMANCE: Block non-essential resources
  await context.route('**/*', (route: Route) => {
    const resource = route.request().resourceType();
    if (resource === 'image' || resource === 'stylesheet' || resource === 'font') {
      route.abort();
    } else {
      route.continue();
    }
  });

  // 4. Test Session State and Login
  
  // 🚀 HYPER-AGGRESSIVE OPTIMIZATION: Trust the loaded state, skip navigation test
  if (storageStateObject) {
      // We skip the 5-second navigation check entirely, saving critical time.
      console.log("Session state loaded successfully. Trusting state and bypassing login test.");
      await page.close();
      cachedContext = context;
      return context;
  }
  
  // Fallback: Manual login (only executes if state file was missing/failed to load)
  console.log("Storage state was NOT loaded. Performing manual login... (Will likely hit checkpoint)");
  
  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;

  if (!email || !password) {
    await context.close();
    await browser.close();
    throw new Error("Missing LinkedIn credentials.");
  }
  
  if (!page.url().includes("login")) {
      await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded", timeout: 15000 });
  }

  await page.fill('input[name="session_key"]', email);
  await page.fill('input[name="session_password"]', password);
  await page.click('button[type="submit"]');

  // Robust Login Check 
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
        throw new Error(`Login failed: Checkpoint detected at ${currentUrl}. Check credentials or 'linkedin_state.json'.`);
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

      // 1. Set up a listener to capture the crucial network response
      const profileDataPromise = page.waitForResponse((response : Response) =>
        // Targeting the general GraphQL API which handles most content loading
        response.url().includes('/graphql') &&
        response.status() === 200
      , { timeout: 15000 }); // Generous 15s wait for the API data

      // 2. Start the navigation (This triggers the hidden API call)
      // Use "domcontentloaded" as it's often more reliable for triggering API calls than "load"
      await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 10000 }); 
      
      // 3. Await the structured data response
      const apiResponse = await profileDataPromise;
      
      // 4. Extract the JSON payload
      const jsonResponse = await apiResponse.json();
      
      // 5. Convert JSON to a robust string for the AI 
      profileData = JSON.stringify(jsonResponse, null, 2); 
      
      console.log("Successfully extracted profile data via API interception.");

      await page.close();

    } catch (error: any) {
      // If the fast path fails, we fail fast.
      console.error("Scraping failed during API interception. Check API URL or increase Netlify Memory limit.", error.message);
      cachedContext = null; 
      return NextResponse.json(
        { error: `Scraping failed: ${error.message}. The browser likely ran out of memory.` },
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