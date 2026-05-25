import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { MultiSelectFilter } from "@/components/ui/multi-select-filter"
import { Suspense } from "react"
import { TrendingUp, TrendingDown } from "lucide-react"

// ─── types ───────────────────────────────────────────────────────────────────

type Metrics = {
  revenue: number
  realization: number
  cogs: number
  commission: number
  logistics: number
  storage: number
  advertising: number
  returns: number
  penalties: number
  compensations: number
  quantity: number      // продано (выкуплено) шт
  returnQty: number     // возвращено шт
  orderCount: number
}

function empty(): Metrics {
  return { revenue: 0, realization: 0, cogs: 0, commission: 0, logistics: 0, storage: 0, advertising: 0, returns: 0, penalties: 0, compensations: 0, quantity: 0, returnQty: 0, orderCount: 0 }
}

function parseDateParam(val: string | undefined, fallback: Date): Date {
  if (!val) return fallback
  const d = new Date(val)
  return isNaN(d.getTime()) ? fallback : d
}

// ─── data ────────────────────────────────────────────────────────────────────

type Filters = {
  storeIds: string[]
  marketplaces: string[]
  categories: string[]
  brands: string[]
  groups: string[]
  articles: string[]
}

async function getData(userId: string, fromDate: Date, toDate: Date, filters: Filters) {
  const allStores = await db.store.findMany({ where: { userId, isActive: true } })
  if (!allStores.length) return null

  // Применяем фильтры магазинов и маркетплейсов
  let storeIds = allStores.map((s) => s.id)
  if (filters.storeIds.length) storeIds = storeIds.filter((id) => filters.storeIds.includes(id))
  if (filters.marketplaces.length) {
    const mpFiltered = allStores.filter((s) => filters.marketplaces.includes(s.marketplace)).map((s) => s.id)
    storeIds = storeIds.filter((id) => mpFiltered.includes(id))
  }
  if (!storeIds.length) storeIds = ["__none__"]

  // Загружаем все товары с учётом фильтров по категории/бренду/группе/артикулу
  const productWhere: Record<string, unknown> = { storeId: { in: storeIds } }
  if (filters.categories.length)  productWhere.category   = { in: filters.categories }
  if (filters.brands.length)      productWhere.brand      = { in: filters.brands }
  if (filters.groups.length)      productWhere.group      = { in: filters.groups }
  if (filters.articles.length)    productWhere.externalId = { in: filters.articles }

  const allProducts = await db.product.findMany({
    where: { storeId: { in: allStores.map((s) => s.id) } },
    select: { id: true, name: true, cogsPerUnit: true, category: true, brand: true, group: true, externalId: true },
  })

  // Если есть фильтры по товарам — сужаем список product ids
  let filteredProductIds: string[] | null = null
  if (filters.categories.length || filters.brands.length || filters.groups.length || filters.articles.length) {
    filteredProductIds = allProducts
      .filter((p) => {
        if (filters.categories.length && !filters.categories.includes(p.category ?? "")) return false
        if (filters.brands.length     && !filters.brands.includes(p.brand ?? ""))         return false
        if (filters.groups.length     && !filters.groups.includes(p.group ?? ""))         return false
        if (filters.articles.length   && !filters.articles.includes(p.externalId))        return false
        return true
      })
      .map((p) => p.id)
    if (!filteredProductIds.length) filteredProductIds = ["__none__"]
  }

  const cogsMap = new Map(allProducts.map((p) => [p.id, p.cogsPerUnit]))

  const periodMs = toDate.getTime() - fromDate.getTime()
  const prevFrom = new Date(fromDate.getTime() - periodMs - 86400000)
  const prevTo   = new Date(fromDate.getTime() - 86400000)
  prevTo.setHours(23, 59, 59, 999)

  const orderWhere = (from: Date, to: Date) => ({
    storeId: { in: storeIds },
    date: { gte: from, lte: to },
    ...(filteredProductIds ? { productId: { in: filteredProductIds } } : {}),
  })

  const [orders, prevOrders, adSpends, prevAdSpends, snapshots, orderStats, prevOrderStats] = await Promise.all([
    db.order.findMany({
      where: orderWhere(fromDate, toDate),
      select: { isReturn: true, revenue: true, commission: true, logistics: true, storage: true, compensations: true, returns: true, penalties: true, quantity: true, productId: true },
    }),
    db.order.findMany({
      where: orderWhere(prevFrom, prevTo),
      select: { isReturn: true, revenue: true, commission: true, logistics: true, storage: true, compensations: true, returns: true, penalties: true, quantity: true, productId: true },
    }),
    db.adSpend.findMany({ where: { storeId: { in: storeIds }, date: { gte: fromDate, lte: toDate } }, select: { spend: true, campaignType: true } }),
    db.adSpend.findMany({ where: { storeId: { in: storeIds }, date: { gte: prevFrom, lte: prevTo } }, select: { spend: true, campaignType: true } }),
    db.stockSnapshot.findMany({
      where: { product: { storeId: { in: storeIds } } },
      orderBy: { date: "desc" },
      take: 1000,
      select: { quantity: true, date: true },
    }),
    db.orderStat.findMany({ where: { storeId: { in: storeIds }, date: { gte: fromDate, lte: toDate } }, select: { ordered: true, bought: true } }),
    db.orderStat.findMany({ where: { storeId: { in: storeIds }, date: { gte: prevFrom, lte: prevTo } }, select: { ordered: true, bought: true } }),
  ])

  const sumSpends = (spends: { spend: number; campaignType: string }[]) => ({
    ad:      spends.filter((s) => s.campaignType !== "STORAGE").reduce((a, s) => a + s.spend, 0),
    storage: spends.filter((s) => s.campaignType === "STORAGE").reduce((a, s) => a + s.spend, 0),
  })

  const calcMetrics = (rows: typeof orders, adTotal: number, storageTotal: number): Metrics => {
    const m = empty()
    m.advertising = adTotal
    for (const o of rows) {
      const unitCogs = o.productId ? (cogsMap.get(o.productId) ?? 0) : 0
      if (o.isReturn) {
        m.returnQty += o.quantity   // считаем возвращённые штуки
        m.returns   += o.returns
        m.penalties += o.penalties
      } else {
        m.commission    += o.commission
        m.logistics     += o.logistics
        m.storage       += o.storage
        m.compensations += o.compensations
        m.penalties     += o.penalties
        if (o.revenue > 0) {
          m.revenue    += o.revenue
          m.cogs       += unitCogs * o.quantity
          m.quantity   += o.quantity
          m.orderCount += 1
        }
      }
    }
    // Если хранение из order = 0, берём из сводного финансового отчёта
    if (m.storage === 0 && storageTotal > 0) m.storage = storageTotal
    // Реализация = продано + возвращено (в штуках — для % выкупа)
    m.realization = m.quantity + m.returnQty
    return m
  }

  const curSpends  = sumSpends(adSpends)
  const prevSpends = sumSpends(prevAdSpends)
  const cur  = calcMetrics(orders,     curSpends.ad,  curSpends.storage)
  const prev = calcMetrics(prevOrders, prevSpends.ad, prevSpends.storage)

  // Топ товаров
  type PStat = { id: string; name: string; revenue: number; cogs: number; commission: number; logistics: number; storage: number; returns: number; penalties: number; compensations: number; quantity: number }
  const productMap = new Map<string, PStat>()
  for (const o of orders) {
    if (!o.productId) continue
    const unitCogs = cogsMap.get(o.productId) ?? 0
    if (!productMap.has(o.productId)) {
      const p = allProducts.find((x) => x.id === o.productId)
      productMap.set(o.productId, { id: o.productId, name: p?.name ?? "—", revenue: 0, cogs: 0, commission: 0, logistics: 0, storage: 0, returns: 0, penalties: 0, compensations: 0, quantity: 0 })
    }
    const ps = productMap.get(o.productId)!
    if (!o.isReturn) {
      ps.commission    += o.commission
      ps.logistics     += o.logistics
      ps.storage       += o.storage
      ps.compensations += o.compensations
      if (o.revenue > 0) { ps.revenue += o.revenue; ps.cogs += unitCogs * o.quantity; ps.quantity += o.quantity }
    }
    ps.returns   += o.returns
    ps.penalties += o.penalties
  }
  const topProducts = Array.from(productMap.values())
    .map((p) => {
      const net = p.revenue - p.cogs - p.commission - p.logistics - p.storage - p.returns - p.penalties + p.compensations
      return { ...p, net, margin: p.revenue > 0 ? (net / p.revenue) * 100 : 0 }
    })
    .filter((p) => p.revenue > 0)
    .sort((a, b) => b.net - a.net)
    .slice(0, 10)

  // Остатки
  const latestDate = snapshots[0]?.date
  const stockQty   = latestDate
    ? snapshots.filter((s) => Math.abs(new Date(s.date).getTime() - new Date(latestDate).getTime()) < 60000).reduce((a, s) => a + s.quantity, 0)
    : 0

  // Опции для фильтров
  const filterOptions = {
    stores:      allStores.map((s) => ({ value: s.id, label: s.name })),
    marketplaces: [...new Set(allStores.map((s) => s.marketplace))].map((m) => ({ value: m, label: m })),
    categories:  [...new Set(allProducts.map((p) => p.category).filter(Boolean))].map((c) => ({ value: c!, label: c! })),
    brands:      [...new Set(allProducts.map((p) => p.brand).filter(Boolean))].map((b) => ({ value: b!, label: b! })),
    groups:      [...new Set(allProducts.map((p) => p.group).filter(Boolean))].map((g) => ({ value: g!, label: g! })),
    articles:    allProducts.map((p) => ({ value: p.externalId, label: `${p.name} (${p.externalId})` })),
  }

  const osOrdered     = orderStats.reduce((a, s) => a + s.ordered, 0)
  const osBought      = orderStats.reduce((a, s) => a + s.bought,  0)
  const prevOsOrdered = prevOrderStats.reduce((a, s) => a + s.ordered, 0)
  const prevOsBought  = prevOrderStats.reduce((a, s) => a + s.bought,  0)

  return { cur, prev, topProducts, stockQty, filterOptions, osOrdered, osBought, prevOsOrdered, prevOsBought }
}

