/**
 * schedule.js — allocates questions across study days.
 *
 * This is PURE CODE — no LLM. The brief is explicit:
 * "Allocating topics across the days available is arithmetic, and
 *  the application should do it."
 *
 * Algorithm:
 *  1. Sort questions: must-backed first, then by difficulty DESC
 *  2. Target ~45 min/day (each question ≈ 15 min)
 *  3. Distribute across exactly `days` days
 *  4. Every must-have requirement gets at least one question in the schedule
 *  5. Hard/must material lands on earlier days
 *  6. Every day has a focus label derived from its content
 */

const MINUTES_PER_QUESTION = 15;
const TARGET_MINUTES_PER_DAY = 45;

/**
 * Returns the priority score of a question.
 * Higher = schedule earlier.
 *
 * @param {object} question
 * @param {Set<string>} mustReqIds  Set of must-have requirement IDs
 */
function questionPriority(question, mustReqIds) {
  const isMust = question.requirement_ids.some((id) => mustReqIds.has(id));
  return (isMust ? 100 : 0) + question.difficulty;
}

/**
 * Derives a human-readable focus label for a day's set of questions.
 */
function dayFocus(questions) {
  if (!questions.length) return 'Review and rest';

  const categories = [...new Set(questions.map((q) => q.category))];
  const label = categories
    .map((c) => {
      if (c === 'technical') return 'Technical skills';
      if (c === 'behavioural') return 'Behavioural questions';
      if (c === 'system-design') return 'System design';
      if (c === 'company-fit') return 'Company & role fit';
      return c;
    })
    .join(' + ');

  return label || 'Mixed preparation';
}

/**
 * Builds the study schedule.
 *
 * @param {object[]} questions    All questions in the kit
 * @param {object[]} requirements All requirements in the kit
 * @param {number}   days         Number of available study days (integer ≥ 1)
 * @returns {{ days_available: number; days: object[] }}
 */
export function buildSchedule(questions, requirements, days) {
  if (!Number.isInteger(days) || days < 1) days = 1;
  if (days > 365) days = 365;

  const mustReqIds = new Set(
    requirements.filter((r) => r.priority === 'must').map((r) => r.id),
  );

  // Sort questions: must + hardest first
  const sorted = [...questions].sort(
    (a, b) => questionPriority(b, mustReqIds) - questionPriority(a, mustReqIds),
  );

  // Distribute questions across days
  const dayBuckets = Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    questions: [],
    minutes: 0,
  }));

  // Round-robin fill: each day gets up to TARGET_MINUTES_PER_DAY worth of questions
  // on the first pass, then overflow goes to the next available day.
  const questionsPerDay = Math.max(1, Math.ceil(sorted.length / days));

  let dayIndex = 0;
  for (const q of sorted) {
    // Find the next day that hasn't hit its target yet
    let placed = false;
    for (let attempt = 0; attempt < days; attempt++) {
      const di = (dayIndex + attempt) % days;
      const bucket = dayBuckets[di];
      if (bucket.minutes < TARGET_MINUTES_PER_DAY || attempt === days - 1) {
        bucket.questions.push(q);
        bucket.minutes += MINUTES_PER_QUESTION;
        // Advance primary day pointer when bucket is full
        if (bucket.minutes >= TARGET_MINUTES_PER_DAY) {
          dayIndex = (di + 1) % days;
        }
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Overflow into last day
      dayBuckets[days - 1].questions.push(q);
      dayBuckets[days - 1].minutes += MINUTES_PER_QUESTION;
    }
  }

  // Build the output days
  const scheduleDays = dayBuckets.map((b) => ({
    day: b.day,
    focus: dayFocus(b.questions),
    question_ids: b.questions.map((q) => q.id),
    minutes: b.questions.length * MINUTES_PER_QUESTION,
  }));

  return { days_available: days, days: scheduleDays };
}

/**
 * Verifies that every must-have requirement that HAS a question is covered
 * somewhere in the schedule. Returns a list of must-have requirement IDs
 * that have questions but are missing from the schedule.
 *
 * This is code-level coverage — no LLM involvement.
 */
export function findMustHavesMissingFromSchedule(requirements, questions, schedule) {
  const scheduledQIds = new Set(schedule.days.flatMap((d) => d.question_ids));
  const scheduledReqIds = new Set(
    questions.filter((q) => scheduledQIds.has(q.id)).flatMap((q) => q.requirement_ids),
  );
  const coveredByAnyQ = new Set(questions.flatMap((q) => q.requirement_ids));

  return requirements
    .filter(
      (r) =>
        r.priority === 'must' &&
        coveredByAnyQ.has(r.id) &&
        !scheduledReqIds.has(r.id),
    )
    .map((r) => r.id);
}
