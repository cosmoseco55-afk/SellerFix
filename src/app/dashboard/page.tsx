import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { MetricCard } from "@/components/dashboard/metric-card"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { formatCurrency, formatPercent, calcMargin, calcROI } from "@/lib/utils"
import { Suspense } from "react"
import { Store, ArrowRight } from "lucide-react"
import Link from "next/link"

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
    return { id: p.id, name: p.name, marketplace: p.store.marketplace, revenue: s.revenue, profit: s.grossProfit, costs: s.costs, margin: calcMargin(s.revenue, s.costs), quantity: s.quantity }
  }).filter((p) => p.revenue > 0).sort((a, b) => b.profit - a.profit)

  const adByDay = new Map<string, number>()
  for (const ad of adSpends) {
    const key = new Date(ad.date).toDateString()
    adByDay.set(key, (adByDay.get(key) ?? 0) + ad.spend)
  }

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
      <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
          <Store className="w-7 h-7 text-indigo-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Добро пожаловать в SellerFix</h2>
          <p className="mt-1.5 text-sm text-slate-500">Подключите магазин, чтобы видеть аналитику</p>
        </div>
        <a
          href="/dashboard/stores"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          Подключить магазин
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-base font-semibold text-slate-800">Дашборд</h1>
          <p className="text-xs text-slate-400 mt-0.5">Сводная аналитика по всем магазинам</p>
        </div>
        <Suspense>
          <DateRangePicker defaultFrom={fromParam} defaultTo={toParam} />
        </Suspense>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          title="Чистая прибыль"
          value={formatCurrency(cur.profit, true)}
          sub={`Маржа ${formatPercent(margin)}`}
          diff={diffProfit}
        />
        <MetricCard
          title="Выручка"
          value={formatCurrency(cur.revenue, true)}
          sub={`${cur.quantity} шт продано`}
          diff={diffRevenue}
        />
        <MetricCard
          title="ROI"
          value={formatPercent(roi)}
          sub="Рентабельность вложений"
        />
        <MetricCard
          title="ДРР"
          value={formatPercent(drr)}
          sub={`${formatCurrency(cur.advertising, true)} на рекламу`}
        />
      </div>

      {/* Chart + Top products */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Chart */}
        <div className="lg:col-span-2 rounded-xl bg-white border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Выручка и прибыль</h2>
              <p className="text-xs text-slate-400 mt-0.5">Динамика за выбранный период</p>
            </div>
          </div>
          <RevenueChart data={chart} />
        </div>

        {/* Top products */}
        <div className="rounded-xl bg-white border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Топ товары</h2>
              <p className="text-xs text-slate-400 mt-0.5">По прибыли за период</p>
            </div>
            <Link href="/dashboard/products" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
              Все <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {productStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-slate-400">Нет данных за период</p>
              <p className="text-xs text-slate-300 mt-1">Загрузите финансовые отчёты</p>
            </div>
          ) : (
            <div className="space-y-3">
              {productStats.slice(0, 6).map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-400 flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-700">{p.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
                        {p.marketplace}
                      </span>
                      <span className="text-[10px] text-slate-400">{formatPercent(p.margin)} маржа</span>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-emerald-600">
                    {formatCurrency(p.profit, true)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
