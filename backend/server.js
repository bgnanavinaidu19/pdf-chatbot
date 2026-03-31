require("dotenv").config();

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const { extractText } = require("./utils");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// gemini-2.5-flash is confirmed available for this API key.
// It has a 1M token context window — perfect for full-book analysis.
const chatModel = genAI.getGenerativeModel({
  model: "models/gemini-2.5-flash",
  generationConfig: { 
    temperature: 0.1, 
    topP: 0.95,
    maxOutputTokens: 4096
  }
});

function handleGreetings(question) {
  const q = question.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  // Final Intent Check: Is it social or document related?
  const socialTriggers = ["hello", "hi", "hey", "thanks", "bye", "who are you", "what is your name"];
  if (socialTriggers.some(t => q.includes(t)) && q.length < 20) {
    return "I'm **DocBot**, your document analysis expert. I'm ready to dive into the details of your PDF! What would you like to know about the characters or story?";
  }
  return null;
}

// Store state locally
let fullBookText = "";
let currentFileName = "";
let chatCache = new Map(); // Simple cache to save API quota for repeated questions

// Helper to find relevant context via keyword searching
function findRelevantContext(question, text, maxChars = 25000) {
  if (!text) return "";

  const qLower = question.toLowerCase();
  // Enhanced keyword extraction: focus on nouns/names
  const keywords = [...new Set([...qLower.split(/\s+/).filter(w => w.length > 2), "protagonist", "climax", "resolution"])];

  let metaContext = "";
  const isMetaQuery = qLower.includes("author") || qLower.includes("who wrote") || qLower.includes("writer") || qLower.includes("by whom");
  const isContentQuery = qLower.includes("character") || qLower.includes("intro") || qLower.includes("who is") || qLower.includes("story") || qLower.includes("about");

  // Always include the first 8000 characters as it usually contains the title, author and introduction
  metaContext += text.substring(0, 8000) + "\n\n--- [BOOK INTRODUCTION / START] ---\n\n";

  if (isMetaQuery) {
    metaContext += "\n\n--- [END OF BOOK] ---\n\n" + text.substring(Math.max(0, text.length - 8000));
  }

  if (keywords.length === 0) return (metaContext + text).substring(0, maxChars);

  let paragraphs = text.split(/\n\s*\n/);
  let scoredParagraphs = paragraphs.map(p => {
    let score = 0;
    let pLower = p.toLowerCase();

    keywords.forEach(k => {
      if (pLower.includes(k)) {
        score += 10;
        // Exact word match bonus
        if (new RegExp(`\\b${k}\\b`, "i").test(p)) score += 15;
      }
    });

    return { text: p, score, index: paragraphs.indexOf(p) };
  });

  scoredParagraphs.sort((a, b) => b.score - a.score);

  let result = metaContext;
  let seenIndices = new Set();

  for (let i = 0; i < scoredParagraphs.length; i++) {
    const p = scoredParagraphs[i];
    if (p.score === 0) continue;

    const originalIndex = p.index;
    // Include context: 2 paragraphs before and 2 after
    for (let j = Math.max(0, originalIndex - 2); j <= Math.min(paragraphs.length - 1, originalIndex + 2); j++) {
      if (!seenIndices.has(j)) {
        if (result.length + paragraphs[j].length > maxChars) break;
        result += paragraphs[j] + "\n\n";
        seenIndices.add(j);
      }
    }
    if (result.length > maxChars) break;
  }

  return result || (metaContext + text).substring(0, maxChars);
}

