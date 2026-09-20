import { Job } from '../models/Job.js';
import { Kit } from '../models/Kit.js';
import { runPipeline } from '../pipeline/runPipeline.js';
import { kitToDocFields } from './kitMapper.js';
import { AppError } from '../utils/AppError.js';


export function startGenerationJob(jobId) {
  setImmediate(() => {
    runGenerationJob(jobId).catch((err) => console.error('[job] unexpected failure', err));
  });
}

async function runGenerationJob(jobId) {
  
  const job = await Job.findOneAndUpdate(
    { _id: jobId, status: 'queued' },
    { $set: { status: 'running', startedAt: new Date() } },
    { new: true },
  );
  if (!job) return;

  const kit = await Kit.findById(job.kitId);
  if (!kit) {
    await markFailed(job, new AppError('KIT_NOT_FOUND', 'The kit no longer exists', 404));
    return;
  }

  
  let writes = Promise.resolve();
  const onProgress = ({ stage, status, detail }) => {
    writes = writes
      .then(() =>
        Job.updateOne(
          { _id: jobId },
          {
            $set: { stage },
            $push: { progress: { stage, status, detail: detail ?? '', at: new Date() } },
          },
        ),
      )
      .catch((err) => console.error('[job] progress write failed', err));
  };

  try {
    const { input } = kit.toObject();
    const generated = await runPipeline(input, { onProgress });
    await writes;
    await Kit.updateOne(
      { _id: kit._id, status: 'generating' },
      { $set: { ...kitToDocFields(generated), status: 'ready' } },
    );
    await Job.updateOne({ _id: jobId }, { $set: { status: 'succeeded', finishedAt: new Date() } });
  } catch (err) {
    await writes;
    await markFailed(job, err);
  }
}

async function markFailed(job, err) {
  const expected = err instanceof AppError;
  if (!expected) console.error('[job] pipeline crashed', err);
  const error = {
    code: expected ? err.code : 'PIPELINE_FAILED',
    message: expected ? err.message : 'Kit generation failed unexpectedly. Please try again.',
  };
  await Job.updateOne({ _id: job._id }, { $set: { status: 'failed', error, finishedAt: new Date() } });
  await Kit.updateOne({ _id: job.kitId, status: 'generating' }, { $set: { status: 'failed' } });
}

export async function recoverStaleJobs() {
  const stale = await Job.find({ status: { $in: ['queued', 'running'] } }).select('_id kitId');
  if (!stale.length) return 0;
  const error = {
    code: 'SERVER_RESTARTED',
    message: 'Generation was interrupted by a server restart. Please try again.',
  };
  await Job.updateMany(
    { _id: { $in: stale.map((j) => j._id) } },
    { $set: { status: 'failed', error, finishedAt: new Date() } },
  );
  await Kit.updateMany(
    { _id: { $in: stale.map((j) => j.kitId) }, status: 'generating' },
    { $set: { status: 'failed' } },
  );
  return stale.length;
}