import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { Suspense } from "react"

type MonthFlow = {
  label: string; key: string
  inRevenue: number; inCompensations: number
  outCommission: number; outLogistics: number; outStorage: number
  outCogs: number; outReturns: number; outPenalties: number; outAdvertising: number
  totalIn: number; totalOut: number; net: number
}

function parseDateParam(val: string | undefined, fallback: Date): Date {
  if (!val) return fallback
  const d = new Date(val)
  return isNaN(d.getTime()) ? fallback : d
}

async function getCashflowData(userId: string, fromDate: Date, toDate: Date) {
  const stores = await db.store.findMany({ where: { userId, isActive: true } })
  const storeIds = stores.map((s) => s.id)
  if (!storeIds.length) return { months: [], totals: null, cumulativeMap: new Map<string, number>() }

  const [orders, adSpends, products] = await Promise.all([
    db.order.findMany({ where: { storeId: { in: storeIds }, date: { gte: fromDate, lte: toDate } }, select: { isReturn: true, date: true, revenue: true, commission: true, logistics: true, storage: true, compensations: true, returns: true, penalties: true, quantity: true, productId: true } }),
    db.adSpend.findMany({ where: { storeId: { in: storeIds }, date: { gte: fromDate, lte: toDate } }, select: { date: true, spend: true, campaignType: true } }),
    db.product.findMany({ where: { storeId: { in: storeIds } }, select: { id: true, cogsPerUnit: true } }),
  ])
  const cogsMap = new Map(products.map((p) => [p.id, p.cogsPerUnit]))

  const monthMap = new Map<string, MonthFlow>()

  const getOrCreate = (d: Date): MonthFlow => {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        label: formatMonthLabel(d), key,
        inRevenue: 0, inCompensations: 0,
        outCommission: 0, outLogistics: 0, outStorage: 0,
        outCogs: 0, outReturns: 0, outPenalties: 0, outAdvertising: 0,
        totalIn: 0, totalOut: 0, net: 0,
      })
    }
    return monthMap.get(key)!
  }

  for (const o of orders) {
    const m = getOrCreate(new Date(o.date))
    if (!o.isReturn) {
      const unitCogs = o.productId ? (cogsMap.get(o.productId) ?? 0) : 0
      m.inRevenue       += o.revenue
      m.inCompensations += o.compensations
      m.outCommission   += o.commission
      m.outLogistics    += o.logistics
      m.outStorage      += o.storage
      // COGS только на строках реальных продаж (revenue > 0), не на логистике/хранении
      if (o.revenue > 0) m.outCogs += unitCogs * o.quantity
    }
    m.outReturns   += o.returns
    m.outPenalties += o.penalties
  }

  for (const ad of adSpends) {
    const m = getOrCreate(new Date(ad.date))
    if (ad.campaignType === "STORAGE") {
      m.outStorage += ad.spend
    } else {
      m.outAdvertising += ad.spend
    }
  }

  for (const m of monthMap.values()) {
    m.totalIn  = m.inRevenue + m.inCompensations
    m.totalOut = m.outCommission + m.outLogistics + m.outStorage + m.outCogs + m.outReturns + m.outPenalties + m.outAdvertising
    m.net      = m.totalIn - m.totalOut
  }

  const months = Array.from(monthMap.values()).sort((a, b) => b.key.localeCompare(a.key))

  let cumulative = 0
  const cumulativeMap = new Map<string, number>()
  for (const m of [...months].reverse()) {
    cumulative += m.net
    cumulativeMap.set(m.key, cumulative)
  }

  const totals = months.reduce(
    (acc, m) => ({
      inRevenue: acc.inRevenue + m.inRevenue, inCompensations: acc.inCompensations + m.inCompensations,
      outCommission: acc.outCommission + m.outCommission, outLogistics: acc.outLogistics + m.outLogistics,
      outStorage: acc.outStorage + m.outStorage, outCogs: acc.outCogs + m.outCogs,
      outReturns: acc.outReturns + m.outReturns,
      outPenalties: acc.outPenalties + m.outPenalties, outAdvertising: acc.outAdvertising + m.outAdvertising,
      totalIn: acc.totalIn + m.totalIn, totalOut: acc.totalOut + m.totalOut, net: acc.net + m.net,
    }),
    { inRevenue: 0, inCompensations: 0, outCommission: 0, outLogistics: 0, outStorage: 0, outCogs: 0, outReturns: 0, outPenalties: 0, outAdvertising: 0, totalIn: 0, totalOut: 0, net: 0 }
  )

  return { months, totals, cumulativeMap }
}

