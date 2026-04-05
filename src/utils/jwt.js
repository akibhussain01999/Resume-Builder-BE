const jwt = require('jsonwebtoken');
const env = require('../config/env');

const signAccessToken = (payload) => jwt.sign(payload, env.jwtAccessSecret, { expiresIn: env.jwtAccessExpiresIn });

const signRefreshToken = (payload) =>
  jwt.sign(payload, env.jwtRefreshSecret, { expiresIn: env.jwtRefreshExpiresIn });

const verifyAccessToken = (token) => jwt.verify(token, env.jwtAccessSecret);

const verifyRefreshToken = (token) => jwt.verify(token, env.jwtRefreshSecret);

const signAdminAccessToken = (payload) =>
  jwt.sign(payload, env.adminJwtSecret, { expiresIn: env.adminJwtExpiresIn });

const signAdminRefreshToken = (payload) =>
  jwt.sign(payload, env.adminRefreshSecret, { expiresIn: env.adminRefreshExpiresIn });

const verifyAdminAccessToken = (token) => jwt.verify(token, env.adminJwtSecret);

const verifyAdminRefreshToken = (token) => jwt.verify(token, env.adminRefreshSecret);

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  signAdminAccessToken,
  signAdminRefreshToken,
  verifyAdminAccessToken,
  verifyAdminRefreshToken
};
