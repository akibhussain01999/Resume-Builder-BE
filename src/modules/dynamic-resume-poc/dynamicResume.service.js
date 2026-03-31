const OpenAI = require("openai");
const dotenv = require("dotenv");
const os = require("os");
const path = require("path");
const fs = require("fs/promises");
const pdfTextExtract = require("pdf-text-extract");

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * SECTION TYPES (for frontend rendering):
 *
 *  "text"          → Free text / paragraphs (summary, objective, about me)
 *  "timeline"      → Entries with title, subtitle, date, details (experience, education)
 *  "list"          → Flat list of strings (skills, interests, hobbies)
 *  "grouped_list"  → Categorized lists (skills by category, languages by proficiency)
 *  "cards"         → Items with title + description + optional link (projects, publications)
 *  "key_value"     → Key-value pairs (languages: proficiency, references: contact)
 */

const SECTION_TYPES_GUIDE = `
Available section types for classification:
- "text": Free-form paragraphs (e.g. summary, objective, about me, personal statement)
- "timeline": Entries with title/subtitle/date/details (e.g. work experience, education, internships, volunteer work)
- "list": Flat list of short items (e.g. skills, tools, interests, hobbies)
- "grouped_list": Items organized into named categories (e.g. "Languages: Python, JS" / "Frameworks: React, Express")
- "cards": Items with a title, description, and optional link (e.g. projects, publications, research papers, portfolio items)
- "key_value": Key-value pairs (e.g. languages with proficiency levels, personal details like DOB/nationality)
`;

// Extract text from uploaded file (PDF or text)
const extractTextFromFile = async (fileBuffer, fileInfo = {}) => {
    const isPdf =
        fileInfo.mimetype === "application/pdf" ||
        (fileInfo.originalname &&
            fileInfo.originalname.toLowerCase().endsWith(".pdf"));

    if (isPdf) {
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(
            tempDir,
            `${Date.now()}_${fileInfo.originalname || "resume.pdf"}`
        );
        await fs.writeFile(tempFilePath, fileBuffer);

        return new Promise((resolve, reject) => {
            pdfTextExtract(tempFilePath, async (err, pages) => {
                await fs.unlink(tempFilePath).catch(() => {});
                if (err) return reject(err);
                const text = pages.join("\n");
                if (!text || text.length < 50) {
                    return reject(
                        new Error("PDF extraction returned insufficient text")
                    );
                }
                resolve(text);
            });
        });
    }

    return fileBuffer.toString("utf-8");
};

// Core: dynamically parse any resume into a self-describing JSON
const parseDynamicResume = async (resumeText) => {
    const prompt = `You are a resume parser. Your job is to extract ALL information from the resume below into a dynamic, self-describing JSON structure.

CRITICAL RULES:
1. Do NOT use a fixed schema. Discover whatever sections exist in this specific resume.
2. Preserve the EXACT section order as it appears in the resume.
3. Do NOT skip, merge, or rename sections. Use the original section title from the resume.
4. Extract ALL content — every bullet point, every detail. Do not summarize or omit anything.
5. If skills are grouped (e.g. "Frontend: React, Vue" / "Backend: Node, Django"), use "grouped_list" type.
6. If skills are a flat list, use "list" type.
7. For experience/education entries, extract ALL fields present (title, company/institution, dates, location, bullets/details).
8. For projects, extract name, description, technologies used, links if present.

${SECTION_TYPES_GUIDE}

OUTPUT FORMAT:
{
  "header": {
    "name": "Full Name",
    "contacts": [
      { "type": "email", "value": "..." },
      { "type": "phone", "value": "..." },
      { "type": "linkedin", "value": "..." },
      { "type": "github", "value": "..." },
      { "type": "portfolio", "value": "..." },
      { "type": "location", "value": "..." }
    ]
  },
  "sections": [
    {
      "id": "section-1",
      "title": "Original Section Title From Resume",
      "type": "text | timeline | list | grouped_list | cards | key_value",
      "order": 1,
      "content": "..."
    }
  ]
}

SECTION DATA SHAPES BY TYPE:

For "text" type:
  "content": "The full paragraph text here..."

For "timeline" type:
  "items": [
    {
      "title": "Role / Degree",
      "subtitle": "Company / Institution",
      "date": "Start - End as written in resume",
      "location": "City, Country (if present)",
      "details": ["bullet 1", "bullet 2"]
    }
  ]

For "list" type:
  "items": ["item1", "item2", "item3"]

For "grouped_list" type:
  "groups": [
    { "label": "Category Name", "items": ["item1", "item2"] }
  ]

For "cards" type:
  "items": [
    {
      "title": "Project/Publication Name",
      "description": "Description text",
      "technologies": ["tech1", "tech2"],
      "link": "URL if present"
    }
  ]

For "key_value" type:
  "items": [
    { "key": "Label", "value": "Value" }
  ]

IMPORTANT:
- contacts array: only include contact types that actually exist in the resume. Common types: email, phone, linkedin, github, portfolio, website, location, twitter, medium, stackoverflow, skype, whatsapp.
- The "id" should be "section-1", "section-2", etc. in order.
- The "order" should match the section's position in the resume (1-based).
- If a section doesn't fit any type perfectly, pick the closest match.
- Return ONLY valid JSON. No extra text.

RESUME TEXT:
\`\`\`
${resumeText}
\`\`\``;

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 4000,
    });

    const jsonText = response?.choices?.[0]?.message?.content;
    if (!jsonText) {
        throw new Error("AI returned empty response");
    }

    const parsed = JSON.parse(jsonText);

    // Validate basic structure
    if (!parsed.header || !parsed.sections) {
        throw new Error(
            "AI response missing required fields (header, sections)"
        );
    }

    // Add metadata
    parsed.meta = {
        generatedAt: new Date().toISOString(),
        sectionCount: parsed.sections.length,
        sectionTypes: [
            ...new Set(parsed.sections.map((s) => s.type)),
        ],
        sectionTitles: parsed.sections.map((s) => s.title),
    };

    return parsed;
};

