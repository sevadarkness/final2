/**
 * Labels Routes
 * Complete label management
 */

import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { loadWorkspace } from '../middlewares/workspace.js';
import LabelService from '../services/LabelService.js';

const router = express.Router();

router.use(authenticate);
router.use(loadWorkspace);

// List all labels
router.get('/',
  asyncHandler(async (req, res) => {
    const labels = await LabelService.listLabels(req.workspace.id);
    res.json(labels);
  })
);

// Get label by ID
router.get('/:id',
  asyncHandler(async (req, res) => {
    const label = await LabelService.getLabelById(req.params.id, req.workspace.id);
    res.json(label);
  })
);

// Create label
router.post('/',
  asyncHandler(async (req, res) => {
    const label = await LabelService.createLabel(req.body, req.workspace.id);
    res.status(201).json(label);
  })
);

// Update label
router.put('/:id',
  asyncHandler(async (req, res) => {
    const label = await LabelService.updateLabel(req.params.id, req.body);
    res.json(label);
  })
);

// Delete label
router.delete('/:id',
  asyncHandler(async (req, res) => {
    await LabelService.deleteLabel(req.params.id);
    res.status(204).send();
  })
);

// Bulk create labels
router.post('/bulk',
  asyncHandler(async (req, res) => {
    const { labels } = req.body;
    const result = await LabelService.bulkCreate(labels, req.workspace.id);
    res.status(201).json(result);
  })
);

// Reorder labels
router.patch('/reorder',
  asyncHandler(async (req, res) => {
    const { labelIds } = req.body;
    await LabelService.reorder(labelIds, req.workspace.id);
    res.json({ success: true });
  })
);

export default router;
