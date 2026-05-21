import * as XLSX from "xlsx"

export interface WbWeeklyRow {
  dateFrom: Date
  dateTo:   Date
  sales:    number
  logistics: number
  storage:  number
  penalties: number
  otherDeductions: number
}

export function parseWbWeeklyReport(buffer: Buffer): WbWeeklyRow[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rawAll = XLSX.utils.sheet_to_json<unknown[]>(sheet, { defval: "", header: 1 }) as unknown[][]

  // Ищем строку с нужными заголовками
  let headerIdx = 0
  for (let i = 0; i < Math.min(5, rawAll.length); i++) {
    const joined = rawAll[i].map((c) => String(c ?? "").toLowerCase()).join("|")
    if (joined.includes("дата начала") || joined.includes("стоимость хранения")) {
      headerIdx = i; break
    }
  }

  const headers = rawAll[headerIdx].map((c) => String(c ?? "").toLowerCase().trim())

  const col = (kw: string) => headers.findIndex((h) => h.includes(kw))

  const dateFromCol  = col("дата начала")
  const dateToCol    = col("дата конца")
  const salesCol     = col("продажа")
  const logisticsCol = col("стоимость логистики")
  const storageCol   = col("стоимость хранения")
  const penaltiesCol = col("общая сумма штрафов")
  const otherCol     = col("прочие удержания")

  // Это сводный отчёт если есть "стоимость хранения"
  if (storageCol < 0) return []

  const rows: WbWeeklyRow[] = []
  for (let i = headerIdx + 1; i < rawAll.length; i++) {
    const row = rawAll[i] as unknown[]
    const parseDate = (v: unknown): Date | null => {
      if (v instanceof Date && !isNaN(v.getTime())) return v
      if (typeof v === "string" && v.trim()) {
        const d = new Date(v)
        if (!isNaN(d.getTime())) return d
      }
      return null
    }
    const num = (v: unknown) => {
      const n = parseFloat(String(v ?? "0").replace(",", ".").replace(/\s/g, ""))
      return isNaN(n) ? 0 : n
    }

    const dateFrom = dateFromCol >= 0 ? parseDate(row[dateFromCol]) : null
    const dateTo   = dateToCol  >= 0 ? parseDate(row[dateToCol])   : null
    if (!dateFrom || !dateTo) continue

    rows.push({
      dateFrom,
      dateTo,
      sales:           num(salesCol     >= 0 ? row[salesCol]     : 0),
      logistics:       num(logisticsCol >= 0 ? row[logisticsCol] : 0),
      storage:         num(storageCol   >= 0 ? row[storageCol]   : 0),
      penalties:       num(penaltiesCol >= 0 ? row[penaltiesCol] : 0),
      otherDeductions: num(otherCol     >= 0 ? row[otherCol]     : 0),
    })
  }

  return rows
}

/** Проверяет, является ли файл сводным финансовым отчётом WB (не детализированным) */
export function isWbWeeklyFormat(buffer: Buffer): boolean {
  try {
    const wb = XLSX.read(buffer, { type: "buffer" })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rawAll = XLSX.utils.sheet_to_json<unknown[]>(sheet, { defval: "", header: 1 }) as unknown[][]
    for (let i = 0; i < Math.min(3, rawAll.length); i++) {
      const joined = rawAll[i].map((c) => String(c ?? "").toLowerCase()).join("|")
      if (joined.includes("стоимость хранения") && !joined.includes("обоснование для оплаты")) return true
    }
    return false
  } catch { return false }
}
