/**
 * License Routes
 * License validation and credit management
 */

import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { loadWorkspace } from '../middlewares/workspace.js';
import prisma from '../prisma.js';
import { generateToken } from '../shared/utils/crypto.js';

const router = express.Router();

router.use(authenticate);

// Validate license key
router.post('/validate',
  asyncHandler(async (req, res) => {
    const { key } = req.body;
    
    const license = await prisma.license.findUnique({
      where: { key },
      include: { workspace: true },
    });
    
    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }
    
    if (license.expiresAt && license.expiresAt < new Date()) {
      return res.status(400).json({ error: 'License expired' });
    }
    
    if (!license.isActive) {
      return res.status(400).json({ error: 'License is inactive' });
    }
    
    res.json({
      valid: true,
      license: {
        tier: license.tier,
        expiresAt: license.expiresAt,
        features: license.features,
      },
    });
  })
);

// Get license status
router.get('/status',
  loadWorkspace,
  asyncHandler(async (req, res) => {
    const license = await prisma.license.findFirst({
      where: { workspaceId: req.workspace.id },
      include: {
        _count: { select: { credits: true } },
      },
    });
    
    if (!license) {
      return res.status(404).json({ error: 'No license found' });
    }
    
    const totalCredits = await prisma.aICredit.aggregate({
      where: { workspaceId: req.workspace.id, expiresAt: { gt: new Date() } },
      _sum: { amount: true, used: true },
    });
    
    res.json({
      license: {
        tier: license.tier,
        isActive: license.isActive,
        expiresAt: license.expiresAt,
      },
      credits: {
        total: totalCredits._sum.amount || 0,
        used: totalCredits._sum.used || 0,
        remaining: (totalCredits._sum.amount || 0) - (totalCredits._sum.used || 0),
      },
    });
  })
);

// Activate license
router.post('/activate',
  loadWorkspace,
  asyncHandler(async (req, res) => {
    const { key } = req.body;
    
    const existing = await prisma.license.findUnique({
      where: { key },
    });
    
    if (existing && existing.workspaceId) {
      return res.status(400).json({ error: 'License already activated' });
    }
    
    const license = await prisma.license.update({
      where: { key },
      data: {
        workspaceId: req.workspace.id,
        isActive: true,
        activatedAt: new Date(),
      },
    });
    
    res.json({ success: true, license });
  })
);

// Redeem topup code
router.post('/topup',
  loadWorkspace,
  asyncHandler(async (req, res) => {
    const { code } = req.body;
    
    const topup = await prisma.topupCode.findUnique({
      where: { code },
    });
    
    if (!topup) {
      return res.status(404).json({ error: 'Invalid topup code' });
    }
    
    if (topup.usedAt) {
      return res.status(400).json({ error: 'Topup code already used' });
    }
    
    if (topup.expiresAt && topup.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Topup code expired' });
    }
    
    // Create AI credits
    const credit = await prisma.aICredit.create({
      data: {
        workspaceId: req.workspace.id,
        amount: topup.credits,
        used: 0,
        source: 'topup',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      },
    });
    
    // Mark topup as used
    await prisma.topupCode.update({
      where: { id: topup.id },
      data: {
        usedAt: new Date(),
        usedBy: req.user.id,
        usedByWorkspace: req.workspace.id,
      },
    });
    
    res.json({ success: true, credit });
  })
);

// Get usage history
router.get('/usage',
  loadWorkspace,
  asyncHandler(async (req, res) => {
    const { page = 1, perPage = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(perPage);
    
    const [usage, total] = await Promise.all([
      prisma.aIUsageLog.findMany({
        where: { workspaceId: req.workspace.id },
        skip,
        take: parseInt(perPage),
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          engine: true,
          provider: true,
          model: true,
          tokensUsed: true,
          cost: true,
          timestamp: true,
        },
      }),
      prisma.aIUsageLog.count({
        where: { workspaceId: req.workspace.id },
      }),
    ]);
    
    res.json({
      data: usage,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(perPage),
        total,
        totalPages: Math.ceil(total / parseInt(perPage)),
      },
    });
  })
);

export default router;
