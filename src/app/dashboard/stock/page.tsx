import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatNumber } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { StockImportForm } from "./stock-import-form"

async function getStockData(userId: string) {
  const stores = await db.store.findMany({ where: { userId, isActive: true } })
  const storeIds = stores.map((s) => s.id)
  if (!storeIds.length) return { products: [], totalQty: 0, stores: [] }

  const snapshots = await db.stockSnapshot.findMany({
    where: { product: { storeId: { in: storeIds } } },
    include: {
      product: {
        include: { store: { select: { marketplace: true, name: true } } },
      },
    },
    orderBy: { date: "desc" },
  })

  // Группируем по товару. Берём только последнюю дату на товар.
  // Для каждого товара: Map<size, Map<warehouse, qty>>
  type ProductEntry = {
    id: string
    name: string
    externalId: string
    marketplace: string
    brand: string | null
    category: string | null
    date: Date
    seen: Set<string>  // "size|location" — дедупликация
    sizes: Map<string, Map<string, number>>
  }

  const productMap = new Map<string, ProductEntry>()

  // Определяем последнюю дату для каждого товара
  const latestDate = new Map<string, Date>()
  for (const snap of snapshots) {
    const pid = snap.product.id
    if (!latestDate.has(pid) || snap.date > latestDate.get(pid)!) {
      latestDate.set(pid, snap.date)
    }
  }

  for (const snap of snapshots) {
    const pid  = snap.product.id
    const last = latestDate.get(pid)!
    // Берём только самую свежую загрузку (в пределах 1 минуты от latest)
    if (Math.abs(snap.date.getTime() - last.getTime()) > 60_000) continue

    if (!productMap.has(pid)) {
      productMap.set(pid, {
        id: pid,
        name: snap.product.name,
        externalId: snap.product.externalId,
        marketplace: snap.product.store.marketplace,
        brand: snap.product.brand,
        category: snap.product.category,
        date: snap.date,
        seen: new Set(),
        sizes: new Map(),
      })
    }

    const entry = productMap.get(pid)!
    const dedupeKey = `${snap.size}|${snap.location}`
    if (entry.seen.has(dedupeKey)) continue
    entry.seen.add(dedupeKey)

    const size = snap.size || "б/р"
    if (!entry.sizes.has(size)) entry.sizes.set(size, new Map())
    entry.sizes.get(size)!.set(snap.location, snap.quantity)
  }

  const products = Array.from(productMap.values()).map((p) => {
    const sizeRows = Array.from(p.sizes.entries())
      .map(([size, whMap]) => {
        const warehouses = Array.from(whMap.entries())
          .map(([loc, qty]) => ({ loc, qty }))
          .filter((w) => w.qty > 0)
          .sort((a, b) => b.qty - a.qty)
        const total = warehouses.reduce((a, w) => a + w.qty, 0)
        return { size, total, warehouses }
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)

    const totalQty = sizeRows.reduce((a, r) => a + r.total, 0)
    return { ...p, sizeRows, totalQty }
  }).sort((a, b) => b.totalQty - a.totalQty)

  const totalQty = products.reduce((a, p) => a + p.totalQty, 0)
  return { products, totalQty, stores }
}

export default async function StockPage() {
  const session = await auth()
  if (!session?.user?.id) return null
  const { products, totalQty, stores } = await getStockData(session.user.id)
  const hasData = products.length > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Склад</h1>
        {hasData && (
          <span className="text-xs text-muted-foreground">
            {products[0].date.toLocaleDateString("ru-RU")}
          </span>
        )}
      </div>

      {!hasData && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <div className="text-amber-800">
            <p className="font-medium">Остатки не загружены</p>
            <p className="mt-0.5 text-amber-700">
              В личном кабинете WB: <strong>Аналитика → Отчёты → Товары на складах</strong>
            </p>
          </div>
        </div>
      )}

      {stores.length > 0 && (
        <StockImportForm stores={stores.map((s) => ({ id: s.id, name: s.name, marketplace: s.marketplace }))} />
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Всего на складах</p>
          <p className="text-xl font-bold mt-1">{formatNumber(totalQty)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Артикулов</p>
          <p className="text-xl font-bold mt-1">{formatNumber(products.length)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Нулевые остатки</p>
          <p className="text-xl font-bold mt-1 text-red-500">
            {formatNumber(products.filter((p) => p.totalQty === 0).length)}
          </p>
        </CardContent></Card>
      </div>

      {/* Products table with size breakdown */}
      {hasData && (
        <div className="space-y-2">
          {products.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-0">
                {/* Product header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[10px] px-1 h-4">{p.marketplace}</Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">{p.externalId}</span>
                      {p.brand && <span className="text-[10px] text-muted-foreground">{p.brand}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-lg font-bold ${
                      p.totalQty === 0 ? "text-red-500" :
                      p.totalQty < 10 ? "text-amber-600" : "text-emerald-600"
                    }`}>
                      {formatNumber(p.totalQty)}
                    </span>
                    <p className="text-[10px] text-muted-foreground">шт</p>
                  </div>
                </div>

                {/* Size rows */}
                <div className="divide-y">
                  {p.sizeRows.map(({ size, total, warehouses }) => (
                    <div key={size} className="px-4 py-2 flex items-start gap-3">
                      {/* Size badge */}
                      <div className="w-20 shrink-0 pt-0.5">
                        <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">{size}</span>
                      </div>
                      {/* Warehouses */}
                      <div className="flex-1 flex flex-wrap gap-1">
                        {warehouses.map(({ loc, qty }) => (
                          <span
                            key={loc}
                            className="rounded border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {loc}: <span className="font-semibold text-foreground">{qty}</span>
                          </span>
                        ))}
                      </div>
                      {/* Size total */}
                      <div className="shrink-0 text-sm font-semibold text-right w-10">
                        {formatNumber(total)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
