const { StatusCodes } = require('http-status-codes');
const CoverLetter = require('../../cover-letter/coverLetter.model');
const ApiError = require('../../../utils/ApiError');
const { parsePagination, parseSort } = require('../../../utils/query');
const logger = require('../../../config/logger');

const listCoverLetters = async (query) => {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, ['createdAt', 'updatedAt', 'title']);

  const filter = {};
  if (query.userId) filter.userId = query.userId;
  if (query.templateId) filter.templateId = query.templateId;
  if (query.search) filter.title = new RegExp(query.search, 'i');

  const [items, total] = await Promise.all([
    CoverLetter.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email'),
    CoverLetter.countDocuments(filter)
  ]);

  return { items, meta: { page, limit, total } };
};

const getCoverLetterById = async (id) => {
  const item = await CoverLetter.findOne({ coverLetterId: id }).populate('userId', 'name email');
  if (!item) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'COVER_LETTER_NOT_FOUND', 'Cover letter not found');
  }
  return item;
};

const deleteCoverLetter = async (id) => {
  const item = await CoverLetter.findOneAndDelete({ coverLetterId: id });
  if (!item) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'COVER_LETTER_NOT_FOUND', 'Cover letter not found');
  }
  logger.info(`Admin deleted cover letter: ${id}`);
  return { deleted: true, coverLetterId: id };
};

module.exports = { listCoverLetters, getCoverLetterById, deleteCoverLetter };
