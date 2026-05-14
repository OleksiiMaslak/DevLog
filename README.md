# DevLog

A local full-stack task tracker for engineering teams with four built-in AI agent flows: daily prioritisation, task decomposition, Slack-style status updates, and delivery risk scanning.

## Quick Start

**1. Install dependencies**

```bash
npm install
```

**2. Create the environment file**

```bash
cp .env.example .env
```

The default `.env` works out of the box — no API key required (mock mode is on by default):

```env
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY=""
OPENAI_BASE_URL=""
OPENAI_MODEL="gpt-4.1-mini"
AI_PROVIDER="openai"
AI_MOCK_MODE="true"
CONTEXT7_API_KEY=""
```

**3. Start the dev server**

```bash
npm run dev
```

`npm run dev` runs `prisma generate` and `node prisma/bootstrap.mjs` before starting the server — the local SQLite database and its schema are created automatically on first run.

Optional seed data (3 example tasks):

```bash
npm run db:seed
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | SQLite file path. Default: `file:./dev.db` |
| `AI_MOCK_MODE` | No | `true` (default) — all agents run without an API key |
| `OPENAI_API_KEY` | Only if `AI_MOCK_MODE=false` | OpenAI or GitHub Models PAT |
| `OPENAI_BASE_URL` | No | Leave empty for OpenAI. Set to `https://models.inference.ai.azure.com` for GitHub Models |
| `OPENAI_MODEL` | No | Default: `gpt-4.1-mini` |
| `AI_PROVIDER` | No | Default: `openai` |
| `CONTEXT7_API_KEY` | No | Used by the Copilot agent setup only |

`AI_MOCK_MODE=true` keeps the product fully functional without any secrets — all four agents run and return structured results from a deterministic mock path that produces the same response shape as the real LLM calls.

## Architecture

**Routing:** Next.js 16 App Router. The home page (`src/app/page.tsx`) is an async Server Component that calls `listTasks` directly — no extra network round-trip. All CRUD and agent endpoints live under `src/app/api/`.

**State management:** A single `"use client"` workspace (`src/components/devlog-workspace.tsx`) holds the task list in React state and owns the `useTaskManager` and `useAgentFlow` hooks. No external state library. Optimistic updates for task edits: the UI patches state immediately and rolls back on API failure.

**Styling:** Tailwind CSS v4 via `@tailwindcss/postcss`. Design tokens are defined as CSS custom properties in `src/app/globals.css`. Dark mode is implemented via `html[data-theme="dark"]` — no class toggling. A small inline script in `<head>` reads `localStorage` before first paint to eliminate FOUC.

**Data:** Prisma 7 client with `@prisma/adapter-better-sqlite3`. The `Task` model stores `title`, `description`, `status`, `priority`, `createdAt`, `updatedAt`, `notes`, and `parentId` (for subtasks). Status and priority are stored as plain strings in SQLite and validated at the API boundary via Zod.

**Validation:** Zod schemas in `src/lib/schemas.ts` are shared between route handlers and the UI `disabled` logic. Structured AI outputs are also Zod-validated using the OpenAI SDK's `zodResponseFormat` helper.

**Tests:** Vitest. 65 tests across `schemas.test.ts`, `tasks.test.ts`, `agents.test.ts`, and `api.test.ts`. Agent function tests mock `@/lib/prisma` with `vi.mock` and run under `AI_MOCK_MODE=true`.

## AI Agent Design

The AI layer lives in `src/lib/agents.ts`. Each agent performs multiple steps before returning a result — it is not a single-prompt wrapper.

### Prioritisation (`POST /api/agents/prioritize`)

Loads all tasks, filters out completed ones, scores each active task using a weighted formula (priority × 40/24/12, age boost capped at 14 days, status boost, description clarity penalty), ranks by score, then sends the ranked list to the LLM for a natural-language recommendation with a step-by-step explanation of the reasoning. The mock path returns the same ranked order using the same scoring formula — the LLM adds narrative, not the ranking itself.

### Decomposition (`POST /api/agents/decompose`)

Fetches the task, evaluates whether it is specific enough to decompose (title length, description length, vague keywords). If unclear, it returns clarifying questions instead of generating subtasks. If clear, it generates three structured subtasks and optionally creates them in the database in a single `$transaction`. Supports a second call with the user's clarification answers. The `createSubtasks` flag controls whether generation is dry-run or committed.

### Status Update (`POST /api/agents/status-update`)

Fetches the task and its subtasks, reads the audience parameter (`team` / `lead` / `standup`), and drafts a short async message. The mock path composes the message from task metadata — title, status, priority, subtask progress, notes — without needing an LLM.

### Risk Scan (`POST /api/agents/risk-scan`)

Loads the full active backlog and checks each open task against two signals: age (days since creation) and description vagueness (length below the shared `clarityThreshold`). Tasks that trigger either signal are flagged with a severity rating and a concrete next action. Returns a structured result with per-task risk entries and a summary.

## Custom Agent: Risk Scan

Engineering teams accumulate invisible debt in task state: tickets that have not moved in a week, descriptions too thin to implement safely, work stuck in-progress while the author has mentally moved on. In a busy sprint this goes unnoticed until a standup or missed deadline surfaces it.

The risk scan agent runs across the entire active backlog in seconds. It detects staleness by task age and vagueness by description length, assigns severity, and proposes a concrete next action for each flagged item — either "add acceptance criteria and run decomposition" or "post a short status update and decide to split or close." The result gives a tech lead a five-second daily health check without a meeting or a manual backlog review.

## Storage Choice

SQLite was chosen because the assignment is single-user, local-only, and should run without external services. It persists across reloads, is easy to inspect with standard tooling, and requires no connection management. The limitation is that this is not a multi-user production setup — there is no auth, permissions, hosted database, or migration deployment pipeline.

Prisma 7 `validate` and `generate` work in this environment, but `migrate dev` and `db push` produced a blank schema-engine error on Windows. To keep `npm install && npm run dev` reliable across environments, the project uses `prisma/bootstrap.mjs` to create the table and indexes directly via `better-sqlite3`. A matching SQL migration file is included in `prisma/migrations/` for review.

## Verification

```bash
npm test          # 65 tests, 4 suites
npx tsc --noEmit  # 0 errors
npm run build     # production build
```

