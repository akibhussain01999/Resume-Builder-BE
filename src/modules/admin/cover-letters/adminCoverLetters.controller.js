const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../../../utils/asyncHandler');
const { sendSuccess } = require('../../../utils/response');
const adminCoverLettersService = require('./adminCoverLetters.service');

const listCoverLetters = asyncHandler(async (req, res) => {
  const result = await adminCoverLettersService.listCoverLetters(req.query);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    data: result.items,
    meta: result.meta
  });
});

const getCoverLetter = asyncHandler(async (req, res) => {
  const item = await adminCoverLettersService.getCoverLetterById(req.params.id);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    data: item
  });
});

const deleteCoverLetter = asyncHandler(async (req, res) => {
  const result = await adminCoverLettersService.deleteCoverLetter(req.params.id);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'Cover letter deleted',
    data: result
  });
});

module.exports = { listCoverLetters, getCoverLetter, deleteCoverLetter };
