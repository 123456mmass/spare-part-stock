"use client";

import { useState, useEffect } from "react";
import { fetchWithAuth as fetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { formatDateTime, cn } from "@/lib/utils";
import { Download, ArrowUpDown } from "lucide-react";

interface Movement {
  id: string;
  type: "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT";
  quantityBefore: number;
  quantityAfter: number;
  quantityChange: number;
  note: string | null;
  createdAt: string;
  part: { partNumber: string; partName: string };
  user: { name: string };
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ประวัติการเคลื่อนไหว</h1>
          <p className="text-gray-500">จำนวน {movements.length} รายการ</p>
        </div>
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
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
      </div>

      {/* Movements List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            </div>
          ) : movements.length === 0 ? (
            <div className="p-8 text-center">
              <ArrowUpDown className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">ยังไม่มีการเคลื่อนไหว</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">วัน/เวลา</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">อะไหล่</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">ประเภท</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">ก่อน</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">เปลี่ยน</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">หลัง</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">ผู้ใช้</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {movements.map((movement) => (
                    <tr key={movement.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{formatDateTime(movement.createdAt)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm">{movement.part.partName}</p>
                        <p className="text-xs text-gray-500">{movement.part.partNumber}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            movement.type === "STOCK_IN"
                              ? "success"
                              : movement.type === "STOCK_OUT"
                              ? "danger"
                              : "secondary"
                          }
                        >
                          {movement.type === "STOCK_IN"
                            ? "รับเข้า"
                            : movement.type === "STOCK_OUT"
                            ? "จ่ายออก"
                            : "ปรับปรุง"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-sm">{movement.quantityBefore}</td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right text-sm font-medium",
                          movement.type === "STOCK_IN"
                            ? "text-green-600"
                            : movement.type === "STOCK_OUT"
                            ? "text-red-600"
                            : "text-blue-600"
                        )}
                      >
                        {movement.type === "STOCK_IN"
                          ? "+"
                          : movement.type === "STOCK_OUT"
                          ? ""
                          : ""}
                        {movement.quantityChange}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium">
                        {movement.quantityAfter}
                      </td>
                      <td className="px-4 py-3 text-sm">{movement.user.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile bottom padding */}
      <div className="h-20 md:hidden" />
    </div>
  );
}
