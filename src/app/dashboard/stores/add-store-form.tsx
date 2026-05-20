"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function AddStoreForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [marketplace, setMarketplace] = useState("WB")
  const [apiKey, setApiKey] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const res = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, marketplace, apiKey }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || "Ошибка")
    } else {
      setName("")
      setApiKey("")
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium">Название магазина</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder="ИП Иванов А.А."
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Маркетплейс</label>
        <select
          value={marketplace}
          onChange={(e) => setMarketplace(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="WB">Wildberries</option>
          <option value="OZON">Ozon</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">API токен</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          required
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder="Вставьте токен из кабинета продавца"
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          {marketplace === "WB"
            ? "WB: Настройки → Доступ к API → Статистика"
            : "Ozon: Настройки → API ключи → Seller"}
        </p>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Подключение..." : "Подключить"}
      </Button>
    </form>
  )
}
