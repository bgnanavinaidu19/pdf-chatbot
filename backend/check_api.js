const fs = require("fs");
require("dotenv").config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.models) {
        console.log("Available Models:");
        data.models.forEach(m => console.log(m.name));
    } else {
        console.log("Error response:", JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("Fetch Error:", error);
  }
}

listModels();
