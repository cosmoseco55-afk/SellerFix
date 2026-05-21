import { db } from "@/lib/db"
import { parseWbReport } from "./wb"
import { parseOzonReport } from "./ozon"
import { parseWbStockReport } from "./wb-stock"
import { parseWbAdsReport } from "./wb-ads"
import { parseWbWeeklyReport, isWbWeeklyFormat } from "./wb-weekly"
import { parseWbOrdersReport, isWbOrderReport, classifyStatus } from "./wb-orders"
import { Marketplace } from "@prisma/client"

export interface ImportResult {
  created: number
  skipped: number
  errors: string[]
}

const WB_SALE_TYPES = ["продажа", "sale"]
const WB_RETURN_TYPES = ["возврат", "return", "сторно продаж"]
const WB_LOGISTICS_TYPES = ["логистика", "доставка"]
const WB_STORAGE_TYPES = ["хранение"]
const WB_PENALTY_TYPES = ["штраф", "удержан"]

function isWbSale(op: string) {
  return WB_SALE_TYPES.some((t) => op.toLowerCase().includes(t))
}
function isWbReturn(op: string) {
  return WB_RETURN_TYPES.some((t) => op.toLowerCase().includes(t))
}
function isWbLogistics(op: string) {
  return WB_LOGISTICS_TYPES.some((t) => op.toLowerCase().includes(t))
}
function isWbStorage(op: string) {
  return WB_STORAGE_TYPES.some((t) => op.toLowerCase().includes(t))
}
function isWbPenalty(op: string) {
  return WB_PENALTY_TYPES.some((t) => op.toLowerCase().includes(t))
}

const OZON_SALE_TYPES = ["начисление", "продажа", "реализация"]
const OZON_RETURN_TYPES = ["возврат", "отмена"]

function isOzonSale(op: string) {
  return OZON_SALE_TYPES.some((t) => op.toLowerCase().includes(t))
}
function isOzonReturn(op: string) {
  return OZON_RETURN_TYPES.some((t) => op.toLowerCase().includes(t))
}

export async function importWbReport(
  storeId: string,
  buffer: Buffer
): Promise<ImportResult> {
  const rows = parseWbReport(buffer)
  const result: ImportResult = { created: 0, skipped: 0, errors: [] }

  // Ensure products exist
  const productCache = new Map<string, string>() // vendorArticle -> productId

  for (const row of rows) {
    try {
      const isSale = isWbSale(row.operationType)
      const isReturn = isWbReturn(row.operationType)
      const isLogistics = isWbLogistics(row.operationType)
      const isStorage = isWbStorage(row.operationType)
      const isPenalty = isWbPenalty(row.operationType)

      if (!isSale && !isReturn && !isLogistics && !isStorage && !isPenalty) {
        result.skipped++
        continue
      }

      const article = row.vendorArticle || row.wbArticle || row.productName
      if (!article) {
        result.skipped++
        continue
      }

      // Upsert product
      if (!productCache.has(article)) {
        const product = await db.product.upsert({
          where: { storeId_externalId: { storeId, externalId: article } },
          create: {
            storeId,
            externalId: article,
            name: row.productName || article,
            category: row.category || row.subject || null,
          },
          update: {
            name: row.productName || article,
            category: row.category || row.subject || null,
          },
        })
        productCache.set(article, product.id)
      }

      const productId = productCache.get(article)!

      // "Сторно продаж" — финансовая корректировка, НЕ физический возврат (qty=0)
      const isSторно = row.operationType.toLowerCase().includes("сторно")
      const physicalQty = isSale ? (row.quantity || 1)
        : isReturn ? (isSторно ? 0 : (row.quantity || 1))
        : 0

      await db.order.create({
        data: {
          storeId,
          productId,
          date:          row.date,
          revenue:       isSale      ? Math.abs(row.revenue)   : 0,
          commission:    isSale      ? row.commission          : 0,
          // Логистика: отдельные строки "Логистика" → колонка logistics, fallback → "к перечислению" (revenue)
          logistics:     isLogistics ? (Math.abs(row.logistics) || Math.abs(row.revenue)) : (isSale ? row.logistics : 0),
          // Хранение: отдельные строки "Хранение" → колонка storage, fallback → "к перечислению" (revenue)
          storage:       isStorage   ? (Math.abs(row.storage)   || Math.abs(row.revenue)) : (isSale ? row.storage : 0),
          penalties:     isPenalty   ? Math.abs(row.revenue)   : (isSale ? row.penalties : 0),
          compensations: isSale      ? row.compensations       : 0,
          returns:       isReturn    ? Math.abs(row.revenue)   : 0,
          quantity:      physicalQty,
          isReturn,
        },
      })

      result.created++
    } catch (e) {
      result.errors.push(String(e))
    }
  }

  // Update lastSyncAt
  await db.store.update({
    where: { id: storeId },
    data: { lastSyncAt: new Date() },
  })

  await db.syncLog.create({
    data: {
      storeId,
      status: result.errors.length === 0 ? "SUCCESS" : "PARTIAL",
      message: `Импорт WB: +${result.created} записей, пропущено ${result.skipped}`,
    },
  })

  return result
}

