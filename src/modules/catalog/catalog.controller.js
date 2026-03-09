const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const catalogService = require('./catalog.service');

const listTemplates = asyncHandler(async (req, res) => {
  const items = await catalogService.listTemplates(req.query);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    data: items
  });
});

const listTemplateCategories = asyncHandler(async (req, res) => {
  const items = await catalogService.listTemplateCategories();
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    data: items
  });
});

const listResumeExamples = asyncHandler(async (req, res) => {
  const items = await catalogService.listResumeExamples(req.query);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    data: items
  });
});

const createTemplateCategory = asyncHandler(async (req, res) => {
  const item = await catalogService.createTemplateCategory(req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Template category created',
    data: item
  });
});

const createTemplate = asyncHandler(async (req, res) => {
  const item = await catalogService.createTemplate(req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Template created',
    data: item
  });
});

const createResumeExample = asyncHandler(async (req, res) => {
  const item = await catalogService.createResumeExample(req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'Resume example saved',
    data: item
  });
});

const createResumeExamplesBulk = asyncHandler(async (req, res) => {
  const result = await catalogService.createResumeExamplesBulk(req.body.items);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'Resume examples saved',
    data: result
  });
});

module.exports = {
  listTemplates,
  listTemplateCategories,
  listResumeExamples,
  createTemplateCategory,
  createTemplate,
  createResumeExample,
  createResumeExamplesBulk
};
