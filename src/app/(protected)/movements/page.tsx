"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchWithAuth as fetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { formatDateTime } from "@/lib/utils";
import { Download, ArrowUpDown } from "lucide-react";
import { PageTitle } from "@/components/layout";

interface Movement {
  id: string;
  type: "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT";
  quantityBefore: number;
  quantityAfter: number;
  quantityChange: number;
  note: string | null;
  createdAt: string;
  part: { id: string; partNumber: string; partName: string };
  user: { name: string };
}

function typeBadgeClass(type: Movement["type"]) {
  if (type === "STOCK_IN") return "bdg-green";
  if (type === "STOCK_OUT") return "bdg-red";
  return "bdg-slate";
}
function typeLabel(type: Movement["type"]) {
  if (type === "STOCK_IN") return "รับเข้า";
  if (type === "STOCK_OUT") return "จ่ายออก";
  return "ปรับปรุง";
}
function changeText(type: Movement["type"], change: number) {
  if (type === "STOCK_IN") return `+${change}`;
  if (type === "STOCK_OUT") return `−${Math.abs(change)}`;
  return `${change >= 0 ? "+" : ""}${change}`;
}
function changeColor(type: Movement["type"]) {
  if (type === "STOCK_IN") return "text-emerald-600";
  if (type === "STOCK_OUT") return "text-red-600";
  return "text-blue-600";
}

export default function MovementsPage() {
  const { toast } = useToast();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const fetchMovements = async () => {
    setIsLoading(true);
    try {
      const url = typeFilter === "all" ? "/api/movements" : `/api/movements?type=${typeFilter}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setMovements(data);
      }
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  const handleExport = async () => {
    try {
      const response = await fetch("/api/movements?export=true");
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stock_movements_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({ title: "ส่งออกสำเร็จ" });
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        title="ประวัติการเคลื่อนไหว"
        description={<>จำนวน <span className="tnum">{movements.length}</span> รายการ</>}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="ทุกประเภท" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกประเภท</SelectItem>
            <SelectItem value="STOCK_IN">รับเข้า</SelectItem>
            <SelectItem value="STOCK_OUT">จ่ายออก</SelectItem>
            <SelectItem value="ADJUSTMENT">ปรับปรุง</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          ส่งออก
        </Button>
      </div>

      <div className="pcard overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto" />
          </div>
        ) : movements.length === 0 ? (
          <div className="p-8 text-center">
            <ArrowUpDown className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">ยังไม่มีการเคลื่อนไหว</p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="text-left">วัน/เวลา</th>
                  <th className="text-left">อะไหล่</th>
                  <th className="text-center">ประเภท</th>
                  <th className="text-center">ก่อน</th>
                  <th className="text-center">เปลี่ยน</th>
                  <th className="text-center">หลัง</th>
                  <th className="text-center">ผู้ใช้</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id} className="transition-colors hover:bg-slate-50">
                    <td className="text-slate-500 whitespace-nowrap">{formatDateTime(movement.createdAt)}</td>
                    <td>
                      <Link href={`/parts/${movement.part.id}`} className="group inline-block max-w-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
                        <p className="font-medium text-slate-900 group-hover:text-amber-700 group-hover:underline">{movement.part.partName}</p>
                        <p className="mono text-xs text-slate-500 group-hover:text-amber-700">{movement.part.partNumber}</p>
                      </Link>
                    </td>
                    <td className="text-center">
                      <span className={`bdg ${typeBadgeClass(movement.type)}`}>{typeLabel(movement.type)}</span>
                    </td>
                    <td className="text-center tnum whitespace-nowrap">{movement.quantityBefore}</td>
                    <td className={`text-center font-medium tnum whitespace-nowrap ${changeColor(movement.type)}`}>
                      {changeText(movement.type, movement.quantityChange)}
                    </td>
                    <td className="text-center font-medium tnum whitespace-nowrap">{movement.quantityAfter}</td>
                    <td className="text-center text-slate-500">{movement.user.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="h-20 md:hidden" />
    </div>
  );
}
