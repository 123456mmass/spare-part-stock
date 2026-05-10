"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth as fetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toaster";
import { Plus, Edit2, KeyRound, Trash2, PowerOff, Power, Copy, Check } from "lucide-react";
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการผู้ใช้</h1>
          <p className="text-gray-500">จำนวน {users.length} คน</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          เพิ่มผู้ใช้
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500">กำลังโหลด...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-gray-500">ไม่พบผู้ใช้</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">ชื่อ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">ชื่อผู้ใช้</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">บทบาท</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">สถานะ</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">วันที่สร้าง</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">เคลื่อนไหว</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{user.name}</td>
                      <td className="px-4 py-3 text-gray-600">{user.username}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                          {user.role === "ADMIN" ? "ผู้ดูแล" : "พนักงาน"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={user.isActive ? "success" : "danger"}>
                          {user.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-500">{formatDate(user.createdAt)}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-500">{user._count.movements}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(user)} title="แก้ไข">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openReset(user)} title="รีเซ็ตรหัสผ่าน">
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          {user.isActive ? (
                            <Button variant="ghost" size="icon" onClick={() => openDeactivate(user)} title="ปิดใช้งาน">
                              <PowerOff className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" onClick={() => openActivate(user)} title="เปิดใช้งาน">
                              <Power className="h-4 w-4" />
                            </Button>
                          )}
                          {user._count.movements === 0 && (
                            <Button variant="ghost" size="icon" onClick={() => openDelete(user)} title="ลบถาวร" className="text-red-500 hover:text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
            <Button onClick={handleCreate} disabled={submitting}>สร้าง</Button>
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
            <p className="text-sm text-gray-600">
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
            <Button onClick={handleEdit} disabled={submitting}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>รีเซ็ตรหัสผ่าน</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">
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
          <p className="text-gray-600">
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
          <p className="text-gray-600">
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
          <p className="text-gray-600">
            ยืนยันการลบถาวร <strong>{deleteTarget?.name}</strong>?
            การกระทำนี้ไม่สามารถเลิกได้
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>ลบ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="h-20 md:hidden" />
    </div>
  );
}
