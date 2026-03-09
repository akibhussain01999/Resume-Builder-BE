const express = require('express');
const controller = require('./catalog.controller');
const validate = require('../../middlewares/validate.middleware');
const {
  listTemplatesSchema,
  listResumeExamplesSchema,
  createTemplateCategorySchema,
  createTemplateSchema,
  createResumeExampleSchema,
  createResumeExamplesBulkSchema
} = require('./catalog.validator');

const router = express.Router();

router.get('/templates', validate(listTemplatesSchema), controller.listTemplates);
router.post('/templates', validate(createTemplateSchema), controller.createTemplate);
router.get('/template-categories', controller.listTemplateCategories);
router.post(
  '/template-categories',
  validate(createTemplateCategorySchema),
  controller.createTemplateCategory
);
router.get('/resume-examples', validate(listResumeExamplesSchema), controller.listResumeExamples);
router.post('/resume-examples', validate(createResumeExampleSchema), controller.createResumeExample);
router.post(
  '/resume-examples/bulk',
  validate(createResumeExamplesBulkSchema),
  controller.createResumeExamplesBulk
);

module.exports = router;
