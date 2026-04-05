const { StatusCodes } = require('http-status-codes');
const AdminUser = require('./adminUser.model');
const ApiError = require('../../../utils/ApiError');
const {
  signAdminAccessToken,
  signAdminRefreshToken,
  verifyAdminRefreshToken
} = require('../../../utils/jwt');
const logger = require('../../../config/logger');

const sanitizeAdmin = (admin) => ({
  id: admin._id,
  name: admin.name,
  email: admin.email,
  role: admin.role,
  isActive: admin.isActive,
  createdAt: admin.createdAt
});

const createTokens = (admin) => {
  const payload = {
    sub: String(admin._id),
    email: admin.email,
    role: admin.role,
    tokenVersion: admin.refreshTokenVersion
  };

  return {
    accessToken: signAdminAccessToken(payload),
    refreshToken: signAdminRefreshToken(payload)
  };
};

const login = async ({ email, password }) => {
  const admin = await AdminUser.findOne({ email });

  if (!admin) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid credentials');
  }

  if (!admin.isActive) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'ACCOUNT_DISABLED', 'Admin account is disabled');
  }

  const isMatch = await admin.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid credentials');
  }

  logger.info(`Admin logged in: ${admin.email} [${admin.role}]`);

  return {
    admin: sanitizeAdmin(admin),
    tokens: createTokens(admin)
  };
};

const logout = async (adminId) => {
  await AdminUser.findByIdAndUpdate(adminId, { $inc: { refreshTokenVersion: 1 } });
  logger.info(`Admin logged out: ${adminId}`);
  return { ok: true };
};

const refresh = async ({ refreshToken }) => {
  if (!refreshToken) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'MISSING_REFRESH_TOKEN', 'Refresh token is required');
  }

  let payload;
  try {
    payload = verifyAdminRefreshToken(refreshToken);
  } catch {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
  }

  const admin = await AdminUser.findById(payload.sub);

  if (!admin || !admin.isActive) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
  }

  if (payload.tokenVersion !== admin.refreshTokenVersion) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'REFRESH_TOKEN_REVOKED', 'Refresh token has been revoked');
  }

  return { tokens: createTokens(admin) };
};

const me = async (adminId) => {
  const admin = await AdminUser.findById(adminId);
  if (!admin) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'ADMIN_NOT_FOUND', 'Admin not found');
  }
  return sanitizeAdmin(admin);
};

// Only superadmin can create new admins
const createAdmin = async ({ name, email, password, role = 'admin' }) => {
  const existing = await AdminUser.findOne({ email });
  if (existing) {
    throw new ApiError(StatusCodes.CONFLICT, 'EMAIL_EXISTS', 'Email already registered');
  }

  const passwordHash = await AdminUser.hashPassword(password);
  const admin = await AdminUser.create({ name, email, passwordHash, role });

  logger.info(`Admin account created: ${admin.email} [${admin.role}]`);

  return sanitizeAdmin(admin);
};

module.exports = { login, logout, refresh, me, createAdmin };
