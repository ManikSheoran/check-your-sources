import dotenv from 'dotenv';
import process from 'process';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import ddgScraper from './ddgScraper.js';

dotenv.config();

const GEMINI_KEY = process.env.GEMINI_API;
if (!GEMINI_KEY) throw new Error("Missing GEMINI_API in .env");

const generationConfig = {
  temperature:    0.7,
  topK:           40,
  topP:           0.95,
  maxOutputTokens: 1024,
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,       threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,      threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
];

export default async function check(claim) {
  console.log(`[DEBUG] Evaluating claim: "${claim}"`);
  if (!claim || typeof claim !== 'string' || !claim.trim()) {
    console.warn("[WARNING] Claim is empty or invalid");
    return null;
  }

  // Fetch “articles” from DuckDuckGo
  console.log("[DEBUG] Fetching headlines from DuckDuckGo...");
  let articles = [];
  try {
    const results = await ddgScraper(claim);
    articles = results.map((r, i) => ({
      title:       r.title,
      description: "",        
      url:         r.url,
      source:      "DuckDuckGo",
    }));
    console.log(`[DEBUG] Retrieved ${articles.length} items.`);
  } catch (err) {
    console.error("[ERROR] DuckDuckGo scrape failed:", err);
  }

  // Build Gemini prompt
  let prompt = `Evaluate the following claim: "${claim}"\n\n`;

  if (articles.length) {
    prompt += "--- Retrieved Articles ---\n";
    articles.forEach((a, i) => {
      prompt += `${i + 1}. Title: ${a.title}\n`;
      if (a.url)         prompt += `   URL: ${a.url}\n`;
      if (a.source)      prompt += `   Source: ${a.source}\n\n`;
    });
  } else {
    prompt += "No relevant articles found; use your own knowledge to evaluate.\n\n";
  }

  prompt += `
Please prioritize evidence from the provided articles when evaluating the claim (since your built‑in knowledge may be outdated). Use the articles as your main source of truth, and only supplement with your own knowledge if absolutely necessary.

Respond in this format:
Explanation: <your reasoning, citing the articles>
Verdict: <TRUE | FALSE | VALID | INVALID>
`;

  console.log("\n[DEBUG] Prompt for Gemini:\n--------------------------\n" + prompt);

  // Hit Gemini
  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  try {
    console.log("[DEBUG] Sending prompt to Gemini…");
    const result = await model.generateContent({
      contents:       [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
      safetySettings,
    });

    const raw = result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    console.log("\n[DEBUG] Gemini Response:\n------------------------\n" + raw);

    const verdictMatch     = raw.match(/Verdict:\s*(TRUE|FALSE|VALID|INVALID)/i);
    const explanationMatch = raw.match(/Explanation:\s*([\s\S]*?)\nVerdict:/i);

    return {
      verdict:     verdictMatch?.[1]?.toUpperCase() || "UNKNOWN",
      explanation: explanationMatch?.[1]?.trim()  || raw,
    };
  } catch (err) {
    console.error("[ERROR] Gemini generation failed:", err);
    return null;
  }
}
