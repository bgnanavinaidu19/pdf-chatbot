require("dotenv").config();

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const { extractText } = require("./utils");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- Configuration & Initialization ---

const app = express();
app.use(cors()); // Simplest, most open CORS for file origins
app.use(express.json());

const uploadDir = "uploads/";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const upload = multer({ dest: uploadDir });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * AI Model Configuration
 * Using gemini-1.5-flash for speed and large context window (1M tokens).
 */
const chatModel = genAI.getGenerativeModel({
  model: "gemini-flash-latest",
  generationConfig: { 
    temperature: 0.7, 
    topP: 0.95,
    maxOutputTokens: 4096
  }
});

// --- State Management ---

let fullBookText = "";
let currentFileName = "";
let chatCache = new Map();

/**
 * Handles basic social interactions and greetings locally.
 * @param {string} question - The user's input question.
 * @returns {string|null} - The response string or null if not a greeting.
 */
function handleGreetings(question) {
  const q = question.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  const socialTriggers = ["hello", "hi", "hey", "thanks", "bye", "who are you", "what is your name"];
  
  if (socialTriggers.some(t => q.includes(t)) && q.length < 20) {
    return "Hello! I'm **DocBot Pro**, your personal intelligence assistant. I can help you analyze documents or answer general questions. How can I assist you today?";
  }
  return null;
}

/**
 * Extracts relevant paragraphs from the document based on keywords.
 * Used when the document exceeds the optimal full-text context limit.
 * @param {string} question - The user's query.
 * @param {string} text - The full document text.
 * @param {number} maxChars - Maximum characters to return.
 * @returns {string} - The extracted context.
 */
function findRelevantContext(question, text, maxChars = 25000) {
  if (!text) return "";

  const qLower = question.toLowerCase();
  const keywords = [...new Set([...qLower.split(/\s+/).filter(w => w.length > 2), "protagonist", "climax", "resolution"])];

  let metaContext = "";
  const isMetaQuery = qLower.includes("author") || qLower.includes("who wrote") || qLower.includes("writer") || qLower.includes("by whom");

  // Include the beginning of the book for context (Title, Author, Intro)
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
    // Windowed context: 2 paragraphs before and after
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

// --- API Routes ---

/**
 * Handle document uploads, indexing the text for later chat.
 */
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const filePath = req.file.path;
    currentFileName = req.file.originalname;

    // Reset state for new document
    fullBookText = "";
    chatCache.clear();

    // Cleanup uploads directory
    const uploadDir = "uploads/";
    fs.readdirSync(uploadDir).forEach(file => {
      if (file !== req.file.filename) {
        try { fs.unlinkSync(uploadDir + file); } catch (e) { }
      }
    });

    // Extract and store text
    const text = await extractText(filePath);
    fullBookText = text || "";

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    
    // Choose indexing mode based on length
    const isFullIndex = text.length < 1500000;
    res.json({ 
      message: `DocBot indexed "${currentFileName}"! Mode: ${isFullIndex ? "Full Recall" : "Targeted Search"}.`,
      isFullIndex,
      charCount: text.length
    });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ error: "Error reading document: " + error.message });
  }
});

/**
 * Main chat endpoint for document Q&A and general queries.
 */
app.post("/chat", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "Question is empty." });

    const qKey = question.trim().toLowerCase();

    // 1. Check local greetings
    const localAnswer = handleGreetings(question);
    if (localAnswer) return res.json({ answer: localAnswer });

    // 2. Check cache
    if (chatCache.has(qKey)) {
      return res.json({ answer: chatCache.get(qKey) });
    }

    // 3. Prepare AI Prompt
    const useFullContext = fullBookText.length < 1500000;
    const context = useFullContext ? fullBookText : findRelevantContext(question, fullBookText);

    const prompt = `You are **DocBot Pro**, a versatile and hyper-accurate intelligence agent.
    
Your goal is to assist the user by answering questions based on the provided document context OR your general knowledge if the question is not document-specific.

${currentFileName ? `CURRENT DOCUMENT: "${currentFileName}"` : "NO DOCUMENT UPLOADED YET."}
RECALL MODE: ${useFullContext ? "FULL UNABRIDGED EXTRACTION" : "HIGH-DENSITY TARGETED SEARCH"}

GROUNDING & RESPONSE RULES:
1. **Document Priority**: If the question is about the uploaded document, search the context thoroughly and prioritize it.
2. **General Knowledge**: If the question is general, answer using your internal knowledge.
3. **No Refusal**: Do NOT say you can't answer because it's not in the PDF unless the user explicitly asks for something "from the text" that is missing.
4. **Markdown**: Use **bolding** for important names and facts.
5. **Transparency**: If document info is missing, say: "My records for ${currentFileName || "the document"} don't specify that, but I can help with other questions."

--- 
[START OF PROVIDED CONTEXT]
${context || "No document context available."}
[END OF PROVIDED CONTEXT]
---

User Question: ${question}
DocBot Pro Analysis & Response:`;

    // 4. Generate AI Response with Retry Logic
    let lastError = null;
    for (let i = 0; i < 5; i++) {
      try {
        const result = await chatModel.generateContent(prompt);
        const answer = (await result.response).text();
        chatCache.set(qKey, answer);
        return res.json({ answer });
      } catch (error) {
        lastError = error;
        if (error.message.includes("429") || error.message.includes("Quota")) {
          console.warn(`Rate limit hit. Retrying (${i + 1}/5)...`);
          await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        } else {
          throw error;
        }
      }
    }
    throw lastError;

  } catch (error) {
    console.error("Chat Error:", error.message);
    const isRateLimit = error.message.includes("429") || error.message.includes("Quota");
    res.status(500).json({ 
      error: isRateLimit ? "AI is busy. Please wait a few seconds." : "Error: " + error.message 
    });
  }
});

const PORT = 5005;
const HOST = '127.0.0.1';

app.listen(PORT, HOST, () => {
  console.log(`\n🚀 DocBot Pro is now ONLINE!`);
  console.log(`📡 Local Endpoint: http://${HOST}:${PORT}`);
  console.log(`📁 API: /upload and /chat ready.\n`);
});