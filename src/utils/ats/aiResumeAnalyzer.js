// aiResumeAnalyzer.js
// Utility to analyze resume using OpenAI API and a custom prompt

const OpenAI = require("openai");
const env = require("../../config/env");

const PROMPT = `You are an **expert ATS (Applicant Tracking System) and senior technical recruiter**.

Your task is to **analyze the following resume thoroughly** and provide detailed feedback to improve it.

The analysis must focus on **ATS compatibility, recruiter readability, and career impact**.

Return results in **structured JSON format only**.

IMPORTANT: Only analyze sentences, companies, projects, and bullet points that are actually present in the resume text provided. Do NOT invent or hallucinate any companies, projects, or bullet points. Only rewrite or critique sentences that exist in the resume.

----

ANALYSIS REQUIREMENTS

Evaluate the resume in the following categories:

1. ATS Compatibility
2. Resume Structure
3. Skills Coverage
4. Bullet Point Strength
5. Achievements & Metrics
6. Keyword Optimization
7. Experience Quality
8. Readability & Clarity
9. Impact & Results
10. Missing Information

----

DETAILED CHECKS

Perform the following checks:

### Weak Bullet Points

Detect bullet points that are weak because they:

* are too short
* lack action verbs
* do not describe impact
* do not show responsibility clearly

Example of weak bullet:
"Worked on backend APIs"

Example of strong bullet:
"Developed scalable Node.js REST APIs handling 20k daily requests"

Return a list of weak bullet points and suggest improved versions.

----

### Missing Achievements

Check whether the resume includes **quantifiable achievements**.

Achievements should contain:

* percentages
* growth numbers
* performance improvements
* user metrics
* revenue impact

Example:
"Improved API response time by 35%"

If achievements are missing, explain where they should be added.

----

### Missing Metrics

Identify experience descriptions that lack measurable results.

Metrics may include:

* %
* time reductions
* user counts
* project size
* performance improvements

Suggest metrics that could be added.

----

### Vague Sentences

Detect vague phrases such as:

* responsible for
* worked on
* helped with
* assisted in
* involved in

Provide improved rewritten versions.

----

### Keyword Optimization

Identify important keywords missing from the resume that recruiters or ATS systems expect.

Examples:

* technologies
* tools
* frameworks
* methodologies

Return:

* missing_keywords
* suggested_keywords

----

### Skills Evaluation

Analyze the skills section.

Check:

* skill relevance
* skill completeness
* modern technology coverage
* duplication or redundancy

Suggest improvements.

----

### Resume Structure Analysis

Check if the resume has proper sections:

* Summary
* Skills
* Work Experience
* Education
* Projects
* Certifications

Identify missing sections.

----

### Experience Quality

Evaluate if work experience demonstrates:

* ownership
* leadership
* technical depth
* business impact

Suggest improvements.

----

### Readability & Formatting

Analyze if the resume is:

* clear
* concise
* recruiter-friendly
* ATS friendly

Identify formatting issues.

----

### Overall Resume Score

Give an ATS score from **0 to 100** based on:

* keyword optimization
* measurable achievements
* strong bullet points
* structure
* skills relevance

----

OUTPUT FORMAT

Return only JSON in this format:

{
"ats_score": number,

"problems_detected":[
"Missing measurable achievements",
"Weak bullet points",
"Vague descriptions"
],

"weak_bullet_points":[
{
"original":"Worked on backend APIs",
"improved":"Developed Node.js REST APIs serving 20k daily users"
}
],

"vague_sentences":[
{
"original":"Responsible for server maintenance",
"improved":"Managed and optimized Linux servers supporting high-traffic applications"
}
],

"missing_metrics":[
{
"sentence":"Built APIs for internal tools",
"suggestion":"Mention number of APIs, users, or performance improvement"
}
],

"missing_keywords":[
"REST API",
"Docker",
"AWS"
],

"suggested_keywords":[
"Kubernetes",
"CI/CD",
"Microservices"
],

"section_improvements":[
"Add a professional summary section",
"Include measurable results in experience"
],

"skills_analysis":{
"strengths":[],
"missing_skills":[],
"suggestions":[]
},

"experience_feedback":[
"Experience descriptions should highlight impact and measurable results"
],

"resume_strengths":[
"Clear job titles",
"Relevant technical stack"
],

"final_recommendations":[
"Add quantifiable achievements",
"Improve bullet points with action verbs",
"Include metrics for technical impact"
]

}

----

IMPORTANT RULES

* Be extremely critical and detailed.
* Think like a senior recruiter reviewing resumes.
* Do not be polite; focus on improvement.
* Provide actionable suggestions.
* Ensure every problem includes a fix.
* Only return JSON.

----

RESUME TO ANALYZE:

{{resume_text}}
`;

const openai = new OpenAI({
  apiKey: env.openAIApiKey || env.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
});

async function analyzeResumeWithAI(resumeText) {
  const prompt = PROMPT.replace("{{resume_text}}", resumeText);
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 1200
  });
  // Extract JSON from response
  const text = response.choices[0].message.content;
  // Try to parse JSON (strip code block if present)
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    // Try to extract JSON from code block
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      json = JSON.parse(match[0]);
    } else {
      throw new Error("AI response is not valid JSON");
    }
  }
  return json;
}

module.exports = analyzeResumeWithAI;
