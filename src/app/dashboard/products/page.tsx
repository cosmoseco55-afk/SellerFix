import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { CogsInput } from "./cogs-input"
import { Suspense } from "react"

function parseDateParam(val: string | undefined, fallback: Date): Date {
  if (!val) return fallback
  const d = new Date(val)
  return isNaN(d.getTime()) ? fallback : d
}

async function getProductStats(userId: string, fromDate: Date, toDate: Date) {
  const stores = await db.store.findMany({ where: { userId, isActive: true } })
  const storeIds = stores.map((s) => s.id)
  if (!storeIds.length) return []

  const products = await db.product.findMany({
    where: { storeId: { in: storeIds } },
    include: {
      store: { select: { marketplace: true, name: true } },
      orders: { where: { isReturn: false, date: { gte: fromDate, lte: toDate } } },
    },
  })

  return products
    .map((p) => {
      const revenue    = p.orders.reduce((a, o) => a + o.revenue, 0)
      const commission = p.orders.reduce((a, o) => a + o.commission, 0)
      const logistics  = p.orders.reduce((a, o) => a + o.logistics, 0)
      const storage    = p.orders.reduce((a, o) => a + o.storage, 0)
      const returns    = p.orders.reduce((a, o) => a + o.returns, 0)
      const penalties  = p.orders.reduce((a, o) => a + o.penalties, 0)
      const compensations = p.orders.reduce((a, o) => a + o.compensations, 0)
      // Количество только из строк реальных продаж (revenue > 0), не логистика/хранение
      const quantity   = p.orders.reduce((a, o) => a + (o.revenue > 0 ? o.quantity : 0), 0)

      // Себестоимость = цена закупки × кол-во проданных
      const cogs   = p.cogsPerUnit * quantity
      const costs  = commission + logistics + storage + cogs
      const profit = revenue - costs - returns - penalties + compensations
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0
      const roi    = costs > 0 ? (profit / costs) * 100 : 0

      let abc = "C"
      if (margin >= 20) abc = "A"
      else if (margin >= 10) abc = "B"

      return {
        id: p.id, name: p.name, externalId: p.externalId,
        category: p.category, marketplace: p.store.marketplace,
        cogsPerUnit: p.cogsPerUnit,
        revenue, commission, logistics, storage, returns, cogs, costs,
        quantity, profit, margin, roi, abc,
      }
    })
    .filter((p) => p.quantity > 0 || p.revenue > 0)
    .sort((a, b) => b.profit - a.profit)
}

type PageProps = { searchParams: Promise<{ from?: string; to?: string }> }

export default async function ProductsPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) return null

  const { from: fromParam, to: toParam } = await searchParams

  const defaultFrom = new Date(0)
  const defaultTo   = new Date(); defaultTo.setHours(23,59,59,999)

  const fromDate = parseDateParam(fromParam, defaultFrom)
  const toDate   = parseDateParam(toParam,   defaultTo)
  toDate.setHours(23, 59, 59, 999)

  const products = await getProductStats(session.user.id, fromDate, toDate)

  const totalRevenue = products.reduce((a, p) => a + p.revenue, 0)
  const totalProfit  = products.reduce((a, p) => a + p.profit, 0)
  const totalQty     = products.reduce((a, p) => a + p.quantity, 0)
  const avgMargin    = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
  const hasCogs      = products.some((p) => p.cogsPerUnit > 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-lg font-semibold">Товары</h1>
        <Suspense><DateRangePicker defaultFrom={fromParam} defaultTo={toParam} /></Suspense>
      </div>

      {!hasCogs && products.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
          💡 Укажите себестоимость (₽/шт) в таблице ниже — прибыль и маржа станут точнее
        </div>
      )}

      {products.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-center">
          <div>
            <p className="font-medium">Нет данных за выбранный период</p>
            <p className="text-sm text-muted-foreground mt-1">
              <a href="/dashboard/import" className="text-primary hover:underline">Загрузите отчёт</a> или выберите другой период
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Выручка</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(totalRevenue, true)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Прибыль</p>
              <p className={`text-xl font-bold mt-1 ${totalProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {formatCurrency(totalProfit, true)}
              </p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Маржа</p>
              <p className={`text-xl font-bold mt-1 ${avgMargin >= 15 ? "text-emerald-600" : avgMargin >= 0 ? "text-amber-600" : "text-red-500"}`}>
                {formatPercent(avgMargin)}
              </p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Продано шт</p>
              <p className="text-xl font-bold mt-1">{formatNumber(totalQty)}</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Все товары ({products.length})
                <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                  — колонка «Себест.» редактируется
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground">Товар</th>
                      <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground">Шт</th>
                      <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground">Выручка</th>
                      <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground">Комиссия</th>
                      <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground">Логистика</th>
                      <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground">Хранение</th>
                      <th className="px-3 py-2 text-right font-medium text-xs text-amber-600">Себест. ₽/шт</th>
                      <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground">Прибыль</th>
                      <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground">Маржа</th>
                      <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground">ROI</th>
                      <th className="px-3 py-2 text-center font-medium text-xs text-muted-foreground">ABC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <p className="font-medium truncate max-w-[220px]">{p.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge variant="outline" className="text-[10px] px-1 h-4">{p.marketplace}</Badge>
                            {p.category && <span className="text-[10px] text-muted-foreground">{p.category}</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs">{formatNumber(p.quantity)}</td>
                        <td className="px-3 py-2.5 text-right text-xs">{formatCurrency(p.revenue, true)}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">{formatCurrency(p.commission, true)}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">{formatCurrency(p.logistics, true)}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">{formatCurrency(p.storage, true)}</td>
                        <td className="px-3 py-2.5">
                          <CogsInput productId={p.id} initialValue={p.cogsPerUnit} />
                        </td>
                        <td className={`px-3 py-2.5 text-right text-xs font-semibold ${p.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {formatCurrency(p.profit, true)}
                        </td>
                        <td className={`px-3 py-2.5 text-right text-xs ${p.margin >= 15 ? "text-emerald-600" : p.margin >= 0 ? "text-amber-600" : "text-red-500"}`}>
                          {formatPercent(p.margin)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs">{formatPercent(p.roi)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            p.abc === "A" ? "bg-emerald-100 text-emerald-700" :
                            p.abc === "B" ? "bg-amber-100 text-amber-700" :
                            "bg-red-100 text-red-700"
                          }`}>{p.abc}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
