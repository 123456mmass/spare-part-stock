"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * หน้าเดิม — ตอนนี้รวมเข้ากับ /settings (มี tab รหัสผ่าน + โมเดล AI)
 * เก็บไว้เป็น redirect เพื่อ flow เปลี่ยนรหัสผ่านบังคับจากหน้า login
 */
export default function PasswordRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const force = searchParams.get("force") === "true";
    router.replace(force ? "/settings?force=true" : "/settings");
  }, [router, searchParams]);

  return null;
}
