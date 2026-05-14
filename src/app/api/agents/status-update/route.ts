import { generateStatusUpdate } from "@/lib/agents";
import { handleApiError } from "@/lib/api";
import { statusUpdateRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const input = statusUpdateRequestSchema.parse(await request.json());
    return Response.json(await generateStatusUpdate(input.taskId, input.audience));
  } catch (error) {
    return handleApiError(error);
  }
}
