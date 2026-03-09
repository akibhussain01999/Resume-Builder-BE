const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const authService = require('./auth.service');

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Registration successful. Please verify your email.',
    data: result
  });
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'Login successful',
    data: result
  });
});

const googleLogin = asyncHandler(async (req, res) => {
  const result = await authService.googleLogin(req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'Login successful',
    data: result
  });
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.me(req.user.id);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    data: user
  });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user.id);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'Logout successful',
    data: {}
  });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const result = await authService.verifyEmail(req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'Email verified successfully',
    data: result
  });
});

module.exports = {
  register,
  login,
  googleLogin,
  me,
  logout,
  verifyEmail
};
