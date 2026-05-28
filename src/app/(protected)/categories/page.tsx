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
import { Plus, Tag, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout";

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
      <PageHeader
        title="หมวดหมู่"
        description={`จำนวน ${categories.length} หมวดหมู่`}
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-white text-indigo-700 hover:bg-indigo-50">
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
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="เช่น อะไหล่เครื่องจักร, อะไหล่ยานยนต์"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                ยกเลิก
              </Button>
              <Button onClick={handleCreateCategory}>บันทึก</Button>
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
            <p className="text-sm text-gray-600">
              {deleteTarget && deleteTarget._count.parts > 0
                ? `อะไหล่ ${deleteTarget._count.parts} รายการที่ใช้หมวดหมู่นี้จะถูกปลดหมวดหมู่ออก (อะไหล่ไม่ถูกลบ)`
                : "ไม่มีอะไหล่ใช้หมวดหมู่นี้"}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              ยกเลิก
            </Button>
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
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-16 bg-gray-200 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Tag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">ยังไม่มีหมวดหมู่</p>
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              เพิ่มหมวดหมู่แรก
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <Card key={category.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100">
                      <Tag className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">{category.name}</p>
                      <p className="text-sm text-gray-500">
                        {category._count.parts} รายการ
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-400 hover:text-red-600"
                    onClick={() => setDeleteTarget(category)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Mobile bottom padding */}
      <div className="h-20 md:hidden" />
    </div>
  );
}
