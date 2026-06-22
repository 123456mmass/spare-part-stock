"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchWithAuth as fetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { Package, Plus, Search, QrCode, Grid3X3, List, Loader2 } from "lucide-react";
import { getStockStatus } from "@/lib/utils";
import { PageTitle } from "@/components/layout";

interface Part {
  id: string;
  partNumber: string;
  partName: string;
  category: { id: string; name: string } | null;
  building: { id: string; name: string } | null;
  subcategory: string | null;
  plant: string | null;
  isSpecialToolPart: boolean;
  location: string | null;
  quantity: number;
  minimumQuantity: number;
  unit: string;
  imageUrl: string | null;
  qrCodeUrl: string | null;
}

interface PartsResponse {
  parts: Part[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PAGE_SIZE = 24;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const STATUS_STYLE: Record<string, { bdg: string; label: string; qty: string }> = {
  "in-stock": { bdg: "bdg-green", label: "มีอะไหล่", qty: "text-slate-900" },
  "low-stock": { bdg: "bdg-amber", label: "ใกล้หมด", qty: "text-amber-600" },
  "out-of-stock": { bdg: "bdg-red", label: "หมด", qty: "text-red-600" },
};

export default function PartsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [parts, setParts] = useState<Part[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState("all");
  const [plantFilter, setPlantFilter] = useState("all");
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "card">("card");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [buildings, setBuildings] = useState<{ id: string; name: string }[]>([]);
  const [plantOptions, setPlantOptions] = useState<string[]>([]);
  const [subcategoryOptions, setSubcategoryOptions] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const abortRef = useRef<AbortController | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const buildQueryString = useCallback((page: number) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
    if (subcategoryFilter !== "all") params.set("subcategory", subcategoryFilter);
    if (buildingFilter !== "all") params.set("buildingId", buildingFilter);
    if (stockFilter !== "all") params.set("stockStatus", stockFilter);
    if (plantFilter !== "all") params.set("plant", plantFilter);
    return params.toString();
  }, [debouncedSearch, categoryFilter, subcategoryFilter, buildingFilter, stockFilter, plantFilter]);

  const fetchParts = useCallback(async (page: number, append = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (append) setIsLoadingMore(true);
    else setIsLoading(true);

    try {
      const qs = buildQueryString(page);
      const response = await fetch(`/api/parts?${qs}`, { signal: controller.signal });
      if (response.ok) {
        const data: PartsResponse = await response.json();
        setParts(prev => append ? [...prev, ...data.parts] : data.parts);
        setTotal(data.total);
        setCurrentPage(data.page);
        setTotalPages(data.totalPages);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถดึงข้อมูลอะไหล่", variant: "destructive" });
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [buildQueryString, toast]);

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

  const fetchBuildings = async () => {
    try {
      const response = await fetch("/api/buildings");
      if (response.ok) {
        const data = await response.json();
        setBuildings(data);
      }
    } catch {
      // Silent fail
    }
  };

  const fetchPartFilters = async () => {
    try {
      const response = await fetch("/api/parts/filters");
      if (response.ok) {
        const data = await response.json();
        setPlantOptions(data.plants || []);
        setSubcategoryOptions(data.subcategories || []);
      }
    } catch {
      // Silent fail
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCategories();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBuildings();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPartFilters();
    const status = searchParams.get("stockStatus");
    if (status && ["in-stock", "low-stock", "out-of-stock"].includes(status)) {
      setStockFilter(status);
    }
    const plant = searchParams.get("plant");
    if (plant) setPlantFilter(plant);
    const buildingId = searchParams.get("buildingId");
    if (buildingId) setBuildingFilter(buildingId);
  }, [searchParams]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchParts(1);
  }, [fetchParts]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || isLoading || isLoadingMore || currentPage >= totalPages) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isLoadingMore && currentPage < totalPages) {
          void fetchParts(currentPage + 1, true);
        }
      },
      { rootMargin: "360px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [currentPage, fetchParts, isLoading, isLoadingMore, totalPages]);

  return (
    <div className="space-y-6">
      <PageTitle
        title="อะไหล่"
        description={<><span className="tnum">{total.toLocaleString()}</span> รายการในระบบ</>}
        action={
          <Link href="/parts/new">
            <Button variant="gold" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              เพิ่มอะไหล่
            </Button>
          </Link>
        }
      />

      <div className="pcard p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="ค้นหารหัสอะไหล่, ชื่อ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 pl-10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="หมวดหมู่" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
              {categories.map((cat) => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}
            </SelectContent>
          </Select>

          <Select value={subcategoryFilter} onValueChange={setSubcategoryFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="หมวดหมู่ย่อย" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกประเภท</SelectItem>
              {subcategoryOptions.map((sub) => (
                <SelectItem key={sub} value={sub}>{sub}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={plantFilter} onValueChange={setPlantFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Block" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุก Block</SelectItem>
              <SelectItem value="special">Special Tool Part</SelectItem>
              {plantOptions.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={buildingFilter} onValueChange={setBuildingFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="อาคาร" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกอาคาร</SelectItem>
              {buildings.map((b) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
            </SelectContent>
          </Select>

          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="สถานะสต็อก" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              <SelectItem value="in-stock">มีอะไหล่</SelectItem>
              <SelectItem value="low-stock">ใกล้หมด</SelectItem>
              <SelectItem value="out-of-stock">หมด</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex gap-1 rounded-lg border border-slate-200 bg-slate-50/60 p-1">
            <button
              type="button"
              className={`flex h-7 w-7 items-center justify-center rounded-md ${viewMode === "card" ? "btn-dark" : "text-slate-500"}`}
              onClick={() => setViewMode("card")}
              title="มุมมองการ์ด"
            ><Grid3X3 className="h-3.5 w-3.5" /></button>
            <button
              type="button"
              className={`flex h-7 w-7 items-center justify-center rounded-md ${viewMode === "table" ? "btn-dark" : "text-slate-500"}`}
              onClick={() => setViewMode("table")}
              title="มุมมองตาราง"
            ><List className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </div>

      {/* Parts List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="part animate-pulse">
              <div className="part-img h-40" />
              <div className="p-4 space-y-2"><div className="h-4 w-3/4 bg-slate-200 rounded" /><div className="h-4 w-1/2 bg-slate-200 rounded" /></div>
            </div>
          ))}
        </div>
      ) : parts.length === 0 ? (
        <div className="pcard pcard-pad py-10 text-center">
          <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500">ไม่พบอะไหล่ที่ค้นหา</p>
        </div>
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {parts.map((part) => {
            const status = getStockStatus(part.quantity, part.minimumQuantity);
            const s = STATUS_STYLE[status];
            return (
              <Link key={part.id} href={`/parts/${part.id}`} className="part flex flex-col">
                <div className="part-img relative h-40 overflow-hidden">
                  <div className="glow" style={{ background: status === "low-stock" ? "#fbbf24" : status === "out-of-stock" ? "#f87171" : "#818cf8" }} />
                  {part.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={part.imageUrl} alt={part.partName} loading="lazy" decoding="async" className="relative h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                      <Package className="h-12 w-12" strokeWidth={1.2} />
                    </div>
                  )}
                  <span className={`absolute top-3 right-3 bdg ${s.bdg}`}><span className={`h-1.5 w-1.5 rounded-full ${status === "in-stock" ? "bg-emerald-500" : status === "low-stock" ? "bg-amber-500" : "bg-red-500"}`} />{s.label}</span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="mb-2">
                    <p className="mono text-xs text-slate-400">{part.partNumber}</p>
                    <p className="font-semibold tracking-tight text-slate-900">{part.partName}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {part.category && <span className="bdg bdg-slate">{part.category.name}</span>}
                    {part.building && <span className="bdg bdg-indigo">{part.building.name}</span>}
                    {part.isSpecialToolPart ? (
                      <span className="bdg bdg-amber">Special Tool Part</span>
                    ) : (
                      part.plant && <span className="bdg bdg-indigo">Block {part.plant}</span>
                    )}
                    {part.qrCodeUrl && <QrCode className="h-4 w-4 text-slate-300" />}
                  </div>
                  <div className="mt-auto flex items-end justify-between border-t border-slate-100 pt-3">
                    <div>
                      <p className={`tnum text-2xl font-semibold ${s.qty}`}>{part.quantity.toLocaleString()}</p>
                      <p className="text-[11px] text-slate-400">{part.unit} · ขั้นต่ำ {part.minimumQuantity}</p>
                    </div>
                    <span className="text-xs font-medium text-slate-500">รายละเอียด →</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="pcard overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="text-left">ชื่อ</th>
                  <th className="text-left">รหัสอะไหล่</th>
                  <th className="text-left">หมวดหมู่</th>
                  <th className="text-left">อาคาร</th>
                  <th className="text-left">Block</th>
                  <th className="text-right">จำนวน</th>
                  <th className="text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((part) => {
                  const status = getStockStatus(part.quantity, part.minimumQuantity);
                  const s = STATUS_STYLE[status];
                  return (
                    <tr key={part.id} className="cursor-pointer" onClick={() => router.push(`/parts/${part.id}`)}>
                      <td className="font-medium">{part.partName}</td>
                      <td className="mono text-xs text-slate-500">{part.partNumber}</td>
                      <td>{part.category?.name || "-"}</td>
                      <td>{part.building?.name || "-"}</td>
                      <td>{part.isSpecialToolPart ? <span className="bdg bdg-amber">Special Tool Part</span> : (part.plant || "-")}</td>
                      <td className="text-right font-medium tnum">{part.quantity.toLocaleString()} {part.unit}</td>
                      <td className="text-center"><span className={`bdg ${s.bdg}`}>{s.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {currentPage < totalPages && (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          <Button variant="outline" onClick={() => fetchParts(currentPage + 1, true)} disabled={isLoadingMore}>
            {isLoadingMore ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />กำลังโหลด...</>
            ) : (
              `โหลดเพิ่มอัตโนมัติ (${parts.length}/${total})`
            )}
          </Button>
        </div>
      )}

      <div className="h-20 md:hidden" />
    </div>
  );
}
