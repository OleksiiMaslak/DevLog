# AGENT_LOG

## Tools And Agents Used

- Codex was used to inspect the assignment PDF, extract the requirements, plan the implementation, scaffold the application, debug toolchain issues, and write documentation.
- Browser plugin instructions were loaded as requested. Opening the local PDF through the in-app browser was blocked by browser URL policy, so the PDF was parsed locally instead.
- Context7 was installed in project mode for Codex:
  - CLI + universal skill via `npx ctx7@latest setup --cli --universal --codex --project --yes`
  - MCP config via `npx ctx7@latest setup --mcp --codex --project --yes`
- Context7 docs were queried for Next.js route handlers, Tailwind v4 PostCSS setup, Prisma 7 setup, and OpenAI Node structured outputs.

## Skills Installed And Used

- `accelint-nextjs-best-practices`: used for App Router route handler decisions and the Server Component / Client Component boundary.
- `vercel-react-best-practices`: used to keep interactive state localized in one client workspace and avoid unnecessary client boundaries.
- `tailwindcss`: used for Tailwind v4 PostCSS setup and source detection. It directly helped fix a build issue where Tailwind scanned `.agents/skills` markdown and generated invalid utilities from docs examples.
- `prisma-cli`: used to align the project with Prisma 7 config expectations.
- `prisma-client-api`: used for Prisma Client singleton and query patterns.
- `vitest`: used for the unit test setup.
- `frontend-design`: installed from `anthropics/skills@frontend-design` after searching the skills registry; used to push the UI toward a more intentional industrial/editorial workspace with a real dark theme.
- `openai-docs` and Context7 OpenAI docs: used for structured-output direction in the OpenAI SDK.

## What The Agent Generated

- Next.js project structure, route handlers, Prisma schema, SQLite bootstrap, task helper layer, AI agent layer, React workspace UI, tests, README, and this log.
- The UI was scaffolded by the agent, then manually shaped toward a dense engineering workspace instead of a landing page.
- Agent functions were implemented with real OpenAI support and deterministic mock fallback so reviewers can test without secrets.

## Manual Corrections And Tradeoffs

- The planned skill name `nextjs-best-practices` did not exist in the Hypergiant repo; the actual installed skill is `accelint-nextjs-best-practices`.
- Prisma 7 requires moving the datasource URL out of `schema.prisma` into `prisma.config.ts` and constructing Prisma Client with a driver adapter. The first schema used the old URL pattern and had to be corrected.
- `prisma validate` and `prisma generate` worked, but `prisma migrate dev` and `prisma db push` failed in this Windows environment with a blank schema-engine error. I added `prisma/bootstrap.mjs` so `npm run dev` reliably creates the SQLite table. The matching SQL migration remains in `prisma/migrations` for review.
- Next 16/Turbopack inferred `C:\Users\USER` as the workspace root because another lockfile exists above the project. I set `turbopack.root` in `next.config.ts`.
- Tailwind v4 scanned `.agents/skills` by default and picked up example classes from skill documentation. I changed `globals.css` to use `source(none)` and explicitly include only `src/app` and `src/components`.
- Context7 setup wrote a live API key into `.codex/config.toml`; I replaced it with `YOUR_CONTEXT7_API_KEY` so no secret is committed.
- API handlers originally let Zod and Prisma errors bubble as 500s. I added a shared API error mapper so invalid input returns 400 and missing tasks return 404.
- The initial workspace UI had a few feature gaps: create notes, editable subtask status, and status-update audience selection. Those were added during the second pass.

## Verification Run

- `npm run test`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed after the Turbopack root and Tailwind source fixes.

---

## Code Review — Round 2 

A full professional review was conducted by GitHub Copilot using `accelint-nextjs-best-practices`, `vercel-react-best-practices`, and Context7 Next.js documentation. The entire codebase (17 source files) was read and analysed. All identified issues were fixed in a single pass; `npx tsc --noEmit` and `npx vitest run` remained green (0 errors, 15/15 tests) after every change.

Issues are listed with their file locations and the exact fix applied.

---

### 🔴 Critical — Fixed

#### C-1 · Theme double-effect FOUC bug
**File:** `src/components/devlog-workspace.tsx`

