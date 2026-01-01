/**
 * Health Check Routes
 * System health and status endpoints
 */

import express from 'express';
import { redis } from '../middlewares/rateLimit.js';
import prisma from '../prisma.js';

const router = express.Router();

/**
 * GET /api/health
 * Basic health check
 */
router.get('/', async (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

/**
 * GET /api/health/detailed
 * Detailed health check with service status
 */
router.get('/detailed', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    services: {}
  };

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = { status: 'ok' };
  } catch (error) {
    health.services.database = { status: 'error', message: error.message };
    health.status = 'degraded';
  }

  // Check Redis
  try {
    await redis.ping();
    health.services.redis = { status: 'ok' };
  } catch (error) {
    health.services.redis = { status: 'error', message: error.message };
    health.status = 'degraded';
  }

  res.json(health);
});

/**
 * GET /api/health/ready
 * Kubernetes readiness probe
 */
router.get('/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false });
  }
});

/**
 * GET /api/health/live
 * Kubernetes liveness probe
 */
router.get('/live', (req, res) => {
  res.status(200).json({ alive: true });
});

export default router;
