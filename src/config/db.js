const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');

const connectDatabase = async () => {
  if (!env.mongoUri) {
    throw new Error('MONGO_URI is missing in environment variables.');
  }

  await mongoose.connect(env.mongoUri, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 5000
  });

  logger.info('Connected to MongoDB');
};

module.exports = { connectDatabase };
