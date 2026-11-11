import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exigirSessao, exigirModulo, lerCorpo, erro, dataOuNull } from "@/lib/api"
import { podeGerenciar, podeVerFinanceiro } from "@/lib/permissions"
import { registrarAuditoria } from "@/lib/auditoria"
import { z } from "zod"

const schema = z.object({
  titulo:              z.string().min(3, "Título obrigatório"),
  objeto:              z.string().nullable().optional(),
  prestadorId:         z.string().uuid().nullable().optional(),
  valor:               z.number().nonnegative().nullable().optional(),
  periodicidade:       z.enum(["MENSAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL", "AVULSO"]).default("MENSAL"),
  inicio:              z.string().min(1, "Informe o início da vigência"),
  fim:                 z.string().nullable().optional(),
  renovacaoAutomatica: z.boolean().default(false),
  avisoDias:           z.number().int().min(0).max(365).default(30),
  arquivo:             z.string().nullable().optional(),
  observacoes:         z.string().nullable().optional(),
  equipamentoIds:      z.array(z.string().uuid()).default([]),
})

const CONTRATO_INCLUDE = {
  prestador:    { select: { id: true, nome: true, telefone: true, email: true } },
  equipamentos: { select: { id: true, nome: true } },
} as const

/** GET /api/contratos — contratos com fornecedores, vigência e equipamentos vinculados. */
export async function GET(req: NextRequest) {
  const s = await exigirSessao(podeVerFinanceiro)
  if (!s.ok) return s.res

  const status = req.nextUrl.searchParams.get("status") ?? "ativos"
  const contratos = await prisma.contrato.findMany({
    where: {
      condominioId: s.data.condominioId,
      ...(status === "ativos" ? { ativo: true } : status === "encerrados" ? { ativo: false } : {}),
    },
    include: CONTRATO_INCLUDE,
    orderBy: [{ ativo: "desc" }, { fim: { sort: "asc", nulls: "last" } }],
  })
  return NextResponse.json({ contratos })
}

export async function POST(req: NextRequest) {
  const s = await exigirSessao(podeGerenciar)
  if (!s.ok) return s.res
  const bloqueio = await exigirModulo(s.data.condominioId, "contratos")
  if (bloqueio) return bloqueio
  const corpo = await lerCorpo(req, schema)
  if (!corpo.ok) return corpo.res
  const { equipamentoIds, ...d } = corpo.data

  if (d.prestadorId && !(await prisma.prestador.findFirst({ where: { id: d.prestadorId, condominioId: s.data.condominioId } }))) {
    return erro("Prestador não encontrado", 404)
  }
  const equipamentos = await prisma.equipamento.findMany({
    where: { id: { in: equipamentoIds }, condominioId: s.data.condominioId },
    select: { id: true },
  })

  const contrato = await prisma.contrato.create({
    data: {
      ...d,
      inicio: new Date(d.inicio),
      fim: dataOuNull(d.fim),
      condominioId: s.data.condominioId,
      equipamentos: { connect: equipamentos },
    },
    include: CONTRATO_INCLUDE,
  })

  await registrarAuditoria(s.data, "CRIAR", "Contrato", contrato.id, `Cadastrou o contrato "${contrato.titulo}"`)
  return NextResponse.json(contrato, { status: 201 })
}
