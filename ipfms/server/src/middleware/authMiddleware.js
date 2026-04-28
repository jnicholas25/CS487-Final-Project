const { verifyAccessToken, extractBearerToken } = require('../services/auth/tokenService');
const User = require('../models/User');
const { AppError } = require('./errorHandler');

/**
 * Protect a route — verifies the JWT access token and loads the user.
 * Attaches req.user to the request for downstream use.
 */
async function protect(req, res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return next(new AppError('No token provided. Please log in.', 401, 'NO_TOKEN'));
    }

    const decoded = verifyAccessToken(token); // throws on invalid/expired

    // Load fresh user from DB (catches deactivated accounts between token issues)
    const user = await User.findById(decoded.sub).select('-__v');
    if (!user || !user.isActive || user.deletedAt) {
      return next(new AppError('User no longer exists or is inactive', 401, 'USER_NOT_FOUND'));
    }

    req.user = user;
    next();
  } catch (err) {
    next(err); // JWT errors propagate to errorHandler
  }
}

/**
 * Restrict access to specific roles.
 * Must be used AFTER protect().
 * @param {...string} roles  Allowed roles, e.g. restrictTo('admin', 'support')
 */
function restrictTo(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED'));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN')
      );
    }
    next();
  };
}

/**
 * Optional auth — populates req.user if a valid token is present,
 * but does NOT block the request if there is no token.
 */
async function optionalAuth(req, res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) return next();

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.sub).select('-__v');
    if (user && user.isActive && !user.deletedAt) {
      req.user = user;
    }
    next();
  } catch {
    // Swallow errors — optional auth never blocks
    next();
  }
}

module.exports = { protect, restrictTo, optionalAuth };
