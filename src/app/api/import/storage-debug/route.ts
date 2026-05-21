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

  // Find op column
  const opCol = headers.findIndex(h => h.toLowerCase().includes("обоснование для оплаты"))

  // Find all columns whose header contains "хранение"
  const storColIdxs = headers
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => h.toLowerCase().includes("хранение"))

  // All column names
  const allHeaders = headers.map((h, i) => `[${i}] ${h}`).filter(h => h.length > 4)

  // Find storage rows and show their raw values
  const storageRows: Record<string, unknown>[] = []
  for (let i = headerRowIdx + 1; i < rawAll.length; i++) {
    const row = rawAll[i] as unknown[]
    const op = opCol >= 0 ? String(row[opCol] ?? "").trim() : ""
    if (!op.toLowerCase().includes("хранение")) continue

    const rawObj: Record<string, unknown> = { "_rowIndex": i, "_opType": op }
    headers.forEach((h, idx) => {
      const val = row[idx]
      if (val !== "" && val !== 0 && val !== undefined && val !== null) {
        rawObj[h] = val
      }
    })
    storageRows.push(rawObj)
    if (storageRows.length >= 5) break
  }

  return NextResponse.json({
    headerRowIdx,
    storageColumnMatches: storColIdxs,
    allHeaders,
    storageRowSamples: storageRows,
  })
}
