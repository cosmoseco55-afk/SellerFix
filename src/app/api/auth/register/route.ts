import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: "Email и пароль обязательны" }, { status: 400 })
    }
    const exists = await db.user.findUnique({ where: { email } })
    if (exists) {
      return NextResponse.json({ error: "Пользователь уже существует" }, { status: 409 })
    }
    const hashed = await bcrypt.hash(password, 12)
    const user = await db.user.create({
      data: { email, password: hashed, name: name || email.split("@")[0] },
    })
    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Внутренняя ошибка" }, { status: 500 })
  }
}
