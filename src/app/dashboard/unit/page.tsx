import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { CogsInput } from "@/app/dashboard/products/cogs-input"
import { Suspense } from "react"

function parseDateParam(val: string | undefined, fallback: Date): Date {
  if (!val) return fallback
  const d = new Date(val)
  return isNaN(d.getTime()) ? fallback : d
}

type UnitRow = {
  id: string; name: string; externalId: string
  marketplace: string; storeName: string; cogsPerUnit: number
  quantity: number; revenue: number
  avgPrice: number; commPU: number; logsPU: number; storPU: number
  cogs: number; adPerUnit: number; totalCostPU: number
  profitPU: number; margin: number; roi: number
  storageSource: "order" | "weekly"  // откуда взято хранение
  breakdown: { comm: number; logs: number; stor: number; cogs: number; ads: number; ret: number }
}

async function getUnitData(userId: string, fromDate: Date, toDate: Date): Promise<UnitRow[]> {
  const stores = await db.store.findMany({ where: { userId, isActive: true } })
  const storeIds = stores.map((s) => s.id)
  if (!storeIds.length) return []

  // Реклама и хранение — store-level, распределяем пропорционально выручке
  const allSpends = await db.adSpend.findMany({
    where: { storeId: { in: storeIds }, date: { gte: fromDate, lte: toDate } },
    select: { spend: true, campaignType: true },
  })
  const totalAdSpend      = allSpends.filter((s) => s.campaignType !== "STORAGE").reduce((a, s) => a + s.spend, 0)
  const totalStorageSpend = allSpends.filter((s) => s.campaignType === "STORAGE").reduce((a, s) => a + s.spend, 0)

  const products = await db.product.findMany({
    where: { storeId: { in: storeIds } },
    include: {
      store: { select: { marketplace: true, name: true } },
      orders: {
        where: { isReturn: false, date: { gte: fromDate, lte: toDate } },
        select: { revenue: true, commission: true, logistics: true, storage: true, quantity: true, returns: true, penalties: true, compensations: true },
      },
    },
  })

  // Суммарная выручка по всем товарам — для пропорционального распределения рекламы
  let totalRevenue = 0
  for (const p of products) {
    for (const o of p.orders) {
      if (o.revenue > 0) totalRevenue += o.revenue
    }
  }

  const result: UnitRow[] = []

  for (const p of products) {
    let revenue = 0, commission = 0, logistics = 0, storage = 0, quantity = 0
    let returns = 0, penalties = 0, compensations = 0

    for (const o of p.orders) {
      commission    += o.commission
      logistics     += o.logistics
      storage       += o.storage
      compensations += o.compensations
      returns       += o.returns
      penalties     += o.penalties
      if (o.revenue > 0) {
        revenue  += o.revenue
        quantity += o.quantity
      }
    }

    if (quantity === 0 && revenue === 0) continue

    // Доля выручки для пропорционального распределения store-level расходов
    const revenueShare = totalRevenue > 0 && revenue > 0 ? revenue / totalRevenue : 0

    // Реклама — пропорционально выручке
    const adPerUnit = quantity > 0 ? (totalAdSpend * revenueShare) / quantity : 0

    // Хранение: сначала из детализированного отчёта (строки Order.storage)
    // если 0 — берём из сводного финансового отчёта (campaignType="STORAGE")
    let finalStorage = storage
    let storageSource: "order" | "weekly" = "order"
    if (finalStorage === 0 && totalStorageSpend > 0) {
      finalStorage = totalStorageSpend * revenueShare
      storageSource = "weekly"
    }

    const cogs = p.cogsPerUnit

    // На 1 шт
    const avgPrice    = quantity > 0 ? revenue / quantity : 0
    const commPU      = quantity > 0 ? commission / quantity : 0
    const logsPU      = quantity > 0 ? logistics / quantity : 0
    const storPU      = quantity > 0 ? finalStorage / quantity : 0
    const retPU       = quantity > 0 ? returns / quantity : 0
    const penPU       = quantity > 0 ? penalties / quantity : 0
    const compPU      = quantity > 0 ? compensations / quantity : 0
    const totalCostPU = commPU + logsPU + storPU + cogs + adPerUnit
    const profitPU    = avgPrice - totalCostPU - retPU - penPU + compPU
    const margin      = avgPrice > 0 ? (profitPU / avgPrice) * 100 : 0
    const roi         = totalCostPU > 0 ? (profitPU / totalCostPU) * 100 : 0
    const breakdown   = avgPrice > 0 ? {
      comm: (commPU    / avgPrice) * 100,
      logs: (logsPU    / avgPrice) * 100,
      stor: (storPU    / avgPrice) * 100,
      cogs: (cogs      / avgPrice) * 100,
      ads:  (adPerUnit / avgPrice) * 100,
      ret:  (retPU     / avgPrice) * 100,
    } : { comm: 0, logs: 0, stor: 0, cogs: 0, ads: 0, ret: 0 }

    result.push({
      id: p.id, name: p.name, externalId: p.externalId,
      marketplace: p.store.marketplace, storeName: p.store.name,
      cogsPerUnit: p.cogsPerUnit,
      quantity, revenue,
      avgPrice, commPU, logsPU, storPU, cogs, adPerUnit,
      totalCostPU, profitPU, margin, roi, storageSource, breakdown,
    })
  }

  return result.sort((a, b) => b.profitPU - a.profitPU)
}

