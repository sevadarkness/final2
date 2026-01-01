/**
 * Tasks Routes
 * Complete task management
 */

import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { loadWorkspace } from '../middlewares/workspace.js';
import TaskService from '../services/TaskService.js';

const router = express.Router();

router.use(authenticate);
router.use(loadWorkspace);

// List tasks with filters
router.get('/',
  asyncHandler(async (req, res) => {
    const { page, perPage, status, priority, assigneeId, dueDate } = req.query;
    const result = await TaskService.listTasks(
      req.workspace.id,
      { status, priority, assigneeId, dueDate },
      { page, perPage }
    );
    res.json(result);
  })
);

// Get today's tasks
router.get('/today',
  asyncHandler(async (req, res) => {
    const tasks = await TaskService.getTasksToday(req.workspace.id, req.user.id);
    res.json(tasks);
  })
);

// Get upcoming tasks
router.get('/upcoming',
  asyncHandler(async (req, res) => {
    const { days = 7 } = req.query;
    const tasks = await TaskService.getUpcomingTasks(req.workspace.id, req.user.id, parseInt(days));
    res.json(tasks);
  })
);

// Get task details
router.get('/:id',
  asyncHandler(async (req, res) => {
    const task = await TaskService.getTaskById(req.params.id, req.workspace.id);
    res.json(task);
  })
);

// Create task
router.post('/',
  asyncHandler(async (req, res) => {
    const task = await TaskService.createTask(req.body, req.workspace.id, req.user.id);
    res.status(201).json(task);
  })
);

// Update task
router.put('/:id',
  asyncHandler(async (req, res) => {
    const task = await TaskService.updateTask(req.params.id, req.body);
    res.json(task);
  })
);

// Update task status
router.patch('/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    const task = await TaskService.updateStatus(req.params.id, status);
    res.json(task);
  })
);

// Reassign task
router.patch('/:id/assignee',
  asyncHandler(async (req, res) => {
    const { assigneeId } = req.body;
    const task = await TaskService.reassignTask(req.params.id, assigneeId);
    res.json(task);
  })
);

// Delete task
router.delete('/:id',
  asyncHandler(async (req, res) => {
    await TaskService.deleteTask(req.params.id);
    res.status(204).send();
  })
);

// Add reminder
router.post('/:id/reminder',
  asyncHandler(async (req, res) => {
    const reminder = await TaskService.addReminder(req.params.id, req.body);
    res.status(201).json(reminder);
  })
);

export default router;
