import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getTask,
  listTasks,
  taskAgeDays,
  toDbStatus,
  type TaskDTO,
} from "@/lib/tasks";
import { publicPrioritySchema } from "@/lib/schemas";

const AgentStep = z.object({
  title: z.string(),
  detail: z.string(),
});

export const PrioritizationResult = z.object({
  steps: z.array(AgentStep).min(2),
  recommendation: z.string(),
  orderedTaskIds: z.array(z.string()),
});

export const DecompositionResult = z.object({
  steps: z.array(AgentStep).min(2),
  needsClarification: z.boolean(),
  clarifyingQuestions: z.array(z.string()),
  subtasks: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      priority: publicPrioritySchema,
    }),
  ),
  createdSubtaskIds: z.array(z.string()).default([]),
});

export const StatusUpdateResult = z.object({
  steps: z.array(AgentStep).min(2),
  message: z.string(),
  tone: z.string(),
});

export const RiskScanResult = z.object({
  steps: z.array(AgentStep).min(2),
  risks: z.array(
    z.object({
      taskId: z.string(),
      title: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      reason: z.string(),
      nextAction: z.string(),
    }),
  ),
  summary: z.string(),
});

type CompletionSchema<T extends z.ZodTypeAny> = {
  name: string;
  schema: T;
};

function shouldUseMock() {
  return (
    process.env.AI_MOCK_MODE === "true" ||
    process.env.AI_PROVIDER === "mock" ||
    !process.env.OPENAI_API_KEY
  );
}

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  return (openaiClient ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
  }));
}

async function completeStructured<T extends z.ZodTypeAny>(
  output: CompletionSchema<T>,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
) {
  if (shouldUseMock()) return null;

  const completion = await getOpenAIClient().chat.completions.parse({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    messages,
    response_format: zodResponseFormat(output.schema, output.name),
  });

  return completion.choices[0]?.message.parsed ?? null;
}

// Scoring weights — tuned to surface the highest-urgency active work.
// Priority is the dominant signal. Age boost is capped at 14 days so a
// chronically stale task cannot eclipse a newly created urgent one by more
// than a modest margin. Completed tasks receive a heavy penalty (-50) in case
// they are accidentally passed to scoreTask; prioritizeTasks pre-filters them.
const SCORE_WEIGHTS = {
  priority: { high: 40, medium: 24, low: 12 } as const,
  maxAgeDays: 14,
  statusBoost: { "in-progress": 10, todo: 6, done: -50 } as const,
  clarityThreshold: 40, // minimum description length; below this a penalty is applied
  clarityPenalty: 8,
} as const;

// Sends only the fields an LLM needs — avoids bloating the context with ISO dates,
// notes, parentId, and full subtask arrays.
function slimTask(task: TaskDTO) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    ageDays: taskAgeDays(task),
    subtaskCount: task.subtasks.length,
    doneSubtaskCount: task.subtasks.filter((s) => s.status === "done").length,
  };
}

export function scoreTask(task: TaskDTO) {
  const ageBoost = Math.min(taskAgeDays(task), SCORE_WEIGHTS.maxAgeDays);
  const statusBoost = SCORE_WEIGHTS.statusBoost[task.status];
  const clarityPenalty = task.description.length < SCORE_WEIGHTS.clarityThreshold
    ? SCORE_WEIGHTS.clarityPenalty
    : 0;
  return SCORE_WEIGHTS.priority[task.priority] + ageBoost + statusBoost - clarityPenalty;
}

export async function prioritizeTasks() {
  const tasks = await listTasks({ status: "all", sort: "date" });
  const activeTasks = tasks.filter((task) => task.status !== "done");
  const ranked = activeTasks.toSorted((a, b) => scoreTask(b) - scoreTask(a));

  const llm = await completeStructured(
    { name: "prioritization_result", schema: PrioritizationResult },
    [
      {
        role: "system",
        content:
          "You are an engineering task triage agent. Explain your steps, weigh priority, age, status, clarity, and subtasks, then recommend what to start today.",
      },
      { role: "user", content: JSON.stringify({ tasks: activeTasks.map(slimTask) }) },
    ],
  );

  const result = llm ?? PrioritizationResult.parse({
    steps: [
      {
        title: "Filtered completed work",
        detail: `Ignored ${tasks.length - activeTasks.length} completed task(s) so the plan focuses on actionable work.`,
      },
      {
        title: "Scored active tasks",
        detail:
          "Combined priority, task age, current status, and description clarity rather than taking the first high-priority item blindly.",
      },
    ],
    recommendation: ranked[0]
      ? `Start with "${ranked[0].title}" because it has the strongest urgency score and is not done.`
      : "There are no active tasks. Use the time to review completed work or add the next initiative.",
    orderedTaskIds: ranked.map((task) => task.id),
  });

  return result;
}

