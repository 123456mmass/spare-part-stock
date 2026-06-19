"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth as fetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toaster";
import { Plus, Edit2, KeyRound, Trash2, PowerOff, Power, Copy, Check, AlertTriangle } from "lucide-react";
import { PageTitle } from "@/components/layout";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface UserRow {
  id: string;
  username: string;
  name: string;
  role: "ADMIN" | "STAFF";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { movements: number };
}

interface CreateUserData {
  username: string;
  name: string;
  role: "ADMIN" | "STAFF";
}

interface EditUserData {
  name: string;
  role: "ADMIN" | "STAFF";
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function UsersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createData, setCreateData] = useState<CreateUserData>({ username: "", name: "", role: "STAFF" });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  // Temp password result dialog
  const [tempPasswordResult, setTempPasswordResult] = useState<{ username: string; name: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [editData, setEditData] = useState<EditUserData>({ name: "", role: "STAFF" });

  // Reset password dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);

  // Deactivate dialog
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<UserRow | null>(null);

  // Activate dialog
  const [activateOpen, setActivateOpen] = useState(false);
  const [activateTarget, setActivateTarget] = useState<UserRow | null>(null);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  // Clear DB dialog
  const [clearDbOpen, setClearDbOpen] = useState(false);
  const [clearDbData, setClearDbData] = useState({ categories: false, parts: false, movements: false, users: false });
  const [clearDbConfirm, setClearDbConfirm] = useState("");
  const [clearDbSubmitting, setClearDbSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        router.push("/dashboard");
        toast({ title: "ไม่มีสิทธิ์เข้าถึง", description: "คุณไม่มีสิทธิ์เข้าถึงหน้านี้", variant: "destructive" });
      }
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers();
  }, []);

  const handleCopyPassword = async () => {
    if (!tempPasswordResult) return;
    try {
      await navigator.clipboard.writeText(tempPasswordResult.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "ไม่สามารถคัดลอก", variant: "destructive" });
    }
  };

  // Create user
  const handleCreate = async () => {
    setSubmitting(true);
    setCreateErrors({});
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createData),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateErrors({ form: data.error || "เกิดข้อผิดพลาด" });
        return;
      }
      setCreateOpen(false);
      setCreateData({ username: "", name: "", role: "STAFF" });
      setTempPasswordResult({
        username: data.username,
        name: data.name,
        tempPassword: data.tempPassword,
      });
      fetchUsers();
    } catch {
      setCreateErrors({ form: "เกิดข้อผิดพลาด" });
    } finally {
      setSubmitting(false);
    }
  };

  // Edit user
  const openEdit = (user: UserRow) => {
    setEditTarget(user);
    setEditData({ name: user.name, role: user.role });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "เกิดข้อผิดพลาด", variant: "destructive" });
        return;
      }
      setEditOpen(false);
      setEditTarget(null);
      fetchUsers();
      toast({ title: "อัปเดตสำเร็จ" });
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Reset password
  const openReset = (user: UserRow) => {
    setResetTarget(user);
    setResetOpen(true);
  };

  const handleReset = async () => {
    if (!resetTarget) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${resetTarget.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "เกิดข้อผิดพลาด", variant: "destructive" });
        return;
      }
      setResetOpen(false);
      setTempPasswordResult({
        username: resetTarget.username,
        name: resetTarget.name,
        tempPassword: data.tempPassword,
      });
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Deactivate
  const openDeactivate = (user: UserRow) => {
    setDeactivateTarget(user);
    setDeactivateOpen(true);
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${deactivateTarget.id}/deactivate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "เกิดข้อผิดพลาด", variant: "destructive" });
        return;
      }
      setDeactivateOpen(false);
      setDeactivateTarget(null);
      fetchUsers();
      toast({ title: "ปิดใช้งานสำเร็จ" });
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Activate
  const openActivate = (user: UserRow) => {
    setActivateTarget(user);
    setActivateOpen(true);
  };

  const handleActivate = async () => {
    if (!activateTarget) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${activateTarget.id}/activate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "เกิดข้อผิดพลาด", variant: "destructive" });
        return;
      }
      setActivateOpen(false);
      setActivateTarget(null);
      fetchUsers();
      toast({ title: "เปิดใช้งานสำเร็จ" });
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete
  const openDelete = (user: UserRow) => {
    setDeleteTarget(user);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "เกิดข้อผิดพลาด", variant: "destructive" });
        return;
      }
      setDeleteOpen(false);
      setDeleteTarget(null);
      fetchUsers();
      toast({ title: "ลบผู้ใช้สำเร็จ" });
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Clear DB
  const handleClearDb = async () => {
    if (clearDbConfirm !== "ยืนยัน") {
      toast({ title: "กรุณาพิมพ์ ยืนยัน เพื่อยืนยันการลบข้อมูล", variant: "destructive" });
      return;
    }
    setClearDbSubmitting(true);
    try {
      const res = await fetch("/api/admin/clear-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clearDbData),
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: data.error || "เกิดข้อผิดพลาด", variant: "destructive" });
        return;
      }
      setClearDbOpen(false);
      setClearDbData({ categories: false, parts: false, movements: false, users: false });
      setClearDbConfirm("");
      fetchUsers();
      toast({ title: "ล้างฐานข้อมูลสำเร็จ" });
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    } finally {
      setClearDbSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        title="จัดการผู้ใช้"
        description={<><span className="tnum">{users.length}</span> คน</>}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" size="sm" onClick={() => setClearDbOpen(true)}>
              <AlertTriangle className="h-4 w-4 mr-2" />
              ล้างฐานข้อมูล
            </Button>
            <Button variant="gold" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              เพิ่มผู้ใช้
            </Button>
          </div>
        }
      />

      <div className="pcard overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">กำลังโหลด...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-slate-500">ไม่พบผู้ใช้</div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="text-left">ชื่อ</th>
                  <th className="text-left">ชื่อผู้ใช้</th>
                  <th className="text-center">บทบาท</th>
                  <th className="text-center">สถานะ</th>
                  <th className="text-center">วันที่สร้าง</th>
                  <th className="text-center">เคลื่อนไหว</th>
                  <th className="text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="font-medium">{user.name}</td>
                    <td className="mono text-slate-600">{user.username}</td>
                    <td className="text-center"><span className={`bdg ${user.role === "ADMIN" ? "bdg-indigo" : "bdg-slate"}`}>{user.role === "ADMIN" ? "ผู้ดูแล" : "พนักงาน"}</span></td>
                    <td className="text-center"><span className={`bdg ${user.isActive ? "bdg-green" : "bdg-red"}`}>{user.isActive ? "ใช้งาน" : "ปิดใช้งาน"}</span></td>
                    <td className="text-center text-slate-500">{formatDate(user.createdAt)}</td>
                    <td className="text-center text-slate-500 tnum">{user._count.movements}</td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" className="icbtn h-8 w-8" title="แก้ไข" onClick={() => openEdit(user)}><Edit2 className="h-4 w-4" /></button>
                        <button type="button" className="icbtn h-8 w-8" title="รีเซ็ตรหัสผ่าน" onClick={() => openReset(user)}><KeyRound className="h-4 w-4" /></button>
                        {user.isActive ? (
                          <button type="button" className="icbtn h-8 w-8" title="ปิดใช้งาน" onClick={() => openDeactivate(user)}><PowerOff className="h-4 w-4" /></button>
                        ) : (
                          <button type="button" className="icbtn h-8 w-8" title="เปิดใช้งาน" onClick={() => openActivate(user)}><Power className="h-4 w-4" /></button>
                        )}
                        {user._count.movements === 0 && (
                          <button type="button" className="icbtn h-8 w-8 text-red-500 hover:text-red-600" title="ลบถาวร" onClick={() => openDelete(user)}><Trash2 className="h-4 w-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่มผู้ใช้ใหม่</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {createErrors.form && (
              <p className="text-sm text-red-500">{createErrors.form}</p>
            )}
            <div>
              <label className="text-sm font-medium">ชื่อผู้ใช้</label>
              <Input
                value={createData.username}
                onChange={(e) => setCreateData({ ...createData, username: e.target.value })}
                placeholder="กรอกชื่อผู้ใช้"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">ชื่อ</label>
              <Input
                value={createData.name}
                onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                placeholder="กรอกชื่อ"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">บทบาท</label>
              <Select value={createData.role} onValueChange={(v) => setCreateData({ ...createData, role: v as "ADMIN" | "STAFF" })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">พนักงาน</SelectItem>
                  <SelectItem value="ADMIN">ผู้ดูแลระบบ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>ยกเลิก</Button>
            <Button variant="gold" onClick={handleCreate} disabled={submitting}>สร้าง</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temp Password Result Dialog */}
      <Dialog open={!!tempPasswordResult} onOpenChange={() => setTempPasswordResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>รหัสผ่านชั่วคราว</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              รหัสผ่านชั่วคราวสำหรับ <strong>{tempPasswordResult?.name}</strong> ({tempPasswordResult?.username})
            </p>
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <code className="flex-1 text-lg font-mono font-bold text-yellow-800">{tempPasswordResult?.tempPassword}</code>
              <Button variant="outline" size="sm" onClick={handleCopyPassword}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-red-600 font-medium">
              รหัสผ่านนี้จะแสดงเพียงครั้งเดียว กรุณาคัดลอกและแจ้งให้ผู้ใช้ทราบ
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setTempPasswordResult(null)}>ตกลง</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขผู้ใช้</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">ชื่อ</label>
              <Input
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">บทบาท</label>
              <Select value={editData.role} onValueChange={(v) => setEditData({ ...editData, role: v as "ADMIN" | "STAFF" })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">พนักงาน</SelectItem>
                  <SelectItem value="ADMIN">ผู้ดูแลระบบ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>ยกเลิก</Button>
            <Button variant="gold" onClick={handleEdit} disabled={submitting}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>รีเซ็ตรหัสผ่าน</DialogTitle>
          </DialogHeader>
          <p className="text-slate-600">
            ยืนยันการรีเซ็ตรหัสผ่านของ <strong>{resetTarget?.name}</strong>?
            ระบบจะสร้างรหัสผ่านชั่วคราวใหม่ให้ผู้ใช้
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleReset} disabled={submitting}>รีเซ็ต</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Dialog */}
      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ปิดใช้งานผู้ใช้</DialogTitle>
          </DialogHeader>
          <p className="text-slate-600">
            ยืนยันการปิดใช้งาน <strong>{deactivateTarget?.name}</strong>?
            ผู้ใช้จะไม่สามารถเข้าสู่ระบบได้อีก
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateOpen(false)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={handleDeactivate} disabled={submitting}>ปิดใช้งาน</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate Dialog */}
      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เปิดใช้งานผู้ใช้</DialogTitle>
          </DialogHeader>
          <p className="text-slate-600">
            ยืนยันการเปิดใช้งาน <strong>{activateTarget?.name}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleActivate} disabled={submitting}>เปิดใช้งาน</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ลบผู้ใช้ถาวร</DialogTitle>
          </DialogHeader>
          <p className="text-slate-600">
            ยืนยันการลบถาวร <strong>{deleteTarget?.name}</strong>?
            การกระทำนี้ไม่สามารถเลิกได้
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>ลบ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear DB Dialog */}
      <Dialog open={clearDbOpen} onOpenChange={setClearDbOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              ล้างฐานข้อมูล
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              เลือกข้อมูลที่ต้องการลบ (ไม่สามารถเลิกได้):
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearDbData.categories}
                  onChange={(e) => setClearDbData({ ...clearDbData, categories: e.target.checked })}
                  className="w-4 h-4"
                />
                <span>หมวดหมู่ (Categories)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearDbData.parts}
                  onChange={(e) => setClearDbData({ ...clearDbData, parts: e.target.checked })}
                  className="w-4 h-4"
                />
                <span>อะไหล่ (Parts)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearDbData.movements}
                  onChange={(e) => setClearDbData({ ...clearDbData, movements: e.target.checked })}
                  className="w-4 h-4"
                />
                <span>การเคลื่อนไหว (Movements)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearDbData.users}
                  onChange={(e) => setClearDbData({ ...clearDbData, users: e.target.checked })}
                  className="w-4 h-4"
                />
                <span>ผู้ใช้ (Users) — ยกเว้นบัญชีคุณ</span>
              </label>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                พิมพ์ <strong>ยืนยัน</strong> เพื่อยืนยันการลบข้อมูล
              </p>
              <Input
                value={clearDbConfirm}
                onChange={(e) => setClearDbConfirm(e.target.value)}
                placeholder="ยืนยัน"
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setClearDbOpen(false); setClearDbConfirm(""); }}>ยกเลิก</Button>
            <Button
              variant="destructive"
              onClick={handleClearDb}
              disabled={clearDbSubmitting || clearDbConfirm !== "ยืนยัน"}
            >
              {clearDbSubmitting ? "กำลังลบ..." : "ล้างฐานข้อมูล"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="h-20 md:hidden" />
    </div>
  );
}
