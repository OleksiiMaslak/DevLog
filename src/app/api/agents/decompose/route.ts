import { decomposeTask } from "@/lib/agents";
import { handleApiError } from "@/lib/api";
import { decomposeRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const input = decomposeRequestSchema.parse(await request.json());
    return Response.json(await decomposeTask(input.taskId, input.createSubtasks, input.answers));
  } catch (error) {
    return handleApiError(error);
  }
}
