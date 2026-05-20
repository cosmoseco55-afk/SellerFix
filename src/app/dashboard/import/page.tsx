import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { ImportForm } from "./import-form"

async function getStores(userId: string) {
  return db.store.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
  })
}

export default async function ImportPage() {
  const session = await auth()
  if (!session?.user?.id) return null
  const stores = await getStores(session.user.id)

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold">Загрузка отчётов</h1>
        <p className="text-sm text-muted-foreground">
          Загрузите Excel-отчёт из личного кабинета продавца
        </p>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
        <p className="font-medium">Как скачать отчёт:</p>
        <div className="space-y-1 text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Wildberries:</span>{" "}
            Финансы → Отчёты → Детализация к отчёту о перечислении денег → Скачать Excel
          </p>
          <p>
            <span className="font-medium text-foreground">Ozon:</span>{" "}
            Финансы → Отчёты → Транзакции → Скачать отчёт (.xlsx)
          </p>
        </div>
      </div>

      {stores.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            Сначала{" "}
            <a href="/dashboard/stores" className="text-primary hover:underline">
              подключите магазин
            </a>
          </p>
        </div>
      ) : (
        <ImportForm stores={stores.map((s) => ({ id: s.id, name: s.name, marketplace: s.marketplace }))} />
      )}
    </div>
  )
}
