"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchWithAuth as fetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
  building: { id: string; name: string } | null;
  subcategory: string | null;
  plant: string | null;
  isSpecialToolPart: boolean;
  location: string | null;
  quantity: number;
  minimumQuantity: number;
  unit: string;
  imageUrl: string | null;
  qrCodeUrl: string | null;
  barcodeValue: string | null;
  createdBy: string | null;
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

const STATUS_BADGE: Record<string, string> = {
  "in-stock": "bdg-green",
  "low-stock": "bdg-amber",
  "out-of-stock": "bdg-red",
};
const STATUS_DOT: Record<string, string> = {
  "in-stock": "bg-emerald-500",
  "low-stock": "bg-amber-500",
  "out-of-stock": "bg-red-500",
};
const STATUS_GLOW: Record<string, string> = {
  "in-stock": "#818cf8",
  "low-stock": "#fbbf24",
  "out-of-stock": "#f87171",
};
const MV_COLOR: Record<Movement["type"], { line: string; dot: string; ring: string; text: string; strong: string }> = {
  STOCK_IN: { line: "border-emerald-200", dot: "bg-emerald-500", ring: "ring-emerald-50", text: "text-emerald-700", strong: "text-emerald-600" },
  STOCK_OUT: { line: "border-red-200", dot: "bg-red-500", ring: "ring-red-50", text: "text-red-700", strong: "text-red-600" },
  ADJUSTMENT: { line: "border-blue-200", dot: "bg-blue-500", ring: "ring-blue-50", text: "text-blue-700", strong: "text-blue-600" },
};
function mvLabel(t: Movement["type"]) { return t === "STOCK_IN" ? "รับเข้า" : t === "STOCK_OUT" ? "จ่ายออก" : "ปรับปรุง"; }
function mvChange(t: Movement["type"], c: number) { return t === "STOCK_IN" ? `+${c}` : t === "STOCK_OUT" ? `−${Math.abs(c)}` : `${c >= 0 ? "+" : ""}${c}`; }

