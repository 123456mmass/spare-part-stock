"use client";

import { useRef, useState } from "react";
import { Bot, Check, ImagePlus, Send, X } from "lucide-react";
import { fetchWithAuth as fetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function AssistantPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "ถามเรื่องสต็อก ค้นหาอะไหล่ หรือขอเตรียมรายการรับเข้า/เบิกออกได้เลย",
    },
  ]);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  async function handleSend() {
    const trimmed = message.trim();
    if (!trimmed && attachments.length === 0) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed || "วิเคราะห์รูปภาพ",
    };
    setMessages((prev) => [...prev, userMessage]);
    setMessage("");
    setSending(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          attachments: attachments.map(({ name, ...attachment }) => {
            void name;
            return attachment;
          }),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI request failed");

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply || "ไม่มีคำตอบ",
          pendingActionIds: data.pendingActionIds || [],
        },
      ]);
      setAttachments([]);
    } catch (error) {
      toast({
        title: "เรียก AI ไม่สำเร็จ",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSending(false);
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
    setAttachments([
      {
        type: "image",
        imageBase64: base64,
        mediaType: file.type,
        name: file.name,
      },
    ]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <Bot className="h-6 w-6 text-gray-700" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
          <p className="text-sm text-gray-500">ค้นหา สรุป และเตรียมรายการสต็อกแบบต้องยืนยันก่อนบันทึก</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-gray-50">
          <CardTitle className="text-base">ผู้ช่วยสต็อกอะไหล่</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[58vh] min-h-[420px] overflow-y-auto p-4">
            <div className="space-y-4">
              {messages.map((item) => (
                <div key={item.id} className={item.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      item.role === "user"
                        ? "max-w-[82%] rounded-lg bg-blue-600 px-4 py-3 text-sm text-white"
                        : "max-w-[82%] rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800"
                    }
                  >
                    <div className="whitespace-pre-wrap">{item.content}</div>
                    {item.pendingActionIds && item.pendingActionIds.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.pendingActionIds.map((id) => (
                          <div key={id} className="flex gap-2">
                            <Button size="sm" onClick={() => handleAction(id, "confirm")} disabled={Boolean(actionBusyId)}>
                              <Check className="mr-1 h-4 w-4" />
                              ยืนยัน
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAction(id, "cancel")}
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
              ))}
            </div>
          </div>

          <div className="border-t bg-white p-4">
            {attachments.length > 0 && (
              <div className="mb-3 flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                <span className="truncate">{attachments[0].name}</span>
                <Button size="icon" variant="ghost" onClick={() => setAttachments([])}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void handleImageSelected(event.target.files)}
              />
              <Button size="icon" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={sending}>
                <ImagePlus className="h-4 w-4" />
              </Button>
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="เช่น relay เหลือกี่ตัว, เบิก LC1D09 2 ตัว, สรุปสต็อกอาคาร ท.003"
                className="min-h-11 flex-1 resize-none"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <Button size="icon" onClick={() => void handleSend()} disabled={sending || (!message.trim() && attachments.length === 0)}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
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
