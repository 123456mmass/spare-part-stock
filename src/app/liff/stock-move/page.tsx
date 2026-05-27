"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { liffFetch } from "@/lib/liff-api";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface PartInfo {
  id: string;
  partNumber: string;
  partName: string;
  quantity: number;
  unit: string;
}

const TYPES = [
  { key: "STOCK_IN" as const, label: "รับเข้า", color: "bg-green-500 hover:bg-green-600" },
  { key: "STOCK_OUT" as const, label: "จ่ายออก", color: "bg-red-500 hover:bg-red-600" },
  { key: "ADJUSTMENT" as const, label: "ปรับปรุง", color: "bg-blue-500 hover:bg-blue-600" },
];

export default function LiffStockMovePage() {
  const searchParams = useSearchParams();
  const partId = searchParams.get("partId") ?? "";
  const router = useRouter();
  const { toast } = useToast();

  const [part, setPart] = useState<PartInfo | null>(null);
  const [loadingPart, setLoadingPart] = useState(true);
  const [partError, setPartError] = useState("");
  const [type, setType] = useState<"STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT">("STOCK_IN");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPart() {
      if (!partId) {
        if (!cancelled) {
          setPartError("ไม่พบรหัสอะไหล่");
          setLoadingPart(false);
        }
        return;
      }

      try {
        const res = await liffFetch(`/api/liff/parts/${encodeURIComponent(partId)}`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setPart(data);
        } else {
          setPartError("ไม่พบอะไหล่นี้ในระบบ");
        }
      } catch {
        if (!cancelled) setPartError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์");
      } finally {
        if (!cancelled) setLoadingPart(false);
      }
    }

    void loadPart();
    return () => {
      cancelled = true;
    };
  }, [partId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!part || !quantity) return;

    const qty = parseInt(quantity, 10);

    if (type !== "ADJUSTMENT" && qty < 1) {
      toast({ title: "จำนวนต้องมากกว่า 0", variant: "destructive" });
      return;
    }
    if (type === "ADJUSTMENT" && qty < 0) {
      toast({ title: "จำนวนต้องไม่ติดลบ", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await liffFetch("/api/liff/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partId: part.id, type, quantity: qty, note }),
      });

      const data = await res.json();

      if (res.ok) {
        const labels = { STOCK_IN: "รับเข้าสต็อก", STOCK_OUT: "จ่ายออกสต็อก", ADJUSTMENT: "ปรับปรุงสต็อก" };
        toast({
          title: "บันทึกสำเร็จ",
          description: `${labels[type]} — คงเหลือ ${data.partQuantity} ${part.unit}`,
        });
        router.push("/liff/scan");
      } else {
        toast({ title: data.error ?? "เกิดข้อผิดพลาด", variant: "destructive" });
      }
    } catch {
      toast({ title: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingPart) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (partError) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-destructive">{partError}</p>
        <Link href="/liff/scan">
          <Button variant="outline" size="sm">
            <ArrowLeft className="size-4 mr-2" />
            กลับไปสแกน
          </Button>
        </Link>
      </div>
    );
  }

  if (!part) return null;

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <Link href="/liff/scan">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-bold">{part.partName}</h1>
          <p className="text-xs text-muted-foreground">
            {part.partNumber} | คงเหลือ {part.quantity} {part.unit}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-sm mb-2 block">ประเภท</Label>
              <div className="grid grid-cols-3 gap-2">
                {TYPES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setType(t.key)}
                    className={cn(
                      "text-white text-sm font-medium py-2 rounded-md transition-colors",
                      t.color,
                      type === t.key ? "ring-2 ring-offset-1 ring-black" : "opacity-60",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qty" className="text-sm">
                {type === "ADJUSTMENT" ? "จำนวนคงเหลือใหม่" : "จำนวน"} ({part.unit})
              </Label>
              <Input
                id="qty"
                type="number"
                min={type === "ADJUSTMENT" ? 0 : 1}
                max={type === "ADJUSTMENT" ? 10000000 : undefined}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={type === "ADJUSTMENT" ? "เช่น 100" : "เช่น 5"}
                required
                inputMode="numeric"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note" className="text-sm">
                หมายเหตุ (ไม่จำเป็น)
              </Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="เช่น เบิกโดยนาย..."
                maxLength={250}
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="size-4 mr-2 animate-spin" />}
              บันทึก
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="h-20" />
    </div>
  );
}
