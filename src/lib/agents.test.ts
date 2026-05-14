import { describe, expect, it, vi, beforeEach } from "vitest";
import { scoreTask, prioritizeTasks, decomposeTask, generateStatusUpdate, scanRisks, PrioritizationResult, DecompositionResult, StatusUpdateResult, RiskScanResult } from "@/lib/agents";
import { prisma } from "@/lib/prisma";
import type { TaskDTO } from "@/lib/tasks";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

function task(overrides: Partial<TaskDTO>): TaskDTO {
  return {
    id: "task-1",
    title: "Build the useful thing",
    description: "A clear task with enough implementation detail for an engineer to start safely.",
    status: "todo",
    priority: "medium",
    notes: "",
    parentId: null,
    createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    subtasks: [],
    ...overrides,
  };
}

describe("agent scoring", () => {
  it("prioritizes high-priority active work over low-priority active work", () => {
    expect(scoreTask(task({ priority: "high" }))).toBeGreaterThan(scoreTask(task({ priority: "low" })));
  });

  it("penalizes completed tasks", () => {
    expect(scoreTask(task({ status: "done", priority: "high" }))).toBeLessThan(scoreTask(task({ status: "todo", priority: "medium" })));
  });

  it("applies age boost to older tasks and caps at 14 days", () => {
    const young = task({ createdAt: new Date(Date.now() - 1 * 86_400_000).toISOString() });
    const atCap = task({ createdAt: new Date(Date.now() - 14 * 86_400_000).toISOString() });
    const overCap = task({ createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString() });
    expect(scoreTask(atCap)).toBeGreaterThan(scoreTask(young));
    expect(scoreTask(overCap)).toBe(scoreTask(atCap)); // cap enforced — 30 days = same as 14 days
  });

  it("penalizes tasks with short descriptions", () => {
    const vague = task({ description: "short desc" });
    const clear = task({ description: "A clear task with enough implementation detail for an engineer to start safely." });
    expect(scoreTask(vague)).toBeLessThan(scoreTask(clear));
  });
});

describe("agent output schemas", () => {
  it("validates prioritization results", () => {
    expect(() =>
      PrioritizationResult.parse({
        steps: [
          { title: "Gathered tasks", detail: "Read current work." },
          { title: "Ranked work", detail: "Balanced age and priority." },
        ],
        recommendation: "Start with task-1.",
        orderedTaskIds: ["task-1"],
      }),
    ).not.toThrow();
  });

  it("validates decomposition result shape", () => {
    expect(
      DecompositionResult.parse({
        steps: [
          { title: "Checked clarity", detail: "Enough context exists." },
          { title: "Generated subtasks", detail: "Split by delivery step." },
        ],
        needsClarification: false,
        clarifyingQuestions: [],
        subtasks: [{ title: "Implement", description: "Build the main path.", priority: "medium" }],
        createdSubtaskIds: [],
      }).subtasks,
    ).toHaveLength(1);
  });

  it("validates status update result shape", () => {
    expect(
      StatusUpdateResult.parse({
        steps: [
          { title: "Collected context", detail: "Read task details." },
          { title: "Matched tone", detail: "Kept it Slack-friendly." },
        ],
        message: "Progress is on track.",
        tone: "clear",
      }).message,
    ).toContain("Progress");
  });

  it("validates risk scan result shape", () => {
    expect(
      RiskScanResult.parse({
        steps: [
          { title: "Reviewed tasks", detail: "Checked open work." },
          { title: "Found risks", detail: "Looked for vague items." },
        ],
        risks: [],
        summary: "No obvious risks.",
      }).summary,
    ).toContain("risks");
  });
});

// ---------------------------------------------------------------------------
// Agent functions — mock mode (AI_MOCK_MODE=true, Prisma mocked)
// ---------------------------------------------------------------------------

const NOW = Date.now();

type DbTask = {
  id: string; title: string; description: string; status: string;
  priority: string; notes: string | null; parentId: string | null;
  createdAt: Date; updatedAt: Date; subtasks: DbTask[];
};

function makeDbTask(overrides: Partial<DbTask> = {}): DbTask {
  return {
    id: "t-1",
    title: "Refactor authentication service for SSO compatibility",
    description: "Enterprise SSO login fails when using third-party identity providers. Investigate token expiry and redirect handling in the middleware layer.",
    status: "todo",
    priority: "high",
    notes: null,
    parentId: null,
    createdAt: new Date(NOW - 5 * 86_400_000),
    updatedAt: new Date(NOW),
    subtasks: [],
    ...overrides,
  };
}

