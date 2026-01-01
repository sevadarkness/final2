/**
 * Analytics Routes
 * Dashboard metrics and reporting
 */

import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { loadWorkspace } from '../middlewares/workspace.js';
import prisma from '../prisma.js';

const router = express.Router();

router.use(authenticate);
router.use(loadWorkspace);

// Dashboard metrics
router.get('/dashboard',
  asyncHandler(async (req, res) => {
    const [
      contactsTotal,
      dealsTotal,
      dealsValue,
      messagesTotal,
      campaignsActive,
      tasksOpen,
    ] = await Promise.all([
      prisma.contact.count({ where: { workspaceId: req.workspace.id, deletedAt: null } }),
      prisma.deal.count({ where: { workspaceId: req.workspace.id } }),
      prisma.deal.aggregate({
        where: { workspaceId: req.workspace.id, status: 'open' },
        _sum: { value: true },
      }),
      prisma.message.count({ where: { workspaceId: req.workspace.id } }),
      prisma.campaign.count({
        where: { workspaceId: req.workspace.id, status: 'running' },
      }),
      prisma.task.count({
        where: { workspaceId: req.workspace.id, status: { not: 'completed' } },
      }),
    ]);
    
    res.json({
      contacts: contactsTotal,
      deals: {
        total: dealsTotal,
        value: dealsValue._sum.value || 0,
      },
      messages: messagesTotal,
      campaigns: campaignsActive,
      tasks: tasksOpen,
    });
  })
);

// Message metrics
router.get('/messages',
  asyncHandler(async (req, res) => {
    const { start, end } = req.query;
    const dateFilter = start && end ? {
      timestamp: { gte: new Date(start), lte: new Date(end) },
    } : {};
    
    const [byDirection, byType, totalCount] = await Promise.all([
      prisma.message.groupBy({
        by: ['direction'],
        where: { workspaceId: req.workspace.id, ...dateFilter },
        _count: true,
      }),
      prisma.message.groupBy({
        by: ['type'],
        where: { workspaceId: req.workspace.id, ...dateFilter },
        _count: true,
      }),
      prisma.message.count({
        where: { workspaceId: req.workspace.id, ...dateFilter },
      }),
    ]);
    
    res.json({ byDirection, byType, total: totalCount });
  })
);

// Contact metrics
router.get('/contacts',
  asyncHandler(async (req, res) => {
    const [byStage, byLeadScore, totalCount] = await Promise.all([
      prisma.contact.groupBy({
        by: ['stage'],
        where: { workspaceId: req.workspace.id, deletedAt: null },
        _count: true,
      }),
      prisma.contact.groupBy({
        by: ['leadScore'],
        where: { workspaceId: req.workspace.id, deletedAt: null },
        _count: true,
      }),
      prisma.contact.count({
        where: { workspaceId: req.workspace.id, deletedAt: null },
      }),
    ]);
    
    res.json({ byStage, byLeadScore, total: totalCount });
  })
);

// Deal metrics
router.get('/deals',
  asyncHandler(async (req, res) => {
    const [byStatus, byStage, totalValue] = await Promise.all([
      prisma.deal.groupBy({
        by: ['status'],
        where: { workspaceId: req.workspace.id },
        _count: true,
        _sum: { value: true },
      }),
      prisma.deal.groupBy({
        by: ['stageId'],
        where: { workspaceId: req.workspace.id },
        _count: true,
        _sum: { value: true },
      }),
      prisma.deal.aggregate({
        where: { workspaceId: req.workspace.id },
        _sum: { value: true },
      }),
    ]);
    
    res.json({ byStatus, byStage, totalValue: totalValue._sum.value || 0 });
  })
);

// Campaign metrics
router.get('/campaigns',
  asyncHandler(async (req, res) => {
    const campaigns = await prisma.campaign.findMany({
      where: { workspaceId: req.workspace.id },
      select: {
        id: true,
        name: true,
        status: true,
        _count: { select: { items: true } },
      },
    });
    
    const statusCounts = await prisma.campaign.groupBy({
      by: ['status'],
      where: { workspaceId: req.workspace.id },
      _count: true,
    });
    
    res.json({ campaigns, statusCounts });
  })
);

// AI usage metrics
router.get('/ai',
  asyncHandler(async (req, res) => {
    const { start, end } = req.query;
    const dateFilter = start && end ? {
      timestamp: { gte: new Date(start), lte: new Date(end) },
    } : {};
    
    const [byProvider, byEngine, totals] = await Promise.all([
      prisma.aIUsageLog.groupBy({
        by: ['provider'],
        where: { workspaceId: req.workspace.id, ...dateFilter },
        _count: true,
        _sum: { tokensUsed: true, cost: true },
      }),
      prisma.aIUsageLog.groupBy({
        by: ['engine'],
        where: { workspaceId: req.workspace.id, ...dateFilter },
        _count: true,
      }),
      prisma.aIUsageLog.aggregate({
        where: { workspaceId: req.workspace.id, ...dateFilter },
        _sum: { tokensUsed: true, cost: true },
      }),
    ]);
    
    res.json({
      byProvider,
      byEngine,
      totals: {
        tokens: totals._sum.tokensUsed || 0,
        cost: totals._sum.cost || 0,
      },
    });
  })
);

// Team performance metrics
router.get('/team',
  asyncHandler(async (req, res) => {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: req.workspace.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
    
    const performance = await Promise.all(
      members.map(async (member) => {
        const [contacts, deals, tasks] = await Promise.all([
          prisma.contact.count({
            where: { workspaceId: req.workspace.id, createdBy: member.userId },
          }),
          prisma.deal.count({
            where: { workspaceId: req.workspace.id, createdBy: member.userId },
          }),
          prisma.task.count({
            where: { workspaceId: req.workspace.id, assignedTo: member.userId, status: 'completed' },
          }),
        ]);
        
        return {
          user: member.user,
          metrics: { contacts, deals, tasksCompleted: tasks },
        };
      })
    );
    
    res.json(performance);
  })
);

// Export report
router.get('/export',
  asyncHandler(async (req, res) => {
    // TODO: Generate and return report file
    res.json({ message: 'Export functionality - TODO' });
  })
);

export default router;
