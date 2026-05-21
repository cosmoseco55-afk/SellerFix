import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { AdImportForm } from "./ad-import-form"
import { AdTable } from "./ad-table"
import { AdStatusTabs } from "./ad-status-tabs"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { CampaignStatus } from "@prisma/client"
import { Suspense } from "react"

function parseDateParam(val: string | undefined, fallback: Date): Date {
  if (!val) return fallback
  const d = new Date(val)
  return isNaN(d.getTime()) ? fallback : d
}

async function getAdStats(userId: string, fromDate: Date, toDate: Date) {
  const stores = await db.store.findMany({ where: { userId, isActive: true } })
  const storeIds = stores.map((s) => s.id)
  if (!storeIds.length) return { rows: [], totalSpend: 0, totalRevenue: 0, totalOrders: 0, stores: [], counts: { ALL: 0, ACTIVE: 0, PAUSED: 0, ARCHIVED: 0 } }

  const adSpends = await db.adSpend.findMany({
    where: { storeId: { in: storeIds }, date: { gte: fromDate, lte: toDate }, campaignType: { not: "STORAGE" } },
    include: {
      product: { select: { name: true, externalId: true, category: true } },
      store: { select: { marketplace: true } },
    },
    orderBy: { date: "desc" },
  })

  const products = await db.product.findMany({
    where: { storeId: { in: storeIds } },
    include: { orders: { where: { isReturn: false, date: { gte: fromDate, lte: toDate } }, select: { revenue: true } } },
  })
  const revenueByProduct = new Map(
    products.map((p) => [p.id, p.orders.reduce((a, o) => a + o.revenue, 0)])
  )

  type ProductRow = {
    campaignId: string; campaignName: string; campaignType: string; status: CampaignStatus
    productId: string | null; productName: string; externalId: string; marketplace: string
    spend: number; impressions: number; clicks: number; adOrders: number; adRevenue: number
  }
  const productMap = new Map<string, ProductRow>()

  for (const ad of adSpends) {
    const key = ad.campaignId || ad.campaignName
    if (!productMap.has(key)) {
      productMap.set(key, {
        campaignId: ad.campaignId, campaignName: ad.campaignName, campaignType: ad.campaignType,
        status: ad.status, productId: ad.productId,
        productName: ad.product?.name ?? ad.campaignName,
        externalId: ad.product?.externalId ?? "—",
        marketplace: ad.store.marketplace,
        spend: 0, impressions: 0, clicks: 0, adOrders: 0, adRevenue: 0,
      })
    }
    const row = productMap.get(key)!
    row.spend       += ad.spend
    row.impressions += ad.impressions
    row.clicks      += ad.clicks
    row.adOrders    += ad.ordersCount
    row.adRevenue   += ad.revenue
  }

  const allRows = Array.from(productMap.values()).map((r) => {
    const totalRevenue = r.productId ? (revenueByProduct.get(r.productId) ?? 0) : r.adRevenue
    const drr  = totalRevenue > 0 ? (r.spend / totalRevenue) * 100 : 0
    const ctr  = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0
    const cpc  = r.clicks > 0 ? r.spend / r.clicks : 0
    const roas = r.spend > 0 ? r.adRevenue / r.spend : 0
    return { ...r, totalRevenue, drr, ctr, cpc, roas }
  }).sort((a, b) => b.spend - a.spend)

  const counts = {
    ALL:      allRows.length,
    ACTIVE:   allRows.filter((r) => r.status === "ACTIVE").length,
    PAUSED:   allRows.filter((r) => r.status === "PAUSED").length,
    ARCHIVED: allRows.filter((r) => r.status === "ARCHIVED").length,
  }

  const totalSpend   = allRows.reduce((a, r) => a + r.spend, 0)
  const totalRevenue = products.reduce((a, p) => a + (revenueByProduct.get(p.id) ?? 0), 0)
  const totalOrders  = allRows.reduce((a, r) => a + r.adOrders, 0)

  return { rows: allRows, totalSpend, totalRevenue, totalOrders, stores, counts }
}

type PageProps = { searchParams: Promise<{ status?: string; from?: string; to?: string }> }

export default async function AdvertisingPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) return null

  const { status: statusParam, from: fromParam, to: toParam } = await searchParams
  const activeTab = (statusParam ?? "ALL") as "ALL" | "ACTIVE" | "PAUSED" | "ARCHIVED"

  const defaultFrom = new Date(0)
  const defaultTo   = new Date(); defaultTo.setHours(23,59,59,999)

  const fromDate = parseDateParam(fromParam, defaultFrom)
  const toDate   = parseDateParam(toParam,   defaultTo)
  toDate.setHours(23, 59, 59, 999)

  const { rows, totalSpend, totalRevenue, totalOrders, stores, counts } = await getAdStats(session.user.id, fromDate, toDate)

  const filtered   = activeTab === "ALL" ? rows : rows.filter((r) => r.status === activeTab)
  const totalDrr   = totalRevenue > 0 ? (totalSpend / totalRevenue) * 100 : 0
  const hasData    = rows.length > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-lg font-semibold">Реклама</h1>
        <Suspense><DateRangePicker defaultFrom={fromParam} defaultTo={toParam} /></Suspense>
      </div>

      {!hasData && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <div className="text-amber-800">
            <p className="font-medium">Данные по рекламе не загружены</p>
            <p className="mt-0.5 text-amber-700">
              В кабинете WB: <strong>Реклама → Статистика → Экспорт</strong>
            </p>
          </div>
        </div>
      )}

      {stores.length > 0 && (
        <AdImportForm stores={stores.map((s) => ({ id: s.id, name: s.name, marketplace: s.marketplace }))} />
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Расходы на рекламу</p>
          <p className="text-xl font-bold mt-1">{formatCurrency(totalSpend, true)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Выручка (общая)</p>
          <p className="text-xl font-bold mt-1">{formatCurrency(totalRevenue, true)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">ДРР</p>
          <p className={`text-xl font-bold mt-1 ${totalDrr === 0 ? "" : totalDrr <= 15 ? "text-emerald-600" : totalDrr <= 25 ? "text-amber-600" : "text-red-500"}`}>
            {formatPercent(totalDrr)}
          </p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Заказов с рекламы</p>
          <p className="text-xl font-bold mt-1">{formatNumber(totalOrders)}</p>
        </CardContent></Card>
      </div>

      {hasData && (
        <Card>
          <CardHeader className="pb-0 pt-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Кампании</CardTitle>
              <AdStatusTabs active={activeTab} counts={counts} />
            </div>
          </CardHeader>
          <CardContent className="p-0 mt-2">
            <AdTable rows={filtered.map((r) => ({
              campaignId:   r.campaignId,
              campaignName: r.campaignName,
              campaignType: r.campaignType,
              status:       r.status,
              productName:  r.productName,
              externalId:   r.externalId,
              marketplace:  r.marketplace,
              spend:        r.spend,
              drr:          r.drr,
              impressions:  r.impressions,
              clicks:       r.clicks,
              ctr:          r.ctr,
              cpc:          r.cpc,
              roas:         r.roas,
              adOrders:     r.adOrders,
            }))} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
