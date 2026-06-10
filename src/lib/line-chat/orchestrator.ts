import type { Role } from "@prisma/client";
import { runAiAssistant } from "@/lib/ai-assistant/orchestrator";

export type OrchestratorResult = {
  reply: string;
  conversationId?: string;
  pendingActionIds: string[];
};

export async function orchestrate(
  userId: string,
  lineGroupId: string | undefined,
  userMessage: string,
  isGroup: boolean,
  userRole: Role = "STAFF",
  lineUserId?: string
): Promise<OrchestratorResult> {
  return runAiAssistant({
    user: { id: userId, role: userRole },
    channel: "line",
    conversationScope: {
      lineUserId,
      lineGroupId,
      isGroup,
    },
    message: userMessage,
    responseStyle: "line",
  });
}
