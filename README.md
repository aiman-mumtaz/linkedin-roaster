# 🔥 LinkedIn Profile Roaster

A brutally honest roasting tool for LinkedIn profiles. This app uses AI to generate witty, savage roasts based on your LinkedIn profile details.

## Features

- **AI-Powered Roasting** - Uses Groq's LLaMA 3.3 model to generate brutal, witty roasts
- **LinkedIn Profile Scraping** - Automatically fetches and analyzes LinkedIn profiles
- **Dark Mode UI** - LinkedIn-inspired dark theme with smooth animations
- **Fast & Efficient** - Cached authentication for quick roast generation
- **Personal Roasts** - Each roast is tailored to specific profile details, not generic

## Tech Stack

- **Frontend**: Next.js 15 + React + Tailwind CSS
- **Backend**: Next.js API Routes
- **AI**: Groq API (LLaMA 3.3 70B)
- **Web Scraping**: Playwright
- **Animation**: Custom CSS animations

## Getting Started

### Prerequisites

- Node.js 18+
- LinkedIn account credentials
- Groq API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/aiman-mumtaz/linkedin-roaster.git
cd linkedin-roaster
```

2. Install dependencies:
```bash
npm install
npx playwright install
```

3. Set up environment variables in `.env.local`:
```env
GROQ_API_KEY=your_groq_api_key_here
LINKEDIN_EMAIL=your_linkedin_email@example.com
LINKEDIN_PASSWORD=your_linkedin_password
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## How It Works

1. User pastes a LinkedIn profile URL
2. App logs into LinkedIn and scrapes the profile data
3. Profile text is sent to Groq's API with a custom prompt
4. AI generates a brutal, personalized roast
5. Roast is displayed with smooth animations

## Roasting Features

The roaster specifically targets:
- Career stagnation (same role 2+ years)
- Skill inflation vs. actual qualifications
- Buzzword abuse ("synergy", "disruptive", "innovative")
- Humble-bragging and fake humility
- False leadership claims without actual management experience
- Weak educational background with inflated claims
- Generic, vague accomplishments

## API Endpoints

### POST `/api/roast`
Generate a roast for a LinkedIn profile or custom text.

**Request:**
```json
{
  "profile": "https://www.linkedin.com/in/username"
}
```

**Response:**
```json
{
  "roast": "Your brutal roast here..."
}
```

## Configuration

- **Max tokens**: 200 (keeps roasts short and punchy)
- **Temperature**: 0.7 (balanced creativity vs. consistency)
- **Model**: llama-3.3-70b-versatile
- **Browser timeout**: 15 seconds for scraping

## Performance Notes

- First roast (with login): ~20-30 seconds
- Subsequent roasts: ~10-15 seconds (uses cached auth)
- API response time: ~3-5 seconds

## Legal & Ethical

- Only scrape public LinkedIn profiles
- No hate speech, slurs, or protected class attacks
- Roasts are satirical and comedic in nature
- Use responsibly and for entertainment purposes only

## Future Improvements

- [ ] Support for other social profiles
- [ ] Custom roast intensity levels
- [ ] Share roasts on social media
- [ ] Roast history/favorites
- [ ] Multi-language support
- [ ] Web app deployment on Vercel

## License

MIT

## Support

For issues or questions, please open an issue on the repository.

---

Built with ❤️ and brutality 🔥
