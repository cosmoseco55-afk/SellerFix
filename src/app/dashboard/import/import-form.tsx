"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface Store {
  id: string
  name: string
  marketplace: string
}

interface ImportFormProps {
  stores: Store[]
}

interface ImportResult {
  created: number
  skipped: number
  errors: string[]
}

export function ImportForm({ stores }: ImportFormProps) {
  const router = useRouter()
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "")
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState("")
  const [diag, setDiag] = useState<{ matched: Record<string,string>; unmatched: string[]; sampleValues: Record<string,unknown> } | null>(null)
  const [debugData, setDebugData] = useState<Record<string, unknown> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError("Поддерживаются файлы .xlsx, .xls, .csv")
      return
    }
    setFile(f)
    setResult(null)
    setError("")
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const onDragLeave = useCallback(() => setDragging(false), [])

  async function onDebug() {
    if (!file) return
    const formData = new FormData()
    formData.append("file", file)
    const res = await fetch("/api/import/debug", { method: "POST", body: formData })
    const data = await res.json()
    setDebugData(data)
  }

  async function onPreview() {
    if (!file) return
    const formData = new FormData()
    formData.append("file", file)
    const res = await fetch("/api/import/preview", { method: "POST", body: formData })
    const data = await res.json()
    setDiag({ matched: data.matched ?? {}, unmatched: data.unmatched ?? [], sampleValues: data.sampleValues ?? {} })
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !storeId) return
    setLoading(true)
    setError("")
    setResult(null)

    const formData = new FormData()
    formData.append("file", file)
    formData.append("storeId", storeId)

    const res = await fetch("/api/import", { method: "POST", body: formData })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || "Ошибка загрузки")
    } else {
      setResult(data)
      setDiag(null)
      setFile(null)
      router.refresh()
    }
    setLoading(false)
  }

  const selectedStore = stores.find((s) => s.id === storeId)

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Store selector */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">Магазин</label>
        <div className="flex flex-wrap gap-2">
          {stores.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStoreId(s.id)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
                storeId === s.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              <Badge variant="outline" className={cn("text-[10px] px-1", storeId === s.id && "border-primary-foreground/40 text-primary-foreground")}>
                {s.marketplace}
              </Badge>
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !file && inputRef.current?.click()}
        className={cn(
          "relative flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
          file && "cursor-default"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {file ? (
          <div className="flex items-center gap-3 px-6">
            <FileSpreadsheet className="h-8 w-8 shrink-0 text-emerald-500" />
            <div className="min-w-0">
              <p className="truncate font-medium text-sm">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(0)} KB
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFile(null) }}
              className="ml-auto rounded-md p-1 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 text-center">
            <div className="rounded-full bg-muted p-3">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Перетащите файл или нажмите</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedStore?.marketplace === "WB"
                  ? "Отчёт WB: детализация к еженедельному отчёту (.xlsx)"
                  : "Отчёт Ozon: транзакции (.xlsx)"}
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="flex items-start gap-3 p-4">
            <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-emerald-800">
                Импорт завершён: загружено {result.created} записей
              </p>
              {result.skipped > 0 && (
                <p className="text-emerald-700">Пропущено: {result.skipped}</p>
              )}
              {result.errors.length > 0 && (
                <p className="text-amber-700 mt-1">
                  Ошибок: {result.errors.length}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={!file || loading} className="flex-1">
          {loading ? "Обрабатываю..." : "Загрузить отчёт"}
        </Button>
        {file && (
          <Button type="button" variant="outline" onClick={onPreview}>
            Колонки
          </Button>
        )}
        {file && (
          <Button type="button" variant="outline" onClick={onDebug}>
            Debug
          </Button>
        )}
      </div>

      {debugData && (
        <div className="rounded-md border bg-muted/50 p-3 text-xs space-y-2">
          <p className="font-medium">Типы операций в файле:</p>
          <table className="w-full">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-1">Тип</th>
                <th className="pb-1 text-right">Кол-во строк</th>
                <th className="pb-1 text-right">Выручка</th>
                <th className="pb-1 text-right">Логистика</th>
                <th className="pb-1 text-right">Хранение</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(debugData.operationTypes as Record<string, {count:number;revenue:number;logistics:number;storage:number}>)
                .sort((a,b) => b[1].count - a[1].count)
                .map(([op, v]) => (
                <tr key={op} className="border-t">
                  <td className="py-0.5 pr-2 font-medium">{op}</td>
                  <td className="py-0.5 text-right">{v.count}</td>
                  <td className="py-0.5 text-right">{Math.round(v.revenue)}</td>
                  <td className="py-0.5 text-right">{Math.round(v.logistics)}</td>
                  <td className="py-0.5 text-right">{Math.round(v.storage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {diag && (
        <div className="rounded-md border bg-muted/50 p-3 text-xs space-y-2">
          <p className="font-medium">Найдено полей: {Object.keys(diag.matched).length}</p>
          <div className="space-y-1">
            {Object.entries(diag.matched).map(([field, col]) => (
              <div key={field} className="flex items-center gap-2">
                <span className="text-emerald-600">✓</span>
                <span className="font-medium w-32 shrink-0">{field}</span>
                <span className="text-muted-foreground truncate">{col}</span>
                <span className="ml-auto shrink-0 font-mono">{String(diag.sampleValues[field] ?? "—")}</span>
              </div>
            ))}
            {diag.unmatched.map((field) => (
              <div key={field} className="flex items-center gap-2 text-muted-foreground">
                <span className="text-red-400">✗</span>
                <span className="font-medium w-32 shrink-0">{field}</span>
                <span>не найдено</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </form>
  )
}
