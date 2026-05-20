import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { importReport } from "@/lib/parsers/import-service"
import { Marketplace } from "@prisma/client"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const storeId = formData.get("storeId") as string | null

    if (!file || !storeId) {
      return NextResponse.json({ error: "Файл и магазин обязательны" }, { status: 400 })
    }

    // Verify store belongs to user
    const store = await db.store.findFirst({
      where: { id: storeId, userId: session.user.id },
    })
    if (!store) {
      return NextResponse.json({ error: "Магазин не найден" }, { status: 404 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await importReport(storeId, store.marketplace as Marketplace, buffer)

    return NextResponse.json(result)
  } catch (e) {
    console.error("Import error:", e)
    return NextResponse.json({ error: "Ошибка при обработке файла" }, { status: 500 })
  }
}
