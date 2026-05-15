"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { PublicPriority, PublicStatus } from "@/lib/schemas";
import { statusOptions, priorityOptions } from "@/lib/schemas";
import type { TaskDTO } from "@/lib/tasks";

export function TaskEditor({
  task,
  disabled,
  onSave,
  onSubtaskSave,
  onSubtaskDelete,
  onSubtaskCreate,
  onDelete,
}: {
  task: TaskDTO;
  disabled: boolean;
  onSave: (patch: Partial<TaskDTO>) => void;
  onSubtaskSave: (subtaskId: string, patch: Partial<TaskDTO>) => void;
  onSubtaskDelete: (subtaskId: string) => void;
  onSubtaskCreate: (data: { title: string; description: string; status: PublicStatus }) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(task);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteSubtaskId, setConfirmDeleteSubtaskId] = useState<string | null>(null);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskDraft, setSubtaskDraft] = useState<{ title: string; description: string; status: PublicStatus }>({
    title: "",
    description: "",
    status: "todo",
  });
  const subtaskTitleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingSubtask) subtaskTitleRef.current?.focus();
  }, [addingSubtask]);

  useEffect(() => {
    setDraft((prev) => ({ ...prev, status: task.status, priority: task.priority }));
  }, [task.status, task.priority]);

  const isDirty =
    draft.title !== task.title ||
    draft.description !== task.description ||
    draft.notes !== task.notes;

  return (
    <div className="grid gap-4">
      {/* Metadata: Status + Priority + Delete */}
      <div className="flex flex-wrap items-center gap-3 border-b border-t border-line py-2.5">
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Status</span>
          <select
            className="rounded-md border border-line bg-field px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-teal"
            value={draft.status}
            onChange={(event) => {
              const status = event.target.value as PublicStatus;
              setDraft((prev) => ({ ...prev, status }));
              onSave({ status });
            }}
          >
            {statusOptions.filter((s) => s !== "all").map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Priority</span>
          <select
            className="rounded-md border border-line bg-field px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-teal"
            value={draft.priority}
            onChange={(event) => {
              const priority = event.target.value as PublicPriority;
              setDraft((prev) => ({ ...prev, priority }));
              onSave({ priority });
            }}
          >
            {priorityOptions.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        {confirmDelete ? (
          <div className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md border border-berry bg-elevated px-2.5 py-1.5 text-xs font-semibold">
            <Trash2 size={13} className="text-berry" />
            <span className="text-berry">Delete?</span>
            <button
              className="rounded px-1.5 py-0.5 text-muted ring-1 ring-line transition hover:text-ink hover:ring-teal"
              onClick={() => setConfirmDelete(false)}
            >
              No
            </button>
            <button
              className="rounded bg-berry px-1.5 py-0.5 text-white transition hover:brightness-110"
              onClick={onDelete}
            >
              Yes
            </button>
          </div>
        ) : (
          <button
            className="ml-auto flex size-7 shrink-0 items-center justify-center rounded border border-transparent text-muted transition hover:border-berry hover:text-berry"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete task"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {/* Title */}
      <input
        aria-label="Task title"
        className="w-full rounded-md border border-line bg-field px-3 py-2 text-xl font-semibold text-ink outline-none transition focus:border-teal"
        value={draft.title}
        onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
      />

      {/* Description + Notes */}
      <textarea
        aria-label="Task description"
        className="min-h-36 rounded-md border border-line bg-field px-3 py-2 text-ink outline-none transition focus:border-teal"
        value={draft.description}
        onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
      />
      <textarea
        aria-label="Execution notes"
        className="min-h-20 rounded-md border border-line bg-field px-3 py-2 text-ink outline-none transition placeholder:text-muted focus:border-teal"
        placeholder="Execution notes"
        value={draft.notes}
        onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
      />

      {/* Save — only when text fields are dirty */}
      {isDirty && (
        <div className="flex justify-end">
          <button
            className="flex items-center gap-2 rounded-md bg-teal px-3 py-2 text-sm font-semibold text-white shadow-soft transition hover:brightness-110 disabled:opacity-50"
            disabled={disabled}
            onClick={() => onSave({ title: draft.title, description: draft.description, notes: draft.notes })}
          >
            <Save size={16} />
            Save changes
          </button>
        </div>
      )}

      {/* Subtasks */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">
            Subtasks{task.subtasks.length > 0 && ` (${task.subtasks.length})`}
          </h3>
          {!addingSubtask && (
            <button
              className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold text-muted transition hover:border-teal hover:text-teal disabled:cursor-not-allowed disabled:opacity-50"
              disabled={disabled}
              onClick={() => setAddingSubtask(true)}
            >
              <Plus size={12} />
              Add subtask
            </button>
          )}
        </div>

        {task.subtasks.length > 0 && (
          <div className="grid gap-1.5">
            {task.subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className="group rounded-lg border border-line bg-elevated p-3 shadow-inset transition-colors hover:border-teal/40"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={clsx(
                      "mt-1.25 size-2 shrink-0 rounded-full",
                      subtask.status === "done"
                        ? "bg-teal"
                        : subtask.status === "in-progress"
                          ? "bg-coral"
                          : "bg-line",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={clsx(
                        "text-sm font-semibold leading-snug",
                        subtask.status === "done" && "text-muted line-through",
                      )}
                    >
                      {subtask.title}
                    </p>
                    {subtask.description && (
                      <p className="mt-0.5 text-xs leading-relaxed text-muted">{subtask.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <select
                      className="rounded border border-line bg-field px-1.5 py-0.5 text-xs font-semibold text-ink outline-none transition focus:border-teal"
                      value={subtask.status}
                      onChange={(event) =>
                        onSubtaskSave(subtask.id, { status: event.target.value as PublicStatus })
                      }
                    >
                      {statusOptions.filter((s) => s !== "all").map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    {confirmDeleteSubtaskId === subtask.id ? (
                      <div className="flex shrink-0 items-center gap-1 rounded border border-berry bg-elevated px-1.5 py-0.5 text-xs font-semibold">
                        <span className="text-berry">Delete?</span>
                        <button
                          className="rounded px-1 py-0.5 text-muted ring-1 ring-line transition hover:text-ink hover:ring-teal"
                          onClick={() => setConfirmDeleteSubtaskId(null)}
                        >
                          No
                        </button>
                        <button
                          className="rounded bg-berry px-1 py-0.5 text-white transition hover:brightness-110"
                          onClick={() => {
                            onSubtaskDelete(subtask.id);
                            setConfirmDeleteSubtaskId(null);
                          }}
                        >
                          Yes
                        </button>
                      </div>
                    ) : (
                      <button
                        className="flex size-7 shrink-0 items-center justify-center rounded border border-transparent text-muted transition hover:border-berry hover:text-berry"
                        onClick={() => setConfirmDeleteSubtaskId(subtask.id)}
                        aria-label="Delete subtask"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {addingSubtask && (
          <div className={clsx("grid gap-2 rounded-lg border border-teal/30 bg-elevated p-3", task.subtasks.length > 0 && "mt-2")}>
            <input
              ref={subtaskTitleRef}
              aria-label="Subtask title"
              className="rounded-md border border-line bg-field px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-teal"
              placeholder="Title"
              value={subtaskDraft.title}
              onChange={(e) => setSubtaskDraft((prev) => ({ ...prev, title: e.target.value }))}
            />
            <textarea
              aria-label="Subtask description"
              className="min-h-16 rounded-md border border-line bg-field px-2.5 py-1.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-teal"
              placeholder="Description"
              value={subtaskDraft.description}
              onChange={(e) => setSubtaskDraft((prev) => ({ ...prev, description: e.target.value }))}
            />
            <div className="flex items-center gap-2">
              <select
                className="rounded-md border border-line bg-field px-2 py-1 text-xs font-semibold text-ink outline-none transition focus:border-teal"
                value={subtaskDraft.status}
                onChange={(e) => setSubtaskDraft((prev) => ({ ...prev, status: e.target.value as PublicStatus }))}
              >
                {statusOptions.filter((s) => s !== "all").map((s) => <option key={s}>{s}</option>)}
              </select>
              <button
                className="flex items-center gap-1.5 rounded-md bg-teal px-3 py-1 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                disabled={disabled || subtaskDraft.title.trim().length < 2 || subtaskDraft.description.trim().length < 4}
                onClick={() => {
                  onSubtaskCreate({ title: subtaskDraft.title.trim(), description: subtaskDraft.description.trim(), status: subtaskDraft.status });
                  setSubtaskDraft({ title: "", description: "", status: "todo" });
                  setAddingSubtask(false);
                }}
              >
                <Plus size={13} />
                Add
              </button>
              <button
                className="rounded-md px-3 py-1 text-xs font-semibold text-muted ring-1 ring-line transition hover:text-ink hover:ring-teal"
                onClick={() => {
                  setSubtaskDraft({ title: "", description: "", status: "todo" });
                  setAddingSubtask(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
