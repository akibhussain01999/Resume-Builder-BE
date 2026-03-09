const { StatusCodes } = require('http-status-codes');

module.exports = (err, req, res, next) => {
  const statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  const code = err.code || 'INTERNAL_SERVER_ERROR';

  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: err.message || 'Something went wrong',
      details: err.details || []
    }
  });
};
