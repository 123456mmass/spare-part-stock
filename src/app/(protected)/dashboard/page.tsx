import { requireAuth } from "@/lib/auth";
import { getStorageSummary } from "@/lib/storage-summary";
import { MobileAppPromoDialog } from "@/components/mobile-app-promo";
import { DashboardView } from "./dashboard-view";

export default async function DashboardPage() {
  const user = await requireAuth();
  const summary = await getStorageSummary();

  return (
    <>
    <DashboardView
      data={{
        userName: user.name ?? "ผู้ใช้",
        totals: summary.totals,
        buildings: summary.buildings,
        blockSummaries: summary.blockSummaries,
        recentMovements: summary.recentMovements.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        })),
      }}
    />
    <MobileAppPromoDialog />
    </>
  );
}
