"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { liffFetch } from "@/lib/liff-api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Loader2, Package, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PartResult {
  id: string;
  partNumber: string;
  partName: string;
  quantity: number;
  minimumQuantity: number;
  unit: string;
  plant: string | null;
  location: string | null;
  category: { name: string } | null;
  building: { name: string } | null;
}

const BLOCK_OPTIONS = ["BLOCK 1", "BLOCK 2", "SPECIAL PART"] as const;

function stockStatus(
  qty: number,
  min: number,
): { label: string; color: string; bg: string } {
  if (qty <= 0) return { label: "หมด", color: "text-red-600", bg: "bg-red-50" };
  if (qty <= min)
    return { label: "ต่ำ", color: "text-orange-600", bg: "bg-orange-50" };
  return { label: "คงเหลือ", color: "text-green-600", bg: "bg-green-50" };
}

export default function LiffSearchPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [plant, setPlant] = useState<string>("__all__");
  const [results, setResults] = useState<PartResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ search: q, limit: "20" });
      if (plant && plant !== "__all__") params.set("plant", plant);

      const res = await liffFetch(`/api/mobile/parts?${params}`);
      if (!res.ok) throw new Error("Search failed");

      const data = (await res.json()) as {
        parts: PartResult[];
        total: number;
      };
      setResults(data.parts);
      setTotal(data.total);
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถค้นหาได้", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [query, plant, toast]);

  // Debounce: auto-search after 500ms of inactivity
  useEffect(() => {
    if (!query.trim()) return;
    const timer = setTimeout(doSearch, 500);
    return () => clearTimeout(timer);
  }, [query, plant, doSearch]);

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/liff">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="size-5" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold">ค้นหาอะไหล่</h1>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="พิมพ์ชื่อหรือรหัสอะไหล่..."
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          className="flex-1"
        />
        <Button onClick={doSearch} disabled={loading || !query.trim()}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Select value={plant} onValueChange={setPlant}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="ทุก Block" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">ทุก Block</SelectItem>
            {BLOCK_OPTIONS.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {loading && results.length === 0 && (
        <div className="text-center py-8">
          <Loader2 className="size-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">กำลังค้นหา...</p>
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <Package className="size-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              ไม่พบอะไหล่ &quot;{query}&quot;
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ลองใช้คำค้นอื่น หรือตรวจสอบรหัสอีกครั้ง
            </p>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            พบ {total} รายการ{total > 20 ? " (แสดง 20 รายการแรก)" : ""}
          </p>
          {results.map((part) => {
            const status = stockStatus(part.quantity, part.minimumQuantity);
            const location = [part.building?.name, part.plant]
              .filter(Boolean)
              .join(" / ");

            return (
              <Card
                key={part.id}
                role="button"
                className="cursor-pointer hover:bg-accent active:scale-[0.99] transition-all"
                onClick={() => router.push(`/liff/stock-move?partId=${part.id}`)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">
                        {part.partNumber}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {part.partName}
                      </p>
                      {location && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          📍 {location}
                        </p>
                      )}
                    </div>
                    <div
                      className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${status.bg} ${status.color}`}
                    >
                      {part.quantity} {part.unit}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="h-20" />
    </div>
  );
}
