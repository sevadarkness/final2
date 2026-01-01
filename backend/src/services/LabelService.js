/**
 * Label Service
 * Business logic for label management
 */

import prisma from '../prisma.js';
import { NotFoundError, ConflictError } from '../shared/errors/AppError.js';

class LabelService {
  async listLabels(workspaceId) {
    const labels = await prisma.label.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: { contacts: true },
        },
      },
      orderBy: { order: 'asc' },
    });
    
    return labels;
  }
  
  async getLabelById(labelId, workspaceId) {
    const label = await prisma.label.findFirst({
      where: { id: labelId, workspaceId },
      include: {
        _count: {
          select: { contacts: true },
        },
      },
    });
    
    if (!label) {
      throw new NotFoundError('Label');
    }
    
    return label;
  }
  
  async createLabel(data, workspaceId) {
    const { name, color, description } = data;
    
    // Check for duplicate
    const existing = await prisma.label.findFirst({
      where: {
        workspaceId,
        name: { equals: name, mode: 'insensitive' },
      },
    });
    
    if (existing) {
      throw new ConflictError('Label with this name already exists');
    }
    
    // Get max order
    const maxOrder = await prisma.label.aggregate({
      where: { workspaceId },
      _max: { order: true },
    });
    
    const label = await prisma.label.create({
      data: {
        workspaceId,
        name,
        color,
        description,
        order: (maxOrder._max.order || 0) + 1,
      },
    });
    
    return label;
  }
  
  async updateLabel(labelId, data) {
    const label = await prisma.label.update({
      where: { id: labelId },
      data,
    });
    
    return label;
  }
  
  async deleteLabel(labelId) {
    await prisma.label.delete({
      where: { id: labelId },
    });
    
    return { success: true };
  }
  
  async bulkCreate(labels, workspaceId) {
    const created = await prisma.label.createMany({
      data: labels.map((label, index) => ({
        ...label,
        workspaceId,
        order: index,
      })),
    });
    
    return created;
  }
  
  async reorder(labelIds, workspaceId) {
    await Promise.all(
      labelIds.map((id, index) =>
        prisma.label.update({
          where: { id },
          data: { order: index },
        })
      )
    );
    
    return { success: true };
  }
}

export default new LabelService();
