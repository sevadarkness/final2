import express from 'express';
import { authenticate } from '../middlewares/auth.js';
const router = express.Router();

router.use(authenticate);
router.get('/', (req, res) => res.json({ message: 'Webhooks routes - TODO' }));

export default router;
