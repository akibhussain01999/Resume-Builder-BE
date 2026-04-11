const express = require("express");
const multer = require("multer");
const {
    uploadAndAnalyze,
    uploadAndEdit,
    aiRewrite,
    uploadAndParse,
    parseFromText,
    uploadAndMap,
    linkedinImport,
} = require("./dynamicResume.controller");

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// ─── Main Flow ───
// Step 1: Upload resume → dynamic JSON + ATS analysis
router.post("/upload-and-analyze", upload.single("resume"), uploadAndAnalyze);

// Upload resume → dynamic JSON + save to builder (no ATS)
router.post("/upload-and-edit", upload.single("resume"), uploadAndEdit);

// Step 2: AI rewrite → dynamic JSON + ATS result → fixed DB format
router.post("/ai-rewrite", aiRewrite);

// ─── LinkedIn Import ───
router.post("/linkedin-import", linkedinImport);

// ─── Utility endpoints ───
router.post("/upload", upload.single("resume"), uploadAndParse);
router.post("/parse-text", parseFromText);
router.post("/upload-and-map", upload.single("resume"), uploadAndMap);

module.exports = router;