export async function decomposeTask(taskId: string, createSubtasks: boolean, answers?: string[]) {
  const task = await getTask(taskId);

  const tooVague =
    !answers?.length &&
    (task.title.length < 8 ||
      task.description.length < SCORE_WEIGHTS.clarityThreshold ||
      /\b(todo|fix|stuff|thing|misc)\b/i.test(task.title));

  const userContent = answers?.length
    ? { task, clarificationAnswers: answers }
    : { task };

  const llm = await completeStructured(
    { name: "decomposition_result", schema: DecompositionResult },
    [
      {
        role: "system",
        content:
          "You decompose engineering tasks. First decide whether the task is clear enough. If unclear, ask clarifying questions. If clear, return practical subtasks. When clarification answers are provided, use them to generate accurate subtasks.",
      },
      { role: "user", content: JSON.stringify(userContent) },
    ],
  );

  const base = llm ??
    DecompositionResult.parse(
        tooVague
          ? {
              steps: [
                { title: "Checked task clarity", detail: "The description is too short or generic." },
                { title: "Paused generation", detail: "Creating subtasks now would invent missing scope." },
              ],
              needsClarification: true,
              clarifyingQuestions: [
                "What user or system behavior should change when this is complete?",
                "What constraints or acceptance criteria should the implementer preserve?",
              ],
              subtasks: [],
              createdSubtaskIds: [],
            }
          : {
              steps: [
                { title: "Read task context", detail: "Used title, description, current status, and priority." },
                { title: "Split by delivery flow", detail: "Generated small implementation, validation, and documentation slices." },
              ],
              needsClarification: false,
              clarifyingQuestions: [],
              subtasks: [
                {
                  title: `Define acceptance criteria for ${task.title}`,
                  description: `Write the success conditions and edge cases for: ${task.description}`,
                  priority: task.priority,
                },
                {
                  title: `Implement core path for ${task.title}`,
                  description: "Build the smallest working path first, keeping integration points explicit.",
                  priority: task.priority,
                },
                {
                  title: `Verify and document ${task.title}`,
                  description: "Add focused tests or manual checks, then document the tradeoffs.",
                  priority: "medium",
                },
              ],
              createdSubtaskIds: [],
            },
      );

  if (!createSubtasks || base.needsClarification || base.subtasks.length === 0) {
    return base;
  }

  const created = await prisma.$transaction(
    base.subtasks.map((subtask) =>
      prisma.task.create({
        data: {
          title: subtask.title,
          description: subtask.description,
          priority: subtask.priority,
          status: toDbStatus("todo"),
          parentId: task.id,
        },
      }),
    ),
  );

  return {
    ...base,
    createdSubtaskIds: created.map((subtask) => subtask.id),
  };
}

export async function generateStatusUpdate(taskId: string, audience: "team" | "lead" | "standup") {
  const task = await getTask(taskId);

  const llm = await completeStructured(
    { name: "status_update_result", schema: StatusUpdateResult },
    [
      {
        role: "system",
        content:
          "Draft concise async engineering updates. Mention progress, blockers, and next step when available. Keep it suitable for Slack.",
      },
      { role: "user", content: JSON.stringify({ task, audience }) },
    ],
  );

  if (llm) return llm;

  const done = task.subtasks.filter((subtask) => subtask.status === "done").length;
  const total = task.subtasks.length;

  return StatusUpdateResult.parse({
    steps: [
      { title: "Collected context", detail: "Used the task status, priority, notes, and subtasks." },
      { title: "Matched tone", detail: `Kept the message concise for a ${audience} async update.` },
    ],
    tone: audience === "lead" ? "direct and risk-aware" : "clear and collaborative",
    message: `Update on ${task.title}: currently ${task.status} with ${task.priority} priority. ${
      total ? `${done}/${total} subtasks are done. ` : ""
    }Next step: keep moving on the smallest open slice and call out blockers early.${task.notes ? ` Note: ${task.notes}` : ""}`,
  });
}

export async function scanRisks() {
  const tasks = await listTasks({ status: "all", sort: "date" });
  const llm = await completeStructured(
    { name: "risk_scan_result", schema: RiskScanResult },
    [
      {
        role: "system",
        content:
          "You are a delivery-risk agent. Find stale, vague, blocked, or drifting engineering tasks and suggest next actions.",
      },
      { role: "user", content: JSON.stringify({ tasks: tasks.map(slimTask) }) },
    ],
  );

  if (llm) return llm;

  const risks = tasks
    .filter((task) => task.status !== "done")
    .map((task) => {
      const age = taskAgeDays(task);
      const vague = task.description.length < SCORE_WEIGHTS.clarityThreshold;
      if (age < 3 && !vague) return null;
      return {
        taskId: task.id,
        title: task.title,
        severity: age > 7 || vague ? "high" : "medium",
        reason: vague
          ? "The description is thin, so implementation can drift or require repeated clarification."
          : `The task has been open for ${age} day(s), which can hide blockers.`,
        nextAction: vague
          ? "Add acceptance criteria or run decomposition before implementation."
          : "Post a short status update and decide whether to split or close the task.",
      } as const;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return RiskScanResult.parse({
    steps: [
      { title: "Reviewed open tasks", detail: "Ignored completed work and inspected active descriptions." },
      { title: "Checked drift signals", detail: "Looked for age, vague scope, and missing next actions." },
    ],
    risks,
    summary:
      risks.length > 0
        ? "Risk scan found work that may need clarification or a next-step reset."
        : "No obvious delivery risks in the current active task set.",
  });
}


