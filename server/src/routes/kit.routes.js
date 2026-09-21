import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createKitSchema } from '../validators/createKit.schema.js';
import * as kits from '../controllers/kit.controller.js';

const router = Router();

// All kit routes require auth
router.use(requireAuth);

// ── Kit CRUD ──────────────────────────────────────────────────────────────────
router.post('/',    validate(createKitSchema), kits.create);
router.get('/',     kits.list);
router.get('/:id',  kits.get);
router.delete('/:id', kits.remove);

// ── Kit builder — section updates ─────────────────────────────────────────────
// Partial update (edit brief text, role fields, etc.)
router.patch('/:id', kits.patch);

// Regenerate one section: body { section: 'brief' | category | 'flashcards' | 'schedule' }
router.post('/:id/regenerate', kits.regenerate);

// ── Questions ─────────────────────────────────────────────────────────────────
router.post('/:id/questions',         kits.addQuestion);
router.patch('/:id/questions/:qid',   kits.updateQuestion);
router.delete('/:id/questions/:qid',  kits.deleteQuestion);

// ── Flashcards ────────────────────────────────────────────────────────────────
router.post('/:id/flashcards',        kits.addFlashcard);
router.patch('/:id/flashcards/:fid',  kits.updateFlashcard);
router.delete('/:id/flashcards/:fid', kits.deleteFlashcard);

// ── Practice ──────────────────────────────────────────────────────────────────
router.get('/:id/practice',                  kits.getPractice);
router.post('/:id/practice/:fid/confidence', kits.postConfidence);

export default router;