const {
    extractTextFromFile,
    parseDynamicResume,
    analyzeDynamicResume,
    rewriteResume,
    fetchLinkedInProfile,
    parseLinkedInToResume,
} = require("./dynamicResume.service");
const { mapDynamicToOriginal } = require("./dynamicToOriginal.mapper");
const resumeModel = require("../resume/resume.model");
const mongoose = require("mongoose");

// Lazy-load ESM atsResumeModel
let atsResumeModel;
const getAtsResumeModel = async () => {
    if (!atsResumeModel) {
        const mod = await import("../ats-checker/atsResumeModel.js");
        atsResumeModel = mod.default;
    }
    return atsResumeModel;
};

// ─── Step 1: Upload resume → dynamic JSON + ATS analysis + save to DB ───
const uploadAndAnalyze = async (req, res) => {
    try {
        if (!req.file) {
            return res
                .status(400)
                .json({ success: false, message: "No file uploaded." });
        }

        const jobDescription = req.body.jobDescription || "";
        const userId = req.body.userId || "unknown_user";

        // 1. Extract text from PDF/text
        const resumeText = await extractTextFromFile(req.file.buffer, req.file);

        // 2. Dynamically parse into self-describing JSON
        const dynamicJson = await parseDynamicResume(resumeText);

        // 3. Map to original format for DB storage
        const structuredResume = mapDynamicToOriginal(dynamicJson);

        // 4. Run ATS analysis on the dynamic JSON
        const atsResult = await analyzeDynamicResume(dynamicJson, jobDescription);

        // 5. Save to DB (same as upload-resume)
        const ATSResume = await getAtsResumeModel();
        const isValidObjectId = mongoose.Types.ObjectId.isValid(userId);

        const createdResume = await ATSResume.create({
            ...(isValidObjectId && { user_id: userId }),
            resume_json: structuredResume,
            ats_result: atsResult,
        });

        res.json({
            success: true,
            data: {
                resumeId: createdResume?._id || null,
                userId: createdResume?.user_id || userId,
                dynamicResume: dynamicJson,
                structuredResume: structuredResume,
                atsResult: atsResult,
            },
        });
    } catch (err) {
        console.error("[dynamic-resume-poc] uploadAndAnalyze error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── Step 2: AI rewrite → save improved resume to DB ───
const aiRewrite = async (req, res) => {
    try {
        const { resumeId, userId, dynamicResume, atsResult, jobDescription, templateId } = req.body;

        if (!dynamicResume || !atsResult || !resumeId) {
            return res.status(400).json({
                success: false,
                message: "resumeId, dynamicResume, and atsResult are required.",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(resumeId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid resumeId format.",
            });
        }

        // 1. AI rewrites into fixed DB format
        const rewriteResult = await rewriteResume({
            dynamicJson: dynamicResume,
            atsResult: atsResult,
            jobDescription: jobDescription || "",
        });

        const rewrittenData = rewriteResult.improved_resume;
        const updatedAtsResult = rewriteResult.updated_ats_result;

        // 2. Find existing ATS record
        const ATSResume = await getAtsResumeModel();
        const atsRecord = await ATSResume.findById(resumeId);

        if (!atsRecord) {
            return res.status(404).json({
                success: false,
                message: "ATS resume record not found.",
            });
        }

        // 3. Save improved resume to Resume collection (only if a valid userId exists)
        const resolvedUserId = userId || String(atsRecord.user_id || "");
        const hasValidUserId = mongoose.Types.ObjectId.isValid(resolvedUserId);

        let improvedResumeId = null;
        let savedResume = null;

        if (hasValidUserId) {
            const existingImprovedResumeId = atsRecord.improved_resume_id;

            if (existingImprovedResumeId) {
                savedResume = await resumeModel.findByIdAndUpdate(
                    existingImprovedResumeId,
                    {
                        title: rewrittenData.title || "Improved Resume",
                        data: rewrittenData,
                    },
                    { new: true }
                );
                improvedResumeId = existingImprovedResumeId;
            } else {
                savedResume = await resumeModel.create({
                    userId: mongoose.Types.ObjectId.createFromHexString(resolvedUserId),
                    title: rewrittenData.title || "Improved Resume",
                    templateId: templateId || "modern",
                    themeColor: "#3eb489",
                    data: rewrittenData,
                });
                improvedResumeId = savedResume._id;
            }

            await resumeModel.findByIdAndUpdate(
                savedResume._id,
                { resumeId: `resume_${atsRecord._id}` }
            );
        }

        // 4. Update ATS record with improved resume
        await ATSResume.findByIdAndUpdate(resumeId, {
            improved_resume_json: rewrittenData,
            ...(improvedResumeId && { improved_resume_id: improvedResumeId }),
            ats_result: updatedAtsResult,
        });

        res.json({
            success: true,
            data: {
                resumeData: {
                    ...rewrittenData,
                    templateId: savedResume?.templateId || "modern",
                    themeColor: savedResume?.themeColor || "#3eb489",
                    hiddenSections: savedResume?.hiddenSections || [],
                    resumeId: savedResume ? `resume_${atsRecord._id}` : null,
                },
                updatedAtsResult,
            },
        });
    } catch (err) {
        console.error("[dynamic-resume-poc] aiRewrite error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── Utility: just parse (no ATS, no DB) ───
const uploadAndParse = async (req, res) => {
    try {
        if (!req.file) {
            return res
                .status(400)
                .json({ success: false, message: "No file uploaded." });
        }

        const resumeText = await extractTextFromFile(req.file.buffer, req.file);
        const dynamicJson = await parseDynamicResume(resumeText);

        res.json({ success: true, data: dynamicJson });
    } catch (err) {
        console.error("[dynamic-resume-poc] Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── Utility: parse from raw text ───
const parseFromText = async (req, res) => {
    try {
        const { resumeText } = req.body;
        if (!resumeText || !resumeText.trim()) {
            return res
                .status(400)
                .json({ success: false, message: "resumeText is required." });
        }

        const dynamicJson = await parseDynamicResume(resumeText);
        res.json({ success: true, data: dynamicJson });
    } catch (err) {
        console.error("[dynamic-resume-poc] Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── Utility: upload + map to original format ───
const uploadAndMap = async (req, res) => {
    try {
        if (!req.file) {
            return res
                .status(400)
                .json({ success: false, message: "No file uploaded." });
        }

        const resumeText = await extractTextFromFile(req.file.buffer, req.file);
        const dynamicJson = await parseDynamicResume(resumeText);
        const originalJson = mapDynamicToOriginal(dynamicJson);

        res.json({
            success: true,
            data: { dynamic: dynamicJson, original: originalJson },
        });
    } catch (err) {
        console.error("[dynamic-resume-poc] Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── LinkedIn Import: URL (via ProxyCurl) or pasted text → dynamic JSON + structured resume ───
const linkedinImport = async (req, res) => {
    try {
        const { linkedinUrl, linkedinText, userId, jobDescription, templateId } = req.body;

        if (!linkedinUrl && !linkedinText) {
            return res.status(400).json({
                success: false,
                message:
                    "Provide either 'linkedinUrl' (requires PROXYCURL_API_KEY) or 'linkedinText' (paste your LinkedIn profile text).",
            });
        }

        let dynamicJson;

        if (linkedinText && linkedinText.trim()) {
            // ── Text-paste mode: parse the pasted LinkedIn profile text directly ──
            dynamicJson = await parseDynamicResume(linkedinText.trim());

            // Inject LinkedIn URL into contacts if provided alongside text
            if (linkedinUrl) {
                if (!dynamicJson.header.contacts) dynamicJson.header.contacts = [];
                const hasLinkedIn = dynamicJson.header.contacts.some(
                    (c) => c.type === "linkedin"
                );
                if (!hasLinkedIn) {
                    dynamicJson.header.contacts.unshift({
                        type: "linkedin",
                        value: linkedinUrl.trim(),
                    });
                }
            }
            dynamicJson.meta = {
                ...dynamicJson.meta,
                source: "linkedin_text",
                ...(linkedinUrl && { linkedinUrl: linkedinUrl.trim() }),
            };
        } else {
            // ── URL mode: fetch via ProxyCurl API ──
            const profileContent = await fetchLinkedInProfile(linkedinUrl.trim());
            dynamicJson = await parseLinkedInToResume(profileContent, linkedinUrl.trim());
        }

        // 3. Map to original fixed format
        const structuredResume = mapDynamicToOriginal(dynamicJson);

        // 4. Optionally run ATS analysis if jobDescription provided
        let atsResult = null;
        if (jobDescription && jobDescription.trim()) {
            atsResult = await analyzeDynamicResume(dynamicJson, jobDescription);
        }

        // 5. Save to DB if a valid userId is present
        let savedResumeId = null;
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            const savedResume = await resumeModel.create({
                userId: mongoose.Types.ObjectId.createFromHexString(userId),
                title: structuredResume.name
                    ? `${structuredResume.name} — LinkedIn Import`
                    : "LinkedIn Import",
                templateId: templateId || "modern",
                themeColor: "#0077b5",
                data: structuredResume,
            });
            await resumeModel.findByIdAndUpdate(savedResume._id, {
                resumeId: `resume_${savedResume._id}`,
            });
            savedResumeId = `resume_${savedResume._id}`;
        }

        res.json({
            success: true,
            data: {
                resumeId: savedResumeId,
                dynamicResume: dynamicJson,
                structuredResume,
                ...(atsResult && { atsResult }),
            },
        });
    } catch (err) {
        console.error("[dynamic-resume-poc] linkedinImport error:", err);
        const isUserFacing =
            err.message.includes("LinkedIn") ||
            err.message.includes("Invalid LinkedIn") ||
            err.message.includes("timed out");
        res.status(isUserFacing ? 422 : 500).json({
            success: false,
            message: err.message,
        });
    }
};

module.exports = {
    uploadAndAnalyze,
    aiRewrite,
    uploadAndParse,
    parseFromText,
    uploadAndMap,
    linkedinImport,
};
