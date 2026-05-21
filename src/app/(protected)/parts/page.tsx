"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchWithAuth as fetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { Package, Plus, Search, QrCode, Grid3X3, List } from "lucide-react";
import { getStockStatus, getStockStatusLabel } from "@/lib/utils";

interface Part {
  id: string;
  partNumber: string;
  partName: string;
  category: { id: string; name: string } | null;
  subcategory: string | null;
  location: string | null;
  quantity: number;
  minimumQuantity: number;
  unit: string;
  imageUrl: string | null;
  qrCodeUrl: string | null;
}

export default function PartsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [parts, setParts] = useState<Part[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "card">("card");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  const fetchParts = async () => {
    try {
      const response = await fetch("/api/parts");
      if (response.ok) {
        const data = await response.json();
        setParts(data);
      }
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถดึงข้อมูลอะไหล่", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories");
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch {
      // Silent fail
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchParts();
    fetchCategories();
    const status = searchParams.get("stockStatus");
    if (status && ["in-stock", "low-stock", "out-of-stock"].includes(status)) {
      setStockFilter(status);
    }
  }, [searchParams]);

  const filteredParts = parts.filter((part) => {
    const matchesSearch =
      search === "" ||
      part.partNumber.toLowerCase().includes(search.toLowerCase()) ||
      part.partName.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      categoryFilter === "all" || part.category?.id === categoryFilter;

    const matchesSubcategory =
      subcategoryFilter === "all" || part.subcategory === subcategoryFilter;

    let matchesStock = true;
    if (stockFilter === "in-stock") {
      matchesStock = part.quantity > part.minimumQuantity && part.quantity > 0;
    } else if (stockFilter === "low-stock") {
      matchesStock = part.quantity <= part.minimumQuantity && part.quantity > 0;
    } else if (stockFilter === "out-of-stock") {
      matchesStock = part.quantity === 0;
    }

    return matchesSearch && matchesCategory && matchesSubcategory && matchesStock;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">อะไหล่</h1>
          <p className="text-gray-500">จำนวน {filteredParts.length} รายการ</p>
        </div>
        <div className="flex gap-2">
          <Link href="/parts/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              เพิ่มอะไหล่
            </Button>
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="ค้นหารหัสอะไหล่, ชื่อ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="หมวดหมู่" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={subcategoryFilter} onValueChange={setSubcategoryFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="หมวดหมู่ย่อย" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกประเภท</SelectItem>
                  {[...new Set(parts.map(p => p.subcategory).filter(Boolean))].sort().map((sub) => (
                    <SelectItem key={sub!} value={sub!}>{sub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="สถานะสต็อก" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  <SelectItem value="in-stock">มีสินค้า</SelectItem>
                  <SelectItem value="low-stock">ใกล้หมด</SelectItem>
                  <SelectItem value="out-of-stock">หมด</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex gap-1 ml-auto">
                <Button
                  variant={viewMode === "card" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("card")}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "table" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("table")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parts List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-32 bg-gray-200 rounded-lg mb-4" />
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredParts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">ไม่พบอะไหล่ที่ค้นหา</p>
          </CardContent>
        </Card>
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredParts.map((part) => {
            const status = getStockStatus(part.quantity, part.minimumQuantity);
            return (
              <Link key={part.id} href={`/parts/${part.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardContent className="p-4">
                    {part.imageUrl ? (
                      <div className="h-40 bg-gray-100 rounded-lg mb-4 overflow-hidden">
                        <img
                          src={part.imageUrl}
                          alt={part.partName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-40 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
                        <Package className="h-10 w-10 text-gray-400" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900">{part.partNumber}</p>
                          <p className="text-sm text-gray-500">{part.partName}</p>
                        </div>
                        {part.qrCodeUrl && (
                          <QrCode className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {part.category && (
                          <Badge variant="secondary">{part.category.name}</Badge>
                        )}
                        {part.location && (
                          <Badge variant="outline">{part.location}</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div>
                          <p className="text-2xl font-bold">{part.quantity}</p>
                          <p className="text-xs text-gray-500">{part.unit}</p>
                        </div>
                        <Badge
                          variant={
                            status === "in-stock"
                              ? "success"
                              : status === "low-stock"
                              ? "warning"
                              : "danger"
                          }
                        >
                          {getStockStatusLabel(status)}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">รหัสอะไหล่</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">ชื่อ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">หมวดหมู่</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">ที่เก็บ</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">จำนวน</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredParts.map((part) => {
                    const status = getStockStatus(part.quantity, part.minimumQuantity);
                    return (
                      <tr
                        key={part.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/parts/${part.id}`)}
                      >
                        <td className="px-4 py-3 font-medium">{part.partNumber}</td>
                        <td className="px-4 py-3">{part.partName}</td>
                        <td className="px-4 py-3">{part.category?.name || "-"}</td>
                        <td className="px-4 py-3">{part.location || "-"}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {part.quantity} {part.unit}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant={
                              status === "in-stock"
                                ? "success"
                                : status === "low-stock"
                                ? "warning"
                                : "danger"
                            }
                          >
                            {getStockStatusLabel(status)}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottom padding for mobile */}
      <div className="h-20 md:hidden" />
    </div>
  );
}
