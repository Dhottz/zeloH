import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exigirSessao, lerCorpo, erro, dataOuNull } from "@/lib/api"
import { podeGerenciar } from "@/lib/permissions"
import { registrarAuditoria } from "@/lib/auditoria"
import { MANUTENCAO_INCLUDE } from "@/lib/preventiva"
import { removerArquivos } from "@/lib/storage"
import { z } from "zod"

type Params = { params: Promise<{ id: string }> }

const updateSchema = z.object({
  nome:         z.string().min(2).optional(),
  categoria:    z.string().optional(),
  marca:        z.string().nullable().optional(),
  modelo:       z.string().nullable().optional(),
  numeroSerie:  z.string().nullable().optional(),
  local:        z.string().nullable().optional(),
  instaladoEm:  z.string().nullable().optional(),
  garantiaAte:  z.string().nullable().optional(),
  vidaUtilAnos: z.number().int().min(0).max(100).nullable().optional(),
  fotos:        z.array(z.string()).optional(),
  anexos:       z.array(z.string()).optional(),
  observacoes:  z.string().nullable().optional(),
  ativo:        z.boolean().optional(),
})

/** GET — ficha completa: dados, histórico de manutenções, planos, contratos, certificados e ocorrências. */
export async function GET(_req: NextRequest, { params }: Params) {
  const s = await exigirSessao((r) => r !== "MORADOR")
  if (!s.ok) return s.res
  const { id } = await params

  const equipamento = await prisma.equipamento.findFirst({
    where: { id, condominioId: s.data.condominioId },
    include: {
      manutencoes: {
        include: MANUTENCAO_INCLUDE,
        orderBy: [{ agendadoEm: "desc" }, { createdAt: "desc" }],
        take: 100,
      },
      planos: {
        include: { prestador: { select: { id: true, nome: true } } },
        orderBy: { proximaEm: "asc" },
      },
      contratos: {
        select: { id: true, titulo: true, fim: true, ativo: true, prestador: { select: { nome: true } } },
      },
      certificados: {
        select: { id: true, tipo: true, titulo: true, validoAte: true, arquivo: true },
        orderBy: { validoAte: "asc" },
      },
      chamados: {
        select: { id: true, titulo: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      despesas: {
        where: { status: { in: ["APROVADA", "PAGA"] } },
        select: { valor: true },
      },
    },
  })
  if (!equipamento) return erro("Equipamento não encontrado", 404)

  const { despesas, ...resto } = equipamento
  const custoTotal = despesas.reduce((soma, d) => soma + Number(d.valor), 0)

  return NextResponse.json({ ...resto, custoTotal })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const s = await exigirSessao(podeGerenciar)
  if (!s.ok) return s.res
  const corpo = await lerCorpo(req, updateSchema)
  if (!corpo.ok) return corpo.res
  const { id } = await params

  const atual = await prisma.equipamento.findFirst({ where: { id, condominioId: s.data.condominioId } })
  if (!atual) return erro("Equipamento não encontrado", 404)

  const d = corpo.data
  const equipamento = await prisma.equipamento.update({
    where: { id },
    data: {
      ...d,
      ...(d.instaladoEm !== undefined ? { instaladoEm: dataOuNull(d.instaladoEm) } : {}),
      ...(d.garantiaAte !== undefined ? { garantiaAte: dataOuNull(d.garantiaAte) } : {}),
    },
  })

  await registrarAuditoria(s.data, "EDITAR", "Equipamento", id, `Editou o equipamento "${atual.nome}"`, { campos: Object.keys(d) })
  return NextResponse.json(equipamento)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const s = await exigirSessao(podeGerenciar)
  if (!s.ok) return s.res
  const { id } = await params

  const atual = await prisma.equipamento.findFirst({
    where: { id, condominioId: s.data.condominioId },
    include: { _count: { select: { manutencoes: true } } },
  })
  if (!atual) return erro("Equipamento não encontrado", 404)

  // Com histórico, só desativa — o histórico é o ativo mais valioso do condomínio
  if (atual._count.manutencoes > 0) {
    await prisma.equipamento.update({ where: { id }, data: { ativo: false } })
    await registrarAuditoria(s.data, "EDITAR", "Equipamento", id, `Desativou o equipamento "${atual.nome}"`)
    return NextResponse.json({ ok: true, desativado: true })
  }

  await prisma.equipamento.delete({ where: { id } })
  await removerArquivos([...atual.fotos, ...atual.anexos]).catch(() => {})
  await registrarAuditoria(s.data, "EXCLUIR", "Equipamento", id, `Excluiu o equipamento "${atual.nome}"`)
  return NextResponse.json({ ok: true })
}
