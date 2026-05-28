"use client";

import { useState, useEffect } from "react";
import { fetchWithAuth as fetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { PageHeader } from "@/components/layout";

interface BuildingInfo {
  id: string;
  name: string;
  sortOrder: number;
  partCount: number;
  totalQuantity: number;
}

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
      <PageHeader
        title="อาคารที่เก็บ"
        description="จัดการอาคารที่เก็บอะไหล่ — ตั้งชื่อให้ตรงกับ Excel คอลัมน์ Location"
        action={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-white text-indigo-700 hover:bg-indigo-50">
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
              <Input
                id="newBuildingNameCreate"
                value={newBuildingName}
                onChange={(e) => setNewBuildingName(e.target.value)}
                placeholder="ชื่ออาคาร"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>ยกเลิก</Button>
              <Button onClick={handleCreate} disabled={isSubmitting || !newBuildingName.trim()}>บันทึก</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        }
      />

      <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open) { setRenameTarget(null); setNewName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เปลี่ยนชื่ออาคาร</DialogTitle>
            <DialogDescription>
              เปลี่ยนจาก &quot;{renameTarget?.name}&quot; ({renameTarget?.partCount} รายการ)
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="newBuildingName">ชื่อใหม่</Label>
            <Input
              id="newBuildingName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="ชื่ออาคาร"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRenameTarget(null); setNewName(""); }}>ยกเลิก</Button>
            <Button onClick={handleRename} disabled={isSubmitting || !newName.trim()}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ลบอาคาร</DialogTitle>
            <DialogDescription>
              ลบอาคาร &quot;{deleteTarget?.name}&quot;
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            ลบได้เฉพาะเมื่อไม่มีอะไหล่อยู่ในอาคารนี้
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>ลบ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4"><div className="h-16 bg-gray-200 rounded" /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {buildings.map((building, idx) => (
            <Card key={building.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-stretch">
                  <div
                    className={`w-1.5 shrink-0 ${
                      idx % 2 === 0
                        ? "bg-gradient-to-b from-indigo-500 to-violet-600"
                        : "bg-gradient-to-b from-emerald-500 to-teal-600"
                    }`}
                  />
                  <div className="flex flex-1 items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-indigo-50">
                        <Building2 className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{building.name}</p>
                        <p className="text-sm text-gray-500">
                          {building.partCount.toLocaleString("th-TH")} รายการ ·{" "}
                          {building.totalQuantity.toLocaleString("th-TH")} ชิ้น
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-blue-600"
                        onClick={() => { setRenameTarget(building); setNewName(building.name); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-red-600"
                        onClick={() => setDeleteTarget(building)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="h-20 md:hidden" />
    </div>
  );
}
