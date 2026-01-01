/**
 * Deals Routes
 * Complete deal/pipeline management
 */

import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { loadWorkspace } from '../middlewares/workspace.js';
import prisma from '../prisma.js';

const router = express.Router();

router.use(authenticate);
router.use(loadWorkspace);

// List deals
router.get('/',
  asyncHandler(async (req, res) => {
    const { stage, status } = req.query;
    const deals = await prisma.deal.findMany({
      where: {
        workspaceId: req.workspace.id,
        ...(stage && { stageId: stage }),
        ...(status && { status }),
      },
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        stage: true,
        pipeline: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(deals);
  })
);

// Get deal details
router.get('/:id',
  asyncHandler(async (req, res) => {
    const deal = await prisma.deal.findFirst({
      where: { id: req.params.id, workspaceId: req.workspace.id },
      include: {
        contact: true,
        stage: true,
        pipeline: true,
      },
    });
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    res.json(deal);
  })
);

// Create deal
router.post('/',
  asyncHandler(async (req, res) => {
    const deal = await prisma.deal.create({
      data: {
        ...req.body,
        workspaceId: req.workspace.id,
        createdBy: req.user.id,
      },
      include: {
        contact: { select: { id: true, name: true } },
        stage: true,
      },
    });
    res.status(201).json(deal);
  })
);

// Update deal
router.put('/:id',
  asyncHandler(async (req, res) => {
    const deal = await prisma.deal.update({
      where: { id: req.params.id },
      data: req.body,
      include: {
        contact: { select: { id: true, name: true } },
        stage: true,
      },
    });
    res.json(deal);
  })
);

// Move deal stage
router.patch('/:id/stage',
  asyncHandler(async (req, res) => {
    const { stageId } = req.body;
    const deal = await prisma.deal.update({
      where: { id: req.params.id },
      data: { stageId },
      include: { stage: true },
    });
    res.json(deal);
  })
);

// Update deal status (won/lost)
router.patch('/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    const deal = await prisma.deal.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(status === 'won' && { wonAt: new Date() }),
        ...(status === 'lost' && { lostAt: new Date() }),
      },
    });
    res.json(deal);
  })
);

// Delete deal
router.delete('/:id',
  asyncHandler(async (req, res) => {
    await prisma.deal.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    res.status(204).send();
  })
);

// Get pipeline view
router.get('/pipeline',
  asyncHandler(async (req, res) => {
    const pipelines = await prisma.pipeline.findMany({
      where: { workspaceId: req.workspace.id },
      include: {
        stages: {
          include: {
            _count: { select: { deals: true } },
          },
          orderBy: { order: 'asc' },
        },
      },
    });
    res.json(pipelines);
  })
);

// Get revenue forecast
router.get('/forecast',
  asyncHandler(async (req, res) => {
    const deals = await prisma.deal.findMany({
      where: {
        workspaceId: req.workspace.id,
        status: 'open',
      },
      select: {
        value: true,
        probability: true,
        expectedCloseDate: true,
      },
    });
    
    const forecast = deals.reduce((acc, deal) => {
      const weighted = (deal.value || 0) * ((deal.probability || 50) / 100);
      return acc + weighted;
    }, 0);
    
    res.json({ forecast, totalDeals: deals.length });
  })
);

export default router;
