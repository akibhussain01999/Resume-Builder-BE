// src/modules/ats-checker/index.js



import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs/promises";
import { PDFParse } from "pdf-parse";
import pdfTextExtract from "pdf-text-extract";
import atsResumeModel from "./atsResumeModel.js";
import os from "os";
import path from "path";
import { promises as fsPromises } from "fs";
import { ObjectId } from "mongodb";
import resumeModel from "../resume/resume.model.js";


dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Generic retry helper — retries a function up to maxRetries times on failure
const withRetry = async (fn, maxRetries = 3, label = "operation") => {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            console.warn(`[Retry] ${label} failed (attempt ${attempt}/${maxRetries}):`, err.message);
            if (attempt < maxRetries) {
                // Small delay before retry: 500ms, 1000ms, 1500ms
                await new Promise(resolve => setTimeout(resolve, attempt * 500));
            }
        }
    }
    throw lastError;
};

export const readUploadedFile = async (fileBuffer, fileInfo = {}) => {
    const isPdf =
        (fileInfo.mimetype === "application/pdf") ||
        (fileInfo.originalname && fileInfo.originalname.toLowerCase().endsWith(".pdf"));

    if (isPdf) {
        return withRetry(async () => {
            // Primary: use pdf-parse (handles two-column layouts better)
            try {
                const parser = new PDFParse({ data: fileBuffer });
                const result = await parser.getText();
                const text = result?.text?.trim();
                if (text && text.length > 50) {
                    console.log("PDF extracted with pdf-parse, length:", text.length);
                    await parser.destroy();
                    return text;
                }
                await parser.destroy();
            } catch (err) {
                console.warn("pdf-parse failed, falling back to pdf-text-extract:", err.message);
            }

            // Fallback: use pdf-text-extract
            const tempDir = os.tmpdir();
            const tempFilePath = path.join(
                tempDir,
                `${Date.now()}_${fileInfo.originalname || "resume.pdf"}`
            );
            await fsPromises.writeFile(tempFilePath, fileBuffer);
            return new Promise((resolve, reject) => {
                pdfTextExtract(tempFilePath, async (err, pages) => {
                    await fsPromises.unlink(tempFilePath);
                    if (err) return reject(err);
                    const text = pages.join("\n");
                    if (!text || text.length < 50) {
                        return reject(new Error("PDF text extraction returned insufficient text"));
                    }
                    console.log("PDF extracted with pdf-text-extract, length:", text.length);
                    resolve(text);
                });
            });
        }, 3, "PDF text extraction");
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
        location: "",
        linkedin: "",
        jobRoles: [],
        skills: [],
        experience: [],
        education: [],
        projects: [],
        summary: [],
        achievements: [],
        strengths: [],
        interests: [],
        profile: [],
        certifications: [],
        courses: [],
        languages: []
    };

    // Normalize AI response: map alternate field names and ensure correct types
    const normalizeFields = (rawParsed) => {
        // Step 1: Lowercase all keys so "INTERESTS", "Interests", "interests" all work
        const parsed = {};
        for (const [key, value] of Object.entries(rawParsed)) {
            parsed[key.toLowerCase()] = value;
        }

        const normalized = {
            name: "",
            email: "",
            phone: "",
            location: "",
            linkedin: "",
            jobRoles: [],
            skills: [],
            experience: [],
            education: [],
            projects: [],
            summary: [],
            achievements: [],
            strengths: [],
            interests: [],
            profile: [],
            certifications: [],
            courses: [],
            languages: []
        };

        // Helper: ensure value is an array, splitting delimited strings
        const toArray = (val) => {
            if (!val) return [];
            if (Array.isArray(val)) {
                // Flatten: each element might itself be a delimited string
                const flat = [];
                for (const item of val) {
                    if (typeof item === "string") {
                        flat.push(...splitDelimited(item));
                    } else {
                        flat.push(item);
                    }
                }
                return flat;
            }
            if (typeof val === "string" && val.trim()) return splitDelimited(val);
            return [];
        };

        // Helper: split a string by common delimiters used in resumes worldwide
        const splitDelimited = (str) => {
            if (!str || !str.trim()) return [];
            const trimmed = str.trim();

            // All Unicode dots, bullets, pipes, dashes used as separators in resumes:
            // · (U+00B7) • (U+2022) ‧ (U+2027) ∙ (U+2219) ⋅ (U+22C5) ● (U+25CF) ◦ (U+25E6)
            // ○ (U+25CB) ▪ (U+25AA) ▸ (U+25B8) ► (U+25BA) ★ (U+2605) ✦ (U+2726) ✧ (U+2727)
            // ◆ (U+25C6) ◇ (U+25C7) ⬥ (U+2B25) – (U+2013) — (U+2014) ⁃ (U+2043)
            // | (pipe) ; (semicolon) / (slash when between short items)
            const separators = /\s*[·•‧∙⋅●◦○▪▸►★✦✧◆◇⬥–—⁃|;]\s*/;

            if (separators.test(trimmed)) {
                const parts = trimmed.split(separators).map(s => s.trim()).filter(Boolean);
                if (parts.length > 1) return parts;
            }

            // Try splitting by " - " (space-dash-space, common in resumes)
            if (/\s+-\s+/.test(trimmed)) {
                const parts = trimmed.split(/\s+-\s+/).map(s => s.trim()).filter(Boolean);
                if (parts.length > 1) return parts;
            }

            // Split by comma only if items are short (likely a list, not a sentence)
            if (trimmed.includes(",")) {
                const parts = trimmed.split(",").map(s => s.trim()).filter(Boolean);
                const avgLen = parts.reduce((sum, p) => sum + p.length, 0) / parts.length;
                if (avgLen < 50) return parts;
            }

            // Split by newlines (PDF extraction may put each item on its own line)
            if (/[\n\r]/.test(trimmed)) {
                const parts = trimmed.split(/[\n\r]+/).map(s => s.trim()).filter(Boolean);
                if (parts.length > 1) return parts;
            }

            return [trimmed];
        };

        // Helper: pick first non-empty string from multiple keys
        // All lookups use lowercase since parsed keys are already lowercased
        const pickString = (...keys) => {
            for (const key of keys) {
                const val = parsed[key.toLowerCase()];
                if (val && typeof val === "string" && val.trim()) return val.trim();
                // Also handle case where AI returns array with one string for a scalar field
                if (Array.isArray(val) && val.length > 0 && typeof val[0] === "string") return val[0].trim();
            }
            return "";
        };

        // Helper: collect arrays from multiple keys
        // All lookups use lowercase since parsed keys are already lowercased
        const collectArrays = (...keys) => {
            const result = [];
            for (const key of keys) {
                result.push(...toArray(parsed[key.toLowerCase()]));
            }
            return result;
        };

        // Scalar fields — try all alternate names
        normalized.name = pickString(
            "name", "fullName", "full_name", "candidateName", "candidate_name",
            "applicantName", "applicant_name", "firstName", "first_name"
        );
        normalized.email = pickString(
            "email", "emailAddress", "email_address", "mail", "emailId", "email_id",
            "contactEmail", "contact_email", "e_mail", "eMail"
        );
        normalized.phone = pickString(
            "phone", "mobile", "cell", "telephone", "tel", "contactNumber",
            "contact_number", "phoneNumber", "phone_number", "mobileNumber",
            "mobile_number", "cellPhone", "cell_phone", "mob", "whatsapp"
        );
        normalized.location = pickString(
            "location", "address", "city", "residence", "basedIn", "based_in",
            "currentLocation", "current_location", "hometown", "state", "country",
            "region", "postalAddress", "postal_address", "mailingAddress", "mailing_address"
        );
        normalized.linkedin = pickString(
            "linkedin", "linkedinUrl", "linkedin_url", "linkedinProfile",
            "linkedin_profile", "linkedIn", "linked_in"
        );

        // Array fields — collect from all alternate key names
        normalized.summary = collectArrays(
            "summary", "about", "aboutMe", "about_me", "professionalSummary",
            "professional_summary", "executiveSummary", "executive_summary",
            "careerSummary", "career_summary", "objective", "careerObjective",
            "career_objective", "personalStatement", "personal_statement",
            "overview", "professionalOverview", "professional_overview",
            "bio", "biography", "introduction", "selfIntroduction", "self_introduction",
            "elevatorPitch", "elevator_pitch", "valueProposition", "value_proposition",
            "description", "selfDescription", "self_description", "motivation",
            "coverNote", "cover_note", "openingStatement", "opening_statement",
            "brandingStatement", "branding_statement", "resumeSummary", "resume_summary"
        );

        normalized.profile = collectArrays(
            "profile", "professionalProfile", "professional_profile",
            "careerProfile", "career_profile", "personalProfile", "personal_profile",
            "candidateProfile", "candidate_profile", "profileSummary", "profile_summary",
            "profileStatement", "profile_statement", "personalDetails", "personal_details",
            "personalInformation", "personal_information", "personalData", "personal_data",
            "biodata", "bio_data"
        );

        normalized.skills = collectArrays(
            "skills", "technicalSkills", "technical_skills", "coreCompetencies",
            "core_competencies", "keySkills", "key_skills", "expertise",
            "proficiencies", "tools", "technologies", "techStack", "tech_stack",
            "toolsAndTechnologies", "tools_and_technologies", "areasOfExpertise",
            "areas_of_expertise", "professionalSkills", "professional_skills",
            "softSkills", "soft_skills", "hardSkills", "hard_skills",
            "skillSet", "skill_set", "skillset", "competencies", "coreSkills",
            "core_skills", "itSkills", "it_skills", "computerSkills", "computer_skills",
            "digitalSkills", "digital_skills", "softwareSkills", "software_skills",
            "programmingSkills", "programming_skills", "programmingLanguages",
            "programming_languages", "frameworks", "libraries", "platforms",
            "software", "hardware", "toolsAndSoftware", "tools_and_software",
            "technicalProficiency", "technical_proficiency", "technicalCompetencies",
            "technical_competencies", "technicalExpertise", "technical_expertise",
            "domainSkills", "domain_skills", "relevantSkills", "relevant_skills",
            "additionalSkills", "additional_skills", "otherSkills", "other_skills",
            "specialSkills", "special_skills", "knowledge", "technicalKnowledge",
            "technical_knowledge", "abilities", "capabilities", "specializations",
            "databases", "cloud", "cloudTechnologies", "cloud_technologies",
            "devops", "devopsTools", "devops_tools", "methodologies", "methods",
            "operatingSystems", "operating_systems", "environments"
        );

        normalized.experience = collectArrays(
            "experience", "workExperience", "work_experience", "employmentHistory",
            "employment_history", "professionalExperience", "professional_experience",
            "careerHistory", "career_history", "workHistory", "work_history",
            "employment", "relevantExperience", "relevant_experience",
            "industryExperience", "industry_experience", "jobExperience", "job_experience",
            "jobHistory", "job_history", "positionsHeld", "positions_held", "positions",
            "employmentRecord", "employment_record", "employmentDetails", "employment_details",
            "careerExperience", "career_experience", "workingExperience", "working_experience",
            "workRecord", "work_record", "professionalBackground", "professional_background",
            "background", "careerBackground", "career_background",
            "internships", "internshipExperience", "internship_experience", "internship",
            "traineeExperience", "trainee_experience", "apprenticeship", "apprenticeships",
            "industrialTraining", "industrial_training", "placement", "placements",
            "practicalExperience", "practical_experience", "fieldExperience", "field_experience",
            "clinicalExperience", "clinical_experience", "teachingExperience", "teaching_experience",
            "researchExperience", "research_experience", "militaryExperience", "military_experience",
            "militaryService", "military_service", "volunteerExperience", "volunteer_experience",
            "volunteering", "volunteerWork", "volunteer_work", "communityService", "community_service",
            "freelanceExperience", "freelance_experience", "freelanceWork", "freelance_work",
            "consultingExperience", "consulting_experience", "contractWork", "contract_work",
            "previousEmployment", "previous_employment", "pastRoles", "past_roles",
            "rolesAndResponsibilities", "roles_and_responsibilities"
        );

        normalized.education = collectArrays(
            "education", "academicBackground", "academic_background",
            "academicQualifications", "academic_qualifications", "qualifications",
            "academics", "educationalBackground", "educational_background",
            "educationalQualifications", "educational_qualifications",
            "academicHistory", "academic_history", "academicRecord", "academic_record",
            "academicDetails", "academic_details", "academicCredentials", "academic_credentials",
            "formalEducation", "formal_education", "higherEducation", "higher_education",
            "university", "universityEducation", "university_education",
            "college", "collegeEducation", "college_education", "school", "schooling",
            "schoolEducation", "school_education", "degrees", "degree",
            "studies", "study", "academicStudies", "academic_studies",
            "fieldOfStudy", "field_of_study", "diploma", "diplomas",
            "educationAndTraining", "education_and_training", "educationalHistory",
            "educational_history", "continuousLearning", "continuous_learning"
        );

        normalized.projects = collectArrays(
            "projects", "personalProjects", "personal_projects", "portfolio",
            "keyProjects", "key_projects", "sideProjects", "side_projects",
            "academicProjects", "academic_projects", "professionalProjects",
            "professional_projects", "projectWork", "project_work",
            "projectExperience", "project_experience", "projectDetails", "project_details",
            "projectHistory", "project_history", "majorProjects", "major_projects",
            "minorProjects", "minor_projects", "miniProjects", "mini_projects",
            "capstoneProject", "capstone_project", "capstone", "thesis", "dissertation",
            "researchProjects", "research_projects", "openSource", "open_source",
            "openSourceContributions", "open_source_contributions",
            "githubProjects", "github_projects", "contributions",
            "notableProjects", "notable_projects", "selectedProjects", "selected_projects",
            "featuredProjects", "featured_projects", "showcase", "workSamples", "work_samples",
            "caseStudies", "case_studies", "technicalProjects", "technical_projects",
            "developmentProjects", "development_projects"
        );

        normalized.certifications = collectArrays(
            "certifications", "certificates", "professionalCertifications",
            "professional_certifications", "licenses", "accreditations",
            "licensesAndCertifications", "licenses_and_certifications",
            "certificationAndLicenses", "certification_and_licenses",
            "professionalLicenses", "professional_licenses",
            "industryCertifications", "industry_certifications",
            "technicalCertifications", "technical_certifications",
            "credentials", "professionalCredentials", "professional_credentials",
            "digitalCertificates", "digital_certificates", "digitalBadges", "digital_badges",
            "badges", "onlineCertifications", "online_certifications",
            "certificatePrograms", "certificate_programs",
            "boardCertifications", "board_certifications", "licensure"
        );

        normalized.courses = collectArrays(
            "courses", "training", "professionalDevelopment", "professional_development",
            "workshops", "continuingEducation", "continuing_education",
            "onlineCourses", "online_courses", "coursework", "relevantCoursework",
            "relevant_coursework", "trainingPrograms", "training_programs",
            "trainingAndDevelopment", "training_and_development",
            "seminars", "webinars", "bootcamp", "bootcamps", "codingBootcamp",
            "coding_bootcamp", "classes", "electives", "relevantCourses", "relevant_courses",
            "additionalTraining", "additional_training", "specializedTraining",
            "specialized_training", "technicalTraining", "technical_training",
            "skillDevelopment", "skill_development", "mooc", "moocs",
            "onlineLearning", "online_learning", "professionalTraining",
            "professional_training", "masterclass", "masterclasses",
            "nanodegree", "microCredentials", "micro_credentials",
            "conferencesAttended", "conferences_attended", "conferences",
            "cpd", "professionalEducation", "professional_education"
        );

        normalized.languages = collectArrays(
            "languages", "languageProficiency", "language_proficiency",
            "languageSkills", "language_skills", "languagesKnown", "languages_known",
            "languagesSpoken", "languages_spoken", "linguisticSkills", "linguistic_skills",
            "linguisticProficiency", "linguistic_proficiency",
            "foreignLanguages", "foreign_languages", "communicationLanguages",
            "communication_languages", "spokenLanguages", "spoken_languages",
            "writtenLanguages", "written_languages", "languageFluency", "language_fluency",
            "fluency", "motherTongue", "mother_tongue", "nativeLanguage", "native_language"
        );

        normalized.achievements = collectArrays(
            "achievements", "accomplishments", "awards", "honors", "recognition",
            "awardsAndAchievements", "awards_and_achievements",
            "keyAchievements", "key_achievements", "professionalAchievements",
            "professional_achievements", "careerAchievements", "career_achievements",
            "notableAchievements", "notable_achievements", "milestones",
            "careerMilestones", "career_milestones", "awardsAndHonors", "awards_and_honors",
            "honorsAndAwards", "honors_and_awards", "distinctions", "accolades",
            "merits", "prizes", "scholarships", "fellowships", "grants",
            "academicAwards", "academic_awards", "academicHonors", "academic_honors",
            "professionalAwards", "professional_awards", "industryAwards", "industry_awards",
            "patents", "publications", "researchPublications", "research_publications",
            "publishedWork", "published_work", "papers", "journalPapers", "journal_papers",
            "conferencePapers", "conference_papers", "presentations",
            "speakingEngagements", "speaking_engagements", "keynotes", "talks",
            "highlights", "careerHighlights", "career_highlights",
            "professionalHighlights", "professional_highlights",
            "results", "keyResults", "key_results", "outcomes"
        );

        normalized.strengths = collectArrays(
            "strengths", "coreStrengths", "core_strengths", "keyStrengths", "key_strengths",
            "personalStrengths", "personal_strengths", "professionalStrengths",
            "professional_strengths", "strongPoints", "strong_points",
            "assets", "personalAssets", "personal_assets", "personalQualities",
            "personal_qualities", "qualities", "traits", "personalTraits", "personal_traits",
            "characterTraits", "character_traits", "attributes", "personalAttributes",
            "personal_attributes", "professionalAttributes", "professional_attributes",
            "leadershipQualities", "leadership_qualities", "interpersonalSkills",
            "interpersonal_skills", "managementSkills", "management_skills",
            "communicationSkills", "communication_skills", "coreValues", "core_values",
            "values"
        );

        normalized.interests = collectArrays(
            "interests", "hobbies", "hobbiesAndInterests", "hobbies_and_interests",
            "extracurricularActivities", "extracurricular_activities", "activities",
            "passions", "personalInterests", "personal_interests",
            "professionalInterests", "professional_interests",
            "leisureActivities", "leisure_activities", "recreationalActivities",
            "recreational_activities", "outsideInterests", "outside_interests",
            "otherInterests", "other_interests", "sports", "clubs",
            "memberships", "associations", "professionalMemberships", "professional_memberships",
            "professionalAssociations", "professional_associations",
            "affiliations", "professionalAffiliations", "professional_affiliations",
            "organizations", "involvement", "communityInvolvement", "community_involvement",
            "campusInvolvement", "campus_involvement", "socialActivities", "social_activities",
            "culturalActivities", "cultural_activities", "creativePursuits", "creative_pursuits",
            "sideInterests", "side_interests", "volunteering", "volunteerWork", "volunteer_work"
        );

        normalized.jobRoles = collectArrays(
            "jobRoles", "job_roles", "roles", "title", "titles", "designation",
            "designations", "position", "positions", "jobTitle", "job_title",
            "jobTitles", "job_titles", "currentRole", "current_role",
            "currentPosition", "current_position", "professionalTitle",
            "professional_title", "headline"
        );

        // Catch-all: scan any remaining keys not yet consumed and map by keyword matching
        // IMPORTANT: Longer/more specific keywords MUST come first to avoid collisions
        // e.g. "interest" must be checked before "intern", "achievement" before "achieve"
        const keywordToFieldPairs = [
            // Longer keywords first to prevent substring collisions
            ["introduction", "summary"], ["objective", "summary"], ["overview", "summary"], ["motivation", "summary"], ["statement", "summary"], ["summary", "summary"], ["about", "summary"], ["bio", "summary"],
            ["biodata", "profile"], ["profile", "profile"],
            ["competenc", "skills"], ["proficienc", "skills"], ["technolog", "skills"], ["expertise", "skills"], ["knowledge", "skills"], ["software", "skills"], ["skill", "skills"], ["stack", "skills"], ["tool", "skills"],
            ["internship", "experience"], ["experience", "experience"], ["employment", "experience"], ["freelance", "experience"], ["volunteer", "experience"], ["employ", "experience"], ["career", "experience"], ["work", "experience"],
            ["university", "education"], ["academic", "education"], ["education", "education"], ["college", "education"], ["school", "education"], ["degree", "education"], ["diploma", "education"], ["qualif", "education"],
            ["portfolio", "projects"], ["dissertation", "projects"], ["capstone", "projects"], ["project", "projects"], ["thesis", "projects"],
            ["certification", "certifications"], ["credential", "certifications"], ["accredit", "certifications"], ["license", "certifications"], ["certif", "certifications"], ["badge", "certifications"],
            ["workshop", "courses"], ["bootcamp", "courses"], ["training", "courses"], ["seminar", "courses"], ["webinar", "courses"], ["course", "courses"], ["mooc", "courses"],
            ["linguistic", "languages"], ["language", "languages"], ["tongue", "languages"], ["fluency", "languages"],
            ["achievement", "achievements"], ["accomplish", "achievements"], ["recognition", "achievements"], ["publication", "achievements"], ["highlight", "achievements"], ["scholar", "achievements"], ["achieve", "achievements"], ["award", "achievements"], ["honor", "achievements"], ["prize", "achievements"], ["patent", "achievements"],
            ["strength", "strengths"], ["quality", "strengths"], ["attribute", "strengths"], ["trait", "strengths"], ["asset", "strengths"],
            // "interest" MUST come before any short keywords that could collide
            ["interest", "interests"], ["recreation", "interests"], ["membership", "interests"], ["affiliation", "interests"], ["passion", "interests"], ["activit", "interests"], ["leisure", "interests"], ["hobb", "interests"], ["club", "interests"], ["sport", "interests"],
            ["designation", "jobRoles"], ["position", "jobRoles"], ["headline", "jobRoles"], ["title", "jobRoles"], ["role", "jobRoles"]
        ];

        // Scan all keys in parsed object
        for (const key of Object.keys(parsed)) {
            const lowerKey = key.toLowerCase();
            // Skip keys that directly match a normalized field (already handled by collectArrays)
            if (normalized.hasOwnProperty(lowerKey)) continue;
            for (const [keyword, field] of keywordToFieldPairs) {
                if (lowerKey.includes(keyword)) {
                    const values = toArray(parsed[key]);
                    if (values.length > 0 && normalized[field].length === 0) {
                        normalized[field] = values;
                    } else if (values.length > 0) {
                        for (const v of values) {
                            if (typeof v === "string" && !normalized[field].includes(v)) {
                                normalized[field].push(v);
                            } else if (typeof v !== "string") {
                                normalized[field].push(v);
                            }
                        }
                    }
                    break;
                }
            }
        }

        return normalized;
    };

    for (const chunk of chunks) {

        const prompt = `
You are a resume parser AI.

Extract information from the resume text below.

IMPORTANT: Resumes globally use many different section header names, abbreviations, and formats. You MUST recognize ALL of these and map them to the correct field. Headers may appear in UPPERCASE, Title Case, lowercase, with or without colons, dashes, icons, emojis, or special characters. Ignore formatting — match by meaning.

SUMMARY (put in "summary"):
"About", "About Me", "About Us", "Summary", "Professional Summary", "Executive Summary", "Career Summary", "Resume Summary", "Objective", "Career Objective", "Professional Objective", "Job Objective", "Personal Statement", "Personal Summary", "Overview", "Professional Overview", "Career Overview", "Bio", "Biography", "Introduction", "Self Introduction", "Elevator Pitch", "Value Proposition", "What I Do", "Who I Am", "Brief", "Professional Brief", "Mission Statement", "Career Goal", "Goals", "Career Goals", "Ambition", "Aspiration", "Description", "Self Description", "Candidature", "Motivation", "Cover Note", "Opening Statement", "Headline", "Tagline", "Branding Statement", "Personal Brand"

PROFILE (put in "profile"):
"Profile", "Professional Profile", "Career Profile", "Personal Profile", "Candidate Profile", "My Profile", "Profile Summary", "Profile Statement", "Professional Statement", "Personal Details", "Personal Information", "Personal Data", "Biodata", "Bio Data", "Curriculum Vitae", "CV Profile", "Resume Profile"

SKILLS (put in "skills"):
"Skills", "Technical Skills", "Core Competencies", "Key Skills", "Expertise", "Proficiencies", "Tools", "Technologies", "Tech Stack", "Tools & Technologies", "Areas of Expertise", "Professional Skills", "Soft Skills", "Hard Skills", "Skill Set", "Skillset", "Competencies", "Core Skills", "IT Skills", "Computer Skills", "Digital Skills", "Software Skills", "Programming Skills", "Programming Languages", "Frameworks", "Libraries", "Platforms", "Software", "Hardware", "Tools & Software", "Technical Proficiency", "Technical Competencies", "Technical Expertise", "Domain Skills", "Functional Skills", "Industry Skills", "Relevant Skills", "Transferable Skills", "Additional Skills", "Other Skills", "Special Skills", "Key Competencies", "Key Qualifications", "Qualifications Summary", "Core Qualifications", "Knowledge", "Technical Knowledge", "Domain Knowledge", "Know-How", "Abilities", "Capabilities", "Specializations", "Specialities", "Forte", "What I Know", "What I Use", "My Skills", "My Expertise", "Tech Proficiency", "Software Proficiency", "Environments", "Operating Systems", "Databases", "Cloud", "Cloud Technologies", "DevOps", "DevOps Tools", "Methods", "Methodologies", "Protocols"

EXPERIENCE (put in "experience"):
"Experience", "Work Experience", "Employment History", "Professional Experience", "Career History", "Work History", "Employment", "Relevant Experience", "Industry Experience", "Job Experience", "Job History", "Positions Held", "Positions", "Employment Record", "Employment Details", "Career Experience", "Working Experience", "Work Record", "Professional Background", "Background", "Career Background", "Internships", "Internship Experience", "Internship", "Trainee Experience", "Apprenticeship", "Apprenticeships", "Industrial Training", "Placement", "Placements", "On-the-Job Training", "OJT", "Practical Experience", "Field Experience", "Clinical Experience", "Teaching Experience", "Research Experience", "Military Experience", "Military Service", "Service History", "Volunteer Experience", "Voluntary Experience", "Volunteering", "Volunteer Work", "Community Service", "Community Involvement", "Social Work", "Pro Bono", "Freelance Experience", "Freelance Work", "Consulting Experience", "Contract Work", "Temporary Work", "Part-Time Experience", "Previous Employment", "Past Roles", "Roles & Responsibilities", "Professional History", "Career Progression", "Where I Worked", "Where I Have Worked", "My Experience", "Engagement History"

EDUCATION (put in "education"):
"Education", "Academic Background", "Academic Qualifications", "Qualifications", "Academics", "Educational Background", "Education & Qualifications", "Educational Qualifications", "Academic History", "Academic Record", "Academic Details", "Academic Credentials", "Formal Education", "Higher Education", "University", "University Education", "College", "College Education", "School", "Schooling", "School Education", "Degrees", "Degree", "Studies", "Study", "Academic Studies", "Field of Study", "Major", "Majors", "Specialization", "Diploma", "Diplomas", "Post-Graduate", "Postgraduate", "Graduate Studies", "Undergraduate", "PhD", "Doctorate", "Masters", "Bachelors", "B.Tech", "B.E.", "B.Sc", "B.A.", "M.Tech", "M.E.", "M.Sc", "M.A.", "MBA", "BBA", "BCA", "MCA", "MBBS", "LLB", "Education & Training", "Academic Achievements", "Scholarly Background", "Learning", "Continuous Learning", "Educational History", "My Education", "Where I Studied", "Alma Mater", "10th", "12th", "HSC", "SSC", "CBSE", "ICSE", "Board Exams", "GPA", "CGPA", "Percentage", "Class", "Division", "Semester"

PROJECTS (put in "projects"):
"Projects", "Personal Projects", "Portfolio", "Key Projects", "Side Projects", "Academic Projects", "Professional Projects", "Project Work", "Project Experience", "Project Details", "Project History", "Major Projects", "Minor Projects", "Mini Projects", "Capstone Project", "Capstone", "Thesis", "Dissertation", "Research Projects", "Open Source", "Open Source Contributions", "GitHub Projects", "Contributions", "Notable Projects", "Selected Projects", "Featured Projects", "Showcase", "Work Samples", "Sample Work", "Case Studies", "Assignments", "Lab Projects", "Group Projects", "Individual Projects", "Collaborative Projects", "Client Projects", "Freelance Projects", "Independent Projects", "Technical Projects", "Engineering Projects", "Development Projects", "My Projects", "What I Built", "Portfolio Projects", "Demos", "Prototypes", "POC", "Proof of Concept"

CERTIFICATIONS (put in "certifications"):
"Certifications", "Certificates", "Professional Certifications", "Licenses", "Accreditations", "Licenses & Certifications", "Certification & Licenses", "Professional Licenses", "Industry Certifications", "Technical Certifications", "Certified", "Credentials", "Professional Credentials", "Accredited Certifications", "Digital Certificates", "Digital Badges", "Badges", "Verified Certifications", "Online Certifications", "Certificate Programs", "Certification Programs", "Licensed", "Chartered", "Registered", "Board Certifications", "Licensure", "Professional Accreditations", "My Certifications", "Qualifications & Certifications", "Awards & Certifications"

COURSES (put in "courses"):
"Courses", "Training", "Professional Development", "Workshops", "Continuing Education", "Online Courses", "Relevant Coursework", "Coursework", "Training Programs", "Training & Development", "Seminars", "Webinars", "Bootcamp", "Bootcamps", "Coding Bootcamp", "Classes", "Electives", "Relevant Courses", "Additional Training", "Specialized Training", "Technical Training", "Skill Development", "Learning & Development", "L&D", "MOOC", "MOOCs", "Online Learning", "Self-Study", "Self Learning", "Independent Study", "Professional Training", "Corporate Training", "In-House Training", "External Training", "Conferences Attended", "Conferences", "Symposiums", "Colloquia", "Masterclass", "Masterclasses", "My Courses", "What I Learned", "Professional Education", "Continuous Professional Development", "CPD", "Nanodegree", "Specialization Courses", "Micro-Credentials"

LANGUAGES (put in "languages"):
"Languages", "Language Proficiency", "Language Skills", "Languages Known", "Languages Spoken", "Linguistic Skills", "Linguistic Proficiency", "Language Competency", "Language Abilities", "Foreign Languages", "Communication Languages", "Multilingual", "Bilingual", "Mother Tongue", "Native Language", "First Language", "Second Language", "Spoken Languages", "Written Languages", "Language Fluency", "Fluency", "My Languages", "Languages I Speak", "Tongue"

ACHIEVEMENTS (put in "achievements"):
"Achievements", "Accomplishments", "Awards", "Honors", "Recognition", "Awards & Achievements", "Key Achievements", "Professional Achievements", "Career Achievements", "Notable Achievements", "Milestones", "Career Milestones", "Awards & Honors", "Honors & Awards", "Awards & Recognition", "Distinctions", "Accolades", "Merits", "Prizes", "Trophies", "Medals", "Scholarships", "Fellowships", "Grants", "Dean's List", "Honor Roll", "Academic Awards", "Academic Honors", "Professional Awards", "Industry Awards", "Competition Wins", "Hackathon Wins", "Hackathons", "Patent", "Patents", "Publications", "Research Publications", "Published Work", "Papers", "Journal Papers", "Conference Papers", "Presentations", "Speaking Engagements", "Keynotes", "Talks", "Guest Lectures", "Contributions to Industry", "Impact", "My Achievements", "What I Achieved", "Results", "Key Results", "Outcomes", "Highlights", "Career Highlights", "Professional Highlights"

STRENGTHS (put in "strengths"):
"Strengths", "Core Strengths", "Key Strengths", "Personal Strengths", "Professional Strengths", "My Strengths", "Strong Points", "Assets", "Personal Assets", "Professional Assets", "Value Add", "What I Bring", "Differentiators", "Unique Selling Points", "USP", "Core Values", "Values", "Personal Qualities", "Qualities", "Traits", "Personal Traits", "Character Traits", "Attributes", "Personal Attributes", "Professional Attributes", "Soft Skills", "Interpersonal Skills", "Leadership Qualities", "Management Skills", "Communication Skills"

INTERESTS (put in "interests"):
"Interests", "Hobbies", "Hobbies & Interests", "Extracurricular Activities", "Activities", "Passions", "Personal Interests", "Professional Interests", "Leisure Activities", "Recreational Activities", "Extra-Curricular", "Extracurriculars", "Co-Curricular Activities", "Co-Curricular", "Outside Interests", "Other Interests", "Free Time", "In My Free Time", "Things I Enjoy", "Fun Facts", "About My Interests", "Sports", "Clubs", "Memberships", "Associations", "Professional Memberships", "Professional Associations", "Affiliations", "Professional Affiliations", "Organizations", "Society Memberships", "Involvement", "Community Involvement", "Campus Involvement", "Social Activities", "Cultural Activities", "Creative Pursuits", "Side Interests", "What I Enjoy", "My Hobbies", "My Interests"

CONTACT INFO:
- For name: "Name", "Full Name", "Candidate Name", "Applicant Name", or the prominent name at the top of the resume
- For email: "Email", "E-mail", "Email Address", "Mail", "E-Mail ID", "Email ID", "Contact Email" or any string matching an email pattern
- For phone: "Phone", "Mobile", "Cell", "Telephone", "Tel", "Contact Number", "Phone Number", "Mobile Number", "Cell Phone", "Mob", "Ph", "Contact No", "Landline", "WhatsApp" or any string matching a phone pattern
- For location: "Location", "Address", "City", "Residence", "Based in", "Lives in", "Current Location", "Hometown", "State", "Country", "Region", "Postal Address", "Mailing Address", "Permanent Address", "Present Address", "Residential Address" or city/state/country info near contact details
- For LinkedIn: "LinkedIn", "LinkedIn Profile", "LinkedIn URL", "linkedin.com" or any URL containing "linkedin.com"
- For job title/roles: "Title", "Designation", "Role", "Position", "Job Title", "Current Role", "Current Position", "Professional Title", "Headline" or text appearing directly below the name as a subtitle

CRITICAL — SPLITTING DELIMITED VALUES:
Resumes often list items separated by · • | , ; – — or similar characters.
You MUST split these into INDIVIDUAL array elements. NEVER return them as a single combined string.
Example: if the resume says "Podcasting · Trail running · Travel writing · Cooking"
WRONG: ["Podcasting · Trail running · Travel writing · Cooking"]
CORRECT: ["Podcasting", "Trail running", "Travel writing", "Cooking"]
This applies to ALL array fields: skills, interests, hobbies, strengths, languages, certifications, courses, etc.
Also watch for line breaks in PDF text that split one item across two lines — rejoin them before splitting.
Example: "Strategic Storytelling · Campaign\nAnalytics · Creative Direction" should become ["Strategic Storytelling", "Campaign Analytics", "Creative Direction"]

Return ONLY valid JSON with this structure:

{
  "name": "",
  "email": "",
  "phone": "",
  "location": "",
  "linkedin": "",
  "jobRoles": [],
  "skills": [],
  "experience": [],
  "education": [],
  "projects": [],
  "summary": [],
  "achievements": [],
  "strengths": [],
  "interests": [],
  "profile": [],
  "certifications": [],
  "courses": [],
  "languages": []
}

Resume:
\`\`\`
${chunk}
\`\`\`
`;

        await withRetry(async () => {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" },
                temperature: 0,
                max_tokens: 2500
            });

            const jsonText = response?.choices?.[0]?.message?.content;

            if (!jsonText) {
                throw new Error("AI returned empty response for chunk");
            }

            const raw = JSON.parse(jsonText);
            const parsed = normalizeFields(raw);

            merged.name = merged.name || parsed.name;
            merged.email = merged.email || parsed.email;
            merged.phone = merged.phone || parsed.phone;
            merged.location = merged.location || parsed.location;
            merged.linkedin = merged.linkedin || parsed.linkedin;

            merged.jobRoles = [...new Set([...merged.jobRoles, ...parsed.jobRoles])];
            merged.skills = [...new Set([...merged.skills, ...parsed.skills])];

            merged.experience = [...merged.experience, ...parsed.experience];
            merged.education = [...merged.education, ...parsed.education];
            merged.projects = [...merged.projects, ...parsed.projects];

            merged.summary = [...merged.summary, ...parsed.summary];
            merged.achievements = [...merged.achievements, ...parsed.achievements];
            merged.strengths = [...merged.strengths, ...parsed.strengths];
            merged.interests = [...merged.interests, ...parsed.interests];
            merged.profile = [...merged.profile, ...parsed.profile];
            merged.certifications = [...merged.certifications, ...parsed.certifications];
            merged.courses = [...merged.courses, ...parsed.courses];
            merged.languages = [...merged.languages, ...parsed.languages];
        }, 3, "parseResume chunk").catch(err => {
            console.warn("All retries failed for chunk:", err.message);
        });
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

