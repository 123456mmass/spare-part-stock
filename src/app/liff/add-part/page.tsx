"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import liff from "@line/liff";
import { liffFetch } from "@/lib/liff-api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { ArrowLeft, Loader2, Sparkles, Camera, Upload, X, Check, ChevronRight, ChevronLeft, Package } from "lucide-react";
import {
  MAX_IMAGES,
  wizardFormSchema,
  EMPTY_FORM,
  readFileAsDataURL,
  applySuggestionToValues,
  stockStatus,
  validatePlant,
  type ImageEntry,
  type WizardFormValues,
  type WizardStep,
} from "@/lib/multi-image-wizard";

const BLOCK_OPTIONS = ["BLOCK 1", "BLOCK 2", "SPECIAL PART"] as const;
const BUILDING_OPTIONS = [
  { id: "cmppnrh1q0000rcrzhziogf8k", name: "ท.003" },
  { id: "cmpppo7wy0000j1rzph90nwhr", name: "ท.021" },
] as const;

interface PartSuggestion {
  partNumber?: string;
  partName?: string;
  description?: string;
  location?: string;
  unit?: string;
  barcodeValue?: string;
  subcategory?: string;
  plant?: string;
  buildingId?: string;
  quantity?: number;
  minimumQuantity?: number;
  matchedCategoryName?: string;
  categoryName?: string;
}

/* ── Skeleton ──────────────────────────────────────────────────── */

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

function FormSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <SkeletonLine className="h-4 w-24" />
        <SkeletonLine className="h-9 w-full" />
        <SkeletonLine className="h-4 w-16" />
        <SkeletonLine className="h-9 w-full" />
        <div className="grid grid-cols-2 gap-3">
          <SkeletonLine className="h-9 w-full" />
          <SkeletonLine className="h-9 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Main page ──────────────────────────────────────────────────── */

