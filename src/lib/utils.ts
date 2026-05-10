import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("th-TH").format(num);
}

export function getStockStatus(quantity: number, minimumQuantity: number): "in-stock" | "low-stock" | "out-of-stock" {
  if (quantity === 0) return "out-of-stock";
  if (quantity <= minimumQuantity) return "low-stock";
  return "in-stock";
}

export function getStockStatusLabel(status: ReturnType<typeof getStockStatus>): string {
  switch (status) {
    case "in-stock":
      return "มีสินค้า";
    case "low-stock":
      return "สินค้าใกล้หมด";
    case "out-of-stock":
      return "สินค้าหมด";
  }
}

export function getStockStatusColor(status: ReturnType<typeof getStockStatus>): string {
  switch (status) {
    case "in-stock":
      return "text-green-600 bg-green-50";
    case "low-stock":
      return "text-amber-600 bg-amber-50";
    case "out-of-stock":
      return "text-red-600 bg-red-50";
  }
}