// Retry parsing AI response with multiple strategies (no re-calling AI)
const parseAiResponseWithRetry = (aiText, maxRetries = 3) => {
    const errors = [];

    // Strategy 1: Direct JSON.parse
    try {
        return JSON.parse(aiText);
    } catch (err) {
        errors.push(`Direct parse: ${err.message}`);
    }

    // Strategy 2: Extract JSON block from markdown code fences
    try {
        const codeFenceMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeFenceMatch) {
            return JSON.parse(codeFenceMatch[1].trim());
        }
    } catch (err) {
        errors.push(`Code fence extract: ${err.message}`);
    }

    // Strategy 3: Find first '{' to last '}' and parse
    try {
        const start = aiText.indexOf('{');
        const end = aiText.lastIndexOf('}');
        if (start !== -1 && end > start) {
            return JSON.parse(aiText.slice(start, end + 1));
        }
    } catch (err) {
        errors.push(`Brace extract: ${err.message}`);
    }

    // Strategy 4: Clean common issues (trailing commas, single-line comments) and retry
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            let cleaned = aiText;
            // Remove markdown code fences
            cleaned = cleaned.replace(/```(?:json)?\s*/g, '').replace(/```/g, '');
            // Extract from first { to last }
            const start = cleaned.indexOf('{');
            const end = cleaned.lastIndexOf('}');
            if (start === -1 || end <= start) continue;
            cleaned = cleaned.slice(start, end + 1);
            // Remove trailing commas before } or ]
            cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
            // Remove single-line comments
            cleaned = cleaned.replace(/\/\/.*$/gm, '');
            // Fix unescaped newlines inside string values
            cleaned = cleaned.replace(/\n/g, '\\n');
            // Try to parse the cleaned version
            return JSON.parse(cleaned);
        } catch (err) {
            errors.push(`Clean attempt ${attempt + 1}: ${err.message}`);
        }
    }

    throw new Error(`All parsing strategies failed: ${errors.join(' | ')}`);
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
    return withRetry(async () => {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0,
            max_tokens: 3500,
        });

        const aiText = response?.choices?.[0]?.message?.content;
        if (!aiText) {
            throw new Error("AI response missing");
        }

        const parsedAtsResult = parseAiResponseWithRetry(aiText);
        const structuredResume = mapParsedResumeToTemplate(resumeJson);
        const createdResume = await atsResumeModel.create({
            user_id: userId,
            resume_json: structuredResume,
            ats_result: parsedAtsResult,
        });

        return {
            resumeId: createdResume._id,
            userId: createdResume.user_id,
            atsResult: parsedAtsResult,
            structuredResume: structuredResume
        };
    }, 3, "analyzeResume").catch(err => {
        console.warn("analyzeResume all retries failed:", err.message);
        return { success: false, data: {}, message: "AI response missing or malformed." };
    });
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
    return withRetry(async () => {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: rewritePrompt }],
            temperature: 0,
            max_tokens: 4500,
        });

        const aiText = response?.choices?.[0]?.message?.content;
        if (!aiText) {
            throw new Error("AI response missing");
        }

        const parsed = parseAiResponseWithRetry(aiText);
        const rewrittenData = parsed.improved_resume;
        const updatedAtsResult = parsed.updated_ats_result;

        if (!rewrittenData || !updatedAtsResult) {
            throw new Error("AI response missing improved_resume or updated_ats_result keys");
        }

        const atsRecord = await atsResumeModel.findById(new ObjectId(String(resumeId)));
        const existingImprovedResumeId = atsRecord?.improved_resume_id;

        let improvedResumeId;
        let savedResume;

        if (existingImprovedResumeId) {
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
            savedResume = await resumeModel.create({
                userId: new ObjectId(String(userId)),
                title: rewrittenData.title || structuredResume.title || "Improved Resume",
                templateId: templateId || "modern",
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
                templateId: savedResume?.templateId || "modern",
                themeColor: savedResume?.themeColor || "#3eb489",
                hiddenSections: savedResume?.hiddenSections || [],
                resumeId: `resume_${atsRecord._id}`,
            },
            updatedAtsResult,
        };
    }, 3, "analyzeResumeWithAI").catch(err => {
        console.warn("analyzeResumeWithAI all retries failed:", err.message);
        return { success: false, data: {}, message: "AI response missing or malformed." };
    });
};







