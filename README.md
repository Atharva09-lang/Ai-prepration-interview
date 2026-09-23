AI Interview Prep Kit

Paste a job description and a company URL. Get a complete, editable interview-prep kit: a researched company brief, categorised questions with answer outlines, flashcards, and a day-by-day study schedule. Then refine every piece without losing your edits.

Built for the Trao full-stack assessment FS-AI-INTERVIEW-01.

Table of contents
Project overview
Tech stack and justification
LLM provider and model
Setup
Batch evaluation entry point
High-level architecture
Pipeline: research and generation sequencing
Retrieval approach and sources
Kit state: generated, edited, pinned
Schedule allocation
Creative feature: confidence-weighted practice
Key design decisions and trade-offs
Testing


1. Project overview

The app takes two inputs, a job description (JD) and a company URL, and produces a personalised interview-prep kit:

Output	What you get
Company brief	Researched from the company's own site and public interview discussion
Interview questions	Four categories (technical, behavioural, system design, company fit), each with an answer outline
Flashcards	Generated from the JD requirements and the final question set
Study schedule	A day-by-day plan sized to the number of days you have

Generation is job-based: creating a kit returns a job_id immediately, and the client polls GET /api/jobs/:id to show live, stage-by-stage progress. Once a kit exists, every question, flashcard and the brief can be edited, pinned, reordered, deleted, or regenerated per section, and regeneration never overwrites your work.

2. Tech stack and justification
Layer	Technology
Frontend	Next.js 15 (App Router), React 19, Tailwind CSS 4, Framer Motion (JavaScript only)
Backend	Node.js 20+, Express 5, Mongoose 9 + MongoDB, express-session + connect-mongo, Zod, Helmet, express-rate-limit, Morgan
LLM	Google Gemini (free tier)
Tests	Vitest

Why this stack

Next.js + React: file-based routing for the kit, practice and schedule pages, with fast iteration on a highly interactive UI (inline editing, drag-and-drop, live progress).
Express + MongoDB: a kit is a nested, document-shaped object (brief, questions, flashcards, schedule), so a document store fits naturally. Sessions are stored in Mongo via connect-mongo.
Zod: one validation layer for environment config, request bodies and LLM output.
JavaScript only: keeps the whole project in one language with no build-time type layer to maintain.
Gemini free tier: zero cost for evaluators. The model is overridable via env var.


3. LLM provider and model
	
Provider	Google Gemini
Default model	gemini-3-flash-preview
Override	Set GEMINI_MODEL in .env
Key	Free at https://aistudio.google.com/app/apikey

The Gemini free tier is rate-limited per day per model. Back-to-back runs can return 429. The client retries with exponential backoff and honours the provider's retryDelay. For heavier use, set a paid key or switch models.

