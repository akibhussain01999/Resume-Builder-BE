const Joi = require('joi');

const listTemplatesSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({
    type: Joi.string().valid('resume', 'cover-letter')
  }).default({})
});

const listResumeExamplesSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({
    role: Joi.string(),
    limit: Joi.number().integer().min(1).max(100)
  }).default({})
});

const roleSchema = Joi.object({
  label: Joi.string().required(),
  slug: Joi.string().required()
});

const createTemplateCategorySchema = Joi.object({
  body: Joi.object({
    id: Joi.string().required(),
    label: Joi.string().required(),
    icon: Joi.string().allow('').optional(),
    color: Joi.string().allow('').optional(),
    templates: Joi.array().items(Joi.string()).default([]),
    roles: Joi.array().items(roleSchema).default([])
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const createTemplateSchema = Joi.object({
  body: Joi.object({
    id: Joi.string().required(),
    type: Joi.string().valid('resume', 'cover-letter').required(),
    name: Joi.string().required(),
    category: Joi.string().required(),
    previewUrl: Joi.string().required()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const resumeExampleBodySchema = Joi.object({
  id: Joi.string().required(),
  label: Joi.string().required(),
  role: Joi.string().optional(),
  count: Joi.number().integer().min(0).optional(),
  color: Joi.string().allow('').optional(),
  colorLight: Joi.string().allow('').optional(),
  name: Joi.string().allow('').optional(),
  title: Joi.string().allow('').optional(),
  location: Joi.string().allow('').optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string().allow('').optional(),
  linkedin: Joi.string().allow('').optional(),
  summary: Joi.string().allow('').optional(),
  skills: Joi.array().items(Joi.string()).optional(),
  experience: Joi.array()
    .items(
      Joi.object({
        role: Joi.string().required(),
        company: Joi.string().required(),
        years: Joi.string().required(),
        bullets: Joi.array().items(Joi.string()).default([])
      })
    )
    .optional(),
  education: Joi.array()
    .items(
      Joi.object({
        degree: Joi.string().required(),
        school: Joi.string().required(),
        year: Joi.string().required()
      })
    )
    .optional(),
  certifications: Joi.array().items(Joi.string()).optional(),
  courses: Joi.array().items(Joi.string()).optional(),
  languages: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        level: Joi.string().required()
      })
    )
    .optional(),
  strengths: Joi.array().items(Joi.string()).optional(),
  hobbies: Joi.array().items(Joi.string()).optional(),
  achievements: Joi.array()
    .items(
      Joi.object({
        title: Joi.string().required(),
        description: Joi.string().required()
      })
    )
    .optional(),
  projects: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        description: Joi.string().required()
      })
    )
    .optional()
})
  .unknown(true)
  .required();

const createResumeExampleSchema = Joi.object({
  body: resumeExampleBodySchema,
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const createResumeExamplesBulkSchema = Joi.object({
  body: Joi.object({
    items: Joi.array().items(resumeExampleBodySchema).min(1).max(500).required()
  })
    .unknown(true)
    .required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

module.exports = {
  listTemplatesSchema,
  listResumeExamplesSchema,
  createTemplateCategorySchema,
  createTemplateSchema,
  createResumeExampleSchema,
  createResumeExamplesBulkSchema
};
