const OpenAI = require("openai");
const axios = require("axios");
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

// Convert ProxyCurl structured profile JSON into readable text for the AI parser
const formatProxyCurlProfile = (profile, linkedinUrl) => {
    const lines = [];

    lines.push(`Name: ${profile.full_name || ""}`);
    if (profile.headline) lines.push(`Headline: ${profile.headline}`);
    const location = [profile.city, profile.state, profile.country_full_name]
        .filter(Boolean)
        .join(", ");
    if (location) lines.push(`Location: ${location}`);
    lines.push(`LinkedIn: ${linkedinUrl}`);
    lines.push("");

    if (profile.summary) {
        lines.push("ABOUT");
        lines.push(profile.summary);
        lines.push("");
    }

    if (profile.experiences?.length) {
        lines.push("EXPERIENCE");
        for (const exp of profile.experiences) {
            const start = exp.starts_at
                ? `${exp.starts_at.month}/${exp.starts_at.year}`
                : "";
            const end = exp.ends_at
                ? `${exp.ends_at.month}/${exp.ends_at.year}`
                : "Present";
            lines.push(
                `${exp.title || ""} at ${exp.company || ""} | ${start} - ${end}`
            );
            if (exp.location) lines.push(`Location: ${exp.location}`);
            if (exp.description) lines.push(exp.description);
            lines.push("");
        }
    }

    if (profile.education?.length) {
        lines.push("EDUCATION");
        for (const edu of profile.education) {
            const startYear = edu.starts_at?.year || "";
            const endYear = edu.ends_at?.year || "Present";
            const degree = [edu.degree_name, edu.field_of_study]
                .filter(Boolean)
                .join(" in ");
            lines.push(
                `${degree || "Degree"} at ${edu.school || ""} | ${startYear} - ${endYear}`
            );
            if (edu.description) lines.push(edu.description);
            lines.push("");
        }
    }

    if (profile.skills?.length) {
        lines.push("SKILLS");
        lines.push(profile.skills.join(", "));
        lines.push("");
    }

    if (profile.certifications?.length) {
        lines.push("CERTIFICATIONS");
        for (const cert of profile.certifications) {
            let entry = cert.name || "";
            if (cert.authority) entry += ` — ${cert.authority}`;
            if (cert.starts_at?.year) entry += ` (${cert.starts_at.year})`;
            lines.push(entry);
        }
        lines.push("");
    }

    if (profile.accomplishment_projects?.length) {
        lines.push("PROJECTS");
        for (const proj of profile.accomplishment_projects) {
            lines.push(proj.title || "");
            if (proj.description) lines.push(proj.description);
            if (proj.url) lines.push(`Link: ${proj.url}`);
            lines.push("");
        }
    }

    if (profile.languages?.length) {
        lines.push("LANGUAGES");
        for (const lang of profile.languages) {
            if (typeof lang === "string") {
                lines.push(lang);
            } else if (lang.name) {
                lines.push(
                    lang.proficiency ? `${lang.name} (${lang.proficiency})` : lang.name
                );
            }
        }
        lines.push("");
    }

    if (profile.volunteer_work?.length) {
        lines.push("VOLUNTEER WORK");
        for (const vol of profile.volunteer_work) {
            lines.push(`${vol.role || ""} at ${vol.company || ""}`);
            if (vol.description) lines.push(vol.description);
            lines.push("");
        }
    }

    if (profile.accomplishment_honors_awards?.length) {
        lines.push("HONORS & AWARDS");
        for (const award of profile.accomplishment_honors_awards) {
            lines.push(award.title || "");
            if (award.description) lines.push(award.description);
        }
        lines.push("");
    }

    return lines.join("\n");
};

// ─── Puppeteer scraper ────────────────────────────────────────────────────────

const CHROME_PATHS = [
    // macOS system Chrome
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    // Linux CI / server
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
];

const findChrome = () => {
    const fss = require("fs");
    for (const p of CHROME_PATHS) {
        try { fss.accessSync(p); return p; } catch {}
    }
    return null; // let Puppeteer use its bundled binary (if present)
};

