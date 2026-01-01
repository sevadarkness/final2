/**
 * Message Service
 * Business logic for message management
 */

import prisma from '../prisma.js';
import { NotFoundError } from '../shared/errors/AppError.js';
import { formatPaginatedResponse, parsePagination } from '../shared/utils/pagination.js';

class MessageService {
  async listMessages(workspaceId, filters = {}, pagination = {}) {
    const { skip, take, page, perPage } = parsePagination(pagination);
    const { contactId, direction, type } = filters;
    
    const where = {
      workspaceId,
      ...(contactId && { contactId }),
      ...(direction && { direction }),
      ...(type && { type }),
    };
    
    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        skip,
        take,
        include: {
          contact: {
            select: { id: true, name: true, phone: true },
          },
        },
        orderBy: { timestamp: 'desc' },
      }),
      prisma.message.count({ where }),
    ]);
    
    return formatPaginatedResponse(messages, total, { page, perPage });
  }
  
  async getMessagesByContact(contactId, workspaceId, pagination = {}) {
    const { skip, take, page, perPage } = parsePagination(pagination);
    
    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { contactId, workspaceId },
        skip,
        take,
        orderBy: { timestamp: 'desc' },
      }),
      prisma.message.count({ where: { contactId, workspaceId } }),
    ]);
    
    return formatPaginatedResponse(messages, total, { page, perPage });
  }
  
  async createMessage(data, workspaceId) {
    const message = await prisma.message.create({
      data: {
        ...data,
        workspaceId,
      },
      include: {
        contact: {
          select: { id: true, name: true },
        },
      },
    });
    
    return message;
  }
  
  async searchMessages(workspaceId, searchTerm, pagination = {}) {
    const { skip, take, page, perPage } = parsePagination(pagination);
    
    const where = {
      workspaceId,
      OR: [
        { content: { contains: searchTerm, mode: 'insensitive' } },
        {
          contact: {
            name: { contains: searchTerm, mode: 'insensitive' },
          },
        },
      ],
    };
    
    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        skip,
        take,
        include: {
          contact: {
            select: { id: true, name: true, phone: true },
          },
        },
        orderBy: { timestamp: 'desc' },
      }),
      prisma.message.count({ where }),
    ]);
    
    return formatPaginatedResponse(messages, total, { page, perPage });
  }
  
  async listTemplates(workspaceId) {
    return prisma.messageTemplate.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });
  }
  
  async createTemplate(data, workspaceId, createdBy) {
    const template = await prisma.messageTemplate.create({
      data: {
        ...data,
        workspaceId,
        createdBy,
      },
    });
    
    return template;
  }
  
  async updateTemplate(templateId, data) {
    const template = await prisma.messageTemplate.update({
      where: { id: templateId },
      data,
    });
    
    return template;
  }
  
  async deleteTemplate(templateId) {
    await prisma.messageTemplate.delete({
      where: { id: templateId },
    });
    
    return { success: true };
  }
  
  async getStats(workspaceId, dateRange = {}) {
    const { start, end } = dateRange;
    const where = {
      workspaceId,
      ...(start && end && {
        timestamp: {
          gte: new Date(start),
          lte: new Date(end),
        },
      }),
    };
    
    const [total, byDirection, byType] = await Promise.all([
      prisma.message.count({ where }),
      prisma.message.groupBy({
        by: ['direction'],
        where,
        _count: true,
      }),
      prisma.message.groupBy({
        by: ['type'],
        where,
        _count: true,
      }),
    ]);
    
    return {
      total,
      byDirection,
      byType,
    };
  }
}

export default new MessageService();
