const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

module.exports = {
  objectId
};
