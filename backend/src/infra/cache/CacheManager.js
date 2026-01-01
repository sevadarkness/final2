/**
 * Cache Manager
 * Redis-based caching with TTL and pattern support
 */

import Redis from 'ioredis';

class CacheManager {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
    
    this.redis.on('error', (error) => {
      console.error('[Cache] Redis error:', error);
    });
    
    this.redis.on('connect', () => {
      console.log('[Cache] Redis connected');
    });
  }
  
  /**
   * Get value from cache
   */
  async get(key) {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('[Cache] Get error:', error);
      return null;
    }
  }
  
  /**
   * Set value in cache with optional TTL
   */
  async set(key, value, ttl = 3600) {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.error('[Cache] Set error:', error);
      return false;
    }
  }
  
  /**
   * Delete key from cache
   */
  async del(key) {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error('[Cache] Delete error:', error);
      return false;
    }
  }
  
  /**
   * Delete keys matching pattern
   */
  async delPattern(pattern) {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return true;
    } catch (error) {
      console.error('[Cache] Delete pattern error:', error);
      return false;
    }
  }
  
  /**
   * Check if key exists
   */
  async exists(key) {
    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      console.error('[Cache] Exists error:', error);
      return false;
    }
  }
  
  /**
   * Increment value
   */
  async incr(key, ttl = null) {
    try {
      const value = await this.redis.incr(key);
      if (ttl) {
        await this.redis.expire(key, ttl);
      }
      return value;
    } catch (error) {
      console.error('[Cache] Increment error:', error);
      return null;
    }
  }
  
  /**
   * Get multiple keys
   */
  async mget(keys) {
    try {
      const values = await this.redis.mget(...keys);
      return values.map(v => v ? JSON.parse(v) : null);
    } catch (error) {
      console.error('[Cache] Multi-get error:', error);
      return [];
    }
  }
  
  /**
   * Get TTL for key
   */
  async ttl(key) {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      console.error('[Cache] TTL error:', error);
      return -1;
    }
  }
  
  /**
   * Cache wrapper for functions
   */
  async wrap(key, fn, ttl = 3600) {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }
    
    const result = await fn();
    await this.set(key, result, ttl);
    return result;
  }
  
  /**
   * Flush all cache
   */
  async flush() {
    try {
      await this.redis.flushdb();
      return true;
    } catch (error) {
      console.error('[Cache] Flush error:', error);
      return false;
    }
  }
  
  /**
   * Close connection
   */
  async close() {
    await this.redis.quit();
  }
}

export default new CacheManager();
