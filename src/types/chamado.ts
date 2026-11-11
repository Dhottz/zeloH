export type ChamadoStatus =
  | "ABERTO"
  | "EM_ANDAMENTO"
  | "AGUARDANDO_PRESTADOR"
  | "CONCLUIDO"
  | "CANCELADO"
  | "ARQUIVADO"

export type ChamadoPriority = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE"

export interface ChamadoMorador {
  id: string
  nome: string
  unidade: string | null
  bloco: string | null
}

export interface Chamado {
  id: string
  titulo: string
  descricao?: string | null
  status: ChamadoStatus
  prioridade: ChamadoPriority
  createdAt: string
  updatedAt: string
  morador: ChamadoMorador
  visttoOsId?: string | null
  visttoOsCod?: string | null
  local?: string | null
  fotos?: string[]
  equipamentoId?: string | null
  equipamento?: { id: string; nome: string } | null
  manutencoes?: { id: string; titulo: string; status: string }[]
  avaliacaoNota?: number | null
  avaliacaoComentario?: string | null
}