// ===== UPLOAD ROUTE =====
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const filePath = req.file.path;
    currentFileName = req.file.originalname;

    // Total Memory Purge: Wipe old text and cache before saving new one
    fullBookText = "";
    chatCache.clear();

    // Clear the uploads directory entirely
    const uploadDir = "uploads/";
    fs.readdirSync(uploadDir).forEach(file => {
      if (file !== req.file.filename) {
        try { fs.unlinkSync(uploadDir + file); } catch (e) { }
      }
    });

    // Read the book text
    const text = await extractText(filePath);
    fullBookText = text || "";

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    
    const isFullIndex = text.length < 1500000;
    res.json({ 
      message: `DocBot has indexed "${currentFileName}"! It is now in ${isFullIndex ? "Full Recall" : "High Contrast"} mode.`,
      isFullIndex,
      charCount: text.length
    });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ error: "Error reading the book: " + error.message });
  }
});

// ===== CHAT ROUTE =====
app.post("/chat", async (req, res) => {
  try {
    const question = req.body.question;
    if (!question) return res.status(400).json({ error: "Question is empty." });

    const qKey = question.trim().toLowerCase();

    // 1. Local Greeting Check (ALWAYS PRIORITIZE)
    const localAnswer = handleGreetings(question);
    if (localAnswer) return res.json({ answer: localAnswer });

    // 2. Cache Check
    if (chatCache.has(qKey)) {
      console.log("Serving from cache...");
      return res.json({ answer: chatCache.get(qKey) });
    }

    console.log(`[ANALYSIS] Document: "${currentFileName}" (${fullBookText.length} chars)`);
    console.log(`[DIAGNOSTIC] Start of text: "${fullBookText.substring(0, 100)}..."`);
    console.log(`[DIAGNOSTIC] End of text: "...${fullBookText.substring(Math.max(0, fullBookText.length - 100))}"`);
    
    // DECISION: Full Text vs. Partial Search
    // Gemini 3.1 Flash has 1M token context. ~1.5M characters is roughly 400k tokens.
    // We pass the FULL book for most documents to ensure perfect accuracy.
    const useFullContext = fullBookText.length < 1500000;
    const context = useFullContext 
      ? fullBookText 
      : findRelevantContext(question, fullBookText);

    const prompt = `You are **DocBot Pro**, a hyper-accurate intelligence agent designed for deep literary and document analysis.

MISSION: Answer the User Question with 100% precision based ONLY on the provided context.

DOCUMENT: "${currentFileName || "Uploaded PDF"}"
RECALL MODE: ${useFullContext ? "FULL UNABRIDGED EXTRACTION" : "HIGH-DENSITY TARGETED SEARCH"}

STRICT GROUNDING RULES:
1. **Scour Entire Context**: Think step-by-step to find the answer buried in the text.
2. **Identity Verification**: Be extremely careful with character names (e.g., Ava, Alex, Volkov).
3. **No External Knowledge**: If the answer isn't in the text, say: "My records for ${currentFileName} do not specify that detail."
4. **Markdown Formatting**: Use **bolding** for important names and facts.

--- 
[START OF PROVIDED CONTEXT]
${context}
[END OF PROVIDED CONTEXT]
---

User Question: ${question}
DocBot Pro Reasoning & Analysis:`;

    // Retry Logic for 429
    let lastError = null;
    for (let i = 0; i < 5; i++) {
      try {
        const result = await chatModel.generateContent(prompt);
        const answer = (await result.response).text();
        chatCache.set(qKey, answer); // Cache result
        return res.json({ answer });
      } catch (error) {
        lastError = error;
        if (error.message.includes("429") || error.message.includes("Quota")) {
          console.warn(`Rate limited. Retail attempt ${i + 1}/5...`);
          await new Promise(r => setTimeout(r, 2000 * (i + 1))); // Exponential backoff
        } else {
          throw error;
        }
      }
    }
    throw lastError;

  } catch (error) {
    console.error("Chat Error:", error.message);
    const isRateLimit = error.message.includes("429") || error.message.includes("Quota");
    const errorMsg = isRateLimit
      ? "The AI is currently under high load. Please wait 10 seconds and try again."
      : "Error analyzing document: " + error.message;
    res.status(500).json({ error: errorMsg });
  }
});

app.listen(5001, () => console.log("Final Restored DocBot running on port 5001"));