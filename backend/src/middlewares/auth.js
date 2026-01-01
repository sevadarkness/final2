/**
 * Authentication Middleware
 * JWT token verification and user authorization
 */

import jwt from 'jsonwebtoken';
import prisma from '../prisma.js';

/**
 * Verifica JWT token e adiciona user ao request
 */
export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if session exists
    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            isActive: true
          }
        }
      }
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token expired or invalid'
      });
    }

    if (!session.user.isActive) {
      return res.status(403).json({
        error: 'User inactive',
        message: 'User account is inactive'
      });
    }

    // Add user to request
    req.user = session.user;
    req.session = session;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is invalid'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Token has expired'
      });
    }

    return res.status(500).json({
      error: 'Authentication error',
      message: error.message
    });
  }
};

/**
 * Verifica se usuário tem acesso ao workspace
 */
export const authorizeWorkspace = (roles = []) => {
  return async (req, res, next) => {
    try {
      const { workspaceId } = req.params;
      const userId = req.user.id;

      const member = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId
          }
        }
      });

      if (!member) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have access to this workspace'
        });
      }

      // Check role if specified
      if (roles.length > 0 && !roles.includes(member.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: `Required role: ${roles.join(' or ')}`
        });
      }

      req.workspaceMember = member;
      next();
    } catch (error) {
      return res.status(500).json({
        error: 'Authorization error',
        message: error.message
      });
    }
  };
};

/**
 * Verifica se usuário é admin ou owner
 */
export const requireAdmin = authorizeWorkspace(['owner', 'admin']);

/**
 * Verifica se usuário é owner
 */
export const requireOwner = authorizeWorkspace(['owner']);

export default {
  authenticate,
  authorizeWorkspace,
  requireAdmin,
  requireOwner
};
