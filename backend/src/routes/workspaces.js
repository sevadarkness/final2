/**
 * Workspaces Routes
 * Complete workspace management with invites and members
 */

import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { loadWorkspace, requireRole } from '../middlewares/workspace.js';
import WorkspaceService from '../services/WorkspaceService.js';

const router = express.Router();

router.use(authenticate);

// List user's workspaces
router.get('/',
  asyncHandler(async (req, res) => {
    const { page, perPage } = req.query;
    const result = await WorkspaceService.listWorkspaces(req.user.id, { page, perPage });
    res.json(result);
  })
);

// Get workspace details
router.get('/:workspaceId',
  asyncHandler(async (req, res) => {
    const workspace = await WorkspaceService.getWorkspaceById(req.params.workspaceId, req.user.id);
    res.json(workspace);
  })
);

// Create workspace
router.post('/',
  asyncHandler(async (req, res) => {
    const workspace = await WorkspaceService.createWorkspace(req.body, req.user.id);
    res.status(201).json(workspace);
  })
);

// Update workspace
router.put('/:workspaceId',
  loadWorkspace,
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const workspace = await WorkspaceService.updateWorkspace(req.params.workspaceId, req.body);
    res.json(workspace);
  })
);

// Delete workspace
router.delete('/:workspaceId',
  loadWorkspace,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    await WorkspaceService.deleteWorkspace(req.params.workspaceId);
    res.status(204).send();
  })
);

// Invite member
router.post('/:workspaceId/invite',
  loadWorkspace,
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const { email, role } = req.body;
    const invite = await WorkspaceService.inviteMember(
      req.params.workspaceId,
      email,
      role,
      req.user.id
    );
    res.status(201).json(invite);
  })
);

// List invites
router.get('/:workspaceId/invites',
  loadWorkspace,
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const invites = await WorkspaceService.listInvites(req.params.workspaceId);
    res.json(invites);
  })
);

// Cancel invite
router.delete('/:workspaceId/invites/:inviteId',
  loadWorkspace,
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    await WorkspaceService.cancelInvite(req.params.inviteId);
    res.status(204).send();
  })
);

// Accept invite
router.post('/:workspaceId/join',
  asyncHandler(async (req, res) => {
    const { token } = req.body;
    const member = await WorkspaceService.joinWorkspace(token, req.user.id);
    res.status(201).json(member);
  })
);

// Update member role
router.patch('/:workspaceId/members/:userId',
  loadWorkspace,
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const { role } = req.body;
    const member = await WorkspaceService.updateMemberRole(
      req.params.workspaceId,
      req.params.userId,
      role
    );
    res.json(member);
  })
);

// Remove member
router.delete('/:workspaceId/members/:userId',
  loadWorkspace,
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    await WorkspaceService.removeMember(req.params.workspaceId, req.params.userId);
    res.status(204).send();
  })
);

// Get workspace usage
router.get('/:workspaceId/usage',
  loadWorkspace,
  asyncHandler(async (req, res) => {
    const usage = await WorkspaceService.getUsage(req.params.workspaceId);
    res.json(usage);
  })
);

export default router;
