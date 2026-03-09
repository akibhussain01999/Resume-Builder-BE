const sendSuccess = (res, payload = {}) => {
  const { statusCode = 200, message, data = {}, meta } = payload;

  return res.status(statusCode).json({
    success: true,
    ...(message ? { message } : {}),
    data,
    ...(meta ? { meta } : {})
  });
};

module.exports = { sendSuccess };