export async function importOzonReport(
  storeId: string,
  buffer: Buffer
): Promise<ImportResult> {
  const rows = parseOzonReport(buffer)
  const result: ImportResult = { created: 0, skipped: 0, errors: [] }

  const productCache = new Map<string, string>()

  for (const row of rows) {
    try {
      const isSale = isOzonSale(row.operationType)
      const isReturn = isOzonReturn(row.operationType)

      if (!isSale && !isReturn) {
        result.skipped++
        continue
      }

      const article = row.vendorArticle || row.productName
      if (!article) {
        result.skipped++
        continue
      }

      if (!productCache.has(article)) {
        const product = await db.product.upsert({
          where: { storeId_externalId: { storeId, externalId: article } },
          create: {
            storeId,
            externalId: article,
            name: row.productName || article,
            category: row.category || null,
          },
          update: {
            name: row.productName || article,
            category: row.category || null,
          },
        })
        productCache.set(article, product.id)
      }

      const productId = productCache.get(article)!
      const totalRevenue = isSale ? Math.abs(row.total) : 0

      await db.order.create({
        data: {
          storeId,
          productId,
          date: row.date,
          revenue: totalRevenue,
          commission: row.commission,
          logistics: row.logistics + row.lastMileLogistics + row.returnLogistics,
          penalties: row.penalties,
          compensations: row.compensations,
          returns: isReturn ? Math.abs(row.total) : 0,
          quantity: row.quantity || 1,
          isReturn,
        },
      })

      result.created++
    } catch (e) {
      result.errors.push(String(e))
    }
  }

  await db.store.update({
    where: { id: storeId },
    data: { lastSyncAt: new Date() },
  })

  await db.syncLog.create({
    data: {
      storeId,
      status: result.errors.length === 0 ? "SUCCESS" : "PARTIAL",
      message: `Импорт Ozon: +${result.created} записей, пропущено ${result.skipped}`,
    },
  })

  return result
}

export async function importReport(
  storeId: string,
  marketplace: Marketplace,
  buffer: Buffer
): Promise<ImportResult> {
  if (marketplace === "WB") {
    if (isWbOrderReport(buffer))  return importWbOrdersReport(storeId, buffer)
    if (isWbWeeklyFormat(buffer)) return importWbWeeklyReport(storeId, buffer)
    return importWbReport(storeId, buffer)
  }
  return importOzonReport(storeId, buffer)
}

/** Импорт отчёта заказов WB — для расчёта процента выкупа */
export async function importWbOrdersReport(
  storeId: string,
  buffer: Buffer
): Promise<ImportResult> {
  const rows = parseWbOrdersReport(buffer)
  const result: ImportResult = { created: 0, skipped: 0, errors: [] }
  if (!rows.length) { result.errors.push("Не удалось распознать формат отчёта заказов"); return result }

  // Получаем существующие товары магазина
  const products = await db.product.findMany({ where: { storeId }, select: { id: true, externalId: true } })
  const productCache = new Map(products.map((p) => [p.externalId, p.id]))

  // Группируем по дате + артикул
  type DayKey = string
  type Stat = { ordered: number; bought: number; cancelled: number; productId: string | null; date: Date }
  const statMap = new Map<DayKey, Stat>()

  for (const row of rows) {
    const article = row.vendorArticle || row.wbArticle || row.productName
    const productId = article ? (productCache.get(article) ?? null) : null
    const dateKey = row.date.toISOString().slice(0, 10)
    const key = `${dateKey}_${article || "store"}`

    if (!statMap.has(key)) {
      statMap.set(key, { ordered: 0, bought: 0, cancelled: 0, productId, date: row.date })
    }
    const s = statMap.get(key)!
    const kind = classifyStatus(row.status)
    // ordered = только решённые заказы (выкуп + отказ + возврат), не "в пути"
    if (kind !== "pending") s.ordered += row.quantity
    if (kind === "bought")    s.bought    += row.quantity
    if (kind === "cancelled") s.cancelled += row.quantity
  }

  // Удаляем старые статы для этого магазина
  await db.orderStat.deleteMany({ where: { storeId } })

  for (const stat of statMap.values()) {
    try {
      await db.orderStat.create({
        data: {
          storeId,
          productId: stat.productId,
          date:      stat.date,
          ordered:   stat.ordered,
          bought:    stat.bought,
          cancelled: stat.cancelled,
        },
      })
      result.created++
    } catch (e) {
      result.errors.push(String(e))
    }
  }
  return result
}

