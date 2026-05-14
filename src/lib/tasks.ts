import type { Task } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publicStatusSchema, publicPrioritySchema, type PublicPriority, type PublicStatus, priorityRank } from "@/lib/schemas";
import { TaskNotFoundError } from "@/lib/errors";

export type TaskWithSubtasks = Task & { subtasks: Task[] };

export type TaskDTO = {
  id: string;
  title: string;
  description: string;
  status: PublicStatus;
  priority: PublicPriority;
  notes: string;
  parentId: string | null;
  createdAt: string;
  subtasks: TaskDTO[];
};

export function toDbStatus(status: PublicStatus) {
  return status === "in-progress" ? "in_progress" : status;
}

export function fromDbStatus(status: string): PublicStatus {
  if (status === "in_progress") return "in-progress";
  return publicStatusSchema.parse(status);
}

export function serializeTask(task: TaskWithSubtasks): TaskDTO {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: fromDbStatus(task.status),
    priority: publicPrioritySchema.parse(task.priority),
    notes: task.notes ?? "",
    parentId: task.parentId,
    createdAt: task.createdAt.toISOString(),
    subtasks: task.subtasks.map((subtask) =>
      serializeTask({ ...subtask, subtasks: [] }),
    ),
  };
}

export { priorityRank };

export async function listTasks(options?: {
  status?: PublicStatus | "all";
  sort?: "priority" | "date";
}) {
  const tasks = await prisma.task.findMany({
    where: {
      parentId: null,
      ...(options?.status && options.status !== "all"
        ? { status: toDbStatus(options.status) }
        : {}),
    },
    include: { subtasks: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  const serialized = tasks.map(serializeTask);
  return options?.sort === "date"
    ? serialized
    : serialized.toSorted(
        (a, b) =>
          priorityRank[a.priority] - priorityRank[b.priority] ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
}

export async function getTask(id: string): Promise<TaskDTO> {
  const task = await prisma.task.findUnique({
    where: { id },
    include: { subtasks: { orderBy: { createdAt: "asc" } } },
  });

  if (!task) throw new TaskNotFoundError();
  return serializeTask(task);
}

export function taskAgeDays(task: Pick<TaskDTO, "createdAt">) {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(task.createdAt).getTime()) / 86_400_000),
  );
}
