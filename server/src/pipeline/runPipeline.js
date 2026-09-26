/**
 * pipeline/runPipeline.js — full pipeline orchestration.
 *
 * Sequence (each step is deliberate, not a single mega-prompt):
 *  1. Research   — crawl company site, find hiring page, search discussion
 *  2. Extract    — pull structured requirements from the JD text
 *  3. Brief      — generate company brief from research context
 *  4. Questions  — one LLM call per question category
 *  5. Coverage   — code checks which must-have requirements have no question
 *  6. Gap fill   — generate questions for uncovered must-haves (up to MAX_PASSES)
 *  7. Flashcards — generated from final requirements + questions
 *  8. Schedule   — pure arithmetic allocation across days
 *  9. Validate   — structural + invariant checks before saving
 */

import { AppError } from '../utils/AppError.js';
import { assertValidKit } from './validate.js';
import { findUncoveredRequirements } from './coverage.js';
import { runResearch } from './research/index.js';
import { extractJd } from './jd.js';
import { generateBrief } from './generation/brief.js';
import { generateQuestions, generateGapQuestions } from './generation/questions.js';
import { generateFlashcards } from './generation/flashcards.js';
import { buildSchedule } from './schedule.js';

export const STAGES = [
  { key: 'research',   label: 'Researching the company' },
  { key: 'extract',    label: 'Extracting job requirements' },
  { key: 'brief',      label: 'Writing the company brief' },
  { key: 'questions',  label: 'Generating questions' },
  { key: 'coverage',   label: 'Checking requirement coverage' },
  { key: 'flashcards', label: 'Creating flashcards' },
  { key: 'schedule',   label: 'Building the study schedule' },
  { key: 'validate',   label: 'Validating the kit' },
];

/** Max coverage passes before we accept remaining gaps */
const MAX_PASSES = 3;

/**
 * Runs the full kit generation pipeline.
 *
 * @param {{ jd: string; company_url: string; days: number }} input
 * @param {{ onProgress?: Function }} opts
 * @returns {Promise<object>}  Validated kit object matching Appendix A structure
 */
export async function runPipeline(input, { onProgress = () => {} } = {}) {
  const { jd, company_url, days } = input;
  const warnings = [];
  let current = null;

  const progress = (stage, status, detail) => {
    current = stage;
    onProgress({ stage, status, detail: detail ?? '' });
  };

  try {
    // ── 1. RESEARCH ────────────────────────────────────────────────────────
    progress('research', 'running');
    let research;
    try {
      research = await runResearch(company_url, {
        onProgress: (msg) => progress('research', 'running', msg),
      });
    } catch (err) {
      // Research failure is non-fatal — we proceed with empty research
      research = {
        companyName: '',
        companyUrl: company_url,
        pages: [],
        pagesUsed: [],
        pagesFailed: [{ url: company_url, reason: err.message }],
        hiringPageFound: false,
        hiringPageUrl: null,
        hiringProcess: null,
        discussionFound: false,
        discussionSources: [],
        discussionSnippets: [],
      };
      warnings.push(`research_failed: ${err.message}`);
    }
    progress('research', 'done', `${research.pages.length} pages retrieved`);

    // ── 2. EXTRACT JD ──────────────────────────────────────────────────────
    progress('extract', 'running');
    const extracted = await extractJd(jd);
    warnings.push(...extracted.warnings);
    progress('extract', 'done', `${extracted.requirements.length} requirements found`);

    // ── 3. COMPANY BRIEF ───────────────────────────────────────────────────
    progress('brief', 'running');
    const brief = await generateBrief(research, {
      title: extracted.title,
      seniority: extracted.seniority,
    });
    progress('brief', 'done');

    // ── 4. QUESTIONS (per category) ────────────────────────────────────────
    progress('questions', 'running');
    let questions = await generateQuestions(
      extracted.requirements,
      extracted,
      research,
      1,
      warnings,
    );
    progress('questions', 'done', `${questions.length} questions generated`);

    // ── 5 & 6. COVERAGE LOOP ──────────────────────────────────────────────
    progress('coverage', 'running');
    let uncovered = findUncoveredRequirements(extracted.requirements, questions);
    let passes = 1;

    while (uncovered.length > 0 && passes < MAX_PASSES) {
      const gapReqs = extracted.requirements.filter(
        (r) => r.priority === 'must' && uncovered.includes(r.id),
      );
      if (!gapReqs.length) break; // only nice-to-haves uncovered — stop

      const nextId = questions.length + 1;
      const gapQuestions = await generateGapQuestions(gapReqs, extracted, research, nextId, warnings);
      questions = [...questions, ...gapQuestions];

      // Re-check coverage (pure code — not LLM)
      uncovered = findUncoveredRequirements(extracted.requirements, questions);
      passes++;
    }
    progress('coverage', 'done', `${passes} pass(es), ${uncovered.length} uncovered`);

    // An uncovered must-have is the one failure this whole loop exists to catch.
    // We still ship the kit (the user can add a question by hand), but never silently.
    const uncoveredMust = extracted.requirements.filter(
      (r) => r.priority === 'must' && uncovered.includes(r.id),
    );
    if (uncoveredMust.length) {
      warnings.push(
        `uncovered_must_haves: ${uncoveredMust.length} must-have requirement(s) still have no question after ${passes} pass(es): ${uncoveredMust.map((r) => `${r.id} (${r.text})`).join('; ')}`,
      );
    }

    // ── 7. FLASHCARDS ──────────────────────────────────────────────────────
    progress('flashcards', 'running');
    const flashcards = await generateFlashcards(extracted.requirements, questions, 1, warnings);
    progress('flashcards', 'done', `${flashcards.length} flashcards`);

    // ── 8. SCHEDULE (pure arithmetic) ─────────────────────────────────────
    progress('schedule', 'running');
    const schedule = buildSchedule(questions, extracted.requirements, days);
    progress('schedule', 'done');

    // ── 9. ASSEMBLE + VALIDATE ─────────────────────────────────────────────
    progress('validate', 'running');
    const kit = {
      source: {
        company:        research.companyName || '',
        company_url,
        role:           extracted.title || '',
        location:       extracted.location || '',
        jd_chars:       jd.length,
        researched_at:  new Date().toISOString(),
        pages_used:     research.pagesUsed ?? [],
      },
      company_brief: brief,
      role: {
        title:           extracted.title || '',
        seniority:       extracted.seniority || '',
        domain:          extracted.domain || 'other',
        responsibilities: extracted.responsibilities ?? [],
        requirements:    extracted.requirements,
      },
      questions,
      flashcards,
      schedule,
      coverage: {
        uncovered_requirement_ids: uncovered,
        passes,
      },
      research: {
        pages_failed:       research.pagesFailed ?? [],
        hiring_page_found:  research.hiringPageFound ?? false,
        discussion_found:   research.discussionFound ?? false,
        discussion_sources: research.discussionSources ?? [],
        hiring_process:     research.hiringProcess ?? null,
      },
      warnings,
    };

    const validatedKit = assertValidKit(kit);
    progress('validate', 'done');
    return validatedKit;
  } catch (err) {
    onProgress({ stage: current, status: 'failed', detail: err.message });
    throw err;
  }
}