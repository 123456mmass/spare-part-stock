"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useLiffAuth } from "@/lib/liff-auth";
import { storeToken } from "@/lib/liff-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

const API_KEY = process.env.NEXT_PUBLIC_MOBILE_API_KEY ?? "";

export default function LiffLinkPage() {
  const { idToken, status } = useLiffAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/liff");
    }
  }, [status, router]);

  if (status === "loading" || status === "authenticated") return null;
  if (status !== "unlinked" || !idToken) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-muted-foreground">ไม่สามารถเชื่อมต่อบัญชีได้ในขณะนี้</p>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/line/auth/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({ idToken, username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "ALREADY_LINKED") {
          setError("บัญชี LINE นี้เชื่อมต่อกับผู้ใช้แล้ว");
        } else if (res.status === 401) {
          setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
        } else if (res.status === 429) {
          setError("มีการพยายามเชื่อมต่อมากเกินไป กรุณาลองใหม่ในภายหลัง");
        } else {
          setError(data.error ?? "เกิดข้อผิดพลาด");
        }
        return;
      }

      storeToken(data.token);
      try {
        const mod = await import("@line/liff");
        const liff = mod.default;
        if (liff.isInClient()) {
          liff.closeWindow();
          return;
        }
      } catch {
        // Fall back to LIFF menu below.
      }
      router.replace("/liff");
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-lg">เชื่อมต่อบัญชี</CardTitle>
          <CardDescription>เข้าสู่ระบบเพื่อเชื่อมต่อกับ LINE</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">ชื่อผู้ใช้</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ชื่อผู้ใช้"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="รหัสผ่าน"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="size-4 mr-2 animate-spin" />}
              เชื่อมต่อบัญชี
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
