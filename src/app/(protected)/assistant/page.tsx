"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type ReactNode,
} from "react";
import {
  Bot,
  Check,
  ImagePlus,
  Loader2,
  MessageSquarePlus,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { fetchWithAuth as fetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: ImageAttachment[];
  pendingActionIds?: string[];
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
};

type ChatConversation = {
  id: string;
  title: string;
  updatedAt: string;
};

type ImageAttachment = {
  type: "image";
  imageBase64: string;
  mediaType?: string;
  name: string;
  previewUrl?: string;
};

type StreamEvent =
  | { type: "status"; message: string }
  | { type: "delta"; text: string }
  | { type: "done"; conversationId?: string; pendingActionIds: string[]; toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }> }
  | { type: "error"; message: string };

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "พร้อมช่วยเรื่องสต็อกอะไหล่ครับ ถามหาอะไหล่ สรุปจำนวน หรือเตรียมรายการรับเข้า/เบิกออกได้เลย",
};

const QUICK_PROMPTS = [
  "สรุปสต็อกอะไหล่ตอนนี้",
  "relay เหลือกี่ตัว",
  "รายการในอาคาร ท.003",
  "เบิก LC1D09 2 ตัว",
];

export default function AssistantPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState("");
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [currentModel, setCurrentModel] = useState("");
  const [modelBusy, setModelBusy] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending, thinkingStatus]);

  const loadHistory = useCallback(async (selectedId?: string) => {
    try {
      const query = selectedId
        ? `?conversationId=${encodeURIComponent(selectedId)}`
        : "";
      const response = await fetch(`/api/ai/chat/history${query}`);
      if (!response.ok) return;
      const data = await response.json();
      setConversations(
        Array.isArray(data.conversations) ? data.conversations : [],
      );
      setConversationId(data.conversationId || undefined);
      if (!Array.isArray(data.messages) || data.messages.length === 0) {
        setMessages([WELCOME]);
        return;
      }
      setMessages(
        data.messages.map(
          (item: {
            id: string;
            role: "user" | "assistant";
            content: string;
            metadata?: { pendingActionIds?: string[] } | null;
          }) => ({
            id: item.id,
            role: item.role,
            content:
              item.role === "assistant"
                ? cleanAssistantText(item.content)
                : item.content,
            pendingActionIds: item.metadata?.pendingActionIds || [],
          }),
        ),
      );
    } catch {
      // History is best-effort.
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadHistory();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadHistory]);

  const loadModelSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/ai-model");
      if (!response.ok) return;
      const data = await response.json();
      setCurrentModel(
        typeof data.currentModel === "string" ? data.currentModel : "",
      );
      setAvailableModels(
        Array.isArray(data.availableModels)
          ? data.availableModels.filter(
              (item: unknown): item is string => typeof item === "string",
            )
          : [],
      );
    } catch {
      // Model settings are admin-only and best-effort in the chat UI.
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadModelSettings();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadModelSettings]);

  async function startNewChat() {
    setConversationId(undefined);
    setMessages([WELCOME]);
    setMessage("");
    setAttachments([]);
    setThinkingStatus("");
  }

  async function handleDeleteConversation(id: string, event: React.MouseEvent) {
    event.stopPropagation();
    try {
      const response = await fetch(`/api/ai/chat/history?conversationId=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Delete failed");
      if (conversationId === id) {
        await startNewChat();
      }
      await loadHistory();
      toast({ title: "ลบประวัติแชทแล้ว" });
    } catch {
      toast({ title: "ลบไม่สำเร็จ", variant: "destructive" });
    }
  }

  async function handleModelChange(model: string) {
    if (!model || model === currentModel) return;
    const previous = currentModel;
    setCurrentModel(model);
    setModelBusy(true);
    try {
      const response = await fetch("/api/admin/ai-model", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "บันทึกโมเดลไม่สำเร็จ");
      toast({
        title: "เปลี่ยนโมเดลแล้ว",
        description: data.gatewayWarning || model,
      });
      if (Array.isArray(data.availableModels)) {
        setAvailableModels(
          data.availableModels.filter(
            (item: unknown): item is string => typeof item === "string",
          ),
        );
      }
    } catch (error) {
      setCurrentModel(previous);
      toast({
        title: "เปลี่ยนโมเดลไม่สำเร็จ",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setModelBusy(false);
    }
  }

  async function handleSend(text = message) {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed || "วิเคราะห์รูปภาพ",
      attachments: attachments.length > 0 ? attachments : undefined,
    };
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev.filter((item) => item.id !== "welcome"),
      userMessage,
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setMessage("");
    // Clear the attachment preview immediately — the images are already
    // captured in `attachments` (closure) for the request body above.
    setAttachments([]);
    setSending(true);
    setThinkingStatus("กำลังคิด");

    try {
      const response = await fetch("/api/ai/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId,
          attachments: attachments.map(({ name, ...attachment }) => {
            void name;
            return attachment;
          }),
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "AI request failed");
      }
      if (!response.body) throw new Error("AI stream is empty");

      await readEventStream(response.body, (event) => {
        if (event.type === "status") {
          setThinkingStatus(event.message || "กำลังคิด");
          return;
        }
        if (event.type === "delta") {
          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantId
                ? { ...item, content: item.content + event.text }
                : item,
            ),
          );
          return;
        }
        if (event.type === "done") {
          const nextConversationId = event.conversationId || conversationId;
          setConversationId(nextConversationId);
          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantId
                ? {
                    ...item,
                    pendingActionIds: event.pendingActionIds || [],
                    toolCalls: event.toolCalls || [],
                  }
                : item,
            ),
          );
          setThinkingStatus("");
          if (nextConversationId) void loadHistory(nextConversationId);
          return;
        }
        if (event.type === "error") throw new Error(event.message);
      });
      setAttachments([]);
    } catch (error) {
      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantId
            ? { ...item, content: "ขออภัย เกิดข้อผิดพลาดในการเรียกผู้ช่วย AI" }
            : item,
        ),
      );
      toast({
        title: "เรียก AI ไม่สำเร็จ",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSending(false);
      setThinkingStatus("");
    }
  }

  async function handleAction(id: string, action: "confirm" | "cancel") {
    setActionBusyId(id);
    try {
      const response = await fetch(`/api/ai/actions/${id}/${action}`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action failed");
      setMessages((prev) =>
        prev.map((item) =>
          item.pendingActionIds?.includes(id)
            ? { ...item, pendingActionIds: item.pendingActionIds.filter((pid) => pid !== id) }
            : item,
        ).concat({
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            data.message ||
            (action === "confirm" ? "ทำรายการสำเร็จ" : "ยกเลิกรายการแล้ว"),
        }),
      );
    } catch (error) {
      toast({
        title: action === "confirm" ? "ยืนยันไม่สำเร็จ" : "ยกเลิกไม่สำเร็จ",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleImageSelected(fileList: FileList | null) {
    const file = fileList?.[0];
    await attachImageFile(file);
  }

  async function attachImageFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "ไฟล์ไม่ถูกต้อง",
        description: "เลือกได้เฉพาะรูปภาพ",
        variant: "destructive",
      });
      return;
    }
    const base64 = await fileToBase64(file);
    setAttachments([
      {
        type: "image",
        imageBase64: base64,
        mediaType: file.type,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
      },
    ]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const imageFile = Array.from(event.clipboardData.files).find((file) =>
      file.type.startsWith("image/"),
    );
    if (!imageFile) return;
    event.preventDefault();
    await attachImageFile(imageFile);
  }

  const hasRealMessages = messages.some((item) => item.id !== "welcome");
  return (
    <div className="fixed top-14 bottom-14 left-0 right-0 z-0 flex overflow-hidden bg-slate-50 text-slate-950 md:top-0 md:bottom-0 md:left-64">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-full flex-col p-3">
          <div className="mb-4 flex items-center gap-2 px-2 py-1 text-base font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 text-amber-300"><Bot className="h-4 w-4" /></span>
            SpareGPT
          </div>
          <button
            onClick={() => void startNewChat()}
            className="mb-3 flex items-center gap-3 rounded-xl btn-dark px-3 py-3 text-sm font-medium"
          >
            <MessageSquarePlus className="h-4 w-4" />
            แชตใหม่
          </button>
          <div className="mb-3 flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            ค้นหาแชต
          </div>
          <div className="mt-3 text-xs font-medium text-slate-500">
            เมื่อเร็ว ๆ นี้
          </div>
          <div className="mt-2 flex-1 space-y-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="rounded-lg px-3 py-2 text-sm text-slate-500">
                ยังไม่มีประวัติ
              </div>
            ) : (
              conversations.map((item) => (
                <div key={item.id} className="group flex items-center gap-1">
                  <button
                    onClick={() => void loadHistory(item.id)}
                    className={`block flex-1 truncate rounded-lg px-3 py-2 text-left text-sm ${
                      item.id === conversationId
                        ? "bg-slate-100 text-slate-950"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {item.title}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => void handleDeleteConversation(item.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-opacity"
                    title="ลบแชทนี้"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-slate-200 pt-3 text-xs text-slate-500">
            <div className="mb-2">ระบบสต็อกอะไหล่</div>
            {availableModels.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] text-slate-400">AI model</div>
                <Select
                  value={currentModel}
                  onValueChange={(value) => void handleModelChange(value)}
                  disabled={modelBusy}
                >
                  <SelectTrigger className="h-9 w-full rounded-xl border-slate-200 bg-white text-xs">
                    <SelectValue placeholder="เลือกโมเดล" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Bot className="h-4 w-4" />
            AI Assistant
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
            <Sparkles className="h-3.5 w-3.5" />
            {currentModel || "AI model"}
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pb-40 pt-6 scrollbar-thin">
          {!hasRealMessages ? (
            <div className="flex min-h-[65vh] w-full flex-col items-center justify-center text-center">
              <h1 className="mb-8 text-2xl font-semibold text-slate-950 md:text-3xl">
                วันนี้ให้ช่วยเรื่องสต็อกอะไรดี?
              </h1>
              <div className="grid w-full gap-2 sm:grid-cols-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => void handleSend(prompt)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm hover:bg-slate-100"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-5">
              {messages
                .filter((item) => item.id !== "welcome")
                .map((item) => (
                  <ChatBubble
                    key={item.id}
                    message={item}
                    actionBusyId={actionBusyId}
                    onAction={handleAction}
                  />
                ))}
              {sending && thinkingStatus && (
                <ThinkingIndicator label={thinkingStatus} />
              )}
            </div>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent px-4 pb-5 pt-10">
          <div className="mx-auto max-w-2xl">
            {attachments.length > 0 && (
              <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <div className="flex min-w-0 items-center gap-3">
                  {attachments[0].previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={attachments[0].previewUrl}
                      alt=""
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {attachments[0].name}
                    </div>
                    <div className="text-xs text-amber-600">
                      รูปพร้อมส่งแล้ว
                    </div>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setAttachments([])}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex items-end gap-2 rounded-[28px] border border-slate-200 bg-white p-2 shadow-xl">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) =>
                  void handleImageSelected(event.target.files)
                }
              />
              <button
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
              >
                <ImagePlus className="h-5 w-5" />
              </button>
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onPaste={(event) => void handlePaste(event)}
                placeholder="ถามอะไรเกี่ยวกับสต็อกก็ได้"
                className="max-h-40 min-h-10 flex-1 resize-none border-0 bg-transparent px-0 py-2 text-base text-slate-950 shadow-none placeholder:text-slate-400 focus-visible:ring-0"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <button
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full btn-dark disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => void handleSend()}
                disabled={
                  sending || (!message.trim() && attachments.length === 0)
                }
              >
                {sending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>
            <div className="mt-2 text-center text-xs text-slate-500">
              AI อาจตอบผิดได้ โปรดตรวจสอบก่อนยืนยันรายการสต็อก
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ChatBubble({
  message,
  actionBusyId,
  onAction,
}: {
  message: ChatMessage;
  actionBusyId: string | null;
  onAction: (id: string, action: "confirm" | "cancel") => Promise<void>;
}) {
  const isUser = message.role === "user";
  const content = isUser
    ? message.content
    : cleanAssistantText(message.content);
  if (
    !isUser &&
    !content &&
    (!message.pendingActionIds || message.pendingActionIds.length === 0)
  )
    return null;
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div className={isUser ? "max-w-[78%]" : "w-full max-w-[96%]"}>
        <div
          className={
            isUser
              ? "rounded-[22px] btn-dark px-5 py-3 text-[15px] leading-7 text-white shadow-sm"
              : "rounded-2xl border border-slate-200 bg-white px-5 py-4 text-[15px] leading-7 text-slate-900 shadow-sm"
          }
        >
          {isUser ? (
            <div className="space-y-2">
              {message.attachments && message.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {message.attachments.map((att, i) => {
                    const src = att.previewUrl
                      || (att.imageBase64
                        ? `data:${att.mediaType || "image/jpeg"};base64,${att.imageBase64}`
                        : "");
                    if (!src) return null;
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={src}
                        alt={att.name}
                        className="max-h-40 rounded-lg border border-white/20"
                      />
                    );
                  })}
                </div>
              )}
              <div className="whitespace-pre-wrap">{content}</div>
            </div>
          ) : (
            <AssistantContent text={content} />
          )}
          {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
              {message.toolCalls.map((tc, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                >
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  {tc.name}
                </span>
              ))}
            </div>
          )}
          {!isUser &&
            message.pendingActionIds &&
            message.pendingActionIds.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {message.pendingActionIds.map((id) => (
                  <div key={id} className="flex gap-2">
                    <Button
                      size="sm"
                      variant="gold"
                      onClick={() => onAction(id, "confirm")}
                      disabled={Boolean(actionBusyId)}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      ยืนยัน
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAction(id, "cancel")}
                      disabled={Boolean(actionBusyId)}
                    >
                      <X className="mr-1 h-4 w-4" />
                      ยกเลิก
                    </Button>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

function ThinkingIndicator({ label }: { label: string }) {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{label}</span>
      </div>
    </div>
  );
}

function AssistantContent({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        const lines = block.split(/\n/).filter(Boolean);
        const isList = lines.every((line) =>
          /^\s*(?:[-*•]|\d+[.)])\s+/.test(line),
        );
        if (isList) {
          return (
            <ul key={index} className="space-y-1.5 pl-5">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex} className="list-disc">
                  {renderInlineMarkdown(
                    line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ""),
                  )}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            {renderInlineMarkdown(block)}
          </p>
        );
      })}
    </div>
  );
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code
          key={`${match.index}-code`}
          className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.9em] text-slate-900"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(
        <strong
          key={`${match.index}-strong`}
          className="font-semibold text-slate-950"
        >
          {token.slice(2, -2)}
        </strong>,
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function cleanAssistantText(text: string): string {
  return text
    .replace(/<tool_call\b[^>]*>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/<function=[^>]+>[\s\S]*?<\/function>/gi, "")
    .trim();
}

async function readEventStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEvent) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index: number;
    while ((index = buffer.indexOf("\n\n")) >= 0) {
      const rawEvent = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      const parsed = parseStreamEvent(rawEvent);
      if (parsed) onEvent(parsed);
    }
  }
}

