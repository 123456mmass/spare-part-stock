"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { partSchema } from "@/lib/validators";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";

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
  location?: string;
  barcodeValue?: string;
}

export default function NewPartPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(partSchema) as any,
    defaultValues: {
      quantity: 0,
      minimumQuantity: 0,
      unit: "pcs",
    },
  });

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCategories();
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
      if (suggestion.location) setValue("location", suggestion.location);
      if (suggestion.unit) setValue("unit", suggestion.unit);
      if (suggestion.barcodeValue) setValue("barcodeValue", suggestion.barcodeValue);
      if (Number.isFinite(suggestion.quantity)) setValue("quantity", suggestion.quantity);
      if (Number.isFinite(suggestion.minimumQuantity)) {
        setValue("minimumQuantity", suggestion.minimumQuantity);
      }
      if (suggestion.categoryId) {
        setSelectedCategoryId(suggestion.categoryId);
        setValue("categoryId", suggestion.categoryId);
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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/parts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">เพิ่มอะไหล่ใหม่</h1>
          <p className="text-gray-500">กรอกข้อมูลอะไหล่ที่ต้องการเพิ่ม</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลอะไหล่</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="partNumber">รหัสอะไหล่ *</Label>
                <Input
                  id="partNumber"
                  {...register("partNumber")}
                  placeholder="เช่น SP-001"
                />
                {errors.partNumber && (
                  <p className="text-sm text-red-500 mt-1">{errors.partNumber.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="partName">ชื่ออะไหล่ *</Label>
                <Input
                  id="partName"
                  {...register("partName")}
                  placeholder="ชื่ออะไหล่"
                />
                {errors.partName && (
                  <p className="text-sm text-red-500 mt-1">{errors.partName.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="description">รายละเอียด</Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>หมวดหมู่</Label>
                <Select
                  value={selectedCategoryId}
                  onValueChange={(value) => {
                    setSelectedCategoryId(value);
                    setValue("categoryId", value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกหมวดหมู่" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="location">ที่เก็บ</Label>
                <Input
                  id="location"
                  {...register("location")}
                  placeholder="เช่น ชั้น A-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="barcodeValue">บาร์โค้ด</Label>
              <Input
                id="barcodeValue"
                {...register("barcodeValue")}
                placeholder="รหัสบาร์โค้ด (ถ้ามี)"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลสต็อก</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="quantity">จำนวน</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  {...register("quantity")}
                />
                {errors.quantity && (
                  <p className="text-sm text-red-500 mt-1">{errors.quantity.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="minimumQuantity">ขั้นต่ำ</Label>
                <Input
                  id="minimumQuantity"
                  type="number"
                  min="0"
                  {...register("minimumQuantity")}
                />
                {errors.minimumQuantity && (
                  <p className="text-sm text-red-500 mt-1">{errors.minimumQuantity.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="unit">หน่วย</Label>
                <Input
                  id="unit"
                  {...register("unit")}
                  placeholder="เช่น pcs, kg"
                />
                {errors.unit && (
                  <p className="text-sm text-red-500 mt-1">{errors.unit.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>รูปอะไหล่</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-gray-400 text-xs">ไม่มีรูป</span>
                )}
              </div>
              <div>
                <input
                  type="file"
                  id="imageFile"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <Label htmlFor="imageFile">
                  <Button variant="outline" size="sm" asChild className="cursor-pointer">
                    <span>เลือกรูป</span>
                  </Button>
                </Label>
                {imageFile && <p className="text-xs text-gray-500 mt-1">{imageFile.name}</p>}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={handleAiSuggest}
                  disabled={!imageFile || isAiSuggesting}
                >
                  {isAiSuggesting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  AI เติมข้อมูลจากรูป
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Link href="/parts" className="flex-1">
            <Button variant="outline" type="button" className="w-full">
              ยกเลิก
            </Button>
          </Link>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              "บันทึก"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
