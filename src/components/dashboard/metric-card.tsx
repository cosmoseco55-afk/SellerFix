import { Card, CardContent } from "@/components/ui/card"
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
    <Card className={cn("hover:shadow-sm transition-shadow", className)}>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        {diff !== undefined && (
          <div
            className={cn(
              "mt-2 flex items-center gap-1 text-xs font-medium",
              positive ? "text-emerald-600" : "text-red-500"
            )}
          >
            {positive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>
              {positive ? "+" : ""}
              {diff.toFixed(1)}% {diffLabel ?? "vs пред. период"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
