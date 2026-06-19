"use client";

import { useEffect } from "react";
import { useLiffAuth } from "@/lib/liff-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, PackageOpen, PlusCircle, Image, LogOut, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

const MENU = [
  {
    key: "search",
    label: "ค้นหาอะไหล่",
    desc: "ค้นจากชื่อหรือรหัส กรองตาม Block",
    icon: Search,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    key: "image-search",
    label: "ค้นหาด้วยรูป",
    desc: "ถ่ายรูปอะไหล่ AI ค้นหาให้",
    icon: Image,
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  {
    key: "scan",
    label: "สแกนบาร์โค้ด",
    desc: "สแกน QR / Barcode เพื่อเพิ่ม-ลดสต็อก",
    icon: QrCode,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    key: "add-part",
    label: "เพิ่มอะไหล่",
    desc: "ถ่ายรูป + AI ช่วยกรอกข้อมูล",
    icon: PlusCircle,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    key: "stock-move",
    label: "เพิ่ม-ลดสต็อก",
    desc: "ปรับยอดอะไหล่ด้วยตนเอง",
    icon: PackageOpen,
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
];

export default function LiffHome() {
  const { user, status, logout } = useLiffAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (status === "unlinked") {
      router.replace("/liff/link");
    }
  }, [status, router]);

  // When LIFF opens with ?lineSid=... and/or ?go=add-part, redirect accordingly.
  // LIFF deep links wrap our query params inside ?liff.state=... so we try that first.
  // We also persist to localStorage as a fallback when LIFF drops query params
  // during the login redirect.
  useEffect(() => {
    if (status !== "authenticated") return;

    // LIFF wraps deep-link query params under ?liff.state=lineSid=...&go=...
    const liffState = searchParams.get("liff.state");
    const stateParams = liffState
      ? new URLSearchParams(liffState.startsWith("?") ? liffState.slice(1) : liffState)
      : searchParams;

    const lineSid = stateParams.get("lineSid") || searchParams.get("lineSid");
    const go = stateParams.get("go") || searchParams.get("go");

    // Persist to localStorage before any LIFF redirect could drop URL params
    if (lineSid) {
      localStorage.setItem("liff_pending_lineSid", lineSid);
    }
    if (go) {
      localStorage.setItem("liff_pending_go", go);
    }

    // Determine redirect target — check URL params first, then localStorage fallback
    const targetSid = lineSid || localStorage.getItem("liff_pending_lineSid");
    const targetGo = go || localStorage.getItem("liff_pending_go");

    // Also check liff_login_redirect saved by liff-auth.tsx before LINE login
    const savedRedirect = localStorage.getItem("liff_login_redirect");

    if (targetSid || targetGo) {
      // Clean up localStorage
      localStorage.removeItem("liff_pending_lineSid");
      localStorage.removeItem("liff_pending_go");
      localStorage.removeItem("liff_login_redirect");

      if (targetGo === "add-part" && targetSid) {
        router.replace(`/liff/add-part?lineSid=${encodeURIComponent(targetSid)}`);
      } else if (targetGo === "add-part") {
        router.replace("/liff/add-part");
      } else if (targetSid) {
        // Legacy: lineSid without go param → default to add-part
        router.replace(`/liff/add-part?lineSid=${encodeURIComponent(targetSid)}`);
      }
    } else if (savedRedirect && savedRedirect !== "/liff" && savedRedirect !== "/liff/") {
      // LIFF login redirect dropped us on the home page, but we saved where we wanted to go
      localStorage.removeItem("liff_login_redirect");
      router.replace(savedRedirect);
    }
  }, [status, searchParams, router]);

  if (status !== "authenticated" || !user) return null;

  async function handleLogout() {
    await logout();
    router.replace("/liff/link");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm text-muted-foreground">
          ยินดีต้อนรับ,{" "}
          <span className="font-medium text-foreground">{user.name || user.username}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={handleLogout}
        >
          <LogOut className="size-4" />
          ออกจากระบบ
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {MENU.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.key}
              role="button"
              className="p-4 flex flex-col items-center text-center gap-2 transition-colors cursor-pointer hover:bg-accent active:scale-[0.98]"
              onClick={() => {
                router.push(`/liff/${item.key}`);
              }}
            >
              <div className={`p-2 rounded-full ${item.bg}`}>
                <Icon className={`size-5 ${item.color}`} />
              </div>
              <span className="text-sm font-medium">{item.label}</span>
              <span className="text-[10px] text-muted-foreground leading-tight">
                {item.desc}
              </span>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
