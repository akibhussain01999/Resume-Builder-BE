const { StatusCodes } = require('http-status-codes');
const CoverLetter = require('./coverLetter.model');
const ApiError = require('../../utils/ApiError');
const { parsePagination, parseSort } = require('../../utils/query');
const logger = require('../../config/logger');

const listCoverLetters = async (userId, query) => {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, ['createdAt', 'updatedAt', 'title']);

  const [items, total] = await Promise.all([
    CoverLetter.find({ userId }).sort(sort).skip(skip).limit(limit),
    CoverLetter.countDocuments({ userId })
  ]);

  return {
    items,
    meta: { page, limit, total }
  };
};

const createCoverLetter = async (userId, payload) => {
  const item = await CoverLetter.create({
    userId,
    title: payload.title,
    templateId: payload.templateId,
    themeColor: payload.themeColor,
    data: payload.data || {}
  });

  logger.info(`Cover letter created: ${item.coverLetterId} for user ${userId}`);

  return item;
};

const getCoverLetterById = async (userId, id) => {
  const item = await CoverLetter.findOne({ coverLetterId: id, userId });

  if (!item) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'COVER_LETTER_NOT_FOUND', 'Cover letter not found');
  }

  return item;
};

const updateCoverLetter = async (userId, id, payload) => {
  const item = await CoverLetter.findOneAndUpdate(
    { coverLetterId: id, userId },
    { $set: payload },
    { new: true }
  );

  if (!item) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'COVER_LETTER_NOT_FOUND', 'Cover letter not found');
  }

  logger.info(`Cover letter updated: ${id} for user ${userId}`);

  return item;
};

const deleteCoverLetter = async (userId, id) => {
  const item = await CoverLetter.findOneAndDelete({ coverLetterId: id, userId });

  if (!item) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'COVER_LETTER_NOT_FOUND', 'Cover letter not found');
  }

  logger.info(`Cover letter deleted: ${id} for user ${userId}`);

  return item;
};

module.exports = {
  listCoverLetters,
  createCoverLetter,
  getCoverLetterById,
  updateCoverLetter,
  deleteCoverLetter
};
