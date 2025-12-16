// saveState.ts

import type { Browser, BrowserContext, Page } from 'playwright'; 
import { chromium } from 'playwright'; 
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url'; // 💡 NEW: Needed to reconstruct __dirname
import { dirname } from 'path';      // 💡 NEW: Needed for path manipulation

// --- FIX: Define __dirname equivalent in ESM scope ---
// Use import.meta.url to get the file path, convert it to a file path, and get the directory name.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// --- END FIX ---

// Define the name and path for your state file
// Now uses the correctly reconstructed __dirname
const STATE_FILE_PATH: string = path.join(__dirname, 'linkedin_state.json');
const LINKEDIN_LOGIN_URL: string = 'https://www.linkedin.com/login';
const LINKEDIN_FEED_URL: string = 'https://www.linkedin.com/feed/';

// IMPORTANT: Replace these with your actual LinkedIn credentials, or ensure your local 
// environment loads them via process.env
const EMAIL: string = process.env.LINKEDIN_EMAIL || 'your.actual.email@example.com'; // <--- CHANGE THIS
const PASSWORD: string = process.env.LINKEDIN_PASSWORD || 'Your$Secret&Password123'; // <--- CHANGE THIS

async function saveLinkedInState(): Promise<void> {
  if (EMAIL === 'YOUR_EMAIL_HERE' || PASSWORD === 'YOUR_PASSWORD_HERE') {
      console.error("FATAL: Please update the EMAIL and PASSWORD variables in saveState.ts before running.");
      return;
  }

  console.log('--- Starting LinkedIn Session State Saver (TypeScript) ---');

  let browser: Browser | undefined; 
  try {
    // 1. Launch a browser in HEADFUL mode
    browser = await chromium.launch({ 
        headless: false, 
        slowMo: 100 
    });
    
    // Non-null assertion is still needed here
    const context: BrowserContext = await browser!.newContext();
    const page: Page = await context.newPage();

    console.log(`Navigating to: ${LINKEDIN_LOGIN_URL}`);
    await page.goto(LINKEDIN_LOGIN_URL, { waitUntil: 'domcontentloaded' });

    // 2. Automated Credential Entry
    await page.fill('input[name="session_key"]', EMAIL);
    await page.fill('input[name="session_password"]', PASSWORD);
    
    await page.click('button[type="submit"]');

    console.log("Credentials submitted. Please wait and manually interact to complete login and solve any CAPTCHAs/2FA prompts.");
    console.log("DO NOT CLOSE THE BROWSER. It will close automatically upon successful login.");

    // 3. Wait for the feed to load (signifying successful login)
    try {
      await page.waitForURL(LINKEDIN_FEED_URL, { timeout: 60000 }); 
      console.log('Successfully logged into LinkedIn Feed.');
    } catch (error) {
      const currentUrl = page.url();
      if (currentUrl.includes('challenge')) {
           console.error('\n--- FAILED: A LinkedIn Security Challenge was encountered. ---');
           console.error('You must manually solve the challenge in the opened browser window before the timeout.');
      } else {
           console.error('\n--- FAILED: Login timed out after 60 seconds. Check credentials or 2FA/security settings. ---');
      }
      return;
    }
    
    // 4. Save the Session State
    await context.storageState({ path: STATE_FILE_PATH });
    console.log(`\n✅ SUCCESS: Session state saved to: ${STATE_FILE_PATH}`);

  } catch (error) {
    console.error('An unexpected error occurred during state saving:', error);
  } finally {
    if (browser !== undefined) { 
      await browser.close();
    }
    console.log('Browser closed.');
  }
}

saveLinkedInState();