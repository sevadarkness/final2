/**
 * Workspace Service
 * Business logic for workspace management
 */

import prisma from '../prisma.js';
import { NotFoundError, ConflictError, AuthorizationError } from '../shared/errors/AppError.js';
import { formatPaginatedResponse, parsePagination } from '../shared/utils/pagination.js';
import { slugify } from '../shared/utils/formatters.js';
import { generateToken } from '../shared/utils/crypto.js';

class WorkspaceService {
  async listWorkspaces(userId, pagination = {}) {
    const { skip, take } = parsePagination(pagination);
    
    const [workspaces, total] = await Promise.all([
      prisma.workspace.findMany({
        where: {
          members: {
            some: { userId },
          },
        },
        skip,
        take,
        include: {
          members: {
            where: { userId },
            select: { role: true, joinedAt: true },
          },
          _count: {
            select: {
              members: true,
              contacts: true,
              deals: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.workspace.count({
        where: {
          members: {
            some: { userId },
          },
        },
      }),
    ]);
    
    return formatPaginatedResponse(workspaces, total, pagination);
  }
  
  async getWorkspaceById(workspaceId, userId) {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        members: {
          some: { userId },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        _count: {
          select: {
            contacts: true,
            deals: true,
            campaigns: true,
            tasks: true,
          },
        },
      },
    });
    
    if (!workspace) {
      throw new NotFoundError('Workspace');
    }
    
    return workspace;
  }
  
  async createWorkspace(data, ownerId) {
    const { name, description, industry } = data;
    const slug = slugify(name) + '-' + generateToken(4);
    
    const workspace = await prisma.workspace.create({
      data: {
        name,
        slug,
        description,
        industry,
        members: {
          create: {
            userId: ownerId,
            role: 'owner',
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });
    
    return workspace;
  }
  
  async updateWorkspace(workspaceId, data) {
    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data,
    });
    
    return workspace;
  }
  
  async deleteWorkspace(workspaceId) {
    await prisma.workspace.delete({
      where: { id: workspaceId },
    });
    
    return { success: true };
  }
  
  async inviteMember(workspaceId, email, role, invitedBy) {
    const invite = await prisma.workspaceInvite.create({
      data: {
        workspaceId,
        email,
        role,
        invitedBy,
        token: generateToken(32),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
    
    // TODO: Send invitation email
    
    return invite;
  }
  
  async listInvites(workspaceId) {
    return prisma.workspaceInvite.findMany({
      where: {
        workspaceId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  
  async cancelInvite(inviteId) {
    await prisma.workspaceInvite.delete({
      where: { id: inviteId },
    });
    
    return { success: true };
  }
  
  async joinWorkspace(token, userId) {
    const invite = await prisma.workspaceInvite.findUnique({
      where: { token },
    });
    
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      throw new ValidationError('Invalid or expired invitation');
    }
    
    const member = await prisma.workspaceMember.create({
      data: {
        workspaceId: invite.workspaceId,
        userId,
        role: invite.role,
      },
    });
    
    await prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date(), usedBy: userId },
    });
    
    return member;
  }
  
  async updateMemberRole(workspaceId, userId, newRole) {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    
    if (!member) {
      throw new NotFoundError('Workspace member');
    }
    
    return prisma.workspaceMember.update({
      where: { id: member.id },
      data: { role: newRole },
    });
  }
  
  async removeMember(workspaceId, userId) {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    
    if (!member) {
      throw new NotFoundError('Workspace member');
    }
    
    await prisma.workspaceMember.delete({
      where: { id: member.id },
    });
    
    return { success: true };
  }
  
  async getUsage(workspaceId) {
    const [contacts, deals, campaigns, messages, aiUsage] = await Promise.all([
      prisma.contact.count({ where: { workspaceId } }),
      prisma.deal.count({ where: { workspaceId } }),
      prisma.campaign.count({ where: { workspaceId } }),
      prisma.message.count({ where: { workspaceId } }),
      prisma.aIUsageLog.aggregate({
        where: { workspaceId },
        _sum: { tokensUsed: true, cost: true },
      }),
    ]);
    
    return {
      contacts,
      deals,
      campaigns,
      messages,
      aiTokensUsed: aiUsage._sum.tokensUsed || 0,
      aiCost: aiUsage._sum.cost || 0,
    };
  }
}

export default new WorkspaceService();
