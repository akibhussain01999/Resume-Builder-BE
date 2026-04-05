const { StatusCodes } = require('http-status-codes');
const mongoose = require('mongoose');
const ApiError = require('../../../utils/ApiError');
const { parsePagination } = require('../../../utils/query');
const logger = require('../../../config/logger');

// Access the ATSResume model registered by the ESM module at runtime
const getAtsModel = () => mongoose.models.ATSResume || null;

const listAtsRecords = async (query) => {
  const AtsResume = getAtsModel();
  if (!AtsResume) {
    throw new ApiError(500, 'MODEL_UNAVAILABLE', 'ATSResume model not loaded. Start the ATS service first.');
  }

  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.userId) filter.user_id = query.userId;

  const [items, total] = await Promise.all([
    AtsResume.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user_id', 'name email'),
    AtsResume.countDocuments(filter)
  ]);

  return { items, meta: { page, limit, total } };
};

const getAtsRecord = async (id) => {
  const AtsResume = getAtsModel();
  if (!AtsResume) {
    throw new ApiError(500, 'MODEL_UNAVAILABLE', 'ATSResume model not loaded.');
  }

  const record = await AtsResume.findById(id).populate('user_id', 'name email');
  if (!record) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'ATS_RECORD_NOT_FOUND', 'ATS record not found');
  }
  return record;
};

const deleteAtsRecord = async (id) => {
  const AtsResume = getAtsModel();
  if (!AtsResume) {
    throw new ApiError(500, 'MODEL_UNAVAILABLE', 'ATSResume model not loaded.');
  }

  const record = await AtsResume.findByIdAndDelete(id);
  if (!record) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'ATS_RECORD_NOT_FOUND', 'ATS record not found');
  }

  logger.info(`Admin deleted ATS record: ${id}`);
  return { deleted: true, id };
};

const deleteExpiredAtsRecords = async () => {
  const AtsResume = getAtsModel();
  if (!AtsResume) {
    throw new ApiError(500, 'MODEL_UNAVAILABLE', 'ATSResume model not loaded.');
  }

  const result = await AtsResume.deleteMany({ expires_at: { $lt: new Date() } });
  logger.info(`Admin purged ${result.deletedCount} expired ATS records`);
  return { deleted: result.deletedCount };
};

module.exports = { listAtsRecords, getAtsRecord, deleteAtsRecord, deleteExpiredAtsRecords };
