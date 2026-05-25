"use client"

import { signOut } from "next-auth/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, User, ChevronDown } from "lucide-react"
import { useRouter } from "next/navigation"

interface HeaderProps {
  user?: { name?: string | null; email?: string | null }
}

export function Header({ user }: HeaderProps) {
  const router = useRouter()
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "U"
  const displayName = user?.name || user?.email || "Профиль"

  return (
    <header className="flex h-12 items-center justify-end border-b border-slate-100 bg-white px-5">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 outline-none hover:bg-slate-50 transition-colors">
          <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-600 shrink-0">
            {initials}
          </div>
          <span className="text-sm text-slate-700 font-medium max-w-[140px] truncate">{displayName}</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <div className="px-2.5 py-2">
            <p className="text-sm font-medium text-slate-800 truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => router.push("/dashboard/settings")}
            className="flex items-center gap-2 cursor-pointer text-sm"
          >
            <User className="h-3.5 w-3.5" /> Профиль
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => signOut({ callbackUrl: "/auth/login" })}
            className="flex items-center gap-2 text-red-500 cursor-pointer text-sm"
          >
            <LogOut className="h-3.5 w-3.5" /> Выйти
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
