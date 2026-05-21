"use client"

import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

type Tab = "ALL" | "ACTIVE" | "PAUSED" | "ARCHIVED"

const TABS: { value: Tab; label: string; color: string; dot: string }[] = [
  { value: "ALL",      label: "Все",             color: "text-foreground",       dot: "bg-muted-foreground" },
  { value: "ACTIVE",   label: "Активные",        color: "text-emerald-600",      dot: "bg-emerald-500" },
  { value: "PAUSED",   label: "Приостановленные",color: "text-amber-600",        dot: "bg-amber-500" },
  { value: "ARCHIVED", label: "Архивные",         color: "text-muted-foreground", dot: "bg-muted-foreground" },
]

interface Props {
  active: Tab
  counts: Record<Tab, number>
}

export function AdStatusTabs({ active, counts }: Props) {
  const router  = useRouter()
  const pathname = usePathname()

  const go = (tab: Tab) => {
    const params = new URLSearchParams()
    if (tab !== "ALL") params.set("status", tab)
    router.push(`${pathname}${params.toString() ? "?" + params.toString() : ""}`)
  }

  return (
    <div className="flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => go(tab.value)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            active === tab.value
              ? "bg-background shadow-sm " + tab.color
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {active === tab.value && (
            <span className={cn("h-1.5 w-1.5 rounded-full", tab.dot)} />
          )}
          {tab.label}
          <span className={cn(
            "rounded px-1 py-0.5 text-[10px] font-mono",
            active === tab.value ? "bg-muted" : "bg-transparent"
          )}>
            {counts[tab.value]}
          </span>
        </button>
      ))}
    </div>
  )
}
