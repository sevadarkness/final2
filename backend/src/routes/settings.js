/**
 * Settings Routes
 * User and workspace settings management
 */

import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { loadWorkspace, requireRole } from '../middlewares/workspace.js';
import prisma from '../prisma.js';

const router = express.Router();

router.use(authenticate);

// Get user settings
router.get('/',
  asyncHandler(async (req, res) => {
    const settings = await prisma.userSetting.findMany({
      where: { userId: req.user.id },
    });
    
    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});
    
    res.json(settingsMap);
  })
);

// Update user settings
router.put('/',
  asyncHandler(async (req, res) => {
    const updates = Object.entries(req.body);
    
    await Promise.all(
      updates.map(([key, value]) =>
        prisma.userSetting.upsert({
          where: {
            userId_key: {
              userId: req.user.id,
              key,
            },
          },
          create: {
            userId: req.user.id,
            key,
            value: JSON.stringify(value),
          },
          update: {
            value: JSON.stringify(value),
          },
        })
      )
    );
    
    res.json({ success: true });
  })
);

// Get workspace settings
router.get('/workspace',
  loadWorkspace,
  asyncHandler(async (req, res) => {
    const settings = await prisma.workspaceSetting.findMany({
      where: { workspaceId: req.workspace.id },
    });
    
    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});
    
    res.json(settingsMap);
  })
);

// Update workspace settings
router.put('/workspace',
  loadWorkspace,
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const updates = Object.entries(req.body);
    
    await Promise.all(
      updates.map(([key, value]) =>
        prisma.workspaceSetting.upsert({
          where: {
            workspaceId_key: {
              workspaceId: req.workspace.id,
              key,
            },
          },
          create: {
            workspaceId: req.workspace.id,
            key,
            value: JSON.stringify(value),
          },
          update: {
            value: JSON.stringify(value),
          },
        })
      )
    );
    
    res.json({ success: true });
  })
);

// Get AI settings
router.get('/ai',
  loadWorkspace,
  asyncHandler(async (req, res) => {
    const settings = await prisma.workspaceSetting.findMany({
      where: {
        workspaceId: req.workspace.id,
        key: {
          startsWith: 'ai_',
        },
      },
    });
    
    const aiSettings = settings.reduce((acc, setting) => {
      const key = setting.key.replace('ai_', '');
      acc[key] = setting.value;
      return acc;
    }, {});
    
    res.json(aiSettings);
  })
);

// Update AI settings
router.put('/ai',
  loadWorkspace,
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const updates = Object.entries(req.body);
    
    await Promise.all(
      updates.map(([key, value]) =>
        prisma.workspaceSetting.upsert({
          where: {
            workspaceId_key: {
              workspaceId: req.workspace.id,
              key: `ai_${key}`,
            },
          },
          create: {
            workspaceId: req.workspace.id,
            key: `ai_${key}`,
            value: JSON.stringify(value),
          },
          update: {
            value: JSON.stringify(value),
          },
        })
      )
    );
    
    res.json({ success: true });
  })
);

// Get notification preferences
router.get('/notifications',
  asyncHandler(async (req, res) => {
    const settings = await prisma.userSetting.findMany({
      where: {
        userId: req.user.id,
        key: {
          startsWith: 'notification_',
        },
      },
    });
    
    const notificationSettings = settings.reduce((acc, setting) => {
      const key = setting.key.replace('notification_', '');
      acc[key] = setting.value;
      return acc;
    }, {});
    
    res.json(notificationSettings);
  })
);

// Update notification preferences
router.put('/notifications',
  asyncHandler(async (req, res) => {
    const updates = Object.entries(req.body);
    
    await Promise.all(
      updates.map(([key, value]) =>
        prisma.userSetting.upsert({
          where: {
            userId_key: {
              userId: req.user.id,
              key: `notification_${key}`,
            },
          },
          create: {
            userId: req.user.id,
            key: `notification_${key}`,
            value: JSON.stringify(value),
          },
          update: {
            value: JSON.stringify(value),
          },
        })
      )
    );
    
    res.json({ success: true });
  })
);

export default router;
