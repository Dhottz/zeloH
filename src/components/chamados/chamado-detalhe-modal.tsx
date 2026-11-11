"use client"

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CategoryBadge } from "./category-badge"
import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Home, Calendar, Hash, ChevronDown, Check, MapPin, Cog, Wrench, Star } from "lucide-react"
import type { Chamado, ChamadoStatus } from "@/types/chamado"
import { GaleriaArquivos } from "@/components/shared/arquivos-input"
import { ManutencaoForm } from "@/components/manutencoes/manutencao-form"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { podeOperar } from "@/lib/permissions"

const STATUS_OPTIONS: { value: ChamadoStatus; label: string; color: string }[] = [
  { value: "ABERTO",               label: "Aberto",            color: "bg-gray-100 text-gray-700" },
  { value: "EM_ANDAMENTO",         label: "Em andamento",      color: "bg-yellow-100 text-yellow-700" },
  { value: "AGUARDANDO_PRESTADOR", label: "Aguard. prestador", color: "bg-orange-100 text-orange-700" },
  { value: "CONCLUIDO",            label: "Concluído",         color: "bg-green-100 text-green-700" },
]

const prioridadeColor: Record<string, string> = {
  BAIXA:   "bg-gray-100 text-gray-700",
  MEDIA:   "bg-yellow-100 text-yellow-700",
  ALTA:    "bg-orange-100 text-orange-700",
  URGENTE: "bg-red-100 text-red-700",
}

interface ChamadoDetalheModalProps {
  chamado: Chamado | null
  open: boolean
  onClose: () => void
  onStatusChange: (id: string, status: ChamadoStatus) => void
}

function inferirCategoria(titulo: string): string {
  const t = titulo.toLowerCase()
  if (t.includes("vaz") || t.includes("hidráu") || t.includes("cano") || t.includes("água")) return "Hidráulica"
  if (t.includes("elét") || t.includes("lâmpada") || t.includes("energia") || t.includes("curto")) return "Elétrica"
  if (t.includes("barulh") || t.includes("ruído") || t.includes("som") || t.includes("fest")) return "Convivência"
  if (t.includes("portão") || t.includes("câmera") || t.includes("segur")) return "Segurança"
  if (t.includes("pinta") || t.includes("rachadur") || t.includes("infiltr")) return "Infraestrutura"
  return "Manutenção"
}

export function ChamadoDetalheModal({ chamado, open, onClose, onStatusChange }: ChamadoDetalheModalProps) {
  const { usuario, temModulo } = useAuth()
  const [gerarOS, setGerarOS] = useState(false)
  if (!chamado) return null
  const podeGerarOS = podeOperar(usuario?.role) && temModulo("manutencoes")

  const iniciais = chamado.morador.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")
  const categoria = inferirCategoria(chamado.titulo)
  const currentStatus = STATUS_OPTIONS.find((s) => s.value === chamado.status)
  const localizacao = [
    chamado.morador.bloco && `Bloco ${chamado.morador.bloco}`,
    chamado.morador.unidade && `Apto ${chamado.morador.unidade}`,
  ].filter(Boolean).join(" · ")

  const dataAbertura = new Date(chamado.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-base leading-snug pr-6">
            {chamado.titulo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Badges topo */}
          <div className="flex items-center gap-2 flex-wrap">
            <CategoryBadge category={categoria} />
            <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", prioridadeColor[chamado.prioridade])}>
              {chamado.prioridade}
            </span>
            {chamado.visttoOsCod && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                <Hash className="w-2.5 h-2.5" /> OS {chamado.visttoOsCod}
              </span>
            )}
          </div>

          {/* Descrição */}
          {chamado.descricao && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {chamado.descricao}
            </p>
          )}

          {(chamado.local || chamado.equipamento) && (
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {chamado.local && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{chamado.local}</span>}
              {chamado.equipamento && (
                <Link href={`/equipamentos/${chamado.equipamento.id}`} className="flex items-center gap-1 text-primary hover:underline">
                  <Cog className="w-3.5 h-3.5" />{chamado.equipamento.nome}
                </Link>
              )}
            </div>
          )}

          {!!chamado.fotos?.length && <GaleriaArquivos arquivos={chamado.fotos} />}

          {/* Morador + localização */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
            <Avatar className="w-9 h-9 shrink-0">
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                {iniciais}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{chamado.morador.nome}</p>
              {localizacao && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Home className="w-3 h-3" /> {localizacao}
                </p>
              )}
            </div>
          </div>

          {/* Data */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>Aberto em {dataAbertura}</span>
          </div>

          {/* Manutenções geradas a partir do chamado */}
          {!!chamado.manutencoes?.length && (
            <div className="space-y-1">
              {chamado.manutencoes.map((m) => (
                <Link key={m.id} href="/manutencoes" className="flex items-center gap-2 text-xs text-primary hover:underline">
                  <Wrench className="w-3.5 h-3.5" /> OS: {m.titulo}
                </Link>
              ))}
            </div>
          )}
          {podeGerarOS && !["CONCLUIDO", "CANCELADO"].includes(chamado.status) && (
            <Button size="sm" variant="outline" onClick={() => setGerarOS(true)}>
              <Wrench className="w-3.5 h-3.5 mr-1.5" /> Gerar ordem de serviço
            </Button>
          )}

          {chamado.avaliacaoNota != null && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={cn("w-3.5 h-3.5", i < chamado.avaliacaoNota! ? "fill-amber-400 text-amber-400" : "text-amber-200")} />
                ))}
                <span className="text-xs text-amber-900 ml-1.5">avaliação do morador</span>
              </div>
              {chamado.avaliacaoComentario && <p className="text-xs text-amber-900 mt-1">&ldquo;{chamado.avaliacaoComentario}&rdquo;</p>}
            </div>
          )}

          {/* Status */}
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <span className="text-xs text-muted-foreground">Status atual</span>
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors hover:opacity-80",
                currentStatus?.color ?? "bg-muted text-muted-foreground"
              )}>
                {currentStatus?.label ?? chamado.status}
                <ChevronDown className="w-3 h-3" />
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
        </div>
      </DialogContent>
      <ManutencaoForm
        aberto={gerarOS}
        onFechar={() => setGerarOS(false)}
        onSalvo={() => {
          setGerarOS(false)
          if (chamado.status === "ABERTO") onStatusChange(chamado.id, "AGUARDANDO_PRESTADOR")
        }}
        padrao={{
          chamadoId: chamado.id,
          titulo: chamado.titulo,
          descricao: [chamado.descricao, chamado.local && `Local: ${chamado.local}`].filter(Boolean).join(" — "),
          equipamentoId: chamado.equipamentoId ?? undefined,
          tipo: "CORRETIVA",
        }}
      />
    </Dialog>
  )
}
