import { describe, it, expect } from 'vitest';
import { summarizePractice } from '../src/services/practice.service.js';

const kit = (flashcards, practice) => ({ flashcards, practice });
const card = (id, deleted = false) => ({ id, deleted });

describe('summarizePractice', () => {
  it('counts seen and rated cards and flags a finished deck', () => {
    const summary = summarizePractice(
      kit([card('f1'), card('f2'), card('f3')], {
        f1: { confidence: 3, seen_count: 2, last_reviewed_at: '2026-09-23T10:00:00Z' },
        f2: { confidence: 1, seen_count: 1, last_reviewed_at: '2026-09-22T10:00:00Z' },
        f3: { confidence: 3, seen_count: 1, last_reviewed_at: '2026-09-23T11:00:00Z' },
      }),
    );

    expect(summary.cards_total).toBe(3);
    expect(summary.cards_seen).toBe(3);
    expect(summary.cards_rated).toBe(3);
    expect(summary.practice_complete).toBe(true);
    expect(summary.practice_days).toEqual(['2026-09-22', '2026-09-23']);
  });

  it('is not complete while any card is unrated', () => {
    const summary = summarizePractice(
      kit([card('f1'), card('f2')], {
        f1: { confidence: 2, seen_count: 1, last_reviewed_at: '2026-09-23T10:00:00Z' },
      }),
    );

    expect(summary.cards_seen).toBe(1);
    expect(summary.cards_rated).toBe(1);
    expect(summary.practice_complete).toBe(false);
  });

  it('ignores deleted cards when deciding completeness', () => {
    const summary = summarizePractice(
      kit([card('f1'), card('f2', true)], {
        f1: { confidence: 2, seen_count: 1, last_reviewed_at: '2026-09-23T10:00:00Z' },
        f2: { confidence: 3, seen_count: 4, last_reviewed_at: '2026-09-20T10:00:00Z' },
      }),
    );

    expect(summary.cards_total).toBe(1);
    expect(summary.cards_seen).toBe(1);
    expect(summary.practice_complete).toBe(true);
    // The deleted card's review day still counts as a day practised
    expect(summary.practice_days).toEqual(['2026-09-20', '2026-09-23']);
  });

  it('treats a kit with no cards as incomplete rather than vacuously complete', () => {
    const summary = summarizePractice(kit([], {}));

    expect(summary.cards_total).toBe(0);
    expect(summary.practice_complete).toBe(false);
    expect(summary.practice_days).toEqual([]);
  });

  it('reads a Map-backed practice field the same as a plain object', () => {
    const asMap = new Map([['f1', { confidence: 3, seen_count: 1, last_reviewed_at: '2026-09-23T10:00:00Z' }]]);
    const summary = summarizePractice(kit([card('f1')], asMap));

    expect(summary.cards_rated).toBe(1);
    expect(summary.practice_complete).toBe(true);
    expect(summary.practice_days).toEqual(['2026-09-23']);
  });

  it('handles a kit with no practice map at all', () => {
    const summary = summarizePractice(kit([card('f1')], undefined));

    expect(summary.cards_seen).toBe(0);
    expect(summary.cards_rated).toBe(0);
    expect(summary.practice_complete).toBe(false);
    expect(summary.practice_days).toEqual([]);
  });
});
