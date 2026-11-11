"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Clock, Wrench, AlertTriangle } from "lucide-react"

export interface ItemChecklist { item: string; feito: boolean }

export interface Manutencao {
  id: string
  visttoOsId: string | null
  visttoOsCod: string | null
  titulo: string
  descricao: string | null
  status: string
  prioridade: string | null
  tipo: "PREVENTIVA" | "CORRETIVA"
  prestadorNome: string | null
  prestadorCnpj: string | null
  empresaNome: string | null
  observacoes: string | null
  local: string | null
  valor: string | number | null
  agendadoEm: string | null
  concluidoEm: string | null
  visivelParaMoradores: boolean
  origem: string
  checklist: ItemChecklist[] | null
  fotos: string[]
  anexos: string[]
  orcamentoStatus: "NAO_SE_APLICA" | "PENDENTE" | "APROVADO" | "REPROVADO"
  orcamentoValor: string | number | null
  orcamentoArquivo: string | null
  orcamentoObs: string | null
  orcamentoDecididoPor: string | null
  orcamentoDecididoEm: string | null
  prestadorId: string | null
  equipamentoId: string | null
  equipamento: { id: string; nome: string; categoria: string } | null
  prestador: { id: string; nome: string } | null
  plano: { id: string; titulo: string; intervaloDias: number } | null
  chamado: { id: string; titulo: string } | null
  avaliacoes: { nota: number; comentario: string | null }[]
}

export const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  COMPLETED:   { label: "Concluída",    icon: <CheckCircle2 className="h-3 w-3" />,  color: "bg-green-50 text-green-700 border-green-200" },
  IN_PROGRESS: { label: "Em andamento", icon: <Clock className="h-3 w-3" />,         color: "bg-blue-50 text-blue-700 border-blue-200" },
  PENDING:     { label: "Agendada",     icon: <Clock className="h-3 w-3" />,         color: "bg-amber-50 text-amber-700 border-amber-200" },
  OPEN:        { label: "Aberta",       icon: <Wrench className="h-3 w-3" />,        color: "bg-orange-50 text-orange-700 border-orange-200" },
  CANCELLED:   { label: "Cancelada",    icon: <AlertTriangle className="h-3 w-3" />, color: "bg-red-50 text-red-700 border-red-200" },
}

export const PRIORIDADE_CONFIG: Record<string, { label: string; color: string }> = {
  URGENT: { label: "Urgente", color: "text-red-700 bg-red-100 border-red-300" },
  HIGH:   { label: "Alta",    color: "text-red-600 bg-red-50 border-red-200" },
  MEDIUM: { label: "Média",   color: "text-amber-600 bg-amber-50 border-amber-200" },
  LOW:    { label: "Baixa",   color: "text-green-700 bg-green-50 border-green-200" },
}

export const TIPO_CONFIG = {
  PREVENTIVA: { label: "Preventiva", color: "bg-green-50 text-green-700 border-green-200" },
  CORRETIVA:  { label: "Corretiva",  color: "bg-red-50 text-red-700 border-red-200" },
} as const

export const STATUS_ABERTOS = ["OPEN", "PENDING", "IN_PROGRESS"]

export function estaAtrasada(m: Pick<Manutencao, "status" | "agendadoEm">): boolean {
  if (!m.agendadoEm || !STATUS_ABERTOS.includes(m.status)) return false
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return new Date(m.agendadoEm) < hoje
}

export interface Opcao { id: string; nome: string }

/** Carrega listas de equipamentos e prestadores para os selects. */
export function useOpcoesManutencao(ativo = true) {
  const [equipamentos, setEquipamentos] = useState<Opcao[]>([])
  const [prestadores, setPrestadores]   = useState<Opcao[]>([])
  useEffect(() => {
    if (!ativo) return
    fetch("/api/equipamentos").then((r) => (r.ok ? r.json() : { equipamentos: [] })).then((d) => setEquipamentos(d.equipamentos ?? []))
    fetch("/api/prestadores").then((r) => (r.ok ? r.json() : { prestadores: [] })).then((d) => setPrestadores(d.prestadores ?? []))
  }, [ativo])
  return { equipamentos, prestadores }
}
