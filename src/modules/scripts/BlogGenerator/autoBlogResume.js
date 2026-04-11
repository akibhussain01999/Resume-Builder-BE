const axios = require("axios");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const OpenAI = require("openai");
const Jimp = require("jimp");
const slugify = require("slugify");
const sanitizeHtml = require("sanitize-html");
const BlogMasterTitle = require("../../blog/blogMasterTitle.model");
const { getBestKeywords } = require("./keywordPlannerResume");

require('dotenv').config();

const { blogUploadImageToS3 } = require("../../../utils/uploadController");
const { default: mongoose } = require("mongoose");

const SITE_NAME = process.env.SITE_NAME || 'ResumeAI';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://your-resume-site.com';
const TWITTER_HANDLE = process.env.TWITTER_HANDLE || '@ResumeAI';
const BLOG_BASE_PATH = '/blog';

// Blog category mapping
const BLOG_CATEGORIES = {
  'resume-tips': 'Resume Tips',
  'career-advice': 'Career Advice',
  'job-search-tips': 'Job Search Tips',
  'cover-letter-tips': 'Cover Letter Tips',
  'interview-tips': 'Interview Tips',
  'linkedin-tips': 'LinkedIn Tips',
  'salary-negotiation': 'Salary Negotiation'
};

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URL);
      console.log("✅ Connected to MongoDB");
    }
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error.message);
    throw error;
  }
}

console.log(
  "🚀 Starting Resume Blog Automation Script...",
  process.env.OPENAI_API_KEY ? 'OPENAI_API_KEY is set' : 'OPENAI_API_KEY is missing'
);
console.log(
  "🔧 AWS Configuration Check:",
  process.env.AWS_ACCESS_KEY_ID ? 'AWS_ACCESS_KEY_ID is set' : 'AWS_ACCESS_KEY_ID is missing',
  process.env.AWS_SECRET_ACCESS_KEY ? 'AWS_SECRET_ACCESS_KEY is set' : 'AWS_SECRET_ACCESS_KEY is missing',
  process.env.AWS_REGION ? `AWS_REGION is set to ${process.env.AWS_REGION}` : 'AWS_REGION is missing',
  process.env.S3_BUCKET_NAME ? `S3_BUCKET_NAME is set to ${process.env.S3_BUCKET_NAME}` : 'S3_BUCKET_NAME is missing'
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const BACKEND_URL = process.env.BACKEND_URL;

// === Local embedding cache ===
const EMBEDDINGS_CACHE_FILE = path.join(__dirname, "embeddings_cache_resume.json");
let embeddingsCache = fs.existsSync(EMBEDDINGS_CACHE_FILE)
  ? JSON.parse(fs.readFileSync(EMBEDDINGS_CACHE_FILE, "utf-8"))
  : {};
function saveEmbeddingsCache() {
  fs.writeFileSync(EMBEDDINGS_CACHE_FILE, JSON.stringify(embeddingsCache, null, 2));
}

// === Retry Helper ===
async function retry(fn, retries = 3, delay = 2000) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.log(`⚠️ Retry ${i + 1} failed: ${err.message}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// === Normalize Embedding Vector ===
function normalizeVector(vec) {
  const mag = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  return vec.map((v) => v / mag);
}

// === Fetch Titles from DB ===
async function fetchTitlesFromDB() {
  try {
    const response = await axios.get(`${BACKEND_URL}/v1/blogs/get-blog-titles`);
    const title = response.data?.title || "";
    const id = response.data?.id || "";
    console.log(`🔍 Fetched title from DB:`, title);
    return { title, id };
  } catch (err) {
    console.error("❌ Failed to fetch blog titles:", err.message);
    return { title: "", id: "" };
  }
}

// === Fetch All Active Blogs for Internal Linking ===
async function fetchAllActiveBlogs() {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/blogs/admin/getAllBlogs`);
    const blogs = response.data || [];
    const activeBlogs = blogs
      .filter(blog => blog.status === 'active' && blog.slug && blog.title)
      .map(blog => ({
        title: blog.title,
        slug: blog.slug,
        category: blog.category,
        tags: blog.tags || [],
        seoTitle: blog.seoTitle || blog.title,
        seoDescription: blog.seoDescription || ''
      }));
    console.log(`🔗 Fetched ${activeBlogs.length} active blogs for internal linking`);
    return activeBlogs;
  } catch (err) {
    console.error("⚠️ Failed to fetch blogs for internal linking:", err.message);
    return [];
  }
}

