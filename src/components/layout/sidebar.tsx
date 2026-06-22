"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  ScanLine,
  LogOut,
  Menu,
  X,
  Upload,
  Layers,
  Grid2x2,
  Building,
  Boxes,
  Users,
  Bot,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

type NavItem = { name: string; href: string; icon: typeof LayoutDashboard; adminOnly?: boolean };
type NavSection = { label: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    label: "ภาพรวม",
    items: [
      { name: "แดชบอร์ด", href: "/dashboard", icon: LayoutDashboard },
      { name: "AI Assistant", href: "/assistant", icon: Bot },
    ],
  },
  {
    label: "คลังอะไหล่",
    items: [
      { name: "อะไหล่", href: "/parts", icon: Package },
      { name: "ประวัติสต็อก", href: "/movements", icon: ArrowLeftRight },
      { name: "สแกน QR", href: "/scan", icon: ScanLine },
      { name: "นำเข้า Excel", href: "/import", icon: Upload },
    ],
  },
  {
    label: "จัดการ",
    items: [
      { name: "หมวดหมู่", href: "/categories", icon: Layers },
      { name: "บล็อก", href: "/blocks", icon: Grid2x2, adminOnly: true },
      { name: "อาคาร", href: "/buildings", icon: Building, adminOnly: true },
      { name: "จัดการผู้ใช้", href: "/users", icon: Users, adminOnly: true },
      { name: "ตั้งค่า", href: "/settings", icon: Settings },
    ],
  },
];

interface SidebarProps {
  userName: string;
  userRole: string;
  mustChangePassword?: boolean;
  onLogout: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ userName, userRole, mustChangePassword, onLogout, collapsed = false, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sections = mustChangePassword
    ? []
    : NAV_SECTIONS.map((s) => ({
        ...s,
        items: s.items.filter((item) => !item.adminOnly || userRole === "ADMIN"),
      })).filter((s) => s.items.length > 0);

  return (
    <>
      {/* Mobile header */}
      <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur border-b border-slate-200 flex items-center px-4 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="mr-3 text-slate-700 hover:bg-slate-100"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 text-amber-300">
            <Boxes className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold text-slate-900">SparePartStock</span>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "side fixed inset-y-0 left-0 z-50 flex w-64 flex-col text-slate-700 transition-all duration-300 md:translate-x-0",
          collapsed ? "md:w-16" : "md:w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className={cn("flex h-16 items-center gap-3 border-b border-slate-100", collapsed ? "px-3 md:justify-center" : "px-5")}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-amber-300 shadow-lg shadow-slate-900/20">
            <Boxes className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-semibold leading-tight tracking-tight text-slate-900">SparePartStock</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">North Bangkok</p>
            </div>
          )}
          <Button variant="ghost" size="icon" className="ml-auto md:hidden text-slate-500 hover:bg-slate-100" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("ml-auto hidden text-slate-500 hover:bg-slate-100 md:inline-flex", collapsed && "ml-0")}
            onClick={() => onCollapsedChange?.(!collapsed)}
            title={collapsed ? "แสดงเมนู" : "ซ่อนเมนู"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className={cn("flex-1 overflow-y-auto py-4 space-y-5 scrollbar-thin", collapsed ? "px-2" : "px-3")}>
          {sections.map((section) => (
            <div key={section.label}>
              {!collapsed && <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{section.label}</p>}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn("nav-item", collapsed && "justify-center px-0", isActive && "active")}
                      title={collapsed ? item.name : undefined}
                    >
                      <Icon className="ic h-[18px] w-[18px]" />
                      {!collapsed && <span>{item.name}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User card */}
        <div className="border-t border-slate-100 p-3">
          <div className={cn("flex items-center gap-3 rounded-xl bg-slate-50/80 p-2.5", collapsed && "justify-center")}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white">
              {userName.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{userName}</p>
                <p className="text-[11px] text-slate-500">{userRole === "ADMIN" ? "ผู้ดูแลระบบ" : "พนักงาน"}</p>
              </div>
            )}
            <button
              type="button"
              className={cn("icbtn text-slate-500 hover:text-red-600", collapsed && "hidden")}
              title="ออกจากระบบ"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
