const pdf = require("pdf-parse");
const fs = require("fs");

/**
 * Clean up text extracted from PDFs to remove noise and repair formatting.
 * @param {string} text - The raw text from the PDF.
 * @returns {string} - Cleaned and normalized text.
 */
function normalizeText(text) {
  if (!text) return "";
  
  return text
    .replace(/(\w)-\s*\n\s*(\w)/g, "$1$2") // Repair hyphenated words broken by newlines
    .replace(/[ \t]+/g, " ")               // Collapse multiple spaces/tabs
    .replace(/\n\s*\n\s*\n+/g, "\n\n")     // Collapse triple+ newlines to double
    .replace(/[^\x20-\x7E\n]/g, "")        // Remove non-printable/control characters
    .trim();
}

/**
 * Extract and clean text from a PDF file.
 * @param {string} filePath - Path to the PDF file.
 * @returns {Promise<string>} - The extracted text.
 */
async function extractText(filePath) {
  try {
    if (!fs.existsSync(filePath) || fs.lstatSync(filePath).isDirectory()) {
      throw new Error(`Invalid file path: ${filePath}`);
    }
    const dataBuffer = fs.readFileSync(filePath);
    
    // Polyfill to handle different import styles for pdf-parse
    const parse = typeof pdf === 'function' ? pdf : pdf.default;
    
    if (typeof parse !== 'function') {
      throw new Error("PDF parser library not loaded correctly.");
    }

    const data = await parse(dataBuffer);
    
    // Defensive check for small files or scanned documents
    if (!data || !data.text || data.text.trim().length < 50) {
      throw new Error("No sufficient text found (scanned or blank PDF).");
    }
    
    return normalizeText(data.text);
  } catch (error) {
    console.error("PDF Parsing Error:", error.message);
    
    // Log errors locally for debugging
    if (!fs.existsSync("logs")) fs.mkdirSync("logs");
    fs.appendFileSync("logs/parsing_errors.log", `${new Date().toISOString()} - ${error.stack}\n`);
    
    throw new Error("Failed to extract text: " + error.message);
  }
}

/**
 * Chunk text into manageable pieces for processing if needed.
 * @param {string} text - The full document text.
 * @param {number} size - Desired chunk size in characters.
 * @returns {string[]} - Array of text chunks.
 */
function chunkText(text, size = 3000) {
  let chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

module.exports = { extractText, chunkText, normalizeText };