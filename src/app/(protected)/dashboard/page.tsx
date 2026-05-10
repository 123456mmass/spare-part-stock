import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUserById } from "@/lib/auth";
import { formatDateTime, getStockStatus, getStockStatusLabel } from "@/lib/utils";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  AlertTriangle,
  ArrowUpDown,
  Scan,
  Plus,
  FileUp,
  Download,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function getDashboardStats() {
  const [totalParts, recentMovements, categoriesCount] = await Promise.all([
    prisma.part.count({ where: { isActive: true } }),
    prisma.stockMovement.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        part: { select: { partNumber: true, partName: true } },
        user: { select: { name: true } },
      },
    }),
    prisma.category.count(),
  ]);

  // Get parts below minimum quantity for low stock alert
  const lowStock = await prisma.part.findMany({
    where: {
      isActive: true,
      quantity: { gt: 0 },
      minimumQuantity: { gt: 0 },
    },
    select: {
      id: true,
      partNumber: true,
      partName: true,
      quantity: true,
      minimumQuantity: true,
    },
    orderBy: { quantity: "asc" },
    take: 5,
  });

  // Filter to only actual low stock
  const lowStockFiltered = lowStock.filter(p => p.quantity <= p.minimumQuantity);

  // Get out of stock parts
  const outOfStockCount = await prisma.part.count({
    where: {
      isActive: true,
      quantity: 0,
    },
  });

  // Get out of stock parts list for alert panel
  const outOfStockParts = await prisma.part.findMany({
    where: {
      isActive: true,
      quantity: 0,
    },
    select: {
      id: true,
      partNumber: true,
      partName: true,
      quantity: true,
      minimumQuantity: true,
    },
    orderBy: { partNumber: "asc" },
    take: 5,
  });

  // Combined critical items for alert panel (low stock + out of stock)
  const criticalItems = [
    ...outOfStockParts.map(p => ({ ...p, isOutOfStock: true as const })),
    ...lowStockFiltered.slice(0, 5 - outOfStockParts.length).map(p => ({ ...p, isOutOfStock: false as const })),
  ].slice(0, 5);

  return { totalParts, lowStockParts: lowStockFiltered.length, outOfStock: outOfStockCount, recentMovements, categoriesCount, criticalItems };
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const session = await getSession();
  const user = session ? await getUserById(session.userId) : null;
  const userName = user?.name || "User";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">แดชบอร์ด</h1>
          <p className="text-gray-500">ยินดีต้อนรับ {userName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/scan">
            <Button variant="outline" size="sm">
              <Scan className="h-4 w-4 mr-2" />
              สแกน QR
            </Button>
          </Link>
          <Link href="/parts/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              เพิ่มอะไหล่
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalParts}</p>
                <p className="text-xs text-gray-500">จำนวนอะไหล่ทั้งหมด</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Link href="/parts?stockStatus=low-stock" className="hover:shadow-md transition-shadow cursor-pointer">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.lowStockParts}</p>
                  <p className="text-xs text-gray-500">สินค้าใกล้หมด</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/parts?stockStatus=out-of-stock" className="hover:shadow-md transition-shadow cursor-pointer">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.outOfStock}</p>
                  <p className="text-xs text-gray-500">สินค้าหมด</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <ArrowUpDown className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.categoriesCount}</p>
                <p className="text-xs text-gray-500">หมวดหมู่</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">การดำเนินการด่วน</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/scan">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <Scan className="h-6 w-6" />
                <span className="text-xs">สแกน QR Code</span>
              </Button>
            </Link>
            <Link href="/parts/new">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <Plus className="h-6 w-6" />
                <span className="text-xs">เพิ่มอะไหล่ใหม่</span>
              </Button>
            </Link>
            <Link href="/import">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <FileUp className="h-6 w-6" />
                <span className="text-xs">นำเข้า Excel</span>
              </Button>
            </Link>
            <Link href="/movements">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <Download className="h-6 w-6" />
                <span className="text-xs">ส่งออกรายงาน</span>
              </Button>
            </Link>
            {user?.role === "ADMIN" && (
              <Link href="/users">
                <Button variant="outline" className="w-full h-20 flex-col gap-2">
                  <Users className="h-6 w-6" />
                  <span className="text-xs">จัดการผู้ใช้</span>
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Low Stock Alert */}
      {stats.criticalItems.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
              สินค้าที่ต้องระวัง
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.criticalItems.map((part) => {
                const status = getStockStatus(part.quantity, part.minimumQuantity);
                return (
                  <Link key={part.id} href={`/parts/${part.id}`}>
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-200 hover:border-amber-300 transition-colors">
                      <div>
                        <p className="font-medium text-gray-900">{part.partNumber}</p>
                        <p className="text-sm text-gray-500">{part.partName}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={part.isOutOfStock ? "danger" : "warning"}>
                          {part.quantity} / {part.minimumQuantity}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          {part.isOutOfStock ? "หมด" : "ใกล้หมด"}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">กิจกรรมล่าสุด</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentMovements.length === 0 ? (
            <p className="text-center text-gray-500 py-8">ยังไม่มีกิจกรรม</p>
          ) : (
            <div className="space-y-3">
              {stats.recentMovements.map((movement) => (
                <div
                  key={movement.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-full ${
                        movement.type === "STOCK_IN"
                          ? "bg-green-100"
                          : movement.type === "STOCK_OUT"
                          ? "bg-red-100"
                          : "bg-blue-100"
                      }`}
                    >
                      <ArrowUpDown
                        className={`h-4 w-4 ${
                          movement.type === "STOCK_IN"
                            ? "text-green-600"
                            : movement.type === "STOCK_OUT"
                            ? "text-red-600"
                            : "text-blue-600"
                        }`}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {movement.type === "STOCK_IN"
                          ? "รับเข้า"
                          : movement.type === "STOCK_OUT"
                          ? "จ่ายออก"
                          : "ปรับปรุง"}{" "}
                        {movement.part.partNumber}
                      </p>
                      <p className="text-xs text-gray-500">
                        {movement.user.name} • {formatDateTime(movement.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-medium ${
                        movement.type === "STOCK_IN"
                          ? "text-green-600"
                          : movement.type === "STOCK_OUT"
                          ? "text-red-600"
                          : "text-blue-600"
                      }`}
                    >
                      {movement.type === "STOCK_IN" ? "+" : movement.type === "STOCK_OUT" ? "-" : ""}
                      {movement.quantityChange}
                    </p>
                    <p className="text-xs text-gray-500">
                      {movement.quantityBefore} → {movement.quantityAfter}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4">
            <Link href="/movements">
              <Button variant="outline" className="w-full">
                ดูทั้งหมด
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
