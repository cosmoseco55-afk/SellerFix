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
      { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
      { href: "/dashboard/otsifrovka", label: "Оцифровка", icon: ScanLine },
      { href: "/dashboard/pnl", label: "ОПиУ", icon: TrendingUp },
      { href: "/dashboard/cashflow", label: "ДДС", icon: BarChart3 },
    ],
  },
  {
    title: "Маркетплейсы",
    items: [
      { href: "/dashboard/products", label: "Товары", icon: Package },
      { href: "/dashboard/unit", label: "Юнит-экономика", icon: Calculator },
      { href: "/dashboard/advertising", label: "Реклама", icon: Megaphone },
      { href: "/dashboard/stock", label: "Склад", icon: Warehouse },
    ],
  },
  {
    title: "Управление",
    items: [
      { href: "/dashboard/import", label: "Загрузка отчётов", icon: Upload },
      { href: "/dashboard/stores", label: "Магазины", icon: Store },
      { href: "/dashboard/settings", label: "Настройки", icon: Settings },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-background">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-lg font-bold tracking-tight">SellerFix</span>
        <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          beta
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {nav.map((group) => (
          <div key={group.title} className="mb-4">
            <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {group.title}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
