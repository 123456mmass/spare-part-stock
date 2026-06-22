"use client";

import { useMemo } from "react";
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
  Share2,
  TrendingUp,
} from "lucide-react";
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
    part: { id: string; partNumber: string; partName: string };
    user: { name: string | null };
  }[];
};

function movementLabel(type: string) {
  if (type === "STOCK_IN") return "รับเข้า";
  if (type === "STOCK_OUT") return "จ่ายออก";
  return "ปรับปรุง";
}

function formatBlockLabel(block: string) {
  if (block === "Special Tool Part") return "Special Tool Part";
  if (block === "ไม่ระบุ Block") return "ไม่ระบุ Block";
  return `Block ${block}`;
}

function blockPlantQuery(block: string) {
  if (block === "Special Tool Part") return "special";
  return block === "ไม่ระบุ Block" ? "__none__" : encodeURIComponent(block);
}

const GLOW_COLORS = ["#818cf8", "#34d399", "#fbbf24", "#a78bfa", "#60a5fa", "#f472b6"];

export function DashboardView({ data }: { data: DashboardViewData }) {
  const { totals } = data;
  const sharedCount = useMemo(
    () =>
      data.blockSummaries.find((b) => b.block === "Special Tool Part")?.partCount ?? 0,
    [data.blockSummaries],
  );
  const today = new Date().toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const maxBlockParts = useMemo(
    () => Math.max(...data.blockSummaries.map((b) => b.partCount), 1),
    [data.blockSummaries]
  );

  const statCards = [
    { label: "รายการทั้งหมด", value: totals.totalParts, icon: Package, alert: false, href: "/parts", chip: "bg-indigo-400/10 text-indigo-300", sub: <span>ทั่วทั้งระบบ</span> },
    { label: "จำนวนชิ้นรวม", value: totals.totalQuantity, icon: Boxes, alert: false, href: "/parts", chip: "bg-emerald-400/10 text-emerald-300", spark: true },
    { label: "หมวดหมู่", value: totals.totalCategories, icon: Layers, alert: false, href: "/categories", chip: "bg-violet-400/10 text-violet-300", sub: <span>กลุ่มอะไหล่ในระบบ</span> },
    { label: "ใกล้หมด", value: totals.lowStockCount, icon: AlertTriangle, alert: totals.lowStockCount > 0, href: "/parts?stockStatus=low-stock", chip: "bg-amber-400/20 text-amber-300", sub: <span>แตะเพื่อดูรายการที่ต้องเติม →</span> },
  ];

  return (
    <div className="space-y-9 pb-10">
      {/* Hero */}
      <section className="hero hero-grid relative overflow-hidden rounded-2xl px-5 py-7 sm:px-9 sm:py-8">
        <div className="hero-accent" aria-hidden />
        <div className="relative z-10 space-y-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_10px_2px_rgba(251,191,36,0.6)]" />
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-amber-200/80">Inventory Overview</p>
              </div>
              <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-white sm:text-[32px]">ภาพรวมคลังอะไหล่</h1>
              <p className="max-w-xl text-sm leading-relaxed text-slate-300/90">สวัสดี, {data.userName} — สรุปสต็อกตามอาคารและ Block ณ วันที่ {today}</p>
            </div>
            <ExportDialog variant="hero" />
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="dot-pulse relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-sm text-slate-200">
              มี <strong className="tnum font-semibold text-amber-200">{totals.lowStockCount}</strong> รายการใกล้หมดสต็อก ควรเติมเร็วๆ นี้
            </span>
            <span className="mx-1 h-3 w-px bg-white/15" />
            <span className="text-xs text-slate-400">อัปเดตเรียลไทม์</span>
            {sharedCount > 0 && (
              <>
                <span className="mx-1 h-3 w-px bg-white/15" />
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 px-3 py-1 text-xs font-medium text-violet-300 ring-1 ring-inset ring-violet-400/25">
                  <Share2 className="h-3 w-3" />
                  <strong className="tnum">{sharedCount}</strong> อะไหล่ใช้ร่วม
                </span>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              const valueClass = stat.alert ? "text-amber-200" : "text-white";
              return (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className={cn("glass block cursor-pointer", stat.alert && "glass-alert")}
                >
                  <div className="glass-inner h-full p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className={cn("text-[11px] font-medium uppercase tracking-wider", stat.alert ? "text-amber-200/90" : "text-slate-300/80")}>{stat.label}</span>
                      <span className={cn("chip h-9 w-9", stat.chip)}>
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                    </div>
                    <p className={cn("tnum text-[28px] font-semibold leading-none", valueClass)}>{stat.value.toLocaleString()}</p>
                    {stat.spark ? (
                      <div className="mt-2.5">
                        <svg viewBox="0 0 120 28" className="h-7 w-full" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="sp" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.4" />
                              <stop offset="100%" stopColor="#6ee7b7" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <polygon points="0,24 17,20 34,22 51,12 68,15 85,7 102,9 120,3 120,28 0,28" fill="url(#sp)" />
                          <polyline points="0,24 17,20 34,22 51,12 68,15 85,7 102,9 120,3" fill="none" stroke="#6ee7b7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    ) : (
                      <p className="mt-2 text-[11px] text-slate-400">{stat.sub}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Buildings */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="h-5 w-1 rounded-full bg-gradient-to-b from-[#d4b06a] to-[#9a7635]" />
            <h2 className="text-base font-semibold tracking-tight text-slate-900">อาคารจัดเก็บ</h2>
            <span className="tnum rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{data.buildings.length}</span>
          </div>
          <Link href="/buildings" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">
            จัดการอาคาร
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </Link>
        </div>

        {data.buildings.length === 0 ? (
          <div className="pcard pcard-pad py-10 text-center text-sm text-slate-500">
            ยังไม่มีข้อมูลอาคาร — สร้างอาคารเพื่อจัดกลุ่มอะไหล่
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.buildings.map((building, idx) => {
              const glow = GLOW_COLORS[idx % GLOW_COLORS.length];
              return (
                <div key={building.id} className="bcard flex h-full flex-col p-5">
                  <div className="glow" style={{ background: glow }} />
                  <Link href={`/parts?buildingId=${building.id}`} className="group block flex-1 relative z-[1]">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="bicon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">อาคารที่เก็บ</p>
                          <h3 className="mt-0.5 truncate text-[17px] font-semibold tracking-tight text-slate-900">{building.name}</h3>
                        </div>
                      </div>
                      <div className="shrink-0 rounded-lg border border-amber-200/60 bg-gradient-to-b from-amber-50 to-white px-3 py-1.5 text-center">
                        <p className="tnum text-lg font-semibold text-slate-900">{building.partCount.toLocaleString()}</p>
                        <p className="text-[9px] uppercase tracking-wider text-amber-700/70">รายการ</p>
                      </div>
                    </div>
                    <div className="mb-1 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">ชิ้นรวม</p>
                        <p className="tnum text-sm font-semibold text-slate-900">{building.totalQuantity.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">หมวดหมู่</p>
                        <p className="tnum text-sm font-semibold text-slate-900">{building.categoryCount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">Block</p>
                        <p className="tnum text-sm font-semibold text-slate-900">{building.blocks.length}</p>
                      </div>
                    </div>
                  </Link>

                  {building.blocks.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 relative z-[1]">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">แยกตาม Block</p>
                      <div className="space-y-1.5">
                        {building.blocks.map((blk) => {
                          const pct = building.partCount > 0 ? Math.round((blk.partCount / building.partCount) * 100) : 0;
                          return (
                            <Link
                              key={blk.block}
                              href={`/parts?buildingId=${building.id}&plant=${blockPlantQuery(blk.block)}`}
                              className="block rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 transition-colors hover:border-amber-200 hover:bg-amber-50/40"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="mb-1.5 flex items-center justify-between">
                                <p className="text-xs font-medium text-slate-700">{formatBlockLabel(blk.block)}</p>
                                <span className="tnum text-[11px] text-slate-400">{blk.partCount.toLocaleString()} รายการ</span>
                              </div>
                              <div className="bar"><span style={{ width: `${pct}%` }} /></div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Block summary + Recent movements */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="pcard overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-transparent px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="h-5 w-1 rounded-full bg-gradient-to-b from-[#d4b06a] to-[#9a7635]" />
              <h3 className="text-sm font-semibold tracking-tight text-slate-900">สรุปตาม Block</h3>
            </div>
            <span className="tnum text-xs text-slate-400">{data.blockSummaries.length} Block</span>
          </div>
          <div>
            {data.blockSummaries.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">ยังไม่มีข้อมูล Block</p>
            ) : (
              <>
                <div className="divide-y divide-slate-100">
                  {data.blockSummaries.map((blk, i) => {
                    const pct = Math.round((blk.partCount / maxBlockParts) * 100);
                    return (
                      <Link key={blk.block} href={`/parts?plant=${blockPlantQuery(blk.block)}`} className="block px-5 py-4 transition-colors hover:bg-slate-50/60">
                        <div className="flex items-start gap-3">
                          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold", i === 0 ? "bg-gradient-to-br from-[#e8d5a8] to-[#d4b06a] text-slate-900 shadow-sm" : "border border-slate-200 bg-white text-slate-600")}>{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900">{formatBlockLabel(blk.block)}</p>
                            <div className="mt-2 bar"><span style={{ width: `${pct}%` }} /></div>
                            <div className="mt-2.5 grid grid-cols-3 gap-3 text-sm">
                              <div><p className="text-[10px] uppercase tracking-wider text-slate-400">รายการ</p><p className="tnum font-semibold text-slate-900">{blk.partCount.toLocaleString()}</p></div>
                              <div><p className="text-[10px] uppercase tracking-wider text-slate-400">ชิ้นรวม</p><p className="tnum font-semibold text-slate-900">{blk.totalQuantity.toLocaleString()}</p></div>
                              <div><p className="text-[10px] uppercase tracking-wider text-slate-400">หมวดหมู่</p><p className="tnum font-semibold text-slate-900">{blk.categoryCount.toLocaleString()}</p></div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/60 px-5 py-3 text-xs text-slate-500">
                  <span>รวม <strong className="tnum text-slate-700">{totals.totalParts.toLocaleString()}</strong> รายการ · <strong className="tnum text-slate-700">{totals.totalQuantity.toLocaleString()}</strong> ชิ้น · <strong className="tnum text-slate-700">{totals.totalCategories.toLocaleString()}</strong> หมวดหมู่</span>
                  <Link href="/parts" className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-slate-950">
                    ดูอะไหล่ทั้งหมด
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="pcard overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-transparent px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="h-5 w-1 rounded-full bg-gradient-to-b from-[#d4b06a] to-[#9a7635]" />
              <h3 className="text-sm font-semibold tracking-tight text-slate-900">เบิก-รับเข้า-ปรับปรุง ล่าสุด</h3>
            </div>
            <Link href="/movements" className="text-xs text-slate-500 hover:text-slate-900">ดูทั้งหมด</Link>
          </div>
          <div>
            {data.recentMovements.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">ยังไม่มีการเคลื่อนไหวสต็อก</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.recentMovements.map((movement) => {
                  const isIn = movement.type === "STOCK_IN";
                  const isOut = movement.type === "STOCK_OUT";
                  const Icon = isIn ? ArrowDownCircle : isOut ? ArrowUpCircle : PenLine;
                  const wrap = isIn ? "border-emerald-200 bg-emerald-50 text-emerald-600" : isOut ? "border-red-200 bg-red-50 text-red-600" : "border-slate-200 bg-slate-50 text-slate-600";
                  const badge = isIn ? "bg-emerald-50 text-emerald-700" : isOut ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700";
                  const ring = isIn ? "#a7f3d0" : isOut ? "#fecaca" : "#e2e8f0";
                  return (
                    <Link
                      key={movement.id}
                      href={`/parts/${movement.part.id}`}
                      className="group flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", wrap)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 group-hover:text-amber-700">{movement.part.partNumber}</p>
                        <p className="truncate text-xs text-slate-500">{movement.part.partName}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">{movementLabel(movement.type)} · {movement.user.name ?? "ระบบ"} · {formatDistanceToNow(new Date(movement.createdAt), { addSuffix: true, locale: th })}</p>
                      </div>
                      <span className={cn("tnum inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-semibold", badge)} style={{ boxShadow: `inset 0 0 0 1px ${ring}` }}>
                        {movement.quantityChange >= 0 ? "+" : ""}{movement.quantityChange}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
