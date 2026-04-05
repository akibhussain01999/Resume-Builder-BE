const env = require('./env');

const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const colors = {
  error: '\x1b[31m', // red
  warn: '\x1b[33m',  // yellow
  info: '\x1b[36m',  // cyan
  debug: '\x1b[90m'  // gray
};
const reset = '\x1b[0m';

const currentLevel = env.nodeEnv === 'production' ? 'info' : 'debug';

function log(level, ...args) {
  if (levels[level] > levels[currentLevel]) return;

  const timestamp = new Date().toISOString();
  const prefix = `${colors[level]}[${timestamp}] [${level.toUpperCase()}]${reset}`;
  const method = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  method(prefix, ...args);
}

const logger = {
  error: (...args) => log('error', ...args),
  warn: (...args) => log('warn', ...args),
  info: (...args) => log('info', ...args),
  debug: (...args) => log('debug', ...args)
};

module.exports = logger;
