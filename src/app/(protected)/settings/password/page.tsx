"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchWithAuth as fetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { KeyRound } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isForced = searchParams.get("force") === "true";
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: "รหัสผ่านไม่ตรงกัน" });
      return;
    }

    if (newPassword.length < 6) {
      setErrors({ newPassword: "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors({ form: data.error || "เกิดข้อผิดพลาด" });
        return;
      }
      if (isForced) {
        window.location.href = "/dashboard";
      } else {
        toast({ title: "เปลี่ยนรหัสผ่านสำเร็จ" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setErrors({ form: "เกิดข้อผิดพลาด" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <KeyRound className="h-6 w-6 text-gray-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">เปลี่ยนรหัสผ่าน</h1>
          <p className="text-gray-500">อัปเดตรหัสผ่านของคุณ</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ข้อมูลรหัสผ่าน</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.form && (
              <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{errors.form}</p>
            )}
            {isForced && (
              <p className="text-sm bg-yellow-50 text-yellow-700 p-3 rounded-lg border border-yellow-200">
                คุณต้องเปลี่ยนรหัสผ่านก่อนเข้าใช้งานระบบ
              </p>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700">รหัสผ่านปัจจุบัน</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านปัจจุบัน"
                className="mt-1"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">รหัสผ่านใหม่</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)"
                className="mt-1"
                required
              />
              {errors.newPassword && <p className="text-sm text-red-500 mt-1">{errors.newPassword}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">ยืนยันรหัสผ่านใหม่</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านอีกครั้ง"
                className="mt-1"
                required
              />
              {errors.confirmPassword && <p className="text-sm text-red-500 mt-1">{errors.confirmPassword}</p>}
            </div>

            <Button type="submit" disabled={submitting} className="w-full md:w-auto">
              {submitting ? "กำลังบันทึก..." : "บันทึกรหัสผ่าน"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}