"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"
import { CalendarDays, ChevronDown } from "lucide-react"

const PRESETS = [
  { label: "7 дней",         days: 7 },
  { label: "30 дней",        days: 30 },
  { label: "Этот месяц",     days: 0, type: "currentMonth" },
  { label: "Прошлый месяц",  days: 0, type: "prevMonth" },
  { label: "3 месяца",       days: 90 },
  { label: "6 месяцев",      days: 180 },
  { label: "Этот год",       days: 0, type: "currentYear" },
  { label: "Всё время",      days: 0, type: "all" },
] as const

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function calcPreset(preset: typeof PRESETS[number]): { from: string; to: string } {
  const now = new Date()
  const today = toDateStr(now)

  if ("type" in preset) {
    if (preset.type === "currentMonth") {
      return {
        from: toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: today,
      }
    }
    if (preset.type === "prevMonth") {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const last  = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: toDateStr(first), to: toDateStr(last) }
    }
    if (preset.type === "currentYear") {
      return {
        from: toDateStr(new Date(now.getFullYear(), 0, 1)),
        to: today,
      }
    }
    if (preset.type === "all") {
      return { from: "", to: "" }
    }
  }

  const from = new Date(now)
  from.setDate(from.getDate() - preset.days + 1)
  return { from: toDateStr(from), to: today }
}

interface Props {
  defaultFrom?: string
  defaultTo?: string
}

export function DateRangePicker({ defaultFrom = "", defaultTo = "" }: Props) {
  const router     = useRouter()
  const pathname   = usePathname()
  const searchParams = useSearchParams()

  const [open, setOpen]   = useState(false)
  const [from, setFrom]   = useState(defaultFrom)
  const [to, setTo]       = useState(defaultTo)

  const apply = useCallback(
    (f: string, t: string) => {
      const params = new URLSearchParams(searchParams.toString())
      // preserve other params (e.g. status)
      if (f) params.set("from", f); else params.delete("from")
      if (t) params.set("to",   t); else params.delete("to")
      router.push(`${pathname}?${params.toString()}`)
      setOpen(false)
    },
    [router, pathname, searchParams]
  )

  const displayLabel = () => {
    if (!from && !to) return "Весь период"
    const f = from ? new Date(from).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "—"
    const t = to   ? new Date(to).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }) : "—"
    return `${f} — ${t}`
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-muted transition-colors"
      >
        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{displayLabel()}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border bg-background p-3 shadow-lg">
            {/* Пресеты */}
            <div className="mb-3 grid grid-cols-2 gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    const { from: f, to: t } = calcPreset(p)
                    setFrom(f); setTo(t)
                    apply(f, t)
                  }}
                  className="rounded-md px-2 py-1 text-xs text-left hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground mb-1">С</p>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground mb-1">По</p>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => apply(from, to)}
                  className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Применить
                </button>
                <button
                  onClick={() => { setFrom(""); setTo(""); apply("", "") }}
                  className="rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                >
                  Сбросить
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
