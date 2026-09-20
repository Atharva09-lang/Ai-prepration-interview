import { asyncHandler } from '../utils/asyncHandler.js';
import { getJobForUser, serializeJob } from '../services/job.service.js';

export const get = asyncHandler(async (req, res) => {
  const job = await getJobForUser(req.userId, req.params.id);
  res.json({ job: serializeJob(job) });
});