export default function PartDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const [part, setPart] = useState<Part | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [buildings, setBuildings] = useState<{ id: string; name: string }[]>([]);
  const [blocks, setBlocks] = useState<{ id: string; name: string }[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);
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
    subcategory?: string;
    plant?: string;
    isSpecialToolPart?: boolean;
    buildingId?: string;
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
          subcategory: data.subcategory || "",
          plant: data.plant || "",
          isSpecialToolPart: data.isSpecialToolPart || false,
          buildingId: data.building?.id || "",
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
      if (response.ok) setCategories(await response.json());
    } catch { /* Silent */ }
  };

  const fetchBuildings = async () => {
    try {
      const response = await fetch("/api/buildings");
      if (response.ok) setBuildings(await response.json());
    } catch { /* Silent */ }
  };

  const fetchBlocks = async () => {
    try {
      const response = await fetch("/api/blocks");
      if (response.ok) setBlocks(await response.json());
    } catch { /* Silent */ }
  };

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
      }
    } catch { /* Silent */ }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPart();
    fetchCategories();
    fetchBuildings();
    fetchBlocks();
    fetchCurrentUser();
  }, [resolvedParams.id]);

  const handleStockAction = async () => {
    if (!part || !stockQuantity) return;
    try {
      const response = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partId: part.id, type: stockType, quantity: parseInt(stockQuantity), note: stockNote }),
      });
      if (response.ok) {
        toast({
          title: "บันทึกสำเร็จ",
          description: stockType === "STOCK_IN" ? "รับเข้าสต็อกเรียบร้อย" : stockType === "STOCK_OUT" ? "จ่ายออกสต็อกเรียบร้อย" : "ปรับปรุงสต็อกเรียบร้อย",
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
    if (!editData.buildingId) {
      toast({ title: "กรุณาเลือกอาคาร", variant: "destructive" });
      return;
    }
    if (!editData.isSpecialToolPart && !editData.plant?.trim()) {
      toast({ title: "กรุณากรอก Block หรือเลือก Special Tool Part", variant: "destructive" });
      return;
    }
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
      const response = await fetch(`/api/parts/${part.id}/upload-image`, { method: "POST", body: formData });
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  if (!part) return null;

  const status = getStockStatus(part.quantity, part.minimumQuantity);
  const canEdit = currentUser?.role === "ADMIN" || part.createdBy === currentUser?.id;
  const levelPct = Math.min(100, Math.round((part.quantity / Math.max(part.minimumQuantity * 4, 1)) * 100));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/parts">
          <button type="button" className="icbtn mt-1" title="กลับ"><ArrowLeft className="h-5 w-5" /></button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{part.partName}</h1>
            <span className={`bdg ${STATUS_BADGE[status]}`}><span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />{getStockStatusLabel(status)}</span>
          </div>
          <p className="mono mt-1 text-sm text-slate-500">{part.partNumber}{part.barcodeValue ? ` · บาร์โค้ด ${part.barcodeValue}` : ""}</p>
        </div>
        <div className="flex gap-2">
          {part.qrCodeUrl && (
            <Link href={part.qrCodeUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm"><QrCode className="h-4 w-4 mr-1.5" />พิมพ์ QR</Button>
            </Link>
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}><Edit className="h-4 w-4 mr-1.5" />แก้ไข</Button>
          )}
          {canEdit && (
            <Button variant="danger" size="sm" onClick={handleDeletePart}>ลบ</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: image + QR + barcode */}
        <div className="space-y-6">
          <div className="pcard overflow-hidden">
            <div className="relative aspect-square bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
              <div className="glow" style={{ background: STATUS_GLOW[status] }} />
              {part.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={part.imageUrl} alt={part.partName} className="relative h-full w-full object-cover" />
              ) : (
                <Package className="relative h-20 w-20 text-slate-300" strokeWidth={1} />
              )}
              {canEdit && (
                <label className="absolute bottom-3 right-3">
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                  <Button variant="outline" size="sm" asChild className="pointer-events-auto">
                    <span><Upload className="h-3.5 w-3.5 mr-1" />{isUploading ? "กำลังอัปโหลด..." : "เปลี่ยนรูป"}</span>
                  </Button>
                </label>
              )}
            </div>
          </div>

          {part.qrCodeUrl && (
            <div className="pcard p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">QR Code</p>
                <a href={part.qrCodeUrl} download={`qr-${part.partNumber}.png`} className="text-xs font-medium text-slate-500 hover:text-slate-900">ดาวน์โหลด</a>
              </div>
              <div className="flex justify-center rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={part.qrCodeUrl} alt="QR Code" className="h-32 w-32" />
              </div>
            </div>
          )}

          {part.barcodeValue && (
            <div className="pcard p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">บาร์โค้ด</p>
              <div className="flex flex-col items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/parts/${part.id}/barcode`} alt={part.barcodeValue} className="max-w-full h-auto" />
                <p className="mono text-xs text-slate-500 mt-2 break-all text-center">{part.barcodeValue}</p>
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
                  <ArrowDownToLine className="h-4 w-4 mr-1" />ดาวน์โหลดบาร์โค้ด
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Middle: stock + details */}
        <div className="space-y-6">
          <div className="pcard pcard-pad space-y-4">
            <h3 className="text-base font-semibold text-slate-900">ข้อมูลสต็อก</h3>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-slate-500">จำนวนคงเหลือ</p>
                <p className="mt-0.5"><span className="tnum text-4xl font-bold text-slate-900">{part.quantity.toLocaleString()}</span><span className="ml-1.5 text-sm text-slate-500">{part.unit}</span></p>
              </div>
              <span className={`bdg ${STATUS_BADGE[status]}`}><span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />{getStockStatusLabel(status)}</span>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-slate-500">ระดับสต็อก</span>
                <span className="tnum text-slate-600">{part.quantity.toLocaleString()} / ขั้นต่ำ {part.minimumQuantity}</span>
              </div>
              <div className="bar"><span style={{ width: `${levelPct}%` }} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50/60 p-3 text-sm">
              <div><p className="text-xs text-slate-500">ขั้นต่ำ</p><p className="font-semibold tnum text-slate-900">{part.minimumQuantity} {part.unit}</p></div>
              <div><p className="text-xs text-slate-500">หน่วย</p><p className="font-semibold text-slate-900">{part.unit}</p></div>
            </div>

            {/* Stock actions */}
            <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
              <Dialog open={stockDialogOpen && stockType === "STOCK_IN"} onOpenChange={(open) => { if (open) { setStockType("STOCK_IN"); setStockDialogOpen(true); } else setStockDialogOpen(false); }}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex-col h-auto py-3 gap-1 hover:border-emerald-300 hover:bg-emerald-50/50" onClick={() => { setStockType("STOCK_IN"); setStockDialogOpen(true); }}>
                    <ArrowDownToLine className="h-5 w-5 text-emerald-600" /><span className="text-xs font-medium">รับเข้า</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>รับเข้าสต็อก</DialogTitle><DialogDescription>กรอกจำนวนที่ต้องการรับเข้า</DialogDescription></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div><Label>จำนวน</Label><Input type="number" min="1" className="mt-1" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} placeholder="กรอกจำนวน" /></div>
                    <div><Label>หมายเหตุ</Label><Textarea className="mt-1" value={stockNote} onChange={(e) => setStockNote(e.target.value)} placeholder="หมายเหตุ (ถ้ามี)" /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setStockDialogOpen(false)}>ยกเลิก</Button>
                    <Button variant="gold" onClick={handleStockAction}>บันทึก</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={stockDialogOpen && stockType === "STOCK_OUT"} onOpenChange={(open) => { if (open) { setStockType("STOCK_OUT"); setStockDialogOpen(true); } else setStockDialogOpen(false); }}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex-col h-auto py-3 gap-1 hover:border-red-300 hover:bg-red-50/50" onClick={() => { setStockType("STOCK_OUT"); setStockDialogOpen(true); }}>
                    <ArrowUpFromLine className="h-5 w-5 text-red-600" /><span className="text-xs font-medium">จ่ายออก</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>จ่ายออกสต็อก</DialogTitle><DialogDescription>กรอกจำนวนที่ต้องการจ่ายออก</DialogDescription></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div><Label>จำนวน</Label><Input type="number" min="1" max={part.quantity} className="mt-1" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} placeholder="กรอกจำนวน" /></div>
                    <div><Label>หมายเหตุ</Label><Textarea className="mt-1" value={stockNote} onChange={(e) => setStockNote(e.target.value)} placeholder="หมายเหตุ (ถ้ามี)" /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setStockDialogOpen(false)}>ยกเลิก</Button>
                    <Button variant="gold" onClick={handleStockAction}>บันทึก</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={stockDialogOpen && stockType === "ADJUSTMENT"} onOpenChange={(open) => { if (open) { setStockType("ADJUSTMENT"); setStockDialogOpen(true); } else setStockDialogOpen(false); }}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex-col h-auto py-3 gap-1 hover:border-blue-300 hover:bg-blue-50/50" onClick={() => { setStockType("ADJUSTMENT"); setStockDialogOpen(true); }}>
                    <Settings2 className="h-5 w-5 text-blue-600" /><span className="text-xs font-medium">ปรับปรุง</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>ปรับปรุงสต็อก</DialogTitle><DialogDescription>ตั้งค่าจำนวนสต็อกใหม่</DialogDescription></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div><Label>จำนวนใหม่</Label><Input type="number" min="0" className="mt-1" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} placeholder="กรอกจำนวนใหม่" /></div>
                    <div><Label>หมายเหตุ</Label><Textarea className="mt-1" value={stockNote} onChange={(e) => setStockNote(e.target.value)} placeholder="เหตุผลในการปรับปรุง" /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setStockDialogOpen(false)}>ยกเลิก</Button>
                    <Button variant="gold" onClick={handleStockAction}>บันทึก</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="pcard pcard-pad space-y-3">
            <h3 className="text-base font-semibold text-slate-900">รายละเอียด</h3>
            <div className="flex justify-between"><span className="text-slate-500">หมวดหมู่</span><span className="font-medium text-slate-900">{part.category?.name || "-"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">ประเภท</span><span className="font-medium text-slate-900">{part.subcategory || "-"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">อาคาร</span><span className="font-medium text-slate-900">{part.building?.name || "-"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Block</span><span className="font-medium text-slate-900">{part.isSpecialToolPart ? "Special Tool Part" : (part.plant || "-")}</span></div>
            {part.description && (
              <div className="pt-3 border-t border-slate-100">
                <p className="mb-1 text-xs text-slate-500">รายละเอียดเพิ่มเติม</p>
                <p className="text-sm text-slate-700">{part.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: history timeline */}
        <div>
          <div className="pcard flex h-full flex-col">
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-transparent px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">ประวัติการเคลื่อนไหว</h3>
              <p className="mt-0.5 text-xs text-slate-400">{part.movements.length} รายการล่าสุด</p>
            </div>
            <div className="max-h-[520px] space-y-0 overflow-y-auto p-5 scrollbar-thin">
              {part.movements.length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-8">ยังไม่มีการเคลื่อนไหว</p>
              ) : (
                part.movements.map((m, i) => {
                  const c = MV_COLOR[m.type];
                  const last = i === part.movements.length - 1;
                  return (
                    <div key={m.id} className={cn("relative border-l-2 pl-6", c.line, last ? "pb-0 border-l-transparent" : "pb-5")}>
                      <div className={cn("absolute -left-[5px] top-0 h-3 w-3 rounded-full ring-4", c.dot, c.ring)} />
                      <div className="flex items-center justify-between">
                        <span className={cn("text-sm font-semibold", c.text)}>{mvLabel(m.type)}</span>
                        <span className="text-[11px] text-slate-400">{formatDateTime(m.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 text-sm tnum text-slate-700">{m.quantityBefore} → <strong>{m.quantityAfter}</strong> <span className={cn("ml-1 font-bold", c.strong)}>{mvChange(m.type, m.quantityChange)}</span></p>
                      <p className="text-xs text-slate-500">{m.user.name}{m.note ? ` · ${m.note}` : ""}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>แก้ไขอะไหล่</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>รหัสอะไหล่</Label><Input className="mt-1" value={editData.partNumber || ""} onChange={(e) => setEditData({ ...editData, partNumber: e.target.value })} /></div>
              <div><Label>ชื่ออะไหล่</Label><Input className="mt-1" value={editData.partName || ""} onChange={(e) => setEditData({ ...editData, partName: e.target.value })} /></div>
            </div>
            <div><Label>รายละเอียด</Label><Textarea className="mt-1" value={editData.description || ""} onChange={(e) => setEditData({ ...editData, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>หมวดหมู่</Label>
                <Select value={editData.categoryId || ""} onValueChange={(value) => setEditData({ ...editData, categoryId: value })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="เลือกหมวดหมู่" /></SelectTrigger>
                  <SelectContent>{categories.map((cat) => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>อาคาร *</Label>
                <Select value={editData.buildingId || ""} onValueChange={(value) => setEditData({ ...editData, buildingId: value })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="เลือกอาคาร" /></SelectTrigger>
                  <SelectContent>{buildings.map((b) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Block {!editData.isSpecialToolPart && "*"}</Label>
                <Select value={editData.isSpecialToolPart ? "" : (editData.plant || "")} onValueChange={(value) => setEditData({ ...editData, plant: value })} disabled={!!editData.isSpecialToolPart}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={editData.isSpecialToolPart ? "— ใช้ร่วมทุก Block —" : "เลือก Block"} /></SelectTrigger>
                  <SelectContent>{blocks.map((b) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}</SelectContent>
                </Select>
                <label className="mt-1.5 flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={!!editData.isSpecialToolPart}
                    onChange={(e) => setEditData({ ...editData, isSpecialToolPart: e.target.checked, plant: e.target.checked ? "" : editData.plant })}
                    className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                  />
                  อะไหล่ใช้ร่วมทั้ง 2 Block (Special Tool Part)
                </label>
              </div>
              <div><Label>หมวดหมู่ย่อย</Label><Input className="mt-1" value={editData.subcategory || ""} onChange={(e) => setEditData({ ...editData, subcategory: e.target.value })} placeholder="ถ้ามี" /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>ขั้นต่ำ</Label><Input type="number" min="0" className="mt-1" value={editData.minimumQuantity || 0} onChange={(e) => setEditData({ ...editData, minimumQuantity: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>หน่วย</Label><Input className="mt-1" value={editData.unit || ""} onChange={(e) => setEditData({ ...editData, unit: e.target.value })} /></div>
              <div><Label>บาร์โค้ด</Label><Input className="mt-1" value={editData.barcodeValue || ""} onChange={(e) => setEditData({ ...editData, barcodeValue: e.target.value })} placeholder="ถ้ามี" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>ยกเลิก</Button>
            <Button variant="gold" onClick={handleUpdatePart}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="h-20 md:hidden" />
    </div>
  );
}
