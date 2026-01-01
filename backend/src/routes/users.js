/**
 * Users Routes
 * Complete CRUD for user management within workspaces
 */

import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { loadWorkspace, requireRole } from '../middlewares/workspace.js';
import UserService from '../services/UserService.js';

const router = express.Router();

router.use(authenticate);

// List users in workspace
router.get('/', 
  loadWorkspace,
  asyncHandler(async (req, res) => {
    const { page, perPage, search, role, isActive } = req.query;
    const result = await UserService.listUsers(
      req.workspace.id,
      { search, role, isActive },
      { page, perPage }
    );
    res.json(result);
  })
);

// Get user details
router.get('/:id',
  loadWorkspace,
  asyncHandler(async (req, res) => {
    const user = await UserService.getUserById(req.params.id, req.workspace.id);
    res.json(user);
  })
);

// Create user (invite)
router.post('/',
  loadWorkspace,
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const result = await UserService.createUser(
      req.body,
      req.workspace.id,
      req.user.id
    );
    res.status(201).json(result);
  })
);

// Update user
router.put('/:id',
  loadWorkspace,
  asyncHandler(async (req, res) => {
    // Users can update themselves, or admins can update anyone
    if (req.params.id !== req.user.id && !['admin', 'owner'].includes(req.membership.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const user = await UserService.updateUser(req.params.id, req.body);
    res.json(user);
  })
);

// Change user role
router.patch('/:id/role',
  loadWorkspace,
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const { role } = req.body;
    const result = await UserService.changeRole(req.params.id, req.workspace.id, role);
    res.json(result);
  })
);

// Remove user from workspace
router.delete('/:id',
  loadWorkspace,
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    await UserService.removeUser(req.params.id, req.workspace.id);
    res.status(204).send();
  })
);

// Update avatar
router.patch('/:id/avatar',
  authenticate,
  asyncHandler(async (req, res) => {
    const { avatarUrl } = req.body;
    const user = await UserService.updateAvatar(req.params.id, avatarUrl);
    res.json(user);
  })
);

// Get user activity
router.get('/:id/activity',
  loadWorkspace,
  asyncHandler(async (req, res) => {
    const { page, perPage } = req.query;
    const result = await UserService.getUserActivity(
      req.params.id,
      req.workspace.id,
      { page, perPage }
    );
    res.json(result);
  })
);

export default router;
