const Joi = require('joi');
const resumePublicId = Joi.string().pattern(/^resume_[a-zA-Z0-9]+$/);

const listResumesSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    sort: Joi.string().pattern(/^[a-zA-Z]+:(asc|desc)$/)
  }).default({})
});

const createResumeSchema = Joi.object({
  body: Joi.object({
    title: Joi.string().max(140).required(),
    templateId: Joi.string().required(),
    themeColor: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).default('#1e3a5f'),
    hiddenSections: Joi.array().items(Joi.string()).default([]),
    data: Joi.object().unknown(true).default({})
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const resumeIdParamSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    id: resumePublicId.required()
  }).required(),
  query: Joi.object({}).default({})
});

const updateResumeSchema = Joi.object({
  body: Joi.object({
    title: Joi.string().max(140),
    templateId: Joi.string(),
    themeColor: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
    hiddenSections: Joi.array().items(Joi.string()),
    data: Joi.object().unknown(true)
  })
    .min(1)
    .required(),
  params: Joi.object({
    id: resumePublicId.required()
  }).required(),
  query: Joi.object({}).default({})
});

module.exports = {
  listResumesSchema,
  createResumeSchema,
  resumeIdParamSchema,
  updateResumeSchema
};
