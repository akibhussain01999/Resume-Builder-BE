const Joi = require('joi');
const resumePublicId = Joi.string().pattern(/^resume_[a-zA-Z0-9]+$/);
const coverLetterPublicId = Joi.string().pattern(/^cl_[a-zA-Z0-9]+$/);

const resumePdfSchema = Joi.object({
  body: Joi.object({
    resumeId: resumePublicId.required()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const coverLetterPdfSchema = Joi.object({
  body: Joi.object({
    coverLetterId: coverLetterPublicId.required()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

module.exports = {
  resumePdfSchema,
  coverLetterPdfSchema
};
