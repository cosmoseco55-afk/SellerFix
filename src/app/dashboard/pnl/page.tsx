import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatCurrency, formatPercent } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { Suspense } from "react"

type MonthStat = {
  label: string
  key: string
  revenue: number
  commission: number
  logistics: number
  storage: number
  cogs: number
  returns: number
  penalties: number
  compensations: number
  advertising: number
  grossProfit: number
  netProfit: number
  margin: number
  quantity: number
}

function parseDateParam(val: string | undefined, fallback: Date): Date {
  if (!val) return fallback
  const d = new Date(val)
  return isNaN(d.getTime()) ? fallback : d
}

async function getPnlData(userId: string, fromDate: Date, toDate: Date) {
  const stores = await db.store.findMany({ where: { userId, isActive: true } })
  const storeIds = stores.map((s) => s.id)
  if (!storeIds.length) return { months: [], totals: null }

  const [orders, adSpends, products] = await Promise.all([
    db.order.findMany({
      where: { storeId: { in: storeIds }, date: { gte: fromDate, lte: toDate } },
      select: { isReturn: true, date: true, revenue: true, commission: true, logistics: true, storage: true, compensations: true, returns: true, penalties: true, quantity: true, productId: true },
    }),
    db.adSpend.findMany({
      where: { storeId: { in: storeIds }, date: { gte: fromDate, lte: toDate } },
      select: { date: true, spend: true, campaignType: true },
    }),
    db.product.findMany({ where: { storeId: { in: storeIds } }, select: { id: true, cogsPerUnit: true } }),
  ])

  const cogsMap = new Map(products.map((p) => [p.id, p.cogsPerUnit]))

  const monthMap = new Map<string, MonthStat>()

  for (const o of orders) {
    const d = new Date(o.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        label: formatMonthLabel(d), key,
        revenue: 0, commission: 0, logistics: 0, storage: 0, cogs: 0,
        returns: 0, penalties: 0, compensations: 0, advertising: 0,
        grossProfit: 0, netProfit: 0, margin: 0, quantity: 0,
      })
    }
    const m = monthMap.get(key)!
    if (!o.isReturn) {
      const unitCogs = o.productId ? (cogsMap.get(o.productId) ?? 0) : 0
      m.revenue       += o.revenue
      m.commission    += o.commission
      m.logistics     += o.logistics
      m.storage       += o.storage
      // COGS только на строках реальных продаж (revenue > 0)
      if (o.revenue > 0) {
        m.cogs     += unitCogs * o.quantity
        m.quantity += o.quantity
      }
      m.compensations += o.compensations
    }
    m.returns   += o.returns
    m.penalties += o.penalties
  }

  for (const ad of adSpends) {
    const d = new Date(ad.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (!monthMap.has(key)) continue
    const m = monthMap.get(key)!
    if (ad.campaignType === "STORAGE") {
      m.storage += ad.spend
    } else {
      m.advertising += ad.spend
    }
  }

  for (const m of monthMap.values()) {
    m.grossProfit = m.revenue - m.commission - m.logistics - m.storage - m.cogs
    m.netProfit   = m.grossProfit - m.returns - m.penalties + m.compensations - m.advertising
    m.margin      = m.revenue > 0 ? (m.netProfit / m.revenue) * 100 : 0
  }

  const months = Array.from(monthMap.values()).sort((a, b) => b.key.localeCompare(a.key))

  const totals = months.reduce<Omit<MonthStat, "label" | "key" | "grossProfit" | "netProfit" | "margin">>(
    (acc, m) => ({
      revenue:       acc.revenue       + m.revenue,
      commission:    acc.commission    + m.commission,
      logistics:     acc.logistics     + m.logistics,
      storage:       acc.storage       + m.storage,
      cogs:          acc.cogs          + m.cogs,
      returns:       acc.returns       + m.returns,
      penalties:     acc.penalties     + m.penalties,
      compensations: acc.compensations + m.compensations,
      advertising:   acc.advertising   + m.advertising,
      quantity:      acc.quantity      + m.quantity,
    }),
    { revenue: 0, commission: 0, logistics: 0, storage: 0, cogs: 0, returns: 0, penalties: 0, compensations: 0, advertising: 0, quantity: 0 }
  )
  const totalGross  = totals.revenue - totals.commission - totals.logistics - totals.storage
  const totalNet    = totalGross - totals.returns - totals.penalties + totals.compensations - totals.advertising
  const totalMargin = totals.revenue > 0 ? (totalNet / totals.revenue) * 100 : 0

  return { months, totals: { ...totals, grossProfit: totalGross, netProfit: totalNet, margin: totalMargin } }
}

function formatMonthLabel(d: Date): string {
  const months = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"]
  return `${months[d.getMonth()]} ${d.getFullYear()}`
}

