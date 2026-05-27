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
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toaster";
import { Building2, Pencil, Trash2, GitMerge } from "lucide-react";

interface BlockInfo {
  name: string;
  partCount: number;
}

export default function BlocksPage() {
  const { toast } = useToast();
  const [blocks, setBlocks] = useState<BlockInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [renameTarget, setRenameTarget] = useState<BlockInfo | null>(null);
  const [newName, setNewName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<BlockInfo | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [mergeTarget, setMergeTarget] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchBlocks = async () => {
    try {
      const res = await fetch("/api/blocks");
      if (res.ok) setBlocks(await res.json());
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchBlocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRename = async () => {
    if (!renameTarget || !newName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/blocks/${encodeURIComponent(renameTarget.name)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName: newName.trim() }),
      });
      if (res.ok) {
        toast({ title: "เปลี่ยนชื่อบล็อกสำเร็จ" });
        setRenameTarget(null);
        setNewName("");
        fetchBlocks();
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
      const res = await fetch(`/api/blocks/${encodeURIComponent(deleteTarget.name)}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: `ลบบล็อก "${deleteTarget.name}" สำเร็จ` });
        setDeleteTarget(null);
        fetchBlocks();
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

  const handleMerge = async () => {
    if (selectedSources.size < 2 || !mergeTarget.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/blocks/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceNames: Array.from(selectedSources),
          target: mergeTarget.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: `รวมบล็อกสำเร็จ (${data.updated} รายการ)` });
        setMergeOpen(false);
        setSelectedSources(new Set());
        setMergeTarget("");
        fetchBlocks();
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

  const toggleSource = (name: string) => {
    const next = new Set(selectedSources);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelectedSources(next);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">บล็อก / โรงงาน</h1>
          <p className="text-gray-500">จัดการบล็อก/โรงงาน {blocks.length} บล็อก</p>
        </div>
        {blocks.length >= 2 && (
          <Button variant="outline" onClick={() => setMergeOpen(true)}>
            <GitMerge className="h-4 w-4 mr-2" />
            รวมบล็อก
          </Button>
        )}
      </div>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open) { setRenameTarget(null); setNewName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เปลี่ยนชื่อบล็อก</DialogTitle>
            <DialogDescription>
              เปลี่ยนจาก &quot;{renameTarget?.name}&quot; ({renameTarget?.partCount} รายการ)
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="newBlockName">ชื่อใหม่</Label>
            <Input
              id="newBlockName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="ชื่อบล็อกใหม่"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRenameTarget(null); setNewName(""); }}>ยกเลิก</Button>
            <Button onClick={handleRename} disabled={isSubmitting || !newName.trim()}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ลบบล็อก</DialogTitle>
            <DialogDescription>
              ลบบล็อก &quot;{deleteTarget?.name}&quot; ({deleteTarget?.partCount} รายการ)
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            อะไหล่ {deleteTarget?.partCount} รายการจะถูกปลดบล็อกออก (อะไหล่ไม่ถูกลบ)
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>ลบบล็อก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge dialog */}
      <Dialog open={mergeOpen} onOpenChange={(open) => { if (!open) { setMergeOpen(false); setSelectedSources(new Set()); setMergeTarget(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>รวมบล็อก</DialogTitle>
            <DialogDescription>เลือกบล็อกต้นทาง (อย่างน้อย 2) และบล็อกเป้าหมาย</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-2 block">บล็อกต้นทาง</Label>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {blocks.map((b) => (
                  <label key={b.name} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSources.has(b.name)}
                      onChange={() => toggleSource(b.name)}
                      className="rounded"
                    />
                    {b.name} ({b.partCount} รายการ)
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="mergeTarget">บล็อกเป้าหมาย</Label>
              <Input
                id="mergeTarget"
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
                placeholder="ชื่อบล็อกที่จะรวมเข้า"
              />
            </div>
            {mergeTarget.trim() && blocks.some(b => b.name === mergeTarget.trim()) && (
              <p className="text-xs text-blue-600">
                บล็อก &quot;{mergeTarget.trim()}&quot; มีอยู่แล้ว จะถูกรวมเข้า
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMergeOpen(false); setSelectedSources(new Set()); setMergeTarget(""); }}>ยกเลิก</Button>
            <Button onClick={handleMerge} disabled={isSubmitting || selectedSources.size < 2 || !mergeTarget.trim()}>
              รวมบล็อก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blocks list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4"><div className="h-12 bg-gray-200 rounded" /></CardContent>
            </Card>
          ))}
        </div>
      ) : blocks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">ยังไม่มีบล็อก</p>
            <p className="text-sm text-gray-400 mt-1">บล็อกจะถูกสร้างเมื่อ import Excel พร้อมระบุบล็อก</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {blocks.map((block) => (
            <Card key={block.name}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-100">
                      <Building2 className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium">{block.name}</p>
                      <p className="text-sm text-gray-500">{block.partCount} รายการ</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-blue-600"
                      onClick={() => { setRenameTarget(block); setNewName(block.name); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-red-600"
                      onClick={() => setDeleteTarget(block)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
