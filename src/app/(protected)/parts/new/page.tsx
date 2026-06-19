"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchWithAuth as fetch } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { ArrowLeft, Boxes, Camera, ImagePlus, Loader2, Package, Sparkles, Upload, X, Check, ChevronRight, ChevronLeft } from "lucide-react";
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

interface Category {
  id: string;
  name: string;
}

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
  isSpecialToolPart?: boolean;
  quantity?: number;
  minimumQuantity?: number;
  matchedCategoryName?: string;
  categoryName?: string;
  categoryId?: string;
}

export default function NewPartPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [buildings, setBuildings] = useState<{ id: string; name: string }[]>([]);
  const [blocks, setBlocks] = useState<{ id: string; name: string }[]>([]);

  const [step, setStep] = useState<WizardStep>("upload");
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedParts, setSavedParts] = useState<Array<{ partNumber: string; partName: string; ok: boolean; partId?: string }>>([]);

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

  const isSpecialToolPart = watch("isSpecialToolPart");
  const selectedPlant = watch("plant") || "";
  const selectedBuildingId = watch("buildingId");
  const selectedCategoryId = watch("categoryId");

  // Fetch lookup data
  useEffect(() => {
    fetch("/api/categories").then(async (r) => { if (r.ok) setCategories(await r.json()); }).catch(() => {});
    fetch("/api/buildings").then(async (r) => { if (r.ok) setBuildings(await r.json()); }).catch(() => {});
    fetch("/api/blocks").then(async (r) => { if (r.ok) setBlocks(await r.json()); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (isSpecialToolPart) setValue("plant", "");
  }, [isSpecialToolPart, setValue]);

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
        if (entry.analyzed) return entry;
        try {
          const formData = new FormData();
          formData.append("file", entry.file);
          const res = await fetch("/api/parts/ai-suggest", { method: "POST", body: formData });
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
    if (images.length === 0) return;
    setCurrentIndex(0);
    setStep("review");
    reset(images[0].formValues);
  }

  function saveCurrentForm() {
    const values = watch();
    setImages((prev) =>
      prev.map((entry, i) => (i === currentIndex ? { ...entry, formValues: values } : entry)),
    );
  }

  function nextImage() {
    saveCurrentForm();
    if (currentIndex < images.length - 1) {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      reset(images[next].formValues);
    } else {
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

  const onReviewSubmit = () => {
    nextImage();
  };

  // ── Submit all ──

  async function saveAll() {
    saveCurrentForm();
    setIsSubmitting(true);
    const results: Array<{ partNumber: string; partName: string; ok: boolean; partId?: string }> = [];

    for (let i = 0; i < images.length; i++) {
      const entry = images[i];
      const v = entry.formValues;

      const plantError = validatePlant(v);
      if (plantError) {
        results.push({ partNumber: v.partNumber || "(ไม่มีรหัส)", partName: v.partName, ok: false });
        continue;
      }

      try {
        const res = await fetch("/api/parts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(v),
        });

        if (res.ok) {
          const part = await res.json();
          // Upload image
          const imgFormData = new FormData();
          imgFormData.append("file", entry.file);
          await fetch(`/api/parts/${part.id}/upload-image`, {
            method: "POST",
            body: imgFormData,
          }).catch(() => { /* best-effort */ });
          results.push({ partNumber: v.partNumber || part.partNumber, partName: v.partName, ok: true, partId: part.id });
        } else {
          results.push({ partNumber: v.partNumber || "(error)", partName: v.partName, ok: false });
        }
      } catch {
        results.push({ partNumber: v.partNumber || "(error)", partName: v.partName, ok: false });
      }
    }

    setSavedParts(results);
    setIsSubmitting(false);
    setStep("summary");

    const okCount = results.filter((r) => r.ok).length;
    if (okCount > 0) {
      toast({ title: `บันทึกสำเร็จ ${okCount}/${results.length} รายการ` });
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <section className="page-header relative overflow-hidden rounded-xl px-5 py-5 sm:px-7">
        <div className="page-header-accent" aria-hidden />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="shrink-0 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <Link href="/parts"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-amber-200/80">New Part</p>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                {step === "upload" && "เพิ่มอะไหล่ใหม่"}
                {step === "review" && `ตรวจสอบ (${currentIndex + 1}/${images.length})`}
                {step === "summary" && "สรุปการบันทึก"}
              </h1>
              <p className="text-sm text-slate-300/90">
                {step === "upload" && `เพิ่มได้สูงสุด ${MAX_IMAGES} รูป — AI วิเคราะห์ทีเดียว`}
                {step === "review" && "ตรวจสอบข้อมูลแต่ละรูปก่อนบันทึก"}
                {step === "summary" && "กดบันทึกเพื่อสร้างอะไหล่ทั้งหมด"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <ImagePlus className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-semibold text-slate-900">รูปอะไหล่</h3>
              </div>
              <span className="text-xs text-slate-500">{images.length}/{MAX_IMAGES}</span>
            </div>

            {/* Thumbnail grid */}
            {images.length > 0 && (
              <div className="grid grid-cols-5 gap-3 mb-4">
                {images.map((entry, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={entry.preview} alt={`รูป ${i + 1}`} className="w-full h-full object-cover" />
                    {entry.analyzed && (
                      <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute bottom-1 right-1 bg-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add buttons */}
            {images.length < MAX_IMAGES && (
              <div className="flex gap-3">
                <input type="file" id="imageFile" accept="image/*" multiple onChange={(e) => addFiles(e.target.files)} className="hidden" />
                <input type="file" id="cameraCapture" accept="image/*" capture="environment" onChange={(e) => addFiles(e.target.files)} className="hidden" />
                <Label htmlFor="imageFile" className="flex-1 cursor-pointer">
                  <Button variant="outline" asChild className="w-full">
                    <span><Upload className="h-4 w-4 mr-1.5" />เลือกรูป</span>
                  </Button>
                </Label>
                <Label htmlFor="cameraCapture" className="flex-1 cursor-pointer">
                  <Button variant="gold" asChild className="w-full">
                    <span><Camera className="h-4 w-4 mr-1.5" />ถ่ายรูป</span>
                  </Button>
                </Label>
              </div>
            )}

            {/* AI analyze */}
            {images.length > 0 && (
              <div className="mt-4 p-4 rounded-lg" style={{ background: "linear-gradient(160deg,#eef2ff,#ffffff)" }}>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">AI วิเคราะห์ทั้งหมด</p>
                    <p className="mt-0.5 text-xs text-slate-600">วิเคราะห์รูปทั้งหมดพร้อมกันแล้วเติมข้อมูลให้อัตโนมัติ</p>
                    <Button
                      type="button"
                      onClick={analyzeAll}
                      disabled={isAnalyzing || images.every((e) => e.analyzed)}
                      variant="dark"
                      size="sm"
                      className="mt-3"
                    >
                      {isAnalyzing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
                      {isAnalyzing ? "กำลังวิเคราะห์..." : "เริ่มวิเคราะห์"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {images.length > 0 && (
            <Button onClick={goToReview} className="w-full h-11" variant="gold">
              ถัดไป: ตรวจสอบข้อมูล
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      )}

      {/* ── Step 2: Review (per-image form) ── */}
      {step === "review" && (
        <form onSubmit={handleSubmit(onReviewSubmit)} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left: current image */}
            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-6 space-y-4">
                <Card className="overflow-hidden">
                  <div className="relative aspect-square bg-gradient-to-br from-slate-100 to-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={images[currentIndex]?.preview} alt="อะไหล่" className="absolute inset-0 h-full w-full object-contain bg-white" />
                    <div className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                      รูปที่ {currentIndex + 1}/{images.length}
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* Right: form */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-6">
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Package className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900">ข้อมูลอะไหล่</h3>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="partNumber">รหัสอะไหล่</Label>
                      <Input id="partNumber" {...register("partNumber")} placeholder="เช่น SP-001" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="partName">ชื่ออะไหล่ *</Label>
                      <Input id="partName" {...register("partName")} placeholder="ชื่ออะไหล่" className="mt-1" />
                      {errors.partName && <p className="text-sm text-red-500 mt-1">{errors.partName.message}</p>}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">รายละเอียด</Label>
                    <Textarea id="description" {...register("description")} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" className="mt-1" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="mb-1 block">หมวดหมู่</Label>
                      <Select
                        value={selectedCategoryId || ""}
                        onValueChange={(value) => {
                          if (value === "__new__") {
                            setValue("categoryId", "");
                          } else {
                            setValue("categoryId", value);
                            setValue("categoryName", "");
                          }
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="เลือกหมวดหมู่" /></SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                          <SelectItem value="__new__">+ สร้างหมวดหมู่ใหม่</SelectItem>
                        </SelectContent>
                      </Select>
                      {selectedCategoryId === "__new__" && (
                        <Input className="mt-2" placeholder="ชื่อหมวดหมู่ใหม่" {...register("categoryName")} />
                      )}
                    </div>
                    <div>
                      <Label className="mb-1 block">อาคาร *</Label>
                      <Select
                        value={selectedBuildingId || ""}
                        onValueChange={(value) => setValue("buildingId", value)}
                      >
                        <SelectTrigger><SelectValue placeholder="เลือกอาคาร" /></SelectTrigger>
                        <SelectContent>
                          {buildings.map((b) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.buildingId && <p className="text-sm text-red-500 mt-1">{errors.buildingId.message}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="plant">Block {!isSpecialToolPart && "*"}</Label>
                      <Select
                        value={isSpecialToolPart ? "" : selectedPlant}
                        onValueChange={(value) => setValue("plant", value)}
                        disabled={!!isSpecialToolPart}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder={isSpecialToolPart ? "— ใช้ร่วมทุก Block —" : "เลือก Block"} />
                        </SelectTrigger>
                        <SelectContent>
                          {blocks.map((b) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <label className="mt-1.5 flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" {...register("isSpecialToolPart")} className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400" />
                        อะไหล่ใช้ร่วมทั้ง 2 Block (Special Tool Part)
                      </label>
                    </div>
                    <div>
                      <Label htmlFor="subcategory">หมวดหมู่ย่อย</Label>
                      <Input id="subcategory" {...register("subcategory")} placeholder="เช่น Contactor, Breaker" className="mt-1" />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="barcodeValue">บาร์โค้ด</Label>
                    <Input id="barcodeValue" {...register("barcodeValue")} placeholder="รหัสบาร์โค้ด (ถ้ามี)" className="mt-1" />
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Boxes className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900">ข้อมูลสต็อก</h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="quantity">จำนวน</Label>
                    <Input id="quantity" type="number" min="0" {...register("quantity", { valueAsNumber: true })} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="minimumQuantity">ขั้นต่ำ</Label>
                    <Input id="minimumQuantity" type="number" min="0" {...register("minimumQuantity", { valueAsNumber: true })} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="unit">หน่วย</Label>
                    <Input id="unit" {...register("unit")} placeholder="เช่น pcs" className="mt-1" />
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={prevImage} disabled={currentIndex === 0} className="h-11">
              <ChevronLeft className="h-4 w-4 mr-1" />ก่อนหน้า
            </Button>
            <Button type="submit" variant="gold" className="flex-1 h-11">
              {currentIndex < images.length - 1 ? "ถัดไป" : "ดูสรุป"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </form>
      )}

      {/* ── Step 3: Summary ── */}
      {step === "summary" && (
        <div className="space-y-6">
          {!isSubmitting && savedParts.length === 0 && (
            <>
              <Card className="p-6">
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Package className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900">สรุป {images.length} รายการ</h3>
                </div>
                <div className="space-y-3">
                  {images.map((entry, i) => {
                    const v = entry.formValues;
                    const status = stockStatus(v.quantity);
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200">
                        <div className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={entry.preview} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-slate-900">{v.partName || "(ไม่มีชื่อ)"}</p>
                          <p className="text-xs text-slate-500 truncate">{v.partNumber || "-"}</p>
                        </div>
                        <div className={`text-sm font-medium flex-shrink-0 ${status.color}`}>
                          {status.label} {v.unit}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setStep("review"); setCurrentIndex(0); reset(images[0].formValues); }} className="h-11">
                  กลับแก้ไข
                </Button>
                <Button onClick={saveAll} variant="gold" className="flex-1 h-11">
                  <Check className="h-4 w-4 mr-1" />บันทึกทั้งหมด
                </Button>
              </div>
            </>
          )}

          {isSubmitting && (
            <Card className="p-12 text-center">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-amber-500 mb-4" />
              <p className="text-sm font-medium text-slate-900">กำลังบันทึก...</p>
              <p className="text-xs text-slate-500 mt-1">โปรดรอสักครู่</p>
            </Card>
          )}

          {!isSubmitting && savedParts.length > 0 && (
            <>
              <Card className="p-6">
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600">
                    <Check className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900">
                    บันทึกสำเร็จ {savedParts.filter((r) => r.ok).length}/{savedParts.length} รายการ
                  </h3>
                </div>
                <div className="space-y-2">
                  {savedParts.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {r.ok ? <Check className="h-4 w-4 text-green-600 flex-shrink-0" /> : <X className="h-4 w-4 text-red-600 flex-shrink-0" />}
                      <span className="flex-1 truncate text-slate-900">{r.partName}</span>
                      <span className="text-xs text-slate-500">{r.partNumber}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => router.push("/parts")} className="flex-1 h-11">
                  ดูรายการอะไหล่
                </Button>
                {savedParts.filter((r) => r.ok).length === 1 && savedParts.find((r) => r.ok)?.partId && (
                  <Button variant="gold" onClick={() => router.push(`/parts/${savedParts.find((r) => r.ok)?.partId}`)} className="flex-1 h-11">
                    ดูอะไหล่ที่สร้าง
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
