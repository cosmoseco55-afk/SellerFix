import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import * as XLSX from "xlsx"

const FIELD_KEYWORDS: Array<{ field: string; keywords: string[] }> = [
  { field: "date",           keywords: ["дата продажи", "дата принятия для оплаты", "дата принятия"] },
  { field: "vendorArticle",  keywords: ["артикул поставщика", "ваш артикул"] },
  { field: "wbArticle",      keywords: ["код номенклатуры", "артикул wb", "nm id", "nmid"] },
  { field: "productName",    keywords: ["наименование товара", "название товара", "название"] },
  { field: "subject",        keywords: ["предмет"] },
  { field: "operationType",  keywords: ["обоснование для оплаты", "тип документа"] },
  { field: "quantity",       keywords: ["кол-во", "количество"] },
  { field: "revenue",        keywords: ["к перечислению продавцу", "вознаграждение продавца за реализованный"] },
  { field: "commission",     keywords: ["вознаграждение с продаж до вычета", "вознаграждение вайлдберриз (вв), без ндс"] },
  { field: "logistics",      keywords: ["услуги по доставке товара покупателю", "услуги по доставке"] },
  { field: "storage",        keywords: ["хранение"] },
  { field: "penalties",      keywords: ["общая сумма штрафов"] },
  { field: "compensations",  keywords: ["возмещение издержек по перевозке", "возмещение за выдачу"] },
  { field: "otherDeductions",keywords: ["удержания", "прочие удержания"] },
]

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rawAll = XLSX.utils.sheet_to_json<unknown[]>(sheet, { defval: "", header: 1 }) as unknown[][]

  // Find header row
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

  // Build field map
  const matched: Record<string, string> = {}
  for (const header of headers) {
    const h = header.toLowerCase().trim()
    for (const { field, keywords } of FIELD_KEYWORDS) {
      if (matched[field]) continue
      if (keywords.some((kw) => h.includes(kw))) {
        matched[field] = header
        break
      }
    }
  }

  // Sample values for matched fields
  const sampleRow = rawAll[headerRowIdx + 1] as unknown[]
  const sampleValues: Record<string, unknown> = {}
  for (const [field, col] of Object.entries(matched)) {
    const idx = headers.indexOf(col)
    sampleValues[field] = idx >= 0 ? sampleRow[idx] : null
  }

  const unmatched = FIELD_KEYWORDS
    .filter(({ field }) => !matched[field])
    .map(({ field }) => field)

  return NextResponse.json({
    totalRows: rawAll.length - headerRowIdx - 1,
    headerRowIdx,
    matched,
    sampleValues,
    unmatched,
    allColumns: headers,
  })
}
