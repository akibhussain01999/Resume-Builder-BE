/**
 * Maps dynamic resume JSON → builder-ready resume format.
 * Used exclusively by the /upload-and-edit endpoint.
 *
 * Keeps rich object structures (experience, education, projects, certifications)
 * so the builder can render and edit each field individually.
 */

const SECTION_MAPPING = [
    {
        field: "experience",
        keywords: [
            "experience", "work history", "employment", "work experience",
            "professional experience", "career history", "job history",
            "internship", "internships", "training", "apprenticeship",
            "freelance", "contract work", "military", "service history",
            "volunteer", "volunteering",
        ],
    },
    {
        field: "education",
        keywords: [
            "education", "academic", "qualification", "degree",
            "schooling", "university", "college", "academic background",
            "educational background", "academic qualification",
        ],
    },
    {
        field: "projects",
        keywords: [
            "project", "projects", "personal project", "side project",
            "portfolio", "key projects", "academic project",
        ],
    },
    {
        field: "skills",
        keywords: [
            "skill", "skills", "technical skill", "core competenc",
            "key skill", "expertise", "proficienc", "tool", "technolog",
            "tech stack", "software", "programming", "framework",
            "competenc",
        ],
    },
    {
        field: "summary",
        keywords: [
            "summary", "objective", "about me", "about", "overview",
            "professional summary", "career summary", "career objective",
            "personal statement", "executive summary", "introduction",
            "branding statement",
        ],
    },
    {
        field: "profile",
        keywords: [
            "profile", "professional profile", "career profile",
            "personal profile", "personal detail", "personal information",
            "biodata",
        ],
    },
    {
        field: "achievements",
        keywords: [
            "achievement", "accomplishment", "award", "honor",
            "recognition", "accolade",
        ],
    },
    {
        field: "certifications",
        keywords: [
            "certification", "certificate", "licensed", "license",
            "accreditation", "credential",
        ],
    },
    {
        field: "courses",
        keywords: [
            "course", "training course", "workshop", "bootcamp",
            "professional development", "continuing education",
        ],
    },
    {
        field: "languages",
        keywords: [
            "language", "linguistic", "spoken language",
        ],
    },
    {
        field: "interests",
        keywords: [
            "interest", "hobby", "hobbies", "passion", "extracurricular",
            "activities", "leisure",
        ],
    },
    {
        field: "strengths",
        keywords: [
            "strength", "soft skill", "core strength",
            "key strength", "personal strength",
        ],
    },
];

const matchField = (title) => {
    const lower = title.toLowerCase().trim();
    for (const mapping of SECTION_MAPPING) {
        for (const keyword of mapping.keywords) {
            if (lower.includes(keyword)) return mapping.field;
        }
    }
    return null;
};

const getContact = (contacts, type) => {
    const found = contacts.find((c) => c.type === type);
    return found ? found.value : "";
};

// ── Section → rich object mappers ──

const toExperience = (items = []) =>
    items.map((item) => ({
        role: item.title || "",
        company: item.subtitle || "",
        years: item.date || "",
        location: item.location || "",
        bullets: item.details || [],
    }));

const toEducation = (items = []) =>
    items.map((item) => ({
        degree: item.title || "",
        school: item.subtitle || "",
        year: item.date || "",
        details: item.details || [],
    }));

const toProjects = (items = []) =>
    items.map((item) => ({
        name: item.title || "",
        description: Array.isArray(item.details)
            ? item.details.join(" ")
            : item.description || "",
        technologies: item.technologies || [],
        link: item.link || "",
    }));

// Certifications → objects with name / issuer / date
const toCertifications = (section) => {
    if (section.type === "timeline") {
        return (section.items || []).map((item) => ({
            name: item.title || "",
            issuer: item.subtitle || "",
            date: item.date || "",
        }));
    }
    if (section.type === "list") {
        return (section.items || []).map((name) => ({ name, issuer: "", date: "" }));
    }
    if (section.type === "key_value") {
        return (section.items || []).map((kv) => ({
            name: kv.key || "",
            issuer: kv.value || "",
            date: "",
        }));
    }
    return [];
};

