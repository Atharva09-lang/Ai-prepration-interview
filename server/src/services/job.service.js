import { Job } from '../models/Job.js';
import { AppError } from '../utils/AppError.js';
import { assertObjectId } from '../utils/objectId.js';

export function serializeJob(job) {
  return {
    id: job.id,
    kit_id: job.kitId.toString(),
    type: job.type,
    status: job.status,
    stage: job.stage ?? null,
    progress: job.progress.map((p) => ({
      stage: p.stage,
      status: p.status,
      detail: p.detail,
      at: p.at,
    })),
    error: job.error ?? null,
    started_at: job.startedAt ?? null,
    finished_at: job.finishedAt ?? null,
  };
}

export async function getJobForUser(userId, jobId) {
  assertObjectId(jobId, 'Job');
  const job = await Job.findOne({ _id: jobId, userId });
  if (!job) throw new AppError('NOT_FOUND', 'Job not found', 404);
  return job;
}