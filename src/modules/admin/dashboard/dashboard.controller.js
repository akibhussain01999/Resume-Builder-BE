const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../../../utils/asyncHandler');
const { sendSuccess } = require('../../../utils/response');
const dashboardService = require('./dashboard.service');

const getStats = asyncHandler(async (req, res) => {
  const stats = await dashboardService.getStats();
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    data: stats
  });
});

module.exports = { getStats };
