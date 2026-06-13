import type { Role } from "@prisma/client";

export type AiAssistantChannel = "line" | "web" | "service";

export type AiAssistantUser = {
  id: string;
  role: Role;
  name?: string | null;
};

export type AiAssistantAttachment = {
  type: "image";
  imageBase64: string;
  mediaType?: string;
};

export type AiAssistantInput = {
  user: AiAssistantUser;
  channel: AiAssistantChannel;
  conversationId?: string;
  conversationScope?: {
    lineUserId?: string;
    lineGroupId?: string;
    isGroup?: boolean;
  };
  message: string;
  attachments?: AiAssistantAttachment[];
  responseStyle?: "line" | "web";
  /**
   * If true, the orchestrator will not save the user message into conversation
   * history because the caller already saved it (e.g., group rolling context).
   */
  skipSaveUserMessage?: boolean;
};

export type AiAssistantResult = {
  reply: string;
  conversationId?: string;
  pendingActionIds: string[];
};

export type ToolExecutionContext = {
  user: AiAssistantUser;
  channel: AiAssistantChannel;
  conversationId?: string;
};
