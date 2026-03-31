const express = require("express");
const multer = require("multer");
const {
    uploadAndAnalyze,
    aiRewrite,
    uploadAndParse,
    parseFromText,
    uploadAndMap,
} = require("./dynamicResume.controller");

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// ─── Main Flow ───
// Step 1: Upload resume → dynamic JSON + ATS analysis
router.post("/upload-and-analyze", upload.single("resume"), uploadAndAnalyze);

// Step 2: AI rewrite → dynamic JSON + ATS result → fixed DB format
router.post("/ai-rewrite", aiRewrite);

// ─── Utility endpoints ───
router.post("/upload", upload.single("resume"), uploadAndParse);
router.post("/parse-text", parseFromText);
router.post("/upload-and-map", upload.single("resume"), uploadAndMap);

module.exports = router;
