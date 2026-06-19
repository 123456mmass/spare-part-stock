"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { fetchWithAuth as fetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { Search, Camera, XCircle, ImageIcon, Barcode, Loader2 } from "lucide-react";
import { PageTitle } from "@/components/layout";

type Mode = "barcode" | "image";

interface MatchPart {
  id: string;
  partNumber: string;
  partName: string;
  imageUrl: string | null;
  quantity: number;
  unit: string;
  location: string | null;
}

interface Match {
  part: MatchPart;
  similarity: number;
}

export default function ScanPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("barcode");
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
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
    setMatches(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      const isSecure = typeof window !== "undefined" && (window.isSecureContext || location.hostname === "localhost");
      setError(
        isSecure
          ? "เบราว์เซอร์นี้ไม่รองรับการใช้กล้อง"
          : `ต้องเปิดผ่าน HTTPS เท่านั้น (ตอนนี้ใช้ ${location.protocol}//${location.host})`
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      setScanning(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          if (mode === "barcode") startDetection();
        }
      }, 100);
    } catch (err) {
      const e = err as DOMException;
      if (e.name === "NotAllowedError" || e.name === "SecurityError") {
        setError("ไม่ได้รับอนุญาตให้ใช้กล้อง กดที่ไอคอนกล้องบน address bar เพื่ออนุญาต แล้วลองใหม่");
      } else if (e.name === "NotFoundError" || e.name === "OverconstrainedError") {
        setError("ไม่พบกล้องบนอุปกรณ์นี้");
      } else if (e.name === "NotReadableError") {
        setError("กล้องถูกใช้งานโดยแอปอื่นอยู่");
      } else {
        setError(`เปิดกล้องไม่ได้: ${e.name || "Unknown"} — ${e.message || "ไม่ทราบสาเหตุ"}`);
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
            formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "itf"]
          });
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            searchByCode(barcodes[0].rawValue);
            return;
          }
        }
      } catch {
        // BarcodeDetector not supported
      }
    }, 500);
  };

  const captureAndSearch = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      toast({ title: "เกิดข้อผิดพลาด", description: "canvas ctx unavailable", variant: "destructive" });
      return;
    }
    ctx.drawImage(video, 0, 0);

    let blob: Blob;
    try {
      blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob fail"))), "image/jpeg", 0.85)
      );
    } catch (err) {
      toast({ title: "เกิดข้อผิดพลาด", description: (err as Error).message, variant: "destructive" });
      return;
    }

    const previewUrl = canvas.toDataURL("image/jpeg", 0.7);
    setCapturedPreview(previewUrl);
    stopCamera();
    setSearching(true);
    setMatches(null);

    try {
      const formData = new FormData();
      formData.append("file", blob, "scan.jpg");
      const res = await fetch("/api/parts/search-by-image", { method: "POST", body: formData });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ title: "ค้นหาด้วยรูปไม่สำเร็จ", description: data.error || `HTTP ${res.status}`, variant: "destructive" });
        return;
      }

      const data = (await res.json()) as { matches: Match[] };
      setMatches(data.matches);
      if (data.matches.length === 0) {
        toast({ title: "ไม่พบอะไหล่ที่ตรง", description: "ลองถ่ายมุมอื่นหรือใกล้ขึ้น", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "เกิดข้อผิดพลาด", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    stopCamera();
    setMatches(null);
    setCapturedPreview(null);
    setError("");
    setMode(next);
  };

  const retake = () => {
    setCapturedPreview(null);
    setMatches(null);
    startCamera();
  };

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <PageTitle
        title={mode === "barcode" ? "สแกนบาร์โค้ด / QR Code" : "ค้นหาด้วยรูปภาพ"}
        description={
          mode === "barcode"
            ? "เล็งกล้องไปที่บาร์โค้ดหรือ QR Code ของอะไหล่ — ระบบสแกนอัตโนมัติ"
            : "ถ่ายรูปอะไหล่เพื่อจับคู่กับฐานข้อมูล"
        }
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={cn("smode-btn", mode === "barcode" && "smode-active")}
          onClick={() => switchMode("barcode")}
        >
          <Barcode className="h-4 w-4" />
          บาร์โค้ด
        </button>
        <button
          type="button"
          className={cn("smode-btn", mode === "image" && "smode-active")}
          onClick={() => switchMode("image")}
        >
          <ImageIcon className="h-4 w-4" />
          ค้นหาด้วยรูป
        </button>
      </div>

      {!scanning && !capturedPreview && (
        <Card className="p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 mx-auto mb-4">
            <Camera className="h-8 w-8 text-amber-600" />
          </div>
          <p className="text-sm text-slate-500 mb-4">
            {mode === "barcode" ? "กดเพื่อเปิดกล้องแล้วเล็งที่บาร์โค้ด" : "กดเพื่อเปิดกล้องแล้วถ่ายรูปอะไหล่"}
          </p>
          <Button size="lg" variant="gold" onClick={startCamera} className="w-full">
            เปิดกล้อง
          </Button>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2 text-left">
              <XCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </Card>
      )}

      {scanning && (
        <Card className="overflow-hidden">
          <div className="relative aspect-[4/3] bg-slate-900 overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="relative w-64 h-48 border-2 border-amber-300/80 rounded-lg"
                style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)" }}
              >
                <div className="absolute -top-0 -left-0 h-5 w-5 border-t-2 border-l-2 border-amber-300 rounded-tl-lg" />
                <div className="absolute -top-0 -right-0 h-5 w-5 border-t-2 border-r-2 border-amber-300 rounded-tr-lg" />
                <div className="absolute -bottom-0 -left-0 h-5 w-5 border-b-2 border-l-2 border-amber-300 rounded-bl-lg" />
                <div className="absolute -bottom-0 -right-0 h-5 w-5 border-b-2 border-r-2 border-amber-300 rounded-br-lg" />
                {mode === "barcode" && <div className="scanline" />}
              </div>
            </div>
            {mode === "barcode" ? (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[11px] text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                กำลังสแกน...
              </div>
            ) : (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[11px] text-white">
                <Camera className="h-3 w-3" />
                ถ่ายรูปเพื่อค้นหา
              </div>
            )}
          </div>
          <div className="p-3 flex gap-2 justify-center">
            {mode === "image" && (
              <Button variant="gold" onClick={captureAndSearch}>
                <Camera className="h-4 w-4 mr-2" />
                ถ่ายและค้นหา
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={stopCamera}>หยุดกล้อง</Button>
          </div>
        </Card>
      )}

      {!scanning && capturedPreview && mode === "image" && (
        <Card className="overflow-hidden">
          <div className="relative aspect-[4/3] bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={capturedPreview} alt="captured" className="w-full h-full object-cover" />
            {searching && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white gap-2">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">กำลังค้นหา...</p>
              </div>
            )}
          </div>
          <div className="p-3 flex gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={retake} disabled={searching}>
              <Camera className="h-4 w-4 mr-2" />
              ถ่ายใหม่
            </Button>
          </div>
        </Card>
      )}

      {mode === "image" && matches && matches.length > 0 && (
        <Card className="p-3 space-y-2">
          <p className="text-sm font-medium text-slate-700 px-1">ผลการค้นหา (เรียงตามความใกล้เคียง)</p>
          {matches.map((m) => (
            <button
              key={m.part.id}
              onClick={() => router.push(`/parts/${m.part.id}`)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 border border-slate-200 text-left transition-colors"
            >
              <div className="relative w-16 h-16 flex-shrink-0 bg-slate-100 rounded overflow-hidden">
                {m.part.imageUrl ? (
                  <Image src={m.part.imageUrl} alt={m.part.partName} fill className="object-cover" sizes="64px" />
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{m.part.partName}</p>
                <p className="text-xs text-slate-500 truncate">{m.part.partNumber}</p>
                <p className="text-xs text-slate-500">คงเหลือ {m.part.quantity} {m.part.unit}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-amber-600">{Math.round(m.similarity * 100)}%</p>
              </div>
            </button>
          ))}
        </Card>
      )}

      {mode === "barcode" && (
        <Card className="p-4">
          <p className="text-sm text-slate-500 mb-2">หรือพิมพ์รหัสอะไหล่/บาร์โค้ด:</p>
          <div className="flex gap-2">
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="พิมพ์รหัส..."
              onKeyDown={(e) => e.key === "Enter" && searchByCode(manualCode.trim())}
            />
            <Button variant="gold" onClick={() => searchByCode(manualCode.trim())}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      <div className="h-20 md:hidden" />
    </div>
  );
}
