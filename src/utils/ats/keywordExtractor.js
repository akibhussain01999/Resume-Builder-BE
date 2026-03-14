const nlp = require("compromise");

function extractKeywords(text){

const doc = nlp(text);

const nouns = doc.nouns().out("array");

const unique = [...new Set(nouns)];

return unique
.map(w=>w.trim())
.filter(w=>w.length>2);

}

module.exports = extractKeywords;