const scrapeLinkedInWithPuppeteer = async (linkedinUrl) => {
    const puppeteer = require("puppeteer");
    const executablePath = findChrome();

    const browser = await puppeteer.launch({
        headless: true,
        ...(executablePath && { executablePath }),
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-blink-features=AutomationControlled",
            "--disable-infobars",
            "--window-size=1280,800",
        ],
        defaultViewport: { width: 1280, height: 800 },
    });

    try {
        const page = await browser.newPage();

        // Mask automation signals
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, "webdriver", { get: () => undefined });
        });

        await page.setUserAgent(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        );
        await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

        await page.goto(linkedinUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

        // Wait a moment for JS-rendered content
        await new Promise((r) => setTimeout(r, 3000));

        const currentUrl = page.url();
        if (
            currentUrl.includes("/login") ||
            currentUrl.includes("/authwall") ||
            currentUrl.includes("/signup")
        ) {
            throw new Error(
                "LinkedIn redirected to a login page. The profile is private or requires authentication. " +
                "Use the 'linkedinText' field instead: copy all text from your LinkedIn profile and paste it."
            );
        }

        // Extract JSON-LD structured data (most reliable)
        const jsonLdBlocks = await page.evaluate(() => {
            const results = [];
            document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
                try { results.push(JSON.parse(el.textContent)); } catch {}
            });
            return results;
        });

        // Extract OG meta
        const meta = await page.evaluate(() => ({
            title: document.querySelector('meta[property="og:title"]')?.content || "",
            description:
                document.querySelector('meta[property="og:description"]')?.content ||
                document.querySelector('meta[name="description"]')?.content || "",
        }));

        // Extract visible text (remove nav/footer/scripts)
        const pageText = await page.evaluate(() => {
            ["script", "style", "nav", "footer", "header"].forEach((tag) =>
                document.querySelectorAll(tag).forEach((el) => el.remove())
            );
            const main = document.querySelector("main") || document.body;
            return (main.innerText || main.textContent || "").replace(/\s+/g, " ").trim();
        });

        let content = "";
        if (jsonLdBlocks.length) {
            content += `STRUCTURED DATA:\n${JSON.stringify(jsonLdBlocks, null, 2)}\n\n`;
        }
        if (meta.title || meta.description) {
            content += `META INFO:\nTitle: ${meta.title}\nDescription: ${meta.description}\n\n`;
        }
        if (pageText.length > 100) {
            content += `PAGE CONTENT:\n${pageText.substring(0, 8000)}`;
        }

        if (content.length < 100) {
            throw new Error(
                "Puppeteer could not extract sufficient content from LinkedIn. " +
                "The profile may be private. Use the 'linkedinText' paste method instead."
            );
        }

        return content;
    } finally {
        await browser.close();
    }
};

// ─────────────────────────────────────────────────────────────────────────────

