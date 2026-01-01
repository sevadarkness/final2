/**
 * Messages Routes
 * Complete message management and templates
 */

import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { loadWorkspace } from '../middlewares/workspace.js';
import MessageService from '../services/MessageService.js';

const router = express.Router();

router.use(authenticate);
router.use(loadWorkspace);

// List messages
router.get('/',
  asyncHandler(async (req, res) => {
    const { page, perPage, contactId, direction, type } = req.query;
    const result = await MessageService.listMessages(
      req.workspace.id,
      { contactId, direction, type },
      { page, perPage }
    );
    res.json(result);
  })
);

// Get messages by contact
router.get('/contact/:contactId',
  asyncHandler(async (req, res) => {
    const { page, perPage } = req.query;
    const result = await MessageService.getMessagesByContact(
      req.params.contactId,
      req.workspace.id,
      { page, perPage }
    );
    res.json(result);
  })
);

// Create message
router.post('/',
  asyncHandler(async (req, res) => {
    const message = await MessageService.createMessage(req.body, req.workspace.id);
    res.status(201).json(message);
  })
);

// Search messages
router.get('/search',
  asyncHandler(async (req, res) => {
    const { q, page, perPage } = req.query;
    const result = await MessageService.searchMessages(req.workspace.id, q, { page, perPage });
    res.json(result);
  })
);

// Get templates
router.get('/templates',
  asyncHandler(async (req, res) => {
    const templates = await MessageService.listTemplates(req.workspace.id);
    res.json(templates);
  })
);

// Create template
router.post('/templates',
  asyncHandler(async (req, res) => {
    const template = await MessageService.createTemplate(req.body, req.workspace.id, req.user.id);
    res.status(201).json(template);
  })
);

// Update template
router.put('/templates/:id',
  asyncHandler(async (req, res) => {
    const template = await MessageService.updateTemplate(req.params.id, req.body);
    res.json(template);
  })
);

// Delete template
router.delete('/templates/:id',
  asyncHandler(async (req, res) => {
    await MessageService.deleteTemplate(req.params.id);
    res.status(204).send();
  })
);

// Get statistics
router.get('/stats',
  asyncHandler(async (req, res) => {
    const { start, end } = req.query;
    const stats = await MessageService.getStats(req.workspace.id, { start, end });
    res.json(stats);
  })
);

export default router;
