# AI Interview Prep Kit

Turn a job description + a company URL into a complete, editable interview-prep kit:
a researched company brief, categorised interview questions with answer outlines,
flashcards, and a day-by-day study schedule — then let the candidate refine every
piece without losing their edits.

Built for the Trao full-stack assessment (`FS-AI-INTERVIEW-01`).

---

## Tech stack

| Layer    | Tech |
| -------- | ---- |
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS 4, Framer Motion — **JavaScript only** |
| Backend  | Node.js 20+, Express 5, Mongoose 9 / MongoDB, `express-session` + `connect-mongo`, Zod, Helmet, `express-rate-limit`, Morgan |
| LLM      | Google Gemini (`gemini-3-flash-preview` by default, free tier) |
| Tests    | Vitest |

Generation is **job-based**: creating a kit returns a `job_id` immediately and the
client polls `GET /api/jobs/:id` for live stage-by-stage progress.

---

## Prerequisites

- **Node.js ≥ 20.19**
- **MongoDB** running locally (default `mongodb://127.0.0.1:27017/interview-prep-kit`)
- **A Google Gemini API key** — required for meaningful output.
  Get one free at <https://aistudio.google.com/app/apikey>.

> Without a key the pipeline still runs end-to-end (every LLM/retrieval failure is
> caught per step and recorded honestly in the kit's `warnings`), but the generated
> sections will be thin or empty. A key is needed for a real kit.

---

## Local setup

```bash
# 1. Install dependencies (root postinstall also installs the server deps)
npm install
cd client && npm install && cd ..

# 2. Configure environment
cp .env.example .env          # then fill in GEMINI_API_KEY and SESSION_SECRET

# 3. Start MongoDB, then the API (http://localhost:4000)
npm run dev:server

# 4. In a second terminal, start the web app (http://localhost:3000)
cd client && npm run dev
```

Open <http://localhost:3000>, register, and create a kit.

### Environment variables (`.env`)

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | API port | `4000` |
| `CLIENT_ORIGIN` | Allowed CORS origin (the frontend) | `http://localhost:3000` |
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/interview-prep-kit` |
| `SESSION_SECRET` | Session signing secret (≥ 32 chars) | — |
| `GEMINI_API_KEY` | Gemini key — required for real generation | — |
| `GEMINI_MODEL` | Override the model name | `gemini-3-flash-preview` |
| `NEXT_PUBLIC_API_URL` | (client) API base URL | `http://localhost:4000` |

---

## Batch evaluation (mandatory entry point)

Runs the **same** retrieval → generation → validation pipeline the web app uses over
a batch of cases and writes one Appendix B document.

```bash
npm run evaluate -- --input <cases.json> --output <kits.json>
```

`cases.json` is an array of `{ id, jd, company_url, days }`. Guarantees:

- Uses each case's own `days` when building the schedule.
- Continues after a case fails, recording the failure instead of aborting.
- A partially-researched case is still `ok` (an unreachable site or missing hiring
  page is non-fatal and reported inside the kit); `failed` is reserved for cases that
  produced no kit at all.

---

## Tests

```bash
npm test          # from the repo root (delegates to the server suite)
```

59 Vitest tests covering JD/kit validation, requirement-id sanitising, dedupe,
coverage, the kit mapper, auth, the Express app, and schedule allocation.

---

## Architecture

```
client/                     Next.js App Router (JavaScript)
  app/                      routes: /, /generate, /kits, /kits/[id], /practice/[id], /schedule/[id]
  components/               design-system + feature components (QuestionCard, Section, …)
  lib/ hooks/               api client, utils, kit + job-polling hooks

server/
  src/
    config/                 env loading (Zod-validated)
    controllers/ services/  HTTP handlers + business logic (kit, regenerate, practice, job)
    models/                 Mongoose schemas (Kit, User, Job)
    pipeline/
      research/             crawler, fetcher, robots, urlGuard (SSRF), linkRanker, discussion, hiringProcess
      generation/           brief, questions, flashcards (one LLM concern per module)
      jd.js                 JD → structured requirements
      coverage.js           pure-code requirement coverage
      schedule.js           pure-code day allocation
      validate.js           structural + invariant checks before save
      runPipeline.js        orchestrates the 9 stages
    llm/                    Gemini client, prompt builders, prompt-injection safety, mock
  scripts/evaluate.js       batch entry point
  tests/                    Vitest suites
```

### Pipeline sequencing (deliberate, not one mega-prompt)

1. **Research** — crawl the company site, locate the hiring page, search for interview discussion.
2. **Extract** — pull structured requirements (id, text, kind, priority) from the JD.
3. **Brief** — write the company brief from research context.
4. **Questions** — **one LLM call per category** (technical, behavioural, system-design, company-fit), so each prompt carries category-specific guidance and technical material is never mixed with behavioural.
5. **Coverage** — *pure code* checks which must-have requirements have no question.
6. **Gap fill** — generate questions only for uncovered must-haves, up to `MAX_PASSES = 3`.
7. **Flashcards** — generated from the final requirements + questions.
8. **Schedule** — *pure arithmetic* allocation across days.
9. **Validate** — structural + invariant checks; a kit that fails is marked `failed`, never saved half-built.

Each step is isolated and individually retryable, and a failure in one non-critical
step (e.g. research) degrades gracefully into a `warning` rather than aborting.

---

## Retrieval approach

- **Crawler** — same-site BFS up to 20 pages (queue capped at 60) with a polite
  300 ms inter-request delay; query strings and hashes are stripped before enqueuing.
- **robots.txt** — fetched and honoured via `robots-parser` under the
  `InterviewPrepBot/1.0` user agent.
- **SSRF guard** (`urlGuard.js`) — only `http`/`https`; private, loopback and
  link-local addresses are blocked in production. (Dev allows local hosts so the
  batch evaluator can point at fixtures.)
- **Link ranking** — candidate links are scored by hiring-related keywords
  (`careers`, `jobs`, `how-we-hire`, `interview`, `culture`, …) to find the hiring page.
- **Sources recorded** — every page actually used is stored in `source.pages_used`;
  failures land in `research.pages_failed` with a reason. Nothing is assumed about the
  host, and relative links are resolved by the crawler.
- **Interview discussion** — a scoped DuckDuckGo HTML search
  (`site:glassdoor.com OR site:reddit.com OR site:blind.app OR site:levels.fyi`),
  top 3 results parsed for snippets.

**Prompt-injection defence:** all retrieved web/JD text is wrapped in an explicit
"untrusted content" block (`llm/prompts/safety.js`) so instructions embedded in a
crawled page cannot hijack the generation prompts.

---

## Kit state: generated vs edited vs pinned

Every question, flashcard and the company brief carry provenance so single-section
regeneration never destroys user work:

| Field | Meaning |
| --- | --- |
| `origin` | `generated` (AI), `edited` (user changed AI output), or `user` (hand-added) |
| `pinned` | user explicitly locked it against regeneration |
| `deleted` | soft-delete tombstone — kept so regeneration cannot resurrect it |
| `order` | stable position for drag-and-drop reordering |

**Regenerating a section keeps** anything `user`-authored, `edited`, or `pinned`, plus
tombstones; only untouched `generated` items of *that* section are replaced. Question
regeneration is strictly **per-category** — regenerating "technical" never appends
system-design or company-fit questions. In the UI, pin/unpin toggles sit on each
question, each flashcard (edit mode), and the company brief.

---

## Schedule allocation (pure code, `schedule.js`)

Arithmetic, not an LLM call — the brief is explicit that distributing topics across
days is the application's job.

- Questions are sorted **must-backed first, then hardest first** (`priority*100 + difficulty`).
- Each question ≈ **15 minutes**; each day targets **45 minutes** before overflow spills to the next day.
- Output has **exactly `days` days**, each with a derived `focus` label, integer `minutes`, and `question_ids`.
- `days` is clamped to a safe integer in `[1, 365]`; surplus days become "Review and rest".
- `findMustHavesMissingFromSchedule` gives a code-level guarantee that every must-have
  *with a question* actually appears in the plan.

---

## Creative feature: confidence-weighted practice

Beyond generation, the kit is a study tool. In **Practice**, each flashcard is scored
1 (forgot) / 2 (recalled with effort) / 3 (confident). The session re-orders cards
**lowest-confidence first, then most-overdue first** (`last_reviewed_at`), so weak
material resurfaces without a full spaced-repetition engine. Combined with drag-and-drop
reordering, inline editing, per-section regeneration, and a live generation timeline,
the candidate shapes the kit rather than just reading it.

---

## Design decisions, trade-offs & limitations

- **Per-category LLM calls over one mega-prompt** — more requests, but far better
  category-specific quality and clean coverage reasoning. Trade-off: more calls means
  more exposure to provider rate limits.
- **Deterministic steps in code** — coverage and scheduling are pure functions, so they
  are testable, reproducible, and never hallucinate. 59 tests lock this behaviour in.
- **Job-based generation** — long pipelines don't block an HTTP request; the client
  polls and shows real stage progress. Trade-off: more moving parts (Job collection).
- **Soft deletes + provenance** — tombstones and `origin`/`pinned` make regeneration
  safe and reversible, at the cost of a slightly heavier Kit document.
- **Mock generator** exists (`llm/mock.js`) for offline/dev scaffolding, but the real
  pipeline forces live calls, so a **Gemini key is required** for real content.
- **Gemini free tier is rate-limited per day per model.** Back-to-back runs can hit
  `429`; the client retries with exponential backoff and honours the provider's
  `retryDelay`. For heavier use, set a paid key or override `GEMINI_MODEL`.
- **Discussion search** depends on DuckDuckGo's HTML endpoint, which can throttle or
  change markup; a miss is recorded as `discussion_found: false`, never fatal.
- **Retrieval quality varies by site** — JS-rendered careers pages or blocked crawls
  yield a thinner brief; this is reported honestly via `warnings` rather than faked.
- **Coverage passes capped at 3** — enough to close must-have gaps in practice while
  bounding cost/latency; the loop also stops early once only nice-to-haves remain.

---

## Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for a free-tier deployment guide (frontend +
backend + MongoDB) and the environment variables each host needs.
