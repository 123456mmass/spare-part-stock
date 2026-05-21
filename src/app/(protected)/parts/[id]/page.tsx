"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchWithAuth as fetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toaster";
import {
  Package,
  ArrowLeft,
  QrCode,
  ArrowDownToLine,
  ArrowUpFromLine,
  Settings2,
  Edit,
  Upload,
} from "lucide-react";
import { formatDateTime, getStockStatus, getStockStatusLabel, cn } from "@/lib/utils";

interface Part {
  id: string;
  partNumber: string;
  partName: string;
  description: string | null;
  category: { id: string; name: string } | null;
  location: string | null;
  quantity: number;
  minimumQuantity: number;
  unit: string;
  imageUrl: string | null;
  qrCodeUrl: string | null;
  barcodeValue: string | null;
  movements: Movement[];
}

interface Movement {
  id: string;
  type: "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT";
  quantityBefore: number;
  quantityAfter: number;
  quantityChange: number;
  note: string | null;
  createdAt: string;
  user: { name: string };
}

export default function PartDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const [part, setPart] = useState<Part | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [stockType, setStockType] = useState<"STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT">("STOCK_IN");
  const [stockQuantity, setStockQuantity] = useState("");
  const [stockNote, setStockNote] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  interface EditData {
    partNumber?: string;
    partName?: string;
    description?: string;
    categoryId?: string;
    location?: string;
    minimumQuantity?: number;
    unit?: string;
    barcodeValue?: string;
  }
  const [editData, setEditData] = useState<EditData>({});
  const [isUploading, setIsUploading] = useState(false);

  const fetchPart = async () => {
    try {
      const response = await fetch(`/api/parts/${resolvedParams.id}`);
      if (response.ok) {
        const data = await response.json();
        setPart(data);
        setEditData({
          partNumber: data.partNumber,
          partName: data.partName,
          description: data.description || "",
          categoryId: data.category?.id,
          location: data.location || "",
          minimumQuantity: data.minimumQuantity,
          unit: data.unit,
          barcodeValue: data.barcodeValue || "",
        });
      } else {
        toast({ title: "ไม่พบอะไหล่นี้", variant: "destructive" });
        router.push("/parts");
      }
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

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
    fetchPart();
    fetchCategories();
  }, [resolvedParams.id]);

  const handleStockAction = async () => {
    if (!part || !stockQuantity) return;

    try {
      const response = await fetch("/api/movements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          partId: part.id,
          type: stockType,
          quantity: parseInt(stockQuantity),
          note: stockNote,
        }),
      });

      if (response.ok) {
        toast({
          title: "บันทึกสำเร็จ",
          description:
            stockType === "STOCK_IN"
              ? "รับเข้าสต็อกเรียบร้อย"
              : stockType === "STOCK_OUT"
              ? "จ่ายออกสต็อกเรียบร้อย"
              : "ปรับปรุงสต็อกเรียบร้อย",
        });
        setStockDialogOpen(false);
        setStockQuantity("");
        setStockNote("");
        fetchPart();
      } else {
        const error = await response.json();
        toast({ title: "เกิดข้อผิดพลาด", description: error.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    }
  };

  const handleUpdatePart = async () => {
    if (!part) return;

    try {
      const response = await fetch(`/api/parts/${part.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });

      if (response.ok) {
        toast({ title: "อัปเดตสำเร็จ" });
        setEditDialogOpen(false);
        fetchPart();
      } else {
        const error = await response.json();
        toast({ title: "เกิดข้อผิดพลาด", description: error.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!part || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/parts/${part.id}/upload-image`, {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        toast({ title: "อัปโหลดรูปสำเร็จ" });
        fetchPart();
      } else {
        const error = await response.json();
        toast({ title: "เกิดข้อผิดพลาด", description: error.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePart = async () => {
    if (!part || !confirm(`ยืนยันลบอะไหล่ "${part.partNumber}" ?`)) return;
    try {
      const response = await fetch(`/api/parts/${part.id}`, { method: "DELETE" });
      if (response.ok) {
        toast({ title: "ลบอะไหล่สำเร็จ" });
        router.push("/parts");
      } else {
        const error = await response.json();
        toast({ title: "เกิดข้อผิดพลาด", description: error.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!part) return null;

  const status = getStockStatus(part.quantity, part.minimumQuantity);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/parts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{part.partNumber}</h1>
          <p className="text-gray-500">{part.partName}</p>
        </div>
        <div className="flex gap-2">
          {part.qrCodeUrl && (
            <Link href={part.qrCodeUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <QrCode className="h-4 w-4 mr-2" />
                พิมพ์ QR
              </Button>
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            แก้ไข
          </Button>
          <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={handleDeletePart}>
            ลบ
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Image & QR */}
        <div className="space-y-6">
          {/* Image */}
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                {part.imageUrl ? (
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                    <img
                      src={part.imageUrl}
                      alt={part.partName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                    <Package className="h-20 w-20 text-gray-400" />
                  </div>
                )}
                <label className="absolute bottom-2 right-2">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                  />
                  <Button variant="secondary" size="sm" className="pointer-events-auto" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-1" />
                      {isUploading ? "กำลังอัปโหลด..." : "เปลี่ยนรูป"}
                    </span>
                  </Button>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* QR Code */}
          {part.qrCodeUrl && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">QR Code</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="bg-white p-4 rounded-lg border flex justify-center">
                  <img src={part.qrCodeUrl} alt="QR Code" className="h-40 w-40" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Barcode */}
          {part.barcodeValue && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">บาร์โค้ด</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="bg-white p-4 rounded-lg border flex flex-col items-center">
                  <img src={`/api/parts/${part.id}/barcode`} alt={part.barcodeValue} className="max-w-full h-auto" />
                  <p className="text-xs text-gray-500 mt-2 break-all text-center">{part.barcodeValue}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      const link = document.createElement("a");
                      link.href = `/api/parts/${part.id}/barcode`;
                      link.download = `barcode-${part.partNumber}.png`;
                      link.click();
                    }}
                  >
                    <ArrowDownToLine className="h-4 w-4 mr-1" />
                    ดาวน์โหลดบาร์โค้ด
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Middle Column - Info */}
        <div className="space-y-6">
          {/* Stock Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">ข้อมูลสต็อก</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">จำนวนคงเหลือ</span>
                <div className="text-right">
                  <span className="text-3xl font-bold">{part.quantity}</span>
                  <span className="text-gray-500 ml-1">{part.unit}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">ขั้นต่ำ</span>
                <span className="font-medium">{part.minimumQuantity} {part.unit}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">สถานะ</span>
                <Badge
                  variant={
                    status === "in-stock" ? "success" : status === "low-stock" ? "warning" : "danger"
                  }
                >
                  {getStockStatusLabel(status)}
                </Badge>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-3 gap-2 pt-4 border-t">
                <Dialog
                  open={stockDialogOpen && stockType === "STOCK_IN"}
                  onOpenChange={(open) => {
                    if (open) {
                      setStockType("STOCK_IN");
                      setStockDialogOpen(true);
                    } else {
                      setStockDialogOpen(false);
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-3"
                      onClick={() => {
                        setStockType("STOCK_IN");
                        setStockDialogOpen(true);
                      }}
                    >
                      <ArrowDownToLine className="h-5 w-5 mb-1 text-green-600" />
                      <span className="text-xs">รับเข้า</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>รับเข้าสต็อก</DialogTitle>
                      <DialogDescription>กรอกจำนวนที่ต้องการรับเข้า</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>จำนวน</Label>
                        <Input
                          type="number"
                          min="1"
                          value={stockQuantity}
                          onChange={(e) => setStockQuantity(e.target.value)}
                          placeholder="กรอกจำนวน"
                        />
                      </div>
                      <div>
                        <Label>หมายเหตุ</Label>
                        <Textarea
                          value={stockNote}
                          onChange={(e) => setStockNote(e.target.value)}
                          placeholder="หมายเหตุ (ถ้ามี)"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setStockDialogOpen(false)}>
                        ยกเลิก
                      </Button>
                      <Button onClick={handleStockAction}>บันทึก</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog
                  open={stockDialogOpen && stockType === "STOCK_OUT"}
                  onOpenChange={(open) => {
                    if (open) {
                      setStockType("STOCK_OUT");
                      setStockDialogOpen(true);
                    } else {
                      setStockDialogOpen(false);
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-3"
                      onClick={() => {
                        setStockType("STOCK_OUT");
                        setStockDialogOpen(true);
                      }}
                    >
                      <ArrowUpFromLine className="h-5 w-5 mb-1 text-red-600" />
                      <span className="text-xs">จ่ายออก</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>จ่ายออกสต็อก</DialogTitle>
                      <DialogDescription>กรอกจำนวนที่ต้องการจ่ายออก</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>จำนวน</Label>
                        <Input
                          type="number"
                          min="1"
                          max={part.quantity}
                          value={stockQuantity}
                          onChange={(e) => setStockQuantity(e.target.value)}
                          placeholder="กรอกจำนวน"
                        />
                      </div>
                      <div>
                        <Label>หมายเหตุ</Label>
                        <Textarea
                          value={stockNote}
                          onChange={(e) => setStockNote(e.target.value)}
                          placeholder="หมายเหตุ (ถ้ามี)"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setStockDialogOpen(false)}>
                        ยกเลิก
                      </Button>
                      <Button onClick={handleStockAction}>บันทึก</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog
                  open={stockDialogOpen && stockType === "ADJUSTMENT"}
                  onOpenChange={(open) => {
                    if (open) {
                      setStockType("ADJUSTMENT");
                      setStockDialogOpen(true);
                    } else {
                      setStockDialogOpen(false);
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-3"
                      onClick={() => {
                        setStockType("ADJUSTMENT");
                        setStockDialogOpen(true);
                      }}
                    >
                      <Settings2 className="h-5 w-5 mb-1 text-blue-600" />
                      <span className="text-xs">ปรับปรุง</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>ปรับปรุงสต็อก</DialogTitle>
                      <DialogDescription>ตั้งค่าจำนวนสต็อกใหม่</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>จำนวนใหม่</Label>
                        <Input
                          type="number"
                          min="0"
                          value={stockQuantity}
                          onChange={(e) => setStockQuantity(e.target.value)}
                          placeholder="กรอกจำนวนใหม่"
                        />
                      </div>
                      <div>
                        <Label>หมายเหตุ</Label>
                        <Textarea
                          value={stockNote}
                          onChange={(e) => setStockNote(e.target.value)}
                          placeholder="เหตุผลในการปรับปรุง"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setStockDialogOpen(false)}>
                        ยกเลิก
                      </Button>
                      <Button onClick={handleStockAction}>บันทึก</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">รายละเอียด</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">หมวดหมู่</span>
                <span>{part.category?.name || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ที่เก็บ</span>
                <span>{part.location || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">หน่วย</span>
                <span>{part.unit}</span>
              </div>
              {part.description && (
                <div className="pt-3 border-t">
                  <span className="text-gray-500 block mb-1">รายละเอียด</span>
                  <p className="text-sm">{part.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - History */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">ประวัติการเคลื่อนไหว</CardTitle>
            </CardHeader>
            <CardContent>
              {part.movements.length === 0 ? (
                <p className="text-center text-gray-500 py-8">ยังไม่มีการเคลื่อนไหว</p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {part.movements.map((movement) => (
                    <div
                      key={movement.id}
                      className={cn(
                        "p-3 rounded-lg border",
                        movement.type === "STOCK_IN"
                          ? "bg-green-50 border-green-200"
                          : movement.type === "STOCK_OUT"
                          ? "bg-red-50 border-red-200"
                          : "bg-blue-50 border-blue-200"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">
                          {movement.type === "STOCK_IN"
                            ? "รับเข้า"
                            : movement.type === "STOCK_OUT"
                            ? "จ่ายออก"
                            : "ปรับปรุง"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDateTime(movement.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">
                          {movement.quantityBefore} → {movement.quantityAfter}
                        </span>
                        <span
                          className={cn(
                            "font-bold",
                            movement.type === "STOCK_IN"
                              ? "text-green-600"
                              : movement.type === "STOCK_OUT"
                              ? "text-red-600"
                              : "text-blue-600"
                          )}
                        >
                          {movement.type === "STOCK_IN" ? "+" : movement.type === "STOCK_OUT" ? "" : ""}
                          {movement.quantityChange}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{movement.user.name}</p>
                      {movement.note && (
                        <p className="text-xs text-gray-400 mt-1 italic">{movement.note}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>แก้ไขอะไหล่</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>รหัสอะไหล่</Label>
                <Input
                  value={editData.partNumber || ""}
                  onChange={(e) => setEditData({ ...editData, partNumber: e.target.value })}
                />
              </div>
              <div>
                <Label>ชื่ออะไหล่</Label>
                <Input
                  value={editData.partName || ""}
                  onChange={(e) => setEditData({ ...editData, partName: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>รายละเอียด</Label>
              <Textarea
                value={editData.description || ""}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>หมวดหมู่</Label>
                <Select
                  value={editData.categoryId || ""}
                  onValueChange={(value) =>
                    setEditData({ ...editData, categoryId: value })
                  }
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
                <Label>ที่เก็บ</Label>
                <Input
                  value={editData.location || ""}
                  onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>ขั้นต่ำ</Label>
                <Input
                  type="number"
                  min="0"
                  value={editData.minimumQuantity || 0}
                  onChange={(e) =>
                    setEditData({ ...editData, minimumQuantity: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <Label>หน่วย</Label>
                <Input
                  value={editData.unit || ""}
                  onChange={(e) => setEditData({ ...editData, unit: e.target.value })}
                />
              </div>
              <div>
                <Label>บาร์โค้ด</Label>
                <Input
                  value={editData.barcodeValue || ""}
                  onChange={(e) => setEditData({ ...editData, barcodeValue: e.target.value })}
                  placeholder="ถ้ามี"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleUpdatePart}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile bottom padding */}
      <div className="h-20 md:hidden" />
    </div>
  );
}
