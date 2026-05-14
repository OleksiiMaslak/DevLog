import { scanRisks } from "@/lib/agents";
import { handleApiError } from "@/lib/api";

export async function POST() {
  try {
    return Response.json(await scanRisks());
  } catch (error) {
    return handleApiError(error);
  }
}
