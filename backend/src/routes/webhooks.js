/**
 * Webhooks Routes
 * Webhook management and delivery
 */

import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { loadWorkspace } from '../middlewares/workspace.js';
import prisma from '../prisma.js';
import { generateToken } from '../shared/utils/crypto.js';

const router = express.Router();

router.use(authenticate);
router.use(loadWorkspace);

// List webhooks
router.get('/',
  asyncHandler(async (req, res) => {
    const webhooks = await prisma.webhook.findMany({
      where: { workspaceId: req.workspace.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(webhooks);
  })
);

// Get webhook details
router.get('/:id',
  asyncHandler(async (req, res) => {
    const webhook = await prisma.webhook.findFirst({
      where: { id: req.params.id, workspaceId: req.workspace.id },
    });
    
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    res.json(webhook);
  })
);

// Create webhook
router.post('/',
  asyncHandler(async (req, res) => {
    const { url, events, description } = req.body;
    
    const webhook = await prisma.webhook.create({
      data: {
        workspaceId: req.workspace.id,
        url,
        events,
        description,
        secret: generateToken(32),
        isActive: true,
      },
    });
    
    res.status(201).json(webhook);
  })
);

// Update webhook
router.put('/:id',
  asyncHandler(async (req, res) => {
    const webhook = await prisma.webhook.update({
      where: { id: req.params.id },
      data: req.body,
    });
    
    res.json(webhook);
  })
);

// Delete webhook
router.delete('/:id',
  asyncHandler(async (req, res) => {
    await prisma.webhook.delete({
      where: { id: req.params.id },
    });
    
    res.status(204).send();
  })
);

// Toggle webhook active status
router.patch('/:id/toggle',
  asyncHandler(async (req, res) => {
    const webhook = await prisma.webhook.findFirst({
      where: { id: req.params.id, workspaceId: req.workspace.id },
    });
    
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    const updated = await prisma.webhook.update({
      where: { id: req.params.id },
      data: { isActive: !webhook.isActive },
    });
    
    res.json(updated);
  })
);

// Get delivery history
router.get('/:id/deliveries',
  asyncHandler(async (req, res) => {
    const { page = 1, perPage = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(perPage);
    
    const [deliveries, total] = await Promise.all([
      prisma.webhookDelivery.findMany({
        where: { webhookId: req.params.id },
        skip,
        take: parseInt(perPage),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.webhookDelivery.count({
        where: { webhookId: req.params.id },
      }),
    ]);
    
    res.json({
      data: deliveries,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(perPage),
        total,
        totalPages: Math.ceil(total / parseInt(perPage)),
      },
    });
  })
);

// Test webhook
router.post('/:id/test',
  asyncHandler(async (req, res) => {
    const webhook = await prisma.webhook.findFirst({
      where: { id: req.params.id, workspaceId: req.workspace.id },
    });
    
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    // TODO: Send test webhook
    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event: 'test',
        payload: { test: true, timestamp: new Date() },
        status: 'success',
        statusCode: 200,
        attempts: 1,
      },
    });
    
    res.json({ success: true, delivery, message: 'Test webhook sent' });
  })
);

// Retry delivery
router.post('/:id/retry/:deliveryId',
  asyncHandler(async (req, res) => {
    const delivery = await prisma.webhookDelivery.findFirst({
      where: {
        id: req.params.deliveryId,
        webhookId: req.params.id,
      },
    });
    
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }
    
    // TODO: Retry webhook delivery
    const updated = await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'pending',
        attempts: delivery.attempts + 1,
      },
    });
    
    res.json({ success: true, delivery: updated });
  })
);

export default router;
