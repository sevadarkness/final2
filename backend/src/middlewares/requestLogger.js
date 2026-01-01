/**
 * Request Logger Middleware
 * Structured logging for all HTTP requests
 */

import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    }
  } : undefined,
  redact: {
    paths: ['req.headers.authorization', 'req.body.password', 'req.body.token'],
    remove: true
  }
});

export function requestLogger(req, res, next) {
  const startTime = Date.now();
  
  // Log request
  logger.info({
    type: 'request',
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id,
  }, `${req.method} ${req.url}`);
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      type: 'response',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      requestId: req.id,
    };
    
    if (res.statusCode >= 500) {
      logger.error(logData, `${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    } else if (res.statusCode >= 400) {
      logger.warn(logData, `${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    } else {
      logger.info(logData, `${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    }
  });
  
  next();
}

export { logger };
export default requestLogger;
