require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function list() {
  console.log("--- Checking Available Models ---");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  try {
    // We use a different way to list models through the fetch API or SDK if supported
    // But since the SDK doesn't always expose listModels easily in all versions, 
    // let's try a common alternative model name first: "gemini-1.5-flash-latest"
    console.log("Try running this test with 'gemini-1.5-flash-latest' instead...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const result = await model.generateContent("Hi");
    console.log("SUCCESS with 'gemini-1.5-flash-latest'!");
    console.log("Correct name found. I will update your server now.");
  } catch (err) {
    console.log("Failed with 'gemini-1.5-flash-latest'. Error:", err.message);
    console.log("\nTry another common version: 'gemini-pro'");
    try {
        const model2 = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result2 = await model2.generateContent("Hi");
        console.log("SUCCESS with 'gemini-pro'!");
    } catch (err2) {
        console.log("Failed with 'gemini-pro'. Error:", err2.message);
    }
  }
}

list();
