"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchWithAuth as fetch } from "@/lib/api";
import { useToast } from "@/components/ui/toaster";
import {
  ChevronDown,
  Eye,
  Info,
  KeyRound,
  Loader2,
  ShieldAlert,
  Sparkles,
  Wrench,
} from "lucide-react";

type Tab = "pw" | "ai";

type ModelCapabilities = {
  displayName: string;
  supportsVision: boolean;
  supportsTools: boolean;
  hasThinking: boolean;
};

type CapabilitiesMap = Record<string, ModelCapabilities>;

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isForced = searchParams.get("force") === "true";
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>(isForced ? "pw" : "pw");

  // ---- password ----
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [pwSubmitting, setPwSubmitting] = useState(false);

  // ---- ai model ----
  const [currentModel, setCurrentModel] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [aiLoading, setAiLoading] = useState(true);
  const [aiForbidden, setAiForbidden] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<CapabilitiesMap>({});
  const [currentCapabilities, setCurrentCapabilities] = useState<ModelCapabilities | null>(null);
  const [currentVisionModel, setCurrentVisionModel] = useState("");
  const [selectedVisionModel, setSelectedVisionModel] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/ai-model");
        if (!active) return;
        if (res.status === 401 || res.status === 403) {
          setAiForbidden(true);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        const models: string[] = Array.from(
          new Set([data.currentModel, ...(data.availableModels || [])].filter(Boolean)),
        );
        setCurrentModel(data.currentModel || "");
        setSelectedModel(data.currentModel || models[0] || "");
        setAvailableModels(models);
        setCapabilities(data.capabilities || {});
        setCurrentCapabilities(data.currentCapabilities || null);
        setCurrentVisionModel(data.currentVisionModel || "");
        setSelectedVisionModel(data.currentVisionModel || models[0] || "");
      } catch {
        /* ignore */
      } finally {
        if (active) setAiLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handlePwSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwErrors({});

    if (newPassword !== confirmPassword) {
      setPwErrors({ confirmPassword: "รหัสผ่านไม่ตรงกัน" });
      return;
    }
    if (newPassword.length < 6) {
      setPwErrors({ newPassword: "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร" });
      return;
    }

    setPwSubmitting(true);
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwErrors({ form: data.error || "เกิดข้อผิดพลาด" });
        return;
      }
      if (isForced) {
        router.replace("/dashboard");
        return;
      }
      toast({ title: "อัปเดตรหัสผ่านแล้ว" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPwErrors({ form: "เกิดข้อผิดพลาด" });
    } finally {
      setPwSubmitting(false);
    }
  }

  async function handleSaveModel() {
    const mainChanged = !!selectedModel && selectedModel !== currentModel;
    const visionChanged =
      !!selectedVisionModel && selectedVisionModel !== currentVisionModel;
    if (!mainChanged && !visionChanged) return;
    setAiSaving(true);
    try {
      const payload: { model?: string; visionModel?: string } = {};
      if (mainChanged) payload.model = selectedModel;
      if (visionChanged) payload.visionModel = selectedVisionModel;
      const res = await fetch("/api/admin/ai-model", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "บันทึกไม่สำเร็จ" });
        return;
      }
      if (mainChanged) setCurrentModel(selectedModel);
      if (visionChanged) setCurrentVisionModel(selectedVisionModel);
      if (Array.isArray(data.availableModels) && data.availableModels.length > 0) {
        setAvailableModels(data.availableModels);
      }
      setCurrentCapabilities(capabilities[selectedModel] || null);
      toast({ title: data.message || "บันทึกสำเร็จ" });
    } catch {
      toast({ title: "เกิดข้อผิดพลาด" });
    } finally {
      setAiSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/ai-model/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "ping",
          model: selectedModel || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestResult(`✕ ${data.error || "เชื่อมต่อไม่สำเร็จ"}`);
        return;
      }
      setTestResult(
        `✓ เชื่อมต่อสำเร็จ · ${data.model || selectedModel} · ${data.elapsedMs ?? "?"}ms`,
      );
    } catch {
      setTestResult("✕ เกิดข้อผิดพลาด");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <div className="page-title">
        <span className="bar-g" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">ตั้งค่า</h1>
          <p className="text-sm text-slate-500">จัดการบัญชีและระบบ</p>
        </div>
      </div>

      <div className="flex w-fit gap-1 rounded-xl bg-slate-200/60 p-1">
        <button
          type="button"
          className={`tab ${tab === "pw" ? "tab-active" : ""}`}
          onClick={() => setTab("pw")}
        >
          รหัสผ่าน
        </button>
        <button
          type="button"
          className={`tab ${tab === "ai" ? "tab-active" : ""}`}
          onClick={() => setTab("ai")}
        >
          โมเดล AI
        </button>
      </div>

      {tab === "pw" && (
        <form onSubmit={handlePwSubmit} className="pcard pcard-pad space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-slate-600" />
            <h3 className="text-base font-semibold text-slate-900">เปลี่ยนรหัสผ่าน</h3>
          </div>

          {isForced && (
            <p className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
              คุณต้องเปลี่ยนรหัสผ่านก่อนเข้าใช้งานระบบ
            </p>
          )}
          {pwErrors.form && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{pwErrors.form}</p>
          )}

          <div>
            <label className="lbl">รหัสผ่านปัจจุบัน</label>
            <input
              type="password"
              className="fld"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="lbl">รหัสผ่านใหม่</label>
            <input
              type="password"
              className="fld"
              placeholder="อย่างน้อย 6 ตัวอักษร"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            {pwErrors.newPassword && (
              <p className="mt-1 text-sm text-red-600">{pwErrors.newPassword}</p>
            )}
          </div>
          <div>
            <label className="lbl">ยืนยันรหัสผ่านใหม่</label>
            <input
              type="password"
              className="fld"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            {pwErrors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{pwErrors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={pwSubmitting}
            className="btn-gold inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-60"
          >
            {pwSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            อัปเดตรหัสผ่าน
          </button>
        </form>
      )}

      {tab === "ai" && (
        <div className="pcard pcard-pad space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <h3 className="text-base font-semibold text-slate-900">โมเดล AI</h3>
          </div>

          {aiForbidden ? (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              การเปลี่ยนโมเดล AI จำกัดเฉพาะผู้ดูแลระบบ
            </div>
          ) : aiLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              กำลังโหลด…
            </div>
          ) : (
            <>
              <div>
                <label className="lbl">เลือกโมเดลที่ใช้งาน</label>
                <div className="relative">
                  <select
                    className="fld appearance-none pr-9"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                  >
                    {availableModels.length === 0 && currentModel && (
                      <option value={currentModel}>{currentModel}</option>
                    )}
                    {availableModels.map((m) => {
                      const caps = capabilities[m];
                      const label = caps?.displayName && caps.displayName !== m
                        ? `${caps.displayName} (${m})`
                        : m;
                      const recommended = Boolean(caps?.supportsTools && caps?.supportsVision);
                      const notRecommended = m === "umans/umans-flash" || !caps?.supportsTools;
                      const suffix = caps && !caps.supportsTools ? " — ไม่รองรับ tools" : "";
                      return (
                        <option key={m} value={m}>
                          {recommended ? "⭐ " : ""}{label}{suffix}{notRecommended ? " [ไม่แนะนำ]" : ""}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="lbl">โมเดลวิเคราะห์รูป (Vision)</label>
                <div className="relative">
                  <select
                    className="fld appearance-none pr-9"
                    value={selectedVisionModel}
                    onChange={(e) => setSelectedVisionModel(e.target.value)}
                  >
                    {availableModels.length === 0 && currentVisionModel && (
                      <option value={currentVisionModel}>{currentVisionModel}</option>
                    )}
                    {availableModels.map((m) => {
                      const caps = capabilities[m];
                      const label = caps?.displayName && caps.displayName !== m
                        ? `${caps.displayName} (${m})`
                        : m;
                      const recommended = Boolean(caps?.supportsVision && caps?.supportsTools);
                      const suffix = caps && !caps.supportsVision ? " — ไม่รองรับ vision" : "";
                      return (
                        <option key={`v-${m}`} value={m}>
                          {recommended ? "⭐ " : ""}{label}{suffix}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  ใช้สำหรับเติมข้อมูลอะไหล่จากรูปในหน้าเพิ่มอะไหล่
                </p>
              </div>

              {(currentCapabilities || capabilities[selectedModel]) && (
                <div className="flex flex-wrap gap-2">
                  <CapabilityBadge
                    icon={<Wrench className="h-3.5 w-3.5" />}
                    label="Tool calling"
                    enabled={(currentCapabilities || capabilities[selectedModel])?.supportsTools}
                  />
                  <CapabilityBadge
                    icon={<Eye className="h-3.5 w-3.5" />}
                    label="รูปภาพ"
                    enabled={(currentCapabilities || capabilities[selectedModel])?.supportsVision}
                  />
                  <CapabilityBadge
                    icon={<Sparkles className="h-3.5 w-3.5" />}
                    label="Reasoning"
                    enabled={(currentCapabilities || capabilities[selectedModel])?.hasThinking}
                  />
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-sm text-slate-600">
                <p className="flex items-center gap-2">
                  <Info className="h-4 w-4 shrink-0 text-blue-500" />
                  โมเดลหลักใช้สำหรับ AI Assistant · โมเดล Vision ใช้วิเคราะห์รูปอะไหล่ในหน้าเพิ่มอะไหล่
                </p>
              </div>

              {testResult && <p className="text-sm text-slate-600">{testResult}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="btn-ghost inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm disabled:opacity-60"
                >
                  {testing && <Loader2 className="h-4 w-4 animate-spin" />}
                  ทดสอบการเชื่อมต่อ
                </button>
                <button
                  type="button"
                  onClick={handleSaveModel}
                  disabled={aiSaving || (selectedModel === currentModel && selectedVisionModel === currentVisionModel)}
                  className="btn-gold inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-60"
                >
                  {aiSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  บันทึก
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CapabilityBadge({
  icon,
  label,
  enabled,
}: {
  icon: React.ReactNode;
  label: string;
  enabled?: boolean;
}) {
  const on = Boolean(enabled);
  const base = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ";
  const color = on
    ? "bg-green-50 text-green-700 ring-green-200"
    : "bg-slate-100 text-slate-400 ring-slate-200";
  return (
    <span className={base + color}>
      {icon}
      {label}
      {on ? " ✓" : " ✕"}
    </span>
  );
}
