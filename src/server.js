const app = require('./app');
const env = require('./config/env');
const { connectDatabase } = require('./config/db');
const logger = require('./config/logger');

const startServer = async () => {
  await connectDatabase();

  app.listen(env.port, () => {
    logger.info(`Server running on port ${env.port}`);
  });
};

startServer().catch((error) => {
  logger.error('Failed to start server', error);
  process.exit(1);
});
