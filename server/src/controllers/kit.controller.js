import { asyncHandler } from '../utils/asyncHandler.js';
import { createKit, listKits, getKitForUser, deleteKit } from '../services/kit.service.js';

export const create = asyncHandler(async (req, res) => {
  const { kit, job, duplicate } = await createKit(req.userId, req.validated.body);
  
  res.status(duplicate ? 200 : 202).json({
    kit_id: kit.id,
    job_id: job?.id ?? null,
    status: kit.status,
    duplicate,
  });
});

export const list = asyncHandler(async (req, res) => {
  res.json({ kits: await listKits(req.userId) });
});

export const get = asyncHandler(async (req, res) => {
  res.json(await getKitForUser(req.userId, req.params.id));
});

export const remove = asyncHandler(async (req, res) => {
  await deleteKit(req.userId, req.params.id);
  res.status(204).end();
});