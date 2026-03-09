const jwt = require('jsonwebtoken');
const env = require('../config/env');

const signAccessToken = (payload) => jwt.sign(payload, env.jwtAccessSecret, { expiresIn: env.jwtAccessExpiresIn });

const signRefreshToken = (payload) =>
  jwt.sign(payload, env.jwtRefreshSecret, { expiresIn: env.jwtRefreshExpiresIn });

const verifyAccessToken = (token) => jwt.verify(token, env.jwtAccessSecret);

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken
};
