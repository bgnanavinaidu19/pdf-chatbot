const pdf = require("pdf-parse");
const fs = require("fs");

function normalizeText(text) {
  if (!text) return "";
  return text
    .replace(/(\w)-\s*\n\s*(\w)/g, "$1$2") // Repair hyphenated words broken by newlines
    .replace(/[ \t]+/g, " ")               // Collapse multiple spaces/tabs
    .replace(/\n\s*\n\s*\n+/g, "\n\n")     // Collapse triple+ newlines to double
    .replace(/[^\x20-\x7E\n]/g, "")        // Remove non-printable/control characters
    .trim();
}

async function extractText(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    
    // Ensure pdf-parse is a function (handling different import styles)
    const parse = typeof pdf === 'function' ? pdf : pdf.default;
    
    if (typeof parse !== 'function') {
      throw new Error("PDF parser library not loaded correctly.");
    }

    const data = await parse(dataBuffer);
    if (!data || !data.text || data.text.trim().length < 50) {
      throw new Error("No sufficient text found in the PDF. It might be scanned or blank.");
    }
    
    // Clean and normalize the text for better AI readability
    return normalizeText(data.text);
  } catch (error) {
    console.error("PDF Parsing Error:", error.message);
    if (!fs.existsSync("logs")) fs.mkdirSync("logs");
    fs.appendFileSync("logs/parsing_errors.log", `${new Date().toISOString()} - ${error.stack || error.toString()}\n`);
    throw new Error("Failed to extract text from the PDF file: " + error.message);
  }
}

function chunkText(text) {
  // Increase chunk size (3000 characters) to reduce the number of API requests for large books
  const size = 3000;
  let chunks = [];

  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }

  return chunks;
}

module.exports = { extractText, chunkText, normalizeText };