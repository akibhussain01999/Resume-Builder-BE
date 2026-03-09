const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../../../utils/asyncHandler');
const { sendSuccess } = require('../../../utils/response');
const seedService = require('./seed.service');

const seedTemplateCategories = asyncHandler(async (req, res) => {
  const result = await seedService.seedTemplateCategories(req.body.categories);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'Template categories seeded',
    data: result
  });
});

const seedTemplates = asyncHandler(async (req, res) => {
  const result = await seedService.seedTemplates(req.body.templates);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'Templates seeded',
    data: result
  });
});

const seedResumeExamples = asyncHandler(async (req, res) => {
  const result = await seedService.seedResumeExamples(req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'Resume examples seeded',
    data: result
  });
});

module.exports = {
  seedTemplateCategories,
  seedTemplates,
  seedResumeExamples
};
