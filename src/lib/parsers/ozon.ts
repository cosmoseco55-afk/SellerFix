import * as XLSX from "xlsx"

export interface OzonRow {
  date: Date
  operationType: string
  vendorArticle: string
  productName: string
  category: string
  quantity: number
  price: number
  commission: number
  logistics: number
  returnLogistics: number
  lastMileLogistics: number
  processingFee: number
  reverseLogistics: number
  penalties: number
  compensations: number
  total: number // итого к начислению
}

const COL_ALIASES: Record<string, string> = {
  "дата": "date",
  "дата операции": "date",
  "период": "date",
  "тип операции": "operationType",
  "тип начисления": "operationType",
  "артикул продавца": "vendorArticle",
  "артикул": "vendorArticle",
  "название товара": "productName",
  "наименование": "productName",
  "тип товара": "category",
  "категория": "category",
  "количество": "quantity",
  "цена продажи": "price",
  "стоимость товара": "price",
  "комиссия за продажу": "commission",
  "вознаграждение": "commission",
  "логистика": "logistics",
  "стоимость доставки": "logistics",
  "обратная логистика": "reverseLogistics",
  "последняя миля": "lastMileLogistics",
  "стоимость последней мили": "lastMileLogistics",
  "обработка возврата": "processingFee",
  "штрафы": "penalties",
  "компенсация": "compensations",
  "итого": "total",
  "к начислению": "total",
  "сумма начислений": "total",
}

function normalizeKey(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ")
}

function parseDate(val: unknown): Date {
  if (val instanceof Date) return val
  if (typeof val === "number") {
    return new Date(Math.round((val - 25569) * 86400 * 1000))
  }
  if (typeof val === "string") {
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d
    const m = val.match(/(\d{2})\.(\d{2})\.(\d{4})/)
    if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}`)
  }
  return new Date()
}

function num(val: unknown): number {
  if (typeof val === "number") return val
  if (typeof val === "string") {
    const n = parseFloat(val.replace(",", ".").replace(/\s/g, ""))
    return isNaN(n) ? 0 : n
  }
  return 0
}

export function parseOzonReport(buffer: Buffer): OzonRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })

  if (raw.length === 0) return []

  const firstRow = raw[0]
  const keyMap: Record<string, string> = {}
  for (const colName of Object.keys(firstRow)) {
    const alias = COL_ALIASES[normalizeKey(colName)]
    if (alias) keyMap[colName] = alias
  }

  const rows: OzonRow[] = []
  for (const row of raw) {
    const opType = String(row[Object.keys(keyMap).find((k) => keyMap[k] === "operationType") ?? ""] ?? "")
    if (!opType) continue

    const get = (field: string): unknown => {
      const col = Object.keys(keyMap).find((k) => keyMap[k] === field)
      return col ? row[col] : undefined
    }

    rows.push({
      date: parseDate(get("date")),
      operationType: opType,
      vendorArticle: String(get("vendorArticle") ?? ""),
      productName: String(get("productName") ?? ""),
      category: String(get("category") ?? ""),
      quantity: Math.abs(num(get("quantity"))),
      price: num(get("price")),
      commission: Math.abs(num(get("commission"))),
      logistics: Math.abs(num(get("logistics"))),
      returnLogistics: Math.abs(num(get("returnLogistics"))),
      lastMileLogistics: Math.abs(num(get("lastMileLogistics"))),
      processingFee: Math.abs(num(get("processingFee"))),
      reverseLogistics: Math.abs(num(get("reverseLogistics"))),
      penalties: Math.abs(num(get("penalties"))),
      compensations: Math.abs(num(get("compensations"))),
      total: num(get("total")),
    })
  }

  return rows
}
