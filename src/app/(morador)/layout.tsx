"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Megaphone, Sparkles, CalendarClock, AlertCircle, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { MoradorHeader } from "@/components/morador/morador-header"
import { useAuth } from "@/hooks/use-auth"

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/morador",             label: "Início",      icon: Home },
  { href: "/morador/comunicados", label: "Comunicados", icon: Megaphone },
  { href: "/morador/zia",         label: "Zia",         icon: Sparkles,   special: true },
  { href: "/morador/ocorrencias", label: "Ocorrências", icon: AlertCircle },
  { href: "/morador/reservas",    label: "Reservas",    icon: CalendarClock },
]

// ─── Sidebar (desktop/tablet) ─────────────────────────────────────────────────

function MoradorSidebar() {
  const pathname = usePathname()
  const { usuario } = useAuth()

  const identificacao = [
    usuario?.bloco   && `Bloco ${usuario.bloco}`,
    usuario?.unidade && `Apto ${usuario.unidade}`,
  ].filter(Boolean).join(" · ")

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-background border-r border-border h-full">
      {/* Logo */}
      <div className="px-5 h-14 flex items-center border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg font-heading">ZeloH</span>
        </div>
      </div>

      {/* Condomínio info */}
      {usuario?.condominio?.nome && (
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <p className="text-xs font-semibold text-foreground truncate">{usuario.condominio.nome}</p>
          {identificacao && (
            <p className="text-[11px] text-muted-foreground">{identificacao}</p>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon, special }) => {
          const isActive =
            href === "/morador"
              ? pathname === "/morador"
              : pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                special && !isActive && "text-primary hover:bg-primary/10"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", special && !isActive && "text-primary")} />
              {label}
              {special && (
                <span className={cn(
                  "ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                  isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"
                )}>
                  IA
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

// ─── Layout principal ─────────────────────────────────────────────────────────

export default function MoradorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-[100dvh] bg-muted/30 flex flex-col lg:flex-row lg:h-[100dvh] lg:overflow-hidden">

      {/* Sidebar — visível só em lg+ */}
      <MoradorSidebar />

      {/* Área de conteúdo */}
      <div className="flex-1 flex flex-col lg:overflow-hidden">

        {/* Header */}
        <MoradorHeader />

        {/* Main scrollável */}
        <main className="flex-1 overflow-y-auto pb-24 lg:pb-8">
          <div className="max-w-[430px] lg:max-w-3xl mx-auto w-full">
            {children}
          </div>
        </main>

        {/* Bottom Navigation — mobile only */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border pb-safe">
          <div className="max-w-[430px] mx-auto flex items-end h-16">
            {NAV_ITEMS.map(({ href, label, icon: Icon, special }) => {
              const isActive =
                href === "/morador"
                  ? pathname === "/morador"
                  : pathname.startsWith(href)

              if (special) {
                return (
                  <Link
                    key={href}
                    href={href}
                    className="flex-1 flex flex-col items-center justify-end pb-2 relative"
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all -translate-y-4",
                      isActive
                        ? "bg-primary scale-110 shadow-primary/30 shadow-lg"
                        : "bg-primary/90 hover:bg-primary hover:scale-105"
                    )}>
                      <Icon className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <span className={cn(
                      "text-[9px] font-medium -mt-1",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}>
                      {label}
                    </span>
                  </Link>
                )
              }

              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className={cn("w-[18px] h-[18px]", isActive && "stroke-[2.5]")} />
                  <span className={cn(
                    "text-[9px] font-medium",
                    isActive && "text-primary"
                  )}>
                    {label}
                  </span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
