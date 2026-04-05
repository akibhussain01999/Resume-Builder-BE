const { StatusCodes } = require('http-status-codes');
const Resume = require('../../resume/resume.model');
const ApiError = require('../../../utils/ApiError');
const { parsePagination, parseSort } = require('../../../utils/query');
const logger = require('../../../config/logger');

const listResumes = async (query) => {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, ['createdAt', 'updatedAt', 'title']);

  const filter = {};
  if (query.userId) filter.userId = query.userId;
  if (query.templateId) filter.templateId = query.templateId;
  if (query.search) filter.title = new RegExp(query.search, 'i');

  const [items, total] = await Promise.all([
    Resume.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email'),
    Resume.countDocuments(filter)
  ]);

  return { items, meta: { page, limit, total } };
};

const getResumeById = async (id) => {
  const resume = await Resume.findOne({ resumeId: id }).populate('userId', 'name email');
  if (!resume) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'RESUME_NOT_FOUND', 'Resume not found');
  }
  return resume;
};

const deleteResume = async (id) => {
  const resume = await Resume.findOneAndDelete({ resumeId: id });
  if (!resume) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'RESUME_NOT_FOUND', 'Resume not found');
  }
  logger.info(`Admin deleted resume: ${id}`);
  return { deleted: true, resumeId: id };
};

module.exports = { listResumes, getResumeById, deleteResume };
