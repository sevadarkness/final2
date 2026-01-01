/**
 * User Service
 * Business logic for user management
 */

import prisma from '../prisma.js';
import { hashPassword } from '../shared/utils/crypto.js';
import { NotFoundError, ConflictError, ValidationError } from '../shared/errors/AppError.js';
import { formatPaginatedResponse, parsePagination } from '../shared/utils/pagination.js';

class UserService {
  /**
   * List users in workspace with pagination and filters
   */
  async listUsers(workspaceId, filters = {}, pagination = {}) {
    const { skip, take } = parsePagination(pagination);
    const { search, role, isActive } = filters;
    
    const where = {
      workspaceMembers: {
        some: {
          workspaceId,
          ...(role && { role }),
        },
      },
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          phone: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
          workspaceMembers: {
            where: { workspaceId },
            select: { role: true, joinedAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);
    
    return formatPaginatedResponse(users, total, pagination);
  }
  
  /**
   * Get user by ID with details
   */
  async getUserById(userId, workspaceId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        phone: true,
        timezone: true,
        language: true,
        isActive: true,
        isVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        workspaceMembers: {
          where: { workspaceId },
          select: {
            role: true,
            joinedAt: true,
          },
        },
      },
    });
    
    if (!user) {
      throw new NotFoundError('User');
    }
    
    return user;
  }
  
  /**
   * Create new user (invite)
   */
  async createUser(data, workspaceId, invitedBy) {
    const { email, name, phone, role = 'member' } = data;
    
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });
    
    if (existing) {
      throw new ConflictError('User with this email already exists');
    }
    
    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await hashPassword(tempPassword);
    
    // Create user and workspace membership
    const user = await prisma.user.create({
      data: {
        email,
        name,
        phone,
        password: hashedPassword,
        workspaceMembers: {
          create: {
            workspaceId,
            role,
            invitedBy,
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
      },
    });
    
    // TODO: Send invitation email with temp password
    
    return { user, tempPassword };
  }
  
  /**
   * Update user
   */
  async updateUser(userId, data) {
    const { name, phone, avatar, timezone, language } = data;
    
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(avatar && { avatar }),
        ...(timezone && { timezone }),
        ...(language && { language }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        phone: true,
        timezone: true,
        language: true,
        updatedAt: true,
      },
    });
    
    return user;
  }
  
  /**
   * Change user role in workspace
   */
  async changeRole(userId, workspaceId, newRole) {
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId,
      },
    });
    
    if (!membership) {
      throw new NotFoundError('Workspace membership');
    }
    
    const updated = await prisma.workspaceMember.update({
      where: { id: membership.id },
      data: { role: newRole },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
    
    return updated;
  }
  
  /**
   * Remove user from workspace (soft delete)
   */
  async removeUser(userId, workspaceId) {
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId,
      },
    });
    
    if (!membership) {
      throw new NotFoundError('Workspace membership');
    }
    
    await prisma.workspaceMember.delete({
      where: { id: membership.id },
    });
    
    return { success: true };
  }
  
  /**
   * Update user avatar
   */
  async updateAvatar(userId, avatarUrl) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
      select: {
        id: true,
        avatar: true,
      },
    });
    
    return user;
  }
  
  /**
   * Get user activity history
   */
  async getUserActivity(userId, workspaceId, pagination = {}) {
    const { skip, take } = parsePagination(pagination);
    
    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where: {
          userId,
          workspaceId,
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          contact: {
            select: { id: true, name: true },
          },
          deal: {
            select: { id: true, title: true },
          },
        },
      }),
      prisma.activity.count({
        where: { userId, workspaceId },
      }),
    ]);
    
    return formatPaginatedResponse(activities, total, pagination);
  }
}

export default new UserService();
