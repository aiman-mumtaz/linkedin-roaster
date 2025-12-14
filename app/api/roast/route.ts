import { NextResponse } from "next/server";
import { chromium } from "playwright";

// Shared context cache
let cachedContext: any = null;

async function getAuthenticatedContext() {
    // If context already exists and is valid, reuse it
    if (cachedContext) {
        try {
            // Test if context is still valid by checking a page
            const page = await cachedContext.newPage();
            await page.goto("https://www.linkedin.com/feed/", { waitUntil: "load", timeout: 5000 });
            await page.close();
            return cachedContext;
        } catch (e) {
            // Context is stale, clear it
            cachedContext = null;
        }
    }

    // Create new authenticated context
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login to LinkedIn
    await page.goto("https://www.linkedin.com/login", { waitUntil: "load", timeout: 15000 });

    const email = process.env.LINKEDIN_EMAIL;
    const password = process.env.LINKEDIN_PASSWORD;

    if (!email || !password) {
        await context.close();
        await browser.close();
        throw new Error("LinkedIn credentials not configured. Please set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env.local");
    }

    // Enter credentials
    await page.fill('input[name="session_key"]', email);
    await page.fill('input[name="session_password"]', password);
    await page.click('button[type="submit"]');

    // Wait for login to complete
    try {
        await page.waitForNavigation({ waitUntil: "load", timeout: 15000 });
    } catch (e) {
        // Continue anyway
    }

    await page.close();
    cachedContext = context;
    return context;
}

export async function POST(request: Request) {
    const { profile } = await request.json();

    let profileData = "";

    // If it's a URL, scrape the profile
    if (profile.includes("linkedin.com")) {
        try {
            const context = await getAuthenticatedContext();
            const page = await context.newPage();

            // Navigate to the profile URL
            let profileUrl = profile;
            if (!profileUrl.startsWith("http")) {
                profileUrl = "https://" + profileUrl;
            }
            await page.goto(profileUrl, { waitUntil: "load", timeout: 15000 });

            // Wait a bit for profile to fully load
            await page.waitForTimeout(800);

            // Extract profile information
            const profileText = await page.evaluate(() => {
                return document.body.innerText;
            });

            profileData = profileText;
            await page.close();
        } catch (error) {
            console.log("Error scraping LinkedIn:", error);
            cachedContext = null; // Clear cache on error
            return NextResponse.json(
                { error: "Failed to fetch LinkedIn profile. Make sure you've set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env.local and the profile URL is correct." },
                { status: 400 }
            );
        }
    } else {
        profileData = profile;
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions",
        {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 200,
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
                - Keep it SHORT - 2-3 punchy sentences max
                - Sprinkle in emojis 😂🔥💀😭🚩🤡
                - Write as one flowing paragraph
                - No slurs, no hate, no protected classes
                - Make it so accurate it stings
                            `,
            },
            {
                role: "user",
                content: `Roast this LinkedIn profile with brutal wit and sarcasm. Write it as a flowing paragraph that reads like a comedic essay. Make it withering and memorable:\n\n${profileData}`,
            },
            ],
        }),
        }
    );
    const data = await response.json();

    if (!response.ok) {
        console.error("API Error:", data);
        return NextResponse.json(
            { error: data.error?.message || "Failed to generate roast" },
            { status: response.status }
        );
    }

    if (!data.choices || !data.choices[0]?.message?.content) {
        console.error("Unexpected response structure:", data);
        return NextResponse.json(
            { error: "Unexpected response format from API" },
            { status: 500 }
        );
    }

    return NextResponse.json({ roast: data.choices[0].message.content });
}