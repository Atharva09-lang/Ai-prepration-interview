import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as jobs from '../controllers/job.controller.js';

const router = Router();

router.get('/:id', requireAuth, jobs.get);

export default router;