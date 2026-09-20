import { describe, it, expect } from 'vitest';
import { validateKit } from '../src/pipeline/validate.js';
import { makeKit } from './helpers/makeKit.js';


function expectError(kit, fragment) {
  const result = validateKit(kit);
  expect(result.ok).toBe(false);
  const text = result.errors.map((e) => `${e.path}: ${e.message}`).join('\n');
  expect(text).toContain(fragment);
}

describe('validateKit', () => {
  it('accepts a well-formed kit', () => {
    expect(validateKit(makeKit()).ok).toBe(true);
  });

  it('rejects difficulty outside 1-3', () => {
    const kit = makeKit();
    kit.questions[0].difficulty = 4;
    expectError(kit, 'questions.0.difficulty');
  });

  it('rejects non-integer minutes', () => {
    const kit = makeKit();
    kit.schedule.days[0].minutes = 45.5;
    expectError(kit, 'schedule.days.0.minutes');
  });

  it('rejects a schedule that points at a question that does not exist', () => {
    const kit = makeKit();
    kit.schedule.days[0].question_ids.push('q99');
    expectError(kit, 'unknown question id q99');
  });

  it('rejects a schedule whose day count differs from days_available', () => {
    const kit = makeKit();
    kit.schedule.days.pop();
    expectError(kit, 'expected 2 days, got 1');
  });

  it('rejects a question that references an unknown requirement', () => {
    const kit = makeKit();
    kit.questions[0].requirement_ids = ['r99'];
    expectError(kit, 'unknown requirement id r99');
  });

  it('rejects a question with no requirement ids', () => {
    const kit = makeKit();
    kit.questions[0].requirement_ids = [];
    expectError(kit, 'questions.0.requirement_ids');
  });

  it('rejects duplicate question ids', () => {
    const kit = makeKit();
    kit.questions[1].id = 'q1';
    expectError(kit, 'duplicate question id q1');
  });

  it('rejects an invalid requirement kind', () => {
    const kit = makeKit();
    kit.role.requirements[0].kind = 'soft-skill';
    expectError(kit, 'role.requirements.0.kind');
  });

  it('rejects coverage that misreports gaps', () => {
    const kit = makeKit();
    kit.questions = kit.questions.filter((q) => q.id !== 'q2'); // r2 loses its only question
    kit.schedule.days[1].question_ids = [];
   
    expectError(kit, 'coverage.uncovered_requirement_ids');
  });

  it('accepts a kit that honestly reports an uncovered requirement', () => {
    const kit = makeKit();
    kit.questions = kit.questions.filter((q) => q.id !== 'q2');
    kit.schedule.days[1].question_ids = [];
    kit.coverage.uncovered_requirement_ids = ['r2'];
    expect(validateKit(kit).ok).toBe(true);
  });

  it('rejects a must-have that has questions but is missing from the schedule', () => {
    const kit = makeKit();
    kit.schedule.days[1].question_ids = []; // q2 (the only question for r2) unscheduled
    expectError(kit, 'must-have r2');
  });

  it('strips internal fields so the output matches the exported structure', () => {
    const kit = makeKit();
    kit.questions[0].origin = 'edited';
    kit.questions[0].pinned = true;
    const result = validateKit(kit);
    expect(result.ok).toBe(true);
    expect(result.kit.questions[0]).not.toHaveProperty('origin');
    expect(result.kit.questions[0]).not.toHaveProperty('pinned');
  });
});