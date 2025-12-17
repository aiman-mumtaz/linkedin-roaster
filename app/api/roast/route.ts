import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { profile } = await request.json();
    if (!profile) return NextResponse.json({ error: "URL required" }, { status: 400 });
    if(profile.includes("aiman-mumtaz")){
        return NextResponse.json({ roast: "Ah, trying to roast the creator?? Bold move 🤣? But Aiman's LinkedIn is untouchable. Try someone else you unemployed peasant!!" });
    }
    const apifyToken = process.env.APIFY_TOKEN;
    const groqKey = process.env.GROQ_API_KEY;

    console.log(`🚀 Starting stable scrape for: ${profile}`);


    // 'supreme_coder~linkedin-profile-scraper' Apify actor - limited fields for performance
    const apifyUrl = `https://api.apify.com/v2/acts/supreme_coder~linkedin-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}&fields=firstName,headline,summary,positions,educations,certifications,skills,projects,followersCount,isVerified,volunteerExperiences`;

    const apifyResponse = await fetch(apifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urls: [{ url: profile }],
      }),
    });

    if (!apifyResponse.ok) {
        return NextResponse.json({ error: "Scraping timed out or failed. Try again." }, { status: 504 });
    }

    const dataset = await apifyResponse.json();
    
    if (!Array.isArray(dataset) || dataset.length === 0) {
      console.error("Empty dataset returned from Apify");
      return NextResponse.json({ error: "No profile data found. The profile might be private." }, { status: 404 });
    }

    const profileData = dataset[0];

    if (!profileData || profileData.error) {
      console.error("Profile data missing or contains error:", profileData);
      return NextResponse.json({ error: "Could not find profile. It may be private or restricted." }, { status: 404 });
    }

    console.log("Profile Data fetched successfully");

    const completion = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        // OPTIMIZATION : Set a lower max_tokens to prevent rambling
        max_tokens: 300,
        temperature: 0.8,
        messages: [
          {
            role: "system",
            content: `
                You are a savage LinkedIn roaster. 
                Focus on corporate buzzwords, inflated titles, and delusional summaries.
                Keep it funny and under 450 words.
                Use a brutally sarcastic and witty tone with piercing humor.
                Add emojis at 3-4 places for humor.`
          },
          {
            role: "user",
            content: `Roast this person: ${JSON.stringify({
                name: profileData.firstName,
                headline: profileData.headline,
                about: profileData.summary,
                experience: profileData.positions?.slice(0, 2), // Limited context size for speed
                certifications: profileData.certifications,
                skills: profileData.skills,
                education: profileData.educations,
                projects: profileData.projects,
                followers: profileData.followersCount,
                isVerified: profileData.isVerified,
                volunteer: profileData.volunteerExperiences
            })}`
            // content: `Roast this person based on their JSON data: ${JSON.stringify(profileData)}`
          }
        ],
        // OPTIMIZATION : Disable stream
        stream: false
      })
    });

    const aiData = await completion.json();
    return NextResponse.json({ roast: aiData.choices[0].message.content });

  } catch (error: any) {
    console.error("Final Route Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}