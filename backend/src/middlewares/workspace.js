/**
 * Workspace Middleware
 * Loads workspace context and validates membership
 */

import prisma from '../prisma.js';
import { NotFoundError, AuthorizationError } from '../shared/errors/AppError.js';

/**
 * Load workspace and validate user is a member
 */
export async function loadWorkspace(req, res, next) {
  try {
    const workspaceId = req.params.workspaceId || req.body.workspaceId || req.query.workspaceId;
    
    if (!workspaceId) {
      throw new Error('Workspace ID is required');
    }
    
    // Find workspace
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          where: { userId: req.user.id },
        },
      },
    });
    
    if (!workspace) {
      throw new NotFoundError('Workspace');
    }
    
    // Check if user is a member
    if (workspace.members.length === 0) {
      throw new AuthorizationError('You are not a member of this workspace');
    }
    
    // Attach workspace and membership to request
    req.workspace = workspace;
    req.membership = workspace.members[0];
    
    next();
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof AuthorizationError) {
      return res.status(error.statusCode).json({
        error: error.code,
        message: error.message,
      });
    }
    
    return res.status(400).json({
      error: 'Bad request',
      message: error.message,
    });
  }
}

/**
 * Require specific workspace role
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.membership) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Workspace membership required',
      });
    }
    
    if (!roles.includes(req.membership.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Required role: ${roles.join(' or ')}`,
      });
    }
    
    next();
  };
}

export default { loadWorkspace, requireRole };
