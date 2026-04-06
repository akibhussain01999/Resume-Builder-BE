const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const userService = require('./user.service');

const getProfile = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.user.id);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    data: user
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'Profile updated successfully',
    data: user
  });
});

const changePassword = asyncHandler(async (req, res) => {
  await userService.changePassword(req.user.id, req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'Password changed successfully. Please log in again.',
    data: {}
  });
});

const deleteAccount = asyncHandler(async (req, res) => {
  await userService.deleteAccount(req.user.id, req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'Account deleted successfully',
    data: {}
  });
});

module.exports = { getProfile, updateProfile, changePassword, deleteAccount };
