import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { MetricCard } from "@/components/dashboard/metric-card"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { formatCurrency, formatPercent, calcMargin, calcROI } from "@/lib/utils"
import { Suspense } from "react"

function parseDateParam(val: string | undefined, fallback: Date): Date {
  if (!val) return fallback
  const d = new Date(val)
  return isNaN(d.getTime()) ? fallback : d
}

async function getDashboardData(userId: string, fromDate: Date, toDate: Date) {
  const stores = await db.store.findMany({ where: { userId, isActive: true } })
  const storeIds = stores.map((s) => s.id)

  const prevFrom = new Date(fromDate)
  prevFrom.setFullYear(prevFrom.getFullYear() - 1)
  const prevTo = new Date(toDate)
  prevTo.setFullYear(prevTo.getFullYear() - 1)

  const [orders, prevOrders, adSpends, prevAdSpends, allProducts] = await Promise.all([
    db.order.findMany({ where: { storeId: { in: storeIds }, date: { gte: fromDate, lte: toDate }, isReturn: false }, select: { revenue: true, commission: true, logistics: true, storage: true, compensations: true, penalties: true, returns: true, quantity: true, productId: true, date: true } }),
    db.order.findMany({ where: { storeId: { in: storeIds }, date: { gte: prevFrom, lte: prevTo }, isReturn: false }, select: { revenue: true, commission: true, logistics: true, storage: true, compensations: true, penalties: true, returns: true, quantity: true, productId: true, date: true } }),
    db.adSpend.findMany({ where: { storeId: { in: storeIds }, date: { gte: fromDate, lte: toDate } }, select: { spend: true, date: true } }),
    db.adSpend.findMany({ where: { storeId: { in: storeIds }, date: { gte: prevFrom, lte: prevTo } }, select: { spend: true } }),
    db.product.findMany({ where: { storeId: { in: storeIds } }, select: { id: true, cogsPerUnit: true } }),
  ])

  const cogsMap = new Map(allProducts.map((p) => [p.id, p.cogsPerUnit]))

  const totalAdSpend     = adSpends.reduce((a, s) => a + s.spend, 0)
  const totalPrevAdSpend = prevAdSpends.reduce((a, s) => a + s.spend, 0)

  const sum = (arr: typeof orders) => {
    let revenue = 0, commission = 0, logistics = 0, storage = 0, cogs = 0, compensations = 0, penalties = 0, returns = 0, quantity = 0
    for (const o of arr) {
      const unitCogs = o.productId ? (cogsMap.get(o.productId) ?? 0) : 0
      revenue      += o.revenue
      commission   += o.commission
      logistics    += o.logistics
      storage      += o.storage
      compensations+= o.compensations
      penalties    += o.penalties
      returns      += o.returns
      quantity     += o.quantity
      // COGS только на строках реальных продаж (revenue > 0)
      if (o.revenue > 0) cogs += unitCogs * o.quantity
    }
    const costs       = commission + logistics + storage + cogs
    const grossProfit = revenue - costs - penalties - returns + compensations
    return { revenue, grossProfit, costs, quantity }
  }

  const curBase  = sum(orders)
  const prevBase = sum(prevOrders)

  const cur  = { ...curBase,  profit: curBase.grossProfit  - totalAdSpend,     advertising: totalAdSpend }
  const prev = { ...prevBase, profit: prevBase.grossProfit - totalPrevAdSpend, advertising: totalPrevAdSpend }

  const diffRevenue = prev.revenue ? ((cur.revenue - prev.revenue) / prev.revenue) * 100 : 0
  const diffProfit  = prev.profit  ? ((cur.profit  - prev.profit)  / prev.profit)  * 100 : 0

  const products = await db.product.findMany({
    where: { storeId: { in: storeIds } },
    include: {
      orders: { where: { date: { gte: fromDate, lte: toDate }, isReturn: false }, select: { revenue: true, commission: true, logistics: true, storage: true, compensations: true, penalties: true, returns: true, quantity: true, productId: true, date: true } },
      store: { select: { marketplace: true, name: true } },
    },
  })

  const productStats = products.map((p) => {
    const s = sum(p.orders)
    return { id: p.id, name: p.name, marketplace: p.store.marketplace, revenue: s.revenue, profit: s.grossProfit, margin: calcMargin(s.revenue, s.costs), quantity: s.quantity }
  }).filter((p) => p.revenue > 0).sort((a, b) => b.profit - a.profit)

  // AdSpend по дням для графика
  const adByDay = new Map<string, number>()
  for (const ad of adSpends) {
    const key = new Date(ad.date).toDateString()
    adByDay.set(key, (adByDay.get(key) ?? 0) + ad.spend)
  }

  // График по дням
  const chart: { date: string; revenue: number; profit: number }[] = []
  const msPerDay = 24 * 60 * 60 * 1000
  const days = Math.min(Math.round((toDate.getTime() - fromDate.getTime()) / msPerDay) + 1, 90)
  for (let i = 0; i < days; i++) {
    const d = new Date(fromDate.getTime() + i * msPerDay)
    const dayKey = d.toDateString()
    const dayOrders = orders.filter((o) => new Date(o.date).toDateString() === dayKey)
    const s = sum(dayOrders)
    const dayAd = adByDay.get(dayKey) ?? 0
    chart.push({
      date: `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`,
      revenue: s.revenue,
      profit:  s.grossProfit - dayAd,
    })
  }

  return { cur, prev, diffRevenue, diffProfit, productStats, chart, storesCount: stores.length }
}