export default function LiffAddPartPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [step, setStep] = useState<WizardStep>("upload");
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedParts, setSavedParts] = useState<Array<{ partNumber: string; partName: string; ok: boolean }>>([]);

  // LINE session loading
  const [dataReady, setDataReady] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState("กำลังโหลดรูปจาก LINE...");
  const sessionLoadedRef = useRef(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<WizardFormValues>({
    resolver: zodResolver(wizardFormSchema),
    defaultValues: EMPTY_FORM,
  });

  const selectedPlant = watch("plant");
  const selectedBuildingId = watch("buildingId");

  // ── Load LINE image session ──
  useEffect(() => {
    const sid = searchParams.get("lineSid");
    if (!sid) {
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

        const dataUrl = payload.imageDataUrl as string | undefined;
        if (dataUrl) {
          try {
            const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              const mime = match[1] || "image/jpeg";
              const binary = atob(match[2]);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
              const file = new File([bytes], "line-image.jpg", { type: mime });
              const preview = await readFileAsDataURL(file);
              const s = (payload.suggestion || {}) as PartSuggestion;
              setImages([{
                file,
                preview,
                suggestion: payload.suggestion || null,
                formValues: { ...EMPTY_FORM, ...applySuggestionToValues(s) },
                analyzed: !!payload.suggestion,
              }]);
            }
          } catch {
            // user can still upload manually
          }
        }

        toast({ title: "โหลดรูปจาก LINE แล้ว", description: "กด \"AI วิเคราะห์\" หรือเพิ่มรูปอื่นได้" });
        if (!cancelled) setDataReady(true);
      })
      .catch((error) => {
        if (!cancelled) {
          toast({ title: "โหลดข้อมูลจาก LINE ไม่สำเร็จ", description: (error as Error).message, variant: "destructive" });
          setDataReady(true);
        }
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── Image management ──

  async function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const newFiles = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (newFiles.length === 0) {
      toast({ title: "ไม่พบไฟล์รูปภาพ", variant: "destructive" });
      return;
    }
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast({ title: `เพิ่มได้สูงสุด ${MAX_IMAGES} รูป`, variant: "destructive" });
      return;
    }
    const toAdd = newFiles.slice(0, remaining);
    if (newFiles.length > remaining) {
      toast({ title: `เพิ่มได้อีก ${remaining} รูปเท่านั้น`, variant: "destructive" });
    }

    const entries: ImageEntry[] = [];
    for (const file of toAdd) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: `${file.name} ใหญ่เกิน 5MB`, variant: "destructive" });
        continue;
      }
      const preview = await readFileAsDataURL(file);
      entries.push({ file, preview, suggestion: null, formValues: { ...EMPTY_FORM }, analyzed: false });
    }
    setImages((prev) => [...prev, ...entries]);
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  // ── AI analysis ──

  async function analyzeAll() {
    if (images.length === 0) return;
    setIsAnalyzing(true);
    let successCount = 0;
    const updated = await Promise.all(
      images.map(async (entry) => {
        if (entry.analyzed || !entry.file) return entry;
        const file = entry.file;
        try {
          const formData = new FormData();
          formData.append("file", file);
          const res = await liffFetch("/api/liff/parts/ai-suggest", { method: "POST", body: formData });
          const payload = await res.json();
          if (!res.ok) throw new Error(payload.error || "AI failed");
          const s = (payload.suggestion || {}) as PartSuggestion;
          successCount++;
          return {
            ...entry,
            suggestion: payload.suggestion || null,
            formValues: { ...EMPTY_FORM, ...applySuggestionToValues(s) },
            analyzed: true,
          };
        } catch {
          return { ...entry, analyzed: true };
        }
      }),
    );
    setImages(updated);
    setIsAnalyzing(false);
    if (successCount > 0) {
      toast({ title: `AI วิเคราะห์แล้ว ${successCount} รูป`, description: "ตรวจสอบข้อมูลแต่ละรูปก่อนบันทึก" });
    } else {
      toast({ title: "AI ไม่สามารถวิเคราะห์รูปได้", description: "กรอกข้อมูลด้วยตนเองได้", variant: "destructive" });
    }
  }

  // ── Review navigation ──

  function goToReview() {
    if (images.length === 0) {
      setImages([{ file: null, preview: null, suggestion: null, formValues: { ...EMPTY_FORM }, analyzed: true, isManual: true }]);
    }
    setCurrentIndex(0);
    setStep("review");
    reset(images[0]?.formValues ?? EMPTY_FORM);
  }

  function nextImage() {
    if (currentIndex < images.length - 1) {
      saveCurrentForm();
      const next = currentIndex + 1;
      setCurrentIndex(next);
      reset(images[next].formValues);
    } else {
      saveCurrentForm();
      setStep("summary");
    }
  }

  function prevImage() {
    if (currentIndex > 0) {
      saveCurrentForm();
      const prev = currentIndex - 1;
      setCurrentIndex(prev);
      reset(images[prev].formValues);
    }
  }

  function saveCurrentForm() {
    const values = watch();
    setImages((prev) =>
      prev.map((entry, i) => (i === currentIndex ? { ...entry, formValues: values } : entry)),
    );
  }

  // ── Submit all ──

  const onReviewSubmit = () => {
    saveCurrentForm();
    if (currentIndex < images.length - 1) {
      nextImage();
    } else {
      setStep("summary");
    }
  };

  async function saveAll() {
    saveCurrentForm();
    setIsSubmitting(true);
    const results: Array<{ partNumber: string; partName: string; ok: boolean }> = [];
    const sid = searchParams.get("lineSid");

    for (let i = 0; i < images.length; i++) {
      const entry = images[i];
      const v = entry.formValues;

      const plantError = validatePlant(v);
      if (plantError) {
        results.push({ partNumber: v.partNumber || "(ไม่มีรหัส)", partName: v.partName, ok: false });
        continue;
      }

      try {
        const res = await liffFetch("/api/liff/parts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(v),
        });

        if (res.ok) {
          const part = await res.json();
          if (entry.file) {
            const file = entry.file;
            const imgFormData = new FormData();
            imgFormData.append("file", file);
            await liffFetch(`/api/liff/parts/${part.id}/upload-image`, {
              method: "POST",
              body: imgFormData,
            }).catch(() => { /* best-effort */ });
          }
          results.push({ partNumber: v.partNumber || part.partNumber, partName: v.partName, ok: true });
        } else {
          results.push({ partNumber: v.partNumber || "(error)", partName: v.partName, ok: false });
        }
      } catch {
        results.push({ partNumber: v.partNumber || "(error)", partName: v.partName, ok: false });
      }
    }

    // Mark LINE session as saved
    if (sid) {
      await liffFetch(`/api/liff/line-image-sessions/${encodeURIComponent(sid)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "saved" }),
      }).catch(() => { /* best-effort */ });
    }

    setSavedParts(results);
    setIsSubmitting(false);
    setStep("summary");

    const okCount = results.filter((r) => r.ok).length;
    if (okCount > 0) {
      toast({ title: `บันทึกสำเร็จ ${okCount}/${results.length} รายการ` });
    }
  }

  function closeLiff() {
    try {
      liff.closeWindow();
    } catch {
      router.push("/liff");
    }
  }

  const sid = searchParams.get("lineSid");

  // ── Loading skeleton ──
  if (sid && !dataReady) {
    return (
      <div className="space-y-3">
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
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/liff">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-bold">
          {step === "upload" && "เพิ่มอะไหล่ใหม่"}
          {step === "review" && `ตรวจสอบ (${currentIndex + 1}/${images.length})`}
          {step === "summary" && "สรุปการบันทึก"}
        </h1>
      </div>

      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">รูปอะไหล่ (สูงสุด {MAX_IMAGES} รูป)</p>
                <span className="text-xs text-muted-foreground">{images.length}/{MAX_IMAGES}</span>
              </div>

              {/* Thumbnail grid */}
              {images.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {images.map((entry, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted group">
                      {entry.preview ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={entry.preview} alt={`รูป ${i + 1}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400"><Package className="size-6" /></div>
                      )}
                      {entry.analyzed && (
                        <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                          <Check className="size-3 text-white" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute bottom-1 right-1 bg-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="size-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add buttons */}
              {images.length < MAX_IMAGES && (
                <div className="flex gap-2">
                  <input
                    type="file"
                    id="liffImageFile"
                    accept="image/*"
                    multiple
                    onChange={(e) => addFiles(e.target.files)}
                    className="hidden"
                  />
                  <input
                    type="file"
                    id="liffCameraCapture"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => addFiles(e.target.files)}
                    className="hidden"
                  />
                  <Label htmlFor="liffImageFile" className="flex-1">
                    <Button variant="outline" size="sm" asChild className="cursor-pointer w-full">
                      <span><Upload className="size-3.5 mr-1" />เลือกรูป</span>
                    </Button>
                  </Label>
                  <Label htmlFor="liffCameraCapture" className="flex-1">
                    <Button variant="outline" size="sm" asChild className="cursor-pointer w-full">
                      <span><Camera className="size-3.5 mr-1" />ถ่ายรูป</span>
                    </Button>
                  </Label>
                </div>
              )}

              {/* AI analyze button */}
              {images.length > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={analyzeAll}
                  disabled={isAnalyzing || images.every((e) => e.analyzed)}
                >
                  {isAnalyzing ? (
                    <Loader2 className="size-4 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="size-4 mr-1" />
                  )}
                  {isAnalyzing ? "กำลังวิเคราะห์..." : "AI วิเคราะห์ทั้งหมด"}
                </Button>
              )}
            </CardContent>
          </Card>

          {images.length > 0 ? (
            <Button onClick={goToReview} className="w-full" size="lg">
              ถัดไป: ตรวจสอบข้อมูล
              <ChevronRight className="size-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={goToReview} className="w-full" variant="outline" size="lg">
              ไม่มีรูป ถัดไปกรอกข้อมูล
              <ChevronRight className="size-4 ml-1" />
            </Button>
          )}
        </div>
      )}

      {/* ── Step 2: Review (per-image form) ── */}
      {step === "review" && (
        <form onSubmit={handleSubmit(onReviewSubmit)} className="space-y-4">
          {/* Current image preview */}
          <Card className="overflow-hidden">
            <div className="relative aspect-[4/3] bg-muted flex items-center justify-center text-slate-400">
              {images[currentIndex]?.preview ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={images[currentIndex].preview} alt="อะไหล่" className="w-full h-full object-contain" />
              ) : (
                <div className="text-center">
                  <Package className="size-12 mx-auto mb-1 opacity-50" />
                  <span className="text-xs">ไม่มีรูป</span>
                </div>
              )}
              <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                รูปที่ {currentIndex + 1}/{images.length}
              </div>
            </div>
          </Card>

          {/* Form */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="partNumber" className="text-xs">รหัสอะไหล่</Label>
                  <Input id="partNumber" {...register("partNumber")} placeholder="เช่น SP-001" className="h-9 text-sm" />
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
                  <Input id="categoryName" {...register("categoryName")} placeholder="เช่น อุปกรณ์ไฟฟ้า" className="h-9 text-sm" />
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
                  <Select value={selectedPlant || ""} onValueChange={(val) => setValue("plant", val, { shouldValidate: true })}>
                    <SelectTrigger id="plant">
                      <SelectValue placeholder="เลือก Block" />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOCK_OPTIONS.map((block) => (
                        <SelectItem key={block} value={block}>{block}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="buildingId" className="text-xs">อาคาร *</Label>
                <input type="hidden" {...register("buildingId")} />
                <Select value={selectedBuildingId || ""} onValueChange={(val) => setValue("buildingId", val, { shouldValidate: true })}>
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

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="quantity" className="text-xs">จำนวน</Label>
                  <Input id="quantity" type="number" min="0" {...register("quantity", { valueAsNumber: true })} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="minimumQuantity" className="text-xs">ขั้นต่ำ</Label>
                  <Input id="minimumQuantity" type="number" min="0" {...register("minimumQuantity", { valueAsNumber: true })} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="unit" className="text-xs">หน่วย</Label>
                  <Input id="unit" {...register("unit")} placeholder="pcs" className="h-9 text-sm" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={prevImage} disabled={currentIndex === 0}>
              <ChevronLeft className="size-4 mr-1" />
              ก่อนหน้า
            </Button>
            <Button type="submit" className="flex-1">
              {currentIndex < images.length - 1 ? "ถัดไป" : "ดูสรุป"}
              <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </form>
      )}

      {/* ── Step 3: Summary ── */}
      {step === "summary" && (
        <div className="space-y-4">
          {!isSubmitting && savedParts.length === 0 && (
            <>
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-medium">สรุปทั้งหมด {images.length} รายการ</p>
                  {images.map((entry, i) => {
                    const v = entry.formValues;
                    const status = stockStatus(v.quantity);
                    return (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-slate-200">
                        <div className="w-12 h-12 rounded bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center text-slate-400">
                          {entry.preview ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={entry.preview} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Package className="size-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{v.partName || "(ไม่มีชื่อ)"}</p>
                          <p className="text-xs text-muted-foreground truncate">{v.partNumber || "-"}</p>
                        </div>
                        <div className={`text-sm font-medium flex-shrink-0 ${status.color}`}>
                          {status.label} {v.unit}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setStep("review"); setCurrentIndex(0); reset(images[0].formValues); }}>
                  กลับแก้ไข
                </Button>
                <Button onClick={saveAll} className="flex-1" size="lg">
                  <Check className="size-4 mr-1" />
                  บันทึกทั้งหมด
                </Button>
              </div>
            </>
          )}

          {isSubmitting && (
            <Card>
              <CardContent className="p-8 text-center">
                <Loader2 className="size-8 animate-spin mx-auto text-primary mb-3" />
                <p className="text-sm font-medium">กำลังบันทึก...</p>
                <p className="text-xs text-muted-foreground mt-1">โปรดรอสักครู่</p>
              </CardContent>
            </Card>
          )}

          {!isSubmitting && savedParts.length > 0 && (
            <>
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-medium">
                    บันทึกสำเร็จ {savedParts.filter((r) => r.ok).length}/{savedParts.length} รายการ
                  </p>
                  {savedParts.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {r.ok ? (
                        <Check className="size-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <X className="size-4 text-red-600 flex-shrink-0" />
                      )}
                      <span className="flex-1 truncate">{r.partName}</span>
                      <span className="text-xs text-muted-foreground">{r.partNumber}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Button onClick={closeLiff} className="w-full" size="lg">
                <Package className="size-4 mr-1" />
                เสร็จสิ้น
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
