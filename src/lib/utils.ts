import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000) {
    return (value / 1_000_000).toFixed(1) + " млн ₽"
  }
  if (compact && Math.abs(value) >= 1_000) {
    return (value / 1_000).toFixed(0) + " тыс ₽"
  }
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPercent(value: number): string {
  return value.toFixed(2) + "%"
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value)
}

export function calcMargin(revenue: number, costs: number): number {
  if (revenue === 0) return 0
  return ((revenue - costs) / revenue) * 100
}

export function calcROI(profit: number, costs: number): number {
  if (costs === 0) return 0
  return (profit / costs) * 100
}
