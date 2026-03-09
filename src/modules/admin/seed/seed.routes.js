const express = require('express');
const controller = require('./seed.controller');
const validate = require('../../../middlewares/validate.middleware');
const adminSeedKeyMiddleware = require('../../../middlewares/adminSeedKey.middleware');
const {
  seedTemplateCategoriesSchema,
  seedTemplatesSchema,
  seedResumeExamplesSchema
} = require('./seed.validator');

const router = express.Router();

router.use(adminSeedKeyMiddleware);
router.post('/template-categories', validate(seedTemplateCategoriesSchema), controller.seedTemplateCategories);
router.post('/templates', validate(seedTemplatesSchema), controller.seedTemplates);
router.post('/resume-examples', validate(seedResumeExamplesSchema), controller.seedResumeExamples);

module.exports = router;
