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
import { Plus, Tag, Trash2 } from "lucide-react";
import { PageTitle } from "@/components/layout";

interface Category {
  id: string;
  name: string;
  _count: { parts: number };
}

export default function CategoriesPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories?includeParts=true");
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });

      if (response.ok) {
        toast({ title: "สร้างหมวดหมู่สำเร็จ" });
        setDialogOpen(false);
        setNewCategoryName("");
        fetchCategories();
      } else {
        const error = await response.json();
        toast({ title: "เกิดข้อผิดพลาด", description: error.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/categories/${deleteTarget.id}`, { method: "DELETE" });
      if (response.ok) {
        toast({ title: `ลบหมวดหมู่ "${deleteTarget.name}" สำเร็จ` });
        setDeleteTarget(null);
        fetchCategories();
      } else {
        const error = await response.json();
        toast({ title: "เกิดข้อผิดพลาด", description: error.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        title="หมวดหมู่"
        description={<>จำนวน <span className="tnum">{categories.length}</span> หมวดหมู่</>}
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="gold" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                เพิ่มหมวดหมู่
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>เพิ่มหมวดหมู่ใหม่</DialogTitle>
                <DialogDescription>กรอกชื่อหมวดหมู่ที่ต้องการเพิ่ม</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="categoryName">ชื่อหมวดหมู่</Label>
                <Input
                  id="categoryName"
                  className="mt-1"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="เช่น อะไหล่เครื่องจักร, อะไหล่ยานยนต์"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
                <Button variant="gold" onClick={handleCreateCategory}>บันทึก</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ลบหมวดหมู่</DialogTitle>
            <DialogDescription>
              คุณต้องการลบหมวดหมู่ &quot;{deleteTarget?.name}&quot; ใช่หรือไม่?
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-slate-600">
              {deleteTarget && deleteTarget._count.parts > 0
                ? `อะไหล่ ${deleteTarget._count.parts} รายการที่ใช้หมวดหมู่นี้จะถูกปลดหมวดหมู่ออก (อะไหล่ไม่ถูกลบ)`
                : "ไม่มีอะไหล่ใช้หมวดหมู่นี้"}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>ยกเลิก</Button>
            <Button variant="destructive" onClick={handleDeleteCategory} disabled={isDeleting}>
              {isDeleting ? "กำลังลบ..." : "ลบหมวดหมู่"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Categories List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bcard p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-slate-200" />
                <div className="space-y-2"><div className="h-4 w-24 bg-slate-200 rounded" /><div className="h-3 w-16 bg-slate-200 rounded" /></div>
              </div>
            </div>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="pcard pcard-pad py-10 text-center">
          <Tag className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500">ยังไม่มีหมวดหมู่</p>
          <Button variant="gold" className="mt-4" onClick={() => setDialogOpen(true)}>เพิ่มหมวดหมู่แรก</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <div key={category.id} className="bcard p-4">
              <div className="flex items-center justify-between relative z-[1]">
                <div className="flex items-center gap-3">
                  <div className="bicon flex h-10 w-10 items-center justify-center rounded-lg">
                    <Tag className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{category.name}</p>
                    <p className="text-sm text-slate-500"><span className="tnum">{category._count.parts}</span> รายการ</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="icbtn text-slate-400 hover:text-red-600"
                  title="ลบหมวดหมู่"
                  onClick={() => setDeleteTarget(category)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="h-20 md:hidden" />
    </div>
  );
}
