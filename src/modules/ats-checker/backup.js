// src/modules/ats-checker/index.js

import express from "express";
import multer from "multer";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs/promises";
import * as pdfParse from "pdf-parse";
import pdfTextExtract from "pdf-text-extract";
import atsResumeModel from "./atsResumeModel.js";
import os from "os";
import path from "path";
import { promises as fsPromises } from "fs";
import { connectDatabase } from "../../config/db.js";

const app = express();
const upload = multer();

dotenv.config();

 await connectDatabase();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const readUploadedFile = async (fileBuffer, fileInfo = {}) => {
    const isPdf =
        (fileInfo.mimetype === "application/pdf") ||
        (fileInfo.originalname && fileInfo.originalname.toLowerCase().endsWith(".pdf"));

    if (isPdf) {
        // Save buffer to a temp file
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(
            tempDir,
            `${Date.now()}_${fileInfo.originalname || "resume.pdf"}`
        );
        await fsPromises.writeFile(tempFilePath, fileBuffer);
        return new Promise((resolve, reject) => {
            pdfTextExtract(tempFilePath, async (err, pages) => {
                await fsPromises.unlink(tempFilePath); // clean up temp file
                if (err) return reject(err);
                resolve(pages.join("\n"));
            });
        });
    }

    // For text files
    return fileBuffer.toString("utf-8");
};


const parseResume = async (resumeText) => {

    const chunkSize = 6000; // safe token size
    const chunks = [];

    for (let i = 0; i < resumeText.length; i += chunkSize) {
        chunks.push(resumeText.slice(i, i + chunkSize));
    }

    let merged = {
        name: "",
        email: "",
        phone: "",
        jobRoles: [],
        skills: [],
        experience: [],
        education: [],
        projects: [],
        summary: [],
        achievements: [],
        strengths: [],
        interests: [],
        profile: []
    };

    for (const chunk of chunks) {

        const prompt = `
You are a resume parser AI.

Extract information from the resume text below.

Return ONLY valid JSON with this structure:

{
  "name": "",
  "email": "",
  "phone": "",
  "jobRoles": [],
  "skills": [],
  "experience": [],
  "education": [],
  "projects": [],
  "summary": [],
  "achievements": [],
  "strengths": [],
  "interests": [],
  "profile": []
}

Resume:
\`\`\`
${chunk}
\`\`\`
`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0,
            max_tokens: 1500
        });

        const jsonText = response?.choices?.[0]?.message?.content;

        if (!jsonText) continue;

        try {

            //  const cleaned = cleanJson(jsonText);
            const parsed = JSON.parse(jsonText);

            merged.name = merged.name || parsed.name;
            merged.email = merged.email || parsed.email;
            merged.phone = merged.phone || parsed.phone;

            merged.jobRoles = [...new Set([...merged.jobRoles, ...(parsed.jobRoles || [])])];
            merged.skills = [...new Set([...merged.skills, ...(parsed.skills || [])])];

            merged.experience = [...merged.experience, ...(parsed.experience || [])];
            merged.education = [...merged.education, ...(parsed.education || [])];
            merged.projects = [...merged.projects, ...(parsed.projects || [])];

            merged.summary = [...merged.summary, ...(parsed.summary || [])];
            merged.achievements = [...merged.achievements, ...(parsed.achievements || [])];
            merged.strengths = [...merged.strengths, ...(parsed.strengths || [])];
            merged.interests = [...merged.interests, ...(parsed.interests || [])];
            merged.profile = [...merged.profile, ...(parsed.profile || [])];

        } catch (err) {
            console.warn("JSON parse failed for chunk", err);
        }
    }
    return merged;
};

// Extract JSON safely from AI response
const extractJson = (text) => {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found in AI response");
    return JSON.parse(match[0]);
};

