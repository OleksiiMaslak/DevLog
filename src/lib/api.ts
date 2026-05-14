import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { TaskNotFoundError } from "@/lib/errors";

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: "Invalid request",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  if (error instanceof SyntaxError) {
    return Response.json({ error: "Malformed JSON body" }, { status: 400 });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return Response.json({ error: "Task not found" }, { status: 404 });
    }
    if (error.code === "P2003") {
      return Response.json({ error: "Referenced task does not exist" }, { status: 400 });
    }
  }

  if (error instanceof TaskNotFoundError) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  console.error(error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
