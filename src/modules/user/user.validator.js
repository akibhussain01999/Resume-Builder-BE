const Joi = require('joi');

const updateProfileSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().min(2).max(100),
    marketingOptIn: Joi.boolean()
  }).min(1).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const changePasswordSchema = Joi.object({
  body: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).max(128).required()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const deleteAccountSchema = Joi.object({
  body: Joi.object({
    password: Joi.string().required()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

module.exports = { updateProfileSchema, changePasswordSchema, deleteAccountSchema };
