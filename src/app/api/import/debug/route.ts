import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import * as XLSX from "xlsx"

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
      headerRowIdx = i; break
    }
  }

  const headers = (rawAll[headerRowIdx] as unknown[]).map((c) => String(c ?? ""))

  // Find key columns
  const opCol1 = headers.findIndex(h => h.toLowerCase().includes("обоснование для оплаты"))
  const opCol2 = headers.findIndex(h => h.toLowerCase().includes("тип документа"))
  const revenueCol = headers.findIndex(h => h.toLowerCase().includes("к перечислению продавцу"))
  const logisticsCol = headers.findIndex(h => h.toLowerCase().includes("услуги по доставке товара покупателю"))
  const storageCol = headers.findIndex(h => h.toLowerCase().includes("хранение"))
  const articul = headers.findIndex(h => h.toLowerCase().includes("артикул поставщика"))

  // Sample unique operation types and their amounts
  const opTypes = new Map<string, { count: number; revenue: number; logistics: number; storage: number }>()
  for (let i = headerRowIdx + 1; i < rawAll.length; i++) {
    const row = rawAll[i] as unknown[]
    const op1 = opCol1 >= 0 ? String(row[opCol1] ?? "").trim() : ""
    const op2 = opCol2 >= 0 ? String(row[opCol2] ?? "").trim() : ""
    const op = op1 || op2
    if (!op) continue
    const rev = parseFloat(String(row[revenueCol] ?? "0").replace(",", ".")) || 0
    const log = parseFloat(String(row[logisticsCol] ?? "0").replace(",", ".")) || 0
    const stor = parseFloat(String(row[storageCol] ?? "0").replace(",", ".")) || 0
    const cur = opTypes.get(op) ?? { count: 0, revenue: 0, logistics: 0, storage: 0 }
    opTypes.set(op, { count: cur.count + 1, revenue: cur.revenue + rev, logistics: cur.logistics + log, storage: cur.storage + stor })
  }

  return NextResponse.json({
    columnIndices: {
      "Обоснование для оплаты": opCol1, "Тип документа": opCol2,
      "К перечислению Продавцу": revenueCol, "Услуги по доставке": logisticsCol,
      "Хранение": storageCol, "Артикул поставщика": articul
    },
    operationTypes: Object.fromEntries(opTypes),
  })
}
