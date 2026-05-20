import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { MetricCard } from "@/components/dashboard/metric-card"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatPercent, calcMargin, calcROI } from "@/lib/utils"

async function getDashboardData(userId: string) {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevTo = new Date(now.getFullYear(), now.getMonth(), 0)

  const stores = await db.store.findMany({ where: { userId, isActive: true } })
  const storeIds = stores.map((s) => s.id)

  const [orders, prevOrders] = await Promise.all([
    db.order.findMany({ where: { storeId: { in: storeIds }, date: { gte: from }, isReturn: false } }),
    db.order.findMany({ where: { storeId: { in: storeIds }, date: { gte: prevFrom, lte: prevTo }, isReturn: false } }),
  ])

  const sum = (arr: typeof orders) => ({
    revenue: arr.reduce((a, o) => a + o.revenue, 0),
    profit: arr.reduce((a, o) => a + o.revenue - o.commission - o.logistics - o.storage - o.advertising - o.cogs - o.tax + o.compensations - o.penalties - o.returns, 0),
    costs: arr.reduce((a, o) => a + o.commission + o.logistics + o.storage + o.advertising + o.cogs + o.tax, 0),
    quantity: arr.reduce((a, o) => a + o.quantity, 0),
    advertising: arr.reduce((a, o) => a + o.advertising, 0),
  })

  const cur = sum(orders)
  const prev = sum(prevOrders)

  const diffRevenue = prev.revenue ? ((cur.revenue - prev.revenue) / prev.revenue) * 100 : 0
  const diffProfit = prev.profit ? ((cur.profit - prev.profit) / prev.profit) * 100 : 0

  // Топ товары по прибыли
  const products = await db.product.findMany({
    where: { storeId: { in: storeIds } },
    include: {
      orders: { where: { date: { gte: from }, isReturn: false } },
      store: { select: { marketplace: true, name: true } },
    },
    take: 10,
  })

  const productStats = products.map((p) => {
    const s = sum(p.orders)
    return {
      id: p.id,
      name: p.name,
      marketplace: p.store.marketplace,
      revenue: s.revenue,
      profit: s.profit,
      margin: calcMargin(s.revenue, s.costs),
      quantity: s.quantity,
    }
  }).sort((a, b) => b.profit - a.profit)

  // Простой график по дням текущего месяца
  const chart: { date: string; revenue: number; profit: number }[] = []
  const days = Math.min(now.getDate(), 30)
  for (let i = 0; i < days; i++) {
    const d = new Date(from)
    d.setDate(d.getDate() + i)
    const dayOrders = orders.filter(
      (o) => new Date(o.date).toDateString() === d.toDateString()
    )
    const s = sum(dayOrders)
    chart.push({
      date: `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`,
      revenue: s.revenue,
      profit: s.profit,
    })
  }

  return { cur, prev, diffRevenue, diffProfit, productStats, chart, storesCount: stores.length }
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) return null
  const { cur, diffRevenue, diffProfit, productStats, chart, storesCount } = await getDashboardData(session.user.id)

  const margin = calcMargin(cur.revenue, cur.costs)
  const roi = calcROI(cur.profit, cur.costs)
  const drr = cur.revenue ? (cur.advertising / cur.revenue) * 100 : 0

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
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Дашборд</h1>
        <span className="text-xs text-muted-foreground">Текущий месяц</span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          title="Чистая прибыль"
          value={formatCurrency(cur.profit, true)}
          sub={`Маржа ${formatPercent(margin)}`}
          diff={diffProfit}
        />
        <MetricCard
          title="Выручка"
          value={formatCurrency(cur.revenue, true)}
          sub={`${cur.quantity} шт`}
          diff={diffRevenue}
        />
        <MetricCard
          title="ROI"
          value={formatPercent(roi)}
          sub="Рентабельность"
        />
        <MetricCard
          title="ДРР"
          value={formatPercent(drr)}
          sub={formatCurrency(cur.advertising, true) + " реклама"}
        />
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
                    <Badge variant="outline" className="h-4 px-1 text-[10px]">
                      {p.marketplace}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {formatPercent(p.margin)} маржа
                    </span>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold text-emerald-600">
                  {formatCurrency(p.profit, true)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
