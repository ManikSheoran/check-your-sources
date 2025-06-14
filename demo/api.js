import dotenv from 'dotenv';
import process from 'process';
import fetch from 'node-fetch';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

dotenv.config();

const NEWS_API = process.env.NEWS_API;
const GEMINI_KEY = process.env.GEMINI_API;

const generationConfig = {
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 1024,
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
];

const check = async (claim) => {
  console.log(`[DEBUG] Evaluating claim: "${claim}"`);

  if (!NEWS_API || !GEMINI_KEY) {
    console.error("[ERROR] Missing API keys in .env");
    throw new Error("Missing NEWS_API or GEMINI_API");
  }

  if (!claim || typeof claim !== 'string' || claim.trim() === '') {
    console.warn("[WARNING] Claim is empty or invalid");
    return null;
  }

  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-05-20" });

  const today = new Date().toISOString().split('T')[0];
  const newsUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(claim)}&from=${today}&sortBy=popularity&language=en&apiKey=${NEWS_API}`;

  let articles = [];
  try {
    console.log("[DEBUG] Fetching articles from NewsAPI...");
    const res = await fetch(newsUrl);
    const data = await res.json();

    if (data.articles) {
      articles = data.articles.slice(0, 5).map((a, i) => ({
        title: a.title,
        description: a.description,
        url: a.url,
        source: a.source?.name,
      }));
      console.log(`[DEBUG] ${articles.length} articles found.`);
    } else {
      console.warn("[WARNING] No articles found in NewsAPI response.");
    }
  } catch (err) {
    console.error("[ERROR] Failed to fetch from NewsAPI:", err);
  }

  let prompt = `Evaluate the following claim: "${claim}"\n\n`;

  if (articles.length > 0) {
    prompt += "--- News Articles ---\n";
    articles.forEach((article, i) => {
      prompt += `${i + 1}. Title: ${article.title}\n`;
      if (article.description) prompt += `   Description: ${article.description}\n`;
      if (article.url) prompt += `   URL: ${article.url}\n`;
      if (article.source) prompt += `   Source: ${article.source}\n\n`;
    });
  } else {
    prompt += "No relevant articles were found. Use your own knowledge to evaluate.\n";
  }

  prompt += `
Please evaluate the truth of the claim based on:
1. The provided articles.
2. Your own up-to-date knowledge.

Respond in this format:
Explanation: <your reasoning>
Verdict: <TRUE | FALSE | VALID | INVALID>
`;

  console.log("\n[DEBUG] Prompt for Gemini:\n--------------------------\n" + prompt);

  try {
    console.log("[DEBUG] Sending prompt to Gemini...");
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
      safetySettings
    });

    const rawText = result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    console.log("\n[DEBUG] Gemini Response:\n------------------------\n" + rawText);

    const match = rawText.match(/Verdict:\s*(TRUE|FALSE|VALID|INVALID)/i);
    const verdict = match?.[1]?.toUpperCase() || "UNKNOWN";

    const explanationMatch = rawText.match(/Explanation:\s*([\s\S]*?)\nVerdict:/i);
    const explanation = explanationMatch?.[1]?.trim() || "";

    return {
      verdict,
      explanation,
    };
  } catch (err) {
    console.error("[ERROR] Gemini generation failed:", err);
    return null;
  }
};

export default check;
