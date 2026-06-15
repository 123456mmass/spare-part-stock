"use client";

import { useEffect, useState, type FormEvent } from "react";
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
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";

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

export default function LiffAddPartPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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

  useEffect(() => {
    const sid = searchParams.get("lineSid");
    if (!sid) return;

    let cancelled = false;
    setIsLoadingDraft(true);
    liffFetch(`/api/liff/line-image-sessions/${encodeURIComponent(sid)}`)
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || "โหลดข้อมูลไม่สำเร็จ");
        if (cancelled) return;

        const s = payload.suggestion || {};
        const dataUrl = payload.imageDataUrl as string | undefined;
        setImagePreview(dataUrl || null);

        // Convert dataURL to File object so AI suggest button works
        if (dataUrl) {
          try {
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const file = new File([blob], "line-image.jpg", { type: blob.type || "image/jpeg" });
            setImageFile(file);
          } catch {
            // If conversion fails, user can still upload manually
          }
        }

        // Pre-fill from suggestion if available
        if (s.partNumber) setValue("partNumber", s.partNumber);
        if (s.partName) setValue("partName", s.partName);
        if (s.description) setValue("description", s.description);
        if (s.location) setValue("location", s.location);
        if (s.unit) setValue("unit", s.unit);
        if (s.barcodeValue) setValue("barcodeValue", s.barcodeValue);
        if (s.subcategory) setValue("subcategory", s.subcategory);
        if (s.plant && BLOCK_OPTIONS.includes(s.plant)) setValue("plant", s.plant);
        if (s.buildingId) setValue("buildingId", s.buildingId);
        if (Number.isFinite(s.quantity)) setValue("quantity", s.quantity);
        if (Number.isFinite(s.minimumQuantity)) setValue("minimumQuantity", s.minimumQuantity);
        if (s.matchedCategoryName || s.categoryName) {
          setValue("categoryName" as keyof FormValues, s.matchedCategoryName || s.categoryName);
        }

        // If suggestion has data, we're good. If not, auto-trigger AI.
        const hasSuggestion = s.partName || s.partNumber;
        if (!hasSuggestion && dataUrl) {
          toast({ title: "กำลังให้ AI วิเคราะห์รูป..." });
        } else {
          toast({ title: "โหลดข้อมูลจาก LINE แล้ว", description: "เลือก Block และอาคารก่อนบันทึก" });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast({ title: "โหลดข้อมูลจาก LINE ไม่สำเร็จ", description: (error as Error).message, variant: "destructive" });
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDraft(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams, setValue, toast]);

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
        }

        toast({ title: "สร้างอะไหล่สำเร็จ" });
        router.push("/liff");
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

  // Auto-trigger AI suggest when image is loaded from LINE session
  const [autoTriggered, setAutoTriggered] = useState(false);
  useEffect(() => {
    if (!imageFile || autoTriggered || isAiSuggesting) return;
    const sid = searchParams.get("lineSid");
    if (!sid) return; // Only auto-trigger for LINE session flow

    setAutoTriggered(true);
    handleAiSuggest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFile, autoTriggered, searchParams]);

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
      if (s.partNumber) setValue("partNumber", s.partNumber);
      if (s.partName) setValue("partName", s.partName);
      if (s.description) setValue("description", s.description);
      if (s.location) setValue("location", s.location);
      if (s.unit) setValue("unit", s.unit);
      if (s.barcodeValue) setValue("barcodeValue", s.barcodeValue);
      if (s.subcategory) setValue("subcategory", s.subcategory);
      if (Number.isFinite(s.quantity)) setValue("quantity", s.quantity);
      if (Number.isFinite(s.minimumQuantity)) setValue("minimumQuantity", s.minimumQuantity);
      if (s.matchedCategoryName || s.categoryName) {
        setValue("categoryName" as keyof FormValues, s.matchedCategoryName || s.categoryName);
      }

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

      {isLoadingDraft && (
        <Card>
          <CardContent className="p-3 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            กำลังโหลดข้อมูลจาก LINE...
          </CardContent>
        </Card>
      )}

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
                      <span>เลือกรูป</span>
                    </Button>
                  </Label>
                  <Label htmlFor="liffCameraCapture">
                    <Button variant="outline" size="sm" asChild className="cursor-pointer">
                      <span>📷 ถ่ายรูป</span>
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
    </div>
  );
}