// ATS + AI Resume Analysis
const analyzeResume = async (resumeJson, jobDescription = "") => {
   

    const prompt = `
You are an **elite ATS system, senior technical recruiter, and resume evaluator**.

You have reviewed **thousands of resumes** and understand how recruiters and ATS systems evaluate candidates.

Your job is to **analyze the provided resume extremely critically** and produce a **structured ATS evaluation report**.

The goal is to help the candidate **improve their resume to pass ATS systems and impress recruiters.**

---------------------------------------------------------------------

CRITICAL RULES
• do the section wise analysis and provide detailed feedback on each section (summary, skills, experience, education, projects, achievements, profile).
• For each section, identify specific issues and provide detailed suggestions for improvement.
• Only analyze information present in the resume text.
• Do NOT invent companies, projects, bullet points, or achievements.
• If information is missing, clearly state it.
• each section improvemnt suggestion give multiple bullet point suggestions rather than just one.
• summery parsing: if the summary section is cut off or contains weird characters, attempt to join it and clean it up rather than leaving it as-is.
• if summery is missing, suggest adding a summary that highlights key skills and experience.
• if summery is present but very short, suggest expanding it to 2-3 sentences that provide an overview of the candidate's background and strengths.
• if summery is present but very long, suggest condensing it to 4-5 concise sentences that focus on the most important information.
• if summery is present but lacks keywords, suggest adding relevant keywords from the job description to improve ATS matching.
• if summery is present but lacks impact, suggest rephrasing it to highlight key achievements and skills rather than just listing experience.
• if summery is present but has formatting issues, suggest fixing formatting to improve readability (e.g. proper sentence structure, consistent punctuation, etc.).
• if experience section is missing, suggest adding an experience section that details past roles, responsibilities, and achievements.
• if experience section is present but lacks detail, suggest expanding it with specific bullet points that describe responsibilities and achievements in each role.
• if experience section is present but lacks metrics, suggest adding quantifiable results to each bullet point to demonstrate impact.
• if experience section is present but has weak bullet points, suggest improving bullet points with stronger action verbs and more specific descriptions of responsibilities and achievements.
• if skills section is missing, suggest adding a skills section that lists relevant technical and soft skills.
• if skills section is present but lacks important industry skills, suggest adding specific skills based on the job description.
• if skills section is present but has outdated skills, suggest removing outdated skills and replacing them with current ones.
• if skills section is present but has duplicate skills, suggest removing duplicates and consolidating the list.
• if education section is missing, suggest adding an education section that lists degrees, institutions, and graduation dates.
• if projects section is missing, suggest adding a projects section that highlights key projects and achievements.
• if achievements section is missing, suggest adding an achievements section that highlights key accomplishments and awards.
• if profile section is missing, suggest adding a profile section that provides a brief overview of the candidate's background and strengths.   
• if any section has formatting issues (e.g. inconsistent bullet points, poor indentation, etc.), suggest specific improvements to fix the formatting and improve readability.
• for each weak bullet provide 4-5 specific improved versions that use stronger action verbs and more specific descriptions of responsibilities and achievements.
• for each vague sentence, provide a specific improved version that is more clear and impactful.
• for missing metrics, specify exactly what kind of metrics to add and how to present them (e.g. "Add a bullet point like 'Improved API response time by 30% through optimizing database queries'").
• Never return empty arrays.
• Always provide detailed suggestions for improvement.
• Focus on **actionable feedback** that the candidate can use to improve their resume.
• Be extremely critical and specific, like a senior recruiter would be.
• give more detailed suggestions rather than just stating "Add more metrics" - specify what kind of metrics and how to present them.
• give more bullet point improvement suggestions rather than just "Use stronger action verbs" - specify which verbs to use and how to rephrase the bullet.
• For skills, identify which important industry skills are missing and suggest specific ones to add based on the job description.
• find repetition issues (e.g. same bullet point repeated in multiple roles) and suggest consolidating or rephrasing to avoid redundancy.
• for spelling and grammar issues, specify the exact issue and how to fix it (e.g. "Change 'mananged' to 'managed' in the second bullet point under Experience").
• for vague sentences, specify exactly how to make them more clear and impactful (e.g. "Change 'Worked on improving API performance' to 'Improved API response time by 30% through optimizing database queries'").
• return spelling and grammar issues with specific corrections, not just "Fix grammar".
• For vague sentences, specify exactly how to make them more clear and impactful.
• For formatting issues, specify exactly what the issue is and how to fix it (e.g. "Use consistent bullet point formatting with dashes and proper indentation").
• Return ONLY valid JSON. No explanations outside JSON.

---------------------------------------------------------------------

JOB DESCRIPTION (OPTIONAL)

${jobDescription || "No job description provided"}

If a job description is provided:
• Compare resume skills with job requirements
• Identify missing keywords
• Suggest improvements to match the role

---------------------------------------------------------------------

RESUME JSON

${JSON.stringify(resumeJson)}

---------------------------------------------------------------------

OUTPUT FORMAT FOR ATS ANALYSIS

{
"ats_score": number,

"score_breakdown":{
"keyword_optimization": number,
"achievements_metrics": number,
"bullet_strength": number,
"skills_coverage": number,
"experience_clarity": number,
"resume_structure": number
},

"problems_detected":[
"Example issue"
],

"weak_bullet_points":[
{
"original":"Example bullet",
"improved":"Improved bullet with metrics"
}
],
"quantifying_impact_issues": ["Example quantifying impact issue"],
"repetition_issues": ["Example repetition issue"],
"spelling_grammar_issues": ["Example spelling or grammar issue"],
"vague_sentences":[
{
"original":"Example sentence",
"improved":"Improved sentence"
}
],

"missing_metrics":[
{
"sentence":"Example sentence",
"suggestion":"Add measurable results"
}
],

"missing_keywords":[
"Example keyword"
],

"suggested_keywords":[
"Example keyword"
],

"section_improvements":[
"Example improvement"
],

"ats_formatting_issues":[
"Example formatting issue"
],

"skills_analysis":{
"strengths":[],
"missing_skills":[],
"duplicate_skills":[],
"outdated_skills":[],
"suggestions":[]
},

"section_analysis":{
"present_sections":[],
"missing_sections":[],
"improvement_suggestions":[]
},

"experience_feedback":[
"Example experience feedback"
],

"readability_feedback":[
"Example readability issue"
],

"resume_strengths":[
"Example strength"
],

"final_recommendations":[
"Example recommendation"
]

}

----------------------------------------------------------------------
IMPROVED RESUME JSON

Based on the analysis, provide an improved version of the resume JSON with specific enhancements to each section. For example, if the experience section is weak, rewrite it with stronger bullet points and added metrics. If the skills section is missing important keywords, add those keywords to the skills list. The improved resume JSON should reflect all the suggested improvements from the analysis.



Return ONLY JSON.
`;
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 3500,
    });

    const aiText = response?.choices?.[0]?.message?.content;
    if (!aiText) {
        return { success: false, data: {}, message: "AI response missing." };
    }

    try {
        await atsResumeModel.create({
            user_id: resumeJson.userId || '1234567890abcdef12345678', // placeholder user ID
            resume_json: resumeJson,
            ats_result: JSON.parse(aiText),
        });
        return extractJson(aiText);
    } catch (err) {
        console.warn("Failed to parse AI JSON:", err, "Raw AI response:", aiText);
        return { success: false, data: {}, message: "AI response missing or malformed." };
    }
};

// -------------------
// ROUTES
// -------------------

// Upload resume endpoint
app.post("/upload-resume", upload.single("resume"), async (req, res) => {
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

// -------------------
// START SERVER
// -------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`ATS module running on port ${PORT}`));









