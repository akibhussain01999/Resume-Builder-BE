// src/modules/ats-checker/index.js



import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs/promises";
import * as pdfParse from "pdf-parse";
import pdfTextExtract from "pdf-text-extract";
import atsResumeModel from "./atsResumeModel.js";
import os from "os";
import path from "path";
import { promises as fsPromises } from "fs";
import { ObjectId } from "mongodb";
import resumeModel from "../resume/resume.model.js";


dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const readUploadedFile = async (fileBuffer, fileInfo = {}) => {
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


export const parseResume = async (resumeText) => {

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
export const extractJson = (text) => {
    // Find the first '{' and last '}'
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) throw new Error("No JSON found in AI response");
    const jsonString = text.slice(start, end + 1);
    return JSON.parse(jsonString);
};

// Map raw parsed resume to resume template structure
export const mapParsedResumeToTemplate = (parsed) => {
    const experience = (parsed.experience || []).map(exp => {
        if (typeof exp === "string") return { role: exp, company: "", years: "", bullets: [] };
        return {
            role: exp.role || exp.title || exp.position || exp.jobTitle || "",
            company: exp.company || exp.organization || exp.employer || "",
            years: exp.years || exp.period || exp.duration || exp.dates || "",
            bullets: Array.isArray(exp.bullets) ? exp.bullets
                : Array.isArray(exp.responsibilities) ? exp.responsibilities
                : exp.description ? [exp.description] : []
        };
    });

    const education = (parsed.education || []).map(edu => {
        if (typeof edu === "string") return { degree: edu, school: "", year: "" };
        return {
            degree: edu.degree || edu.qualification || edu.field || edu.major || "",
            school: edu.school || edu.institution || edu.university || edu.college || "",
            year: edu.year || edu.graduationYear || edu.endYear || ""
        };
    });

    const projects = (parsed.projects || []).map(proj => {
        if (typeof proj === "string") return { name: proj, description: "", link: "" };
        return {
            name: proj.name || proj.title || proj.projectName || "",
            description: proj.description || proj.summary || proj.details || "",
            link: proj.link || proj.url || proj.github || ""
        };
    });

    const achievements = (parsed.achievements || []).map(ach => {
        if (typeof ach === "string") return { title: ach, description: "" };
        return {
            title: ach.title || ach.award || ach.achievement || ach.name || "",
            description: ach.description || ach.detail || ach.summary || ""
        };
    });

    const languages = (parsed.languages || []).map(lang =>
        typeof lang === "string" ? { name: lang, level: "" } : { name: lang.name || "", level: lang.level || "" }
    );

    const summary = Array.isArray(parsed.summary)
        ? parsed.summary.join(" ").trim()
        : (parsed.summary || "");

    return {
        name: parsed.name || "",
        title: (parsed.jobRoles && parsed.jobRoles[0]) || "",
        location: parsed.location || "",
        email: parsed.email || "",
        phone: parsed.phone || "",
        linkedin: parsed.linkedin || "",
        summary,
        skills: parsed.skills || [],
        experience,
        education,
        certifications: parsed.certifications || [],
        courses: parsed.courses || [],
        languages,
        strengths: parsed.strengths || [],
        hobbies: parsed.interests || parsed.hobbies || [],
        achievements,
        projects
    };
};

// ATS + AI Resume Analysis
export const analyzeResume = async (resumeJson, jobDescription = "", userId = "unknown_user") => {
   

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
• find repetition issues — scan every word used across ALL bullet points and sections. For any action verb or significant word used 2 or more times, return it with an exact count and 3 alternative replacement words. Return as structured objects, not plain strings.
• for spelling mistakes — scan the entire resume text. For every misspelled word found, return the exact wrong word, the correct spelling, and the sentence it appears in. NEVER return just "Fix grammar" — always return the specific word, correction, and location.
• for grammar issues — return the exact incorrect phrase, the corrected version, and where it appears.
• Do not group spelling and grammar together vaguely. Return each issue as a separate structured object.
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

"repetition_issues": [
{
"word": "optimized",
"count": 4,
"replacements": ["improved", "streamlined", "enhanced"]
}
],

"spelling_mistakes": [
{
"wrong": "mananged",
"correct": "managed",
"context": "mananged a team of 5 engineers"
}
],

"grammar_issues": [
{
"original": "Responsible for managing team",
"corrected": "Managed and led a cross-functional team",
"location": "Experience — Senior Developer role, bullet 2"
}
],
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
            const structuredResume = mapParsedResumeToTemplate(resumeJson);
            const createdResume = await atsResumeModel.create({
                user_id: userId,
                resume_json: structuredResume,
                ats_result: JSON.parse(aiText),
            });

            return {
                resumeId: createdResume._id,
                userId : createdResume.user_id,
                atsResult: extractJson(aiText),
                structuredResume: structuredResume
            };
    } catch (err) {
        console.warn("Failed to parse AI JSON:", err, "Raw AI response:", aiText);
        return { success: false, data: {}, message: "AI response missing or malformed." };
    }
};


