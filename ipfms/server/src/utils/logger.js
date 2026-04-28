const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const env = require('../config/environment');

// ── Custom log format ─────────────────────────────────────────────────────────

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, correlationId, stack }) => {
    const cid = correlationId ? ` [${correlationId}]` : '';
    return stack
      ? `${ts} ${level}${cid}: ${message}\n${stack}`
      : `${ts} ${level}${cid}: ${message}`;
  })
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

// ── Transports ────────────────────────────────────────────────────────────────

const transports = [];

// Always log to console
transports.push(
  new winston.transports.Console({
    format: env.isProduction ? prodFormat : devFormat,
  })
);

// Rotate file logs in non-test environments
if (!env.isTest) {
  const logDir = path.resolve(process.cwd(), env.LOG_DIR);

  transports.push(
    new DailyRotateFile({
      dirname: logDir,
      filename: 'ipfms-%DATE%-combined.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: combine(timestamp(), errors({ stack: true }), json()),
    })
  );

  transports.push(
    new DailyRotateFile({
      dirname: logDir,
      filename: 'ipfms-%DATE%-error.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      format: combine(timestamp(), errors({ stack: true }), json()),
    })
  );
}

// ── Logger instance ───────────────────────────────────────────────────────────

const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  defaultMeta: { service: 'ipfms' },
  transports,
  exitOnError: false,
});

/**
 * Create a child logger that automatically stamps every entry with a
 * correlationId — pass this around per-request via res.locals.
 * @param {string} correlationId
 * @returns {winston.Logger}
 */
logger.withCorrelation = (correlationId) =>
  logger.child({ correlationId });

module.exports = logger;
