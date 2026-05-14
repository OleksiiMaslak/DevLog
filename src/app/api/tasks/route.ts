import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { taskCreateSchema, taskQuerySchema } from "@/lib/schemas";
import { listTasks, serializeTask, toDbStatus } from "@/lib/tasks";

export async function GET(request: NextRequest) {
  try {
    const query = taskQuerySchema.parse({
      status: request.nextUrl.searchParams.get("status") ?? "all",
      sort: request.nextUrl.searchParams.get("sort") ?? "priority",
    });

    return Response.json({ tasks: await listTasks(query) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = taskCreateSchema.parse(await request.json());
    const task = await prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        status: toDbStatus(input.status),
        priority: input.priority,
        notes: input.notes || null,
        parentId: input.parentId || null,
      },
    });

    return Response.json({ task: serializeTask({ ...task, subtasks: [] }) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
