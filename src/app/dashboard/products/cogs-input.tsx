"use client"

import { useState, useRef } from "react"

interface Props {
  productId: string
  initialValue: number
}

export function CogsInput({ productId, initialValue }: Props) {
  const [value, setValue]   = useState(initialValue > 0 ? String(initialValue) : "")
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const save = async () => {
    const num = parseFloat(value.replace(",", "."))
    if (isNaN(num) && value !== "") return
    const cogs = value === "" ? 0 : num
    if (cogs === initialValue) return

    setSaving(true)
    try {
      await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cogsPerUnit: cogs }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => { setValue(e.target.value); setSaved(false) }}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); inputRef.current?.blur() } }}
        placeholder="0"
        className="w-20 rounded border bg-background px-1.5 py-0.5 text-right text-xs focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {saving && <span className="text-[10px] text-muted-foreground">…</span>}
      {saved  && <span className="text-[10px] text-emerald-500">✓</span>}
    </div>
  )
}
