import { Skeleton } from "@/components/ui/skeleton";

export function PageLoadingSkeleton() {
  return (
    <div className="space-y-6 pb-10" aria-label="กำลังโหลดหน้า">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 bg-slate-200" />
          <Skeleton className="h-4 w-72 bg-slate-200" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg bg-slate-200" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <Skeleton className="mb-4 h-7 w-56 bg-slate-200" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <Skeleton className="mb-3 h-4 w-24 bg-slate-200" />
              <Skeleton className="h-8 w-20 bg-slate-200" />
              <Skeleton className="mt-3 h-3 w-32 bg-slate-200" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <Skeleton className="mb-4 h-36 w-full rounded-xl bg-slate-200" />
            <Skeleton className="mb-2 h-4 w-24 bg-slate-200" />
            <Skeleton className="h-5 w-3/4 bg-slate-200" />
            <div className="mt-4 flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full bg-slate-200" />
              <Skeleton className="h-6 w-24 rounded-full bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AppBootSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50" aria-label="กำลังโหลดระบบ">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white p-4 md:block">
        <div className="mb-8 flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl bg-slate-200" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 bg-slate-200" />
            <Skeleton className="h-3 w-24 bg-slate-200" />
          </div>
        </div>
        <div className="space-y-5">
          {Array.from({ length: 3 }).map((_, section) => (
            <div key={section} className="space-y-2">
              <Skeleton className="h-3 w-16 bg-slate-200" />
              {Array.from({ length: section === 1 ? 4 : 3 }).map((__, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl bg-slate-200" />
              ))}
            </div>
          ))}
        </div>
      </aside>
      <main className="min-h-screen p-4 pt-16 md:ml-64 md:p-6">
        <PageLoadingSkeleton />
      </main>
    </div>
  );
}
