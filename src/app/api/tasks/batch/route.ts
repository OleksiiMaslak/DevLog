import { z } from "zod";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { publicPrioritySchema, titleField, descriptionField } from "@/lib/schemas";
import { serializeTask, toDbStatus } from "@/lib/tasks";

// Validates the batch-create body. Max 20 subtasks keeps the transaction bounded.
// Field constraints are imported from schemas.ts to stay in sync with taskCreateSchema.
const batchCreateSchema = z.object({
  parentId: z.string().trim().min(1),
  subtasks: z
    .array(
      z.object({
        title: titleField,
        description: descriptionField,
        priority: publicPrioritySchema,
      }),
    )
    .min(1)
    .max(20),
});

// Creates all subtasks in a single transaction so the operation is all-or-nothing.
export async function POST(request: Request) {
  try {
    const input = batchCreateSchema.parse(await request.json());
    const created = await prisma.$transaction(
      input.subtasks.map((subtask) =>
        prisma.task.create({
          data: {
            title: subtask.title,
            description: subtask.description,
            priority: subtask.priority,
            status: toDbStatus("todo"),
            parentId: input.parentId,
          },
        }),
      ),
    );
    return Response.json(
      { tasks: created.map((task) => serializeTask({ ...task, subtasks: [] })) },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