// ─── Цветная полоска разбивки цены ───────────────────────────────────────────

function BreakdownBar({ bd }: { bd: { comm: number; logs: number; stor: number; cogs: number; ads: number; ret: number } }) {
  const profit = Math.max(0, 100 - bd.comm - bd.logs - bd.stor - bd.cogs - bd.ads - bd.ret)
  const segments = [
    { pct: bd.cogs,   color: "bg-amber-400",   title: "Себест." },
    { pct: bd.comm,   color: "bg-blue-400",     title: "Комиссия" },
    { pct: bd.logs,   color: "bg-purple-400",   title: "Логистика" },
    { pct: bd.stor,   color: "bg-indigo-300",   title: "Хранение" },
    { pct: bd.ads,    color: "bg-orange-400",   title: "Реклама" },
    { pct: bd.ret,    color: "bg-red-400",      title: "Возвраты" },
    { pct: profit,    color: "bg-emerald-400",  title: "Прибыль" },
  ]
  return (
    <div className="flex h-2 w-28 overflow-hidden rounded-full bg-muted">
      {segments.map((s, i) =>
        s.pct > 0 ? (
          <div
            key={i}
            className={`${s.color} h-full`}
            style={{ width: `${Math.min(s.pct, 100)}%` }}
            title={`${s.title}: ${s.pct.toFixed(1)}%`}
          />
        ) : null
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

type PageProps = { searchParams: Promise<{ from?: string; to?: string }> }

export default async function UnitPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) return null

  const { from: fromParam, to: toParam } = await searchParams

  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
  const defaultTo   = new Date(now); defaultTo.setHours(23, 59, 59, 999)

  const fromDate = parseDateParam(fromParam, defaultFrom)
  const toDate   = parseDateParam(toParam, defaultTo)
  toDate.setHours(23, 59, 59, 999)

  const rows = await getUnitData(session.user.id, fromDate, toDate)
  const hasCogs = rows.some((r) => r.cogsPerUnit > 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold">Юнит-экономика</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Прибыль и затраты на 1 проданную единицу товара</p>
        </div>
        <Suspense><DateRangePicker defaultFrom={fromParam} defaultTo={toParam} /></Suspense>
      </div>

      {/* Легенда */}
      <div className="flex flex-wrap gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-[11px]">
        {[
          { color: "bg-amber-400",  label: "Себестоимость" },
          { color: "bg-blue-400",   label: "Комиссия МП" },
          { color: "bg-purple-400", label: "Логистика" },
          { color: "bg-indigo-300", label: "Хранение" },
          { color: "bg-orange-400", label: "Реклама" },
          { color: "bg-red-400",    label: "Возвраты" },
          { color: "bg-emerald-400",label: "Прибыль" },
        ].map((item) => (
          <span key={item.label} className="flex items-center gap-1.5 text-muted-foreground">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${item.color}`} />
            {item.label}
          </span>
        ))}
      </div>

      {!hasCogs && rows.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          💡 Себестоимость не указана — прибыль на 1 шт. занижена. Укажите её в столбце «Себест.» ниже или на странице{" "}
          <a href="/dashboard/products" className="underline font-medium">Товары</a>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border bg-muted/30 text-center">
          <div>
            <p className="font-medium">Нет данных за выбранный период</p>
            <p className="text-sm text-muted-foreground mt-1">
              <a href="/dashboard/import" className="text-primary hover:underline">Загрузите отчёт</a> или выберите другой период
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-white dark:bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: 1000 }}>
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="py-2.5 pl-4 pr-2 text-left font-medium text-muted-foreground">Товар</th>
                  <th className="py-2.5 px-3 text-right font-medium text-muted-foreground">Шт</th>
                  <th className="py-2.5 px-3 text-right font-medium text-muted-foreground">Цена</th>
                  <th className="py-2.5 px-3 text-right font-medium text-amber-600">Себест.</th>
                  <th className="py-2.5 px-3 text-right font-medium text-blue-600">Комиссия</th>
                  <th className="py-2.5 px-3 text-right font-medium text-purple-600">Логистика</th>
                  <th className="py-2.5 px-3 text-right font-medium text-indigo-500">
                    <span>Хранение</span>
                    <span className="block font-normal text-[10px] text-muted-foreground">/шт</span>
                  </th>
                  <th className="py-2.5 px-3 text-right font-medium text-orange-500">
                    <span>Реклама</span>
                    <span className="block font-normal text-[10px] text-muted-foreground">пропорц.</span>
                  </th>
                  <th className="py-2.5 px-3 text-right font-medium text-muted-foreground">Итого затрат</th>
                  <th className="py-2.5 px-3 text-right font-medium text-muted-foreground">Прибыль/шт</th>
                  <th className="py-2.5 px-3 text-right font-medium text-muted-foreground">Маржа</th>
                  <th className="py-2.5 px-3 text-right font-medium text-muted-foreground">ROI</th>
                  <th className="py-2.5 px-3 text-left font-medium text-muted-foreground">Разбивка</th>
                </tr>
              </thead>
              <tbody>
                {/* Строка формулы */}
                <tr className="border-b bg-muted/20">
                  <td colSpan={2} className="py-1.5 pl-4 pr-2 text-[10px] text-muted-foreground italic">Прибыль/шт =</td>
                  <td className="py-1.5 px-3 text-right text-[10px] text-muted-foreground">Цена</td>
                  <td className="py-1.5 px-3 text-right text-[10px] text-amber-500">− Себест.</td>
                  <td className="py-1.5 px-3 text-right text-[10px] text-blue-500">− Комиссия</td>
                  <td className="py-1.5 px-3 text-right text-[10px] text-purple-500">− Логистика</td>
                  <td className="py-1.5 px-3 text-right text-[10px] text-indigo-400">− Хранение</td>
                  <td className="py-1.5 px-3 text-right text-[10px] text-orange-400">− Реклама</td>
                  <td colSpan={5} className="py-1.5 px-3 text-[10px] text-muted-foreground">− Возвраты − Штрафы + Компенсации</td>
                </tr>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 pl-4 pr-2">
                      <p className="font-medium truncate max-w-[200px]">{r.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="rounded border px-1 py-px text-[10px] text-muted-foreground">{r.marketplace}</span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{r.storeName}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">{formatNumber(r.quantity)}</td>
                    <td className="py-2.5 px-3 text-right font-semibold">{formatCurrency(r.avgPrice)}</td>
                    <td className="py-2.5 px-3">
                      <CogsInput productId={r.id} initialValue={r.cogsPerUnit} />
                    </td>
                    <td className="py-2.5 px-3 text-right text-blue-600">{formatCurrency(r.commPU)}</td>
                    <td className="py-2.5 px-3 text-right text-purple-600">{formatCurrency(r.logsPU)}</td>
                    <td className="py-2.5 px-3 text-right text-indigo-500">{formatCurrency(r.storPU)}</td>
                    <td className="py-2.5 px-3 text-right text-orange-500">
                      {formatCurrency(r.adPerUnit)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">{formatCurrency(r.totalCostPU)}</td>
                    <td className={`py-2.5 px-3 text-right font-bold ${r.profitPU >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {formatCurrency(r.profitPU)}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-medium ${r.margin >= 20 ? "text-emerald-600" : r.margin >= 10 ? "text-amber-600" : "text-red-500"}`}>
                      {formatPercent(r.margin)}
                    </td>
                    <td className={`py-2.5 px-3 text-right ${r.roi >= 30 ? "text-emerald-600" : r.roi >= 0 ? "text-amber-600" : "text-red-500"}`}>
                      {formatPercent(r.roi)}
                    </td>
                    <td className="py-2.5 px-3">
                      <BreakdownBar bd={r.breakdown} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