describe("agent functions — mock mode", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.AI_MOCK_MODE = "true";
  });

  describe("prioritizeTasks()", () => {
    it("returns a valid PrioritizationResult with ordered task ids", async () => {
      const high = makeDbTask({ id: "t-1", priority: "high" });
      const low = makeDbTask({ id: "t-2", priority: "low", status: "todo" });
      vi.mocked(prisma.task.findMany).mockResolvedValue([high, low] as never);

      const result = await prioritizeTasks();

      expect(() => PrioritizationResult.parse(result)).not.toThrow();
      expect(result.orderedTaskIds).toContain("t-1");
      // high-priority task should appear before low-priority task
      expect(result.orderedTaskIds.indexOf("t-1")).toBeLessThan(
        result.orderedTaskIds.indexOf("t-2"),
      );
    });

    it("excludes done tasks from the recommendation", async () => {
      const done = makeDbTask({ id: "t-done", status: "done" });
      vi.mocked(prisma.task.findMany).mockResolvedValue([done] as never);

      const result = await prioritizeTasks();

      expect(result.orderedTaskIds).not.toContain("t-done");
      expect(result.recommendation).toMatch(/no active tasks/i);
    });
  });

  describe("decomposeTask()", () => {
    it("requests clarification when the task title is vague", async () => {
      const vagueTask = makeDbTask({ id: "t-vague", title: "Todo", description: "fix" });
      vi.mocked(prisma.task.findUnique).mockResolvedValue(vagueTask as never);

      const result = await decomposeTask("t-vague", false);

      expect(result.needsClarification).toBe(true);
      expect(result.clarifyingQuestions.length).toBeGreaterThan(0);
      expect(result.subtasks).toHaveLength(0);
    });

    it("generates subtasks when the task description is clear", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue(makeDbTask() as never);

      const result = await decomposeTask("t-1", false);

      expect(result.needsClarification).toBe(false);
      expect(result.subtasks.length).toBeGreaterThan(0);
    });

    it("does not call $transaction when createSubtasks is false", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue(makeDbTask() as never);

      await decomposeTask("t-1", false);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("calls $transaction to persist subtasks when createSubtasks is true", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue(makeDbTask() as never);
      vi.mocked(prisma.$transaction).mockResolvedValue([
        makeDbTask({ id: "sub-1" }),
        makeDbTask({ id: "sub-2" }),
        makeDbTask({ id: "sub-3" }),
      ] as never);

      const result = await decomposeTask("t-1", true);

      expect(prisma.$transaction).toHaveBeenCalledOnce();
      expect(result.createdSubtaskIds).toEqual(["sub-1", "sub-2", "sub-3"]);
    });
  });

  describe("generateStatusUpdate()", () => {
    it("returns a valid StatusUpdateResult containing the task title", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue(makeDbTask() as never);

      const result = await generateStatusUpdate("t-1", "standup");

      expect(() => StatusUpdateResult.parse(result)).not.toThrow();
      expect(result.message).toContain("Refactor authentication service");
    });

    it("reflects subtask progress in the message when subtasks exist", async () => {
      const done = makeDbTask({ id: "sub-1", status: "done", subtasks: [] });
      const open = makeDbTask({ id: "sub-2", status: "todo", subtasks: [] });
      const taskWithSubs = makeDbTask({ subtasks: [done, open] });
      vi.mocked(prisma.task.findUnique).mockResolvedValue(taskWithSubs as never);

      const result = await generateStatusUpdate("t-1", "team");

      expect(result.message).toMatch(/1\/2/);
    });
  });

  describe("scanRisks()", () => {
    it("returns a valid RiskScanResult", async () => {
      vi.mocked(prisma.task.findMany).mockResolvedValue([makeDbTask()] as never);

      const result = await scanRisks();

      expect(() => RiskScanResult.parse(result)).not.toThrow();
    });

    it("flags tasks with vague descriptions as risks", async () => {
      const vagueTask = makeDbTask({ description: "short" });
      vi.mocked(prisma.task.findMany).mockResolvedValue([vagueTask] as never);

      const result = await scanRisks();

      expect(result.risks.length).toBeGreaterThan(0);
      expect(result.risks[0].taskId).toBe("t-1");
    });

    it("flags stale open tasks (> 7 days old) as high severity", async () => {
      const staleTask = makeDbTask({
        createdAt: new Date(NOW - 10 * 86_400_000),
        description: "A sufficiently long description that avoids the vagueness penalty on its own.",
      });
      vi.mocked(prisma.task.findMany).mockResolvedValue([staleTask] as never);

      const result = await scanRisks();

      expect(result.risks[0].severity).toBe("high");
    });

    it("returns no risks and a clean summary when all tasks are fresh and clear", async () => {
      const freshTask = makeDbTask({
        createdAt: new Date(NOW - 1 * 86_400_000),
        description: "A sufficiently long description that avoids the vagueness penalty completely.",
      });
      vi.mocked(prisma.task.findMany).mockResolvedValue([freshTask] as never);

      const result = await scanRisks();

      expect(result.risks).toHaveLength(0);
      expect(result.summary).toMatch(/no obvious/i);
    });
  });
});

