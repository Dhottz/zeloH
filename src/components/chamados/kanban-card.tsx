"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CategoryBadge } from "./category-badge"
import { cn, formatDateTime } from "@/lib/utils"
import { ChevronDown, Check, Home } from "lucide-react"
import type { Chamado, ChamadoStatus } from "@/types/chamado"

const prioridadeBorda: Record<string, string> = {
  BAIXA:   "border-l-gray-300",
  MEDIA:   "border-l-yellow-400",
  ALTA:    "border-l-orange-500",
  URGENTE: "border-l-red-500",
}

const prioridadeBadge: Record<string, string> = {
  BAIXA:   "bg-gray-100 text-gray-600",
  MEDIA:   "bg-yellow-100 text-yellow-700",
  ALTA:    "bg-orange-100 text-orange-700",
  URGENTE: "bg-red-100 text-red-700",
}

const prioridadeLabel: Record<string, string> = {
  BAIXA:   "Baixa",
  MEDIA:   "Média",
  ALTA:    "Alta",
  URGENTE: "Urgente",
}

export const STATUS_OPTIONS: { value: ChamadoStatus; label: string; color: string }[] = [
  { value: "ABERTO",               label: "Aberto",            color: "bg-gray-100 text-gray-700" },
  { value: "EM_ANDAMENTO",         label: "Em andamento",      color: "bg-yellow-100 text-yellow-700" },
  { value: "AGUARDANDO_PRESTADOR", label: "Aguard. prestador", color: "bg-orange-100 text-orange-700" },
  { value: "CONCLUIDO",            label: "Concluído",         color: "bg-green-100 text-green-700" },
]

export function inferirCategoria(titulo: string): string {
  const t = titulo.toLowerCase()
  if (t.includes("vaz") || t.includes("hidráu") || t.includes("cano") || t.includes("água")) return "Hidráulica"
  if (t.includes("elét") || t.includes("lâmpada") || t.includes("energia") || t.includes("curto")) return "Elétrica"
  if (t.includes("barulh") || t.includes("ruído") || t.includes("som") || t.includes("fest")) return "Convivência"
  if (t.includes("portão") || t.includes("câmera") || t.includes("segur")) return "Segurança"
  if (t.includes("pinta") || t.includes("rachadur") || t.includes("infiltr")) return "Infraestrutura"
  return "Manutenção"
}

interface KanbanCardProps {
  chamado: Chamado
  onStatusChange?: (id: string, status: ChamadoStatus) => void
  onOpen?: (chamado: Chamado) => void
}

export function KanbanCard({ chamado, onStatusChange, onOpen }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: chamado.id })

  const style = { transform: CSS.Transform.toString(transform), transition }
  const categoria = inferirCategoria(chamado.titulo)
  const tempo = formatDateTime(chamado.createdAt)
  const iniciais = chamado.morador.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")
  const currentStatus = STATUS_OPTIONS.find((s) => s.value === chamado.status)

  const localizacao = [
    chamado.morador.bloco && `Bloco ${chamado.morador.bloco}`,
    chamado.morador.unidade && `Apto ${chamado.morador.unidade}`,
  ].filter(Boolean).join(" · ")

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className={cn(
          "p-3 cursor-grab active:cursor-grabbing select-none border-l-4 shadow-none hover:shadow-sm transition-shadow",
          prioridadeBorda[chamado.prioridade] ?? "border-l-border",
          isDragging && "opacity-50 shadow-lg rotate-1"
        )}
        onClick={() => onOpen?.(chamado)}
      >
        {/* Localização no topo */}
        {localizacao && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1.5">
            <Home className="w-2.5 h-2.5" />
            <span>{localizacao}</span>
          </div>
        )}

        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-medium text-foreground leading-snug flex-1">{chamado.titulo}</p>
          <CategoryBadge category={categoria} />
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {chamado.prioridade && prioridadeLabel[chamado.prioridade] && (
              <span className={cn(
                "inline-flex items-center shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold",
                prioridadeBadge[chamado.prioridade] ?? "bg-muted text-muted-foreground"
              )}>
                {prioridadeLabel[chamado.prioridade]}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground truncate">{chamado.morador.nome}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">{tempo}</span>
            <Avatar className="w-5 h-5">
              <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                {iniciais}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Status dropdown */}
        {onStatusChange && (
          <div
            className="mt-2 pt-2 border-t border-border flex items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {chamado.visttoOsCod && (
              <span className="text-[10px] text-primary font-medium mr-auto">
                OS {chamado.visttoOsCod}
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                onPointerDown={(e) => e.stopPropagation()}
                className={cn(
                  "ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors hover:opacity-80",
                  currentStatus?.color ?? "bg-muted text-muted-foreground"
                )}
              >
                {currentStatus?.label ?? chamado.status}
                <ChevronDown className="w-2.5 h-2.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {STATUS_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => onStatusChange(chamado.id, opt.value)}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold", opt.color)}>
                      {opt.label}
                    </span>
                    {chamado.status === opt.value && <Check className="w-3 h-3 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {!onStatusChange && chamado.visttoOsCod && (
          <div className="mt-2 pt-2 border-t border-border">
            <span className="text-[10px] text-primary font-medium">OS {chamado.visttoOsCod}</span>
          </div>
        )}
      </Card>
    </div>
  )
}