// Convert Scrapin.io response into the same text format as formatProxyCurlProfile
const formatScrapinProfile = (data, linkedinUrl) => {
    const p = data.person || data;
    const lines = [];

    const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ");
    if (fullName) lines.push(`Name: ${fullName}`);
    if (p.headline) lines.push(`Headline: ${p.headline}`);
    if (p.location) lines.push(`Location: ${p.location}`);
    lines.push(`LinkedIn: ${linkedinUrl}`);
    lines.push("");

    if (p.summary) {
        lines.push("ABOUT");
        lines.push(p.summary);
        lines.push("");
    }

    const positions = p.positions?.positionHistory || p.experience || [];
    if (positions.length) {
        lines.push("EXPERIENCE");
        for (const pos of positions) {
            const start = pos.startEndDate?.start
                ? `${pos.startEndDate.start.month || ""}/${pos.startEndDate.start.year || ""}`
                : pos.startDate || "";
            const end = pos.startEndDate?.end
                ? `${pos.startEndDate.end.month || ""}/${pos.startEndDate.end.year || ""}`
                : pos.endDate || "Present";
            lines.push(
                `${pos.title || ""} at ${pos.companyName || pos.company || ""} | ${start} - ${end}`
            );
            if (pos.description) lines.push(pos.description);
            lines.push("");
        }
    }

    const education = p.schools?.educationHistory || p.education || [];
    if (education.length) {
        lines.push("EDUCATION");
        for (const edu of education) {
            const startYear = edu.startEndDate?.start?.year || edu.startYear || "";
            const endYear = edu.startEndDate?.end?.year || edu.endYear || "Present";
            const degree = [edu.degreeName, edu.fieldOfStudy]
                .filter(Boolean)
                .join(" in ");
            lines.push(
                `${degree || "Degree"} at ${edu.schoolName || edu.school || ""} | ${startYear} - ${endYear}`
            );
            lines.push("");
        }
    }

    const skills = p.skills || [];
    if (skills.length) {
        lines.push("SKILLS");
        lines.push(
            skills.map((s) => (typeof s === "string" ? s : s.name || "")).join(", ")
        );
        lines.push("");
    }

    const certs = p.certifications || [];
    if (certs.length) {
        lines.push("CERTIFICATIONS");
        for (const cert of certs) {
            lines.push(
                `${cert.name || cert.title || ""}${cert.authority ? ` — ${cert.authority}` : ""}`
            );
        }
        lines.push("");
    }

    return lines.join("\n");
};

// Fetch LinkedIn profile — priority: Scrapin API → ProxyCurl API → Puppeteer scraper
const fetchLinkedInProfile = async (linkedinUrl) => {
    const urlPattern = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w%-]+\/?(\?.*)?$/;
    if (!urlPattern.test(linkedinUrl)) {
        throw new Error(
            "Invalid LinkedIn profile URL. Expected format: https://linkedin.com/in/username"
        );
    }

    const scrapinKey = process.env.SCRAPIN_API_KEY;
    const proxyCurlKey = process.env.PROXYCURL_API_KEY;

    // ── 1. Scrapin.io (free tier: 100 req/month) ──
    if (scrapinKey) {
        let profile;
        try {
            const response = await axios.get(
                "https://api.scrapin.io/enrichment/profile",
                {
                    params: { apikey: scrapinKey, linkedInUrl: linkedinUrl },
                    timeout: 30000,
                }
            );
            profile = response.data;
        } catch (err) {
            const status = err.response?.status;
            if (status === 404) throw new Error("LinkedIn profile not found. Please check the URL.");
            if (status === 401 || status === 403) throw new Error("Scrapin API key is invalid. Check SCRAPIN_API_KEY.");
            if (status === 429) throw new Error("Scrapin API rate limit reached. Try again later.");
            if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") throw new Error("Scrapin request timed out. Please try again.");
            throw new Error(`Scrapin fetch failed: ${err.message}`);
        }
        if (!profile?.success && !profile?.person) {
            throw new Error("LinkedIn profile could not be retrieved via Scrapin. The profile may be private.");
        }
        return formatScrapinProfile(profile, linkedinUrl);
    }

    // ── 2. ProxyCurl ──
    if (proxyCurlKey) {
        let profile;
        try {
            const response = await axios.get(
                "https://nubela.co/proxycurl/api/v2/linkedin",
                {
                    headers: { Authorization: `Bearer ${proxyCurlKey}` },
                    params: { url: linkedinUrl, skills: "include", use_cache: "if-present", fallback_to_cache: "on-error" },
                    timeout: 30000,
                }
            );
            profile = response.data;
        } catch (err) {
            const status = err.response?.status;
            if (status === 404) throw new Error("LinkedIn profile not found. Please check the URL.");
            if (status === 401 || status === 403) throw new Error("ProxyCurl API key is invalid. Check PROXYCURL_API_KEY.");
            if (status === 429) throw new Error("ProxyCurl rate limit exceeded. Please try again later.");
            if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") throw new Error("ProxyCurl request timed out. Please try again.");
            throw new Error(`ProxyCurl fetch failed: ${err.message}`);
        }
        if (!profile || !profile.full_name) {
            throw new Error("LinkedIn profile could not be retrieved. The profile may be private.");
        }
        return formatProxyCurlProfile(profile, linkedinUrl);
    }

    // ── 3. Puppeteer (no API key needed, uses system Chrome) ──
    return scrapeLinkedInWithPuppeteer(linkedinUrl);
};

