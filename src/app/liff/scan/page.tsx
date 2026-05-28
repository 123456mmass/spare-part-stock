"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Scanner } from "@yudiel/react-qr-scanner";
import { liffFetch } from "@/lib/liff-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { Camera, Search } from "lucide-react";

export default function LiffScanPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");

  const searchByCode = useCallback(
    async (code: string) => {
      setScanning(false);
      try {
        const res = await liffFetch(`/api/liff/parts/by-code/${encodeURIComponent(code)}`);
        if (res.ok) {
          const part = await res.json();
          router.push(`/liff/stock-move?partId=${part.id}`);
          return;
        }
        if (res.status === 404) {
          toast({ title: "ไม่พบอะไหล่", description: `รหัส: ${code}`, variant: "destructive" });
        } else {
          toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
        }
      } catch {
        toast({ title: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์", variant: "destructive" });
      }
    },
    [router, toast],
  );

  const handleScan = useCallback(
    (detectedCodes: { rawValue: string }[]) => {
      if (detectedCodes.length > 0) {
        searchByCode(detectedCodes[0].rawValue);
      }
    },
    [searchByCode],
  );

  const handleError = useCallback((error: unknown) => {
    console.error("Scanner error:", error);
  }, []);

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="text-center">
        <h1 className="text-xl font-bold">สแกนบาร์โค้ด / QR Code</h1>
        <p className="text-sm text-muted-foreground">เล็งกล้องไปที่บาร์โค้ดหรือ QR Code ของอะไหล่</p>
      </div>

      {!scanning && (
        <Card>
          <CardContent className="p-6 text-center">
            <Camera className="size-14 text-primary mx-auto mb-3" />
            <Button size="lg" onClick={() => setScanning(true)} className="w-full">
              เปิดกล้อง
            </Button>
          </CardContent>
        </Card>
      )}

      {scanning && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="relative aspect-[4/3] bg-black">
              <Scanner
                onScan={handleScan}
                onError={handleError}
                constraints={{ facingMode: "environment" }}
                scanDelay={500}
              />
            </div>
            <div className="p-3 flex justify-center">
              <Button variant="outline" size="sm" onClick={() => setScanning(false)}>
                หยุด
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground mb-2">หรือพิมพ์รหัสอะไหล่/บาร์โค้ด:</p>
          <div className="flex gap-2">
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="พิมพ์รหัส..."
              onKeyDown={(e) => e.key === "Enter" && searchByCode(manualCode.trim())}
            />
            <Button onClick={() => searchByCode(manualCode.trim())}>
              <Search className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="h-20" />
    </div>
  );
}
