import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exigirSessao, exigirModulo, lerCorpo, dataOuNull, erro } from "@/lib/api"
import { podeAprovar, podeGerenciar, podeVerFinanceiro } from "@/lib/permissions"
import { registrarAuditoria } from "@/lib/auditoria"
import { notificarUsuarios, idsGestores } from "@/lib/notificacao"
import { formatMoeda } from "@/lib/utils"
import type { Prisma } from "@/generated/prisma/client"
import { z } from "zod"

const schema = z.object({
  descricao:      z.string().min(2, "Descrição obrigatória"),
  categoria:      z.string().min(2),
  valor:          z.number().positive("Valor deve ser maior que zero"),
  competencia:    z.string().min(1, "Informe a data"),
  vencimento:     z.string().nullable().optional(),
  formaPagamento: z.string().nullable().optional(),
  comprovante:    z.string().nullable().optional(),
  notaFiscal:     z.string().nullable().optional(),
  prestadorId:    z.string().uuid().nullable().optional(),
  equipamentoId:  z.string().uuid().nullable().optional(),
  contratoId:     z.string().uuid().nullable().optional(),
  observacoes:    z.string().nullable().optional(),
  jaAprovada:     z.boolean().default(false),
  jaPaga:         z.boolean().default(false),
})

const INCLUDE = {
  prestador:   { select: { id: true, nome: true } },
  equipamento: { select: { id: true, nome: true } },
  manutencao:  { select: { id: true, titulo: true } },
  contrato:    { select: { id: true, titulo: true } },
} as const

/** GET /api/despesas?ano=&mes=&status=&categoria= */
export async function GET(req: NextRequest) {
  const s = await exigirSessao(podeVerFinanceiro)
  if (!s.ok) return s.res

  const sp = req.nextUrl.searchParams
  const ano = parseInt(sp.get("ano") ?? String(new Date().getFullYear()))
  const mes = sp.get("mes") ? parseInt(sp.get("mes")!) : null // 1-12
  const status = sp.get("status")
  const categoria = sp.get("categoria")

  const inicio = new Date(ano, mes ? mes - 1 : 0, 1)
  const fim = new Date(ano, mes ? mes : 12, 1)

  const where: Prisma.DespesaWhereInput = {
    condominioId: s.data.condominioId,
    competencia: { gte: inicio, lt: fim },
    ...(status ? { status: status as Prisma.EnumDespesaStatusFilter["equals"] } : {}),
    ...(categoria ? { categoria } : {}),
  }

  const [despesas, pendentes] = await Promise.all([
    prisma.despesa.findMany({ where, include: INCLUDE, orderBy: [{ competencia: "desc" }, { createdAt: "desc" }] }),
    prisma.despesa.count({ where: { condominioId: s.data.condominioId, status: "PENDENTE_APROVACAO" } }),
  ])

  const soma = (lista: typeof despesas) => lista.reduce((t, d) => t + Number(d.valor), 0)
  const realizadas = despesas.filter((d) => d.status === "APROVADA" || d.status === "PAGA")

  return NextResponse.json({
    despesas,
    totais: {
      realizado: soma(realizadas),
      pago: soma(despesas.filter((d) => d.status === "PAGA")),
      aPagar: soma(despesas.filter((d) => d.status === "APROVADA")),
      aguardandoAprovacao: soma(despesas.filter((d) => d.status === "PENDENTE_APROVACAO")),
    },
    pendentesAprovacao: pendentes,
  })
}

export async function POST(req: NextRequest) {
  const s = await exigirSessao(podeGerenciar)
  if (!s.ok) return s.res
  const bloqueio = await exigirModulo(s.data.condominioId, "financeiro")
  if (bloqueio) return bloqueio
  const corpo = await lerCorpo(req, schema)
  if (!corpo.ok) return corpo.res
  const { jaAprovada, jaPaga, ...d } = corpo.data

  const competencia = dataOuNull(d.competencia)
  if (!competencia) return erro("Data inválida")

  // Vínculos precisam ser do mesmo condomínio
  const cid = s.data.condominioId
  const [p, e, c] = await Promise.all([
    d.prestadorId ? prisma.prestador.findFirst({ where: { id: d.prestadorId, condominioId: cid }, select: { id: true } }) : null,
    d.equipamentoId ? prisma.equipamento.findFirst({ where: { id: d.equipamentoId, condominioId: cid }, select: { id: true } }) : null,
    d.contratoId ? prisma.contrato.findFirst({ where: { id: d.contratoId, condominioId: cid }, select: { id: true } }) : null,
  ])

  const aprovada = (jaAprovada || jaPaga) && podeAprovar(s.data.role)
  const despesa = await prisma.despesa.create({
    data: {
      ...d,
      prestadorId: p?.id ?? null,
      equipamentoId: e?.id ?? null,
      contratoId: c?.id ?? null,
      competencia,
      vencimento: dataOuNull(d.vencimento),
      condominioId: cid,
      criadoPor: s.data.nome,
      status: aprovada ? (jaPaga ? "PAGA" : "APROVADA") : "PENDENTE_APROVACAO",
      ...(aprovada ? { aprovadoPor: s.data.nome, aprovadoEm: new Date() } : {}),
      ...(aprovada && jaPaga ? { pagoEm: new Date() } : {}),
    },
    include: INCLUDE,
  })

  if (!aprovada) {
    await notificarUsuarios({
      condominioId: cid,
      usuarioIds:   (await idsGestores(cid, true)).filter((id) => id !== s.data.sub),
      titulo:       "Despesa aguardando aprovação",
      descricao:    `${despesa.descricao}: ${formatMoeda(d.valor)} (${despesa.categoria})`,
      link:         "/financeiro",
    })
  }
  await registrarAuditoria(s.data, "CRIAR", "Despesa", despesa.id, `Lançou despesa "${despesa.descricao}" de ${formatMoeda(d.valor)}`)

  return NextResponse.json(despesa, { status: 201 })
}