export const analyzeResumeWithAI = async ({ resumeId, userId, atsResult, structuredResume, jobDescription, templateId }) => {
   
    const rewritePrompt = `
You are an **elite ATS resume rewriting AI and senior recruiter**.

Your job is to **rewrite and optimize the resume to significantly improve ATS score**, using the ATS report.

---------------------------------------------------------------------

CRITICAL RULES

• DO NOT change JSON structure
• DO NOT rename fields
• DO NOT remove fields
• DO NOT add new fields

• DO NOT change:
  - company names
  - roles
  - education

• DO NOT invent fake experience

• ONLY improve content quality

---------------------------------------------------------------------

SMART SKILL OPTIMIZATION (IMPORTANT)

• DO NOT use static or hardcoded skills
• ONLY use:
   - existing resume skills
   - ATS "missing_keywords"
   - ATS "suggested_keywords"

• Remove duplicates (NodeJS vs Node.js)
• Normalize naming (JavaScript, HTML5, etc.)

---------------------------------------------------------------------

ATS SCORE IMPROVEMENT TARGET

Current ATS score: ${atsResult.ats_score}

Your goal:
• Increase ATS score to **90 or above**
• If 90 is not realistically achievable, maximize score as high as possible

To achieve this:
• Improve keyword coverage
• Add measurable achievements
• Strengthen bullet points
• Fix all ATS issues

---------------------------------------------------------------------

STRUCTURE (STRICT — DO NOT BREAK)

Return EXACT SAME JSON structure as input.

⚠️ Any structural change = INVALID

---------------------------------------------------------------------

IMPROVEMENT INSTRUCTIONS

1. SUMMARY
• Rewrite into 2–4 strong sentences
• Include relevant keywords dynamically
• Highlight impact + experience

2. SKILLS
• Remove duplicates
• Add missing keywords ONLY from ATS report
• Keep clean, relevant list (10–16 max)

3. EXPERIENCE (MOST IMPORTANT)

Rewrite EVERY bullet using:

Action Verb + Task + Tool + Measurable Result

Rules:
• Add metrics where possible (%, time, scale, impact)
• Fix weak and vague bullets from ATS report
• Avoid repetition
• Keep 4–6 bullets per role

4. ACHIEVEMENTS
• Add measurable outcomes
• Make concise and impactful

5. PROJECTS
• Improve descriptions
• Highlight business/technical impact

6. FIX ALL ATS ISSUES

You MUST fix:
• weak bullet points
• vague sentences
• missing metrics
• repetition issues
• formatting issues

7. SECTION FIXES

If ATS says section missing:
• Add content ONLY if section exists but is empty
• DO NOT create new fields

---------------------------------------------------------------------

INPUTS

ATS REPORT:

${JSON.stringify(atsResult, null, 2)}

--------------------------------------------------

ORIGINAL RESUME JSON:

${JSON.stringify(structuredResume, null, 2)}

---------------------------------------------------------------------

OUTPUT FORMAT

Return a single JSON object with exactly two keys:

{
  "improved_resume": { ...exact same structure as ORIGINAL RESUME JSON with improved content... },
  "updated_ats_result": {
    "ats_score": number,
    "score_breakdown": {
      "keyword_optimization": number,
      "achievements_metrics": number,
      "bullet_strength": number,
      "skills_coverage": number,
      "experience_clarity": number,
      "resume_structure": number
    },
    "improvements_made": ["List of key improvements applied"],
    "remaining_issues": ["Any issues that could not be fixed"]
  }
}

RULES:
• "improved_resume" must have EXACT SAME structure as the original resume JSON — no added or removed fields
• "updated_ats_result.ats_score" must reflect the actual quality of the improved resume — be honest
• "score_breakdown" scores must add up consistently with the overall ats_score
• Return ONLY valid JSON — no explanation, no text outside JSON

---------------------------------------------------------------------

FINAL CHECK BEFORE OUTPUT

Ensure:
• No duplicate skills
• Strong bullet points with metrics
• Keywords from ATS included naturally
• Content is ATS optimized
• Structure unchanged
• Both keys ("improved_resume" and "updated_ats_result") are present

`;
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: rewritePrompt }],
        temperature: 0,
        max_tokens: 4500,
    });

    const aiText = response?.choices?.[0]?.message?.content;
    if (!aiText) {
        return { success: false, data: {}, message: "AI response missing." };
    }

    try {
        const parsed = extractJson(aiText);
        const rewrittenData = parsed.improved_resume;
        const updatedAtsResult = parsed.updated_ats_result;

        const atsRecord = await atsResumeModel.findById(new ObjectId(String(resumeId)));
        const existingImprovedResumeId = atsRecord?.improved_resume_id;

        let improvedResumeId;
        let savedResume;

        if (existingImprovedResumeId) {
            // Update existing improved resume
            savedResume = await resumeModel.findByIdAndUpdate(
                existingImprovedResumeId,
                {
                    title: rewrittenData.title || structuredResume.title || "Improved Resume",
                    data: rewrittenData,
                },
                { new: true }
            );
            improvedResumeId = existingImprovedResumeId;
        } else {
            // Create new improved resume
            savedResume = await resumeModel.create({
                userId: new ObjectId(String(userId)),
                title: rewrittenData.title || structuredResume.title || "Improved Resume",
                templateId: templateId || "sidebar",
                themeColor: "#3eb489",
                data: rewrittenData,
            });
            improvedResumeId = savedResume._id;
        }

        await resumeModel.findByIdAndUpdate(
            new ObjectId(String(savedResume._id)),
            {
                resumeId: `resume_${atsRecord._id}`,
                
            }
        );

        // Update ATS record with improved resume reference and new ATS result
        await atsResumeModel.findByIdAndUpdate(
            new ObjectId(String(resumeId)),
            {
                improved_resume_json: rewrittenData,
                improved_resume_id: improvedResumeId,
                ats_result: updatedAtsResult,
            }
        );

        return {
            resumeData: {
                ...rewrittenData,
                templateId: savedResume?.templateId || "sidebar",
                themeColor: savedResume?.themeColor || "#3eb489",
                hiddenSections: savedResume?.hiddenSections || [],
                resumeId: `resume_${atsRecord._id}`,
            },
            updatedAtsResult,
        };
    } catch (err) {
        console.warn("Failed to parse AI JSON:", err, "Raw AI response:", aiText);
        return { success: false, data: {}, message: "AI response missing or malformed." };
    }
};







