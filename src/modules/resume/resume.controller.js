const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const resumeService = require('./resume.service');

const listResumes = asyncHandler(async (req, res) => {
  const result = await resumeService.listResumes(req.user.id, req.query);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    data: result.items,
    meta: result.meta
  });
});

const createResume = asyncHandler(async (req, res) => {
  const item = await resumeService.createResume(req.user.id, req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Resume created',
    data: item
  });
});

const getResume = asyncHandler(async (req, res) => {
  const item = await resumeService.getResumeById(req.user.id, req.params.id);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    data: item
  });
});

const updateResume = asyncHandler(async (req, res) => {
  const item = await resumeService.updateResume(req.user.id, req.params.id, req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'Resume updated',
    data: item
  });
});

const deleteResume = asyncHandler(async (req, res) => {
  const item = await resumeService.deleteResume(req.user.id, req.params.id);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'Resume deleted',
    data: item
  });
});

module.exports = {
  listResumes,
  createResume,
  getResume,
  updateResume,
  deleteResume
};
