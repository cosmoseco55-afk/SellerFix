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
  const rawAll = XLSX.utils.sheet_to_json(sheet, { defval: "", header: 1 }) as unknown[][]

  // Find header row
  let headerRowIdx = 0
  for (let i = 0; i < Math.min(15, rawAll.length); i++) {
    const row = rawAll[i] as unknown[]
    const joined = row.map((c) => String(c ?? "").toLowerCase()).join("|")
    if (
      joined.includes("артикул поставщика") ||
      joined.includes("ваш артикул") ||
      joined.includes("наименование") ||
      joined.includes("артикул wb")
    ) {
      headerRowIdx = i
      break
    }
  }

  const headers = (rawAll[headerRowIdx] as unknown[]).map((c) => String(c ?? ""))

  // Sample first 3 data rows
  const sampleRows = []
  for (let i = headerRowIdx + 1; i < Math.min(headerRowIdx + 4, rawAll.length); i++) {
    const rawRow = rawAll[i] as unknown[]
    const row: Record<string, unknown> = {}
    headers.forEach((h, idx) => { if (h) row[h] = rawRow[idx] })
    sampleRows.push(row)
  }

  return NextResponse.json({
    sheetNames: workbook.SheetNames,
    totalRows: rawAll.length,
    headerRowIdx,
    headers: headers.filter(h => h.trim()),
    sampleRows,
    first5Rows: rawAll.slice(0, 5).map(r => (r as unknown[]).map(c => String(c ?? ""))),
  })
}
