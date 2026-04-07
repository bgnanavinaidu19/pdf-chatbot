require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function check() {
  console.log("--- DocBot Diagnostic ---");
  console.log("Key Found:", process.env.GEMINI_API_KEY ? "Yes (starts with " + process.env.GEMINI_API_KEY.substring(0, 7) + ")" : "No");

  if (!process.env.GEMINI_API_KEY) {
    console.error("ERROR: GEMINI_API_KEY is missing from .env");
    return;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    console.log("Testing connection to Gemini 1.5 Flash...");
    const result = await model.generateContent("Hello!");
    const response = await result.response;
    console.log("SUCCESS: Gemini replied:", response.text());
    console.log("\n--- READY TO START ---");
    console.log("You can now run: node server.js");
  } catch (err) {
    console.error("FAILED:", err.message);
    if (err.message.includes("API key not valid")) {
      console.error("TIP: Your API key is incorrect or has been deactivated by Google.");
    }
  }
}

check();
