const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../../../utils/asyncHandler');
const { sendSuccess } = require('../../../utils/response');
const adminResumesService = require('./adminResumes.service');

const listResumes = asyncHandler(async (req, res) => {
  const result = await adminResumesService.listResumes(req.query);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    data: result.items,
    meta: result.meta
  });
});

const getResume = asyncHandler(async (req, res) => {
  const resume = await adminResumesService.getResumeById(req.params.id);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    data: resume
  });
});

const deleteResume = asyncHandler(async (req, res) => {
  const result = await adminResumesService.deleteResume(req.params.id);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'Resume deleted',
    data: result
  });
});

module.exports = { listResumes, getResume, deleteResume };
