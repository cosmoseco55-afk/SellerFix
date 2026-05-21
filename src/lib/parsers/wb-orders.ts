import * as XLSX from "xlsx"

export interface WbOrderRow {
  date:            Date
  vendorArticle:   string
  productName:     string
  wbArticle:       string
  quantity:        number
  price:           number
  status:          string
}

// Статусы WB заказов → выкуплен
const BOUGHT_STATUSES = [
  "выкуплен", "доставлен", "у покупателя", "получен покупателем",
  "продажа", "завершён", "закрыт",
]

// Статусы → отменён / не выкуплен
const CANCELLED_STATUSES = [
  "отменён", "отменен", "возврат", "не выкуплен", "отказ",
  "нет в наличии", "недоставлен", "утилизирован", "брак",
]

export function isWbOrderReport(buffer: Buffer): boolean {
  try {
    const wb = XLSX.read(buffer, { type: "buffer" })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rawAll = XLSX.utils.sheet_to_json<unknown[]>(sheet, { defval: "", header: 1 }) as unknown[][]
    for (let i = 0; i < Math.min(5, rawAll.length); i++) {
      const joined = rawAll[i].map((c) => String(c ?? "").toLowerCase()).join("|")
      if (joined.includes("статус") && (joined.includes("дата заказа") || joined.includes("дата принятия"))) return true
    }
    return false
  } catch { return false }
}

export function parseWbOrdersReport(buffer: Buffer): WbOrderRow[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rawAll = XLSX.utils.sheet_to_json<unknown[]>(sheet, { defval: "", header: 1 }) as unknown[][]

  // Найти заголовок
  let headerIdx = 0
  for (let i = 0; i < Math.min(10, rawAll.length); i++) {
    const joined = rawAll[i].map((c) => String(c ?? "").toLowerCase()).join("|")
    if (joined.includes("статус") && (joined.includes("заказа") || joined.includes("артикул"))) {
      headerIdx = i; break
    }
  }

  const headers = rawAll[headerIdx].map((c) => String(c ?? "").toLowerCase().trim())

  const col = (kws: string[]) => headers.findIndex((h) => kws.some((kw) => h.includes(kw)))

  const dateCol     = col(["дата заказа", "дата принятия", "дата и время"])
  const articleCol  = col(["артикул поставщика", "ваш артикул"])
  const nameCol     = col(["наименование", "название товара"])
  const wbArtCol    = col(["артикул wb", "код номенклатуры", "nmid", "nm id"])
  const qtyCol      = col(["кол-во", "количество"])
  const priceCol    = col(["цена", "стоимость"])
  const statusCol   = col(["статус"])

  if (statusCol < 0) return []

  const rows: WbOrderRow[] = []

  for (let i = headerIdx + 1; i < rawAll.length; i++) {
    const row = rawAll[i] as unknown[]

    const status = statusCol >= 0 ? String(row[statusCol] ?? "").trim() : ""
    if (!status) continue

    const parseDate = (v: unknown): Date | null => {
      if (v instanceof Date && !isNaN(v.getTime())) return v
      if (typeof v === "number" && v > 0) return new Date(Math.round((v - 25569) * 86400 * 1000))
      if (typeof v === "string" && v.trim()) {
        const m = v.match(/(\d{2})\.(\d{2})\.(\d{4})/)
        if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}`)
        const d = new Date(v)
        if (!isNaN(d.getTime())) return d
      }
      return null
    }
    const num = (v: unknown) => {
      const n = parseFloat(String(v ?? "0").replace(",", ".").replace(/\s/g, ""))
      return isNaN(n) ? 0 : n
    }

    const date = dateCol >= 0 ? parseDate(row[dateCol]) : null
    if (!date) continue

    rows.push({
      date,
      vendorArticle: articleCol >= 0 ? String(row[articleCol] ?? "").trim() : "",
      productName:   nameCol   >= 0 ? String(row[nameCol]   ?? "").trim() : "",
      wbArticle:     wbArtCol  >= 0 ? String(row[wbArtCol]  ?? "").trim() : "",
      quantity:      qtyCol    >= 0 ? Math.max(1, num(row[qtyCol])) : 1,
      price:         priceCol  >= 0 ? num(row[priceCol]) : 0,
      status:        status,
    })
  }

  return rows
}

export function classifyStatus(status: string): "bought" | "cancelled" | "pending" {
  const s = status.toLowerCase()
  if (BOUGHT_STATUSES.some((b) => s.includes(b))) return "bought"
  if (CANCELLED_STATUSES.some((c) => s.includes(c))) return "cancelled"
  return "pending"
}
