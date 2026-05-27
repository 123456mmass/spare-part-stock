"use client";

import { useEffect } from "react";
import { useLiffAuth } from "@/lib/liff-auth";
import { Card } from "@/components/ui/card";
import { QrCode, PackageOpen, PlusCircle, Image } from "lucide-react";
import { useRouter } from "next/navigation";

const MENU = [
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
  {
    key: "image-search",
    label: "ค้นหาด้วยรูป",
    desc: "เร็วๆ นี้",
    icon: Image,
    color: "text-gray-400",
    bg: "bg-gray-100",
    disabled: true,
  },
];

export default function LiffHome() {
  const { user, status } = useLiffAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unlinked") {
      router.replace("/liff/link");
    }
  }, [status, router]);

  if (status !== "authenticated" || !user) return null;

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        ยินดีต้อนรับ, <span className="font-medium text-foreground">{user.name || user.username}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {MENU.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.key}
              role="button"
              className={`p-4 flex flex-col items-center text-center gap-2 transition-colors ${
                item.disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer hover:bg-accent active:scale-[0.98]"
              }`}
              onClick={() => {
                if (item.disabled) return;
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
