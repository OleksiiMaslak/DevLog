import { describe, expect, it } from "vitest";
import { fromDbStatus, serializeTask, taskAgeDays, toDbStatus, type TaskWithSubtasks } from "@/lib/tasks";

function dbTask(overrides: Partial<TaskWithSubtasks> = {}): TaskWithSubtasks {
  return {
    id: "t-1",
    title: "Fix authentication service",
    description: "SSO login fails for enterprise users.",
    status: "todo",
    priority: "medium",
    notes: null,
    parentId: null,
    createdAt: new Date("2026-05-01T10:00:00.000Z"),
    updatedAt: new Date("2026-05-01T10:00:00.000Z"),
    subtasks: [],
    ...overrides,
  };
}

describe("task helpers", () => {
  it("maps public status values to Prisma enum values", () => {
    expect(toDbStatus("in-progress")).toBe("in_progress");
    expect(fromDbStatus("in_progress")).toBe("in-progress");
  });

  it("calculates task age in whole days", () => {
    expect(taskAgeDays({ createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString() })).toBe(3);
  });
});

describe("serializeTask", () => {
  it("converts DB 'in_progress' status to public 'in-progress'", () => {
    expect(serializeTask(dbTask({ status: "in_progress" })).status).toBe("in-progress");
  });

  it("passes through 'todo' and 'done' statuses unchanged", () => {
    expect(serializeTask(dbTask({ status: "todo" })).status).toBe("todo");
    expect(serializeTask(dbTask({ status: "done" })).status).toBe("done");
  });

  it("replaces null notes with an empty string", () => {
    expect(serializeTask(dbTask({ notes: null })).notes).toBe("");
  });

  it("preserves non-null notes", () => {
    expect(serializeTask(dbTask({ notes: "Blocked on API access" })).notes).toBe("Blocked on API access");
  });

  it("converts createdAt Date to ISO string", () => {
    const createdAt = new Date("2026-05-01T10:00:00.000Z");
    expect(serializeTask(dbTask({ createdAt })).createdAt).toBe("2026-05-01T10:00:00.000Z");
  });

  it("recursively serializes subtasks", () => {
    const subtask = dbTask({ id: "t-2", title: "Write tests", subtasks: [] });
    const dto = serializeTask(dbTask({ subtasks: [subtask] }));
    expect(dto.subtasks).toHaveLength(1);
    expect(dto.subtasks[0].id).toBe("t-2");
    expect(dto.subtasks[0].subtasks).toEqual([]);
  });

  it("preserves parentId when set", () => {
    expect(serializeTask(dbTask({ parentId: "parent-1" })).parentId).toBe("parent-1");
  });
});
