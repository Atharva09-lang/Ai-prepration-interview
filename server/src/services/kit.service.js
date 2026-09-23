import { Kit } from '../models/Kit.js';
import { Job } from '../models/Job.js';
import { AppError } from '../utils/AppError.js';
import { makeDedupeKey } from '../utils/dedupe.js';
import { assertObjectId } from '../utils/objectId.js';
import { startGenerationJob } from './jobRunner.js';
import { serializeJob } from './job.service.js';
import { summarizePractice } from './practice.service.js';

const latestJob = (kitId) => Job.findOne({ kitId }).sort({ createdAt: -1 });

async function startNewJob(kit) {
  const job = await Job.create({ kitId: kit._id, userId: kit.userId, type: 'generate' });
  startGenerationJob(job._id);
  return job;
}


async function reuseExisting(kit) {

  const restarted = await Kit.findOneAndUpdate(
    { _id: kit._id, status: 'failed' },
    { $set: { status: 'generating' } },
    { new: true },
  );
  if (restarted) {
    return { kit: restarted, job: await startNewJob(restarted), duplicate: false };
  }
  return { kit, job: await latestJob(kit._id), duplicate: true };
}

export async function createKit(userId, input) {
  const dedupeKey = makeDedupeKey(input);

  const existing = await Kit.findOne({ userId, dedupeKey });
  if (existing) return reuseExisting(existing);

  let kit;
  try {
    kit = await Kit.create({ userId, dedupeKey, input, status: 'generating' });
  } catch (err) {
   
    if (err?.code === 11000) return reuseExisting(await Kit.findOne({ userId, dedupeKey }));
    throw err;
  }
  return { kit, job: await startNewJob(kit), duplicate: false };
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function toSummary(kit) {
  return {
    id: kit.id,
    status: kit.status,
    title: kit.source?.role || 'Untitled role',
    company: kit.source?.company || hostnameOf(kit.input.company_url),
    company_url: kit.input.company_url,
    days: kit.input.days,
    updated_at: kit.updatedAt,
    progress: {
      ...summarizePractice(kit),
      schedule_days: kit.schedule?.days?.length ?? 0,
      schedule_done: kit.completed_days?.length ?? 0,
    },
  };
}

export async function listKits(userId) {
  const kits = await Kit.find({ userId })
    .sort({ updatedAt: -1 })
    .limit(100)
    .select(
      'status input.company_url input.days source.role source.company updatedAt ' +
        'flashcards.id flashcards.deleted practice schedule.days completed_days',
    );
  return kits.map(toSummary);
}

export async function getKitForUser(userId, kitId) {
  assertObjectId(kitId, 'Kit');
  const kit = await Kit.findOne({ _id: kitId, userId });
  if (!kit) throw new AppError('NOT_FOUND', 'Kit not found', 404);
  const job = await latestJob(kit._id);
  return { kit: kit.toJSON(), job: job ? serializeJob(job) : null };
}

export async function deleteKit(userId, kitId) {
  assertObjectId(kitId, 'Kit');
  const { deletedCount } = await Kit.deleteOne({ _id: kitId, userId });
  if (!deletedCount) throw new AppError('NOT_FOUND', 'Kit not found', 404);
  await Job.deleteMany({ kitId });
}