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

  // When LIFF opens with ?lineSid=..., redirect to add-part page
  // This handles the case where LINE Flex "แก้ไข" button opens LIFF
  // but the LIFF redirect lands on the home page instead of the sub-path.
  useEffect(() => {
    if (status !== "authenticated") return;
    const lineSid = searchParams.get("lineSid");
    if (lineSid) {
      router.replace(`/liff/add-part?lineSid=${encodeURIComponent(lineSid)}`);
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
