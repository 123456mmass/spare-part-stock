"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { liffFetch } from "@/lib/liff-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { Camera, ImagePlus, Loader2, ArrowLeft, X, Search } from "lucide-react";
import Link from "next/link";

interface ImageMatch {
  part: {
    id: string;
    partNumber: string;
    partName: string;
    quantity: number;
    unit: string;
    location: string | null;
    plant: string | null;
    imageUrl: string | null;
  };
  similarity: number;
}

function stockStatus(
  qty: number,
  min: number,
): { label: string; color: string; bg: string } {
  if (qty <= 0) return { label: "หมด", color: "text-red-600", bg: "bg-red-50" };
  if (qty <= min)
    return { label: "ต่ำ", color: "text-orange-600", bg: "bg-orange-50" };
  return { label: "คงเหลือ", color: "text-green-600", bg: "bg-green-50" };
}

export default function LiffImageSearchPage() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [matches, setMatches] = useState<ImageMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  function handleFileSelect(file: File) {
    if (!file.type.startsWith("image/")) {
      toast({ title: "ไฟล์ไม่ใช่รูปภาพ", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "ไฟล์ใหญ่เกิน 5MB", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setMatches([]);
    setSearched(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }

  function clearImage() {
    setSelectedFile(null);
    setImagePreview(null);
    setMatches([]);
    setSearched(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function doSearch() {
    if (!selectedFile) return;
    setLoading(true);
    setSearched(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await liffFetch("/api/mobile/parts/search-by-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error || "Search failed");
      }

      const data = (await res.json()) as { matches: ImageMatch[] };
      setMatches(data.matches);
    } catch (err) {
      toast({
        title: "ค้นหาไม่สำเร็จ",
        description: err instanceof Error ? err.message : "เกิดข้อผิดพลาด",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/liff">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="size-5" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold">ค้นหาด้วยรูป</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        ถ่ายรูปหรือเลือกรูปอะไหล่ ระบบจะค้นหาอะไหล่ที่คล้ายกันจากคลัง
      </p>

      {/* Image selection */}
      {!imagePreview ? (
        <Card>
          <CardContent className="p-6 flex gap-3">
            <Button
              variant="outline"
              className="flex-1 gap-2 h-20"
              onClick={() => {
                if (fileInputRef.current) fileInputRef.current.click();
              }}
            >
              <ImagePlus className="size-5" />
              <span className="text-sm">เลือกรูป</span>
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2 h-20"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.setAttribute("capture", "environment");
                  fileInputRef.current.click();
                  // Remove capture attribute after click so next time it's optional
                  setTimeout(
                    () =>
                      fileInputRef.current?.removeAttribute("capture"),
                    100,
                  );
                }
              }}
            >
              <Camera className="size-5" />
              <span className="text-sm">ถ่ายรูป</span>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Selected"
              className="w-full aspect-[4/3] object-cover"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 size-8"
              onClick={clearImage}
            >
              <X className="size-4" />
            </Button>
          </div>
          <CardContent className="p-3">
            <Button
              className="w-full"
              onClick={doSearch}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Search className="size-4 mr-2" />
              )}
              {loading ? "กำลังค้นหา..." : "ค้นหาอะไหล่"}
            </Button>
          </CardContent>
        </Card>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Results */}
      {searched && !loading && matches.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              ไม่พบอะไหล่ที่คล้ายกับรูป
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ลองถ่ายรูปใหม่ให้ชัดขึ้น หรือใช้มุมที่ต่างออกไป
            </p>
          </CardContent>
        </Card>
      )}

      {matches.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            พบ {matches.length} รายการที่คล้ายกัน
          </p>
          {matches.map((match) => {
            const { part, similarity } = match;
            const pct = Math.round(similarity * 100);
            const status = stockStatus(part.quantity, 0);
            const location = [part.plant].filter(Boolean).join(" / ");

            return (
              <Card
                key={part.id}
                role="button"
                className="cursor-pointer hover:bg-accent active:scale-[0.99] transition-all"
                onClick={() =>
                  router.push(`/liff/stock-move?partId=${part.id}`)
                }
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">
                        {part.partNumber}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {part.partName}
                      </p>
                      {location && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          📍 {location}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className={`px-2 py-0.5 rounded text-xs font-medium ${status.bg} ${status.color}`}
                      >
                        {part.quantity} {part.unit}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {pct}% คล้าย
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="h-20" />
    </div>
  );
}
