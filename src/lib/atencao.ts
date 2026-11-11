import { prisma } from "./prisma"
import { STATUS_ABERTOS } from "./preventiva"
import { formatMoeda } from "./utils"

export type Severidade = "critico" | "alerta" | "info"

export interface ItemAtencao {
  id: string
  severidade: Severidade
  titulo: string
  descricao: string
  href: string
  quantidade?: number
}

const DIA = 86_400_000
const dias = (d: Date) => Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / DIA)
const prazo = (d: Date) => {
  const n = dias(d)
  return n < 0 ? `venceu há ${-n} dia${n < -1 ? "s" : ""}` : n === 0 ? "vence hoje" : `vence em ${n} dia${n > 1 ? "s" : ""}`
}

/**
 * Tudo o que exige uma ação do síndico hoje, do mais grave para o menos grave.
 * Usado no dashboard, no resumo diário e no contexto da Zia.
 */
export async function itensDeAtencao(condominioId: string): Promise<ItemAtencao[]> {
  const agora = new Date()
  const hoje = new Date(new Date().setHours(0, 0, 0, 0))
  const em30 = new Date(hoje.getTime() + 30 * DIA)
  const ha3dias = new Date(agora.getTime() - 3 * DIA)
  const ha7dias = new Date(agora.getTime() - 7 * DIA)

  const [
    atrasadas, orcamentos, despesas, contratos, certificados, garantias,
    encomendasParadas, urgentes, parados, reservas, semPlano,
  ] = await Promise.all([
    prisma.manutencaoHistorico.findMany({
      where: { condominioId, status: { in: STATUS_ABERTOS }, agendadoEm: { lt: hoje } },
      select: { id: true, titulo: true, agendadoEm: true, equipamento: { select: { nome: true } } },
      orderBy: { agendadoEm: "asc" },
    }),
    prisma.manutencaoHistorico.findMany({
      where: { condominioId, orcamentoStatus: "PENDENTE" },
      select: { titulo: true, orcamentoValor: true },
    }),
    prisma.despesa.findMany({
      where: { condominioId, status: "PENDENTE_APROVACAO" },
      select: { valor: true },
    }),
    prisma.contrato.findMany({
      where: { condominioId, ativo: true, fim: { not: null, lte: new Date(hoje.getTime() + 90 * DIA) } },
      select: { id: true, titulo: true, fim: true, avisoDias: true, renovacaoAutomatica: true },
    }),
    prisma.certificado.findMany({
      where: { condominioId, validoAte: { not: null, lte: em30 } },
      select: { id: true, titulo: true, validoAte: true },
      orderBy: { validoAte: "asc" },
    }),
    prisma.equipamento.findMany({
      where: { condominioId, ativo: true, garantiaAte: { gte: hoje, lte: em30 } },
      select: { id: true, nome: true, garantiaAte: true },
    }),
    prisma.encomenda.count({ where: { condominioId, status: "AGUARDANDO", createdAt: { lt: ha3dias } } }),
    prisma.chamado.findMany({
      where: { condominioId, prioridade: "URGENTE", status: { in: ["ABERTO", "EM_ANDAMENTO", "AGUARDANDO_PRESTADOR"] } },
      select: { titulo: true },
    }),
    prisma.chamado.count({ where: { condominioId, status: "ABERTO", createdAt: { lt: ha7dias } } }),
    prisma.reserva.count({ where: { condominioId, status: "PENDENTE", data: { gte: hoje } } }),
    prisma.equipamento.count({ where: { condominioId, ativo: true, planos: { none: { ativo: true } } } }),
  ])

  const itens: ItemAtencao[] = []

  if (atrasadas.length) {
    const p = atrasadas[0]
    itens.push({
      id: "manutencoes-atrasadas", severidade: "critico", quantidade: atrasadas.length,
      titulo: atrasadas.length === 1 ? "Manutenção atrasada" : `${atrasadas.length} manutenções atrasadas`,
      descricao: `${p.equipamento?.nome ? p.equipamento.nome + ": " : ""}${p.titulo} (${prazo(p.agendadoEm!).replace("venceu", "atrasada")})`,
      href: "/manutencoes?filtro=atrasadas",
    })
  }

  for (const c of certificados.filter((c) => dias(c.validoAte!) < 0)) {
    itens.push({ id: `cert-${c.id}`, severidade: "critico", titulo: `${c.titulo} vencido`, descricao: prazo(c.validoAte!), href: "/contratos?aba=certificados" })
  }

  for (const c of contratos.filter((c) => dias(c.fim!) < 0 && !c.renovacaoAutomatica)) {
    itens.push({ id: `contrato-${c.id}`, severidade: "critico", titulo: `Contrato vencido: ${c.titulo}`, descricao: prazo(c.fim!), href: "/contratos" })
  }

  if (urgentes.length) {
    itens.push({
      id: "chamados-urgentes", severidade: "critico", quantidade: urgentes.length,
      titulo: urgentes.length === 1 ? "Ocorrência urgente em aberto" : `${urgentes.length} ocorrências urgentes em aberto`,
      descricao: urgentes[0].titulo, href: "/ocorrencias",
    })
  }

  if (orcamentos.length) {
    const total = orcamentos.reduce((t, o) => t + Number(o.orcamentoValor ?? 0), 0)
    itens.push({
      id: "orcamentos", severidade: "alerta", quantidade: orcamentos.length,
      titulo: orcamentos.length === 1 ? "Orçamento aguardando aprovação" : `${orcamentos.length} orçamentos aguardando aprovação`,
      descricao: `${orcamentos[0].titulo}${orcamentos.length > 1 ? " e outros" : ""} — ${formatMoeda(total)}`,
      href: "/manutencoes?filtro=orcamento",
    })
  }

  if (despesas.length) {
    itens.push({
      id: "despesas", severidade: "alerta", quantidade: despesas.length,
      titulo: despesas.length === 1 ? "Despesa aguardando aprovação" : `${despesas.length} despesas aguardando aprovação`,
      descricao: formatMoeda(despesas.reduce((t, d) => t + Number(d.valor), 0)),
      href: "/financeiro",
    })
  }

  for (const c of certificados.filter((c) => dias(c.validoAte!) >= 0)) {
    itens.push({ id: `cert-${c.id}`, severidade: "alerta", titulo: c.titulo, descricao: prazo(c.validoAte!), href: "/contratos?aba=certificados" })
  }

  for (const c of contratos.filter((c) => { const d = dias(c.fim!); return d >= 0 && d <= c.avisoDias })) {
    itens.push({
      id: `contrato-${c.id}`, severidade: "alerta", titulo: `Contrato: ${c.titulo}`,
      descricao: `${prazo(c.fim!)}${c.renovacaoAutomatica ? " (renova automaticamente)" : " — renovar ou cotar"}`,
      href: "/contratos",
    })
  }

  if (reservas) {
    itens.push({ id: "reservas", severidade: "alerta", quantidade: reservas, titulo: `${reservas} reserva${reservas > 1 ? "s" : ""} aguardando confirmação`, descricao: "Moradores esperando resposta", href: "/reservas" })
  }

  if (parados) {
    itens.push({ id: "chamados-parados", severidade: "alerta", quantidade: parados, titulo: `${parados} ocorrência${parados > 1 ? "s" : ""} sem andamento há 7+ dias`, descricao: "Atualize o status para o morador acompanhar", href: "/ocorrencias" })
  }

  for (const g of garantias) {
    itens.push({ id: `garantia-${g.id}`, severidade: "info", titulo: `Garantia: ${g.nome}`, descricao: `${prazo(g.garantiaAte!)} — acione o fabricante se houver defeito`, href: `/equipamentos/${g.id}` })
  }

  if (encomendasParadas) {
    itens.push({ id: "encomendas", severidade: "info", quantidade: encomendasParadas, titulo: `${encomendasParadas} encomenda${encomendasParadas > 1 ? "s" : ""} há mais de 3 dias na portaria`, descricao: "Reenvie o aviso aos moradores", href: "/entregas" })
  }

  if (semPlano) {
    itens.push({ id: "sem-plano", severidade: "info", quantidade: semPlano, titulo: `${semPlano} equipamento${semPlano > 1 ? "s" : ""} sem plano preventivo`, descricao: "Cadastre a rotina para o ZeloH agendar sozinho", href: "/equipamentos" })
  }

  return itens
}
