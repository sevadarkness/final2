/**
 * Permissions Middleware
 * RBAC (Role-Based Access Control) for fine-grained permissions
 */

import { AuthorizationError } from '../shared/errors/AppError.js';

// Define role hierarchy (higher number = more permissions)
const ROLE_HIERARCHY = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
};

// Permission definitions
const PERMISSIONS = {
  // User permissions
  'users:read': ['viewer', 'member', 'admin', 'owner'],
  'users:create': ['admin', 'owner'],
  'users:update': ['admin', 'owner'],
  'users:delete': ['owner'],
  
  // Contact permissions
  'contacts:read': ['viewer', 'member', 'admin', 'owner'],
  'contacts:create': ['member', 'admin', 'owner'],
  'contacts:update': ['member', 'admin', 'owner'],
  'contacts:delete': ['admin', 'owner'],
  
  // Deal permissions
  'deals:read': ['viewer', 'member', 'admin', 'owner'],
  'deals:create': ['member', 'admin', 'owner'],
  'deals:update': ['member', 'admin', 'owner'],
  'deals:delete': ['admin', 'owner'],
  
  // Campaign permissions
  'campaigns:read': ['member', 'admin', 'owner'],
  'campaigns:create': ['admin', 'owner'],
  'campaigns:update': ['admin', 'owner'],
  'campaigns:delete': ['admin', 'owner'],
  'campaigns:start': ['admin', 'owner'],
  
  // Workspace settings
  'workspace:update': ['admin', 'owner'],
  'workspace:delete': ['owner'],
  'workspace:invite': ['admin', 'owner'],
  'workspace:members': ['admin', 'owner'],
  
  // Billing permissions
  'billing:read': ['owner'],
  'billing:update': ['owner'],
  
  // Analytics permissions
  'analytics:read': ['member', 'admin', 'owner'],
  'analytics:export': ['admin', 'owner'],
};

/**
 * Check if user has permission
 */
export function hasPermission(userRole, permission) {
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) {
    return false;
  }
  return allowedRoles.includes(userRole);
}

/**
 * Middleware to require specific permission
 */
export function requirePermission(permission) {
  return (req, res, next) => {
    // Check if membership exists (from workspace middleware)
    if (!req.membership) {
      throw new AuthorizationError('Workspace membership required');
    }
    
    const userRole = req.membership.role;
    
    if (!hasPermission(userRole, permission)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Permission denied: ${permission}`,
      });
    }
    
    next();
  };
}

/**
 * Middleware to require minimum role level
 */
export function requireMinRole(minRole) {
  return (req, res, next) => {
    if (!req.membership) {
      throw new AuthorizationError('Workspace membership required');
    }
    
    const userRoleLevel = ROLE_HIERARCHY[req.membership.role] || 0;
    const minRoleLevel = ROLE_HIERARCHY[minRole] || 0;
    
    if (userRoleLevel < minRoleLevel) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Minimum required role: ${minRole}`,
      });
    }
    
    next();
  };
}

/**
 * Check if user owns the resource
 */
export async function isResourceOwner(req, res, next) {
  // This would check if req.user.id matches the resource's userId
  // Implementation depends on the specific resource
  next();
}

export default {
  hasPermission,
  requirePermission,
  requireMinRole,
  isResourceOwner,
  PERMISSIONS,
  ROLE_HIERARCHY,
};
