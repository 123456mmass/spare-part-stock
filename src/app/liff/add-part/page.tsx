"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { liffFetch } from "@/lib/liff-api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { partSchema } from "@/lib/validators";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { ArrowLeft, Loader2, Sparkles, Camera, Upload } from "lucide-react";

const BLOCK_OPTIONS = ["BLOCK 1", "BLOCK 2", "SPECIAL PART"] as const;
const BUILDING_OPTIONS = [
  { id: "cmppnrh1q0000rcrzhziogf8k", name: "ท.003" },
  { id: "cmpppo7wy0000j1rzph90nwhr", name: "ท.021" },
] as const;

interface FormValues {
  partNumber: string;
  partName: string;
  quantity: number;
  minimumQuantity: number;
  unit: string;
  description?: string;
  categoryName?: string;
  subcategory?: string;
  plant?: string;
  buildingId: string;
  location?: string;
  barcodeValue?: string;
}

/* ── Skeleton components ────────────────────────────────────────── */

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

function FormSkeleton() {
  return (
    <div className="space-y-4">
      {/* Image + AI skeleton */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <SkeletonLine className="h-4 w-28" />
          <div className="flex gap-3">
            <SkeletonLine className="w-20 h-20 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <SkeletonLine className="h-8 w-20 rounded-md" />
                <SkeletonLine className="h-8 w-20 rounded-md" />
              </div>
              <SkeletonLine className="h-8 w-32 rounded-md" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Part info skeleton */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <SkeletonLine className="h-3 w-16" />
              <SkeletonLine className="h-9 w-full rounded-md" />
            </div>
            <div className="space-y-1">
              <SkeletonLine className="h-3 w-16" />
              <SkeletonLine className="h-9 w-full rounded-md" />
            </div>
          </div>
          <div className="space-y-1">
            <SkeletonLine className="h-3 w-16" />
            <SkeletonLine className="h-16 w-full rounded-md" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <SkeletonLine className="h-3 w-16" />
              <SkeletonLine className="h-9 w-full rounded-md" />
            </div>
            <div className="space-y-1">
              <SkeletonLine className="h-3 w-16" />
              <SkeletonLine className="h-9 w-full rounded-md" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <SkeletonLine className="h-3 w-12" />
              <SkeletonLine className="h-9 w-full rounded-md" />
            </div>
            <div className="space-y-1">
              <SkeletonLine className="h-3 w-12" />
              <SkeletonLine className="h-9 w-full rounded-md" />
            </div>
          </div>
          <div className="space-y-1">
            <SkeletonLine className="h-3 w-12" />
            <SkeletonLine className="h-9 w-full rounded-md" />
          </div>
          <div className="space-y-1">
            <SkeletonLine className="h-3 w-14" />
            <SkeletonLine className="h-9 w-full rounded-md" />
          </div>
        </CardContent>
      </Card>

      {/* Stock info skeleton */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <SkeletonLine className="h-4 w-24" />
          <div className="grid grid-cols-3 gap-3">
            <SkeletonLine className="h-9 w-full rounded-md" />
            <SkeletonLine className="h-9 w-full rounded-md" />
            <SkeletonLine className="h-9 w-full rounded-md" />
          </div>
        </CardContent>
      </Card>

      {/* Buttons skeleton */}
      <div className="flex gap-3">
        <SkeletonLine className="h-10 flex-1 rounded-md" />
        <SkeletonLine className="h-10 flex-1 rounded-md" />
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────── */

export default function LiffAddPartPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  // When coming from LINE, show skeleton until AI fills the form
  const [dataReady, setDataReady] = useState(false);
  // Loading phase label for skeleton
  const [loadingPhase, setLoadingPhase] = useState<string>("กำลังโหลดรูปจาก LINE...");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(partSchema) as any,
    defaultValues: { quantity: 0, minimumQuantity: 0, unit: "pcs", plant: "", buildingId: "" },
  });

  const selectedPlant = watch("plant");
  const selectedBuildingId = watch("buildingId");

  // Guard against double-invocation
  const sessionLoadedRef = useRef(false);

  // Load LINE image session → show form with image, let user press "AI เติมข้อมูล" manually
  useEffect(() => {
    const sid = searchParams.get("lineSid");
    if (!sid) {
      // Not from LINE — show form immediately
      setDataReady(true);
      return;
    }
    if (sessionLoadedRef.current) return;
    sessionLoadedRef.current = true;

    let cancelled = false;
    setLoadingPhase("กำลังโหลดรูปจาก LINE...");

    liffFetch(`/api/liff/line-image-sessions/${encodeURIComponent(sid)}`)
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || "โหลดข้อมูลไม่สำเร็จ");
        if (cancelled) return;

        const s = payload.suggestion || {};
        const dataUrl = payload.imageDataUrl as string | undefined;
        setImagePreview(dataUrl || null);

        // Convert base64 dataURL → File for AI suggest button
        // fetch(dataUrl) may fail in LIFF in-app browser, so use manual conversion
        if (dataUrl) {
          try {
            const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              const mime = match[1] || "image/jpeg";
              const binary = atob(match[2]);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
              const file = new File([bytes], "line-image.jpg", { type: mime });
              setImageFile(file);
            }
          } catch {
            // user can still upload manually
          }
        }

        // If suggestion already has data (e.g. backend pre-analyzed), fill it
        applySuggestion(s);

        // Show form immediately — user can press "AI เติมข้อมูล" if they want
        toast({ title: "โหลดรูปจาก LINE แล้ว", description: "กด \"AI เติมข้อมูล\" เพื่อวิเคราะห์รูป" });
        if (!cancelled) setDataReady(true);
      })
      .catch((error) => {
        if (!cancelled) {
          toast({ title: "โหลดข้อมูลจาก LINE ไม่สำเร็จ", description: (error as Error).message, variant: "destructive" });
          setDataReady(true); // Still show form so user can fill manually
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /** Apply suggestion object to form fields. Returns true if any data was filled. */
  function applySuggestion(s: Record<string, unknown>): boolean {
    if (!s) return false;
    let filled = false;
    if (s.partNumber) { setValue("partNumber", s.partNumber as string); filled = true; }
    if (s.partName) { setValue("partName", s.partName as string); filled = true; }
    if (s.description) { setValue("description", s.description as string); filled = true; }
    if (s.location) { setValue("location", s.location as string); filled = true; }
    if (s.unit) { setValue("unit", s.unit as string); filled = true; }
    if (s.barcodeValue) { setValue("barcodeValue", s.barcodeValue as string); filled = true; }
    if (s.subcategory) { setValue("subcategory", s.subcategory as string); filled = true; }
    if (s.plant && BLOCK_OPTIONS.includes(s.plant as typeof BLOCK_OPTIONS[number])) { setValue("plant", s.plant as string); filled = true; }
    if (s.buildingId) { setValue("buildingId", s.buildingId as string); filled = true; }
    if (Number.isFinite(s.quantity)) { setValue("quantity", s.quantity as number); filled = true; }
    if (Number.isFinite(s.minimumQuantity)) { setValue("minimumQuantity", s.minimumQuantity as number); filled = true; }
    const cat = (s.matchedCategoryName || s.categoryName) as string | undefined;
    if (cat) { setValue("categoryName" as keyof FormValues, cat); filled = true; }
    return filled;
  }

  /** Call AI suggest API and return suggestion object, or null on failure. */
  async function runAiSuggest(file: File): Promise<Record<string, unknown> | null> {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await liffFetch("/api/liff/parts/ai-suggest", {
        method: "POST",
        body: formData,
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "AI suggestion failed");
      return payload.suggestion || null;
    } catch {
      return null;
    }
  }

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const res = await liffFetch("/api/liff/parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const part = await res.json();

        if (imageFile) {
          const imgFormData = new FormData();
          imgFormData.append("file", imageFile);
          await liffFetch(`/api/liff/parts/${part.id}/upload-image`, {
            method: "POST",
            body: imgFormData,
          });
        }

        // Mark LINE session as saved (prevents duplicate from LINE confirm button)
        const sid = searchParams.get("lineSid");
        if (sid) {
          await liffFetch(`/api/liff/line-image-sessions/${encodeURIComponent(sid)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "saved", createdPartId: part.id }),
          }).catch(() => { /* best-effort */ });

          // Push success message + search card back to LINE chat
          await liffFetch("/api/liff/parts/push-success", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lineSid: sid, partId: part.id }),
          }).catch(() => { /* best-effort */ });
        }

        toast({ title: "สร้างอะไหล่สำเร็จ" });

        // Close LIFF window and return to LINE chat
        try {
          const mod = await import("@line/liff");
          const liff = mod.default;
          liff.closeWindow();
        } catch {
          router.push("/liff");
        }
      } else {
        const error = await res.json();
        toast({ title: "เกิดข้อผิดพลาด", description: error.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageChange = (e: FormEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAiSuggest = async () => {
    if (!imageFile) {
      toast({ title: "กรุณาเลือกรูปก่อน", variant: "destructive" });
      return;
    }
    setIsAiSuggesting(true);
    try {
      const formData = new FormData();
      formData.append("file", imageFile);
      const res = await liffFetch("/api/liff/parts/ai-suggest", {
        method: "POST",
        body: formData,
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "AI suggestion failed");

      const s = payload.suggestion || {};
      applySuggestion(s);

      toast({ title: "AI เติมข้อมูลจากรูป", description: "ตรวจสอบค่าก่อนบันทึก" });
    } catch (error) {
      toast({
        title: "AI ไม่สามารถวิเคราะห์รูปได้",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsAiSuggesting(false);
    }
  };

  const sid = searchParams.get("lineSid");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/liff">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-bold">เพิ่มอะไหล่ใหม่</h1>
      </div>

      {/* ── Skeleton: show while loading from LINE ── */}
      {sid && !dataReady ? (
        <div className="space-y-3">
          {/* Phase indicator */}
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Loader2 className="size-5 animate-spin text-primary flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{loadingPhase}</p>
                <p className="text-xs text-muted-foreground">รอสักครู่ ข้อมูลจะแสดงเมื่อพร้อม</p>
              </div>
            </CardContent>
          </Card>
          <FormSkeleton />
        </div>
      ) : (
        /* ── Actual form ── */
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <p className="text-sm font-medium">รูปอะไหล่ + AI</p>
              <div className="flex gap-3">
                <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                  {imagePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imagePreview} alt="Preview" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-muted-foreground text-xs">ไม่มีรูป</span>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    type="file"
                    id="liffImageFile"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <input
                    type="file"
                    id="liffCameraCapture"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <div className="flex gap-2">
                    <Label htmlFor="liffImageFile">
                      <Button variant="outline" size="sm" asChild className="cursor-pointer">
                        <span><Upload className="size-3.5 mr-1" />เลือกรูป</span>
                      </Button>
                    </Label>
                    <Label htmlFor="liffCameraCapture">
                      <Button variant="outline" size="sm" asChild className="cursor-pointer">
                        <span><Camera className="size-3.5 mr-1" />ถ่ายรูป</span>
                      </Button>
                    </Label>
                  </div>
                  {imageFile && <p className="text-xs text-muted-foreground truncate">{imageFile.name}</p>}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAiSuggest}
                    disabled={!imageFile || isAiSuggesting}
                  >
                    {isAiSuggesting ? (
                      <Loader2 className="size-4 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="size-4 mr-1" />
                    )}
                    AI เติมข้อมูล
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="partNumber" className="text-xs">รหัสอะไหล่</Label>
                  <Input id="partNumber" {...register("partNumber")} placeholder="เช่น SP-001" className="h-9 text-sm" />
                  {errors.partNumber && <p className="text-xs text-destructive">{errors.partNumber.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="partName" className="text-xs">ชื่ออะไหล่ *</Label>
                  <Input id="partName" {...register("partName")} placeholder="ชื่ออะไหล่" className="h-9 text-sm" />
                  {errors.partName && <p className="text-xs text-destructive">{errors.partName.message}</p>}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="description" className="text-xs">รายละเอียด</Label>
                <Textarea id="description" {...register("description")} placeholder="รายละเอียดเพิ่มเติม" className="text-sm" rows={2} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="categoryName" className="text-xs">หมวดหมู่</Label>
                  <Input id="categoryName" {...register("categoryName" as keyof FormValues)} placeholder="เช่น อุปกรณ์ไฟฟ้า" className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="subcategory" className="text-xs">หมวดหมู่ย่อย</Label>
                  <Input id="subcategory" {...register("subcategory")} placeholder="เช่น Contactor" className="h-9 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="location" className="text-xs">ที่เก็บ</Label>
                  <Input id="location" {...register("location")} placeholder="เช่น ชั้น A-1" className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="plant" className="text-xs">Block *</Label>
                  <input type="hidden" {...register("plant")} />
                  <Select value={selectedPlant || ""} onValueChange={(value) => setValue("plant", value, { shouldValidate: true })}>
                    <SelectTrigger id="plant">
                      <SelectValue placeholder="เลือก Block" />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOCK_OPTIONS.map((block) => (
                        <SelectItem key={block} value={block}>{block}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.plant && <p className="text-xs text-destructive">{errors.plant.message}</p>}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="buildingId" className="text-xs">อาคาร *</Label>
                <input type="hidden" {...register("buildingId")} />
                <Select value={selectedBuildingId || ""} onValueChange={(value) => setValue("buildingId", value, { shouldValidate: true })}>
                  <SelectTrigger id="buildingId">
                    <SelectValue placeholder="เลือกอาคาร" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUILDING_OPTIONS.map((building) => (
                      <SelectItem key={building.id} value={building.id}>{building.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.buildingId && <p className="text-xs text-destructive">{errors.buildingId.message}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="barcodeValue" className="text-xs">บาร์โค้ด</Label>
                <Input id="barcodeValue" {...register("barcodeValue")} placeholder="รหัสบาร์โค้ด (ถ้ามี)" className="h-9 text-sm" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium">ข้อมูลสต็อก</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="quantity" className="text-xs">จำนวน</Label>
                  <Input id="quantity" type="number" min="0" {...register("quantity")} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="minimumQuantity" className="text-xs">ขั้นต่ำ</Label>
                  <Input id="minimumQuantity" type="number" min="0" {...register("minimumQuantity")} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="unit" className="text-xs">หน่วย</Label>
                  <Input id="unit" {...register("unit")} placeholder="pcs" className="h-9 text-sm" />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Link href="/liff" className="flex-1">
              <Button variant="outline" type="button" className="w-full">
                ยกเลิก
              </Button>
            </Link>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
              บันทึก
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
