"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  AlertCircle,
  Megaphone,
  Users,
  CalendarClock,
  Wrench,
  Package,
  Building2,
  ChevronDown,
  LogOut,
  Settings,
  Sparkles,
  X,
  HardHat,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Logo } from "./logo"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/hooks/use-auth"

type NavRole = "ZELADOR" | "PORTEIRO"

const ALL_NAV_ITEMS: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  highlight?: boolean
  hiddenFor?: NavRole[]
}[] = [
  { href: "/dashboard",    label: "Dashboard",       icon: LayoutDashboard },
  { href: "/ocorrencias",  label: "Ocorrências",     icon: AlertCircle },
  { href: "/comunicados",  label: "Comunicados",     icon: Megaphone },
  { href: "/moradores",    label: "Moradores",       icon: Users },
  { href: "/reservas",     label: "Reservas",        icon: CalendarClock },
  { href: "/manutencoes",  label: "Manutenções",     icon: Wrench,   hiddenFor: ["PORTEIRO"] },
  { href: "/prestadores",  label: "Prestadores",     icon: HardHat },
  { href: "/entregas",     label: "Entregas",        icon: Package },
  { href: "/zia",          label: "Zia",             icon: Sparkles, highlight: true, hiddenFor: ["ZELADOR", "PORTEIRO"] },
  { href: "/configuracoes", label: "Configurações",  icon: Settings, hiddenFor: ["ZELADOR", "PORTEIRO"] },
]

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const { usuario, logout } = useAuth()

  const role     = usuario?.role as NavRole | undefined
  const navItems = ALL_NAV_ITEMS.filter(
    (item) => !item.hiddenFor || !role || !item.hiddenFor.includes(role)
  )

  const condominioNome = usuario?.condominio?.nome ?? "Carregando..."
  const usuarioNome    = usuario?.nome ?? "..."
  const roleLabel: Record<string, string> = {
    SINDICO:  "Síndico",
    ZELADOR:  "Zelador",
    PORTEIRO: "Porteiro",
    MORADOR:  "Morador",
    ADMIN:    "Admin",
  }

  return (
    <aside className="w-[220px] h-[100dvh] flex flex-col border-r border-border bg-background">
      {/* Logo + botão fechar (mobile) */}
      <div className="px-4 py-4 border-b border-border flex items-center justify-between">
        <Logo size="sm" />
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-lg hover:bg-accent/60 text-muted-foreground"
            aria-label="Fechar menu"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Condomínio */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{condominioNome}</p>
          <p className="text-[10px] text-muted-foreground">Condomínio</p>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {navItems.map((item) => {
          const isActive  = pathname === item.href || pathname.startsWith(item.href + "/")
          const highlight = "highlight" in item && item.highlight
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : highlight
                  ? "text-primary hover:bg-primary/10 font-medium"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {highlight && !isActive && (
                <span className="text-[9px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">IA</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2.5">
          <Avatar className="w-7 h-7">
            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
              {usuarioNome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{usuarioNome}</p>
            <p className="text-[10px] text-muted-foreground">
              {roleLabel[usuario?.role ?? ""] ?? "..."}
            </p>
          </div>
          <button
            onClick={logout}
            className="p-1 rounded hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors"
            title="Sair"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