// === Detect Best Category from Title ===
function detectCategory(title) {
  const t = title.toLowerCase();
  if (t.includes('interview')) return 'interview-tips';
  if (t.includes('cover letter')) return 'cover-letter-tips';
  if (t.includes('linkedin')) return 'linkedin-tips';
  if (t.includes('salary') || t.includes('negotiat')) return 'salary-negotiation';
  if (t.includes('job search') || t.includes('find a job') || t.includes('job hunt')) return 'job-search-tips';
  if (t.includes('career')) return 'career-advice';
  return 'resume-tips';
}

// === Find Relevant Blogs for Internal Linking ===
function findRelevantBlogs(currentTitle, currentKeywords, allBlogs, maxLinks = 5) {
  if (!allBlogs || allBlogs.length === 0) return [];

  const currentTerms = [
    ...currentTitle.toLowerCase().split(/\s+/),
    ...(currentKeywords.secondaryKeywords || []).map(k => k.toLowerCase()),
    currentKeywords.primaryKeyword.toLowerCase()
  ].filter(term =>
    term.length > 3 &&
    !['with', 'from', 'that', 'this', 'have', 'your', 'into', 'about', 'what', 'when', 'where', 'which'].includes(term)
  );

  const scoredBlogs = allBlogs.map(blog => {
    let score = 0;
    const blogText = `${blog.title} ${blog.tags.join(' ')} ${blog.seoDescription}`.toLowerCase();

    currentTerms.forEach(term => {
      if (blogText.includes(term)) score += 2;
    });

    // Bonus for same category
    const currentCategory = detectCategory(currentTitle);
    if (blog.category === currentCategory) score += 3;

    const blogTags = (blog.tags || []).map(t => t.toLowerCase());
    currentTerms.forEach(term => {
      if (blogTags.some(tag => tag.includes(term))) score += 3;
    });

    return { ...blog, score };
  })
  .filter(blog => blog.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, maxLinks);

  console.log(`🔗 Found ${scoredBlogs.length} relevant blogs for internal linking:`,
    scoredBlogs.map(b => ({ title: b.title, score: b.score }))
  );

  return scoredBlogs;
}

