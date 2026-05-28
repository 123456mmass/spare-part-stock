"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  PenLine,
  Building2,
  Layers,
  Package,
  Search,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ExportDialog } from "@/components/export-dialog";
import { cn } from "@/lib/utils";

export type DashboardViewData = {
  userName: string;
  totals: {
    totalParts: number;
    totalQuantity: number;
    totalCategories: number;
    lowStockCount: number;
  };
  buildings: {
    id: string;
    name: string;
    partCount: number;
    totalQuantity: number;
    categoryCount: number;
    blocks: {
      block: string;
      partCount: number;
      totalQuantity: number;
      categoryCount: number;
    }[];
  }[];
  blockSummaries: {
    block: string;
    partCount: number;
    totalQuantity: number;
    categoryCount: number;
  }[];
  recentMovements: {
    id: string;
    type: string;
    quantityChange: number;
    createdAt: string;
    part: { partNumber: string; partName: string };
    user: { name: string | null };
  }[];
};

function movementLabel(type: string) {
  if (type === "STOCK_IN") return "รับเข้า";
  if (type === "STOCK_OUT") return "จ่ายออก";
  return "ปรับปรุง";
}

function formatBlockLabel(block: string) {
  if (block === "ไม่ระบุ Block") return "ไม่ระบุ Block";
  return `Block ${block}`;
}

function blockPlantQuery(block: string) {
  return block === "ไม่ระบุ Block" ? "__none__" : encodeURIComponent(block);
}

