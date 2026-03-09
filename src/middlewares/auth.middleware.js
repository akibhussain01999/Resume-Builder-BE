const { StatusCodes } = require('http-status-codes');
const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/jwt');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    return next(new ApiError(StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED', 'Missing Bearer token'));
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch (error) {
    return next(new ApiError(StatusCodes.UNAUTHORIZED, 'INVALID_TOKEN', 'Invalid or expired token'));
  }
};

module.exports = authMiddleware;
