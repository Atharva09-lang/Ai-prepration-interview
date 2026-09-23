/**
 * services/practice.service.js
 *
 * Tracks flashcard practice sessions.
 *
 * Confidence scale: 1 (hard/forgot), 2 (recalled with effort), 3 (easy/confident)
 *
 * Session ordering: confidence-weighted sort — lowest confidence first,
 * then by last_reviewed_at ASC (overdue cards before recently seen ones).
 * This is a simple, defensible approach over a full spaced-repetition
 * algorithm, which would require significantly more state and tuning.
 */

import { Kit } from '../models/Kit.js';
import { AppError } from '../utils/AppError.js';
import { assertObjectId } from '../utils/objectId.js';

/**
 * Records a confidence score for one flashcard.
 *
 * @param {string} userId
 * @param {string} kitId
 * @param {string} flashcardId  e.g. 'f1'
 * @param {number} confidence   1 | 2 | 3
 * @returns {Promise<object>}   Updated practice entry
 */
export async function recordConfidence(userId, kitId, flashcardId, confidence) {
  assertObjectId(kitId, 'Kit');

  if (![1, 2, 3].includes(confidence)) {
    throw new AppError('INVALID_CONFIDENCE', 'Confidence must be 1, 2, or 3', 400);
  }

  const kit = await Kit.findOne({ _id: kitId, userId });
  if (!kit) throw new AppError('NOT_FOUND', 'Kit not found', 404);

  // Verify the flashcard exists and is not deleted
  const card = kit.flashcards.find((f) => f.id === flashcardId && !f.deleted);
  if (!card) throw new AppError('NOT_FOUND', `Flashcard ${flashcardId} not found`, 404);

  const existing = kit.practice.get(flashcardId) ?? { confidence: null, seen_count: 0, last_reviewed_at: null };
  const updated = {
    confidence,
    seen_count: (existing.seen_count ?? 0) + 1,
    last_reviewed_at: new Date(),
  };

  await Kit.updateOne(
    { _id: kitId },
    { $set: { [`practice.${flashcardId}`]: updated } },
  );

  return updated;
}

/**
 * Keeps only day numbers that still exist in the schedule, sorted and
 * de-duplicated. Day numbers go stale when the schedule is rebuilt (fewer
 * days), so every write goes through this.
 *
 * @param {unknown} days      Raw completed_days value from the document
 * @param {number}  dayCount  Number of days in the current schedule
 * @returns {number[]}
 */
export function normalizeCompletedDays(days, dayCount) {
  const max = Number.isInteger(dayCount) && dayCount > 0 ? dayCount : 0;
  if (!Array.isArray(days)) return [];
  const kept = new Set();
  for (const d of days) {
    if (Number.isInteger(d) && d >= 1 && d <= max) kept.add(d);
  }
  return [...kept].sort((a, b) => a - b);
}

/**
 * Marks a schedule day complete or not complete.
 *
 * @param {string}  userId
 * @param {string}  kitId
 * @param {number}  day        1-based day number
 * @param {boolean} completed
 * @returns {Promise<number[]>}  The kit's completed day numbers, sorted
 */
export async function setDayCompletion(userId, kitId, day, completed) {
  assertObjectId(kitId, 'Kit');

  if (!Number.isInteger(day) || day < 1) {
    throw new AppError('INVALID_DAY', 'Day must be a positive integer', 400);
  }

  const kit = await Kit.findOne({ _id: kitId, userId });
  if (!kit) throw new AppError('NOT_FOUND', 'Kit not found', 404);

  const dayCount = kit.schedule?.days?.length ?? 0;
  if (day > dayCount) {
    throw new AppError('INVALID_DAY', `This kit's schedule only has ${dayCount} day(s)`, 400);
  }

  const current = normalizeCompletedDays(kit.completed_days, dayCount);
  const next = completed
    ? normalizeCompletedDays([...current, day], dayCount)
    : current.filter((d) => d !== day);

  await Kit.updateOne({ _id: kitId }, { $set: { completed_days: next } });
  return next;
}

/**
 * Returns the flashcard IDs in practice session order.
 *
 * Ordering:
 *  1. Cards never seen (confidence null) — always first (unknown = highest priority)
 *  2. Cards with lowest confidence (1 before 2 before 3)
 *  3. Among equal confidence, least recently reviewed first
 *
 * @param {string} userId
 * @param {string} kitId
 * @returns {Promise<{ order: string[]; stats: object }>}
 */
export async function getPracticeSession(userId, kitId) {
  assertObjectId(kitId, 'Kit');

  const kit = await Kit.findOne({ _id: kitId, userId });
  if (!kit) throw new AppError('NOT_FOUND', 'Kit not found', 404);

  const activeCards = kit.flashcards.filter((f) => !f.deleted);
  const practiceMap = kit.practice;

  const withStats = activeCards.map((f) => {
    const entry = practiceMap.get(f.id);
    return {
      id: f.id,
      confidence: entry?.confidence ?? null,
      seen_count: entry?.seen_count ?? 0,
      last_reviewed_at: entry?.last_reviewed_at ?? null,
    };
  });

  // Sort: unseen first, then by confidence ASC, then by last_reviewed_at ASC (oldest first)
  withStats.sort((a, b) => {
    // Unseen always comes first
    if (a.confidence === null && b.confidence !== null) return -1;
    if (a.confidence !== null && b.confidence === null) return 1;
    if (a.confidence === null && b.confidence === null) return 0;

    // Lower confidence = higher priority
    if (a.confidence !== b.confidence) return a.confidence - b.confidence;

    // Same confidence: least recently reviewed first
    const aTime = a.last_reviewed_at ? new Date(a.last_reviewed_at).getTime() : 0;
    const bTime = b.last_reviewed_at ? new Date(b.last_reviewed_at).getTime() : 0;
    return aTime - bTime;
  });

  const total = activeCards.length;
  const seen = withStats.filter((c) => c.seen_count > 0).length;
  const confident = withStats.filter((c) => c.confidence === 3).length;

  return {
    order: withStats.map((c) => c.id),
    stats: {
      total,
      seen,
      unseen: total - seen,
      confident,
      needs_review: withStats.filter((c) => c.confidence !== null && c.confidence < 3).length,
    },
    cards: withStats,
  };
}
