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
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toaster";
import { LayoutGrid, Pencil, Trash2, GitMerge } from "lucide-react";
import { PageTitle } from "@/components/layout";

interface BlockInfo {
  name: string;
  partCount: number;
}

const BAR_GRADIENTS = [
  "from-indigo-500 to-violet-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-pink-500 to-rose-600",
];

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
        body: JSON.stringify({ sourceNames: Array.from(selectedSources), target: mergeTarget.trim() }),
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
      <PageTitle
        title="บล็อก / โรงงาน"
        description={<>จัดการบล็อก <span className="tnum">{blocks.length}</span> รายการ</>}
        action={
          blocks.length >= 2 ? (
            <Button variant="outline" size="sm" onClick={() => setMergeOpen(true)}>
              <GitMerge className="h-4 w-4 mr-2" />
              รวมบล็อก
            </Button>
          ) : undefined
        }
      />

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open) { setRenameTarget(null); setNewName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เปลี่ยนชื่อบล็อก</DialogTitle>
            <DialogDescription>เปลี่ยนจาก &quot;{renameTarget?.name}&quot; ({renameTarget?.partCount} รายการ)</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="newBlockName">ชื่อใหม่</Label>
            <Input id="newBlockName" className="mt-1" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ชื่อบล็อกใหม่" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRenameTarget(null); setNewName(""); }}>ยกเลิก</Button>
            <Button variant="gold" onClick={handleRename} disabled={isSubmitting || !newName.trim()}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ลบบล็อก</DialogTitle>
            <DialogDescription>ลบบล็อก &quot;{deleteTarget?.name}&quot; ({deleteTarget?.partCount} รายการ)</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-slate-600">อะไหล่ {deleteTarget?.partCount} รายการจะถูกปลดบล็อกออก (อะไหล่ไม่ถูกลบ)</p>
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
              <div className="max-h-40 overflow-y-auto space-y-1 scrollbar-thin">
                {blocks.map((b) => (
                  <label key={b.name} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                    <input type="checkbox" checked={selectedSources.has(b.name)} onChange={() => toggleSource(b.name)} className="rounded" />
                    {b.name} ({b.partCount} รายการ)
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="mergeTarget">บล็อกเป้าหมาย</Label>
              <Input id="mergeTarget" className="mt-1" value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} placeholder="ชื่อบล็อกที่จะรวมเข้า" />
            </div>
            {mergeTarget.trim() && blocks.some(b => b.name === mergeTarget.trim()) && (
              <p className="text-xs text-amber-600">บล็อก &quot;{mergeTarget.trim()}&quot; มีอยู่แล้ว จะถูกรวมเข้า</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMergeOpen(false); setSelectedSources(new Set()); setMergeTarget(""); }}>ยกเลิก</Button>
            <Button variant="gold" onClick={handleMerge} disabled={isSubmitting || selectedSources.size < 2 || !mergeTarget.trim()}>รวมบล็อก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blocks list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bcard overflow-hidden animate-pulse"><div className="flex items-stretch"><div className="w-1.5 shrink-0 bg-slate-200" /><div className="flex-1 p-4"><div className="h-8 w-2/3 bg-slate-200 rounded" /></div></div></div>
          ))}
        </div>
      ) : blocks.length === 0 ? (
        <div className="pcard pcard-pad py-10 text-center">
          <LayoutGrid className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500">ยังไม่มีบล็อก</p>
          <p className="text-sm text-slate-400 mt-1">บล็อกจะถูกสร้างเมื่อ import Excel พร้อมระบุบล็อก</p>
        </div>
      ) : (
        <div className="space-y-3">
          {blocks.map((block, idx) => (
            <div key={block.name} className="bcard overflow-hidden">
              <div className="flex items-stretch">
                <div className={`w-1.5 shrink-0 bg-gradient-to-b ${BAR_GRADIENTS[idx % BAR_GRADIENTS.length]}`} />
                <div className="flex flex-1 items-center justify-between p-4 relative z-[1]">
                  <div className="flex items-center gap-3">
                    <div className="bicon flex h-10 w-10 items-center justify-center rounded-lg">
                      <LayoutGrid className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{block.name}</p>
                      <p className="text-sm text-slate-500"><span className="tnum">{block.partCount}</span> รายการ</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" className="icbtn text-slate-400 hover:text-amber-600" title="เปลี่ยนชื่อ" onClick={() => { setRenameTarget(block); setNewName(block.name); }}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" className="icbtn text-slate-400 hover:text-red-600" title="ลบ" onClick={() => setDeleteTarget(block)}>
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
