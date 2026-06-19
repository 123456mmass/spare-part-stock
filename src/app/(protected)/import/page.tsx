"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { fetchWithAuth as fetch } from "@/lib/api";
import { AlertCircle, CheckCircle, Download, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { PageTitle } from "@/components/layout";

interface BlockInfo {
  name: string;
  partCount: number;
}

interface ImportResult {
  success: boolean;
  imported: number;
  updated: number;
  errors: string[];
  imagesExtracted: number;
  aiUsed?: boolean;
}

export default function ImportPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [blocks, setBlocks] = useState<BlockInfo[]>([]);
  const [selectedBlock, setSelectedBlock] = useState("");
  const [newBlock, setNewBlock] = useState("");

  useEffect(() => {
    fetch("/api/blocks").then(r => r.ok ? r.json().then(setBlocks) : null).catch(() => {});
  }, []);

  const plantValue = newBlock.trim() || selectedBlock || undefined;

  const importFile = async (file: File, useAi: boolean) => {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast({ title: "ไฟล์ไม่ถูกต้อง", description: "กรุณาเลือกไฟล์ Excel (.xlsx หรือ .xls)", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (plantValue) formData.append("plant", plantValue);

      const response = await fetch(useAi ? "/api/import/ai" : "/api/import", { method: "POST", body: formData });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Import failed");
      }

      setResult(data);
      if (newBlock.trim()) {
        setBlocks(prev => [...prev, { name: newBlock.trim(), partCount: data.imported }]);
        setNewBlock("");
      }
      toast({
        title: useAi ? "AI import complete" : "Import complete",
        description: `เพิ่มใหม่ ${data.imported} รายการ, อัปเดต ${data.updated} รายการ`,
      });
    } catch (error) {
      toast({ title: "Import failed", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await importFile(file, false);
  };

  const downloadTemplate = () => {
    const headers = ["Part Number", "Part Name", "Description", "Category", "Location", "Quantity", "Minimum Quantity", "Unit"];
    const sampleData = [
      ["SP-001", "Oil filter", "Oil filter for machine", "Consumable", "Shelf A-1", "10", "5", "pcs"],
      ["SP-002", "Relay", "Electrical relay module", "Electrical", "Shelf B-2", "20", "10", "pcs"],
    ];
    const csvContent = [headers, ...sampleData].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spare_parts_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageTitle
        title="นำเข้าข้อมูล Excel"
        description="นำเข้าอะไหล่จาก Excel หรือให้ AI วิเคราะห์ไฟล์ก่อนเติมข้อมูลอัตโนมัติ"
        action={
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            ดาวน์โหลด Template
          </Button>
        }
      />

      {/* Block/Plant selection */}
      <div className="pcard pcard-pad space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">เลือกบล็อก/โรงงาน (ไม่บังคับ)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="lbl">เลือกบล็อกที่มีอยู่</label>
            <select
              className="fld"
              value={selectedBlock}
              onChange={(e) => { setSelectedBlock(e.target.value); setNewBlock(""); }}
            >
              <option value="">-- ไม่ระบุบล็อก --</option>
              {blocks.map((b) => (
                <option key={b.name} value={b.name}>{b.name} ({b.partCount} รายการ)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="lbl">พิมพ์ชื่อบล็อกใหม่</label>
            <Input placeholder="เช่น โรงงาน A, Plant 1" value={newBlock} onChange={(e) => { setNewBlock(e.target.value); setSelectedBlock(""); }} />
          </div>
        </div>
        {plantValue && (
          <p className="text-xs text-amber-600">ทุกแถวในไฟล์จะถูกกำหนดบล็อกเป็น &quot;{plantValue}&quot;</p>
        )}
      </div>

      {/* Dropzone */}
      <div
        className={`pcard border-2 border-dashed pcard-pad text-center transition-colors ${dragActive ? "border-amber-400 bg-amber-50/50" : "border-slate-300"}`}
        style={{ borderStyle: "dashed" }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 mb-4">
            <Upload className="h-8 w-8 text-amber-600" />
          </div>
          <h3 className="text-lg font-semibold mb-1 text-slate-900">ลากไฟล์มาวางที่นี่</h3>
          <p className="text-slate-500 mb-4">หรือเลือกโหมดนำเข้า</p>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void importFile(file, false); e.target.value = ""; }} />
          <input ref={aiFileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void importFile(file, true); e.target.value = ""; }} />
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="dark" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
              {isUploading ? "กำลังประมวลผล..." : "นำเข้า Excel ปกติ"}
            </Button>
            <Button
              type="button"
              onClick={() => aiFileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium"
              style={{ background: "#eef2ff", color: "#4338ca" }}
            >
              <Sparkles className="h-4 w-4" />
              AI วิเคราะห์และนำเข้า
            </Button>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="pcard pcard-pad space-y-3 text-sm text-slate-600">
        <h3 className="text-base font-semibold text-slate-900">คำแนะนำ</h3>
        <p>โหมดปกติต้องมีคอลัมน์ Part Number, Part Name/Description, Location (ชื่ออาคารที่มีในระบบ) และ Quantity</p>
        <p>โหมด AI เหมาะกับไฟล์ที่หัวตารางไม่ตรงแบบ เช่น NBK1.xlsx ที่มี Part no., Description, Quantity</p>
        <p>ถ้าไฟล์ใหญ่เกินไป ระบบจะจำกัดการวิเคราะห์ด้วย AI ที่ 100 แถวแรกก่อน</p>
      </div>

      {result && (
        <div className={`pcard pcard-pad space-y-4 ${result.success ? "border-emerald-300" : "border-red-300"}`}>
          <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            {result.success ? (
              <><CheckCircle className="h-5 w-5 text-emerald-600" /> Import complete {result.aiUsed ? "(AI)" : ""}</>
            ) : (
              <><AlertCircle className="h-5 w-5 text-red-600" /> Import completed with issues</>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-emerald-50 rounded-lg">
              <p className="text-2xl font-bold text-emerald-600 tnum">{result.imported}</p>
              <p className="text-sm text-slate-500">เพิ่มใหม่</p>
            </div>
            <div className="text-center p-3 bg-indigo-50 rounded-lg">
              <p className="text-2xl font-bold text-indigo-600 tnum">{result.updated}</p>
              <p className="text-sm text-slate-500">อัปเดต</p>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <p className="text-2xl font-bold text-amber-600 tnum">{result.imagesExtracted}</p>
              <p className="text-sm text-slate-500">รูปภาพ</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-red-50 p-3 rounded-lg max-h-40 overflow-y-auto scrollbar-thin">
              {result.errors.map((error, i) => (
                <p key={i} className="text-sm text-red-600">{error}</p>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <Link href="/parts" className="flex-1">
              <Button variant="outline" className="w-full">ดูรายการอะไหล่</Button>
            </Link>
            <Button variant="gold" onClick={() => setResult(null)} className="flex-1">นำเข้าไฟล์อื่น</Button>
          </div>
        </div>
      )}

      <div className="h-20 md:hidden" />
    </div>
  );
}
