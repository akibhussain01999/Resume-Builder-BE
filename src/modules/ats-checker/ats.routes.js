const express = require("express");
const readUploadedFile = require("./atsResumeService").readUploadedFile;
const parseResume = require("./atsResumeService").parseResume;
const analyzeResumeWithAI = require("./atsResumeService").analyzeResumeWithAI;
const analyzeResume = require("./atsResumeService").analyzeResume;
const multer = require("multer");

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();



router.post("/upload-resume", upload.single("resume"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded." });
        }
        const resumeText = await readUploadedFile(req.file.buffer, req.file);
        const jobDescription = req.body.jobDescription || "";
        const userId = req.body.userId || "unknown_user";

        // 1. Parse resume dynamically
        const parsedData = await parseResume(resumeText);

        // 2. Analyze resume with AI for ATS + improvements
        const atsResult = await analyzeResume(parsedData, jobDescription, userId);
        console.log("Final ATS analysis result:", atsResult);

        res.json({
            ...atsResult,
            userId
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});


router.post("/ai-resume-rewrite", async (req, res) => {
    try {
        const { resumeId, userId, atsResult, structuredResume, jobDescription, templateId } = req.body;
        const aiResult = await analyzeResumeWithAI({ resumeId, userId, atsResult, structuredResume, jobDescription, templateId });
        console.log("Final AI resume rewrite result:", aiResult);
        res.json(aiResult);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;