function StatMini({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className={cn("text-center", className)}>
      <p className="text-[10px] uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-sm font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

export function DashboardView({ data }: { data: DashboardViewData }) {
  const [search, setSearch] = useState("");

  const filteredBuildings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.buildings;
    return data.buildings.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.blocks.some((blk) => blk.block.toLowerCase().includes(q))
    );
  }, [data.buildings, search]);

  const { totals } = data;

  const today = new Date().toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const statCards = [
    {
      label: "รายการทั้งหมด",
      value: totals.totalParts,
      icon: Package,
      alert: false,
    },
    {
      label: "จำนวนชิ้นรวม",
      value: totals.totalQuantity,
      icon: Boxes,
      alert: false,
    },
    {
      label: "หมวดหมู่",
      value: totals.totalCategories,
      icon: Layers,
      alert: false,
    },
    {
      label: "ใกล้หมด",
      value: totals.lowStockCount,
      icon: AlertTriangle,
      alert: totals.lowStockCount > 0,
      href: "/parts?stockStatus=low-stock",
    },
  ];

  return (
    <div className="space-y-8 pb-8">
      {/* Hero */}
      <section className="dashboard-hero relative overflow-hidden rounded-xl px-5 py-6 sm:px-8 sm:py-7">
        <div className="dashboard-hero-accent" aria-hidden />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                Inventory Overview
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[28px]">
                ภาพรวมคลังอะไหล่
              </h1>
              <p className="text-sm text-slate-300">
                สรุปสต็อกตามอาคารและ Block · ณ วันที่ {today}
              </p>
            </div>
            <ExportDialog variant="hero" />
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              placeholder="ค้นหาอาคาร, รหัส, หรือ Block..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 border-0 bg-white pl-10 text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-amber-200/60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              const inner = (
                <div
                  className={cn(
                    "dashboard-stat-card p-4",
                    stat.alert && "dashboard-stat-card--alert"
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-slate-300">
                      {stat.label}
                    </span>
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        stat.alert ? "text-amber-300" : "text-slate-400"
                      )}
                    />
                  </div>
                  <p
                    className={cn(
                      "text-2xl font-semibold tabular-nums sm:text-[28px]",
                      stat.alert ? "text-amber-200" : "text-white"
                    )}
                  >
                    {stat.value.toLocaleString()}
                  </p>
                </div>
              );
              return stat.href ? (
                <Link key={stat.label} href={stat.href} className="block">
                  {inner}
                </Link>
              ) : (
                <div key={stat.label}>{inner}</div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Buildings */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Building2 className="h-5 w-5 text-slate-700" />
            อาคาร
          </h2>
          <Link
            href="/buildings"
            className="text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            จัดการอาคาร →
          </Link>
        </div>

        {filteredBuildings.length === 0 ? (
          <Card className="border-dashed shadow-sm">
            <CardContent className="py-10 text-center text-muted-foreground">
              {search.trim()
                ? "ไม่พบอาคารที่ตรงกับการค้นหา"
                : "ยังไม่มีข้อมูลอาคาร — สร้างอาคารเพื่อจัดกลุ่มอะไหล่"}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredBuildings.map((building) => (
                <div
                  key={building.id}
                  className="dashboard-building-card flex h-full flex-col rounded-xl p-5"
                >
                  <Link
                    href={`/parts?buildingId=${building.id}`}
                    className="group block flex-1"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                          อาคารที่เก็บ
                        </p>
                        <h3 className="mt-0.5 truncate text-lg font-semibold text-slate-900">
                          {building.name}
                        </h3>
                      </div>
                      <div className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-center">
                        <p className="text-lg font-semibold tabular-nums text-slate-900">
                          {building.partCount.toLocaleString()}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">
                          รายการ
                        </p>
                      </div>
                    </div>

                    <div className="mb-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">
                          ชิ้นรวม
                        </p>
                        <p className="text-sm font-semibold tabular-nums text-slate-900">
                          {building.totalQuantity.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">
                          หมวดหมู่
                        </p>
                        <p className="text-sm font-semibold tabular-nums text-slate-900">
                          {building.categoryCount.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">
                          Block
                        </p>
                        <p className="text-sm font-semibold tabular-nums text-slate-900">
                          {building.blocks.length}
                        </p>
                      </div>
                    </div>
                  </Link>

                  {building.blocks.length > 0 && (
                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        แยกตาม Block
                      </p>
                      <div className="space-y-1.5">
                        {building.blocks.map((blk) => (
                            <Link
                              key={blk.block}
                              href={`/parts?buildingId=${building.id}&plant=${blockPlantQuery(blk.block)}`}
                              className="block rounded-md border border-slate-100 bg-slate-50/60 px-2.5 py-2 transition-colors hover:border-slate-300 hover:bg-slate-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <p className="mb-1.5 text-xs font-medium text-slate-800 leading-snug">
                                {formatBlockLabel(blk.block)}
                              </p>
                              <div className="grid grid-cols-3 gap-1 text-[11px]">
                                <StatMini
                                  label="รายการ"
                                  value={blk.partCount}
                                  className="text-slate-700"
                                />
                                <StatMini
                                  label="ชิ้น"
                                  value={blk.totalQuantity}
                                  className="text-slate-700"
                                />
                                <StatMini
                                  label="หมวดหมู่"
                                  value={blk.categoryCount}
                                  className="text-slate-700"
                                />
                              </div>
                            </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
            ))}
          </div>
        )}
      </section>

      {/* Blocks + Recent */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="premium-card overflow-hidden border-0">
          <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-4">
            <CardTitle className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-900">
              <span className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-slate-700" />
                สรุปตาม Block
              </span>
              <span className="text-xs font-normal tabular-nums text-slate-500">
                {data.blockSummaries.length} Block
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.blockSummaries.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                ยังไม่มีข้อมูล Block
              </p>
            ) : (
              <>
                <div className="divide-y divide-slate-100">
                  {data.blockSummaries.map((blk, i) => {
                    const avgQty =
                      blk.partCount > 0
                        ? Math.round(blk.totalQuantity / blk.partCount)
                        : 0;
                    return (
                      <Link
                        key={blk.block}
                        href={`/parts?plant=${blockPlantQuery(blk.block)}`}
                        className="block px-5 py-4 transition-colors hover:bg-slate-50"
                      >
                        <div className="mb-3 flex min-w-0 items-start gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-semibold tabular-nums text-slate-700">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">
                              {formatBlockLabel(blk.block)}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              เฉลี่ย {avgQty.toLocaleString()} ชิ้น/รายการ
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">
                              รายการ
                            </p>
                            <p className="font-semibold tabular-nums text-slate-900">
                              {blk.partCount.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">
                              ชิ้นรวม
                            </p>
                            <p className="font-semibold tabular-nums text-slate-900">
                              {blk.totalQuantity.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">
                              หมวดหมู่
                            </p>
                            <p className="font-semibold tabular-nums text-slate-900">
                              {blk.categoryCount.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs text-slate-600">
                  <span>
                    รวม {totals.totalParts.toLocaleString()} รายการ ·{" "}
                    {totals.totalQuantity.toLocaleString()} ชิ้น ·{" "}
                    {totals.totalCategories.toLocaleString()} หมวดหมู่ในระบบ
                  </span>
                  <Link
                    href="/parts"
                    className="font-medium text-slate-800 hover:text-slate-950"
                  >
                    ดูอะไหล่ทั้งหมด →
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="premium-card overflow-hidden border-0">
          <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <TrendingUp className="h-4 w-4 text-slate-700" />
              การเคลื่อนไหวล่าสุด
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentMovements.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                ยังไม่มีการเคลื่อนไหวสต็อก
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.recentMovements.map((movement) => {
                  const isIn = movement.type === "STOCK_IN";
                  const isOut = movement.type === "STOCK_OUT";
                  return (
                    <div
                      key={movement.id}
                      className="flex items-start gap-3 px-5 py-3.5"
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                          isIn
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : isOut
                              ? "border-red-200 bg-red-50 text-red-700"
                              : "border-slate-200 bg-slate-50 text-slate-700"
                        )}
                      >
                        {isIn ? (
                          <ArrowDownCircle className="h-4 w-4" />
                        ) : isOut ? (
                          <ArrowUpCircle className="h-4 w-4" />
                        ) : (
                          <PenLine className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {movement.part.partNumber}
                        </p>
                        <p className="truncate text-xs text-slate-600">
                          {movement.part.partName}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {movementLabel(movement.type)} · {movement.user.name ?? "ระบบ"} ·{" "}
                          {formatDistanceToNow(new Date(movement.createdAt), {
                            addSuffix: true,
                            locale: th,
                          })}
                        </p>
                      </div>
                      <Badge
                        variant={
                          isIn ? "default" : isOut ? "destructive" : "secondary"
                        }
                        className="shrink-0 tabular-nums"
                      >
                        {movement.quantityChange >= 0 ? "+" : ""}
                        {movement.quantityChange}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
