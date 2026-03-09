const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const coverLetterService = require('./coverLetter.service');

const listCoverLetters = asyncHandler(async (req, res) => {
  const result = await coverLetterService.listCoverLetters(req.user.id, req.query);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    data: result.items,
    meta: result.meta
  });
});

const createCoverLetter = asyncHandler(async (req, res) => {
  const item = await coverLetterService.createCoverLetter(req.user.id, req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Cover letter created',
    data: item
  });
});

const getCoverLetter = asyncHandler(async (req, res) => {
  const item = await coverLetterService.getCoverLetterById(req.user.id, req.params.id);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    data: item
  });
});

const updateCoverLetter = asyncHandler(async (req, res) => {
  const item = await coverLetterService.updateCoverLetter(req.user.id, req.params.id, req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'Cover letter updated',
    data: item
  });
});

const deleteCoverLetter = asyncHandler(async (req, res) => {
  const item = await coverLetterService.deleteCoverLetter(req.user.id, req.params.id);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'Cover letter deleted',
    data: item
  });
});

module.exports = {
  listCoverLetters,
  createCoverLetter,
  getCoverLetter,
  updateCoverLetter,
  deleteCoverLetter
};
