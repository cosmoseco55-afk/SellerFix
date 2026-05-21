"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useState, useRef, useEffect } from "react"
import { ChevronDown, X, Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface Option { value: string; label: string }

interface Props {
  param: string          // URL param name, e.g. "stores"
  label: string          // button label, e.g. "Магазины"
  options: Option[]
}

export function MultiSelectFilter({ param, label, options }: Props) {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams= useSearchParams()
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  const currentRaw = searchParams.get(param) ?? ""
  const selected   = currentRaw ? currentRaw.split(",").filter(Boolean) : []

  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value]
    apply(next)
  }

  const apply = (next: string[]) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next.length > 0) params.set(param, next.join(","))
    else params.delete(param)
    router.push(`${pathname}?${params.toString()}`)
  }

  const reset = (e: React.MouseEvent) => {
    e.stopPropagation()
    apply([])
  }

  // close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  )

  const isActive = selected.length > 0

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
          isActive
            ? "border-primary bg-primary/10 text-primary"
            : "bg-background hover:bg-muted text-foreground"
        )}
      >
        <span>{label}</span>
        {isActive && (
          <>
            <span className="rounded-full bg-primary text-primary-foreground px-1.5 py-0.5 text-[10px] font-bold leading-none">
              {selected.length}
            </span>
            <X className="h-3 w-3 opacity-60 hover:opacity-100" onClick={reset} />
          </>
        )}
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border bg-background shadow-lg">
          {/* Search */}
          {options.length > 7 && (
            <div className="p-2 border-b">
              <div className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1">
                <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск..."
                  className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
          )}

          {/* Options */}
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">Не найдено</p>
            ) : (
              filtered.map((opt) => {
                const checked = selected.includes(opt.value)
                return (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt.value)}
                      className="h-3.5 w-3.5 rounded accent-primary"
                    />
                    <span className="text-xs truncate">{opt.label}</span>
                  </label>
                )
              })
            )}
          </div>

          {/* Footer */}
          {selected.length > 0 && (
            <div className="border-t p-2">
              <button
                onClick={() => { apply([]); setOpen(false) }}
                className="w-full rounded-md py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Сбросить ({selected.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
