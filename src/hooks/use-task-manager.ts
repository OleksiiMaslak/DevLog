import { useMemo, useState } from "react";
import type { TaskDTO } from "@/lib/tasks";
import type { PublicPriority } from "@/lib/schemas";
import { apiErrorMessage, emptyForm, type ApiErrorResponse } from "@/lib/api-utils";

export function useTaskManager(initialTasks: TaskDTO[]) {
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedId, setSelectedId] = useState(initialTasks[0]?.id ?? "");
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedId) ?? tasks[0] ?? null,
    [selectedId, tasks],
  );

  async function refresh() {
    const response = await fetch("/api/tasks?status=all&sort=date", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to refresh tasks");
    const data = (await response.json()) as { tasks: TaskDTO[] };
    setTasks(data.tasks);
    if (!data.tasks.some((task) => task.id === selectedId)) {
      setSelectedId(data.tasks[0]?.id ?? "");
    }
  }

  async function createTask(data: typeof emptyForm) {
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = (await response.json()) as { task: TaskDTO } & ApiErrorResponse;
    if (!response.ok) throw new Error(apiErrorMessage(result, "Could not create task"));
    setTasks((prev) => [...prev, result.task]);
    setSelectedId(result.task.id);
  }

  async function updateTask(taskId: string, patch: Partial<TaskDTO>) {
    const snapshot = tasks;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) return { ...t, ...patch };
        if (!t.subtasks.some((s) => s.id === taskId)) return t;
        return { ...t, subtasks: t.subtasks.map((s) => (s.id === taskId ? { ...s, ...patch } : s)) };
      }),
    );
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      setTasks(snapshot);
      const error = (await response.json()) as ApiErrorResponse;
      throw new Error(apiErrorMessage(error, "Could not update task"));
    }
    const { task: updated } = (await response.json()) as { task: TaskDTO };
    setTasks((prev) =>
      updated.parentId
        ? prev.map((t) =>
            t.id === updated.parentId
              ? { ...t, subtasks: t.subtasks.map((s) => (s.id === updated.id ? updated : s)) }
              : t,
          )
        : prev.map((t) => (t.id === updated.id ? updated : t)),
    );
  }

  async function createSubtask(
    parentId: string,
    data: { title: string; description: string; priority: PublicPriority },
  ) {
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, parentId, status: "todo" }),
    });
    const result = (await response.json()) as { task: TaskDTO } & ApiErrorResponse;
    if (!response.ok) throw new Error(apiErrorMessage(result, "Could not create subtask"));
    setTasks((prev) =>
      prev.map((t) =>
        t.id === parentId ? { ...t, subtasks: [...t.subtasks, result.task] } : t,
      ),
    );
  }

  async function deleteTask(taskId: string) {
    const snapshot = tasks;
    const isTopLevel = tasks.some((t) => t.id === taskId);
    if (isTopLevel) {
      const remaining = tasks.filter((t) => t.id !== taskId);
      setTasks(remaining);
      if (selectedId === taskId) setSelectedId(remaining[0]?.id ?? "");
    } else {
      setTasks((prev) =>
        prev.map((t) => ({ ...t, subtasks: t.subtasks.filter((s) => s.id !== taskId) })),
      );
    }
    const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (!response.ok) {
      setTasks(snapshot);
      const data = await response.json().catch(() => ({})) as ApiErrorResponse;
      throw new Error(apiErrorMessage(data, "Could not delete task"));
    }
  }

  return { tasks, selectedId, setSelectedId, selectedTask, refresh, createTask, createSubtask, updateTask, deleteTask };
}
