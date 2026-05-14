import { useEffect, useState } from "react";
import type { z } from "zod";
import type { PublicPriority } from "@/lib/schemas";
import type { TaskDTO } from "@/lib/tasks";
import type { DecompositionResult, PrioritizationResult, StatusUpdateResult, RiskScanResult } from "@/lib/agents";
import { apiErrorMessage, type ApiErrorResponse } from "@/lib/api-utils";

export type Audience = "team" | "lead" | "standup";
export const audienceOptions = ["team", "lead", "standup"] as const satisfies readonly Audience[];

export type AgentOutput = {
  title: string;
  body: string;
  items?: string[];
  pendingPlan?: {
    taskId: string;
    subtasks: Array<{ title: string; description: string; priority: PublicPriority }>;
  };
};

export type ClarifyingState = {
  taskId: string;
  createSubtasks: boolean;
  questions: string[];
  answers: string[];
};

// Derived from server Zod schemas — type-only import, erased at compile time, never bundled client-side
type DecomposeResponse = z.infer<typeof DecompositionResult>;
type PrioritizeResponse = z.infer<typeof PrioritizationResult>;
type StatusUpdateResponse = z.infer<typeof StatusUpdateResult>;
type RiskScanResponse = z.infer<typeof RiskScanResult>;

export function useAgentFlow(selectedTask: TaskDTO | null, refresh: () => Promise<void>) {
  const [agentOutput, setAgentOutput] = useState<AgentOutput | null>(null);
  const [agentPending, setAgentPending] = useState(false);
  const [clarifying, setClarifying] = useState<ClarifyingState | null>(null);

  function runWithPending(action: () => Promise<void>): Promise<void> {
    setAgentPending(true);
    return action().finally(() => setAgentPending(false));
  }

  const selectedTaskId = selectedTask?.id ?? null;
  useEffect(() => {
    setClarifying(null);
    setAgentOutput(null);
  }, [selectedTaskId]);

  function updateClarifyingAnswer(idx: number, answer: string) {
    setClarifying((prev) =>
      prev ? { ...prev, answers: prev.answers.map((a, i) => (i === idx ? answer : a)) } : null,
    );
  }

  function dismissClarifying() {
    setClarifying(null);
  }

  async function runAgentCall<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`/api/agents/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(data.error ?? "Agent request failed");
    }
    return response.json() as Promise<T>;
  }

  async function handleDecomposeResult(
    result: DecomposeResponse,
    taskId: string,
    createSubtasks: boolean,
  ) {
    if (result.needsClarification && result.clarifyingQuestions.length > 0) {
      setClarifying({
        taskId,
        createSubtasks,
        questions: result.clarifyingQuestions,
        answers: result.clarifyingQuestions.map(() => ""),
      });
      return;
    }
    const pendingSubtasks = result.subtasks ?? [];
    setClarifying(null);
    setAgentOutput({
      title: createSubtasks ? `Created ${result.createdSubtaskIds.length} subtasks` : "Task decomposition",
      body: createSubtasks
        ? `${result.createdSubtaskIds.length} subtasks added to the task editor.`
        : "Generated a structured subtask plan.",
      items: pendingSubtasks.map((s) => `${s.title}: ${s.description}`),
      pendingPlan:
        !createSubtasks && pendingSubtasks.length > 0 ? { taskId, subtasks: pendingSubtasks } : undefined,
    });
    if (createSubtasks) await refresh();
  }

  async function prioritize() {
    const result = await runAgentCall<PrioritizeResponse>("prioritize");
    setAgentOutput({
      title: "Today focus",
      body: result.recommendation,
      items: result.steps.map((step) => `${step.title}: ${step.detail}`),
    });
  }

  async function decompose(createSubtasks: boolean) {
    if (!selectedTask) return;
    const taskId = selectedTask.id;
    const result = await runAgentCall<DecomposeResponse>("decompose", { taskId, createSubtasks });
    await handleDecomposeResult(result, taskId, createSubtasks);
  }

  async function decomposeWithAnswers() {
    if (!clarifying) return;
    const { taskId, createSubtasks, answers } = clarifying;
    const result = await runAgentCall<DecomposeResponse>("decompose", { taskId, createSubtasks, answers });
    await handleDecomposeResult(result, taskId, createSubtasks);
  }

  async function createFromPlan(
    taskId: string,
    subtasks: Array<{ title: string; description: string; priority: PublicPriority }>,
  ) {
    const response = await fetch("/api/tasks/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId: taskId, subtasks }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as ApiErrorResponse;
      throw new Error(apiErrorMessage(data, "Could not create subtasks"));
    }
    setAgentOutput(null);
    await refresh();
  }

  async function statusUpdate(audience: Audience) {
    if (!selectedTask) return;
    const result = await runAgentCall<StatusUpdateResponse>("status-update", {
      taskId: selectedTask.id,
      audience,
    });
    setAgentOutput({
      title: `Status update (${result.tone})`,
      body: result.message,
      items: result.steps.map((step) => `${step.title}: ${step.detail}`),
    });
  }

  async function riskScan() {
    const result = await runAgentCall<RiskScanResponse>("risk-scan");
    setAgentOutput({
      title: "Risk scan",
      body: result.summary,
      items: result.risks.map(
        (risk) => `[${risk.severity}] ${risk.title}: ${risk.reason} Next: ${risk.nextAction}`,
      ),
    });
  }

  return {
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
  };
}
