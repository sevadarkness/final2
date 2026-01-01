/**
 * Campaigns Routes
 * Complete campaign management
 */

import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { loadWorkspace } from '../middlewares/workspace.js';
import prisma from '../prisma.js';

const router = express.Router();

router.use(authenticate);
router.use(loadWorkspace);

// List campaigns
router.get('/',
  asyncHandler(async (req, res) => {
    const campaigns = await prisma.campaign.findMany({
      where: { workspaceId: req.workspace.id },
      include: {
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(campaigns);
  })
);

// Get campaign details with progress
router.get('/:id',
  asyncHandler(async (req, res) => {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, workspaceId: req.workspace.id },
      include: {
        _count: { select: { items: true } },
      },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    
    const statusCounts = await prisma.campaignItem.groupBy({
      by: ['status'],
      where: { campaignId: req.params.id },
      _count: true,
    });
    
    res.json({ ...campaign, statusCounts });
  })
);

// Create campaign
router.post('/',
  asyncHandler(async (req, res) => {
    const campaign = await prisma.campaign.create({
      data: {
        ...req.body,
        workspaceId: req.workspace.id,
        createdBy: req.user.id,
        status: 'draft',
      },
    });
    res.status(201).json(campaign);
  })
);

// Update campaign
router.put('/:id',
  asyncHandler(async (req, res) => {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, workspaceId: req.workspace.id },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (campaign.status !== 'draft') {
      return res.status(400).json({ error: 'Can only update draft campaigns' });
    }
    
    const updated = await prisma.campaign.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(updated);
  })
);

// Start campaign
router.post('/:id/start',
  asyncHandler(async (req, res) => {
    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    });
    // TODO: Queue campaign processing
    res.json(campaign);
  })
);

// Pause campaign
router.post('/:id/pause',
  asyncHandler(async (req, res) => {
    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: { status: 'paused' },
    });
    res.json(campaign);
  })
);

// Resume campaign
router.post('/:id/resume',
  asyncHandler(async (req, res) => {
    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: { status: 'running' },
    });
    res.json(campaign);
  })
);

// Cancel campaign
router.post('/:id/cancel',
  asyncHandler(async (req, res) => {
    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
      },
    });
    res.json(campaign);
  })
);

// Get campaign items
router.get('/:id/items',
  asyncHandler(async (req, res) => {
    const items = await prisma.campaignItem.findMany({
      where: { campaignId: req.params.id },
      include: {
        contact: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  })
);

// Retry failed items
router.post('/:id/retry-failed',
  asyncHandler(async (req, res) => {
    await prisma.campaignItem.updateMany({
      where: {
        campaignId: req.params.id,
        status: 'failed',
      },
      data: {
        status: 'pending',
        attempts: 0,
      },
    });
    res.json({ success: true });
  })
);

// Get campaign analytics
router.get('/:id/analytics',
  asyncHandler(async (req, res) => {
    const [campaign, statusCounts, avgResponseTime] = await Promise.all([
      prisma.campaign.findUnique({ where: { id: req.params.id } }),
      prisma.campaignItem.groupBy({
        by: ['status'],
        where: { campaignId: req.params.id },
        _count: true,
      }),
      prisma.campaignItem.aggregate({
        where: {
          campaignId: req.params.id,
          status: 'delivered',
        },
        _avg: { responseTime: true },
      }),
    ]);
    
    res.json({
      campaign,
      statusCounts,
      avgResponseTime: avgResponseTime._avg.responseTime || 0,
    });
  })
);

// Send test message
router.post('/test',
  asyncHandler(async (req, res) => {
    const { message, phone } = req.body;
    // TODO: Implement test message sending
    res.json({ success: true, message: 'Test message would be sent' });
  })
);

export default router;
