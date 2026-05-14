import type { PublicPriority, PublicStatus } from "@/lib/schemas";

export type ApiErrorResponse = { error?: string; issues?: Array<{ path: string; message: string }> };

export function apiErrorMessage(data: ApiErrorResponse, fallback: string): string {
  if (data.issues && data.issues.length > 0) {
    return data.issues.map((i) => i.message).join("; ");
  }
  return data.error || fallback;
}

export const emptyForm: {
  title: string;
  description: string;
  status: PublicStatus;
  priority: PublicPriority;
  notes: string;
} = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  notes: "",
};
