import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createKitSchema } from '../validators/createKit.schema.js';
import * as kits from '../controllers/kit.controller.js';

const router = Router();

router.use(requireAuth); 

router.post('/', validate(createKitSchema), kits.create);
router.get('/', kits.list);
router.get('/:id', kits.get);
router.delete('/:id', kits.remove);

export default router;