const toSkills = (section) => {
    if (section.type === "grouped_list") {
        return (section.groups || []).flatMap((g) => g.items || []);
    }
    if (section.type === "list") return section.items || [];
    if (section.type === "key_value") {
        return (section.items || []).map((kv) => `${kv.key}: ${kv.value}`);
    }
    return [];
};

const toStringArray = (section) => {
    switch (section.type) {
        case "list":        return section.items || [];
        case "grouped_list": return (section.groups || []).flatMap((g) => g.items || []);
        case "key_value":   return (section.items || []).map((kv) => `${kv.key}: ${kv.value}`);
        case "text":        return section.content ? [section.content] : [];
        case "timeline":    return (section.items || []).map((i) => i.title).filter(Boolean);
        default:            return [];
    }
};

// ── Main mapper ──

const mapDynamicToBuilder = (dynamicJson) => {
    const { header, sections } = dynamicJson;
    const contacts = header?.contacts || [];

    const result = {
        name: header?.name || "",
        email: getContact(contacts, "email"),
        phone: getContact(contacts, "phone"),
        location: getContact(contacts, "location"),
        linkedin: getContact(contacts, "linkedin"),
        website: getContact(contacts, "website"),
        jobRoles: [],
        summary: [],
        skills: [],
        experience: [],
        education: [],
        projects: [],
        certifications: [],
        courses: [],
        achievements: [],
        languages: [],
        interests: [],
        strengths: [],
        profile: [],
    };

    const extras = [];

    for (const section of sections) {
        const field = matchField(section.title);

        if (!field) {
            extras.push({ title: section.title, type: section.type, data: section });
            continue;
        }

        switch (field) {
            case "experience":
                if (section.type === "timeline") {
                    result.experience.push(...toExperience(section.items));
                } else {
                    result.experience.push(
                        ...toStringArray(section).map((text) => ({
                            role: text, company: "", years: "", location: "", bullets: [],
                        }))
                    );
                }
                break;

            case "education":
                if (section.type === "timeline") {
                    result.education.push(...toEducation(section.items));
                } else {
                    result.education.push(
                        ...toStringArray(section).map((text) => ({
                            degree: text, school: "", year: "", details: [],
                        }))
                    );
                }
                break;

            case "projects":
                if (section.type === "cards" || section.type === "timeline") {
                    result.projects.push(...toProjects(section.items));
                } else if (section.type === "grouped_list") {
                    for (const group of (section.groups || [])) {
                        result.projects.push({
                            name: group.label || "",
                            description: (group.items || []).join(", "),
                            technologies: [],
                            link: "",
                        });
                    }
                } else {
                    result.projects.push(
                        ...toStringArray(section).map((text) => ({
                            name: text, description: "", technologies: [], link: "",
                        }))
                    );
                }
                break;

            case "skills":
                result.skills.push(...toSkills(section));
                break;

            case "certifications":
            case "courses":
                result[field].push(...toCertifications(section));
                break;

            case "languages":
                if (section.type === "key_value") {
                    result.languages.push(
                        ...(section.items || []).map((kv) => `${kv.key} (${kv.value})`)
                    );
                } else {
                    result.languages.push(...toStringArray(section));
                }
                break;

            case "summary":
            case "profile":
            case "achievements":
            case "strengths":
            case "interests":
                result[field].push(...toStringArray(section));
                break;

            default:
                extras.push({ title: section.title, type: section.type, data: section });
        }
    }

    result.skills = [...new Set(result.skills)];

    if (result.experience.length > 0) {
        result.jobRoles = [
            ...new Set(result.experience.map((e) => e.role).filter(Boolean)),
        ];
    }

    if (extras.length > 0) result.extras = extras;

    return result;
};

module.exports = { mapDynamicToBuilder };
