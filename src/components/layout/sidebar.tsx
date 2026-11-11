"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, AlertCircle, Megaphone, Users, CalendarClock, Wrench, Package, Building2,
  ChevronDown, LogOut, Settings, Sparkles, X, HardHat, Cog, FileSignature, FolderOpen, Wallet,
  History, CreditCard, Vote, Check, Plus, Lock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Logo } from "./logo"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/hooks/use-auth"
import { ROLE_LABEL, ehSindico, type Role } from "@/lib/permissions"
import type { Modulo } from "@/lib/planos"
import { InstalarApp } from "@/components/pwa/instalar-app"

const GESTORES: Role[] = ["SINDICO", "SUBSINDICO", "ADMIN"]
const EQUIPE: Role[]   = [...GESTORES, "CONSELHO", "ZELADOR", "PORTEIRO"]

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles: Role[]
  modulo?: Modulo
  highlight?: boolean
}

const SECOES: { titulo?: string; itens: NavItem[] }[] = [
  {
    itens: [
      { href: "/dashboard",   label: "Dashboard",   icon: LayoutDashboard, roles: EQUIPE },
      { href: "/ocorrencias", label: "Ocorrências", icon: AlertCircle,     roles: EQUIPE, modulo: "ocorrencias" },
      { href: "/entregas",    label: "Encomendas",  icon: Package,         roles: EQUIPE, modulo: "encomendas" },
    ],
  },
  {
    titulo: "Manutenção",
    itens: [
      { href: "/manutencoes",  label: "Manutenções",  icon: Wrench, roles: [...GESTORES, "CONSELHO", "ZELADOR", "PRESTADOR"], modulo: "manutencoes" },
      { href: "/equipamentos", label: "Equipamentos", icon: Cog,    roles: [...GESTORES, "CONSELHO", "ZELADOR", "PRESTADOR"], modulo: "equipamentos" },
    ],
  },
  {
    titulo: "Comunicação",
    itens: [
      { href: "/comunicados", label: "Comunicados", icon: Megaphone,     roles: EQUIPE, modulo: "comunicados" },
      { href: "/enquetes",    label: "Enquetes",    icon: Vote,          roles: EQUIPE, modulo: "enquetes" },
      { href: "/moradores",   label: "Moradores",   icon: Users,         roles: EQUIPE, modulo: "moradores" },
      { href: "/reservas",    label: "Reservas",    icon: CalendarClock, roles: EQUIPE, modulo: "reservas" },
    ],
  },
  {
    titulo: "Gestão",
    itens: [
      { href: "/prestadores", label: "Prestadores", icon: HardHat,       roles: EQUIPE,                            modulo: "prestadores" },
      { href: "/contratos",   label: "Contratos",   icon: FileSignature, roles: [...GESTORES, "CONSELHO"],          modulo: "contratos" },
      { href: "/documentos",  label: "Documentos",  icon: FolderOpen,    roles: [...GESTORES, "CONSELHO", "ZELADOR"], modulo: "documentos" },
      { href: "/financeiro",  label: "Financeiro",  icon: Wallet,        roles: [...GESTORES, "CONSELHO"],          modulo: "financeiro" },
    ],
  },
  {
    titulo: "Administração",
    itens: [
      { href: "/zia",           label: "Zia",           icon: Sparkles,   roles: GESTORES, modulo: "zia", highlight: true },
      { href: "/auditoria",     label: "Auditoria",     icon: History,    roles: ["SINDICO", "ADMIN", "CONSELHO"], modulo: "auditoria" },
      { href: "/configuracoes", label: "Configurações", icon: Settings,   roles: GESTORES },
    ],
  },
]

// ─── Seletor de condomínio ────────────────────────────────────────────────────

