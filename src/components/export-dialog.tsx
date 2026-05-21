"use client";

import { useState, useEffect } from "react";
import { fetchWithAuth as fetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function ExportDialog() {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"standard" | "plant">("plant");
  const [plant, setPlant] = useState("");
  const [plants, setPlants] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      fetch("/api/parts")
        .then((r) => r.json())
        .then((parts: { plant?: string }[]) => {
          const unique = [...new Set(parts.map((p) => p.plant).filter(Boolean))] as string[];
          unique.sort((a, b) => Number(a) - Number(b));
          setPlants(unique);
        })
        .catch(() => {});
    }
  }, [open]);

  const handleExport = () => {
    const params = new URLSearchParams({ format });
    if (plant) params.set("plant", plant);
    window.open(`/api/export?${params.toString()}`, "_blank");
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" className="w-full h-20 flex-col gap-2" onClick={() => setOpen(true)}>
        <Download className="h-6 w-6" />
        <span className="text-xs">ส่งออก Excel</span>
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">ส่งออก Excel</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รูปแบบ</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as "standard" | "plant")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="standard">Standard (ข้อมูลครบ)</option>
                  <option value="plant">Plant Format (No. Plant System Type ...)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เลือก Block</label>
                <select
                  value={plant}
                  onChange={(e) => setPlant(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">ทั้งหมด</option>
                  {plants.map((p) => (
                    <option key={p} value={p}>Block {p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                ยกเลิก
              </Button>
              <Button className="flex-1" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                ดาวน์โหลด
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
