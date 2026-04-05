const { StatusCodes } = require('http-status-codes');
const ApiError = require('../utils/ApiError');
const { verifyAdminAccessToken } = require('../utils/jwt');

/**
 * Admin auth middleware with optional role guard.
 *
 * Usage:
 *   adminAuth()                          — any authenticated admin
 *   adminAuth(['superadmin'])            — superadmin only
 *   adminAuth(['superadmin', 'admin'])   — superadmin or admin
 */
const adminAuth = (allowedRoles = ['superadmin', 'admin', 'moderator']) => (req, res, next) => {
  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    return next(new ApiError(StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED', 'Missing Bearer token'));
  }

  const token = authHeader.slice(7);

  let payload;
  try {
    payload = verifyAdminAccessToken(token);
  } catch {
    return next(new ApiError(StatusCodes.UNAUTHORIZED, 'INVALID_TOKEN', 'Invalid or expired token'));
  }

  if (!allowedRoles.includes(payload.role)) {
    return next(
      new ApiError(StatusCodes.FORBIDDEN, 'FORBIDDEN', `Requires role: ${allowedRoles.join(' or ')}`)
    );
  }

  req.admin = { id: payload.sub, email: payload.email, role: payload.role };
  return next();
};

module.exports = adminAuth;