function parseStreamEvent(rawEvent: string): StreamEvent | null {
  const lines = rawEvent.split(/\r?\n/);
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLine = lines.find((line) => line.startsWith("data:"));
  if (!eventLine || !dataLine) return null;
  const type = eventLine.slice(6).trim();
  const data = JSON.parse(dataLine.slice(5).trim()) as Record<string, unknown>;
  if (type === "status") return { type, message: String(data.message || "") };
  if (type === "delta") return { type, text: String(data.text || "") };
  if (type === "done") {
    return {
      type,
      conversationId:
        typeof data.conversationId === "string"
          ? data.conversationId
          : undefined,
      pendingActionIds: Array.isArray(data.pendingActionIds)
        ? data.pendingActionIds.filter(
            (item): item is string => typeof item === "string",
          )
        : [],
      toolCalls: Array.isArray(data.toolCalls)
        ? data.toolCalls
            .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && "name" in item)
            .map((item) => ({
              name: String(item.name || ""),
              arguments: (item.arguments && typeof item.arguments === "object" ? item.arguments : {}) as Record<string, unknown>,
            }))
        : undefined,
    };
  }
  if (type === "error")
    return { type, message: String(data.message || "Unknown error") };
  return null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () =>
      reject(reader.error || new Error("Cannot read file"));
    reader.readAsDataURL(file);
  });
}
