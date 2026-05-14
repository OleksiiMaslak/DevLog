"use client";

import { AlertTriangle, Bot, ClipboardList, Loader2, MessageSquareText, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import type { PublicPriority, PublicStatus } from "@/lib/schemas";
import { statusOptions, priorityOptions } from "@/lib/schemas";
import type { TaskDTO } from "@/lib/tasks";
import { emptyForm } from "@/lib/api-utils";
import type { AgentOutput, Audience, ClarifyingState } from "@/hooks/use-agent-flow";
import { audienceOptions } from "@/hooks/use-agent-flow";

function AgentButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="flex items-center justify-center gap-2 rounded-md border border-line bg-field px-3 py-2 text-sm font-semibold transition hover:border-teal hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

type AgentPanelProps = {
  selectedTask: TaskDTO | null;
  isPending: boolean;
  agentOutput: AgentOutput | null;
  agentPending: boolean;
  clarifying: ClarifyingState | null;
  updateClarifyingAnswer: (idx: number, answer: string) => void;
  dismissClarifying: () => void;
  onCreateTask: (data: typeof emptyForm, onSuccess: () => void) => void;
  onFocus: () => void;
  onSplit: () => void;
  onStatusUpdate: (audience: Audience) => void;
  onRiskScan: () => void;
  onDecomposeWithAnswers: () => void;
  onCreateFromPlan: (
    taskId: string,
    subtasks: Array<{ title: string; description: string; priority: PublicPriority }>,
  ) => void;
};

export function AgentPanel({
  selectedTask,
  isPending,
  agentOutput,
  agentPending,
  clarifying,
  updateClarifyingAnswer,
  dismissClarifying,
  onCreateTask,
  onFocus,
  onSplit,
  onStatusUpdate,
  onRiskScan,
  onDecomposeWithAnswers,
  onCreateFromPlan,
}: AgentPanelProps) {
  const [form, setForm] = useState(emptyForm);
  const [audience, setAudience] = useState<Audience>("team");

  return (
    <aside className="grid gap-4">
      {/* New task form */}
      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft">
        <div className="mb-3 flex items-center gap-2">
          <Plus size={18} />
          <h2 className="font-semibold">New task</h2>
        </div>
        <div className="grid gap-2">
          <input
            aria-label="Task title"
            className="rounded-md border border-line bg-field px-3 py-2 text-ink outline-none transition placeholder:text-muted focus:border-teal"
            placeholder="Title"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          />
          <textarea
            aria-label="Task description"
            className="min-h-24 rounded-md border border-line bg-field px-3 py-2 text-ink outline-none transition placeholder:text-muted focus:border-teal"
            placeholder="Description"
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          />
          <textarea
            aria-label="Execution notes"
            className="min-h-20 rounded-md border border-line bg-field px-3 py-2 text-ink outline-none transition placeholder:text-muted focus:border-teal"
            placeholder="Notes for execution context"
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              className="rounded-md border border-line bg-field px-3 py-2 text-ink outline-none transition focus:border-teal"
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as PublicStatus }))}
            >
              {statusOptions.filter((s) => s !== "all").map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              className="rounded-md border border-line bg-field px-3 py-2 text-ink outline-none transition focus:border-teal"
              value={form.priority}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, priority: event.target.value as PublicPriority }))
              }
            >
              {priorityOptions.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <button
            className="flex items-center justify-center gap-2 rounded-md bg-teal px-3 py-2 font-semibold text-white shadow-soft transition hover:brightness-110 disabled:opacity-50"
            disabled={isPending || form.title.trim().length < 2 || form.description.trim().length < 4}
            onClick={() => onCreateTask(form, () => setForm(emptyForm))}
          >
            {isPending ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
            Create
          </button>
        </div>
      </section>

      {/* AI agents */}
      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft">
        <div className="mb-3 flex items-center gap-2">
          <Bot size={18} />
          <h2 className="font-semibold">AI agents</h2>
        </div>
        <label className="mb-3 grid gap-1 text-xs font-semibold uppercase text-muted">
          Audience
          <select
            className="rounded-md border border-line bg-field px-3 py-2 text-sm text-ink outline-none transition focus:border-teal"
            value={audience}
            onChange={(event) => setAudience(event.target.value as Audience)}
          >
            {audienceOptions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <AgentButton
            icon={<Sparkles size={16} />}
            label="Focus"
            disabled={agentPending}
            onClick={onFocus}
          />
          <AgentButton
            icon={<ClipboardList size={16} />}
            label="Split"
            disabled={agentPending || !selectedTask}
            onClick={onSplit}
          />
          <AgentButton
            icon={<MessageSquareText size={16} />}
            label="Update"
            disabled={agentPending || !selectedTask}
            onClick={() => onStatusUpdate(audience)}
          />
          <AgentButton
            icon={<AlertTriangle size={16} />}
            label="Risks"
            disabled={agentPending}
            onClick={onRiskScan}
          />
        </div>

        {agentPending ? (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-line bg-elevated p-4 text-sm text-muted">
            <Loader2 className="animate-spin" size={18} />
            <span>Agent is thinking…</span>
          </div>
        ) : clarifying ? (
          <div className="mt-4 rounded-lg border border-line bg-elevated p-3 shadow-inset">
            <h3 className="text-sm font-semibold">Clarification needed</h3>
            <p className="mb-3 mt-1 text-xs text-muted">
              Answer the questions so the agent can split the task accurately.
            </p>
            <div className="grid gap-3">
              {clarifying.questions.map((question, idx) => (
                <label key={idx} className="grid gap-1">
                  <span className="text-xs font-semibold text-muted">
                    {idx + 1}. {question}
                  </span>
                  <textarea
                    className="min-h-14 resize-none rounded-md border border-line bg-field px-2 py-1.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-teal"
                    placeholder="Your answer…"
                    value={clarifying.answers[idx]}
                    onChange={(e) => updateClarifyingAnswer(idx, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                className="flex-1 rounded-md bg-teal px-3 py-2 text-sm font-semibold text-white shadow-soft transition hover:brightness-110 disabled:opacity-50"
                disabled={agentPending || clarifying.answers.some((a) => a.trim().length < 1)}
                onClick={onDecomposeWithAnswers}
              >
                {clarifying.createSubtasks ? "Submit & create subtasks" : "Submit & generate plan"}
              </button>
              <button
                className="rounded-md border border-line px-3 py-2 text-sm font-semibold transition hover:border-teal"
                onClick={() => dismissClarifying()}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : agentOutput ? (
          <div className="mt-4 rounded-lg border border-line bg-elevated p-3 shadow-inset">
            <h3 className="font-semibold">{agentOutput.title}</h3>
            <p className="mt-2 text-sm text-muted">{agentOutput.body}</p>
            {agentOutput.items?.length ? (
              <ul className="mt-3 grid gap-1.5 text-sm">
                {agentOutput.items.map((item, i) => (
                  <li key={i} className="border-l-2 border-line py-1 pl-3 text-muted">
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
            {agentOutput.pendingPlan ? (
              <button
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-teal px-3 py-2 text-sm font-semibold text-white shadow-soft transition hover:brightness-110 disabled:opacity-50"
                disabled={agentPending}
                onClick={() => onCreateFromPlan(agentOutput.pendingPlan!.taskId, agentOutput.pendingPlan!.subtasks)}
              >
                <Plus size={14} />
                Create {agentOutput.pendingPlan.subtasks.length} subtask
                {agentOutput.pendingPlan.subtasks.length !== 1 ? "s" : ""}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </aside>
  );
}
