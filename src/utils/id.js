const crypto = require('crypto');

const generatePublicId = (prefix) => {
  const token = crypto.randomBytes(6).toString('hex');
  return `${prefix}_${token}`;
};

module.exports = {
  generatePublicId
};