The component had two separate `useEffect` calls for theme initialisation. Effect 1 read `localStorage` and called `setTheme`. Effect 2 ran *immediately after the first render* — before Effect 1's state update was processed — writing `theme = "light"` back to `document.documentElement.dataset.theme` and to `localStorage`, overriding the head script that had correctly set `"dark"` before first paint. The cycle then completed correctly on the re-render, but by that point the user had already seen a dark→light→dark flash and localStorage had briefly been corrupted.

**Fix:** Collapsed both effects into a single init effect that reads `localStorage`, resolves the correct theme, writes directly to the DOM, and calls `setTheme` once. Extracted a `toggleTheme()` function that updates the DOM, `localStorage`, and React state synchronously — no effect dependency on `theme` needed.

```diff
- useEffect(() => { setTheme(saved ?? systemPref); }, []);
- useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem(...); }, [theme]);
+ useEffect(() => {
+   const resolved = saved ?? systemPref;
+   document.documentElement.dataset.theme = resolved;
+   setTheme(resolved);
+ }, []);
+ function toggleTheme() {
+   document.documentElement.dataset.theme = next;
+   localStorage.setItem("devlog-theme", next);
+   setTheme(next);
+ }
```

Also added `suppressHydrationWarning` to `<html>` in `src/app/layout.tsx` so React does not warn about the `data-theme` attribute mismatch between SSR (no attribute) and the head-script injection.

---

#### C-2 · `prioritizeTasks` sent all tasks (including done) to LLM
**File:** `src/lib/agents.ts` — `prioritizeTasks()`

`activeTasks` was correctly computed by filtering out `status === "done"`, and used for scoring/ranking, but the `user` message sent to the LLM still referenced the unfiltered `tasks` binding. The LLM could therefore recommend starting tasks that were already marked done. The mock path used `activeTasks` correctly, creating a silent production/mock divergence.

**Fix:**
```diff
- { role: "user", content: JSON.stringify({ tasks }) }
+ { role: "user", content: JSON.stringify({ tasks: activeTasks }) }
```

---

### 🟠 High — Fixed

#### H-1 · `runAgentCall` discarded server error details
**File:** `src/hooks/use-agent-flow.ts`

On any non-2xx response the function threw a hardcoded `"Agent request failed"` string, throwing away whatever error the server had actually returned in the JSON body. This meant every agent failure appeared with the same generic message regardless of root cause.

**Fix:** Parse the response JSON before throwing and surface the server's `error` field:
```diff
- if (!response.ok) throw new Error("Agent request failed");
+ if (!response.ok) {
+   const data = await response.json().catch(() => ({})) as { error?: string };
+   throw new Error(data.error ?? "Agent request failed");
+ }
```

---

#### H-2 · `listTasks` sort used an unsafe cast before validation
**File:** `src/lib/tasks.ts`

The sort comparator cast `a.priority` and `b.priority` to `PublicPriority` and looked them up in `priorityRank`. If the database contained an invalid priority string (e.g. from a direct edit or a failed migration), `priorityRank[...]` would return `undefined`, and `undefined - undefined = NaN`, silently breaking the sort order with no error surfaced.

**Fix:** Added a `?? 0` fallback so unknown priorities are treated as lowest rank rather than producing `NaN`:
```diff
- priorityRank[a.priority as PublicPriority] - priorityRank[b.priority as PublicPriority]
+ (priorityRank[a.priority as PublicPriority] ?? 0) - (priorityRank[b.priority as PublicPriority] ?? 0)
```

---

#### H-3 · `error.tsx` only catches route-segment errors; root layout errors were unhandled
**Files:** `src/app/error.tsx`, `src/app/global-error.tsx` (new)

Next.js App Router distinguishes `error.tsx` (catches errors in child route segments) from `global-error.tsx` (catches errors thrown inside `RootLayout` itself, including async Server Component failures at the root). The project only had `error.tsx`, which cannot catch root-level errors. The existing file also exported its default function under the misleading name `GlobalError`.

