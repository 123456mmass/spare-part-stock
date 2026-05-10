"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toaster";
import { Scan as ScanIcon, Camera, AlertCircle } from "lucide-react";

export default function ScanPage() {
  const { toast } = useToast();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const checkCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      setHasPermission(true);
    } catch {
      setHasPermission(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkCameraPermission();
  }, []);

  const simulateScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      toast({
        title: "สแกน QR Code",
        description: "กรุณาใช้งานบนมือถือเพื่อสแกน QR Code จริง",
      });
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">สแกน QR Code</h1>
        <p className="text-gray-500">สแกน QR Code ที่ติดอยู่กับอะไหล่เพื่อดูข้อมูล</p>
      </div>

      {/* Scanner Area */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="relative aspect-square bg-gray-900 flex items-center justify-center">
            {hasPermission === false ? (
              <div className="text-center p-8">
                <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
                <p className="text-white text-lg mb-2">ไม่สามารถเข้าถึงกล้องได้</p>
                <p className="text-gray-400 text-sm mb-4">
                  กรุณาอนุญาตการเข้าถึงกล้องในการตั้งค่าเบราว์เซอร์
                </p>
                <Button variant="secondary" onClick={checkCameraPermission}>
                  ลองอีกครั้ง
                </Button>
              </div>
            ) : (
              <div className="text-center p-8">
                <div className="w-48 h-48 border-2 border-dashed border-gray-600 rounded-lg mx-auto mb-6 flex items-center justify-center">
                  <ScanIcon className="h-20 w-20 text-gray-600" />
                </div>
                <p className="text-gray-400 mb-4">
                  {isScanning ? "กำลังสแกน..." : "เล็งกล้องไปที่ QR Code"}
                </p>
                <div className="flex flex-col gap-3">
                  <Button onClick={simulateScan} size="lg" className="w-full">
                    <Camera className="h-5 w-5 mr-2" />
                    เปิดกล้อง
                  </Button>
                  <p className="text-xs text-gray-500">
                    หรือเลือกรูป QR Code จากอัลบั้ม
                  </p>
                </div>
              </div>
            )}

            {/* Scanning frame overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">วิธีใช้งาน</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <div>
                <p className="font-medium">เปิดกล้องมือถือ</p>
                <p className="text-sm text-gray-500">กดปุ่ม &quot;เปิดกล้อง&quot; เพื่อเริ่มสแกน</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-bold">2</span>
              </div>
              <div>
                <p className="font-medium">เล็ง QR Code</p>
                <p className="text-sm text-gray-500">จัดวาง QR Code ภายในกรอบสี่เหลี่ยม</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-bold">3</span>
              </div>
              <div>
                <p className="font-medium">ดูข้อมูลอะไหล่</p>
                <p className="text-sm text-gray-500">ระบบจะนำคุณไปยังหน้าข้อมูลอะไหล่โดยอัตโนมัติ</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile bottom padding */}
      <div className="h-20 md:hidden" />
    </div>
  );
}
