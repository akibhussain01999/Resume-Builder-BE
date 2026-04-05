const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../../../utils/asyncHandler');
const { sendSuccess } = require('../../../utils/response');
const adminAtsService = require('./adminAts.service');

const listAtsRecords = asyncHandler(async (req, res) => {
  const result = await adminAtsService.listAtsRecords(req.query);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    data: result.items,
    meta: result.meta
  });
});

const getAtsRecord = asyncHandler(async (req, res) => {
  const record = await adminAtsService.getAtsRecord(req.params.id);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    data: record
  });
});

const deleteAtsRecord = asyncHandler(async (req, res) => {
  const result = await adminAtsService.deleteAtsRecord(req.params.id);
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: 'ATS record deleted',
    data: result
  });
});

const purgeExpired = asyncHandler(async (req, res) => {
  const result = await adminAtsService.deleteExpiredAtsRecords();
  return sendSuccess(res, {
    statusCode: StatusCodes.OK,
    message: `Purged ${result.deleted} expired ATS records`,
    data: result
  });
});

module.exports = { listAtsRecords, getAtsRecord, deleteAtsRecord, purgeExpired };
