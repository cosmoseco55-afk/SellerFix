import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Проверяем что товар принадлежит этому пользователю
  const product = await db.product.findFirst({
    where: { id, store: { userId: session.user.id } },
  })
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await db.product.update({
    where: { id },
    data: {
      ...(typeof body.cogsPerUnit === "number" ? { cogsPerUnit: body.cogsPerUnit } : {}),
    },
  })

  return NextResponse.json({ cogsPerUnit: updated.cogsPerUnit })
}
