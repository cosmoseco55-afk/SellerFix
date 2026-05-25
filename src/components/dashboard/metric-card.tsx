import { cn } from "@/lib/utils"
import { TrendingDown, TrendingUp } from "lucide-react"

interface MetricCardProps {
  title: string
  value: string
  sub?: string
  diff?: number
  diffLabel?: string
  className?: string
}

export function MetricCard({ title, value, sub, diff, diffLabel, className }: MetricCardProps) {
  const positive = diff !== undefined && diff >= 0

  return (
    <div className={cn("rounded-xl bg-white border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow", className)}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
      <p className="mt-2 text-[26px] font-bold tracking-tight text-slate-900 leading-none">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
      {diff !== undefined && (
        <div
          className={cn(
            "mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            positive
              ? "bg-emerald-50 text-emerald-600"
              : "bg-red-50 text-red-500"
          )}
        >
          {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>
            {positive ? "+" : ""}
            {diff.toFixed(1)}% {diffLabel ?? "vs пред. год"}
          </span>
        </div>
      )}
    </div>
  )
}
