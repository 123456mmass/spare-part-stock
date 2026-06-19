"use client";

import { useState, useEffect } from "react";
import { fetchWithAuth as fetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Building2, Pencil, Trash2, Plus } from "lucide-react";
import { PageTitle } from "@/components/layout";

interface BuildingInfo {
  id: string;
  name: string;
  sortOrder: number;
  partCount: number;
  totalQuantity: number;
}

const BAR_GRADIENTS = [
  "from-indigo-500 to-violet-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-pink-500 to-rose-600",
];

export default function BuildingsPage() {
  const { toast } = useToast();
  const [buildings, setBuildings] = useState<BuildingInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [renameTarget, setRenameTarget] = useState<BuildingInfo | null>(null);
  const [newName, setNewName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<BuildingInfo | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newBuildingName, setNewBuildingName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchBuildings = async () => {
    try {
      const res = await fetch("/api/buildings");
      if (res.ok) setBuildings(await res.json());
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchBuildings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    if (!newBuildingName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/buildings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBuildingName.trim() }),
      });
      if (res.ok) {
        toast({ title: "สร้างอาคารสำเร็จ" });
        setCreateOpen(false);
        setNewBuildingName("");
        fetchBuildings();
      } else {
        const err = await res.json();
        toast({ title: "เกิดข้อผิดพลาด", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRename = async () => {
    if (!renameTarget || !newName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/buildings/${renameTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        toast({ title: "เปลี่ยนชื่ออาคารสำเร็จ" });
        setRenameTarget(null);
        setNewName("");
        fetchBuildings();
      } else {
        const err = await res.json();
        toast({ title: "เกิดข้อผิดพลาด", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/buildings/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: `ลบอาคาร "${deleteTarget.name}" สำเร็จ` });
        setDeleteTarget(null);
        fetchBuildings();
      } else {
        const err = await res.json();
        toast({ title: "เกิดข้อผิดพลาด", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageTitle
        title="อาคารที่เก็บ"
        description="จัดการอาคารที่เก็บอะไหล่ — ตั้งชื่อให้ตรงกับ Excel คอลัมน์ Location"
        action={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="gold" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                เพิ่มอาคาร
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>เพิ่มอาคารใหม่</DialogTitle>
                <DialogDescription>กรอกชื่ออาคารที่ต้องการเพิ่ม</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="newBuildingNameCreate">ชื่ออาคาร</Label>
                <Input id="newBuildingNameCreate" className="mt-1" value={newBuildingName} onChange={(e) => setNewBuildingName(e.target.value)} placeholder="ชื่ออาคาร" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>ยกเลิก</Button>
                <Button variant="gold" onClick={handleCreate} disabled={isSubmitting || !newBuildingName.trim()}>บันทึก</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open) { setRenameTarget(null); setNewName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เปลี่ยนชื่ออาคาร</DialogTitle>
            <DialogDescription>เปลี่ยนจาก &quot;{renameTarget?.name}&quot; ({renameTarget?.partCount} รายการ)</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="newBuildingName">ชื่อใหม่</Label>
            <Input id="newBuildingName" className="mt-1" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ชื่ออาคาร" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRenameTarget(null); setNewName(""); }}>ยกเลิก</Button>
            <Button variant="gold" onClick={handleRename} disabled={isSubmitting || !newName.trim()}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ลบอาคาร</DialogTitle>
            <DialogDescription>ลบอาคาร &quot;{deleteTarget?.name}&quot;</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-slate-600">ลบได้เฉพาะเมื่อไม่มีอะไหล่อยู่ในอาคารนี้</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>ลบ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bcard overflow-hidden animate-pulse"><div className="flex items-stretch"><div className="w-1.5 shrink-0 bg-slate-200" /><div className="flex-1 p-4"><div className="h-8 w-2/3 bg-slate-200 rounded" /></div></div></div>
          ))}
        </div>
      ) : buildings.length === 0 ? (
        <div className="pcard pcard-pad py-10 text-center">
          <Building2 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500">ยังไม่มีอาคาร</p>
          <Button variant="gold" className="mt-4" onClick={() => setCreateOpen(true)}>เพิ่มอาคารแรก</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {buildings.map((building, idx) => (
            <div key={building.id} className="bcard overflow-hidden">
              <div className="flex items-stretch">
                <div className={`w-1.5 shrink-0 bg-gradient-to-b ${BAR_GRADIENTS[idx % BAR_GRADIENTS.length]}`} />
                <div className="flex flex-1 items-center justify-between p-4 relative z-[1]">
                  <div className="flex items-center gap-3">
                    <div className="bicon flex h-10 w-10 items-center justify-center rounded-lg">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{building.name}</p>
                      <p className="text-sm text-slate-500">
                        <span className="tnum">{building.partCount.toLocaleString("th-TH")}</span> รายการ · <span className="tnum">{building.totalQuantity.toLocaleString("th-TH")}</span> ชิ้น
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" className="icbtn text-slate-400 hover:text-amber-600" title="เปลี่ยนชื่อ" onClick={() => { setRenameTarget(building); setNewName(building.name); }}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" className="icbtn text-slate-400 hover:text-red-600" title="ลบ" onClick={() => setDeleteTarget(building)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="h-20 md:hidden" />
    </div>
  );
}
