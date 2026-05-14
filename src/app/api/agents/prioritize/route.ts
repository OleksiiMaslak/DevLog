import { prioritizeTasks } from "@/lib/agents";
import { handleApiError } from "@/lib/api";

export async function POST() {
  try {
    return Response.json(await prioritizeTasks());
  } catch (error) {
    return handleApiError(error);
  }
}
