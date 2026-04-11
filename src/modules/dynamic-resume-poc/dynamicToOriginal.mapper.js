/**
 * Maps dynamic resume JSON → original fixed resume JSON format.
 *
 * Dynamic JSON (input):  { header, sections[] }
 * Original JSON (output): { name, email, phone, ..., experience[], education[], skills[], ... }
 *
 * Any sections that don't match a known field go into `extras[]` so nothing is ever lost.
 */

// Keywords to match section titles → original fields
// Order matters: first match wins. More specific patterns come first.
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

// Match a section title to an original field
const matchSectionToField = (title) => {
    const lower = title.toLowerCase().trim();
    for (const mapping of SECTION_MAPPING) {
        for (const keyword of mapping.keywords) {
            if (lower.includes(keyword)) {
                return mapping.field;
            }
        }
    }
    return null; // no match → goes to extras
};

// Get contact value by type from header
const getContact = (contacts, type) => {
    const found = contacts.find((c) => c.type === type);
    return found ? found.value : "";
};

// Transform a timeline section → experience format: { role, company, years, bullets }
const timelineToExperience = (items) => {
    return (items || []).map((item) => ({
        role: item.title || "",
        company: item.subtitle || "",
        years: item.date || "",
        location: item.location || "",
        bullets: item.details || [],
    }));
};

// Transform a timeline section → education format: { degree, school, year }
const timelineToEducation = (items) => {
    return (items || []).map((item) => ({
        degree: item.title || "",
        school: item.subtitle || "",
        year: item.date || "",
        details: item.details || [],
    }));
};

// Transform cards section → projects format: { name, description, link }
const cardsToProjects = (items) => {
    return (items || []).map((item) => ({
        name: item.title || "",
        description: item.description || "",
        technologies: item.technologies || [],
        link: item.link || "",
    }));
};

// Flatten any section into a string array (works for list, grouped_list, key_value, text)
const sectionToStringArray = (section) => {
    switch (section.type) {
        case "list":
            return section.items || [];

        case "grouped_list":
            // Flatten all groups into one array
            return (section.groups || []).flatMap((g) => g.items || []);

        case "key_value":
            return (section.items || []).map((kv) => `${kv.key}: ${kv.value}`);

        case "text":
            return section.content ? [section.content] : [];

        case "timeline":
            // Flatten timeline details into strings
            return (section.items || []).flatMap((item) => item.details || []);

        case "cards":
            return (section.items || []).map(
                (item) => `${item.title}${item.description ? ": " + item.description : ""}`
            );

        default:
            return [];
    }
};

// Extract skills preserving groups if present
const sectionToSkills = (section) => {
    if (section.type === "grouped_list") {
        // Flatten all groups into a single skills array
        return (section.groups || []).flatMap((g) => g.items || []);
    }
    if (section.type === "list") {
        return section.items || [];
    }
    return sectionToStringArray(section);
};

// Main mapper: dynamic JSON → original resume JSON
const mapDynamicToOriginal = (dynamicJson) => {
    const { header, sections } = dynamicJson;
    const contacts = header?.contacts || [];

    // Build the original format
    const original = {
        name: header?.name || "",
        email: getContact(contacts, "email"),
        phone: getContact(contacts, "phone"),
        location: getContact(contacts, "location"),
        linkedin: getContact(contacts, "linkedin"),
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
        languages: [],
    };

    // Track which sections couldn't be mapped
    const extras = [];
    // Track which fields already received data (to avoid duplicates)
    const usedFields = new Set();

    for (const section of sections) {
        const field = matchSectionToField(section.title);

        if (!field) {
            // No match — preserve in extras
            extras.push({
                title: section.title,
                type: section.type,
                order: section.order,
                data: section,
            });
            continue;
        }

        // Map based on target field + section type
        switch (field) {
            case "experience":
                if (section.type === "timeline") {
                    original.experience.push(...timelineToExperience(section.items));
                } else {
                    original.experience.push(
                        ...sectionToStringArray(section).map((text) => ({
                            role: "",
                            company: "",
                            years: "",
                            bullets: [text],
                        }))
                    );
                }
                break;

            case "education":
                if (section.type === "timeline") {
                    original.education.push(...timelineToEducation(section.items));
                } else {
                    original.education.push(
                        ...sectionToStringArray(section).map((text) => ({
                            degree: text,
                            school: "",
                            year: "",
                        }))
                    );
                }
                break;

            case "projects":
                if (section.type === "cards") {
                    original.projects.push(...cardsToProjects(section.items));
                } else if (section.type === "grouped_list") {
                    // Group label = project category name, items = project descriptions
                    for (const group of (section.groups || [])) {
                        original.projects.push({
                            name: group.label || "",
                            description: (group.items || []).join(", "),
                            technologies: [],
                            link: "",
                        });
                    }
                } else if (section.type === "timeline") {
                    original.projects.push(
                        ...(section.items || []).map((item) => ({
                            name: item.title || "",
                            description: (item.details || []).join(". "),
                            technologies: [],
                            link: "",
                        }))
                    );
                } else if (section.type === "list") {
                    original.projects.push(
                        ...(section.items || []).map((text) => ({
                            name: text,
                            description: "",
                            technologies: [],
                            link: "",
                        }))
                    );
                } else {
                    original.projects.push(
                        ...sectionToStringArray(section).map((text) => ({
                            name: text,
                            description: "",
                            technologies: [],
                            link: "",
                        }))
                    );
                }
                break;

            case "skills":
                original.skills.push(...sectionToSkills(section));
                break;

            case "summary":
            case "profile":
            case "achievements":
            case "strengths":
            case "interests":
            case "certifications":
            case "courses":
                if (section.type === "timeline") {
                    original[field].push(
                        ...(section.items || []).map((item) => {
                            const parts = [item.title].filter(Boolean);
                            if (item.subtitle) parts.push(item.subtitle);
                            if (item.date) parts.push(`(${item.date})`);
                            return parts.join(" — ");
                        })
                    );
                } else {
                    original[field].push(...sectionToStringArray(section));
                }
                break;

            case "languages":
                if (section.type === "key_value") {
                    original.languages.push(
                        ...(section.items || []).map((kv) => `${kv.key} (${kv.value})`)
                    );
                } else {
                    original.languages.push(...sectionToStringArray(section));
                }
                break;

            default:
                extras.push({
                    title: section.title,
                    type: section.type,
                    order: section.order,
                    data: section,
                });
        }
    }

    // Deduplicate skills
    original.skills = [...new Set(original.skills)];

    // Try to extract jobRoles from experience titles
    if (original.experience.length > 0) {
        original.jobRoles = [
            ...new Set(
                original.experience
                    .map((exp) => exp.role)
                    .filter(Boolean)
            ),
        ];
    }

    // Attach extras so nothing is lost
    if (extras.length > 0) {
        original.extras = extras;
    }

    return original;
};

module.exports = { mapDynamicToOriginal };
