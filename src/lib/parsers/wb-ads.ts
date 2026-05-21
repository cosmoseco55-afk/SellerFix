import * as XLSX from "xlsx"

export type WbAdStatus = "ACTIVE" | "PAUSED" | "ARCHIVED"

export interface WbAdRow {
  campaignId: string
  campaignName: string
  brand: string
  section: string
  bidType: string
  startDate: Date
  endDate: Date | null
  status: WbAdStatus
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  spend: number
  orders: number
  addToCart: number
}

const HEADER_MARKERS = ["показы", "клики", "затраты", "кампания"]

const FIELD_KEYWORDS: Array<{ field: string; keywords: string[] }> = [
  { field: "section",      keywords: ["раздел"] },
  { field: "bidType",      keywords: ["тип ставки"] },
  { field: "campaignId",   keywords: ["id"] },
  { field: "campaignName", keywords: ["кампания"] },
  { field: "brand",        keywords: ["бренд"] },
  { field: "startDate",    keywords: ["старт"] },
  { field: "endDate",      keywords: ["финиш"] },
  { field: "impressions",  keywords: ["показы"] },
  { field: "clicks",       keywords: ["клики"] },
  { field: "ctr",          keywords: ["ctr"] },
  { field: "cpc",          keywords: ["cpc"] },
  { field: "spend",        keywords: ["затраты"] },
  { field: "orders",       keywords: ["заказанные товары"] },
  { field: "addToCart",    keywords: ["добавления в корзину"] },
]

function buildKeyMap(headers: string[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const { field, keywords } of FIELD_KEYWORDS) {
    for (const kw of keywords) {
      const idx = headers.findIndex((h) => h.toLowerCase().trim().includes(kw))
      if (idx >= 0) { map.set(field, idx); break }
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

function parseDate(val: unknown): Date {
  if (val instanceof Date && !isNaN(val.getTime())) return val
  if (typeof val === "string" && val.trim()) {
    const d = new Date(val.replace(" ", "T"))
    if (!isNaN(d.getTime())) return d
  }
  return new Date()
}

export function parseWbAdsReport(buffer: Buffer): WbAdRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rawAll = (XLSX.utils.sheet_to_json(sheet, { defval: "", header: 1 }) as unknown) as unknown[][]

  // Find header row
  let headerRowIdx = 0
  for (let i = 0; i < Math.min(15, rawAll.length); i++) {
    const joined = (rawAll[i] as unknown[]).map((c) => String(c ?? "").toLowerCase()).join("|")
    if (HEADER_MARKERS.some((m) => joined.includes(m))) { headerRowIdx = i; break }
  }

  const headers = (rawAll[headerRowIdx] as unknown[]).map((c) => String(c ?? ""))
  const keyMap = buildKeyMap(headers)

  const rows: WbAdRow[] = []
  for (let i = headerRowIdx + 1; i < rawAll.length; i++) {
    const rawRow = rawAll[i] as unknown[]
    const get = (field: string): unknown => {
      const idx = keyMap.get(field)
      return idx !== undefined ? rawRow[idx] : undefined
    }

    const campaignName = String(get("campaignName") ?? "").trim()
    if (!campaignName) continue

    const spend = num(get("spend"))
    if (spend === 0 && num(get("impressions")) === 0) continue  // пустые строки

    const endDateRaw = get("endDate")
    const endDate = endDateRaw ? parseDate(endDateRaw) : null

    // Определяем статус по дате окончания и активности
    // Сравниваем только даты (без времени) чтобы кампании со сроком "сегодня" не попали в архив
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let status: WbAdStatus = "ACTIVE"
    if (endDate) {
      const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
      if (endDay < today) status = "ARCHIVED"
    }
    if (status === "ACTIVE" && spend === 0) {
      status = "PAUSED"
    }

    rows.push({
      campaignId:   String(get("campaignId") ?? "").trim(),
      campaignName,
      brand:        String(get("brand") ?? "").trim(),
      section:      String(get("section") ?? "").trim(),
      bidType:      String(get("bidType") ?? "").trim(),
      startDate:    parseDate(get("startDate")),
      endDate,
      status,
      impressions:  Math.round(num(get("impressions"))),
      clicks:       Math.round(num(get("clicks"))),
      ctr:          num(get("ctr")),
      cpc:          num(get("cpc")),
      spend,
      orders:       Math.round(num(get("orders"))),
      addToCart:    Math.round(num(get("addToCart"))),
    })
  }

  return rows
}
