"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bot,
  Check,
  ImagePlus,
  Loader2,
  Menu,
  MessageSquarePlus,
  PanelLeftClose,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { fetchWithAuth as fetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pendingActionIds?: string[];
};

type ImageAttachment = {
  type: "image";
  imageBase64: string;
  mediaType?: string;
  name: string;
};

type StreamEvent =
  | { type: "status"; message: string }
  | { type: "delta"; text: string }
  | { type: "done"; conversationId?: string; pendingActionIds: string[] }
  | { type: "error"; message: string };

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "พร้อมช่วยเรื่องสต็อกอะไหล่ครับ ถามหาอะไหล่ สรุปจำนวน หรือเตรียมรายการรับเข้า/เบิกออกได้เลย",
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
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, thinkingStatus]);

  useEffect(() => {
    let active = true;
    async function loadHistory() {
      try {
        const response = await fetch("/api/ai/chat/history");
        if (!response.ok) return;
        const data = await response.json();
        if (!active || !Array.isArray(data.messages) || data.messages.length === 0) return;
        setConversationId(data.conversationId || undefined);
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
              content: item.content,
              pendingActionIds: item.metadata?.pendingActionIds || [],
            })
          )
        );
      } catch {
        // History is best-effort.
      }
    }
    void loadHistory();
    return () => {
      active = false;
    };
  }, []);

  async function startNewChat() {
    try {
      await fetch("/api/ai/chat/history", { method: "DELETE" });
    } catch {
      // Local reset still works if server cleanup fails.
    }
    setConversationId(undefined);
    setMessages([WELCOME]);
    setMessage("");
    setAttachments([]);
    setThinkingStatus("");
  }

  async function handleSend(text = message) {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed || "วิเคราะห์รูปภาพ",
    };
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [...prev.filter((item) => item.id !== "welcome"), userMessage, { id: assistantId, role: "assistant", content: "" }]);
    setMessage("");
    setSending(true);
    setThinkingStatus("Thinking");

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
          setThinkingStatus(event.message || "Thinking");
          return;
        }
        if (event.type === "delta") {
          setMessages((prev) =>
            prev.map((item) => (item.id === assistantId ? { ...item, content: item.content + event.text } : item))
          );
          return;
        }
        if (event.type === "done") {
          setConversationId(event.conversationId || conversationId);
          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantId ? { ...item, pendingActionIds: event.pendingActionIds || [] } : item
            )
          );
          setThinkingStatus("");
          return;
        }
        if (event.type === "error") throw new Error(event.message);
      });
      setAttachments([]);
    } catch (error) {
      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantId ? { ...item, content: "ขออภัย เกิดข้อผิดพลาดในการเรียกผู้ช่วย AI" } : item
        )
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
      const response = await fetch(`/api/ai/actions/${id}/${action}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action failed");
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.message || (action === "confirm" ? "ทำรายการสำเร็จ" : "ยกเลิกรายการแล้ว"),
        },
      ]);
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
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "ไฟล์ไม่ถูกต้อง", description: "เลือกได้เฉพาะรูปภาพ", variant: "destructive" });
      return;
    }
    const base64 = await fileToBase64(file);
    setAttachments([{ type: "image", imageBase64: base64, mediaType: file.type, name: file.name }]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const hasRealMessages = messages.some((item) => item.id !== "welcome");
  const recentTitles = messages
    .filter((item) => item.role === "user")
    .slice(-8)
    .reverse();

  return (
    <div className="-m-4 flex h-[calc(100vh-5rem)] overflow-hidden bg-[#0b0b0b] text-white md:-m-6 md:h-screen">
      <aside
        className={`${
          sidebarOpen ? "w-72" : "w-0"
        } hidden shrink-0 overflow-hidden border-r border-white/10 bg-black transition-all duration-200 md:block`}
      >
        <div className="flex h-full flex-col p-3">
          <div className="mb-4 flex items-center justify-between px-2 py-1">
            <div className="text-lg font-semibold">SpareGPT</div>
            <button className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white" onClick={() => setSidebarOpen(false)}>
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => void startNewChat()}
            className="mb-3 flex items-center gap-3 rounded-xl bg-white/10 px-3 py-3 text-sm font-medium text-white hover:bg-white/15"
          >
            <MessageSquarePlus className="h-4 w-4" />
            แชตใหม่
          </button>
          <div className="mb-3 flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-400">
            <Search className="h-4 w-4" />
            ค้นหาแชต
          </div>
          <div className="mt-3 text-xs font-medium text-zinc-500">เมื่อเร็ว ๆ นี้</div>
          <div className="mt-2 flex-1 space-y-1 overflow-y-auto">
            {recentTitles.length === 0 ? (
              <div className="rounded-lg px-3 py-2 text-sm text-zinc-500">ยังไม่มีประวัติ</div>
            ) : (
              recentTitles.map((item) => (
                <div key={item.id} className="truncate rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-white/10">
                  {item.content}
                </div>
              ))
            )}
          </div>
          <div className="border-t border-white/10 pt-3 text-xs text-zinc-500">ระบบสต็อกอะไหล่</div>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <button className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </button>
            )}
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <Bot className="h-4 w-4" />
              AI Assistant
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
            <Sparkles className="h-3.5 w-3.5" />
            Mistral Agent
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-40 pt-4">
          {!hasRealMessages ? (
            <div className="mx-auto flex min-h-[65vh] max-w-3xl flex-col items-center justify-center text-center">
              <h1 className="mb-8 text-2xl font-semibold text-white md:text-3xl">วันนี้ให้ช่วยเรื่องสต็อกอะไรดี?</h1>
              <div className="grid w-full gap-2 sm:grid-cols-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => void handleSend(prompt)}
                    className="rounded-2xl border border-white/10 bg-[#1f1f1f] px-4 py-3 text-left text-sm text-zinc-200 hover:bg-[#2a2a2a]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-7">
              {messages
                .filter((item) => item.id !== "welcome")
                .map((item) => (
                  <ChatBubble key={item.id} message={item} actionBusyId={actionBusyId} onAction={handleAction} />
                ))}
              {sending && thinkingStatus && <ThinkingIndicator label={thinkingStatus} />}
            </div>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b] to-transparent px-4 pb-5 pt-10">
          <div className="mx-auto max-w-3xl">
            {attachments.length > 0 && (
              <div className="mb-2 flex items-center justify-between rounded-xl border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-100">
                <span className="truncate">{attachments[0].name}</span>
                <Button size="icon" variant="ghost" onClick={() => setAttachments([])}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex items-end gap-2 rounded-[28px] bg-[#2f2f2f] p-2 shadow-2xl">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void handleImageSelected(event.target.files)}
              />
              <button
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
              >
                <ImagePlus className="h-5 w-5" />
              </button>
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="ถามอะไรเกี่ยวกับสต็อกก็ได้"
                className="max-h-40 min-h-10 flex-1 resize-none border-0 bg-transparent px-0 py-2 text-base text-white shadow-none placeholder:text-zinc-400 focus-visible:ring-0"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <button
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black disabled:cursor-not-allowed disabled:bg-zinc-600 disabled:text-zinc-400"
                onClick={() => void handleSend()}
                disabled={sending || (!message.trim() && attachments.length === 0)}
              >
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </div>
            <div className="mt-2 text-center text-xs text-zinc-500">AI อาจตอบผิดได้ โปรดตรวจสอบก่อนยืนยันรายการสต็อก</div>
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
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div className={isUser ? "max-w-[75%]" : "max-w-full"}>
        <div className={isUser ? "rounded-3xl bg-[#2f2f2f] px-5 py-3 text-[15px] leading-7 text-white" : "px-1 py-1 text-[15px] leading-7 text-zinc-100"}>
          {isUser ? <div className="whitespace-pre-wrap">{message.content}</div> : <AssistantContent text={message.content || " "} />}
          {!isUser && message.pendingActionIds && message.pendingActionIds.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {message.pendingActionIds.map((id) => (
                <div key={id} className="flex gap-2">
                  <Button size="sm" onClick={() => onAction(id, "confirm")} disabled={Boolean(actionBusyId)}>
                    <Check className="mr-1 h-4 w-4" />
                    ยืนยัน
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onAction(id, "cancel")} disabled={Boolean(actionBusyId)}>
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
      <div className="flex items-center gap-2 rounded-full bg-[#1f1f1f] px-4 py-2 text-sm text-zinc-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{label}</span>
        <span className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.2s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.1s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" />
        </span>
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
        const isList = lines.every((line) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(line));
        if (isList) {
          return (
            <ul key={index} className="space-y-1.5 pl-5">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex} className="list-disc">
                  {renderInlineMarkdown(line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ""))}
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
        <code key={`${match.index}-code`} className="rounded bg-white/10 px-1.5 py-0.5 text-[0.9em] text-zinc-100">
          {token.slice(1, -1)}
        </code>
      );
    } else {
      nodes.push(
        <strong key={`${match.index}-strong`} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

async function readEventStream(body: ReadableStream<Uint8Array>, onEvent: (event: StreamEvent) => void) {
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
      conversationId: typeof data.conversationId === "string" ? data.conversationId : undefined,
      pendingActionIds: Array.isArray(data.pendingActionIds)
        ? data.pendingActionIds.filter((item): item is string => typeof item === "string")
        : [],
    };
  }
  if (type === "error") return { type, message: String(data.message || "Unknown error") };
  return null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error || new Error("Cannot read file"));
    reader.readAsDataURL(file);
  });
}
