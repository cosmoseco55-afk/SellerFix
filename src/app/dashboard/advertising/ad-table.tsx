"use client"

import { useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils"

export interface AdRow {
  campaignId: string
  campaignName: string
  campaignType: string
  status: "ACTIVE" | "PAUSED" | "ARCHIVED"
  productName: string
  externalId: string
  marketplace: string
  spend: number
  drr: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  roas: number
  adOrders: number
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  ACTIVE:   { label: "Активна",         cls: "bg-emerald-100 text-emerald-700" },
  PAUSED:   { label: "Приостановлена",  cls: "bg-amber-100 text-amber-700" },
  ARCHIVED: { label: "Архив",           cls: "bg-muted text-muted-foreground" },
}

export function AdTable({ rows }: { rows: AdRow[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "right" ? 280 : -280, behavior: "smooth" })
  }

  return (
    <div>
      {/* Header with scroll controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <span className="text-xs text-muted-foreground">Прокрутите таблицу →</span>
        <div className="flex gap-1">
          <button
            onClick={() => scroll("left")}
            className="flex h-7 w-7 items-center justify-center rounded-md border bg-background hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex h-7 w-7 items-center justify-center rounded-md border bg-background hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable table */}
      <div
        ref={scrollRef}
        className="overflow-x-scroll"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "hsl(215 20% 65%) transparent",
        }}
      >
        <table className="text-sm" style={{ minWidth: 1100, width: "max-content" }}>
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/80 px-4 py-2 text-left font-medium text-xs text-muted-foreground whitespace-nowrap" style={{ minWidth: 220 }}>
                Кампания
              </th>
              <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground whitespace-nowrap" style={{ minWidth: 100 }}>Расход</th>
              <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground whitespace-nowrap" style={{ minWidth: 80 }}>ДРР</th>
              <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground whitespace-nowrap" style={{ minWidth: 100 }}>Показы</th>
              <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground whitespace-nowrap" style={{ minWidth: 90 }}>Клики</th>
              <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground whitespace-nowrap" style={{ minWidth: 80 }}>CTR</th>
              <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground whitespace-nowrap" style={{ minWidth: 90 }}>CPC</th>
              <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground whitespace-nowrap" style={{ minWidth: 90 }}>Заказы</th>
              <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground whitespace-nowrap" style={{ minWidth: 90 }}>ROAS</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Нет данных
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="sticky left-0 z-10 bg-background px-4 py-2.5">
                    {/* Campaign ID + name */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {r.campaignId && (
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          #{r.campaignId}
                        </span>
                      )}
                      <p className="font-medium truncate max-w-[140px] text-xs">{r.campaignName}</p>
                    </div>
                    {/* Shortened product name */}
                    {r.productName !== r.campaignName && (
                      <p className="mt-0.5 truncate max-w-[200px] text-[11px] text-muted-foreground">
                        {r.productName.slice(0, 38)}{r.productName.length > 38 ? "…" : ""}
                      </p>
                    )}
                    {/* Status + type */}
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_LABEL[r.status]?.cls}`}>
                        {STATUS_LABEL[r.status]?.label}
                      </span>
                      {r.campaignType && (
                        <span className="text-[10px] text-muted-foreground">{r.campaignType}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-medium whitespace-nowrap">
                    {formatCurrency(r.spend, true)}
                  </td>
                  <td className={`px-3 py-2.5 text-right text-xs font-medium whitespace-nowrap ${
                    r.drr === 0 ? "text-muted-foreground" :
                    r.drr <= 15 ? "text-emerald-600" :
                    r.drr <= 25 ? "text-amber-600" : "text-red-500"
                  }`}>
                    {r.drr === 0 ? "—" : formatPercent(r.drr)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-muted-foreground whitespace-nowrap">
                    {formatNumber(r.impressions)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-muted-foreground whitespace-nowrap">
                    {formatNumber(r.clicks)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs whitespace-nowrap">
                    {formatPercent(r.ctr)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs whitespace-nowrap">
                    {formatCurrency(r.cpc, true)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs whitespace-nowrap">
                    {formatNumber(r.adOrders)}
                  </td>
                  <td className={`px-3 py-2.5 text-right text-xs font-medium whitespace-nowrap ${
                    r.roas === 0 ? "text-muted-foreground" :
                    r.roas >= 3 ? "text-emerald-600" :
                    r.roas >= 1 ? "text-amber-600" : "text-red-500"
                  }`}>
                    {r.roas === 0 ? "—" : `${r.roas.toFixed(1)}x`}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
