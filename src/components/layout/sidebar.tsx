"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Scan,
  LogOut,
  Menu,
  X,
  FileUp,
  Tag,
  Building2,
  Users,
  KeyRound,
  Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const navigation = [
  { name: "แดชบอร์ด", href: "/dashboard", icon: LayoutDashboard },
  { name: "อะไหล่", href: "/parts", icon: Package },
  { name: "ประวัติสต็อก", href: "/movements", icon: ArrowLeftRight },
  { name: "สแกน QR", href: "/scan", icon: Scan },
  { name: "นำเข้า Excel", href: "/import", icon: FileUp },
  { name: "หมวดหมู่", href: "/categories", icon: Tag },
  { name: "บล็อก", href: "/blocks", icon: Building2, adminOnly: true },
  { name: "อาคาร", href: "/buildings", icon: Warehouse, adminOnly: true },
  { name: "จัดการผู้ใช้", href: "/users", icon: Users, adminOnly: true },
];

interface SidebarProps {
  userName: string;
  userRole: string;
  mustChangePassword?: boolean;
  onLogout: () => void;
}

export function Sidebar({ userName, userRole, mustChangePassword, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredNav = mustChangePassword
    ? []
    : navigation.filter((item) => !(item as { adminOnly?: boolean }).adminOnly || userRole === "ADMIN");

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden bg-white shadow-md rounded-lg border"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-gray-900 text-white transition-transform duration-300 md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-gray-800">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Package className="h-6 w-6 text-blue-400" />
            <span className="font-bold text-lg">SparePart</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-white hover:bg-gray-800"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-4">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        <div className="border-t border-gray-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
              <span className="text-sm font-medium">{userName.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-gray-400">{userRole === "ADMIN" ? "ผู้ดูแลระบบ" : "พนักงาน"}</p>
            </div>
          </div>
          <Link href="/settings/password">
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              <KeyRound className="mr-2 h-4 w-4" />
              เปลี่ยนรหัสผ่าน
            </Button>
          </Link>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-300 hover:bg-gray-800 hover:text-white"
            onClick={onLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            ออกจากระบบ
          </Button>
        </div>
      </aside>
    </>
  );
}