// ─── Widget ──────────────────────────────────────────────────────────────────

type WidgetColor = "green" | "pink" | "white"

function Widget({ label, value, secondary, prevValue, prevSecondary, color = "white", invertDelta = false, unit = "₽" }: {
  label: string; value: number; secondary?: string; prevValue: number; prevSecondary?: string
  color?: WidgetColor; invertDelta?: boolean; unit?: string
}) {
  const delta    = value - prevValue
  const deltaPct = prevValue !== 0 ? (delta / Math.abs(prevValue)) * 100 : 0
  const isUp     = delta > 0
  const isGood   = invertDelta ? !isUp : isUp
  const hasDelta = prevValue !== 0

  const bg = color === "green" ? "bg-[#e8f5e9] dark:bg-emerald-950/30"
    : color === "pink" ? "bg-[#fce4ec] dark:bg-rose-950/30"
    : "bg-white dark:bg-card border border-border"

  const fmt = (v: number) => unit === "₽" ? formatCurrency(v, true) : unit === "%" ? formatPercent(v) : formatNumber(v)

  return (
    <div className={`rounded-xl p-4 flex flex-col gap-2 ${bg}`}>
      <p className="text-xs text-muted-foreground font-medium leading-tight">{label}</p>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-[22px] font-bold leading-none">{fmt(value)}</span>
        {secondary && <span className="text-sm text-muted-foreground font-medium">/ {secondary}</span>}
      </div>
      {hasDelta && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-xs font-medium ${isGood ? "text-emerald-600" : "text-red-500"}`}>
            {delta > 0 ? "+" : ""}{fmt(delta)}
          </span>
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isGood ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
            {fmt(prevValue)}{prevSecondary ? ` / ${prevSecondary}` : ""} ({deltaPct > 0 ? "+" : ""}{deltaPct.toFixed(0)}%)
          </span>
          {isUp ? <TrendingUp className={`h-3 w-3 ${isGood ? "text-emerald-500" : "text-red-400"}`} />
                : <TrendingDown className={`h-3 w-3 ${isGood ? "text-emerald-500" : "text-red-400"}`} />}
        </div>
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

type PageProps = { searchParams: Promise<Record<string, string | undefined>> }

export default async function OtsifrovkaPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) return null

  const sp = await searchParams
  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
  const defaultTo   = new Date(now); defaultTo.setHours(23, 59, 59, 999)

  const fromDate = parseDateParam(sp.from, defaultFrom)
  const toDate   = parseDateParam(sp.to,   defaultTo)
  toDate.setHours(23, 59, 59, 999)

  const split = (key: string) => (sp[key] ? sp[key]!.split(",").filter(Boolean) : [])

  const filters: Filters = {
    storeIds:    split("stores"),
    marketplaces:split("mp"),
    categories:  split("cat"),
    brands:      split("brand"),
    groups:      split("group"),
    articles:    split("article"),
  }

  const data = await getData(session.user.id, fromDate, toDate, filters)

  if (!data) {
    return (
      <div className="flex h-48 items-center justify-center text-center rounded-xl border bg-muted/30">
        <div>
          <p className="font-medium">Нет подключённых магазинов</p>
          <p className="text-sm text-muted-foreground mt-1">
            <a href="/dashboard/stores" className="text-primary hover:underline">Подключить магазин</a>
          </p>
        </div>
      </div>
    )
  }

  const { cur, prev, topProducts, stockQty, filterOptions, osOrdered, osBought, prevOsOrdered, prevOsBought } = data

  const netProfit     = cur.revenue - cur.cogs - cur.commission - cur.logistics - cur.storage - cur.advertising - cur.returns - cur.penalties + cur.compensations
  const prevNetProfit = prev.revenue - prev.cogs - prev.commission - prev.logistics - prev.storage - prev.advertising - prev.returns - prev.penalties + prev.compensations
  const margin        = cur.revenue > 0 ? (netProfit / cur.revenue) * 100 : 0
  const prevMargin    = prev.revenue > 0 ? (prevNetProfit / prev.revenue) * 100 : 0
  const roi           = (cur.cogs + cur.commission + cur.logistics + cur.storage + cur.advertising) > 0 ? (netProfit / (cur.cogs + cur.commission + cur.logistics + cur.storage + cur.advertising)) * 100 : 0
  const prevRoi       = (prev.cogs + prev.commission + prev.logistics + prev.storage + prev.advertising) > 0 ? (prevNetProfit / (prev.cogs + prev.commission + prev.logistics + prev.storage + prev.advertising)) * 100 : 0
  const drr           = cur.revenue > 0 ? (cur.advertising / cur.revenue) * 100 : 0
  const prevDrr       = prev.revenue > 0 ? (prev.advertising / prev.revenue) * 100 : 0
  const commPct       = cur.revenue > 0 ? (cur.commission    / cur.revenue) * 100 : 0
  const logsPct       = cur.revenue > 0 ? (cur.logistics     / cur.revenue) * 100 : 0
  const storPct       = cur.revenue > 0 ? (cur.storage       / cur.revenue) * 100 : 0
  const cogsPct       = cur.revenue > 0 ? (cur.cogs          / cur.revenue) * 100 : 0
  const compPct       = cur.revenue > 0 ? (cur.compensations / cur.revenue) * 100 : 0
  const prevCommPct   = prev.revenue > 0 ? (prev.commission    / prev.revenue) * 100 : 0
  const prevLogsPct   = prev.revenue > 0 ? (prev.logistics     / prev.revenue) * 100 : 0
  const prevStorPct   = prev.revenue > 0 ? (prev.storage       / prev.revenue) * 100 : 0
  const prevCogsPct   = prev.revenue > 0 ? (prev.cogs          / prev.revenue) * 100 : 0
  const prevCompPct   = prev.revenue > 0 ? (prev.compensations / prev.revenue) * 100 : 0
  const avgPrice      = cur.quantity > 0 ? cur.revenue / cur.quantity : 0
  const prevAvgPrice  = prev.quantity > 0 ? prev.revenue / prev.quantity : 0
  const avgLog        = cur.quantity > 0 ? cur.logistics / cur.quantity : 0
  const prevAvgLog    = prev.quantity > 0 ? prev.logistics / prev.quantity : 0
  const avgProfit     = cur.quantity > 0 ? netProfit / cur.quantity : 0
  const prevAvgProfit = prev.quantity > 0 ? prevNetProfit / prev.quantity : 0
  // Процент выкупа — из отчёта заказов если загружен, иначе из финансового отчёта
  const hasOrderStats = osOrdered > 0
  const buyoutPct     = hasOrderStats
    ? (osBought      / osOrdered)     * 100
    : (cur.quantity  + cur.returnQty  > 0 ? (cur.quantity  / (cur.quantity  + cur.returnQty))  * 100 : 0)
  const prevBuyoutPct = hasOrderStats
    ? (prevOsOrdered > 0 ? (prevOsBought / prevOsOrdered) * 100 : 0)
    : (prev.quantity + prev.returnQty > 0 ? (prev.quantity / (prev.quantity + prev.returnQty)) * 100 : 0)

  const noData = cur.revenue === 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold">Оцифровка</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Общие показатели</p>
        </div>
        <Suspense>
          <DateRangePicker defaultFrom={sp.from} defaultTo={sp.to} />
        </Suspense>
      </div>

      {/* Filters row */}
      <Suspense>
        <div className="flex flex-wrap gap-2">
          <MultiSelectFilter param="mp"      label="Маркетплейсы" options={filterOptions.marketplaces} />
          <MultiSelectFilter param="stores"  label="Магазины"     options={filterOptions.stores} />
          {filterOptions.brands.length > 0     && <MultiSelectFilter param="brand"   label="Бренды"       options={filterOptions.brands} />}
          {filterOptions.categories.length > 0 && <MultiSelectFilter param="cat"     label="Категории"    options={filterOptions.categories} />}
          {filterOptions.groups.length > 0      && <MultiSelectFilter param="group"   label="Группы"       options={filterOptions.groups} />}
          {filterOptions.articles.length > 0    && <MultiSelectFilter param="article" label="Артикулы"     options={filterOptions.articles} />}
        </div>
      </Suspense>

      {noData ? (
        <div className="flex h-48 items-center justify-center text-center rounded-xl border bg-muted/30">
          <div>
            <p className="font-medium">Нет данных за выбранный период</p>
            <p className="text-sm text-muted-foreground mt-1">
              <a href="/dashboard/import" className="text-primary hover:underline">Загрузите отчёт</a> или измените фильтры
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Widgets */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <Widget label="Чистая прибыль / Маржинальность" value={netProfit} prevValue={prevNetProfit} secondary={`${margin.toFixed(2)} %`} prevSecondary={`${prevMargin.toFixed(2)} %`} color={netProfit >= 0 ? "green" : "pink"} />
            <Widget label="ROI" value={roi} prevValue={prevRoi} unit="%" color={roi >= 0 ? "green" : "pink"} />
            <Widget label="Продажи" value={cur.revenue} prevValue={prev.revenue} secondary={`${formatNumber(cur.quantity)} шт`} prevSecondary={`${formatNumber(prev.quantity)} шт`} />
            <Widget label="Возвраты (шт)" value={cur.returnQty} prevValue={prev.returnQty} unit="шт" color="pink" invertDelta />
            <Widget label="Заказы" value={cur.orderCount} prevValue={prev.orderCount} unit="шт" />
            <Widget
              label={hasOrderStats ? "Процент выкупа" : "Процент выкупа (прибл.)"}
              value={buyoutPct} prevValue={prevBuyoutPct} unit="%"
              color={buyoutPct >= 60 ? "green" : "white"}
              secondary={hasOrderStats ? `${formatNumber(osOrdered)} заказов` : undefined}
            />
            {cur.cogs > 0 && <Widget label="Себестоимость продаж" value={cur.cogs} prevValue={prev.cogs} secondary={`${cogsPct.toFixed(2)} %`} prevSecondary={`${prevCogsPct.toFixed(2)} %`} color="pink" invertDelta />}
            <Widget label="Комиссия МП" value={cur.commission} prevValue={prev.commission} secondary={`${commPct.toFixed(2)} %`} prevSecondary={`${prevCommPct.toFixed(2)} %`} color="pink" invertDelta />
            <Widget label="Логистика" value={cur.logistics} prevValue={prev.logistics} secondary={`${logsPct.toFixed(2)} %`} prevSecondary={`${prevLogsPct.toFixed(2)} %`} color="pink" invertDelta />
            <Widget label="Хранение" value={cur.storage} prevValue={prev.storage} secondary={`${storPct.toFixed(2)} %`} prevSecondary={`${prevStorPct.toFixed(2)} %`} color="pink" invertDelta />
            <Widget label="Реклама / ДРР" value={cur.advertising} prevValue={prev.advertising} secondary={`${drr.toFixed(2)} %`} prevSecondary={`${prevDrr.toFixed(2)} %`} color="pink" invertDelta />
            <Widget label="Возвраты" value={cur.returns} prevValue={prev.returns} color="pink" invertDelta />
            {(cur.penalties > 0 || prev.penalties > 0) && <Widget label="Штрафы / прочие удержания" value={cur.penalties} prevValue={prev.penalties} color="pink" invertDelta />}
            {(cur.compensations > 0 || prev.compensations > 0) && <Widget label="Компенсации" value={cur.compensations} prevValue={prev.compensations} secondary={`${compPct.toFixed(2)} %`} prevSecondary={`${prevCompPct.toFixed(2)} %`} color="green" />}
            <Widget label="Средняя цена продажи" value={avgPrice} prevValue={prevAvgPrice} />
            <Widget label="Ср. логистика на 1 шт." value={avgLog} prevValue={prevAvgLog} color="pink" invertDelta />
            <Widget label="Средняя прибыль на 1 шт." value={avgProfit} prevValue={prevAvgProfit} color={avgProfit >= 0 ? "green" : "pink"} />
            {stockQty > 0 && <Widget label="Остатки на складах" value={stockQty} prevValue={0} unit="шт" />}
          </div>

          {/* Топ товаров */}
          {topProducts.length > 0 && (
            <div className="rounded-xl border bg-white dark:bg-card overflow-hidden">
              <div className="px-4 pt-4 pb-3 border-b">
                <h2 className="text-sm font-semibold">Топ {topProducts.length} товаров по прибыли</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ minWidth: 700 }}>
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="py-2 pl-4 pr-2 text-left font-medium text-muted-foreground">Товар</th>
                      <th className="py-2 px-3 text-right font-medium text-muted-foreground">Шт</th>
                      <th className="py-2 px-3 text-right font-medium text-muted-foreground">Продажи</th>
                      <th className="py-2 px-3 text-right font-medium text-muted-foreground">Комиссия</th>
                      <th className="py-2 px-3 text-right font-medium text-muted-foreground">Логистика</th>
                      <th className="py-2 px-3 text-right font-medium text-muted-foreground">Прибыль</th>
                      <th className="py-2 px-3 text-right font-medium text-muted-foreground">Маржа</th>
                      <th className="py-2 px-3 text-right font-medium text-muted-foreground">Доля выручки</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p) => {
                      const share = cur.revenue > 0 ? (p.revenue / cur.revenue) * 100 : 0
                      return (
                        <tr key={p.id} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="py-2.5 pl-4 pr-2 font-medium truncate max-w-[200px]">{p.name}</td>
                          <td className="py-2.5 px-3 text-right">{formatNumber(p.quantity)}</td>
                          <td className="py-2.5 px-3 text-right">{formatCurrency(p.revenue, true)}</td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground">{formatCurrency(p.commission, true)}</td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground">{formatCurrency(p.logistics, true)}</td>
                          <td className={`py-2.5 px-3 text-right font-semibold ${p.net >= 0 ? "text-emerald-600" : "text-red-500"}`}>{formatCurrency(p.net, true)}</td>
                          <td className={`py-2.5 px-3 text-right ${p.margin >= 15 ? "text-emerald-600" : p.margin >= 0 ? "text-amber-600" : "text-red-500"}`}>{formatPercent(p.margin)}</td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full bg-primary/50" style={{ width: `${Math.min(share, 100)}%` }} />
                              </div>
                              <span className="text-muted-foreground w-9 text-right">{share.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
