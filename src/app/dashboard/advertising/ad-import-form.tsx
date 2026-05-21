"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface Store { id: string; name: string; marketplace: string }

export function AdImportForm({ stores }: { stores: Store[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "")
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)
  const [error, setError] = useState("")
  const [debugData, setDebugData] = useState<Record<string, unknown> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) { setError("Поддерживаются .xlsx, .xls, .csv"); return }
    setFile(f); setResult(null); setError(""); setDebugData(null)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]; if (f) handleFile(f)
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true) }, [])
  const onDragLeave = useCallback(() => setDragging(false), [])

  async function onDebug() {
    if (!file) return
    const fd = new FormData(); fd.append("file", file)
    const res = await fetch("/api/import/ad-debug", { method: "POST", body: fd })
    setDebugData(await res.json())
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !storeId) return
    setLoading(true); setError(""); setResult(null)
    const fd = new FormData(); fd.append("file", file); fd.append("storeId", storeId)
    const res = await fetch("/api/import/advertising", { method: "POST", body: fd })
    const data = await res.json()
    if (!res.ok) setError(data.error || "Ошибка загрузки")
    else { setResult(data); setFile(null); router.refresh() }
    setLoading(false)
  }

  return (
    <div className="rounded-lg border">
      <button type="button" onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors">
        <span className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-muted-foreground" />
          Загрузить отчёт по рекламе
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <form onSubmit={onSubmit} className="border-t px-4 pb-4 pt-3 space-y-3">
          {/* Store */}
          <div className="flex flex-wrap gap-2">
            {stores.map((s) => (
              <button key={s.id} type="button" onClick={() => setStoreId(s.id)}
                className={cn("flex items-center gap-2 rounded-md border px-3 py-1 text-sm transition-colors",
                  storeId === s.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
                <Badge variant="outline" className={cn("text-[10px] px-1", storeId === s.id && "border-primary-foreground/40 text-primary-foreground")}>
                  {s.marketplace}
                </Badge>
                {s.name}
              </button>
            ))}
          </div>

          {/* Drop zone */}
          <div onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
            onClick={() => !file && inputRef.current?.click()}
            className={cn("relative flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
              file && "cursor-default")}>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            {file ? (
              <div className="flex items-center gap-3 px-4">
                <FileSpreadsheet className="h-6 w-6 shrink-0 text-emerald-500" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null) }}
                  className="ml-auto rounded-md p-1 hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-center px-4">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium">Статистика рекламных кампаний WB (.xlsx)</p>
                <p className="text-xs text-muted-foreground">WB Реклама → Статистика → Экспорт</p>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />{error}
            </div>
          )}

          {result && (
            <div className="flex items-start gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm">
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <div className="text-emerald-800">
                <p className="font-medium">Загружено: {result.created} записей</p>
                {result.skipped > 0 && <p className="text-xs">Пропущено: {result.skipped}</p>}
                {result.errors.length > 0 && <p className="text-xs text-amber-700">Ошибок: {result.errors.length}</p>}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={!file || loading} className="flex-1">
              {loading ? "Обрабатываю..." : "Загрузить рекламу"}
            </Button>
            {file && <Button type="button" variant="outline" onClick={onDebug}>Debug</Button>}
          </div>

          {debugData && (
            <div className="rounded-md border bg-muted/50 p-3 text-xs space-y-3">
              {(debugData.sheets as Record<string, unknown>[]).map((sheet, si) => (
                <div key={si}>
                  <p className="font-medium mb-1">
                    Лист: <span className="font-mono">{sheet.sheetName as string}</span> |
                    строк данных: {sheet.dataRows as number} |
                    заголовок на строке {(sheet.headerRowIdx as number) + 1}
                  </p>
                  <p className="text-muted-foreground mb-1">Колонки:</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(sheet.headers as string[]).map((h) => (
                      <span key={h} className="rounded bg-background border px-1.5 py-0.5 font-mono text-[10px]">{h}</span>
                    ))}
                  </div>
                  {!!sheet.sampleRow && Object.keys(sheet.sampleRow as Record<string,unknown>).length > 0 && (
                    <div>
                      <p className="text-muted-foreground mb-1">Первая строка:</p>
                      {Object.entries(sheet.sampleRow as Record<string, unknown>).slice(0, 12).map(([k, v]) => (
                        <div key={k} className="flex gap-2 py-0.5">
                          <span className="text-muted-foreground w-44 shrink-0 truncate">{k}:</span>
                          <span className="font-mono truncate">{String(v ?? "")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </form>
      )}
    </div>
  )
}
