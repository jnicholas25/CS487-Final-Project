const mongoose = require('mongoose');

/**
 * MongoDB connection configuration for IPFMS.
 *
 * Reads MONGODB_URI from the environment (set via .env / environment.js).
 * Exports a `connectDB()` function to be called once at app startup.
 */

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 5000;

let retryCount = 0;

/**
 * Establish the Mongoose connection with retry logic.
 * @returns {Promise<void>}
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      'MONGODB_URI is not defined. Check your .env file or environment variables.'
    );
  }

  const options = {
    // Connection pool
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 10000,  // fail fast if no server found
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,

    // Buffering — queue commands while reconnecting
    bufferCommands: true,

    // Compression
    compressors: ['zlib'],

    // Application name shown in MongoDB Atlas / logs
    appName: 'IPFMS',
  };

  mongoose.set('strictQuery', true);

  // ── Event listeners ──────────────────────────────────────────────────────────

  mongoose.connection.on('connected', () => {
    retryCount = 0;
    console.info('[MongoDB] Connected successfully');
  });

  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] Connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    console.info('[MongoDB] Reconnected');
  });

  // Graceful shutdown
  process.on('SIGINT', gracefulShutdown('SIGINT'));
  process.on('SIGTERM', gracefulShutdown('SIGTERM'));

  // ── Connect with retry ────────────────────────────────────────────────────────

  await connectWithRetry(uri, options);
}

/**
 * Attempt connection; on failure, retry up to MAX_RETRIES times.
 * @param {string} uri
 * @param {object} options
 */
async function connectWithRetry(uri, options) {
  try {
    await mongoose.connect(uri, options);
  } catch (err) {
    retryCount += 1;
    if (retryCount >= MAX_RETRIES) {
      console.error(
        `[MongoDB] Could not connect after ${MAX_RETRIES} attempts. Exiting.`
      );
      process.exit(1);
    }
    console.warn(
      `[MongoDB] Connection attempt ${retryCount}/${MAX_RETRIES} failed: ${err.message}. ` +
        `Retrying in ${RETRY_INTERVAL_MS / 1000}s…`
    );
    await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
    return connectWithRetry(uri, options);
  }
}

/**
 * Gracefully close the Mongoose connection before process exit.
 * @param {string} signal
 * @returns {Function}
 */
function gracefulShutdown(signal) {
  return async () => {
    try {
      await mongoose.connection.close();
      console.info(`[MongoDB] Connection closed on ${signal}`);
    } catch (err) {
      console.error('[MongoDB] Error during graceful shutdown:', err.message);
    } finally {
      process.exit(0);
    }
  };
}

/**
 * Disconnect from MongoDB (useful in tests / scripts).
 * @returns {Promise<void>}
 */
async function disconnectDB() {
  await mongoose.connection.close();
  console.info('[MongoDB] Disconnected intentionally');
}

/**
 * Return the current connection state string.
 * @returns {string} e.g. 'connected', 'disconnected'
 */
function getConnectionState() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] || 'unknown';
}

module.exports = { connectDB, disconnectDB, getConnectionState };