function formatMonthLabel(d: Date): string {
  const names = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"]
  return `${names[d.getMonth()]} ${d.getFullYear()}`
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

type PageProps = { searchParams: Promise<{ from?: string; to?: string }> }

export default async function CashflowPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) return null

  const { from: fromParam, to: toParam } = await searchParams

  const defaultFrom = new Date(); defaultFrom.setMonth(defaultFrom.getMonth() - 11); defaultFrom.setDate(1); defaultFrom.setHours(0,0,0,0)
  const defaultTo   = new Date(); defaultTo.setHours(23,59,59,999)

  const fromDate = parseDateParam(fromParam, defaultFrom)
  const toDate   = parseDateParam(toParam,   defaultTo)
  toDate.setHours(23, 59, 59, 999)

  const { months, totals, cumulativeMap } = await getCashflowData(session.user.id, fromDate, toDate)

  if (!totals || months.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-lg font-semibold">ДДС — Движение денежных средств</h1>
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

  const maxIn  = Math.max(...months.map((m) => m.totalIn),  1)
  const maxOut = Math.max(...months.map((m) => m.totalOut), 1)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-lg font-semibold">ДДС — Движение денежных средств</h1>
        <Suspense><DateRangePicker defaultFrom={fromParam} defaultTo={toParam} /></Suspense>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
            <p className="text-xs text-muted-foreground">Поступления</p>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totals.totalIn, true)}</p>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between"><span>Выручка</span><span>{formatCurrency(totals.inRevenue, true)}</span></div>
            <div className="flex justify-between"><span>Компенсации</span><span>{formatCurrency(totals.inCompensations, true)}</span></div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpRight className="h-4 w-4 text-red-500" />
            <p className="text-xs text-muted-foreground">Выбытия</p>
          </div>
          <p className="text-2xl font-bold text-red-500">{formatCurrency(totals.totalOut, true)}</p>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between"><span>Себестоимость</span><span>{formatCurrency(totals.outCogs, true)}</span></div>
            <div className="flex justify-between"><span>Комиссия</span><span>{formatCurrency(totals.outCommission, true)}</span></div>
            <div className="flex justify-between"><span>Логистика</span><span>{formatCurrency(totals.outLogistics, true)}</span></div>
            <div className="flex justify-between"><span>Хранение</span><span>{formatCurrency(totals.outStorage, true)}</span></div>
            <div className="flex justify-between"><span>Возвраты</span><span>{formatCurrency(totals.outReturns, true)}</span></div>
            <div className="flex justify-between"><span>Штрафы</span><span>{formatCurrency(totals.outPenalties, true)}</span></div>
            <div className="flex justify-between"><span>Реклама</span><span>{formatCurrency(totals.outAdvertising, true)}</span></div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground">Чистый денежный поток</p>
          </div>
          <p className={`text-2xl font-bold ${totals.net >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {totals.net >= 0 ? "+" : ""}{formatCurrency(totals.net, true)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {totals.totalIn > 0 ? `${((totals.net / totals.totalIn) * 100).toFixed(1)}% от поступлений` : "Нет поступлений"}
          </p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Движение по месяцам</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: 860 }}>
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Период</th>
                  <th className="px-3 py-2 text-right font-medium text-emerald-700">Поступления</th>
                  <th className="px-3 py-2 text-right font-medium text-red-600">Выбытия</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Комиссия</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Логистика</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Возвраты</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Реклама</th>
                  <th className="px-3 py-2 text-right font-medium text-foreground">Поток</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Накоп.</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => {
                  const cum = cumulativeMap.get(m.key) ?? 0
                  return (
                    <tr key={m.key} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap">{m.label}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="text-right text-emerald-600 font-medium mb-0.5">{formatCurrency(m.totalIn, true)}</div>
                        <Bar value={m.totalIn} max={maxIn} color="bg-emerald-400" />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="text-right text-red-500 font-medium mb-0.5">{formatCurrency(m.totalOut, true)}</div>
                        <Bar value={m.totalOut} max={maxOut} color="bg-red-400" />
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">{m.outCommission > 0 ? formatCurrency(m.outCommission, true) : "—"}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">{m.outLogistics > 0 ? formatCurrency(m.outLogistics, true) : "—"}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">{m.outReturns > 0 ? formatCurrency(m.outReturns, true) : "—"}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">{m.outAdvertising > 0 ? formatCurrency(m.outAdvertising, true) : "—"}</td>
                      <td className={`px-3 py-2.5 text-right font-semibold whitespace-nowrap ${m.net > 0 ? "text-emerald-600" : m.net < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                        {m.net > 0 ? "+" : ""}{formatCurrency(m.net, true)}
                      </td>
                      <td className={`px-3 py-2.5 text-right whitespace-nowrap ${cum >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {cum > 0 ? "+" : ""}{formatCurrency(cum, true)}
                      </td>
                    </tr>
                  )
                })}
                <tr className="border-t-2 bg-muted/30 font-semibold">
                  <td className="px-4 py-2.5">Итого</td>
                  <td className="px-3 py-2.5 text-right text-emerald-600">{formatCurrency(totals.totalIn, true)}</td>
                  <td className="px-3 py-2.5 text-right text-red-500">{formatCurrency(totals.totalOut, true)}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{formatCurrency(totals.outCommission, true)}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{formatCurrency(totals.outLogistics, true)}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{formatCurrency(totals.outReturns, true)}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{formatCurrency(totals.outAdvertising, true)}</td>
                  <td className={`px-3 py-2.5 text-right ${totals.net >= 0 ? "text-emerald-600" : "text-red-500"}`}>{totals.net > 0 ? "+" : ""}{formatCurrency(totals.net, true)}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {totals.totalOut > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Структура выбытий</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { label: "Себестоимость", value: totals.outCogs,        color: "bg-orange-400" },
                { label: "Комиссия МП",   value: totals.outCommission,  color: "bg-blue-400" },
                { label: "Логистика",     value: totals.outLogistics,   color: "bg-violet-400" },
                { label: "Возвраты",      value: totals.outReturns,     color: "bg-amber-400" },
                { label: "Хранение",      value: totals.outStorage,     color: "bg-cyan-400" },
                { label: "Реклама",       value: totals.outAdvertising, color: "bg-pink-400" },
                { label: "Штрафы",        value: totals.outPenalties,   color: "bg-red-400" },
              ]
                .filter((r) => r.value > 0)
                .sort((a, b) => b.value - a.value)
                .map((row) => {
                  const pct = (row.value / totals.totalOut) * 100
                  return (
                    <div key={row.label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-medium">{formatCurrency(row.value, true)} <span className="text-muted-foreground">({pct.toFixed(1)}%)</span></span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
