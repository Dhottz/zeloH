import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exigirSessao, lerCorpo, erro, dataOuNull } from "@/lib/api"
import { podeGerenciar } from "@/lib/permissions"
import { registrarAuditoria } from "@/lib/auditoria"
import { z } from "zod"

type Params = { params: Promise<{ id: string }> }

const CONTRATO_INCLUDE = {
  prestador:    { select: { id: true, nome: true, telefone: true, email: true } },
  equipamentos: { select: { id: true, nome: true } },
} as const

const updateSchema = z.object({
  titulo:              z.string().min(3).optional(),
  objeto:              z.string().nullable().optional(),
  prestadorId:         z.string().uuid().nullable().optional(),
  valor:               z.number().nonnegative().nullable().optional(),
  periodicidade:       z.enum(["MENSAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL", "AVULSO"]).optional(),
  inicio:              z.string().optional(),
  fim:                 z.string().nullable().optional(),
  renovacaoAutomatica: z.boolean().optional(),
  avisoDias:           z.number().int().min(0).max(365).optional(),
  arquivo:             z.string().nullable().optional(),
  observacoes:         z.string().nullable().optional(),
  ativo:               z.boolean().optional(),
  equipamentoIds:      z.array(z.string().uuid()).optional(),
})

export async function PATCH(req: NextRequest, { params }: Params) {
  const s = await exigirSessao(podeGerenciar)
  if (!s.ok) return s.res
  const corpo = await lerCorpo(req, updateSchema)
  if (!corpo.ok) return corpo.res
  const { id } = await params

  const atual = await prisma.contrato.findFirst({ where: { id, condominioId: s.data.condominioId } })
  if (!atual) return erro("Contrato não encontrado", 404)

  const { equipamentoIds, ...d } = corpo.data
  let equipamentos: { id: string }[] | undefined
  if (equipamentoIds) {
    equipamentos = await prisma.equipamento.findMany({
      where: { id: { in: equipamentoIds }, condominioId: s.data.condominioId },
      select: { id: true },
    })
  }

  const contrato = await prisma.contrato.update({
    where: { id },
    data: {
      ...d,
      ...(d.inicio ? { inicio: new Date(d.inicio) } : {}),
      ...(d.fim !== undefined ? { fim: dataOuNull(d.fim) } : {}),
      ...(equipamentos ? { equipamentos: { set: equipamentos } } : {}),
    },
    include: CONTRATO_INCLUDE,
  })

  await registrarAuditoria(
    s.data, "EDITAR", "Contrato", id,
    d.ativo === false ? `Encerrou o contrato "${atual.titulo}"` : `Editou o contrato "${atual.titulo}"`,
    { campos: Object.keys(corpo.data) }
  )
  return NextResponse.json(contrato)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const s = await exigirSessao(podeGerenciar)
  if (!s.ok) return s.res
  const { id } = await params

  const atual = await prisma.contrato.findFirst({ where: { id, condominioId: s.data.condominioId } })
  if (!atual) return erro("Contrato não encontrado", 404)

  await prisma.contrato.delete({ where: { id } })
  await registrarAuditoria(s.data, "EXCLUIR", "Contrato", id, `Excluiu o contrato "${atual.titulo}"`)
  return NextResponse.json({ ok: true })
}
