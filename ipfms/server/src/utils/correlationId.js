const { v4: uuidv4 } = require('uuid');

/**
 * Express middleware that stamps every request with a unique correlation ID.
 * Uses X-Correlation-ID header from the client if present, otherwise generates one.
 * The ID is attached to res.locals so all downstream middleware and controllers
 * can access it via res.locals.correlationId.
 */
function correlationIdMiddleware(req, res, next) {
  const id =
    req.headers['x-correlation-id'] ||
    req.headers['x-request-id'] ||
    uuidv4();

  req.correlationId = id;
  res.locals.correlationId = id;
  res.setHeader('X-Correlation-ID', id);
  next();
}

module.exports = correlationIdMiddleware;
