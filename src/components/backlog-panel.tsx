"use client";

import { CalendarDays, ListFilter } from "lucide-react";
import { useMemo } from "react";
import clsx from "clsx";
import type { PublicPriority, PublicStatus } from "@/lib/schemas";
import { priorityRank, statusOptions } from "@/lib/schemas";
import type { TaskDTO } from "@/lib/tasks";
import { dateFormatter } from "@/lib/formatters";

export type SortMode = "priority" | "date";

// Hoisted to module scope — these never change, no reason to recreate on each render
const STATUS_DOT: Record<PublicStatus, string> = {
  todo: "bg-muted",
  "in-progress": "bg-coral",
  done: "bg-teal",
};

const PRIORITY_CLASS: Record<PublicPriority, string> = {
  low: "bg-teal/10 text-teal",
  medium: "bg-coral/10 text-coral",
  high: "bg-berry/15 text-berry",
};

function StatusBadge({ status }: { status: PublicStatus }) {
  return (
    <span className="flex items-center gap-1.5 rounded-sm bg-panel-soft px-2 py-1 text-xs font-semibold text-muted">
      <span className={clsx("size-1.5 shrink-0 rounded-full", STATUS_DOT[status])} />
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: PublicPriority }) {
  return <span className={clsx("rounded-sm px-2 py-1 text-xs font-semibold", PRIORITY_CLASS[priority])}>{priority}</span>;
}

type BacklogPanelProps = {
  tasks: TaskDTO[];
  selectedTaskId: string;
  filter: PublicStatus | "all";
  sort: SortMode;
  onFilterChange: (value: PublicStatus | "all") => void;
  onSortChange: (value: SortMode) => void;
  onSelect: (id: string) => void;
};

export function BacklogPanel({
  tasks,
  selectedTaskId,
  filter,
  sort,
  onFilterChange,
  onSortChange,
  onSelect,
}: BacklogPanelProps) {
  const displayedTasks = useMemo(() => {
    const filtered = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);
    // Cache timestamps once — Date constructions inside sort comparators are O(N log N)
    const withTs = filtered.map((t) => ({ t, ts: new Date(t.createdAt).getTime() }));
    withTs.sort(
      sort === "priority"
        ? (a, b) => priorityRank[a.t.priority] - priorityRank[b.t.priority] || b.ts - a.ts
        : (a, b) => b.ts - a.ts,
    );
    return withTs.map(({ t }) => t);
  }, [tasks, filter, sort]);

  return (
    <section className="rounded-lg border border-line bg-panel p-4 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Backlog</h2>
        <div className="rounded-md bg-mint px-2 py-1 text-sm font-semibold text-ink shadow-inset">
          {displayedTasks.length}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-xs font-semibold uppercase text-muted">
          <span className="flex items-center gap-1">
            <ListFilter size={14} />
            Status
          </span>
          <select
            className="rounded-md border border-line bg-field px-2 py-2 text-sm text-ink outline-none transition focus:border-teal"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value as PublicStatus | "all")}
          >
            {statusOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase text-muted">
          <span className="flex items-center gap-1">
            <CalendarDays size={14} />
            Sort
          </span>
          <select
            className="rounded-md border border-line bg-field px-2 py-2 text-sm text-ink outline-none transition focus:border-teal"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortMode)}
          >
            <option value="priority">priority</option>
            <option value="date">date</option>
          </select>
        </label>
      </div>

      {displayedTasks.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          {filter === "all" ? "No tasks yet." : `No ${filter} tasks.`}
        </p>
      ) : (
        <div className="grid gap-2">
          {displayedTasks.map((task) => (
            <button
              key={task.id}
              className={clsx(
                "rounded-lg border p-3 text-left shadow-inset transition hover:border-teal hover:bg-elevated",
                selectedTaskId === task.id ? "border-teal bg-elevated" : "border-line bg-panel-soft",
              )}
              onClick={() => onSelect(task.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={clsx("font-semibold leading-snug", task.status === "done" && "text-muted line-through")}>
                  {task.title}
                </p>
                <PriorityBadge priority={task.priority} />
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                <StatusBadge status={task.status} />
                <span>{dateFormatter.format(new Date(task.createdAt))}</span>
                {task.subtasks.length > 0 ? (
                  <span>
                    {task.subtasks.filter((s) => s.status === "done").length}/{task.subtasks.length} done
                  </span>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