// ATS analysis on the dynamic JSON
const analyzeDynamicResume = async (dynamicJson, jobDescription = "") => {
    const prompt = `
You are an **elite ATS system, senior technical recruiter, and resume evaluator**.

Analyze the provided resume (in dynamic JSON format) and produce a structured ATS evaluation report.

CRITICAL RULES:
• Section-wise analysis — provide detailed feedback on EVERY section present.
• Only analyze information present in the resume. Do NOT invent content.
• For each weak bullet provide 4-5 improved versions.
• For each vague sentence provide a specific improved version.
• For missing metrics, specify exactly what to add and how.
• Find repetition issues across ALL bullets — return word, count, and replacements.
• For spelling/grammar issues return the exact error, correction, and location.
• Never return empty arrays — always provide suggestions.
• Return ONLY valid JSON.

---------------------------------------------------------------------

JOB DESCRIPTION (OPTIONAL)

${jobDescription || "No job description provided"}

If a job description is provided:
• Compare resume skills with job requirements
• Identify missing keywords
• Suggest improvements to match the role

---------------------------------------------------------------------

RESUME (DYNAMIC JSON FORMAT)

${JSON.stringify(dynamicJson)}

---------------------------------------------------------------------

OUTPUT FORMAT

{
  "ats_score": number (0-100, weighted average of all 6 breakdown scores),
  "score_breakdown": {
    "keyword_optimization": number (0-100),
    "achievements_metrics": number (0-100),
    "bullet_strength": number (0-100),
    "skills_coverage": number (0-100),
    "experience_clarity": number (0-100),
    "resume_structure": number (0-100)
  },
  "problems_detected": ["..."],
  "weak_bullet_points": [{ "original": "...", "improved": "..." }],
  "quantifying_impact_issues": ["..."],
  "repetition_issues": [{ "word": "...", "count": 0, "replacements": ["..."] }],
  "spelling_mistakes": [{ "wrong": "...", "correct": "...", "context": "..." }],
  "grammar_issues": [{ "original": "...", "corrected": "...", "location": "..." }],
  "vague_sentences": [{ "original": "...", "improved": "..." }],
  "missing_metrics": [{ "sentence": "...", "suggestion": "..." }],
  "missing_keywords": ["..."],
  "suggested_keywords": ["..."],
  "section_improvements": ["..."],
  "ats_formatting_issues": ["..."],
  "skills_analysis": {
    "strengths": [],
    "missing_skills": [],
    "duplicate_skills": [],
    "outdated_skills": [],
    "suggestions": []
  },
  "section_analysis": {
    "present_sections": [],
    "missing_sections": [],
    "improvement_suggestions": []
  },
  "experience_feedback": ["..."],
  "readability_feedback": ["..."],
  "resume_strengths": ["..."],
  "final_recommendations": ["..."]
}

Return ONLY the ATS analysis JSON. No extra text.
`;

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 4096,
    });

    const aiText = response?.choices?.[0]?.message?.content;
    if (!aiText) throw new Error("AI returned empty response for ATS analysis");

    return JSON.parse(aiText);
};

