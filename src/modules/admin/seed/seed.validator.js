const Joi = require('joi');

const roleSchema = Joi.object({
  label: Joi.string().required(),
  slug: Joi.string().required()
});

const templateCategorySchema = Joi.object({
  id: Joi.string().required(),
  label: Joi.string().required(),
  icon: Joi.string().allow('').optional(),
  color: Joi.string().allow('').optional(),
  templates: Joi.array().items(Joi.string()).default([]),
  roles: Joi.array().items(roleSchema).default([])
});

const templateSchema = Joi.object({
  id: Joi.string().required(),
  type: Joi.string().valid('resume', 'cover-letter').required(),
  name: Joi.string().required(),
  category: Joi.string().required(),
  previewUrl: Joi.string().required()
});

const seedTemplateCategoriesSchema = Joi.object({
  body: Joi.object({
    categories: Joi.array().items(templateCategorySchema).min(1).required()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const seedTemplatesSchema = Joi.object({
  body: Joi.object({
    templates: Joi.array().items(templateSchema).min(1).required()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const seedResumeExamplesSchema = Joi.object({
  body: Joi.alternatives()
    .try(
      Joi.object({
        examples: Joi.array().items(Joi.object().unknown(true)).min(1).required()
      }),
      Joi.object({
        resumeExamples: Joi.array().items(Joi.object().unknown(true)).min(1).required()
      }),
      Joi.array().items(Joi.object().unknown(true)).min(1)
    )
    .required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

module.exports = {
  seedTemplateCategoriesSchema,
  seedTemplatesSchema,
  seedResumeExamplesSchema
};
