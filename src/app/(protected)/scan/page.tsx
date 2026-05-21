"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth as fetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { Search, Camera, XCircle } from "lucide-react";

export default function ScanPage() {
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
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const searchByCode = useCallback(async (code: string) => {
    stopCamera();
    try {
      const res = await fetch(`/api/parts?search=${encodeURIComponent(code)}`);
      if (res.ok) {
        const parts = await res.json();
        if (parts.length > 0) {
          router.push(`/parts/${parts[0].id}`);
          return;
        }
      }
      toast({ title: "ไม่พบอะไหล่", description: `รหัส: ${code}`, variant: "destructive" });
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    }
  }, [router, toast, stopCamera]);

  const startCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      setScanning(true);

      // Wait for video element to be ready
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          startDetection();
        }
      }, 100);
    } catch (err) {
      setError("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้กล้องในเบราว์เซอร์");
    }
  };

  const startDetection = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      try {
        // Try native BarcodeDetector first
        if ("BarcodeDetector" in window) {
          const detector = new (window as any).BarcodeDetector({
            formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "itf"]
          });
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            searchByCode(barcodes[0].rawValue);
            return;
          }
        }
      } catch {
        // BarcodeDetector not supported, just keep scanning
      }
    }, 500);
  };

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">สแกนบาร์โค้ด / QR Code</h1>
        <p className="text-gray-500">เล็งกล้องไปที่บาร์โค้ดหรือ QR Code ของอะไหล่</p>
      </div>

      {!scanning && (
        <Card>
          <CardContent className="p-8 text-center">
            <Camera className="h-16 w-16 text-blue-500 mx-auto mb-4" />
            <Button size="lg" onClick={startCamera} className="w-full">
              เปิดกล้องสแกน
            </Button>
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                <XCircle className="h-4 w-4 flex-shrink-0" />
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
                <div className="w-64 h-48 border-2 border-blue-400 rounded-lg" />
              </div>
            </div>
            <div className="p-3 text-center">
              <Button variant="outline" size="sm" onClick={stopCamera}>หยุดสแกน</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-gray-500 mb-2">หรือพิมพ์รหัสอะไหล่/บาร์โค้ด:</p>
          <div className="flex gap-2">
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="พิมพ์รหัส..."
              onKeyDown={(e) => e.key === "Enter" && searchByCode(manualCode.trim())}
            />
            <Button onClick={() => searchByCode(manualCode.trim())}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="h-20 md:hidden" />
    </div>
  );
}
