const morgan = require('morgan');
const logger = require('../utils/logger');
const env = require('../config/environment');

// Stream morgan output through winston
const morganStream = {
  write: (message) => logger.http(message.trim()),
};

// ── Format ────────────────────────────────────────────────────────────────────

// In development use a concise coloured format; in production use JSON-compatible
const format = env.isProduction
  ? ':remote-addr :method :url :status :res[content-length] - :response-time ms'
  : 'dev';

// ── Skip health-check / favicon requests to reduce noise ─────────────────────
const skip = (req) =>
  req.url === '/health' || req.url === '/favicon.ico';

const requestLogger = morgan(format, {
  stream: morganStream,
  skip,
});

module.exports = requestLogger;
