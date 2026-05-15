"use client";

import { AlertTriangle, Check, Moon, Pencil, Sun, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import clsx from "clsx";
import type { PublicStatus } from "@/lib/schemas";
import type { TaskDTO } from "@/lib/tasks";
import { dateFormatter } from "@/lib/formatters";
import { useToasts } from "@/hooks/use-toasts";
import { useTaskManager } from "@/hooks/use-task-manager";
import { useAgentFlow } from "@/hooks/use-agent-flow";
import { BacklogPanel, type SortMode } from "@/components/backlog-panel";
import { TaskEditor } from "@/components/task-editor";
import { AgentPanel } from "@/components/agent-panel";

type ThemeMode = "light" | "dark";

export function DevLogWorkspace({ initialTasks }: { initialTasks: TaskDTO[] }) {
  const { toasts, addToast, dismissToast } = useToasts();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<PublicStatus | "all">("all");
  const [sort, setSort] = useState<SortMode>("priority");
  const [theme, setTheme] = useState<ThemeMode>("light");

  const { tasks, selectedId, setSelectedId, selectedTask, refresh, createTask, createSubtask, updateTask, deleteTask } =
    useTaskManager(initialTasks);
  const {
    agentOutput,
    agentPending,
    runWithPending,
    clarifying,
    updateClarifyingAnswer,
    dismissClarifying,
    prioritize,
    decompose,
    decomposeWithAnswers,
    createFromPlan,
    statusUpdate,
    riskScan,
  } = useAgentFlow(selectedTask, refresh);

  useEffect(() => {
    const saved = localStorage.getItem("devlog-theme") as ThemeMode | null;
    const resolved: ThemeMode =
      saved === "light" || saved === "dark"
        ? saved
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.dataset.theme = resolved;
    setTheme(resolved);
  }, []);

  function toggleTheme() {
    const next: ThemeMode = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("devlog-theme", next);
    setTheme(next);
  }

  async function withToast(action: () => Promise<void>, successMsg?: string) {
    try {
      await action();
      if (successMsg) addToast(successMsg, "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Unexpected error", "error");
    }
  }

  function run(action: () => Promise<void>, successMsg?: string) {
    startTransition(() => withToast(action, successMsg));
  }

  async function runAgentAction(action: () => Promise<void>, successMsg?: string) {
    await runWithPending(() => withToast(action, successMsg));
  }

  async function updateSelected(patch: Partial<TaskDTO>) {
    if (!selectedTask) return;
    await updateTask(selectedTask.id, patch);
  }

  async function deleteSelected() {
    if (!selectedTask) return;
    await deleteTask(selectedTask.id);
  }

  return (
    <main className="min-h-screen bg-canvas p-4 text-ink md:p-6">
      <header className="mx-auto mb-4 flex max-w-7xl flex-col gap-3 border-b border-line pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase text-muted">AI-assisted delivery desk</p>
          <h1 className="font-serif text-4xl font-semibold leading-none md:text-5xl">DevLog</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            A compact command surface for task tracking, agent triage, and async engineering updates.
          </p>
        </div>
        <button
          className="flex w-fit items-center gap-2 rounded-full border border-line bg-panel px-3 py-2 text-sm font-semibold shadow-soft transition hover:border-teal"
          onClick={toggleTheme}
        >
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          {theme === "light" ? "Dark" : "Light"}
        </button>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[340px_minmax(0,1fr)_360px]">
        <BacklogPanel
          tasks={tasks}
          selectedTaskId={selectedId}
          filter={filter}
          sort={sort}
          onFilterChange={setFilter}
          onSortChange={setSort}
          onSelect={setSelectedId}
        />

        <section className="rounded-lg border border-line bg-panel p-4 shadow-soft">
          <div className="mb-4 flex items-center gap-2">
            <Pencil size={18} />
            <h2 className="text-lg font-semibold">Task detail</h2>
            {selectedTask && (
              <span className="ml-auto text-xs text-muted">
                {dateFormatter.format(new Date(selectedTask.createdAt))}
              </span>
            )}
          </div>
          {selectedTask ? (
            <TaskEditor
              key={selectedTask.id}
              task={selectedTask}
              disabled={isPending || agentPending}
              onSave={(patch) => run(() => updateSelected(patch), "Changes saved")}
              onSubtaskSave={(subtaskId, patch) => run(() => updateTask(subtaskId, patch), "Subtask saved")}
              onSubtaskDelete={(subtaskId) => run(() => deleteTask(subtaskId), "Subtask deleted")}
              onSubtaskCreate={(data) => run(() => createSubtask(selectedTask.id, data), "Subtask created")}
              onDelete={() => run(deleteSelected, "Task deleted")}
            />
          ) : (
            <p className="text-sm text-muted">Create a task to begin.</p>
          )}
        </section>

        <AgentPanel
          selectedTask={selectedTask}
          isPending={isPending}
          agentOutput={agentOutput}
          agentPending={agentPending}
          clarifying={clarifying}
          updateClarifyingAnswer={updateClarifyingAnswer}
          dismissClarifying={dismissClarifying}
          onCreateTask={(data, onSuccess) => run(async () => { await createTask(data); onSuccess(); }, "Task created")}
          onFocus={() => runAgentAction(prioritize, "Focus analysis ready")}
          onSplit={() => runAgentAction(() => decompose(false), "Subtask plan ready")}
          onStatusUpdate={(audience) => runAgentAction(() => statusUpdate(audience), "Status update ready")}
          onRiskScan={() => runAgentAction(riskScan, "Risk scan complete")}
          onDecomposeWithAnswers={() => runAgentAction(decomposeWithAnswers, clarifying?.createSubtasks ? "Subtasks created" : "Subtask plan ready")}
          onCreateFromPlan={(taskId, subtasks) => runAgentAction(() => createFromPlan(taskId, subtasks), "Subtasks created")}
        />
      </div>

      <div className="pointer-events-none fixed bottom-4 right-4 z-50 grid gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={clsx(
              "pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold shadow-lg",
              toast.type === "success" ? "bg-teal text-white" : "bg-berry text-white",
            )}
          >
            {toast.type === "success" ? <Check size={16} /> : <AlertTriangle size={16} />}
            <span>{toast.message}</span>
            <button className="ml-1 opacity-70 hover:opacity-100" onClick={() => dismissToast(toast.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