function ProfitIndicator({ value }: { value: number }) {
  if (value > 0) return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
  if (value < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-500" />
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />
}

type PageProps = { searchParams: Promise<{ from?: string; to?: string }> }

export default async function PnlPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) return null

  const { from: fromParam, to: toParam } = await searchParams

  const defaultFrom = new Date(); defaultFrom.setMonth(defaultFrom.getMonth() - 11); defaultFrom.setDate(1); defaultFrom.setHours(0,0,0,0)
  const defaultTo   = new Date(); defaultTo.setHours(23,59,59,999)

  const fromDate = parseDateParam(fromParam, defaultFrom)
  const toDate   = parseDateParam(toParam,   defaultTo)
  toDate.setHours(23, 59, 59, 999)

  const { months, totals } = await getPnlData(session.user.id, fromDate, toDate)

  if (!totals || months.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">ОПиУ — Отчёт о прибылях и убытках</h1>
          <Suspense><DateRangePicker defaultFrom={fromParam} defaultTo={toParam} /></Suspense>
        </div>
        <div className="flex h-48 items-center justify-center text-center">
          <div>
            <p className="font-medium">Нет данных за выбранный период</p>
            <p className="text-sm text-muted-foreground mt-1">
              <a href="/dashboard/import" className="text-primary hover:underline">Загрузите отчёт</a> или выберите другой период
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-lg font-semibold">ОПиУ — Отчёт о прибылях и убытках</h1>
        <Suspense><DateRangePicker defaultFrom={fromParam} defaultTo={toParam} /></Suspense>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Выручка</p>
          <p className="text-xl font-bold mt-1">{formatCurrency(totals.revenue, true)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{totals.quantity} шт</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Валовая прибыль</p>
          <p className={`text-xl font-bold mt-1 ${totals.grossProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {formatCurrency(totals.grossProfit, true)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">без рекламы и возвратов</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Чистая прибыль</p>
          <p className={`text-xl font-bold mt-1 ${totals.netProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {formatCurrency(totals.netProfit, true)}
          </p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Маржа</p>
          <p className={`text-xl font-bold mt-1 ${totals.margin >= 15 ? "text-emerald-600" : totals.margin >= 0 ? "text-amber-600" : "text-red-500"}`}>
            {formatPercent(totals.margin)}
          </p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Структура доходов и расходов</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 text-sm">
            <PnlRow label="+ Выручка от продаж"   value={totals.revenue}       type="income" bold />
            <PnlRow label="+ Компенсации"          value={totals.compensations} type="income" />
            <div className="border-t my-2" />
            <PnlRow label="− Себестоимость"        value={totals.cogs}          type="expense" />
            <PnlRow label="− Комиссия МП"          value={totals.commission}    type="expense" />
            <PnlRow label="− Логистика"            value={totals.logistics}     type="expense" />
            <PnlRow label="− Хранение"             value={totals.storage}       type="expense" />
            <PnlRow label="− Возвраты"             value={totals.returns}       type="expense" />
            <PnlRow label="− Штрафы"               value={totals.penalties}     type="expense" />
            <PnlRow label="− Реклама"              value={totals.advertising}   type="expense" />
            <div className="border-t my-2" />
            <PnlRow label="= Валовая прибыль"      value={totals.grossProfit}   type="result" />
            <PnlRow label="= Чистая прибыль"       value={totals.netProfit}     type="result" bold />
            <div className="mt-1 text-xs text-muted-foreground">Маржа: {formatPercent(totals.margin)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Разбивка по месяцам</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: 900 }}>
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Период</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Выручка</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Комиссия</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Логистика</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Хранение</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Возвраты</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Штрафы</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Реклама</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Прибыль</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Маржа</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.key} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <ProfitIndicator value={m.netProfit} />
                        {m.label}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatCurrency(m.revenue, true)}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">{m.commission > 0 ? `−${formatCurrency(m.commission, true)}` : "—"}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">{m.logistics > 0 ? `−${formatCurrency(m.logistics, true)}` : "—"}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">{m.storage > 0 ? `−${formatCurrency(m.storage, true)}` : "—"}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">{m.returns > 0 ? `−${formatCurrency(m.returns, true)}` : "—"}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">{m.penalties > 0 ? `−${formatCurrency(m.penalties, true)}` : "—"}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">{m.advertising > 0 ? `−${formatCurrency(m.advertising, true)}` : "—"}</td>
                    <td className={`px-3 py-2.5 text-right font-semibold whitespace-nowrap ${m.netProfit > 0 ? "text-emerald-600" : m.netProfit < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                      {formatCurrency(m.netProfit, true)}
                    </td>
                    <td className={`px-3 py-2.5 text-right whitespace-nowrap ${m.margin >= 15 ? "text-emerald-600" : m.margin >= 0 ? "text-amber-600" : "text-red-500"}`}>
                      {formatPercent(m.margin)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 bg-muted/30 font-semibold">
                  <td className="px-4 py-2.5">Итого</td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(totals.revenue, true)}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{totals.commission > 0 ? `−${formatCurrency(totals.commission, true)}` : "—"}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{totals.logistics > 0 ? `−${formatCurrency(totals.logistics, true)}` : "—"}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{totals.storage > 0 ? `−${formatCurrency(totals.storage, true)}` : "—"}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{totals.returns > 0 ? `−${formatCurrency(totals.returns, true)}` : "—"}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{totals.penalties > 0 ? `−${formatCurrency(totals.penalties, true)}` : "—"}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{totals.advertising > 0 ? `−${formatCurrency(totals.advertising, true)}` : "—"}</td>
                  <td className={`px-3 py-2.5 text-right ${totals.netProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>{formatCurrency(totals.netProfit, true)}</td>
                  <td className={`px-3 py-2.5 text-right ${totals.margin >= 15 ? "text-emerald-600" : totals.margin >= 0 ? "text-amber-600" : "text-red-500"}`}>{formatPercent(totals.margin)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function PnlRow({ label, value, type, bold }: { label: string; value: number; type: "income" | "expense" | "result"; bold?: boolean }) {
  const formatted = formatCurrency(value, true)
  const color = type === "result" ? (value >= 0 ? "text-emerald-600" : "text-red-500") : type === "income" ? "text-foreground" : "text-muted-foreground"
  return (
    <div className={`flex items-center justify-between py-0.5 ${bold ? "font-semibold" : ""}`}>
      <span className={type === "result" ? "font-medium" : ""}>{label}</span>
      <span className={color}>{type === "expense" && value > 0 ? `−${formatted}` : formatted}</span>
    </div>
  )
}
