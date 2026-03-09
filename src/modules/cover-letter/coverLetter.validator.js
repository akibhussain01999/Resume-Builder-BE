const Joi = require('joi');
const coverLetterPublicId = Joi.string().pattern(/^cl_[a-zA-Z0-9]+$/);

const listCoverLettersSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    sort: Joi.string().pattern(/^[a-zA-Z]+:(asc|desc)$/)
  }).default({})
});

const createCoverLetterSchema = Joi.object({
  body: Joi.object({
    title: Joi.string().max(140).required(),
    templateId: Joi.string().required(),
    themeColor: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).default('#1e3a5f'),
    data: Joi.object().unknown(true).default({})
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const coverLetterIdParamSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    id: coverLetterPublicId.required()
  }).required(),
  query: Joi.object({}).default({})
});

const updateCoverLetterSchema = Joi.object({
  body: Joi.object({
    title: Joi.string().max(140),
    templateId: Joi.string(),
    themeColor: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
    data: Joi.object().unknown(true)
  })
    .min(1)
    .required(),
  params: Joi.object({
    id: coverLetterPublicId.required()
  }).required(),
  query: Joi.object({}).default({})
});

module.exports = {
  listCoverLettersSchema,
  createCoverLetterSchema,
  coverLetterIdParamSchema,
  updateCoverLetterSchema
};
