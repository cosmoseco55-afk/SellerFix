import * as XLSX from "xlsx"

export interface WbStockRow {
  vendorArticle: string   // Артикул продавца
  wbArticle: string       // Артикул WB
  productName: string     // Наименование
  brand: string
  subject: string
  size: string
  warehouse: string       // Склад
  orderedQty: number      // шт. (заказано)
  purchasedQty: number    // Выкупили, шт.
  currentStock: number    // Текущий остаток, шт.
}

// Ключевые слова для поиска заголовка (строка с "Артикул продавца")
const HEADER_MARKERS = ["артикул продавца", "артикул wb", "наименование"]

const FIELD_KEYWORDS: Array<{ field: string; keywords: string[] }> = [
  { field: "brand",         keywords: ["бренд"] },
  { field: "subject",       keywords: ["предмет"] },
  { field: "productName",   keywords: ["наименование"] },
  { field: "vendorArticle", keywords: ["артикул продавца"] },
  { field: "wbArticle",     keywords: ["артикул wb"] },
  { field: "size",          keywords: ["размер"] },
  { field: "warehouse",     keywords: ["склад"] },
  { field: "orderedQty",    keywords: ["шт."] },
  { field: "purchasedQty",  keywords: ["выкупили"] },
  { field: "currentStock",  keywords: ["текущий остаток"] },
]

function buildKeyMap(headers: string[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const { field, keywords } of FIELD_KEYWORDS) {
    for (const kw of keywords) {
      const idx = headers.findIndex((h) => h.toLowerCase().trim().includes(kw))
      if (idx >= 0) {
        map.set(field, idx)
        break
      }
    }
  }
  return map
}

function num(val: unknown): number {
  if (typeof val === "number") return val
  if (typeof val === "string") {
    const n = parseFloat(val.replace(",", ".").replace(/\s/g, ""))
    return isNaN(n) ? 0 : n
  }
  return 0
}

export function parseWbStockReport(buffer: Buffer): WbStockRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rawAll = (XLSX.utils.sheet_to_json(sheet, { defval: "", header: 1 }) as unknown) as unknown[][]

  // Найти строку заголовка
  let headerRowIdx = 0
  for (let i = 0; i < Math.min(10, rawAll.length); i++) {
    const row = rawAll[i] as unknown[]
    const joined = row.map((c) => String(c ?? "").toLowerCase()).join("|")
    if (HEADER_MARKERS.some((m) => joined.includes(m))) {
      headerRowIdx = i
      break
    }
  }

  const headers = (rawAll[headerRowIdx] as unknown[]).map((c) => String(c ?? ""))
  const keyMap = buildKeyMap(headers)

  const rows: WbStockRow[] = []
  for (let i = headerRowIdx + 1; i < rawAll.length; i++) {
    const rawRow = rawAll[i] as unknown[]

    const get = (field: string): unknown => {
      const idx = keyMap.get(field)
      return idx !== undefined ? rawRow[idx] : undefined
    }

    const vendorArticle = String(get("vendorArticle") ?? "").trim()
    const productName   = String(get("productName") ?? "").trim()
    if (!vendorArticle && !productName) continue

    rows.push({
      vendorArticle,
      wbArticle:    String(get("wbArticle") ?? "").trim(),
      productName,
      brand:        String(get("brand") ?? "").trim(),
      subject:      String(get("subject") ?? "").trim(),
      size:         String(get("size") ?? "").trim(),
      warehouse:    String(get("warehouse") ?? "").trim() || "WB",
      orderedQty:   Math.abs(num(get("orderedQty"))),
      purchasedQty: Math.abs(num(get("purchasedQty"))),
      currentStock: Math.abs(num(get("currentStock"))),
    })
  }

  return rows
}
