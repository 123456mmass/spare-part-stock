"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchWithAuth as fetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { Bot, Play } from "lucide-react";

interface AiModelData {
  currentModel: string;
  availableModels: string[];
}

export default function AiSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<AiModelData | null>(null);
  const [selectedModel, setSelectedModel] = useState("");

  // Playground state
  const [testPrompt, setTestPrompt] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [testing, setTesting] = useState(false);
  const [testElapsedMs, setTestElapsedMs] = useState<number | null>(null);
  const [testModel, setTestModel] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai-model");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setSelectedModel(json.currentModel);
      } else {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถดึงข้อมูล AI settings",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching AI settings:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถเชื่อมต่อกับ server",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleTest = async () => {
    if (!testPrompt.trim()) {
      toast({
        title: "กรุณากรอก prompt",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    setTestResponse("");
    setTestElapsedMs(null);

    try {
      const res = await fetch("/api/admin/ai-model/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: testPrompt,
          model: testModel || selectedModel,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response:", res.status, text.slice(0, 200));
        toast({
          title: "เกิดข้อผิดพลาด",
          description: `Server returned ${res.status}: ${res.statusText || "ไม่ใช่ JSON"}`,
          variant: "destructive",
        });
        return;
      }

      const json = await res.json();

      if (res.ok && json.success) {
        setTestResponse(json.response);
        setTestElapsedMs(json.elapsedMs);
        setTestModel(json.model);
        toast({
          title: "ทดสอบสำเร็จ",
          description: `ใช้ ${json.provider} (${json.elapsedMs}ms)`,
        });
      } else {
        toast({
          title: "ทดสอบล้มเหลว",
          description: json.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error testing AI:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error instanceof Error ? error.message : "ไม่สามารถเชื่อมต่อกับ server",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!selectedModel) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/ai-model", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel }),
      });

      const json = await res.json();

      if (res.ok) {
        toast({
          title: "บันทึกสำเร็จ",
          description: json.message,
        });
        // Update current model display
        setData((prev) => (prev ? { ...prev, currentModel: selectedModel } : null));
      } else {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: json.error || "ไม่สามารถบันทึกได้",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving AI model:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถเชื่อมต่อกับ server",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 bg-gray-200 rounded animate-pulse" />
          <div>
            <div className="h-7 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-64 bg-gray-100 rounded mt-1 animate-pulse" />
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 bg-gray-100 rounded animate-pulse" />
              <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-gray-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ตั้งค่า AI</h1>
            <p className="text-gray-500">กำหนด model AI สำหรับระบบ</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            ไม่สามารถโหลดข้อมูลได้
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasChanges = selectedModel !== data.currentModel;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="h-6 w-6 text-gray-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ตั้งค่า AI</h1>
          <p className="text-gray-500">กำหนด model AI สำหรับระบบ</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Model Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Current Model
            </label>
            <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg inline-block">
              <span className="text-sm font-medium text-blue-900">
                {data.currentModel}
              </span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Select Model
            </label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="เลือก model" />
              </SelectTrigger>
              <SelectContent>
                {data.availableModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="mt-4"
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>

          {hasChanges && (
            <p className="text-sm text-amber-600 mt-2">
              ⚠️ การเปลี่ยนแปลงจะมีผลทันที ไม่ต้อง restart server
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Play className="h-5 w-5" />
            Playground
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Model (optional - ใช้ current model ถ้าไม่เลือก)
            </label>
            <Select value={testModel} onValueChange={setTestModel}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder={selectedModel} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">ใช้ current ({selectedModel})</SelectItem>
                {data.availableModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Prompt
            </label>
            <textarea
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              placeholder="เช่น อธิบายอะไหล่คืออะไร..."
              className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <Button
            onClick={handleTest}
            disabled={testing || !testPrompt.trim()}
            className="w-full md:w-auto"
          >
            {testing ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                กำลังทดสอบ...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                ทดสอบ
              </>
            )}
          </Button>

          {testResponse && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">Response</h4>
                <div className="text-xs text-gray-500">
                  {testModel && `Model: ${testModel}`} • {testElapsedMs}ms • ~{Math.ceil(testResponse.length / 4)} tokens
                </div>
              </div>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                {testResponse}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ข้อมูล Model</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">จำนวน models ที่มี:</span>{" "}
              {data.availableModels.length}
            </p>
            <p>
              <span className="font-medium">Tiers:</span> Strong (reasoning),
              Worker (general), Fast (quick reply)
            </p>
            <p className="text-gray-500 mt-4">
              Gateway จะ auto-route ไปยัง provider ที่มี model นั้น
              โดย fallback ไปยัง tier อื่นถ้าไม่พบ
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
