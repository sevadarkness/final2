/**
 * Rate Limiting Middleware
 * Redis-based rate limiting with flexible configurations
 */

import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';

// Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  enableOfflineQueue: false,
  maxRetriesPerRequest: 3
});

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err);
});

redis.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

// General API rate limiter
const apiLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:api',
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000,
  blockDuration: 60
});

// AI endpoints rate limiter (more restrictive)
const aiLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:ai',
  points: parseInt(process.env.RATE_LIMIT_AI_MAX_REQUESTS || '20'),
  duration: parseInt(process.env.RATE_LIMIT_AI_WINDOW_MS || '60000') / 1000,
  blockDuration: 120
});

// Auth endpoints rate limiter (most restrictive)
const authLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:auth',
  points: 5,
  duration: 300, // 5 minutes
  blockDuration: 900 // 15 minutes
});

/**
 * Middleware genérico de rate limiting
 */
export const rateLimitMiddleware = async (req, res, next) => {
  try {
    const key = req.user?.id || req.ip;
    
    // Escolher limiter baseado na rota
    let limiter = apiLimiter;
    if (req.path.startsWith('/api/ai')) {
      limiter = aiLimiter;
    } else if (req.path.startsWith('/api/auth')) {
      limiter = authLimiter;
    }

    await limiter.consume(key);
    next();
  } catch (error) {
    if (error instanceof Error) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.round(error.msBeforeNext / 1000) || 60
      });
    }
    next();
  }
};

/**
 * Rate limiter específico para AI
 */
export const aiRateLimitMiddleware = async (req, res, next) => {
  try {
    const key = req.user?.id || req.ip;
    await aiLimiter.consume(key);
    next();
  } catch (error) {
    if (error instanceof Error) {
      return res.status(429).json({
        error: 'AI rate limit exceeded',
        message: 'You have exceeded the AI request limit. Please try again later.',
        retryAfter: Math.round(error.msBeforeNext / 1000) || 60
      });
    }
    next();
  }
};

/**
 * Rate limiter específico para autenticação
 */
export const authRateLimitMiddleware = async (req, res, next) => {
  try {
    const key = req.ip;
    await authLimiter.consume(key);
    next();
  } catch (error) {
    if (error instanceof Error) {
      return res.status(429).json({
        error: 'Too many authentication attempts',
        message: 'Too many login attempts. Please try again later.',
        retryAfter: Math.round(error.msBeforeNext / 1000) || 900
      });
    }
    next();
  }
};

/**
 * Rate limiter customizável
 */
export const createRateLimiter = (options) => {
  const limiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: options.keyPrefix || 'rl:custom',
    points: options.points || 100,
    duration: options.duration || 60,
    blockDuration: options.blockDuration || 60
  });

  return async (req, res, next) => {
    try {
      const key = options.keyGenerator 
        ? options.keyGenerator(req) 
        : req.user?.id || req.ip;
      
      await limiter.consume(key);
      next();
    } catch (error) {
      if (error instanceof Error) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: options.message || 'Too many requests',
          retryAfter: Math.round(error.msBeforeNext / 1000) || 60
        });
      }
      next();
    }
  };
};

export { redis };

export default {
  rateLimitMiddleware,
  aiRateLimitMiddleware,
  authRateLimitMiddleware,
  createRateLimiter,
  redis
};
