import { db } from "@/lib/db"
import { parseWbReport } from "./wb"
import { parseOzonReport } from "./ozon"
import { Marketplace } from "@prisma/client"

export interface ImportResult {
  created: number
  skipped: number
  errors: string[]
}

const WB_SALE_TYPES = ["продажа", "sale"]
const WB_RETURN_TYPES = ["возврат", "return", "сторно продаж"]

function isWbSale(op: string) {
  return WB_SALE_TYPES.some((t) => op.toLowerCase().includes(t))
}
function isWbReturn(op: string) {
  return WB_RETURN_TYPES.some((t) => op.toLowerCase().includes(t))
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

      if (!isSale && !isReturn) {
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

      await db.order.create({
        data: {
          storeId,
          productId,
          date: row.date,
          revenue: isSale ? Math.abs(row.revenue) : 0,
          commission: row.commission,
          logistics: row.logistics,
          storage: row.storage,
          penalties: row.penalties,
          compensations: row.compensations,
          returns: isReturn ? Math.abs(row.revenue) : 0,
          quantity: row.quantity || 1,
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
  if (marketplace === "WB") return importWbReport(storeId, buffer)
  return importOzonReport(storeId, buffer)
}
