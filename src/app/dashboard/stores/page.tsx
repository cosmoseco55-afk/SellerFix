import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AddStoreForm } from "./add-store-form"
import { CheckCircle, Clock, XCircle } from "lucide-react"

async function getStores(userId: string) {
  return db.store.findMany({ where: { userId }, orderBy: { createdAt: "asc" } })
}

export default async function StoresPage() {
  const session = await auth()
  if (!session?.user?.id) return null
  const stores = await getStores(session.user.id)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Магазины</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {stores.map((store) => (
          <Card key={store.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{store.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="outline">{store.marketplace}</Badge>
                    {store.lastSyncAt ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle className="h-3 w-3" />
                        Синхр. {new Date(store.lastSyncAt).toLocaleDateString("ru-RU")}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Нет синхронизации
                      </span>
                    )}
                  </div>
                </div>
                {store.isActive ? (
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                    Активен
                  </Badge>
                ) : (
                  <Badge variant="destructive">Отключён</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm">Подключить магазин</CardTitle>
          </CardHeader>
          <CardContent>
            <AddStoreForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
