/**
 * Error Handler Middleware
 * Centralized error handling and logging
 */

import prisma from '../prisma.js';

/**
 * Custom API Error class
 */
export class APIError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.name = 'APIError';
  }
}

/**
 * Log error to database (audit log)
 */
const logError = async (error, req) => {
  try {
    const errorData = {
      action: 'error',
      resource: 'system',
      changes: {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        method: req.method,
        path: req.path,
        body: req.body,
        query: req.query
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    };

    if (req.user) {
      errorData.userId = req.user.id;
    }

    await prisma.auditLog.create({
      data: errorData
    });
  } catch (logError) {
    console.error('[ErrorHandler] Failed to log error:', logError);
  }
};

/**
 * Error handler middleware
 */
export const errorHandler = async (err, req, res, next) => {
  console.error('[Error]', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Log error to database in production
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_AUDIT_LOGS === 'true') {
    await logError(err, req);
  }

  // Prisma errors
  if (err.code && err.code.startsWith('P')) {
    return handlePrismaError(err, res);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Authentication error',
      message: err.message
    });
  }

  // Validation errors (Joi)
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      message: err.message,
      errors: err.details
    });
  }

  // API errors (custom)
  if (err instanceof APIError) {
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      errors: err.errors
    });
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json({
    error: 'Server error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * Handle Prisma-specific errors
 */
const handlePrismaError = (err, res) => {
  switch (err.code) {
    case 'P2002':
      // Unique constraint violation
      return res.status(409).json({
        error: 'Conflict',
        message: 'A record with this value already exists',
        field: err.meta?.target
      });

    case 'P2025':
      // Record not found
      return res.status(404).json({
        error: 'Not found',
        message: 'The requested record was not found'
      });

    case 'P2003':
      // Foreign key constraint failed
      return res.status(400).json({
        error: 'Invalid reference',
        message: 'Referenced record does not exist',
        field: err.meta?.field_name
      });

    case 'P2014':
      // Required relation violation
      return res.status(400).json({
        error: 'Invalid relation',
        message: 'The change would violate a required relation'
      });

    default:
      return res.status(500).json({
        error: 'Database error',
        message: process.env.NODE_ENV === 'production' 
          ? 'A database error occurred' 
          : err.message
      });
  }
};

/**
 * Async handler wrapper to catch errors
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Not found handler
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
};

export default {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  APIError
};
