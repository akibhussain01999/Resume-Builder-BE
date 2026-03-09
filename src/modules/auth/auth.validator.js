const Joi = require('joi');

const registerSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(128).required(),
    marketingOptIn: Joi.boolean().default(false)
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const loginSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const verifyEmailSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().pattern(/^\d{6}$/).required()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

module.exports = {
  registerSchema,
  loginSchema,
  verifyEmailSchema
};
