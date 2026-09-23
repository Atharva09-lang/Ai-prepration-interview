import { describe, it, expect } from 'vitest';
import { buildSchedule, findMustHavesMissingFromSchedule } from '../src/pipeline/schedule.js';


const requirements = [
  { id: 'r1', kind: 'technical', priority: 'must' },
  { id: 'r2', kind: 'behavioural', priority: 'nice' },
  { id: 'r3', kind: 'technical', priority: 'must' },
];

const q = (id, requirement_ids, difficulty, category = 'technical') => ({
  id,
  requirement_ids,
  difficulty,
  category,
});

const allDayIds = (schedule) => schedule.days.flatMap((d) => d.question_ids);

describe('buildSchedule — day count', () => {
  const questions = [q('q1', ['r1'], 3), q('q2', ['r2'], 1, 'behavioural')];

  it('produces exactly the requested number of days', () => {
    const s = buildSchedule(questions, requirements, 5);
    expect(s.days_available).toBe(5);
    expect(s.days).toHaveLength(5);
    expect(s.days.map((d) => d.day)).toEqual([1, 2, 3, 4, 5]);
  });

  it('clamps a non-positive day count up to 1', () => {
    expect(buildSchedule(questions, requirements, 0).days_available).toBe(1);
    expect(buildSchedule(questions, requirements, -3).days).toHaveLength(1);
  });

  it('clamps a fractional day count to a safe integer', () => {
    const s = buildSchedule(questions, requirements, 2.7);
    expect(s.days_available).toBe(1); // non-integer → treated as invalid → 1
    expect(s.days).toHaveLength(1);
  });

  it('caps the horizon at 365 days', () => {
    const s = buildSchedule(questions, requirements, 999);
    expect(s.days_available).toBe(365);
    expect(s.days).toHaveLength(365);
  });
});

describe('buildSchedule — allocation', () => {
  it('schedules every question exactly once (no loss, no duplicates)', () => {
    const questions = [
      q('q1', ['r1'], 3),
      q('q2', ['r2'], 1, 'behavioural'),
      q('q3', ['r3'], 2),
      q('q4', ['r1'], 2, 'system-design'),
    ];
    const s = buildSchedule(questions, requirements, 3);
    const ids = allDayIds(s);
    expect(ids).toHaveLength(questions.length);
    expect(new Set(ids).size).toBe(questions.length);
  });

  it('reports integer minutes that are a multiple of the per-question cost', () => {
    const questions = [q('q1', ['r1'], 3), q('q2', ['r3'], 2), q('q3', ['r2'], 1, 'behavioural')];
    const s = buildSchedule(questions, requirements, 2);
    for (const d of s.days) {
      expect(Number.isInteger(d.minutes)).toBe(true);
      expect(d.minutes % 15).toBe(0);
      expect(d.minutes).toBe(d.question_ids.length * 15);
    }
  });

  it('puts must-backed, harder questions on earlier days', () => {
    // qHard is must-backed (r1) and difficulty 3; qEasy is nice-to-have and difficulty 1.
    const questions = [q('qEasy', ['r2'], 1, 'behavioural'), q('qHard', ['r1'], 3)];
    const s = buildSchedule(questions, requirements, 2);
    expect(s.days[0].question_ids[0]).toBe('qHard');
  });

  it('fills a single day with everything when only one day is available', () => {
    const questions = [q('q1', ['r1'], 3), q('q2', ['r3'], 2), q('q3', ['r2'], 1, 'behavioural')];
    const s = buildSchedule(questions, requirements, 1);
    expect(s.days).toHaveLength(1);
    expect(s.days[0].question_ids).toHaveLength(3);
    expect(s.days[0].minutes).toBe(45);
  });

  it('handles a 60-day horizon, leaving surplus days as rest', () => {
    const questions = [q('q1', ['r1'], 3), q('q2', ['r3'], 2)];
    const s = buildSchedule(questions, requirements, 60);
    expect(s.days_available).toBe(60);
    expect(s.days).toHaveLength(60);
    expect(allDayIds(s)).toHaveLength(2);
    // The trailing, empty days are labelled as rest.
    expect(s.days[59].question_ids).toEqual([]);
    expect(s.days[59].focus).toBe('Review and rest');
    expect(s.days[59].minutes).toBe(0);
  });

 it('labels empty days as rest when there are no questions at all', () => {
    const s = buildSchedule([], requirements, 3);
    expect(s.days.every((d) => d.focus === 'Review and rest')).toBe(true);
    expect(s.days.every((d) => d.minutes === 0)).toBe(true);
  });

  it('derives a readable focus label from the day content', () => {
    const s = buildSchedule([q('q1', ['r1'], 3, 'technical')], requirements, 1);
    expect(s.days[0].focus).toContain('Technical skills');
  });
});

describe('findMustHavesMissingFromSchedule', () => {
  it('returns nothing when every must-have with a question is scheduled', () => {
    const questions = [q('q1', ['r1'], 3), q('q2', ['r3'], 2), q('q3', ['r2'], 1, 'behavioural')];
    const s = buildSchedule(questions, requirements, 3);
    expect(findMustHavesMissingFromSchedule(requirements, questions, s)).toEqual([]);
  });

  it('flags a must-have whose only question was left out of the schedule', () => {
    const questions = [q('q1', ['r1'], 3), q('q3', ['r3'], 2)];
    const s = buildSchedule(questions, requirements, 3);
   
    s.days.forEach((d) => {
      d.question_ids = d.question_ids.filter((id) => id !== 'q3');
    });
    expect(findMustHavesMissingFromSchedule(requirements, questions, s)).toEqual(['r3']);
  });

  it('ignores must-haves that no question covers at all', () => {
    
    const questions = [q('q1', ['r1'], 3)];
    const s = buildSchedule(questions, requirements, 2);
    expect(findMustHavesMissingFromSchedule(requirements, questions, s)).toEqual([]);
  });
});