// AI rewrite: takes dynamic JSON + ATS result → rewrites into fixed DB format
const rewriteResume = async ({ dynamicJson, atsResult, jobDescription = "" }) => {
    const prompt = `
You are an **elite ATS resume rewriting AI and senior recruiter**.

You will receive:
1. A resume in DYNAMIC JSON format (sections discovered from the original resume)
2. An ATS analysis report with problems and suggestions

Your job:
1. DEEPLY ANALYZE the resume — understand the candidate's field, total years of experience, companies, roles, projects, skills, education
2. REWRITE the entire resume into the EXACT fixed output structure below
3. Apply ALL improvements from the ATS report
4. Output a clean, ATS-optimized resume in the target format

---------------------------------------------------------------------

CRITICAL RULES

• DO NOT invent fake companies, roles, degrees, or projects
• DO NOT change company names, role titles, or education details
• DO improve: summary, bullet points, skills list, descriptions
• Add metrics and impact where possible (but don't fabricate numbers)
• Fix all spelling, grammar, and formatting issues from ATS report
• Use strong action verbs, avoid repetition
• Target ATS score of 90+

---------------------------------------------------------------------

SMART SKILL OPTIMIZATION

• Keep existing skills from the resume
• Add missing_keywords and suggested_keywords from ATS report
• Remove duplicates (NodeJS vs Node.js)
• Normalize naming (JavaScript not javascript)
• Keep 10-20 skills max, prioritize relevance

---------------------------------------------------------------------

EXPERIENCE REWRITING

For EVERY bullet point, use this formula:
  Action Verb + Task + Tool/Method + Measurable Result

• STRICTLY write minimum 5-6 bullets per role — no exceptions
• If the original has fewer bullets, generate additional relevant bullets based on the role, company, and industry context
• Fix all weak bullets identified in ATS report
• Add quantifiable impact where realistic
• Each bullet must be unique — no repetition across roles

---------------------------------------------------------------------

PROJECT MAPPING (CRITICAL)

The input dynamic JSON may have projects in different formats:
• "cards" type → items with title, description, link
• "grouped_list" type → groups with label and items
• "list" type → flat list of strings
• "timeline" type → items with title, subtitle, date, details

MAPPING RULES for output projects:
• If input is "grouped_list": each group's "label" MUST become "name", and improve the items into a single "description"
  Example: { label: "Government Projects", items: ["Project A", "Project B"] }
  Output:  { "name": "Government Projects", "description": "Managed Project A and Project B, delivering..." }
• If input is "cards": "title" → "name", "description" → "description"
• If input is "timeline": "title" → "name", "details" joined → "description"
• If input is "list": each item → "name", description = ""
• NEVER flatten grouped_list items into individual projects — keep the group label as name

---------------------------------------------------------------------

DYNAMIC RESUME JSON (INPUT):

${JSON.stringify(dynamicJson, null, 2)}

---------------------------------------------------------------------

ATS REPORT:

${JSON.stringify(atsResult, null, 2)}

---------------------------------------------------------------------

JOB DESCRIPTION (OPTIONAL):

${jobDescription || "No job description provided"}

---------------------------------------------------------------------

OUTPUT FORMAT (STRICT — return EXACTLY this structure):

{
  "improved_resume": {
    "name": "string",
    "title": "string (primary job title / role)",
    "location": "string",
    "email": "string",
    "phone": "string",
    "linkedin": "string",
    "github": "string",
    "portfolio": "string",
    "summary": "string (2-4 strong sentences)",
    "skills": ["skill1", "skill2"],
    "experience": [
      {
        "role": "string",
        "company": "string",
        "years": "string (date range)",
        "bullets": ["string — MINIMUM 5-6 bullets per role, strictly"]
      }
    ],
    "education": [
      {
        "degree": "string",
        "school": "string",
        "year": "string"
      }
    ],
    "certifications": [{ "name": "string", "date": "string" }],
    "courses": [{ "name": "string", "date": "string" }],
    "languages": [{ "name": "string", "level": "string" }],
    "strengths": ["string"],
    "hobbies": ["string"],
    "achievements": [{ "title": "string", "description": "string" }],
    "projects": [{ "name": "string", "description": "string", "technologies": ["string"], "link": "string" }]
  },
  "updated_ats_result": {
    "ats_score": number (0-100),
    "score_breakdown": {
      "keyword_optimization": number (0-100),
      "achievements_metrics": number (0-100),
      "bullet_strength": number (0-100),
      "skills_coverage": number (0-100),
      "experience_clarity": number (0-100),
      "resume_structure": number (0-100)
    },
    "improvements_made": ["List of key improvements applied"],
    "remaining_issues": ["Any issues that could not be fixed"]
  }
}

SCORING RULES (CRITICAL — follow strictly):
• Each score_breakdown value must be between 0-100 (NOT 0-10)
• ats_score = weighted average of all 6 breakdown scores
• The breakdown scores MUST be consistent with ats_score — if ats_score is 90, breakdown values should average around 90
• Example: ats_score: 88 → keyword_optimization: 85, achievements_metrics: 90, bullet_strength: 88, skills_coverage: 92, experience_clarity: 85, resume_structure: 88

OTHER RULES:
• "improved_resume" must have EXACTLY the fields shown above — no more, no less
• If the original resume doesn't have data for a field, set it to "" or []
• Extract github, portfolio, website from header contacts — do NOT drop them
• Certifications and courses MUST include dates if present in the original
• Projects MUST include technologies array if present in the original
• Experience bullets: STRICTLY minimum 5-6 per role — this is mandatory
• "updated_ats_result.ats_score" must honestly reflect the improved resume quality
• Return ONLY valid JSON — no text outside JSON
`;

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 4500,
    });

    const aiText = response?.choices?.[0]?.message?.content;
    if (!aiText) throw new Error("AI returned empty response for rewrite");

    const parsed = JSON.parse(aiText);

    if (!parsed.improved_resume || !parsed.updated_ats_result) {
        throw new Error("AI response missing improved_resume or updated_ats_result");
    }

    return parsed;
};

module.exports = {
    extractTextFromFile,
    parseDynamicResume,
    analyzeDynamicResume,
    rewriteResume,
};
