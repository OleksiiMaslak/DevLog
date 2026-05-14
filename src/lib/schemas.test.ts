import { describe, expect, it } from "vitest";
import {
  taskCreateSchema,
  taskUpdateSchema,
  taskQuerySchema,
  decomposeRequestSchema,
  statusUpdateRequestSchema,
} from "@/lib/schemas";

describe("taskCreateSchema", () => {
  const valid = { title: "Fix login bug", description: "Users cannot log in via the SSO provider." };

  it("accepts a valid task and applies default status and priority", () => {
    const result = taskCreateSchema.parse(valid);
    expect(result.status).toBe("todo");
    expect(result.priority).toBe("medium");
  });

  it("trims whitespace from title and description", () => {
    const result = taskCreateSchema.parse({
      title: "  Fix login bug  ",
      description: "  Users cannot log in via the SSO provider.  ",
    });
    expect(result.title).toBe("Fix login bug");
    expect(result.description).toBe("Users cannot log in via the SSO provider.");
  });

  it("rejects title shorter than 2 characters", () => {
    expect(() => taskCreateSchema.parse({ ...valid, title: "x" })).toThrow();
  });

  it("rejects title longer than 120 characters", () => {
    expect(() => taskCreateSchema.parse({ ...valid, title: "a".repeat(121) })).toThrow();
  });

  it("rejects description shorter than 4 characters", () => {
    expect(() => taskCreateSchema.parse({ ...valid, description: "abc" })).toThrow();
  });

  it("rejects description longer than 2000 characters", () => {
    expect(() => taskCreateSchema.parse({ ...valid, description: "a".repeat(2001) })).toThrow();
  });

  it("rejects an unknown status value", () => {
    expect(() => taskCreateSchema.parse({ ...valid, status: "pending" })).toThrow();
  });

  it("rejects an unknown priority value", () => {
    expect(() => taskCreateSchema.parse({ ...valid, priority: "urgent" })).toThrow();
  });

  it("accepts explicit valid status and priority", () => {
    const result = taskCreateSchema.parse({ ...valid, status: "in-progress", priority: "high" });
    expect(result.status).toBe("in-progress");
    expect(result.priority).toBe("high");
  });
});

describe("taskUpdateSchema", () => {
  it("accepts an empty object — all fields are optional", () => {
    expect(() => taskUpdateSchema.parse({})).not.toThrow();
  });

  it("accepts a partial update with only title", () => {
    const result = taskUpdateSchema.parse({ title: "Renamed task" });
    expect(result.title).toBe("Renamed task");
    expect(result.description).toBeUndefined();
    expect(result.status).toBeUndefined();
  });

  it("rejects an invalid priority on update", () => {
    expect(() => taskUpdateSchema.parse({ priority: "critical" })).toThrow();
  });

  it("rejects a title that is too short on update", () => {
    expect(() => taskUpdateSchema.parse({ title: "a" })).toThrow();
  });
});

describe("taskQuerySchema", () => {
  it("defaults to status 'all' and sort 'priority'", () => {
    const result = taskQuerySchema.parse({});
    expect(result.status).toBe("all");
    expect(result.sort).toBe("priority");
  });

  it("accepts 'date' sort", () => {
    const result = taskQuerySchema.parse({ sort: "date" });
    expect(result.sort).toBe("date");
  });

  it("accepts a specific status filter", () => {
    const result = taskQuerySchema.parse({ status: "in-progress" });
    expect(result.status).toBe("in-progress");
  });

  it("rejects an unknown sort value", () => {
    expect(() => taskQuerySchema.parse({ sort: "created" })).toThrow();
  });

  it("rejects an unknown status value", () => {
    expect(() => taskQuerySchema.parse({ status: "pending" })).toThrow();
  });
});

describe("decomposeRequestSchema", () => {
  it("requires a non-empty taskId", () => {
    expect(() => decomposeRequestSchema.parse({ taskId: "" })).toThrow();
    expect(() => decomposeRequestSchema.parse({ taskId: "   " })).toThrow();
  });

  it("defaults createSubtasks to false", () => {
    const result = decomposeRequestSchema.parse({ taskId: "task-1" });
    expect(result.createSubtasks).toBe(false);
  });

  it("accepts an optional answers array", () => {
    const result = decomposeRequestSchema.parse({
      taskId: "task-1",
      answers: ["Yes, REST API only", "Must support pagination"],
    });
    expect(result.answers).toEqual(["Yes, REST API only", "Must support pagination"]);
  });

  it("rejects blank strings inside the answers array", () => {
    expect(() =>
      decomposeRequestSchema.parse({ taskId: "task-1", answers: ["   "] }),
    ).toThrow();
  });
});

describe("statusUpdateRequestSchema", () => {
  it("defaults audience to 'team'", () => {
    const result = statusUpdateRequestSchema.parse({ taskId: "task-1" });
    expect(result.audience).toBe("team");
  });

  it("accepts all valid audience values", () => {
    expect(statusUpdateRequestSchema.parse({ taskId: "t", audience: "lead" }).audience).toBe("lead");
    expect(statusUpdateRequestSchema.parse({ taskId: "t", audience: "standup" }).audience).toBe("standup");
  });

  it("rejects an unknown audience value", () => {
    expect(() =>
      statusUpdateRequestSchema.parse({ taskId: "task-1", audience: "manager" }),
    ).toThrow();
  });

  it("requires a non-empty taskId", () => {
    expect(() => statusUpdateRequestSchema.parse({ taskId: "" })).toThrow();
  });
});
