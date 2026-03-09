const { StatusCodes } = require('http-status-codes');
const ApiError = require('../utils/ApiError');

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(
    {
      body: req.body,
      params: req.params,
      query: req.query
    },
    {
      abortEarly: false,
      stripUnknown: true
    }
  );

  if (error) {
    const details = error.details.map((item) => ({
      path: item.path.join('.'),
      message: item.message
    }));

    return next(
      new ApiError(StatusCodes.BAD_REQUEST, 'VALIDATION_ERROR', 'Invalid payload', details)
    );
  }

  req.body = value.body;
  req.params = value.params;
  req.query = value.query;
  return next();
};

module.exports = validate;
