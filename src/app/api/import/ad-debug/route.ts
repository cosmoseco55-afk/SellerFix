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

  const results: Record<string, unknown>[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const raw = XLSX.utils.sheet_to_json(sheet, { defval: "", header: 1 }) as unknown[][]

    // Find header row (first 15 rows)
    let headerRowIdx = 0
    for (let i = 0; i < Math.min(15, raw.length); i++) {
      const joined = (raw[i] as unknown[]).map((c) => String(c ?? "").toLowerCase()).join("|")
      if (
        joined.includes("артикул") ||
        joined.includes("расход") ||
        joined.includes("кампани") ||
        joined.includes("показ")
      ) {
        headerRowIdx = i
        break
      }
    }

    const headers = (raw[headerRowIdx] as unknown[]).map((c) => String(c ?? ""))
    const dataRows = raw.length - headerRowIdx - 1

    // Sample first data row
    const sampleRow: Record<string, unknown> = {}
    if (raw[headerRowIdx + 1]) {
      const r = raw[headerRowIdx + 1] as unknown[]
      headers.forEach((h, i) => { if (h.trim()) sampleRow[h] = r[i] })
    }

    // First 5 raw rows
    const first5 = raw.slice(0, 5).map((r) => (r as unknown[]).map((c) => String(c ?? "").slice(0, 40)))

    results.push({ sheetName, totalRows: raw.length, headerRowIdx, dataRows, headers: headers.filter(h => h.trim()), sampleRow, first5 })
  }

  return NextResponse.json({ sheets: results })
}
