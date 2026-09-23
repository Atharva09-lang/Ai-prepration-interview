import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { createKit, listKits, getKitForUser, deleteKit } from '../services/kit.service.js';
import { regenerateSection } from '../services/regenerate.service.js';
import { recordConfidence, getPracticeSession } from '../services/practice.service.js';
import { Kit } from '../models/Kit.js';
import { assertObjectId } from '../utils/objectId.js';
import { buildSchedule } from '../pipeline/schedule.js';
import { findUncoveredRequirements } from '../pipeline/coverage.js';



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


export const patch = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'Kit');
  const kit = await Kit.findOne({ _id: req.params.id, userId: req.userId });
  if (!kit) throw new AppError('NOT_FOUND', 'Kit not found', 404);

  const updates = {};
  const { company_brief, role } = req.body;

  if (company_brief !== undefined) {
    if (typeof company_brief.summary === 'string') {
      updates['company_brief.summary'] = company_brief.summary;
      updates['company_brief.origin'] = 'edited';
    }
    if (typeof company_brief.what_they_do === 'string') {
      updates['company_brief.what_they_do'] = company_brief.what_they_do;
      updates['company_brief.origin'] = 'edited';
    }
    if (typeof company_brief.pinned === 'boolean') {
      updates['company_brief.pinned'] = company_brief.pinned;
    }
  }

  if (role !== undefined) {
    if (typeof role.title === 'string') updates['role.title'] = role.title;
    if (typeof role.seniority === 'string') updates['role.seniority'] = role.seniority;
    if (Array.isArray(role.responsibilities)) updates['role.responsibilities'] = role.responsibilities;
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: { code: 'NO_CHANGES', message: 'No valid fields to update' } });
  }

  await Kit.updateOne({ _id: kit._id }, { $set: updates });
  const updated = await Kit.findById(kit._id);
  res.json({ kit: updated.toJSON() });
});



export const regenerate = asyncHandler(async (req, res) => {
  const { section } = req.body;
  if (!section) throw new AppError('MISSING_SECTION', 'section is required in request body', 400);
  const updatedKit = await regenerateSection(req.userId, req.params.id, section);
  res.json({ kit: updatedKit });
});



export const addQuestion = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'Kit');
  const kit = await Kit.findOne({ _id: req.params.id, userId: req.userId });
  if (!kit) throw new AppError('NOT_FOUND', 'Kit not found', 404);

  const nextNum = (kit.counters?.q ?? kit.questions.length) + 1;
  const { requirement_ids, category, prompt, answer_outline, difficulty } = req.body;

  const newQ = {
    id: `q${nextNum}`,
    requirement_ids: requirement_ids ?? [],
    category: category ?? 'technical',
    prompt: prompt ?? '',
    answer_outline: answer_outline ?? '',
    difficulty: Number.isInteger(difficulty) ? Math.min(3, Math.max(1, difficulty)) : 2,
    origin: 'user',
    pinned: true,
    deleted: false,
    order: kit.questions.length,
  };

  await Kit.updateOne(
    { _id: kit._id },
    { $push: { questions: newQ }, $set: { 'counters.q': nextNum } },
  );
  res.status(201).json({ question: newQ });
});

export const updateQuestion = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'Kit');
  const kit = await Kit.findOne({ _id: req.params.id, userId: req.userId });
  if (!kit) throw new AppError('NOT_FOUND', 'Kit not found', 404);

  const qIdx = kit.questions.findIndex((q) => q.id === req.params.qid && !q.deleted);
  if (qIdx === -1) throw new AppError('NOT_FOUND', `Question ${req.params.qid} not found`, 404);

  const allowed = ['prompt', 'answer_outline', 'category', 'difficulty', 'pinned', 'order', 'requirement_ids'];
  const setFields = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      setFields[`questions.${qIdx}.${key}`] = req.body[key];
    }
  }
  // Mark as edited if content or category changed, so the item survives regeneration
  if (req.body.prompt !== undefined || req.body.answer_outline !== undefined || req.body.category !== undefined) {
    setFields[`questions.${qIdx}.origin`] = 'edited';
  }


  await Kit.updateOne({ _id: kit._id }, { $set: setFields });

  
  await rebuildScheduleAndCoverage(kit._id);

  const updated = await Kit.findById(kit._id);
  res.json({ kit: updated.toJSON() });
});

