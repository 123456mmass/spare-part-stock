"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";

interface ReleaseInfo {
  available: boolean;
  version?: string;
  buildNumber?: string;
  sizeBytes?: number;
  buildDate?: string;
}

function formatSize(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DownloadAppButton() {
  const [info, setInfo] = useState<ReleaseInfo | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/release/info", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data) setInfo(data as ReleaseInfo);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!info || !info.available) return null;

  const size = formatSize(info.sizeBytes);
  return (
    <a
      href="/api/release/apk"
      className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-200"
      title={
        size
          ? `ดาวน์โหลดแอป Android v${info.version ?? ""} (${size})`
          : `ดาวน์โหลดแอป Android v${info.version ?? ""}`
      }
    >
      <Smartphone className="h-4 w-4 text-emerald-300" />
      <span className="hidden sm:inline">ดาวน์โหลดแอป</span>
      <span className="sm:hidden">แอป</span>
      {info.version ? (
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tnum text-slate-300 group-hover:text-emerald-100">
          v{info.version}
        </span>
      ) : null}
      <Download className="h-3.5 w-3.5 opacity-70" />
    </a>
  );
}
