"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle, Download, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toaster";

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

  const importFile = async (file: File, useAi: boolean) => {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast({
        title: "ไฟล์ไม่ถูกต้อง",
        description: "กรุณาเลือกไฟล์ Excel (.xlsx หรือ .xls)",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(useAi ? "/api/import/ai" : "/api/import", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Import failed");
      }

      setResult(data);
      toast({
        title: useAi ? "AI import complete" : "Import complete",
        description: `เพิ่มใหม่ ${data.imported} รายการ, อัปเดต ${data.updated} รายการ`,
      });
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">นำเข้าข้อมูล Excel</h1>
          <p className="text-gray-500">นำเข้าอะไหล่จาก Excel หรือให้ AI วิเคราะห์ไฟล์ก่อนเติมข้อมูลอัตโนมัติ</p>
        </div>
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-2" />
          ดาวน์โหลด Template
        </Button>
      </div>

      <Card
        className={`border-2 border-dashed transition-colors ${dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <Upload className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">ลากไฟล์มาวางที่นี่</h3>
            <p className="text-gray-500 mb-4">หรือเลือกโหมดนำเข้า</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importFile(file, false);
                e.target.value = "";
              }}
            />
            <input
              ref={aiFileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importFile(file, true);
                e.target.value = "";
              }}
            />
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                {isUploading ? "กำลังประมวลผล..." : "นำเข้า Excel ปกติ"}
              </Button>
              <Button variant="secondary" onClick={() => aiFileInputRef.current?.click()} disabled={isUploading}>
                <Sparkles className="h-4 w-4 mr-2" />
                AI วิเคราะห์และนำเข้า
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">คำแนะนำ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <p>โหมดปกติต้องมีคอลัมน์ Part Number, Part Name/Description และ Quantity</p>
          <p>โหมด AI เหมาะกับไฟล์ที่หัวตารางไม่ตรงแบบ เช่น NBK1.xlsx ที่มี Part no., Description, Quantity</p>
          <p>ถ้าไฟล์ใหญ่เกินไป ระบบจะจำกัดการวิเคราะห์ด้วย AI ที่ 300 แถวแรกก่อน แล้วค่อยขยายในรอบถัดไป</p>
        </CardContent>
      </Card>

      {result && (
        <Card className={result.success ? "border-green-500" : "border-red-500"}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {result.success ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Import complete {result.aiUsed ? "(AI)" : ""}
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  Import completed with issues
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                <p className="text-sm text-gray-500">เพิ่มใหม่</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                <p className="text-sm text-gray-500">อัปเดต</p>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <p className="text-2xl font-bold text-amber-600">{result.imagesExtracted}</p>
                <p className="text-sm text-gray-500">รูปภาพ</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="bg-red-50 p-3 rounded-lg max-h-40 overflow-y-auto">
                {result.errors.map((error, i) => (
                  <p key={i} className="text-sm text-red-600">{error}</p>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <Link href="/parts" className="flex-1">
                <Button variant="outline" className="w-full">ดูรายการอะไหล่</Button>
              </Link>
              <Button onClick={() => setResult(null)} className="flex-1">นำเข้าไฟล์อื่น</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="h-20 md:hidden" />
    </div>
  );
}
