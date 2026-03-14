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
        const resumeText = await readUploadedFile(req.file.buffer, req.file);
        const jobDescription = req.body.jobDescription || "";

        // 1. Parse resume dynamically
        const parsedData = await parseResume(resumeText);

        // 2. Analyze resume with AI for ATS + improvements
        const atsResult = await analyzeResume(parsedData, jobDescription);
        console.log("Final ATS analysis result:", atsResult);

        res.json(atsResult);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});


module.exports = router;