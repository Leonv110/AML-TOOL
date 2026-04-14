/**
 * Centralized error handler — catches any unhandled errors in route handlers.
 * Must be registered AFTER all routes in server.js: app.use(errorHandler)
 */
function errorHandler(err, req, res, next) {
  // Log the error (in production you'd send this to a monitoring service)
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message || err);

  // Don't leak stack traces in production
  const isProd = process.env.NODE_ENV === 'production';

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired. Please login again.', code: 'TOKEN_EXPIRED' });
  }

  // Joi validation errors (if thrown, not via middleware)
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.details?.map(d => d.message).join('; '),
    });
  }

  // PostgreSQL errors
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Duplicate entry. This record already exists.', code: 'DUPLICATE_ENTRY' });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced record not found.', code: 'FK_VIOLATION' });
  }
  if (err.code === '42P01') {
    return res.status(500).json({ error: 'Database table not found. Run migrations.', code: 'TABLE_NOT_FOUND' });
  }

  // Rate limit errors
  if (err.status === 429) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' });
  }

  // Default server error
  res.status(err.status || 500).json({
    error: isProd ? 'Internal server error' : (err.message || 'Internal server error'),
    code: 'SERVER_ERROR',
    ...(isProd ? {} : { stack: err.stack }),
  });
}

module.exports = errorHandler;