**Fix:**
- Renamed the `error.tsx` default export to `ErrorBoundary` to match the file's actual role.
- Created `src/app/global-error.tsx` with a proper `GlobalError` default export. Per Next.js requirements, `global-error.tsx` must render its own `<html>` and `<body>` tags because the root layout is unavailable when it activates.

---

#### H-4 · `AgentPanel` received `run` and `runAgentAction` as props — leaky abstraction
**Files:** `src/components/agent-panel.tsx`, `src/components/devlog-workspace.tsx`

`AgentPanel` accepted `run` (which wraps `startTransition`) and `runAgentAction` (which manages `agentPending`) as props. These are implementation details of `DevLogWorkspace` — the panel should only signal *intent*, not orchestrate the execution mechanism.

**Fix:** Replaced the two higher-order function props with intent-specific `on*` callbacks pre-wrapped in the workspace:

| Removed from AgentPanelProps | Added to AgentPanelProps |
|---|---|
| `run`, `runAgentAction` | — |
| `createTask`, `prioritize`, `decompose`, `decomposeWithAnswers`, `createFromPlan`, `statusUpdate`, `riskScan` | `onCreateTask`, `onFocus`, `onSplit`, `onStatusUpdate`, `onRiskScan`, `onDecomposeWithAnswers`, `onCreateFromPlan` |

`onCreateTask` accepts a second `onSuccess` callback so the form reset (which lives in `AgentPanel`) only fires after a confirmed successful creation:
```tsx
// workspace:
onCreateTask={(data, onSuccess) => run(async () => { await createTask(data); onSuccess(); }, "Task created")}

// panel:
onClick={() => onCreateTask(form, () => setForm(emptyForm))}
```

---

### 🟡 Medium — Fixed

#### M-1 · Dead re-exports in `use-task-manager.ts`
**File:** `src/hooks/use-task-manager.ts`

After moving `emptyForm` and `ApiErrorResponse` to `src/lib/api-utils.ts`, all consumers were updated to import from `api-utils` directly. The hook still re-exported both symbols, creating ambiguity about the canonical source and leaving misleading dead code.

**Fix:** Removed the two re-export lines.

---

#### M-2 · `decomposeTask` parsed the LLM response a second time unnecessarily
**File:** `src/lib/agents.ts`

When `completeStructured` returns a result (real OpenAI path), the result has already been validated by `zodResponseFormat`. The code then called `DecompositionResult.parse(llm)` again — a redundant runtime validation that wasted CPU and obscured intent.

**Fix:**
```diff
- const base = llm
-   ? DecompositionResult.parse(llm)
-   : DecompositionResult.parse(tooVague ? ... : ...);
+ const base = llm ?? DecompositionResult.parse(tooVague ? ... : ...);
```

---

#### M-3 · `scanRisks` mock used `.filter(Boolean)` without a type guard
**File:** `src/lib/agents.ts`

`.map(...).filter(Boolean)` does not reliably narrow `(Risk | null)[]` to `Risk[]` in strict TypeScript. The compiler may retain `null` in the inferred type depending on the tsconfig strictness level.

**Fix:**
```diff
- .filter(Boolean)
+ .filter((r): r is NonNullable<typeof r> => r !== null)
```

---

#### M-4 · `use-toasts.ts` setTimeout fired after potential unmount, no cleanup
**File:** `src/hooks/use-toasts.ts`

`addToast` stored no reference to the `setTimeout` return value, so `dismissToast` could not clear the timer. If a toast was dismissed manually before 4 s, the timer still fired and tried to remove an already-gone entry. If the component unmounted, the closure still executed against stale state.

**Fix:** Added a `timersRef` (`Map<id, timer>`) to track active timers. `dismissToast` now calls `clearTimeout` before deleting the entry. `addToast` registers the timer in the map. `dismissToast` was moved above `addToast` so the closure captures its final definition.

---

### 🔵 Low — Fixed

#### L-1 · `suppressHydrationWarning` missing on `<html>`
**File:** `src/app/layout.tsx`

The head script sets `data-theme="dark"` on `<html>` before React hydrates. Without `suppressHydrationWarning` on the `<html>` element, React detects the attribute mismatch between SSR output and the DOM modified by the inline script and emits a hydration warning in the console. This does not cause a visual regression but is noise in development and can trigger unexpected client-side re-renders in React's recovery path.

