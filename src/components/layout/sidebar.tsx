"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Package,
  TrendingUp,
  BarChart3,
  Megaphone,
  Warehouse,
  Settings,
  Store,
  Upload,
  ScanLine,
  Calculator,
} from "lucide-react"

const nav = [
  {
    title: "Финансы",
    items: [
      { href: "/dashboard",            label: "Дашборд",         icon: LayoutDashboard },
      { href: "/dashboard/otsifrovka", label: "Оцифровка",       icon: ScanLine },
      { href: "/dashboard/pnl",        label: "ОПиУ",            icon: TrendingUp },
      { href: "/dashboard/cashflow",   label: "ДДС",             icon: BarChart3 },
    ],
  },
  {
    title: "Маркетплейсы",
    items: [
      { href: "/dashboard/products",   label: "Товары",          icon: Package },
      { href: "/dashboard/unit",       label: "Юнит-экономика",  icon: Calculator },
      { href: "/dashboard/advertising",label: "Реклама",         icon: Megaphone },
      { href: "/dashboard/stock",      label: "Склад",           icon: Warehouse },
    ],
  },
  {
    title: "Управление",
    items: [
      { href: "/dashboard/import",     label: "Загрузка отчётов",icon: Upload },
      { href: "/dashboard/stores",     label: "Магазины",        icon: Store },
      { href: "/dashboard/settings",   label: "Настройки",       icon: Settings },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-56 flex-col bg-[#0f172a]">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 px-4 border-b border-white/5">
        <div className="w-7 h-7 rounded-md bg-indigo-500 flex items-center justify-center shrink-0">
          <BarChart3 className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-bold tracking-tight">SellerFix</span>
        <span className="ml-auto rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400">
          beta
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {nav.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-indigo-600 text-white"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-slate-500")} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-3 border-t border-white/5 pt-3">
        <div className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-slate-400">
          <div className="w-6 h-6 rounded-full bg-indigo-500/30 flex items-center justify-center text-[10px] font-bold text-indigo-400 shrink-0">
            S
          </div>
          <span className="truncate text-xs">sellerfix.ru</span>
        </div>
      </div>
    </aside>
  )
}
