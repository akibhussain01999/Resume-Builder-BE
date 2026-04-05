const { StatusCodes } = require('http-status-codes');
const User = require('../../user/user.model');
const Resume = require('../../resume/resume.model');
const CoverLetter = require('../../cover-letter/coverLetter.model');
const ApiError = require('../../../utils/ApiError');
const { parsePagination, parseSort } = require('../../../utils/query');
const logger = require('../../../config/logger');

const listUsers = async (query) => {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, ['createdAt', 'updatedAt', 'name', 'email']);

  const filter = {};
  if (query.search) {
    const rx = new RegExp(query.search, 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  if (query.verified !== undefined) {
    filter.isEmailVerified = query.verified === 'true';
  }

  const [items, total] = await Promise.all([
    User.find(filter).sort(sort).skip(skip).limit(limit).select('-passwordHash -emailVerificationTokenHash -emailVerificationTokenExpiresAt'),
    User.countDocuments(filter)
  ]);

  return { items, meta: { page, limit, total } };
};

const getUserById = async (id) => {
  const user = await User.findById(id).select('-passwordHash -emailVerificationTokenHash -emailVerificationTokenExpiresAt');
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'USER_NOT_FOUND', 'User not found');
  }

  const [resumes, coverLetters] = await Promise.all([
    Resume.find({ userId: id }).select('resumeId title templateId createdAt updatedAt'),
    CoverLetter.find({ userId: id }).select('coverLetterId title templateId createdAt updatedAt')
  ]);

  return { user, resumes, coverLetters };
};

const setUserActive = async (id, isActive) => {
  const user = await User.findByIdAndUpdate(
    id,
    { isEmailVerified: isActive },
    { new: true }
  ).select('-passwordHash -emailVerificationTokenHash');

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'USER_NOT_FOUND', 'User not found');
  }

  logger.info(`Admin ${isActive ? 'activated' : 'deactivated'} user: ${user.email}`);
  return user;
};

const deleteUser = async (id) => {
  const user = await User.findByIdAndDelete(id);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'USER_NOT_FOUND', 'User not found');
  }

  // Also delete their resumes and cover letters
  await Promise.all([
    Resume.deleteMany({ userId: id }),
    CoverLetter.deleteMany({ userId: id })
  ]);

  logger.info(`Admin deleted user: ${user.email} and all their documents`);
  return { deleted: true, email: user.email };
};

module.exports = { listUsers, getUserById, setUserActive, deleteUser };