// Parse LinkedIn profile content into dynamic resume JSON using AI
const parseLinkedInToResume = async (profileContent, linkedinUrl) => {
    const prompt = `You are an expert resume builder. A LinkedIn profile page has been scraped and its content is provided below. Extract all professional information and convert it into the dynamic resume JSON format.

LinkedIn URL: ${linkedinUrl}

LINKEDIN PROFILE CONTENT:
${profileContent}

${SECTION_TYPES_GUIDE}

Extract every piece of information visible in the profile:
- Full name and headline
- Contact info (email, phone if present, LinkedIn URL, location)
- About / Summary section
- Work Experience (company, role, dates, location, description bullets)
- Education (degree, institution, graduation year)
- Skills (use "grouped_list" if categorized, "list" if flat)
- Certifications, Licenses
- Projects, Publications
- Volunteer work, Languages, Honors/Awards if present

OUTPUT FORMAT — return EXACTLY this structure:
{
  "header": {
    "name": "Full Name",
    "contacts": [
      { "type": "linkedin", "value": "${linkedinUrl}" },
      { "type": "email", "value": "..." },
      { "type": "phone", "value": "..." },
      { "type": "location", "value": "City, Country" }
    ]
  },
  "sections": [
    {
      "id": "section-1",
      "title": "Original Section Title",
      "type": "text | timeline | list | grouped_list | cards | key_value",
      "order": 1
    }
  ]
}

SECTION DATA SHAPES BY TYPE — add the appropriate field alongside the base fields above:
- "text" → add: "content": "paragraph text"
- "timeline" → add: "items": [{ "title": "Role", "subtitle": "Company", "date": "...", "location": "...", "details": ["bullet..."] }]
- "list" → add: "items": ["item1", "item2"]
- "grouped_list" → add: "groups": [{ "label": "Category", "items": ["item1"] }]
- "cards" → add: "items": [{ "title": "Name", "description": "...", "technologies": ["..."], "link": "..." }]
- "key_value" → add: "items": [{ "key": "Label", "value": "Value" }]

RULES:
- Always include the LinkedIn URL in contacts as type "linkedin"
- If a section is missing from the profile, omit it entirely
- Section ids must be "section-1", "section-2", etc. in order
- Return ONLY valid JSON. No extra text.`;

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 4000,
    });

    const jsonText = response?.choices?.[0]?.message?.content;
    if (!jsonText) throw new Error("AI returned empty response");

    const parsed = JSON.parse(jsonText);

    if (!parsed.header || !parsed.sections) {
        throw new Error("AI response missing required fields (header, sections)");
    }

    // Ensure LinkedIn URL is always present in contacts
    if (!parsed.header.contacts) parsed.header.contacts = [];
    const hasLinkedIn = parsed.header.contacts.some((c) => c.type === "linkedin");
    if (!hasLinkedIn) {
        parsed.header.contacts.unshift({ type: "linkedin", value: linkedinUrl });
    }

    parsed.meta = {
        source: "linkedin",
        linkedinUrl,
        generatedAt: new Date().toISOString(),
        sectionCount: parsed.sections.length,
        sectionTypes: [...new Set(parsed.sections.map((s) => s.type))],
        sectionTitles: parsed.sections.map((s) => s.title),
    };

    return parsed;
};

module.exports = {
    extractTextFromFile,
    parseDynamicResume,
    analyzeDynamicResume,
    rewriteResume,
    fetchLinkedInProfile,
    parseLinkedInToResume,
};
