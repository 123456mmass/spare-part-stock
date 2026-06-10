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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden">
      <div className="flex items-center justify-around">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center py-2 text-xs",
                isActive ? "text-blue-600" : "text-gray-500"
              )}
            >
              <item.icon className={cn("h-5 w-5 mb-1", isActive && "text-blue-600")} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
