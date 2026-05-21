import * as XLSX from "xlsx"

export interface WbRow {
  date: Date
  vendorArticle: string
  productName: string
  category: string
  subject: string
  operationType: string
  quantity: number
  retailPrice: number
  salePrice: number
  revenue: number
  commission: number
  logistics: number
  storage: number
  penalties: number
  compensations: number
  otherDeductions: number
  wbArticle: string
}

// Keyword matchers — ищем колонку по подстроке (lowercase)
const FIELD_KEYWORDS: Array<{ field: string; keywords: string[] }> = [
  { field: "date",              keywords: ["дата продажи", "дата принятия для оплаты", "дата принятия"] },
  { field: "vendorArticle",     keywords: ["артикул поставщика", "ваш артикул"] },
  { field: "wbArticle",         keywords: ["код номенклатуры", "артикул wb", "nm id", "nmid"] },
  { field: "productName",       keywords: ["наименование товара", "название товара", "название"] },
  { field: "subject",           keywords: ["предмет"] },
  { field: "category",          keywords: ["категория"] },
  // Основной источник типа — "Обоснование для оплаты" (содержит "Продажа", "Возврат", "Логистика")
  { field: "operationType",     keywords: ["обоснование для оплаты"] },
  // Запасной тип — "Тип документа"
  { field: "operationType2",    keywords: ["тип документа"] },
  { field: "quantity",          keywords: ["кол-во", "количество"] },
  { field: "retailPrice",    keywords: ["цена розничная с учетом", "розничная цена без скидки", "цена розничная"] },
  { field: "salePrice",      keywords: ["вайлдберриз реализовал", "цена со скидкой"] },
  { field: "revenue",        keywords: ["к перечислению продавцу", "вознаграждение продавца за реализованный"] },
  { field: "commission",     keywords: ["вознаграждение с продаж до вычета", "вознаграждение вайлдберриз (вв), без ндс", "комиссия"] },
  { field: "logistics",      keywords: ["услуги по доставке товара покупателю", "услуги по доставке"] },
  { field: "storage",        keywords: ["хранение"] },
  { field: "penalties",      keywords: ["общая сумма штрафов", "штрафов"] },
  { field: "compensations",  keywords: ["возмещение издержек по перевозке", "возмещение за выдачу", "компенсац"] },
  // WB новый формат: "Удержания" вместо "Прочие удержания"
  { field: "otherDeductions",keywords: ["удержания", "прочие удержания"] },
]

function buildKeyMap(headers: string[]): Map<string, string> {
  const map = new Map<string, string>()
  // Итерируем по FIELD_KEYWORDS (не по заголовкам) — чтобы первый keyword имел приоритет
  for (const { field, keywords } of FIELD_KEYWORDS) {
    for (const kw of keywords) {
      const match = headers.find((h) => h.toLowerCase().trim().includes(kw))
      if (match) {
        map.set(field, match)
        break
      }
    }
  }
  return map
}

function parseDate(val: unknown): Date | null {
  if (val instanceof Date && !isNaN(val.getTime())) return val
  if (typeof val === "number" && val > 0) {
    return new Date(Math.round((val - 25569) * 86400 * 1000))
  }
  if (typeof val === "string" && val.trim()) {
    // DD.MM.YYYY
    const m1 = val.match(/(\d{2})\.(\d{2})\.(\d{4})/)
    if (m1) return new Date(`${m1[3]}-${m1[2]}-${m1[1]}`)
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d
  }
  return null
}

function num(val: unknown): number {
  if (typeof val === "number") return val
  if (typeof val === "string") {
    const n = parseFloat(val.replace(",", ".").replace(/\s/g, "").replace(/ /g, ""))
    return isNaN(n) ? 0 : n
  }
  return 0
}

export function parseWbReport(buffer: Buffer): WbRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]

  // WB иногда добавляет несколько строк заголовка — ищем строку с "Обоснование для оплаты"
  const rawAll = (XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    header: 1,
  }) as unknown) as unknown[][]

  // Найти строку-заголовок
  let headerRowIdx = 0
  for (let i = 0; i < Math.min(10, rawAll.length); i++) {
    const row = rawAll[i] as unknown[]
    const joined = row.map((c) => String(c ?? "").toLowerCase()).join("|")
    if (joined.includes("обоснование для оплаты") || joined.includes("артикул поставщика")) {
      headerRowIdx = i
      break
    }
  }

  const headers = (rawAll[headerRowIdx] as unknown[]).map((c) => String(c ?? ""))
  const keyMap = buildKeyMap(headers)

  const rows: WbRow[] = []
  for (let i = headerRowIdx + 1; i < rawAll.length; i++) {
    const rawRow = rawAll[i] as unknown[]
    const row: Record<string, unknown> = {}
    headers.forEach((h, idx) => { row[h] = rawRow[idx] })

    const get = (field: string): unknown => {
      const col = keyMap.get(field)
      return col ? row[col] : undefined
    }

    // Используем "Обоснование для оплаты" как основной источник, "Тип документа" как запасной
    const opType = (String(get("operationType") ?? "").trim() || String(get("operationType2") ?? "").trim())
    if (!opType) continue

    const date = parseDate(get("date"))
    if (!date) continue

    rows.push({
      date,
      vendorArticle: String(get("vendorArticle") ?? "").trim(),
      productName:   String(get("productName") ?? "").trim(),
      category:      String(get("category") ?? "").trim(),
      subject:       String(get("subject") ?? "").trim(),
      operationType: opType,
      quantity:      Math.abs(num(get("quantity"))),
      retailPrice:   num(get("retailPrice")),
      salePrice:     num(get("salePrice")),
      revenue:       num(get("revenue")),
      commission:    Math.abs(num(get("commission"))),
      logistics:     Math.abs(num(get("logistics"))),
      storage:       Math.abs(num(get("storage"))),
      penalties:     Math.abs(num(get("penalties"))),
      compensations: Math.abs(num(get("compensations"))),
      otherDeductions: Math.abs(num(get("otherDeductions"))),
      wbArticle:     String(get("wbArticle") ?? "").trim(),
    })
  }

  return rows
}
