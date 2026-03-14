// repetitionChecker.js
// Checks for repeated words in resume text and suggests synonyms for common verbs.

const COMMON_SYNONYMS = {
  optimized: ["improved", "streamlined", "enhanced"],
  created: ["established", "generated", "initiated"],
  designed: ["planned", "developed", "crafted"],
  enhanced: ["improved", "upgraded", "fine-tuned"],
  integrated: ["incorporated", "merged", "blended"]
};

function repetitionChecker(text, minCount = 3) {
  // Normalize text
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const freq = {};
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }

  // Find repeated words
  const repeated = Object.entries(freq)
    .filter(([word, count]) => count >= minCount && COMMON_SYNONYMS[word])
    .map(([word, count]) => ({
      word,
      count,
      suggestions: COMMON_SYNONYMS[word]
    }));

  return repeated;
}

module.exports = repetitionChecker;
