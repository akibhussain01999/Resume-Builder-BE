const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../../../utils/asyncHandler');
const { sendSuccess } = require('../../../utils/response');
const adminAuthService = require('./adminAuth.service');

const login = asyncHandler(async (req, res) => {
  const result = await adminAuthService.login(req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'Login successful',
    data: result
  });
});

const logout = asyncHandler(async (req, res) => {
  await adminAuthService.logout(req.admin.id);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'Logout successful',
    data: {}
  });
});

const refresh = asyncHandler(async (req, res) => {
  const result = await adminAuthService.refresh({ refreshToken: req.body.refreshToken });
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'Token refreshed',
    data: result
  });
});

const me = asyncHandler(async (req, res) => {
  const admin = await adminAuthService.me(req.admin.id);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    data: admin
  });
});

const createAdmin = asyncHandler(async (req, res) => {
  const admin = await adminAuthService.createAdmin(req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Admin account created',
    data: admin
  });
});

module.exports = { login, logout, refresh, me, createAdmin };
