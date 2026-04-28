/**
 * IPFMS Server Entry Point
 * Connects to MongoDB, then starts the Express HTTP server.
 */

const app = require('./app');
const { connectDB } = require('./src/config/database');
const env = require('./src/config/environment');
const logger = require('./src/utils/logger');

const PORT = env.PORT;

async function startServer() {
  try {
    // 1 — Connect to MongoDB
    await connectDB();
    logger.info(`[DB] MongoDB connected (${env.NODE_ENV})`);

    // 2 — Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(`[Server] IPFMS API running on port ${PORT} (${env.NODE_ENV})`);
    });

    // ── Graceful shutdown ───────────────────────────────────────────────────
    const shutdown = (signal) => async () => {
      logger.info(`[Server] ${signal} received — shutting down gracefully`);
      server.close(async () => {
        logger.info('[Server] HTTP server closed');
        process.exit(0);
      });
      // Force exit after 10 s if connections haven't drained
      setTimeout(() => {
        logger.error('[Server] Forced exit after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown('SIGTERM'));
    process.on('SIGINT', shutdown('SIGINT'));

    // ── Unhandled promise rejections / exceptions ───────────────────────────
    process.on('unhandledRejection', (reason) => {
      logger.error('[Server] Unhandled rejection', { reason });
    });

    process.on('uncaughtException', (err) => {
      logger.error('[Server] Uncaught exception', { message: err.message, stack: err.stack });
      process.exit(1);
    });

    return server;
  } catch (err) {
    logger.error('[Server] Failed to start', { message: err.message, stack: err.stack });
    process.exit(1);
  }
}

startServer();