function SeletorCondominio() {
  const { usuario, trocarCondominio } = useAuth()
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const fechar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener("mousedown", fechar)
    return () => document.removeEventListener("mousedown", fechar)
  }, [aberto])

  const condominios = usuario?.condominios ?? []
  const podeAdicionar = ehSindico(usuario?.role)
  const interativo = condominios.length > 1 || podeAdicionar

  return (
    <div ref={ref} className="relative border-b border-border">
      <button
        type="button"
        disabled={!interativo}
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-accent/40 transition-colors disabled:hover:bg-transparent"
      >
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{usuario?.condominio?.nome ?? "Carregando..."}</p>
          <p className="text-[10px] text-muted-foreground">
            {condominios.length > 1 ? `${condominios.length} condomínios` : "Condomínio"}
          </p>
        </div>
        {interativo && <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform", aberto && "rotate-180")} />}
      </button>

      {aberto && (
        <div className="absolute left-2 right-2 top-full mt-1 z-50 rounded-xl border border-border bg-background shadow-xl overflow-hidden">
          <div className="max-h-64 overflow-y-auto py-1">
            {condominios.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setAberto(false); if (c.id !== usuario?.condominio.id) trocarCondominio(c.id) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/60"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-medium truncate">{c.nome}</span>
                  <span className="block text-[10px] text-muted-foreground">{ROLE_LABEL[c.role as Role] ?? c.role}</span>
                </span>
                {c.id === usuario?.condominio.id && <Check className="w-3.5 h-3.5 text-primary" />}
              </button>
            ))}
          </div>
          {podeAdicionar && (
            <Link
              href="/condominios"
              onClick={() => setAberto(false)}
              className="flex items-center gap-2 px-3 py-2 border-t border-border text-xs font-medium text-primary hover:bg-primary/5"
            >
              <Plus className="w-3.5 h-3.5" /> Gerenciar condomínios
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Aviso de assinatura ──────────────────────────────────────────────────────

function AvisoAssinatura() {
  const { usuario } = useAuth()
  const a = usuario?.assinatura
  if (!a || !ehSindico(usuario?.role)) return null

  let texto: string | null = null
  let urgente = false
  if (a.status === "TRIAL") {
    texto = a.diasTrial > 0 ? `Teste grátis: ${a.diasTrial} dia${a.diasTrial > 1 ? "s" : ""}` : "Teste encerrado"
    urgente = a.diasTrial <= 3
  } else if (a.status === "INADIMPLENTE") {
    texto = "Pagamento pendente"; urgente = true
  } else if (a.status === "CANCELADA") {
    texto = "Assinatura cancelada"; urgente = true
  }
  if (!texto) return null

  return (
    <Link
      href="/assinatura"
      className={cn(
        "mx-3 mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
        urgente ? "bg-red-50 text-red-700" : "bg-primary/10 text-primary"
      )}
    >
      <CreditCard className="w-3.5 h-3.5 shrink-0" />
      <span className="flex-1">{texto}</span>
      <span className="underline">Assinar</span>
    </Link>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const { usuario, logout, temModulo } = useAuth()
  const role = usuario?.role as Role | undefined
  const usuarioNome = usuario?.nome ?? "..."

  return (
    <aside className="w-[220px] h-[100dvh] flex flex-col border-r border-border bg-background">
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

      <SeletorCondominio />

      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {SECOES.map((secao, i) => {
          const itens = secao.itens.filter((it) => !role || it.roles.includes(role))
          if (itens.length === 0) return null
          return (
            <div key={i} className={cn(i > 0 && "mt-3")}>
              {secao.titulo && (
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {secao.titulo}
                </p>
              )}
              {itens.map((item) => {
                const isActive  = pathname === item.href || pathname.startsWith(item.href + "/")
                const bloqueado = !!item.modulo && !temModulo(item.modulo)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors mb-0.5",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : item.highlight
                        ? "text-primary hover:bg-primary/10 font-medium"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                      bloqueado && !isActive && "opacity-60"
                    )}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {bloqueado ? (
                      <Lock className="w-3 h-3" />
                    ) : item.highlight && !isActive ? (
                      <span className="text-[9px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">IA</span>
                    ) : null}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      <AvisoAssinatura />
      <div className="px-2 pb-1"><InstalarApp variante="botao" /></div>

      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2.5">
          <Avatar className="w-7 h-7">
            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
              {usuarioNome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{usuarioNome}</p>
            <p className="text-[10px] text-muted-foreground">{ROLE_LABEL[role as Role] ?? "..."}</p>
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
