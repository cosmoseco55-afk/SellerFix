import * as XLSX from "xlsx"

export interface WbRow {
  date: Date
  vendorArticle: string
  productName: string
  category: string
  subject: string
  operationType: string // "Продажа", "Возврат", "Логистика", etc.
  quantity: number
  retailPrice: number
  salePrice: number
  revenue: number          // к перечислению продавцу
  commission: number       // вознаграждение WB
  logistics: number        // доставка
  storage: number          // хранение
  penalties: number        // штрафы
  compensations: number    // компенсации
  otherDeductions: number  // прочие удержания
  wbArticle: string
}

const COL_ALIASES: Record<string, string> = {
  // Дата
  "дата принятия для оплаты": "date",
  "дата": "date",
  // Артикул поставщика
  "артикул поставщика": "vendorArticle",
  "ваш артикул": "vendorArticle",
  // Наименование
  "название товара": "productName",
  "наименование товара": "productName",
  "предмет": "subject",
  // Категория
  "категория": "category",
  // Тип операции
  "обоснование для оплаты": "operationType",
  "тип документа": "operationType",
  // Количество
  "кол-во": "quantity",
  "количество": "quantity",
  // Цена
  "цена розничная, руб.": "retailPrice",
  "розничная цена без скидки, руб.": "retailPrice",
  // Цена продажи
  "цена со скидкой, руб.": "salePrice",
  "розничная цена, руб.": "salePrice",
  // Выручка / к перечислению
  "итого к перечислению продавцу, руб.": "revenue",
  "к перечислению продавцу, руб.": "revenue",
  "вознаграждение продавца за реализованный товар (руб.)": "revenue",
  // Комиссия WB
  "вознаграждение с продаж до вычета услуг, руб.": "commission",
  "комиссия": "commission",
  // Логистика
  "услуги по доставке товара покупателю, руб.": "logistics",
  "доставка, руб.": "logistics",
  // Хранение
  "хранение, руб.": "storage",
  "хранение": "storage",
  // Штрафы
  "общая сумма штрафов, руб.": "penalties",
  "штрафы": "penalties",
  // Компенсации
  "возмещение издержек по перевозке, руб.": "compensations",
  "компенсация": "compensations",
  // Прочие удержания
  "прочие удержания/выплаты": "otherDeductions",
  "прочие": "otherDeductions",
  // Артикул WB
  "код номенклатуры": "wbArticle",
  "артикул wb": "wbArticle",
  "nm id": "wbArticle",
  "nmid": "wbArticle",
}

function normalizeKey(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ")
}

function parseDate(val: unknown): Date {
  if (val instanceof Date) return val
  if (typeof val === "number") {
    // Excel serial date
    return new Date(Math.round((val - 25569) * 86400 * 1000))
  }
  if (typeof val === "string") {
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d
    // DD.MM.YYYY
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

export function parseWbReport(buffer: Buffer): WbRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })

  if (raw.length === 0) return []

  // Map column headers to our field names
  const firstRow = raw[0]
  const keyMap: Record<string, string> = {}
  for (const colName of Object.keys(firstRow)) {
    const alias = COL_ALIASES[normalizeKey(colName)]
    if (alias) keyMap[colName] = alias
  }

  const rows: WbRow[] = []
  for (const row of raw) {
    // Skip summary/empty rows
    const opType = String(row[Object.keys(keyMap).find((k) => keyMap[k] === "operationType") ?? ""] ?? "")
    if (!opType) continue

    const get = (field: string): unknown => {
      const col = Object.keys(keyMap).find((k) => keyMap[k] === field)
      return col ? row[col] : undefined
    }

    rows.push({
      date: parseDate(get("date")),
      vendorArticle: String(get("vendorArticle") ?? ""),
      productName: String(get("productName") ?? ""),
      category: String(get("category") ?? ""),
      subject: String(get("subject") ?? ""),
      operationType: opType,
      quantity: Math.abs(num(get("quantity"))),
      retailPrice: num(get("retailPrice")),
      salePrice: num(get("salePrice")),
      revenue: num(get("revenue")),
      commission: Math.abs(num(get("commission"))),
      logistics: Math.abs(num(get("logistics"))),
      storage: Math.abs(num(get("storage"))),
      penalties: Math.abs(num(get("penalties"))),
      compensations: Math.abs(num(get("compensations"))),
      otherDeductions: Math.abs(num(get("otherDeductions"))),
      wbArticle: String(get("wbArticle") ?? ""),
    })
  }

  return rows
}
