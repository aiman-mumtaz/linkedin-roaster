"use client";

import { useState } from "react";

export default function Home() {
  const [profile, setProfile] = useState("");
  const [roast, setRoast] = useState("");
  const [loading, setLoading] = useState(false);

  const generateRoast = async () => {
    if (!profile.trim()) return;
    setLoading(true);
    setRoast("");

    const res = await fetch("/api/roast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    });

    const data = await res.json();
    if (!res.ok) {
      setRoast(data.error || "Failed to generate roast");
    } else {
      setRoast(data.roast || "No roast generated");
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col p-4">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700 shadow-sm mb-8">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-blue-500">in</span>
            <span className="text-lg font-bold text-gray-100">Roaster</span>
          </div>
          <span className="text-sm text-gray-400">🔥 Brutally honest profiles</span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-2xl bg-slate-900 rounded-lg p-8 shadow-2xl border border-slate-700">
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-gray-100 mb-2">
              Profile Roaster
            </h1>
            <p className="text-gray-400 text-base">
              Get a brutally honest roast of any LinkedIn profile
            </p>
          </div>

          <div className="space-y-2 mb-6">
            <label className="block text-sm font-semibold text-gray-300">
              LinkedIn Profile URL
            </label>
            <input
              type="text"
              className="w-full px-4 py-2.5 border border-slate-600 rounded-lg bg-slate-800 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              placeholder="https://www.linkedin.com/in/username"
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
            />
          </div>

          <button
            onClick={generateRoast}
            disabled={loading}
            className="w-full py-2.5 px-6 rounded-full bg-blue-600 text-white font-semibold text-base hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center justify-center"
          >
            {loading && (
              <svg
                className="animate-spin h-5 w-5 mr-3 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                ></path>
              </svg>
            )}
            {loading ? "Generating..." : "Roast This Profile"}
          </button>

          {roast && (
            <div className="mt-6 bg-slate-800 rounded-lg p-6 text-gray-100 leading-relaxed animate-fade-in border border-slate-700 shadow-lg">
              <p className="text-sm font-bold text-blue-400 uppercase tracking-wide mb-4">
                Your Roast
              </p>
              <div className="space-y-4">
                {
                roast.includes('Aiman') ? (
                  roast.split("? ").map((sentence, idx) => (
                    <p key={idx}>
                      {sentence}
                    </p>
                  ))
                ) : (
                  roast.split(". ").map((sentence, idx) => (
                    <p key={idx}>
                      {sentence.endsWith(".") ? sentence : sentence + "."}
                    </p>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
