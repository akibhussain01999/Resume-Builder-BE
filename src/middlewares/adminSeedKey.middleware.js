const { StatusCodes } = require('http-status-codes');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const adminSeedKeyMiddleware = (req, res, next) => {
  if (!env.adminSeedKey) {
    return next();
  }

  const provided = req.headers['x-admin-key'];
  if (provided !== env.adminSeedKey) {
    return next(new ApiError(StatusCodes.UNAUTHORIZED, 'UNAUTHORIZED', 'Invalid admin seed key'));
  }

  return next();
};

module.exports = adminSeedKeyMiddleware;