4. Setup
Prerequisites
Node.js ≥ 20.19
MongoDB running locally (default mongodb://127.0.0.1:27017/interview-prep-kit)
A Gemini API key, required for meaningful output

Without a key the pipeline still runs end to end. Every LLM or retrieval failure is caught per step and recorded honestly in the kit's warnings, but the generated sections will be thin or empty.

Local
bash
# 1. Install dependencies (root postinstall also installs the server deps)
npm install
cd client && npm install && cd ..

# 2. Configure environment
cp .env.example .env        # fill in GEMINI_API_KEY and SESSION_SECRET

# 3. Start MongoDB, then the API (http://localhost:4000)
npm run dev:server

# 4. In a second terminal, start the web app (http://localhost:3000)
cd client && npm run dev

Open http://localhost:3000, register, and create a kit.

Environment variables
Variable	Purpose	Default
PORT	API port	4000
CLIENT_ORIGIN	Allowed CORS origin (the frontend)	http://localhost:3000
MONGO_URI	MongoDB connection string	mongodb://127.0.0.1:27017/interview-prep-kit
SESSION_SECRET	Session signing secret (≥ 32 chars)	none (required)
GEMINI_API_KEY	Gemini key, required for real generation	none (required)
GEMINI_MODEL	Override the model name	gemini-3-flash-preview
NEXT_PUBLIC_API_URL	(client, dev) API base URL	http://localhost:4000
API_PROXY_TARGET	(client, prod) origin that /api/* is proxied to	Render URL
Deployed

The app is designed for a free-tier deployment with three pieces:

Piece	Host type	Notes
Frontend (Next.js)	Static/Node host	Set API_PROXY_TARGET to the backend origin so /api/* is proxied
Backend (Express)	Node web service (e.g. Render)	Set MONGO_URI, SESSION_SECRET, GEMINI_API_KEY, CLIENT_ORIGIN (the deployed frontend URL)
Database	Hosted MongoDB (e.g. MongoDB Atlas free tier)	Use its connection string as MONGO_URI

Step-by-step instructions and the environment variables each host needs are in DEPLOYMENT.md.

5. Batch evaluation entry point

Runs the same retrieval → generation → validation pipeline the web app uses, over a batch of cases, and writes one Appendix B document.

bash
npm run evaluate -- --input <cases.json> --output <kits.json>

cases.json is an array of:

json
[
  { "id": "case-1", "jd": "…job description text…", "company_url": "https://example.com", "days": 5 }
]

Guarantees

Each case's own days value is used when building its schedule.
A failing case is recorded and the run continues; it never aborts the batch.
A partially researched case (unreachable site, missing hiring page) is still ok, and the gap is reported inside the kit. failed is reserved for cases that produced no kit at all.

6. High-level architecture
client/                        Next.js App Router (JavaScript)
  app/                         Routes: /, /generate, /kits, /kits/[id],
                               /practice/[id], /schedule/[id]
  components/                  Design-system + feature components
  lib/  hooks/                 API client, utils, kit + job-polling hooks

server/
  src/
    config/                    Env loading (Zod-validated)
    controllers/  services/    HTTP handlers + business logic
                               (kit, regenerate, practice, job)
    models/                    Mongoose schemas: Kit, User, Job
    pipeline/
      research/                crawler, fetcher, robots, urlGuard (SSRF),
                               linkRanker, discussion, hiringProcess
      generation/              brief, questions, flashcards
                               (one LLM concern per module)
      jd.js                    JD → structured requirements
      coverage.js              Pure-code requirement coverage
      schedule.js              Pure-code day allocation
      validate.js              Structural + invariant checks before save
      runPipeline.js           Orchestrates the 9 stages
    llm/                       Gemini client, prompt builders,
                               prompt-injection safety, mock
  scripts/evaluate.js          Batch entry point
  tests/                       Vitest suites

Request flow: the browser calls the Express API → the API creates a Job and returns its job_id → runPipeline executes in the background and updates the job stage by stage → the client polls the job and, on completion, loads the saved Kit.

7. Pipeline: research and generation sequencing

The pipeline is deliberately sequenced into small, single-purpose steps rather than one mega-prompt. Each step is isolated and individually retryable. A failure in a non-critical step (for example research) degrades into a warning instead of aborting the run.

#	Stage	Type	Responsibility
1	Research	Code	Crawl the company site, locate the hiring page, search for public interview discussion
2	Extract	LLM	Turn the JD into structured requirements (id, text, kind, priority)
3	Brief	LLM	Write the company brief from the research context
4	Questions	LLM	One call per category (technical, behavioural, system design, company fit) so each prompt has category-specific guidance and material is never mixed
5	Coverage	Code	Check which must-have requirements have no question
6	Gap fill	LLM	Generate questions only for uncovered must-haves, up to MAX_PASSES = 3
7	Flashcards	LLM	Build flashcards from the final requirements and questions
8	Schedule	Code	Allocate questions across days (pure arithmetic)
9	Validate	Code	Structural and invariant checks. A kit that fails is marked failed and is never saved half-built

Steps 5, 8 and 9 are deterministic pure code, so they are testable, reproducible and cannot hallucinate.

8. Retrieval approach and sources

Sources used

The company's own website, crawled directly.
robots.txt of that site (fetched and honoured).
Public interview discussion via a scoped DuckDuckGo HTML search restricted to glassdoor.com, reddit.com, blind.app and levels.fyi. The top 3 results are parsed for snippets.

How retrieval works

Component	Behaviour
Crawler	Same-site BFS, up to 20 pages (queue capped at 60), with a polite 300 ms delay between requests. Query strings and hashes are stripped before enqueuing. Relative links are resolved by the crawler.
robots.txt	Fetched and honoured via robots-parser under the InterviewPrepBot/1.0 user agent.
SSRF guard (urlGuard.js)	Only http/https allowed. Private, loopback and link-local addresses are blocked in production. Dev allows local hosts so the batch evaluator can point at fixtures.
Link ranking	Candidate links are scored by hiring-related keywords (careers, jobs, how-we-hire, interview, culture, …) to find the hiring page.
Source recording	Every page actually used is stored in source.pages_used. Failures land in research.pages_failed with a reason. Nothing is assumed about the host.
Interview discussion	A miss (throttling, markup change) is recorded as discussion_found: false and is never fatal.

Prompt-injection defence: all retrieved web and JD text is wrapped in an explicit "untrusted content" block (llm/prompts/safety.js), so instructions embedded in a crawled page cannot hijack the generation prompts.

Known limitation: JS-rendered careers pages and blocked crawls give a thinner brief. This is reported through warnings rather than faked.

9. Kit state: generated, edited, pinned

Every question, flashcard and the company brief carries provenance metadata, so regenerating one section never destroys user work.

Field	Meaning
origin	generated (AI output), edited (user changed AI output), or user (hand-added)
pinned	User explicitly locked the item against regeneration
deleted	Soft-delete tombstone, kept so regeneration cannot resurrect the item
order	Stable position for drag-and-drop reordering

Regeneration rules

Kept: anything user-authored, edited or pinned, plus all tombstones.
Replaced: only untouched generated items of that section.
Question regeneration is strictly per category. Regenerating "technical" never adds system-design or company-fit questions.

In the UI: pin/unpin toggles appear on each question, on each flashcard (in edit mode), and on the company brief.

10. Schedule allocation

Allocation is pure code (server/src/pipeline/schedule.js), not an LLM call. Distributing topics across days is the application's job.

Sort questions must-have-backed first, then hardest first (priority * 100 + difficulty).
Budget each question at about 15 minutes and each day at a target of 45 minutes. Overflow spills into the next day.
Output exactly days days, each with a derived focus label, integer minutes, and question_ids.
Clamp days to a safe integer in [1, 365]. Surplus days become "Review and rest".
Guarantee via findMustHavesMissingFromSchedule that every must-have that has a question appears in the plan.


11. Creative feature: confidence-weighted practice

The kit is not just something to read; it is a study tool. In Practice, each flashcard is self-scored:

Score	Meaning
1	Forgot
2	Recalled with effort
3	Confident

The session re-orders cards lowest confidence first, then most overdue first (using last_reviewed_at), so weak material resurfaces without a full spaced-repetition engine.

Together with drag-and-drop reordering, inline editing, per-section regeneration and a live generation timeline, the candidate shapes the kit instead of passively consuming it.

12. Key design decisions and trade-offs
Decision	Why	Trade-off
Per-category LLM calls instead of one mega-prompt	Better category-specific quality and clean coverage reasoning	More requests, so more exposure to provider rate limits
Deterministic steps in code (coverage, schedule, validation)	Testable, reproducible, no hallucination	Logic must be maintained in code
Job-based generation	Long pipelines don't block an HTTP request; users see real stage progress	More moving parts (a Job collection and polling)
Soft deletes + provenance fields	Makes regeneration safe and reversible	Slightly heavier Kit documents
Graceful degradation with warnings	A partial kit is more useful than none, and failures stay honest	Output quality varies by site
Coverage passes capped at 3	Closes must-have gaps in practice while bounding cost and latency; stops early once only nice-to-haves remain	A rare gap may remain after 3 passes
Live LLM calls in the real pipeline (a mock exists in llm/mock.js for offline dev only)	Real content instead of placeholders	A Gemini key is required
DuckDuckGo HTML for discussion search	No API key or cost	Endpoint can throttle or change markup; a miss is non-fatal



13. Testing
bash
npm test        # from the repo root; delegates to the server suite

59 Vitest tests cover JD and kit validation, requirement-id sanitising, dedupe, coverage, the kit mapper, auth, the Express app, and schedule allocation.