import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { importWbAdsReport } from "@/lib/parsers/import-service"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file    = formData.get("file") as File | null
  const storeId = formData.get("storeId") as string | null

  if (!file || !storeId) return NextResponse.json({ error: "file and storeId required" }, { status: 400 })

  const store = await db.store.findFirst({ where: { id: storeId, userId: session.user.id } })
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const result = await importWbAdsReport(storeId, buffer)
  return NextResponse.json(result)
}