/** Импорт сводного финансового отчёта WB — сохраняет хранение и другие расходы */
export async function importWbWeeklyReport(
  storeId: string,
  buffer: Buffer
): Promise<ImportResult> {
  const rows = parseWbWeeklyReport(buffer)
  const result: ImportResult = { created: 0, skipped: 0, errors: [] }
  if (!rows.length) { result.errors.push("Не удалось распознать формат отчёта"); return result }

  // Удаляем старые STORAGE-записи из adSpend для этого магазина
  await db.adSpend.deleteMany({ where: { storeId, campaignType: "STORAGE" } })

  for (const row of rows) {
    try {
      if (row.storage > 0) {
        await db.adSpend.create({
          data: {
            storeId,
            productId:    null,
            date:         row.dateFrom,
            campaignId:   "storage",
            campaignName: "Хранение WB",
            campaignType: "STORAGE",
            spend:        row.storage,
          },
        })
        result.created++
      } else {
        result.skipped++
      }
    } catch (e) {
      result.errors.push(String(e))
    }
  }
  return result
}

export async function importWbStockReport(
  storeId: string,
  buffer: Buffer
): Promise<ImportResult> {
  const rows = parseWbStockReport(buffer)
  const result: ImportResult = { created: 0, skipped: 0, errors: [] }

  const now = new Date()

  // Группируем по артикулу → { meta, sizes: Map<size, Map<warehouse, qty>> }
  type StockEntry = {
    productName: string
    brand: string
    subject: string
    sizes: Map<string, Map<string, number>>   // size → warehouse → qty
  }
  const articleMap = new Map<string, StockEntry>()

  for (const row of rows) {
    const key = row.vendorArticle || row.productName
    if (!key) continue

    if (!articleMap.has(key)) {
      articleMap.set(key, {
        productName: row.productName,
        brand: row.brand,
        subject: row.subject,
        sizes: new Map(),
      })
    }
    const entry = articleMap.get(key)!
    const size  = row.size || "б/р"
    const wh    = row.warehouse || "WB"

    if (!entry.sizes.has(size)) entry.sizes.set(size, new Map())
    const whMap = entry.sizes.get(size)!
    whMap.set(wh, (whMap.get(wh) ?? 0) + row.currentStock)
  }

  // Сохраняем
  for (const [key, entry] of articleMap) {
    try {
      const product = await db.product.upsert({
        where: { storeId_externalId: { storeId, externalId: key } },
        create: {
          storeId,
          externalId: key,
          name: entry.productName || key,
          category: entry.subject || null,
          brand: entry.brand || null,
        },
        update: {
          name: entry.productName || key,
          category: entry.subject || null,
          brand: entry.brand || null,
        },
      })

      // Snapshot: одна запись на каждый размер × склад
      for (const [size, whMap] of entry.sizes) {
        for (const [wh, qty] of whMap) {
          await db.stockSnapshot.create({
            data: {
              productId: product.id,
              date: now,
              quantity: qty,
              location: wh,
              size,
            },
          })
        }
      }

      result.created++
    } catch (e) {
      result.errors.push(String(e))
    }
  }

  await db.store.update({
    where: { id: storeId },
    data: { lastSyncAt: new Date() },
  })

  await db.syncLog.create({
    data: {
      storeId,
      status: result.errors.length === 0 ? "SUCCESS" : "PARTIAL",
      message: `Импорт остатков WB: +${result.created} записей, пропущено ${result.skipped}`,
    },
  })

  return result
}

export async function importWbAdsReport(
  storeId: string,
  buffer: Buffer
): Promise<ImportResult> {
  const rows = parseWbAdsReport(buffer)
  const result: ImportResult = { created: 0, skipped: 0, errors: [] }

  // Удаляем старые записи рекламы этого магазина перед импортом (избегаем дублей)
  await db.adSpend.deleteMany({ where: { storeId } })

  for (const row of rows) {
    try {
      if (!row.campaignName) { result.skipped++; continue }
      if (row.spend === 0 && row.impressions === 0) { result.skipped++; continue }

      await db.adSpend.create({
        data: {
          storeId,
          productId: null,
          date: row.startDate,
          campaignId: row.campaignId,
          campaignName: row.campaignName,
          campaignType: [row.section, row.bidType].filter(Boolean).join(" / "),
          status: row.status,
          endDate: row.endDate ?? null,
          impressions: row.impressions,
          clicks: row.clicks,
          spend: row.spend,
          ordersCount: row.orders,
          revenue: 0,
        },
      })
      result.created++
    } catch (e) {
      result.errors.push(String(e))
    }
  }

  await db.store.update({ where: { id: storeId }, data: { lastSyncAt: new Date() } })

  await db.syncLog.create({
    data: {
      storeId,
      status: result.errors.length === 0 ? "SUCCESS" : "PARTIAL",
      message: `Импорт рекламы WB: +${result.created} кампаний, пропущено ${result.skipped}`,
    },
  })

  return result
}
