import { prisma } from "./prisma"
import { notificarPainel, notificarUsuarios } from "./notificacao"

export const STATUS_ABERTOS = ["OPEN", "PENDING", "IN_PROGRESS"]

export const MANUTENCAO_INCLUDE = {
  equipamento: { select: { id: true, nome: true, categoria: true } },
  prestador:   { select: { id: true, nome: true } },
  plano:       { select: { id: true, titulo: true, intervaloDias: true } },
  chamado:     { select: { id: true, titulo: true } },
  avaliacoes:  { select: { nota: true, comentario: true } },
} as const

export interface ItemChecklist {
  item: string
  feito: boolean
}

export function checklistDeLista(itens: string[]): ItemChecklist[] {
  return itens.map((i) => i.trim()).filter(Boolean).map((item) => ({ item, feito: false }))
}

const DIA = 86_400_000
const MAX_POR_PLANO = 3 // evita gerar dezenas de OS de uma vez se o plano ficou parado

/**
 * Gera as ordens de serviço preventivas dos planos que estão dentro da antecedência.
 * Cada OS fica agendada na data prevista; o plano avança para o próximo ciclo.
 * Idempotente: não duplica uma OS já criada para o mesmo plano e data.
 */
export async function gerarPreventivas(condominioId?: string): Promise<number> {
  const agora = Date.now()
  const planos = await prisma.planoManutencao.findMany({
    where: { ativo: true, ...(condominioId ? { condominioId } : {}) },
    include: {
      prestador:   { select: { id: true, nome: true, cnpj: true } },
      equipamento: { select: { id: true, nome: true, local: true } },
    },
  })

  let geradas = 0

  for (const plano of planos) {
    let proxima = plano.proximaEm
    let criadasNoPlano = 0

    while (proxima.getTime() - plano.antecedenciaDias * DIA <= agora && criadasNoPlano < MAX_POR_PLANO) {
      const existe = await prisma.manutencaoHistorico.findFirst({
        where: { planoId: plano.id, agendadoEm: proxima },
        select: { id: true },
      })

      if (!existe) {
        await prisma.manutencaoHistorico.create({
          data: {
            condominioId:  plano.condominioId,
            titulo:        plano.titulo,
            descricao:     plano.descricao,
            status:        "PENDING",
            prioridade:    "MEDIUM",
            tipo:          "PREVENTIVA",
            origem:        "PLANO",
            planoId:       plano.id,
            equipamentoId: plano.equipamentoId,
            prestadorId:   plano.prestadorId,
            prestadorNome: plano.prestador?.nome ?? null,
            prestadorCnpj: plano.prestador?.cnpj ?? null,
            empresaNome:   plano.prestador?.nome ?? null,
            local:         plano.equipamento?.local ?? null,
            agendadoEm:    proxima,
            checklist:     plano.checklist.length ? (checklistDeLista(plano.checklist) as unknown as object) : undefined,
          },
        })
        geradas++
        criadasNoPlano++

        const quando = proxima.toLocaleDateString("pt-BR")
        await notificarPainel({
          condominioId: plano.condominioId,
          titulo:       `Preventiva agendada: ${plano.titulo}`,
          descricao:    `${plano.equipamento?.nome ? plano.equipamento.nome + " · " : ""}${quando}`,
          link:         "/manutencoes",
          autorNome:    "ZeloH",
        })

        if (plano.prestadorId) {
          const usuariosPrestador = await prisma.usuario.findMany({
            where: { prestadorId: plano.prestadorId, isActive: true, condominioId: plano.condominioId },
            select: { id: true },
          })
          await notificarUsuarios({
            condominioId: plano.condominioId,
            usuarioIds:   usuariosPrestador.map((u) => u.id),
            titulo:       `Nova manutenção preventiva: ${plano.titulo}`,
            descricao:    `Agendada para ${quando}.`,
            link:         "/manutencoes",
          })
        }
      }

      proxima = new Date(proxima.getTime() + plano.intervaloDias * DIA)
    }

    if (proxima.getTime() !== plano.proximaEm.getTime()) {
      await prisma.planoManutencao.update({ where: { id: plano.id }, data: { proximaEm: proxima } })
    }
  }

  return geradas
}

export const PERIODICIDADES = [
  { dias: 7,   rotulo: "Semanal" },
  { dias: 15,  rotulo: "Quinzenal" },
  { dias: 30,  rotulo: "Mensal" },
  { dias: 60,  rotulo: "Bimestral" },
  { dias: 90,  rotulo: "Trimestral" },
  { dias: 180, rotulo: "Semestral" },
  { dias: 365, rotulo: "Anual" },
]
