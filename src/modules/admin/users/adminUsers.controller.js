const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../../../utils/asyncHandler');
const { sendSuccess } = require('../../../utils/response');
const adminUsersService = require('./adminUsers.service');

const listUsers = asyncHandler(async (req, res) => {
  const result = await adminUsersService.listUsers(req.query);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    data: result.items,
    meta: result.meta
  });
});

const getUser = asyncHandler(async (req, res) => {
  const result = await adminUsersService.getUserById(req.params.id);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    data: result
  });
});

const activateUser = asyncHandler(async (req, res) => {
  const user = await adminUsersService.setUserActive(req.params.id, true);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'User activated',
    data: user
  });
});

const deactivateUser = asyncHandler(async (req, res) => {
  const user = await adminUsersService.setUserActive(req.params.id, false);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'User deactivated',
    data: user
  });
});

const deleteUser = asyncHandler(async (req, res) => {
  const result = await adminUsersService.deleteUser(req.params.id);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'User and all their documents deleted',
    data: result
  });
});

module.exports = { listUsers, getUser, activateUser, deactivateUser, deleteUser };
