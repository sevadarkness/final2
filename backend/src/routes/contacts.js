/**
 * Contacts Routes
 * Complete CRM contact management
 */

import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { loadWorkspace } from '../middlewares/workspace.js';
import ContactService from '../services/ContactService.js';

const router = express.Router();

router.use(authenticate);
router.use(loadWorkspace);

// List contacts with filters
router.get('/',
  asyncHandler(async (req, res) => {
    const { page, perPage, search, stage, labels, minScore, maxScore, sortBy, order } = req.query;
    const result = await ContactService.listContacts(
      req.workspace.id,
      { search, stage, labels: labels ? labels.split(',') : undefined, minScore, maxScore, sortBy, order },
      { page, perPage }
    );
    res.json(result);
  })
);

// Get contact details
router.get('/:id',
  asyncHandler(async (req, res) => {
    const contact = await ContactService.getContactById(req.params.id, req.workspace.id);
    res.json(contact);
  })
);

// Get contact timeline
router.get('/:id/timeline',
  asyncHandler(async (req, res) => {
    const { page, perPage } = req.query;
    const result = await ContactService.getContactTimeline(req.params.id, req.workspace.id, { page, perPage });
    res.json(result);
  })
);

// Create contact
router.post('/',
  asyncHandler(async (req, res) => {
    const contact = await ContactService.createContact(req.body, req.workspace.id, req.user.id);
    res.status(201).json(contact);
  })
);

// Update contact
router.put('/:id',
  asyncHandler(async (req, res) => {
    const contact = await ContactService.updateContact(req.params.id, req.body, req.workspace.id, req.user.id);
    res.json(contact);
  })
);

// Move contact stage
router.patch('/:id/stage',
  asyncHandler(async (req, res) => {
    const { stage } = req.body;
    const contact = await ContactService.moveStage(req.params.id, stage, req.workspace.id, req.user.id);
    res.json(contact);
  })
);

// Delete contact (soft delete)
router.delete('/:id',
  asyncHandler(async (req, res) => {
    await ContactService.deleteContact(req.params.id, req.workspace.id, req.user.id);
    res.status(204).send();
  })
);

// Add labels
router.post('/:id/labels',
  asyncHandler(async (req, res) => {
    const { labels } = req.body;
    const contact = await ContactService.addLabels(req.params.id, labels, req.workspace.id, req.user.id);
    res.json(contact);
  })
);

// Remove label
router.delete('/:id/labels/:labelId',
  asyncHandler(async (req, res) => {
    await ContactService.removeLabel(req.params.id, req.params.labelId);
    res.status(204).send();
  })
);

// Add note
router.post('/:id/notes',
  asyncHandler(async (req, res) => {
    const { note } = req.body;
    const activity = await ContactService.addNote(req.params.id, note, req.workspace.id, req.user.id);
    res.status(201).json(activity);
  })
);

// Import CSV
router.post('/import',
  asyncHandler(async (req, res) => {
    const result = await ContactService.importCSV(req.body.data, req.workspace.id, req.user.id);
    res.json(result);
  })
);

// Export CSV
router.get('/export',
  asyncHandler(async (req, res) => {
    const contacts = await ContactService.exportCSV(req.workspace.id);
    res.json(contacts);
  })
);

// Merge contacts
router.post('/merge',
  asyncHandler(async (req, res) => {
    const { primaryId, secondaryIds } = req.body;
    const contact = await ContactService.mergeContacts(primaryId, secondaryIds, req.workspace.id);
    res.json(contact);
  })
);

// Detect duplicates
router.get('/duplicates',
  asyncHandler(async (req, res) => {
    const duplicates = await ContactService.detectDuplicates(req.workspace.id);
    res.json(duplicates);
  })
);

export default router;
