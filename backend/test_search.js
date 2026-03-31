const fs = require('fs');

// Simulate the findRelevantContext function from server.js
function findRelevantContext(question, text, maxChars = 25000) {
  if (!text) return "";
  const qLower = question.toLowerCase();
  const keywords = [...new Set([...qLower.split(/\s+/).filter(w => w.length > 2), "protagonist", "climax", "resolution"])];
  let metaContext = "";
  metaContext += text.substring(0, 8000) + "\n\n--- [BOOK INTRODUCTION / START] ---\n\n";
  if (keywords.length === 0) return (metaContext + text).substring(0, maxChars);
  let paragraphs = text.split(/\n\s*\n/);
  let scoredParagraphs = paragraphs.map((p, idx) => {
    let score = 0;
    let pLower = p.toLowerCase();
    keywords.forEach(k => {
      if (pLower.includes(k)) {
        score += 10;
        if (new RegExp(`\\b${k}\\b`, "i").test(p)) score += 15;
      }
    });
    return { text: p, score, index: idx };
  });
  scoredParagraphs.sort((a, b) => b.score - a.score);
  let result = metaContext;
  let seenIndices = new Set();
  for (let i = 0; i < scoredParagraphs.length; i++) {
    const p = scoredParagraphs[i];
    if (p.score === 0) continue;
    const originalIndex = p.index;
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

// MOCK DATA: A simple story about a character named "Elena" and her "Locket"
const mockText = Array(500).fill("Random text about a large forest and silence in the woods without any specific characters.").join("\n\n") + 
"\n\nElena found the golden locket hidden behind the fireplace of the old mansion.\n\n" + 
Array(500).fill("More random text about mountains and rivers that has nothing to do with the story.").join("\n\n");

const q = "Who found the golden locket?";
const context = findRelevantContext(q, mockText);

console.log("Context found (length):", context.length);
if (context.includes("Elena") && context.includes("locket")) {
    console.log("SUCCESS: Elena and locket found in context.");
} else {
    console.log("FAILURE: Elena and locket NOT found in context.");
}
