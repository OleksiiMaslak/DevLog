import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { handleApiError } from "@/lib/api";
import { TaskNotFoundError } from "@/lib/errors";
import { apiErrorMessage } from "@/lib/api-utils";

describe("handleApiError", () => {
  it("returns 400 for Zod validation errors", async () => {
    const result = handleApiError(
      z.object({ title: z.string().min(2) }).safeParse({ title: "" }).error,
    );

    expect(result.status).toBe(400);
    await expect(result.json()).resolves.toMatchObject({ error: "Invalid request" });
  });

  it("returns 400 for malformed JSON errors", async () => {
    const result = handleApiError(new SyntaxError("Unexpected token"));

    expect(result.status).toBe(400);
    await expect(result.json()).resolves.toEqual({ error: "Malformed JSON body" });
  });

  it("returns 404 for task lookup failures", async () => {
    const result = handleApiError(new TaskNotFoundError());

    expect(result.status).toBe(404);
    await expect(result.json()).resolves.toEqual({ error: "Task not found" });
  });

  it("returns 404 for Prisma P2025 record-not-found error", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("Record not found", {
      code: "P2025",
      clientVersion: "0.0.0",
    });
    const result = handleApiError(error);

    expect(result.status).toBe(404);
    await expect(result.json()).resolves.toEqual({ error: "Task not found" });
  });

  it("returns 500 for unknown errors", async () => {
    const result = handleApiError(new Error("unexpected db failure"));

    expect(result.status).toBe(500);
    await expect(result.json()).resolves.toEqual({ error: "Internal server error" });
  });

  it("returns 400 for Prisma P2003 foreign-key constraint error", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
      code: "P2003",
      clientVersion: "0.0.0",
    });
    const result = handleApiError(error);

    expect(result.status).toBe(400);
    await expect(result.json()).resolves.toEqual({ error: "Referenced task does not exist" });
  });

  it("includes a structured issues array for Zod validation errors", async () => {
    const error = z.object({ title: z.string().min(2) }).safeParse({ title: "" }).error;
    const body = await handleApiError(error).json() as { issues: Array<{ path: string; message: string }> };

    expect(body.issues).toBeInstanceOf(Array);
    expect(body.issues[0]).toHaveProperty("path");
    expect(body.issues[0]).toHaveProperty("message");
  });
});

describe("apiErrorMessage", () => {
  it("joins issue messages with '; ' when issues are present", () => {
    const data = {
      issues: [
        { path: "title", message: "Title is required" },
        { path: "description", message: "Description is too short" },
      ],
    };
    expect(apiErrorMessage(data, "fallback")).toBe("Title is required; Description is too short");
  });

  it("returns the error string when no issues are present", () => {
    expect(apiErrorMessage({ error: "Task not found" }, "fallback")).toBe("Task not found");
  });

  it("returns the fallback when both error and issues are absent", () => {
    expect(apiErrorMessage({}, "Something went wrong")).toBe("Something went wrong");
  });
});