export const deleteQuestion = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'Kit');
  const kit = await Kit.findOne({ _id: req.params.id, userId: req.userId });
  if (!kit) throw new AppError('NOT_FOUND', 'Kit not found', 404);

  const qIdx = kit.questions.findIndex((q) => q.id === req.params.qid && !q.deleted);
  if (qIdx === -1) throw new AppError('NOT_FOUND', `Question ${req.params.qid} not found`, 404);

  
  await Kit.updateOne({ _id: kit._id }, { $set: { [`questions.${qIdx}.deleted`]: true } });
  await rebuildScheduleAndCoverage(kit._id);
  res.status(204).end();
});



export const addFlashcard = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'Kit');
  const kit = await Kit.findOne({ _id: req.params.id, userId: req.userId });
  if (!kit) throw new AppError('NOT_FOUND', 'Kit not found', 404);

  const nextNum = (kit.counters?.f ?? kit.flashcards.length) + 1;
  const { front, back, requirement_ids } = req.body;

  const newF = {
    id: `f${nextNum}`,
    front: front ?? '',
    back: back ?? '',
    requirement_ids: requirement_ids ?? [],
    origin: 'user',
    pinned: true,
    deleted: false,
    order: kit.flashcards.length,
  };

  await Kit.updateOne(
    { _id: kit._id },
    { $push: { flashcards: newF }, $set: { 'counters.f': nextNum } },
  );
  res.status(201).json({ flashcard: newF });
});

export const updateFlashcard = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'Kit');
  const kit = await Kit.findOne({ _id: req.params.id, userId: req.userId });
  if (!kit) throw new AppError('NOT_FOUND', 'Kit not found', 404);

  const fIdx = kit.flashcards.findIndex((f) => f.id === req.params.fid && !f.deleted);
  if (fIdx === -1) throw new AppError('NOT_FOUND', `Flashcard ${req.params.fid} not found`, 404);

  const allowed = ['front', 'back', 'requirement_ids', 'pinned', 'order'];
  const setFields = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      setFields[`flashcards.${fIdx}.${key}`] = req.body[key];
    }
  }
  if (req.body.front !== undefined || req.body.back !== undefined) {
    setFields[`flashcards.${fIdx}.origin`] = 'edited';
  }

  await Kit.updateOne({ _id: kit._id }, { $set: setFields });
  const updated = await Kit.findById(kit._id);
  res.json({ kit: updated.toJSON() });
});

export const deleteFlashcard = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'Kit');
  const kit = await Kit.findOne({ _id: req.params.id, userId: req.userId });
  if (!kit) throw new AppError('NOT_FOUND', 'Kit not found', 404);

  const fIdx = kit.flashcards.findIndex((f) => f.id === req.params.fid && !f.deleted);
  if (fIdx === -1) throw new AppError('NOT_FOUND', `Flashcard ${req.params.fid} not found`, 404);

  await Kit.updateOne({ _id: kit._id }, { $set: { [`flashcards.${fIdx}.deleted`]: true } });
  res.status(204).end();
});



export const getPractice = asyncHandler(async (req, res) => {
  const session = await getPracticeSession(req.userId, req.params.id);
  res.json(session);
});

export const postConfidence = asyncHandler(async (req, res) => {
  const { confidence } = req.body;
  const entry = await recordConfidence(req.userId, req.params.id, req.params.fid, confidence);
  res.json({ entry });
});


async function rebuildScheduleAndCoverage(kitId) {
  const kit = await Kit.findById(kitId);
  if (!kit) return;

  const activeQuestions = kit.questions.filter((q) => !q.deleted);
  const { requirements } = kit.role;

  const schedule = buildSchedule(activeQuestions, requirements, kit.input.days);
  const uncovered = findUncoveredRequirements(requirements, activeQuestions);

  await Kit.updateOne(
    { _id: kitId },
    { $set: { schedule, 'coverage.uncovered_requirement_ids': uncovered } },
  );
}