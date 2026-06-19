"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Scan,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "แดชบอร์ด", href: "/dashboard", icon: LayoutDashboard },
  { name: "AI", href: "/assistant", icon: Bot },
  { name: "อะไหล่", href: "/parts", icon: Package },
  { name: "สแกน", href: "/scan", icon: Scan },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-slate-200 md:hidden">
      <div className="flex items-center justify-around">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "relative flex flex-1 flex-col items-center py-2 text-xs font-medium transition-colors",
                isActive ? "text-amber-600" : "text-slate-500"
              )}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute top-0 h-[3px] w-8 rounded-b"
                  style={{ background: "linear-gradient(180deg,#e8d5a8,#d4b06a)" }}
                />
              )}
              <Icon className={cn("h-5 w-5 mb-1", isActive && "text-amber-600")} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
