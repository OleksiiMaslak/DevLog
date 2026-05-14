import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { taskUpdateSchema } from "@/lib/schemas";
import { getTask, serializeTask, toDbStatus } from "@/lib/tasks";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    return Response.json({ task: await getTask(id) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const input = taskUpdateSchema.parse(await request.json());
    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: toDbStatus(input.status) } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId || null } : {}),
      },
      include: { subtasks: { orderBy: { createdAt: "asc" } } },
    });

    return Response.json({ task: serializeTask(task) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    await prisma.task.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