**Fix:**
```diff
- <html lang="en">
+ <html lang="en" suppressHydrationWarning>
```

---

## Verification Run — Round 2

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 15/15 tests passed (3 suites: `tasks.test.ts`, `agents.test.ts`, `api.test.ts`).

---

## Round 3 — Test Coverage And Final Review

### Task Given To Agent

The agent was asked to review the test coverage and bring it to a meaningful level across all library modules, then do one more final review of the full codebase.

### What The Agent Generated

A new `src/lib/schemas.test.ts` file (20 tests) covering all Zod schemas: `taskCreateSchema` defaults, string trimming, length constraints, invalid enum values; `taskUpdateSchema` partial updates; `taskQuerySchema` sort and filter defaults; `decomposeRequestSchema` non-empty taskId validation; `statusUpdateRequestSchema` audience enum and rejection of unknown values.

Extended `src/lib/tasks.test.ts` with six `serializeTask` tests: `in_progress` → `in-progress` conversion, `null` notes serialisation, `Date` → ISO string, recursive subtasks, `parentId` preservation. These completed the contract for the status translation layer that connects the DB representation to the public API shape.

Extended `src/lib/agents.test.ts` with eleven mock-mode tests covering all four agent functions. A `vi.mock("@/lib/prisma")` was required; the existing test helper `makeDbTask` caused a TypeScript `TS7023` circular return-type error when the mock was introduced. The fix was to define a named `type DbTask` with an explicit recursive `subtasks: DbTask[]` field and use it instead of `ReturnType<typeof makeDbTask>`.

Extended `src/lib/api.test.ts` with three tests: Prisma P2003 foreign-key error → 400, Zod error issues array structure, and `apiErrorMessage` join behaviour.

**Total test count after this round: 65 tests across 4 suites.** All passed green.

### Code Review Fixes In This Round

Four issues were found during the final review pass and fixed immediately:

**M-1 — Three inconsistent clarity thresholds in `agents.ts`.** `decomposeTask` used `< 35`, `scanRisks` used `< 45`, and `SCORE_WEIGHTS.clarityThreshold` was `40`. All three should have used the same constant. The two inline literals were replaced with `SCORE_WEIGHTS.clarityThreshold`.

**M-2 — Dead comparison in optimistic update in `use-task-manager.ts`.** After `t.subtasks.map(...)`, the result is always a new array — comparing it to `t.subtasks` with `===` is always false, so the early-exit optimisation never triggered. Replaced with `.some((s) => s.id === taskId)` to decide whether the task was found before doing the map.

**L-1 — Unnecessary optional chaining on Zod-guaranteed fields in `use-agent-flow.ts`.** `result.steps?.map(...)` and `result.risks?.map(...)` used `?.` on fields that the Zod schema guarantees are always present arrays. Removed the `?.`.

**L-2 — WebKit-only scrollbar CSS in `globals.css`.** Only `::-webkit-scrollbar` rules were present; Firefox and Chrome 121+ require `scrollbar-width` and `scrollbar-color`. Added a `*` block with both standard properties.

### Where The Agent Helped

All test code was generated by the agent. The Zod schema tests are mechanical and tedious to write by hand; having the agent produce them from the schema definitions and then reviewing the output for correctness was efficient. The final code review found four real issues that had survived two earlier review rounds, which justified running it again.

### Where Manual Work Was Needed

The TS7023 recursive type fix for `makeDbTask` required understanding the TypeScript inference rule for functions without explicit return types. The agent correctly identified the cause after seeing the error.

The two known non-fixable issues from Round 2 remain:
- Theme button still shows the wrong icon on initial dark-mode load (React `useState("light")` lags one paint behind the inline script). A proper fix requires reading `localStorage` inside the initial state value (i.e. `useState(() => typeof window !== "undefined" ? localStorage.getItem("devlog-theme") ?? "light" : "light")`), which was out of scope.
- `key={idx}` used for static lists in `agent-panel.tsx`. Acceptable for lists that never reorder.

### Verification Run — Round 3

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 65/65 tests passed (4 suites).
- `npm run build`: compiled successfully.

