"use client";

import { useEffect, useState } from "react";
import { Smartphone, Download, X, Sparkles } from "lucide-react";

export interface ReleaseInfo {
  available: boolean;
  version?: string;
  buildNumber?: string;
  filename?: string;
  sizeBytes?: number;
  buildDate?: string;
}

// Module-level cache so the sidebar card + dashboard dialog share one fetch.
let cached: ReleaseInfo | null = null;
let fetched = false;

export function useReleaseInfo() {
  const [info, setInfo] = useState<ReleaseInfo | null>(cached);
  useEffect(() => {
    if (fetched) return;
    fetched = true;
    fetch("/api/release/info", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        cached = d;
        setInfo(d);
      })
      .catch(() => {});
  }, []);
  return info;
}

function formatSize(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Compact promo card for the left sidebar. Hidden when no APK is published.
 */
export function MobileAppCard({ collapsed }: { collapsed?: boolean }) {
  const info = useReleaseInfo();
  if (!info?.available) return null;
  const size = formatSize(info.sizeBytes);
  const href = `/apk/${info.filename ?? "sparepart_mobile.apk"}`;

  if (collapsed) {
    return (
      <a
        href={href}
        title="ดาวน์โหลดแอปมือถือ"
        className="nav-item justify-center px-0"
      >
        <Smartphone className="ic h-[18px] w-[18px] text-emerald-600" />
      </a>
    );
  }

  return (
    <a
      href={href}
      className="group mt-2 flex items-center gap-3 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-2.5 transition hover:border-emerald-300 hover:shadow-sm"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
        <Smartphone className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-emerald-900">แอปมือถือพร้อมใช้งาน</p>
        <p className="truncate text-[11px] text-emerald-700/80">
          ดาวน์โหลด{info.version ? ` v${info.version}` : ""}
          {size ? ` · ${size}` : ""}
        </p>
      </div>
      <Download className="h-4 w-4 text-emerald-600 transition group-hover:translate-y-0.5" />
    </a>
  );
}

/**
 * One-time welcome dialog shown on the dashboard after login when a new
 * APK version is available. Dismissal is remembered per version.
 */
export function MobileAppPromoDialog() {
  const info = useReleaseInfo();
  // "closed this session" flag; persistence is read directly from localStorage
  // during render (this dialog only mounts client-side after auth resolves, so
  // there is no SSR/hydration mismatch and no need to setState in an effect).
  const [closed, setClosed] = useState(false);

  const version = info?.version ?? "";
  const dismissKey = `apk_promo_dismissed_${version || "1"}`;
  const alreadyDismissed =
    typeof window !== "undefined" &&
    localStorage.getItem(dismissKey) === "1";

  const open = Boolean(info?.available) && !closed && !alreadyDismissed;

  if (!open || !info?.available) return null;

  const size = formatSize(info.sizeBytes);
  const href = `/apk/${info.filename ?? "sparepart_mobile.apk"}`;

  const close = (forever: boolean) => {
    if (forever) {
      try {
        localStorage.setItem(dismissKey, "1");
      } catch {}
    }
    setClosed(true);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={() => close(false)}
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="ปิด"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-6 pb-6 pt-7 text-white">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
            <Smartphone className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold">แอปมือถือพร้อมใช้งานแล้ว! 🎉</h2>
          <p className="mt-1 text-sm text-emerald-50/90">
            จัดการสต็อกอะไหล่จากทุกที่ แชท AI · สแกน QR · เบิก-รับ ผ่านมือถือ
          </p>
        </div>

        <div className="px-6 py-5">
          <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Android APK
            </span>
            {version && (
              <span className="rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                v{version}
              </span>
            )}
            {size && <span>· {size}</span>}
          </div>

          <a
            href={href}
            onClick={() => close(false)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
          >
            <Download className="h-4 w-4" />
            ดาวน์โหลดแอปเลย
          </a>

          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => close(true)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              ไม่แสดงอีก
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
