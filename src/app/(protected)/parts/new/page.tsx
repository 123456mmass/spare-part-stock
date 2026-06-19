"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchWithAuth as fetch } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { partSchema } from "@/lib/validators";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { ArrowLeft, Boxes, Camera, ImagePlus, Loader2, Package, Sparkles, Upload } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface FormValues {
  partNumber: string;
  partName: string;
  quantity: number;
  minimumQuantity: number;
  unit: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  subcategory?: string;
  plant?: string;
  isSpecialToolPart?: boolean;
  buildingId?: string;
  barcodeValue?: string;
}

export default function NewPartPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [buildings, setBuildings] = useState<{ id: string; name: string }[]>([]);
  const [blocks, setBlocks] = useState<{ id: string; name: string }[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(partSchema) as any,
    defaultValues: {
      quantity: 0,
      minimumQuantity: 0,
      unit: "pcs",
      isSpecialToolPart: false,
    },
  });

  const isSpecialToolPart = watch("isSpecialToolPart");
  const selectedPlant = watch("plant") || "";

  useEffect(() => {
    if (isSpecialToolPart) {
      setValue("plant", "");
    }
  }, [isSpecialToolPart, setValue]);

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories");
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch {
      // Silent
    }
  };

  const fetchBuildings = async () => {
    try {
      const response = await fetch("/api/buildings");
      if (response.ok) {
        const data = await response.json();
        setBuildings(data);
      }
    } catch {
      // Silent
    }
  };

  const fetchBlocks = async () => {
    try {
      const response = await fetch("/api/blocks");
      if (response.ok) {
        const data = await response.json();
        setBlocks(data);
      }
    } catch {
      // Silent
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCategories();
    fetchBuildings();
    fetchBlocks();
  }, []);

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const part = await response.json();

        // Upload image if selected
        if (imageFile) {
          const imgFormData = new FormData();
          imgFormData.append("file", imageFile);
          await fetch(`/api/parts/${part.id}/upload-image`, {
            method: "POST",
            body: imgFormData,
          });
        }

        toast({ title: "สร้างอะไหล่สำเร็จ" });
        router.push(`/parts/${part.id}`);
      } else {
        const error = await response.json();
        toast({ title: "เกิดข้อผิดพลาด", description: error.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAiSuggest = async () => {
    if (!imageFile) {
      toast({ title: "Please choose an image first", variant: "destructive" });
      return;
    }

    setIsAiSuggesting(true);
    try {
      const formData = new FormData();
      formData.append("file", imageFile);
      const response = await fetch("/api/parts/ai-suggest", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "AI suggestion failed");
      }

      const suggestion = payload.suggestion || {};
      if (suggestion.partNumber) setValue("partNumber", suggestion.partNumber);
      if (suggestion.partName) setValue("partName", suggestion.partName);
      if (suggestion.description) setValue("description", suggestion.description);
      if (suggestion.unit) setValue("unit", suggestion.unit);
      if (suggestion.barcodeValue) setValue("barcodeValue", suggestion.barcodeValue);
      if (suggestion.subcategory) setValue("subcategory", suggestion.subcategory);
      if (Number.isFinite(suggestion.quantity)) setValue("quantity", suggestion.quantity);
      if (Number.isFinite(suggestion.minimumQuantity)) {
        setValue("minimumQuantity", suggestion.minimumQuantity);
      }
      if (suggestion.categoryId) {
        setSelectedCategoryId(suggestion.categoryId);
        setValue("categoryId", suggestion.categoryId);
      } else if (suggestion.matchedCategoryName || suggestion.categoryName) {
        // AI suggested a category name — send it so API auto-creates
        const catName = suggestion.matchedCategoryName || suggestion.categoryName;
        setValue("categoryName" as keyof FormValues, catName);
        // Check if it exists in loaded categories
        const existing = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
        if (existing) {
          setSelectedCategoryId(existing.id);
          setValue("categoryId", existing.id);
        } else {
          setSelectedCategoryId("__new__");
        }
      }

      toast({
        title: "AI filled part details",
        description: suggestion.notes || "Review the values before saving.",
      });
    } catch (error) {
      toast({
        title: "AI suggestion failed",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setIsAiSuggesting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Hero header */}
        <section className="page-header relative overflow-hidden rounded-xl px-5 py-5 sm:px-7">
          <div className="page-header-accent" aria-hidden />
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="shrink-0 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <Link href="/parts">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-amber-200/80">New Part</p>
                <h1 className="text-2xl font-semibold tracking-tight text-white">เพิ่มอะไหล่ใหม่</h1>
                <p className="text-sm text-slate-300/90">กรอกข้อมูล หรืออัปโหลดรูปให้ AI เติมให้อัตโนมัติ</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1.5 text-xs font-medium text-amber-200 ring-1 ring-inset ring-amber-400/30">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-300 text-[10px] font-bold text-slate-900">1</span>ข้อมูล
              </span>
              <span className="h-px w-6 bg-white/20" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400 ring-1 ring-inset ring-white/10">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-slate-400">2</span>สต็อก
              </span>
              <span className="h-px w-6 bg-white/20" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400 ring-1 ring-inset ring-white/10">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-slate-400">3</span>รูป
              </span>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: image + AI (sticky) */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-6 space-y-4">
              <Card className="overflow-hidden">
                <div className="relative aspect-square bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center text-center p-6">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="absolute inset-0 h-full w-full object-contain bg-white" />
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 mb-3">
                        <ImagePlus className="h-8 w-8 text-amber-600" />
                      </div>
                      <p className="font-semibold text-slate-900">ลากรูปมาวาง</p>
                      <p className="text-xs text-slate-500 mb-4">หรือเลือก/ถ่ายรูป · PNG, JPG</p>
                    </div>
                  )}
                </div>
                <div className="border-t border-slate-100 bg-white px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <input type="file" id="imageFile" accept="image/*" onChange={handleImageChange} className="hidden" />
                    <input type="file" id="cameraCapture" accept="image/*" capture="environment" onChange={handleImageChange} className="hidden" />
                    <Label htmlFor="imageFile" className="cursor-pointer">
                      <Button variant="outline" size="sm" asChild>
                        <span><Upload className="h-4 w-4 mr-1.5" />เลือกรูป</span>
                      </Button>
                    </Label>
                    <Label htmlFor="cameraCapture" className="cursor-pointer">
                      <Button variant="gold" size="sm" asChild>
                        <span><Camera className="h-4 w-4 mr-1.5" />ถ่ายรูป</span>
                      </Button>
                    </Label>
                  </div>
                  {imageFile && <p className="text-center text-xs text-slate-600 mt-2 truncate max-w-full">{imageFile.name}</p>}
                </div>
              </Card>

              <Card className="p-4" style={{ background: "linear-gradient(160deg,#eef2ff,#ffffff)" }}>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">AI เติมข้อมูลจากรูป</p>
                    <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                      อัปโหลดรูปแล้วให้ AI วิเคราะห์และเติมรหัส ชื่อ หมวดหมู่ และบาร์โค้ดให้อัตโนมัติ
                    </p>
                    <Button
                      type="button"
                      onClick={handleAiSuggest}
                      disabled={!imageFile || isAiSuggesting}
                      variant="dark"
                      size="sm"
                      className="mt-3"
                    >
                      {isAiSuggesting ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-1.5" />
                      )}
                      เริ่มวิเคราะห์รูป
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Right: forms */}
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
                    <Label htmlFor="partNumber">รหัสอะไหล่ *</Label>
                    <Input id="partNumber" {...register("partNumber")} placeholder="เช่น SP-001" className="mt-1" />
                    {errors.partNumber && <p className="text-sm text-red-500 mt-1">{errors.partNumber.message}</p>}
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
                      value={selectedCategoryId}
                      onValueChange={(value) => {
                        setSelectedCategoryId(value);
                        if (value === "__new__") {
                          setValue("categoryId", "");
                        } else {
                          setValue("categoryId", value);
                          setValue("categoryName" as keyof FormValues, "");
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
                      <Input className="mt-2" placeholder="ชื่อหมวดหมู่ใหม่" {...register("categoryName" as keyof FormValues)} />
                    )}
                  </div>
                  <div>
                    <Label className="mb-1 block">อาคาร *</Label>
                    <Select
                      value={selectedBuildingId}
                      onValueChange={(value) => {
                        setSelectedBuildingId(value);
                        setValue("buildingId", value);
                      }}
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
                    {errors.plant && <p className="text-sm text-red-500 mt-1">{errors.plant.message}</p>}
                    <label className="mt-1.5 flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        {...register("isSpecialToolPart")}
                        className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                      />
                      อะไหล่ใช้ร่วมทั้ง 2 Block (Special Tool Part)
                    </label>
                  </div>
                  <div>
                    <Label htmlFor="subcategory">หมวดหมู่ย่อย</Label>
                    <Input id="subcategory" {...register("subcategory")} placeholder="เช่น Contactor, Breaker, Fuse, Relay" className="mt-1" />
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
                  <Input id="quantity" type="number" min="0" {...register("quantity")} className="mt-1" />
                  {errors.quantity && <p className="text-sm text-red-500 mt-1">{errors.quantity.message}</p>}
                </div>
                <div>
                  <Label htmlFor="minimumQuantity">ขั้นต่ำ</Label>
                  <Input id="minimumQuantity" type="number" min="0" {...register("minimumQuantity")} className="mt-1" />
                  {errors.minimumQuantity && <p className="text-sm text-red-500 mt-1">{errors.minimumQuantity.message}</p>}
                </div>
                <div>
                  <Label htmlFor="unit">หน่วย</Label>
                  <Input id="unit" {...register("unit")} placeholder="เช่น pcs, kg" className="mt-1" />
                  {errors.unit && <p className="text-sm text-red-500 mt-1">{errors.unit.message}</p>}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex gap-3">
          <Link href="/parts" className="flex-1">
            <Button variant="outline" type="button" className="w-full h-11">ยกเลิก</Button>
          </Link>
          <Button type="submit" variant="gold" className="flex-1 h-11" disabled={isSubmitting}>
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />กำลังบันทึก...</>
            ) : (
              "บันทึกอะไหล่"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
