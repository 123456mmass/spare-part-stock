"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { liffFetch } from "@/lib/liff-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { Camera, XCircle, Search } from "lucide-react";

export default function LiffScanPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const searchByCode = useCallback(
    async (code: string) => {
      stopCamera();
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
    [router, toast, stopCamera],
  );

  const startCamera = async () => {
    setError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("เบราว์เซอร์นี้ไม่รองรับการใช้กล้อง");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setScanning(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          startDetection();
        }
      }, 100);
    } catch (err) {
      const e = err as DOMException;
      if (e.name === "NotAllowedError" || e.name === "SecurityError") {
        setError("ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาอนุญาตแล้วลองใหม่");
      } else if (e.name === "NotFoundError" || e.name === "OverconstrainedError") {
        setError("ไม่พบกล้องบนอุปกรณ์นี้");
      } else if (e.name === "NotReadableError") {
        setError("กล้องถูกใช้งานโดยแอปอื่นอยู่");
      } else {
        setError(`เปิดกล้องไม่ได้: ${e.message || "ไม่ทราบสาเหตุ"}`);
      }
    }
  };

  const startDetection = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      try {
        if ("BarcodeDetector" in window) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detector = new (window as any).BarcodeDetector({
            formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "itf"],
          });
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            searchByCode(barcodes[0].rawValue);
          }
        }
      } catch {
        // BarcodeDetector not supported
      }
    }, 500);
  };

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

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
            <Button size="lg" onClick={startCamera} className="w-full">
              เปิดกล้อง
            </Button>
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                <XCircle className="size-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {scanning && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="relative aspect-[4/3] bg-black">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                autoPlay
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-48 border-2 border-primary rounded-lg opacity-70" />
              </div>
            </div>
            <div className="p-3 flex justify-center">
              <Button variant="outline" size="sm" onClick={stopCamera}>
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
