"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth as fetch } from "@/lib/api";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

type ExportDialogProps = {
  variant?: "default" | "hero";
  className?: string;
};

/** Original export: GET /api/export?format=&plant= via new tab (session cookie). */
export function ExportDialog({ variant = "default", className }: ExportDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"standard" | "plant">("plant");
  const [plant, setPlant] = useState("");
  const [plants, setPlants] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/parts")
      .then((r) => (r.ok ? r.json() : []))
      .then((parts: { plant?: string | null }[]) => {
        const unique = [
          ...new Set(parts.map((p) => p.plant).filter(Boolean)),
        ] as string[];
        unique.sort((a, b) => {
          const na = Number(a);
          const nb = Number(b);
          if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
          return a.localeCompare(b, "th");
        });
        setPlants(unique);
      })
      .catch(() => setPlants([]));
  }, [open]);

  const handleExport = () => {
    const params = new URLSearchParams({ format });
    if (plant) params.set("plant", plant);
    window.open(`/api/export?${params.toString()}`, "_blank");
    setOpen(false);
    toast({ title: "กำลังดาวน์โหลด Excel", description: "ถ้าไม่ขึ้น ให้ตรวจสอบการบล็อก popup" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant === "hero" ? "ghost" : "outline"}
          size="sm"
          className={cn(
            variant === "hero"
              ? "shrink-0 border border-amber-300/40 bg-white/5 text-white shadow-sm hover:border-amber-300/70 hover:bg-white/10 hover:text-white"
              : undefined,
            className
          )}
        >
          <Download className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">ส่งออก Excel</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md border-slate-200/80 shadow-xl">
        <DialogHeader>
          <DialogTitle>ส่งออก Excel</DialogTitle>
          <DialogDescription>
            เลือกรูปแบบและ Block แล้วดาวน์โหลด (รูปแบบ Plant รองรับรูปในไฟล์)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>รูปแบบ</Label>
            <Select
              value={format}
              onValueChange={(v) => setFormat(v as "standard" | "plant")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard (ข้อมูลครบ)</SelectItem>
                <SelectItem value="plant">
                  Plant Format (No. Plant System Type …)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>เลือก Block</Label>
            <Select value={plant || "__all__"} onValueChange={(v) => setPlant(v === "__all__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="ทั้งหมด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">ทั้งหมด</SelectItem>
                {plants.map((p) => (
                  <SelectItem key={p} value={p}>
                    Block {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            ยกเลิก
          </Button>
          <Button onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            ดาวน์โหลด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
