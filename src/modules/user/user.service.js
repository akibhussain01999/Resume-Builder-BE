const { StatusCodes } = require('http-status-codes');
const User = require('./user.model');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');

const getProfile = async (userId) => {
  const user = await User.findById(userId).select(
    '-passwordHash -emailVerificationTokenHash -emailVerificationTokenExpiresAt -refreshTokenVersion'
  );
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'USER_NOT_FOUND', 'User not found');
  }
  return user;
};

const updateProfile = async (userId, payload) => {
  const allowed = {};
  if (payload.name !== undefined) allowed.name = payload.name;
  if (payload.marketingOptIn !== undefined) allowed.marketingOptIn = payload.marketingOptIn;

  const user = await User.findByIdAndUpdate(userId, { $set: allowed }, { new: true }).select(
    '-passwordHash -emailVerificationTokenHash -emailVerificationTokenExpiresAt -refreshTokenVersion'
  );

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'USER_NOT_FOUND', 'User not found');
  }

  logger.info(`User updated profile: ${user.email}`);
  return user;
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'USER_NOT_FOUND', 'User not found');
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'INVALID_PASSWORD', 'Current password is incorrect');
  }

  user.passwordHash = await User.hashPassword(newPassword);
  user.refreshTokenVersion += 1; // invalidate all existing sessions
  await user.save();

  logger.info(`User changed password: ${user.email}`);
  return { ok: true };
};

const deleteAccount = async (userId, { password }) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'USER_NOT_FOUND', 'User not found');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'INVALID_PASSWORD', 'Password is incorrect');
  }

  await User.findByIdAndDelete(userId);
  logger.info(`User deleted account: ${user.email}`);
  return { ok: true };
};

module.exports = { getProfile, updateProfile, changePassword, deleteAccount };
