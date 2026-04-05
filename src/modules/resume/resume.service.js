const { StatusCodes } = require('http-status-codes');
const Resume = require('./resume.model');
const ApiError = require('../../utils/ApiError');
const { parsePagination, parseSort } = require('../../utils/query');
const logger = require('../../config/logger');

const listResumes = async (userId, query) => {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, ['createdAt', 'updatedAt', 'title']);

  const [items, total] = await Promise.all([
    Resume.find({ userId }).sort(sort).skip(skip).limit(limit),
    Resume.countDocuments({ userId })
  ]);

  return {
    items,
    meta: { page, limit, total }
  };
};

const createResume = async (userId, payload) => {
  const resume = await Resume.create({
    userId,
    title: payload.title,
    templateId: payload.templateId,
    themeColor: payload.themeColor,
    hiddenSections: payload.hiddenSections || [],
    data: payload.data || {}
  });

  logger.info(`Resume created: ${resume.resumeId} for user ${userId}`);

  return resume;
};

const getResumeById = async (userId, id) => {
  const resume = await Resume.findOne({ resumeId: id, userId });

  if (!resume) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'RESUME_NOT_FOUND', 'Resume not found');
  }

  return resume;
};

const updateResume = async (userId, id, payload) => {
  const resume = await Resume.findOneAndUpdate(
    { resumeId: id, userId },
    { $set: payload },
    { new: true }
  );

  if (!resume) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'RESUME_NOT_FOUND', 'Resume not found');
  }

  logger.info(`Resume updated: ${id} for user ${userId}`);

  return resume;
};

const deleteResume = async (userId, id) => {
  const deleted = await Resume.findOneAndDelete({ resumeId: id, userId });

  if (!deleted) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'RESUME_NOT_FOUND', 'Resume not found');
  }

  logger.info(`Resume deleted: ${id} for user ${userId}`);

  return deleted;
};

module.exports = {
  listResumes,
  createResume,
  getResumeById,
  updateResume,
  deleteResume
};
