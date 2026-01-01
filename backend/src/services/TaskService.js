/**
 * Task Service
 * Business logic for task management
 */

import prisma from '../prisma.js';
import { NotFoundError } from '../shared/errors/AppError.js';
import { formatPaginatedResponse, parsePagination } from '../shared/utils/pagination.js';

class TaskService {
  async listTasks(workspaceId, filters = {}, pagination = {}) {
    const { skip, take, page, perPage } = parsePagination(pagination);
    const { status, priority, assigneeId, dueDate } = filters;
    
    const where = {
      workspaceId,
      ...(status && { status }),
      ...(priority && { priority }),
      ...(assigneeId && { assignedTo: assigneeId }),
      ...(dueDate && {
        dueDate: {
          gte: new Date(dueDate),
          lt: new Date(new Date(dueDate).getTime() + 24 * 60 * 60 * 1000),
        },
      }),
    };
    
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take,
        include: {
          assignedToUser: {
            select: { id: true, name: true, avatar: true },
          },
          contact: {
            select: { id: true, name: true },
          },
          deal: {
            select: { id: true, title: true },
          },
        },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.task.count({ where }),
    ]);
    
    return formatPaginatedResponse(tasks, total, { page, perPage });
  }
  
  async getTasksToday(workspaceId, userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return prisma.task.findMany({
      where: {
        workspaceId,
        assignedTo: userId,
        dueDate: {
          gte: today,
          lt: tomorrow,
        },
        status: { not: 'completed' },
      },
      include: {
        contact: { select: { id: true, name: true } },
        deal: { select: { id: true, title: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }
  
  async getUpcomingTasks(workspaceId, userId, days = 7) {
    const today = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);
    
    return prisma.task.findMany({
      where: {
        workspaceId,
        assignedTo: userId,
        dueDate: {
          gte: today,
          lte: future,
        },
        status: { not: 'completed' },
      },
      include: {
        contact: { select: { id: true, name: true } },
        deal: { select: { id: true, title: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }
  
  async getTaskById(taskId, workspaceId) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, workspaceId },
      include: {
        assignedToUser: {
          select: { id: true, name: true, avatar: true },
        },
        contact: true,
        deal: true,
      },
    });
    
    if (!task) {
      throw new NotFoundError('Task');
    }
    
    return task;
  }
  
  async createTask(data, workspaceId, createdBy) {
    const task = await prisma.task.create({
      data: {
        ...data,
        workspaceId,
        createdBy,
      },
      include: {
        assignedToUser: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });
    
    return task;
  }
  
  async updateTask(taskId, data) {
    const task = await prisma.task.update({
      where: { id: taskId },
      data,
      include: {
        assignedToUser: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });
    
    return task;
  }
  
  async updateStatus(taskId, status) {
    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        status,
        ...(status === 'completed' && { completedAt: new Date() }),
      },
    });
    
    return task;
  }
  
  async reassignTask(taskId, newAssigneeId) {
    const task = await prisma.task.update({
      where: { id: taskId },
      data: { assignedTo: newAssigneeId },
      include: {
        assignedToUser: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });
    
    return task;
  }
  
  async deleteTask(taskId) {
    await prisma.task.delete({
      where: { id: taskId },
    });
    
    return { success: true };
  }
  
  async addReminder(taskId, reminderData) {
    const reminder = await prisma.taskReminder.create({
      data: {
        taskId,
        ...reminderData,
      },
    });
    
    return reminder;
  }
}

export default new TaskService();
