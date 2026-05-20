import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Marketplace } from "@prisma/client"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const stores = await db.store.findMany({ where: { userId: session.user.id } })
  return NextResponse.json(stores)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { name, marketplace, apiKey } = await req.json()
    if (!name || !marketplace || !apiKey) {
      return NextResponse.json({ error: "Все поля обязательны" }, { status: 400 })
    }
    if (!["WB", "OZON"].includes(marketplace)) {
      return NextResponse.json({ error: "Неверный маркетплейс" }, { status: 400 })
    }
    const store = await db.store.create({
      data: {
        userId: session.user.id,
        name,
        marketplace: marketplace as Marketplace,
        apiKey,
      },
    })
    return NextResponse.json(store, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Внутренняя ошибка" }, { status: 500 })
  }
}