// === Generate Blog Content ===
async function generateBlogForTitle(title, relevantBlogs = []) {
  console.log(`🔍 Input title: "${title}"`);
  const keywords = await getBestKeywords(title);
  console.log(`🔍 Generated keywords:`, keywords);

  const secondaryKeywordsList = keywords.secondaryKeywords.length > 0
    ? keywords.secondaryKeywords.map(kw => `"${kw}"`).join(', ')
    : '"resume tips", "career advice", "job search"';

  let internalLinkingSection = '';
  if (relevantBlogs && relevantBlogs.length > 0) {
    const linkSuggestions = relevantBlogs
      .map(blog => `- [${blog.title}](${FRONTEND_URL}${BLOG_BASE_PATH}/${blog.slug}) - ${blog.seoDescription.slice(0, 100)}`)
      .join('\n');

    internalLinkingSection = `

INTERNAL LINKING REQUIREMENTS (CRITICAL FOR SEO):
You MUST include 3-5 internal links to these related articles. Insert them naturally within relevant sections:

${linkSuggestions}

Instructions for internal links:
- Add links where contextually relevant
- Use descriptive anchor text that includes keywords
- Distribute links throughout the article (not all in one section)
- Format: [descriptive anchor text](${FRONTEND_URL}${BLOG_BASE_PATH}/slug)
`;
  }

  const prompt = `Write a comprehensive SEO-friendly blog post about: "${title}".

GOAL:
- Rank for primary keyword: "${keywords.primaryKeyword}"
- Support secondary / semantic keywords: [${secondaryKeywordsList}]
- Search intent: informational (explain, guide, and advise) / actionable career advice — choose the dominant intent and align content accordingly.
${internalLinkingSection}
CRITICAL REQUIREMENTS:
- Total length: 2000–2200 words (strict).
- Start with "# ${title}" as the first line.
- Use clear Markdown structure with "##" for main sections and "###" for subsections.
- Include at least 6–8 main sections, each 250–300 words where possible.
- Keep tone friendly, conversational, and human — like advice from a career coach.
- Avoid plagiarism and AI-detection patterns by using varied sentence lengths, real-world examples, and at least one original case study or anecdote.
- Add a Table of Contents after the introduction (use internal anchor links to sections).

SEO & STRUCTURE REQUIREMENTS:
- Include Meta Title (max 60 characters) and Meta Description (120–160 characters) at the top after the H1 in a code block. Meta must include the primary keyword.
- Provide a suggested URL slug (lowercase, hyphen-separated).
- Provide 3–5 authoritative external links placed naturally in the text. Use career-authoritative sources such as:
  [LinkedIn](https://linkedin.com), [Bureau of Labor Statistics](https://www.bls.gov), [Indeed](https://www.indeed.com), [Glassdoor](https://www.glassdoor.com), [CareerOneStop](https://www.careeronestop.org), [Harvard Business Review](https://hbr.org)
- Include ALT text suggestions for every image.

SCHEMA & TECHNICAL SEO:
- Add a FAQ section (3–6 focused Q&A) at the end.

CONTENT DETAILS:
- Introduction (200–250 words) that hooks the reader, states the problem, and includes the primary keyword once in the first 100 words.
- 6–8 body sections (each 250–300 words). Each section should:
  - have a descriptive H2,
  - include at least one H3 subsection where relevant,
  - include lists or bullet points for clarity,
  - include one real-world example, statistic, or mini case-study.
- Practical examples / case studies (200–250 words) — include at least one real example (industry, role, or personal scenario).
- Common questions or misconceptions (200–250 words) — answer concentrated FAQs and correct wrong assumptions.
- Actionable tips / step-by-step recommendations (200–250 words) with at least 5 bullet-pointed, implementable tips.
- Conclusion & key takeaways (150–200 words) and a strong Call-to-Action ("Build your resume", "Try our free resume builder", or "Download the checklist").

WRITING & READABILITY:
- Use active voice and a conversational tone.
- Keep average sentence length under 20 words. Vary sentence length.
- Use transition phrases and signposting.
- Use short paragraphs (2–3 sentences).
- Bold key takeaways and use italic sparingly for emphasis.
- Avoid keyword stuffing; include primary keyword naturally 4–6 times.

E-E-A-T & CREDIBILITY:
- Cite official sources for job market statistics or HR/recruitment claims.

OTHER:
- Provide suggested social copy: a short Tweet/LinkedIn post (max 160 characters) and suggested OG image alt text.
- Add "Last reviewed" date and suggest an update frequency.

OUTPUT FORMAT:
- Markdown only.

Example authoritative external links to consider (use naturally):
- [LinkedIn Career Advice](https://linkedin.com/learning)
- [Bureau of Labor Statistics](https://www.bls.gov)
- [Indeed Career Guide](https://www.indeed.com/career-advice)
- [Glassdoor Job Search Tips](https://www.glassdoor.com/blog)
- [Harvard Business Review](https://hbr.org)

Be thorough, human, and actionable. Prioritize practical career advice over theory. Ensure the article is SEO optimized and ready for publishing on a resume builder website.
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a professional career coach and resume writing expert who creates high-quality, actionable blog content for job seekers and professionals." },
      { role: "user", content: prompt },
    ],
  });

  const content = res.choices[0].message?.content || "";
  const slug = slugify(title, { lower: true, strict: true });

  console.log(`🔍 Generated content preview: "${content.slice(0, 200)}..."`);
  console.log(`🔍 Generated slug: "${slug}"`);

  return { title, slug, content, keywords };
}

// === Generate SEO Tags ===
async function generateSEOTags(title, content) {
  const prompt = `
Generate 5–10 human-friendly SEO tags for a career/resume blog titled "${title}".
Blog content preview: "${content.slice(0, 300)}..."
Tags should be relevant to resume writing, job searching, and career advice.
Return ONLY a JSON array of strings. Do not use markdown formatting or code blocks.
  `;
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a professional SEO strategist for a career and resume website. Return only valid JSON arrays without any markdown formatting." },
      { role: "user", content: prompt },
    ],
  });

  try {
    let responseContent = res.choices[0].message.content;
    responseContent = responseContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(responseContent);
    return Array.isArray(parsed) ? parsed : ["resume tips", "career advice"];
  } catch (error) {
    console.log(`⚠️ SEO tags parsing error: ${error.message}`);
    return ["resume tips", "career advice", "job search", "interview tips", "cover letter"];
  }
}

// === Generate Image ===
async function generateImage(title) {
  const prompt = `Create a realistic, copyright-free image representing "${title}" related to health or insurance.`;
  const image = await openai.images.generate({
    model: "gpt-image-1-mini",
    prompt,
    size: "1024x1024",
  });
  return image.data[0].b64_json;
}

// === Upload Blog Image ===
async function uploadBlogImage(imageDataOrUrl) {
  return await retry(async () => {
    let buffer;
    let originalname = `blog_image_${Date.now()}.png`;
    let mimetype = "image/png";

    if (typeof imageDataOrUrl === "string" && /^https?:\/\//i.test(imageDataOrUrl)) {
      const imgResponse = await axios.get(imageDataOrUrl, { responseType: "arraybuffer" });
      buffer = Buffer.from(imgResponse.data);
      mimetype = imgResponse.headers["content-type"] || "image/png";
    } else {
      const base64 = imageDataOrUrl.split(",").pop();
      buffer = Buffer.from(base64, "base64");
    }

    try {
      const MAX_SIZE = 3 * 1024 * 1024;
      if (buffer.length > MAX_SIZE) {
        let img = await Jimp.read(buffer);
        let quality = 90;
        while (buffer.length > MAX_SIZE && quality > 30) {
          img.quality(quality);
          buffer = await img.getBufferAsync(mimetype);
          quality -= 10;
        }
      }
    } catch (e) {
      console.warn("⚠️ Compression skipped:", e.message);
    }

    const file = { originalname, buffer, mimetype };
    const result = await blogUploadImageToS3(file);
    return result?.url || result?.Location;
  });
}

// === Extract Metadata from Content ===
function extractMetadata(content) {
  const metadata = {
    metaTitle: '',
    metaDescription: '',
    slug: '',
    suggestedImages: [],
    faqSchema: null,
    cleanContent: content
  };

  // Remove markdown code block wrappers at the start
  metadata.cleanContent = metadata.cleanContent.replace(/^```(?:markdown)?\s*\n/i, '').trim();
  metadata.cleanContent = metadata.cleanContent.replace(/\n```\s*$/i, '').trim();

  // Remove the H1 title if it's the first line
  metadata.cleanContent = metadata.cleanContent.replace(/^#\s+.+?\n+/, '').trim();

  // Format 1: ``` **Meta Title:** ... ```
  const metaBlockRegex1 = /```[\s\S]*?\*\*Meta Title[:\*]*\s*(.+?)\n[\s\S]*?\*\*Meta Description[:\*]*\s*(.+?)\n[\s\S]*?\*\*Slug[:\*]*\s*(.+?)[\s\S]*?```/i;
  const metaMatch1 = metadata.cleanContent.match(metaBlockRegex1);
  if (metaMatch1) {
    metadata.metaTitle = metaMatch1[1].trim();
    metadata.metaDescription = metaMatch1[2].trim();
    metadata.slug = metaMatch1[3].trim();
    metadata.cleanContent = metadata.cleanContent.replace(metaBlockRegex1, '').trim();
  }

  // Format 2: Simple format without code blocks
  const metaSimpleRegex = /\*\*Meta Title[:\*]*\s*(.+?)\n\s*\*\*Meta Description[:\*]*\s*(.+?)\n\s*\*\*Slug[:\*]*\s*(.+?)(?:\n|$)/i;
  const metaSimpleMatch = metadata.cleanContent.match(metaSimpleRegex);
  if (metaSimpleMatch) {
    metadata.metaTitle = metadata.metaTitle || metaSimpleMatch[1].trim();
    metadata.metaDescription = metadata.metaDescription || metaSimpleMatch[2].trim();
    metadata.slug = metadata.slug || metaSimpleMatch[3].trim();
    metadata.cleanContent = metadata.cleanContent.replace(metaSimpleRegex, '').trim();
  }

  // Format 3: "Suggested" format
  const suggestedMetaRegex = /\*\*Suggested Meta Title[:\*]*\s*(.+?)\n\s*\*\*Suggested Meta Description[:\*]*\s*(.+?)\n\s*\*\*Suggested (?:URL )?[Ss]lug[:\*]*\s*(.+?)(?:\n|$)/i;
  const suggestedMatch = metadata.cleanContent.match(suggestedMetaRegex);
  if (suggestedMatch) {
    metadata.metaTitle = metadata.metaTitle || suggestedMatch[1].trim();
    metadata.metaDescription = metadata.metaDescription || suggestedMatch[2].trim();
    metadata.slug = metadata.slug || suggestedMatch[3].trim();
    metadata.cleanContent = metadata.cleanContent.replace(suggestedMetaRegex, '').trim();
  }

  // Clean up remaining metadata lines
  metadata.cleanContent = metadata.cleanContent.replace(/---\s*\n/g, '');
  metadata.cleanContent = metadata.cleanContent.replace(/\*\*(?:Suggested )?Meta Title[:\*]+.*?\n/gi, '');
  metadata.cleanContent = metadata.cleanContent.replace(/\*\*(?:Suggested )?Meta Description[:\*]+.*?\n/gi, '');
  metadata.cleanContent = metadata.cleanContent.replace(/\*\*(?:Suggested )?(?:URL )?[Ss]lug[:\*]+.*?\n/gi, '');
  metadata.cleanContent = metadata.cleanContent.replace(/Meta Title[:\s]+.*?\n/gi, '');
  metadata.cleanContent = metadata.cleanContent.replace(/Meta Description[:\s]+.*?\n/gi, '');
  metadata.cleanContent = metadata.cleanContent.replace(/Slug[:\s]+.*?\n/gi, '');

  // Remove Table of Contents
  metadata.cleanContent = metadata.cleanContent.replace(/##\s*Table of Contents[\s\S]*?(?=\n##[^#])/i, '');

  // Extract FAQ Schema
  const faqSchemaRegex = /```json\s*(\{[\s\S]*?"@type":\s*"FAQPage"[\s\S]*?\})\s*```/i;
  const faqMatch = metadata.cleanContent.match(faqSchemaRegex);
  if (faqMatch) {
    try {
      metadata.faqSchema = JSON.parse(faqMatch[1]);
    } catch (e) {
      console.warn('⚠️ Failed to parse FAQ schema:', e.message);
    }
  }

  // Remove all code blocks
  metadata.cleanContent = metadata.cleanContent.replace(/```[\s\S]*?```/g, '').trim();

  // Remove "Suggested Images" section
  metadata.cleanContent = metadata.cleanContent.replace(/##?\s*Suggested Images[:\s]*and[:\s]*Infographic[\s\S]*?(?=\n##[^#]|$)/gi, '');
  metadata.cleanContent = metadata.cleanContent.replace(/##?\s*Suggested Images[:\s]*[\s\S]*?(?=\n##[^#]|$)/gi, '');
  metadata.cleanContent = metadata.cleanContent.replace(/^\d+\.\s+(?:Hero Image|Inline Image|Image)[\s\S]*?(?=\n##[^#]|\n\d+\.\s+(?:Hero|Inline)|$)/gim, '');
  metadata.cleanContent = metadata.cleanContent.replace(/\*\*Infographic Idea[:\*]+[\s\S]*?(?=\n##[^#]|$)/gi, '');

  // Remove image metadata lines
  metadata.cleanContent = metadata.cleanContent.replace(/^\s*-\s*Filename:.*?\n/gim, '');
  metadata.cleanContent = metadata.cleanContent.replace(/^\s*-\s*Alt Text:.*?\n/gim, '');
  metadata.cleanContent = metadata.cleanContent.replace(/^\s*-\s*Description:.*?\n/gim, '');

  // Remove "Suggested Social Copy" section
  metadata.cleanContent = metadata.cleanContent.replace(/##?\s*Suggested Social Copy[\s\S]*?(?=\n##[^#]|$)/gi, '');
  metadata.cleanContent = metadata.cleanContent.replace(/\*\*Suggested Social Copy[:\*]+[\s\S]*?(?=\n\n|\*\*|##|$)/gi, '');
  metadata.cleanContent = metadata.cleanContent.replace(/\*\*OG Image ALT Text[:\*]+[\s\S]*?(?=\n\n|\*\*|##|$)/gi, '');
  metadata.cleanContent = metadata.cleanContent.replace(/\*\*Update Frequency[:\*]+[\s\S]*?(?=\n\n|\*\*|##|$)/gi, '');
  metadata.cleanContent = metadata.cleanContent.replace(/\*\*Last Reviewed[:\*]+[\s\S]*?(?=\n\n|\*\*|##|$)/gi, '');
  metadata.cleanContent = metadata.cleanContent.replace(/\*\*Review Frequency[:\*]+.*?(?:\n|$)/gi, '');
  metadata.cleanContent = metadata.cleanContent.replace(/Review Frequency[:\s]+.*?(?:\n|$)/gi, '');
  metadata.cleanContent = metadata.cleanContent.replace(/\*\*Last Reviewed[:\*]+.*?\n/gi, '');
  metadata.cleanContent = metadata.cleanContent.replace(/^\*\*[A-Z][^:]*:[:\*]+.*$/gm, '');
  metadata.cleanContent = metadata.cleanContent.replace(/^".*?"$/gm, '');
  metadata.cleanContent = metadata.cleanContent.replace(/\n{3,}/g, '\n\n').trim();

  return metadata;
}

// === Normalize Markdown ===
function normalizeMarkdown(md) {
  return md
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// === Markdown → HTML Conversion ===
async function convertMarkdownToHtml(markdown) {
  const { marked } = await import("marked");
  const cleanMd = normalizeMarkdown(markdown);

  marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: false,
    mangle: false,
  });

  let html = marked.parse(cleanMd);

  // No inline styles — let the frontend handle styling via CSS classes

  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img", "h1", "h2", "h3", "h4", "h5", "h6",
      "strong", "em", "ul", "ol", "li", "span", "code", "pre", "blockquote",
      "p", "br", "div"
    ]),
    allowedAttributes: {
      a: ["href", "target", "rel", "id", "style"],
      img: ["src", "alt", "style", "width", "height"],
      h1: ["id", "style"], h2: ["id", "style"], h3: ["id", "style"],
      h4: ["id", "style"], h5: ["id", "style"], h6: ["id", "style"],
      p: ["style"], div: ["class", "style"], span: ["class", "style"],
      code: ["class", "style"], pre: ["class", "style"],
      ul: ["style"], ol: ["style"], li: ["style"],
      blockquote: ["style"], strong: ["style"], em: ["style"],
    },
    allowedStyles: {
      '*': {
        'color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/],
        'text-align': [/^left$/, /^right$/, /^center$/],
        'font-size': [/^\d+(?:\.\d+)?(?:px|em|rem|%)$/],
        'font-weight': [/^\d+$/, /^normal$/, /^bold$/],
        'max-width': [/^\d+(?:px|em|%)$/],
        'width': [/^\d+(?:px|em|%)$/],
        'height': [/^auto$/, /^\d+(?:px|em|%)$/],
        'margin': [/^[\d\s\.\-]+(?:px|em|%|auto)+$/],
        'margin-top': [/^\d+(?:px|em|%)$/],
        'margin-bottom': [/^\d+(?:px|em|%)$/],
        'margin-left': [/^\d+(?:px|em|%)$/],
        'margin-right': [/^\d+(?:px|em|%)$/],
        'padding': [/^[\d\s\.\-]+(?:px|em|%)+$/],
        'padding-left': [/^\d+(?:px|em|%)$/],
        'border-radius': [/^\d+(?:px|em|%)$/],
        'border-left': [/^[\d\s\.\-a-z#]+$/],
        'border-bottom': [/^[\d\s\.\-a-z#]+$/],
        'background-color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/],
        'line-height': [/^\d+(?:\.\d+)?$/],
        'overflow-x': [/^auto$/, /^scroll$/, /^hidden$/],
        'display': [/^block$/, /^inline$/, /^inline-block$/],
        'font-style': [/^italic$/, /^normal$/],
        'font-family': [/.*/],
        'text-decoration': [/^none$/, /^underline$/],
      }
    }
  }).trim();
}

// === Add Content Styling ===
function addContentStyling(html) {
  return html;
}

// === Check Duplicate Blog ===
async function isDuplicateBlog(slug, content) {
  try {
    const slugRes = await axios.get(`${BACKEND_URL}/api/blogs/check-duplicate/${slug}`);
    if (slugRes.data.exists) return true;

    if (!embeddingsCache[slug]) {
      const embeddingRes = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: content,
      });
      embeddingsCache[slug] = normalizeVector(embeddingRes.data[0].embedding);
      saveEmbeddingsCache();
    }

    const newEmb = embeddingsCache[slug];
    for (const [key, emb] of Object.entries(embeddingsCache)) {
      if (key === slug) continue;
      const sim = newEmb.reduce((sum, val, i) => sum + val * emb[i], 0);
      if (sim > 0.85) return true;
    }
    return false;
  } catch (err) {
    console.log("⚠️ Duplicate check failed:", err.message);
    return false;
  }
}

// === Create Blog Post ===
async function createBlogPost({ title, slug, content, coverImage, keywords }) {
  console.log(`🔍 Creating blog post for title: "${title}"`);

  const metadata = extractMetadata(content);
  const cleanContent = metadata.cleanContent;

  const tags = await generateSEOTags(title, cleanContent);
  const bodyHtml = await convertMarkdownToHtml(cleanContent);

  let contentHtml = coverImage
    ? `<img src="${coverImage}" alt="${title}"/>\n${bodyHtml}`
    : bodyHtml;

  contentHtml = addContentStyling(contentHtml);

  const finalSeoTitle = metadata.metaTitle || title;
  const finalSeoDescription = metadata.metaDescription || cleanContent.replace(/\n/g, " ").replace(/<[^>]*>/g, "").slice(0, 155);
  const finalSlug = metadata.slug || slug;

  const cleanSeoTitle = finalSeoTitle.replace(/\*\*/g, '').trim();
  const cleanSeoDescription = finalSeoDescription.replace(/\*\*/g, '').replace(/##\s*/g, '').trim();
  const cleanSlug = finalSlug.replace(/\*\*/g, '').trim();

  const wordCount = cleanContent.split(/\s+/).length;
  const readingTime = Math.ceil(wordCount / 200);

  const category = detectCategory(title);
  const canonicalUrl = `${FRONTEND_URL}${BLOG_BASE_PATH}/${cleanSlug}`;
  const coverImageAlt = `${title} - Career Guide | ${SITE_NAME}`;

  const payload = {
    title,
    category,
    content: contentHtml,
    tags,
    status: "active",

    seoTitle: cleanSeoTitle,
    seoDescription: cleanSeoDescription,
    seoKeywords: tags.join(", "),
    slug: cleanSlug,
    coverImage,
    coverImageAlt,

    metaTitle: cleanSeoTitle,
    metaDescription: cleanSeoDescription,
    metaAuthor: SITE_NAME,
    metaKeywords: tags,
    metaViewport: 'width=device-width, initial-scale=1',

    ogType: 'article',
    ogTitle: cleanSeoTitle,
    ogDescription: cleanSeoDescription,
    ogImage: coverImage,
    ogImageWidth: '1200',
    ogImageHeight: '630',
    ogSiteName: SITE_NAME,
    ogLocale: 'en_US',
    ogUrl: canonicalUrl,
    articlePublished_time: new Date(),
    articleModified_time: new Date(),
    articleSection: BLOG_CATEGORIES[category] || 'Career & Resume',
    articleAuthor: SITE_NAME,
    articleTag: tags,

    twitterCard: 'summary_large_image',
    twitterTitle: cleanSeoTitle,
    twitterDescription: cleanSeoDescription,
    twitterImage: coverImage,
    twitterSite: TWITTER_HANDLE,
    twitterCreator: TWITTER_HANDLE,
    twitterUrl: canonicalUrl,

    robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    canonical: canonicalUrl,

    readingTime,
    wordCount,
    isFeatured: false,
    structuredData: metadata.faqSchema || {},
    alternateHreflang: [
      { lang: 'en-US', url: canonicalUrl },
      { lang: 'en', url: canonicalUrl }
    ],

    createdBy: 'auto-blog-system',
    updatedBy: 'auto-blog-system',
    isActive: true
  };

  console.log(`🔍 Final payload summary:`, {
    title: payload.title,
    slug: payload.slug,
    category: payload.category,
    seoTitle: payload.seoTitle,
    contentLength: payload.content.length,
    tagsCount: payload.tags.length,
    wordCount: payload.wordCount,
    readingTime: payload.readingTime,
  });

  return await retry(async () => {
    const response = await axios.post(`${BACKEND_URL}/v1/blogs/create-blogs`, payload, {
      headers: { "Content-Type": "application/json" },
    });
    return response.data;
  });
}

// === Main Logic ===
async function automateBlogFromDB() {
  try {
    await connectToMongoDB();

    console.log("📚 Fetching blog titles from DB...");
    const { title, id } = await fetchTitlesFromDB();

    if (!title) {
      console.log("❌ No pending titles found in DB.");
      return;
    }

    console.log("🔗 Fetching active blogs for internal linking...");
    const allBlogs = await fetchAllActiveBlogs();

    console.log(`🧠 Generating blog for: "${title}"...`);

    const keywords = await getBestKeywords(title);
    const relevantBlogs = findRelevantBlogs(title, keywords, allBlogs, 5);

    const { title: generatedTitle, slug, content } = await generateBlogForTitle(title, relevantBlogs);

    console.log(`🔍 Generated slug: "${slug}"`);
    console.log(`🔍 Content length: ${content.length}`);

    const duplicate = await isDuplicateBlog(slug, content);
    if (duplicate) {
      console.log(`⚠️ Skipping duplicate blog: "${title}"`);
      await BlogMasterTitle.findByIdAndUpdate(id, { status: 'active' });
      return;
    }

    console.log("🖼  Generating cover image...");
    const imageData = await generateImage(title);

    console.log("⬆️  Uploading cover image...");
    const coverImage = await uploadBlogImage(imageData);

    console.log("📝 Creating blog post...");
    const createdPost = await createBlogPost({ title: generatedTitle, slug, content, coverImage, keywords });

    if (createdPost) {
      console.log(`🔍 Updating BlogMasterTitle status for ID: ${id}`);
      try {
        const updateResult = await BlogMasterTitle.findByIdAndUpdate(
          new mongoose.Types.ObjectId(id),
          { status: 'active' },
          { new: true }
        );
        if (!updateResult) {
          console.log(`⚠️ No document found with ID: ${id}`);
        } else {
          console.log(`✅ Successfully updated status to 'active' for ID: ${id}`);
        }
      } catch (updateError) {
        console.error(`❌ Failed to update BlogMasterTitle status:`, updateError.message);
      }
    }

    console.log(`✅ Blog for "${title}" posted successfully.\n`);
    console.log("🎉 Blog processing complete.");
  } catch (error) {
    console.error("❌ Blog automation failed:", error.message);
  }
}

// === Schedule: Daily at 9 AM ===
cron.schedule("0 9 * * *", automateBlogFromDB);

// Manual run on script start
automateBlogFromDB();
