import { kitSchema } from '../validators/kit.schema.js';
import { findUncoveredRequirements } from './coverage.js';
import { AppError } from '../utils/AppError.js';

const duplicates = (ids) => [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];


function checkInvariants(kit) {
  const errors = [];
  const add = (path, message) => errors.push({ path, message });

  const requirements = kit.role.requirements;
  const reqIds = requirements.map((r) => r.id);
  const qIds = kit.questions.map((q) => q.id);
  const fIds = kit.flashcards.map((f) => f.id);

  for (const id of duplicates(reqIds)) add('role.requirements', `duplicate requirement id ${id}`);
  for (const id of duplicates(qIds)) add('questions', `duplicate question id ${id}`);
  for (const id of duplicates(fIds)) add('flashcards', `duplicate flashcard id ${id}`);

  const reqSet = new Set(reqIds);
  const qSet = new Set(qIds);

  kit.questions.forEach((q, i) => {
    for (const id of q.requirement_ids) {
      if (!reqSet.has(id)) add(`questions.${i}.requirement_ids`, `unknown requirement id ${id}`);
    }
  });
  kit.flashcards.forEach((f, i) => {
    for (const id of f.requirement_ids) {
      if (!reqSet.has(id)) add(`flashcards.${i}.requirement_ids`, `unknown requirement id ${id}`);
    }
  });


  const { days_available, days } = kit.schedule;
  if (days.length !== days_available) {
    add('schedule.days', `expected ${days_available} days, got ${days.length}`);
  }
  days.forEach((d, i) => {
    if (d.day !== i + 1) add(`schedule.days.${i}.day`, `expected day ${i + 1}, got ${d.day}`);
    for (const id of d.question_ids) {
      if (!qSet.has(id)) add(`schedule.days.${i}.question_ids`, `unknown question id ${id}`);
    }
  });


  const actualUncovered = findUncoveredRequirements(requirements, kit.questions);
  const reported = [...kit.coverage.uncovered_requirement_ids].sort();
  const actual = [...actualUncovered].sort();
  if (JSON.stringify(reported) !== JSON.stringify(actual)) {
    add(
      'coverage.uncovered_requirement_ids',
      `reported [${reported}] but actual uncovered is [${actual}]`,
    );
  }


  const scheduledQuestions = new Set(days.flatMap((d) => d.question_ids));
  const scheduledReqs = new Set(
    kit.questions.filter((q) => scheduledQuestions.has(q.id)).flatMap((q) => q.requirement_ids),
  );
  const uncovered = new Set(actualUncovered);
  for (const r of requirements) {
    if (r.priority === 'must' && !uncovered.has(r.id) && !scheduledReqs.has(r.id)) {
      add('schedule', `must-have ${r.id} has questions but is not in the schedule`);
    }
  }

  return errors;
}


export function validateKit(input) {
  const parsed = kitSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    };
  }
  const errors = checkInvariants(parsed.data);
  return errors.length ? { ok: false, errors } : { ok: true, kit: parsed.data };
}

export function assertValidKit(input) {
  const result = validateKit(input);
  if (!result.ok) {
    throw new AppError('INVALID_KIT', 'Generated kit failed validation', 422, result.errors);
  }
  return result.kit;
}