type PageProps = { searchParams: Promise<{ from?: string; to?: string }> }

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) return null

  const { from: fromParam, to: toParam } = await searchParams

  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
  const defaultTo   = new Date(now); defaultTo.setHours(23,59,59,999)

  const fromDate = parseDateParam(fromParam, defaultFrom)
  const toDate   = parseDateParam(toParam,   defaultTo)
  toDate.setHours(23, 59, 59, 999)

  const { cur, diffRevenue, diffProfit, productStats, chart, storesCount } = await getDashboardData(session.user.id, fromDate, toDate)

  const margin = calcMargin(cur.revenue, cur.costs)
  const roi    = calcROI(cur.profit, cur.costs)
  const drr    = cur.revenue ? (cur.advertising / cur.revenue) * 100 : 0

  if (storesCount === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <h2 className="text-xl font-semibold">Добро пожаловать в SellerFix</h2>
        <p className="text-muted-foreground">Подключите магазин, чтобы видеть аналитику</p>
        <a href="/dashboard/stores" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
          Подключить магазин
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-lg font-semibold">Дашборд</h1>
        <Suspense><DateRangePicker defaultFrom={fromParam} defaultTo={toParam} /></Suspense>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard title="Чистая прибыль" value={formatCurrency(cur.profit, true)} sub={`Маржа ${formatPercent(margin)}`} diff={diffProfit} />
        <MetricCard title="Выручка" value={formatCurrency(cur.revenue, true)} sub={`${cur.quantity} шт`} diff={diffRevenue} />
        <MetricCard title="ROI" value={formatPercent(roi)} sub="Рентабельность" />
        <MetricCard title="ДРР" value={formatPercent(drr)} sub={formatCurrency(cur.advertising, true) + " реклама"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Выручка и прибыль</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={chart} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Топ товары</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {productStats.length === 0 && (
              <p className="text-xs text-muted-foreground">Нет данных за период</p>
            )}
            {productStats.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{p.name}</p>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="h-4 px-1 text-[10px]">{p.marketplace}</Badge>
                    <span className="text-[10px] text-muted-foreground">{formatPercent(p.margin)} маржа</span>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold text-emerald-600">{formatCurrency(p.profit, true)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
