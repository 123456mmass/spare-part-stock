"use client";

import { LiffAuthProvider, useLiffAuth } from "@/lib/liff-auth";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";

function LiffInner({ children }: { children: React.ReactNode }) {
  const { status, error, reauth } = useLiffAuth();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="size-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">กำลังเชื่อมต่อ LINE...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background px-4">
        <div className="text-center space-y-4 max-w-xs">
          <AlertTriangle className="size-10 text-destructive mx-auto" />
          <p className="text-sm text-destructive font-medium">ไม่สามารถเชื่อมต่อ LINE ได้</p>
          <p className="text-xs text-muted-foreground break-all">{error}</p>
          <Button variant="outline" size="sm" onClick={reauth}>
            ลองใหม่
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3 flex items-center justify-between">
        <h1 className="text-sm font-bold">Spare Part Stock</h1>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}

export default function LiffLayout({ children }: { children: React.ReactNode }) {
  return (
    <LiffAuthProvider>
      <LiffInner>{children}</LiffInner>
    </LiffAuthProvider>
  );
}
