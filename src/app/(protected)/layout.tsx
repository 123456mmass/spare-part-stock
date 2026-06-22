"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { fetchWithAuth as fetch } from "@/lib/api";
import { Sidebar, BottomNav, AppBootSkeleton } from "@/components/layout";

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  mustChangePassword: boolean;
}

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        setUser(data.user);
      } catch {
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, [router]);

  useEffect(() => {
    if (user?.mustChangePassword && pathname !== "/settings/password") {
      router.replace("/settings/password?force=true");
    }
  }, [user, pathname, router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  };

  if (isLoading || !user) {
    return <AppBootSkeleton />;
  }

  if (user.mustChangePassword && pathname !== "/settings/password") {
    return <AppBootSkeleton />;
  }

  return (
    <div
      className="app-shell min-h-screen"
      style={{ "--sidebar-width": sidebarCollapsed ? "4rem" : "16rem" } as CSSProperties}
    >
      <Sidebar
        userName={user.name}
        userRole={user.role}
        mustChangePassword={user.mustChangePassword}
        onLogout={handleLogout}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      <main className="min-h-screen pb-20 transition-[margin] duration-300 md:ml-[var(--sidebar-width)] md:pb-0">
        <div className="pt-14 md:pt-0 p-4 md:p-6">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
