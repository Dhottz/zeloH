import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exigirSessao, lerCorpo, erro, dataOuNull } from "@/lib/api"
import { podeGerenciar } from "@/lib/permissions"
import { registrarAuditoria } from "@/lib/auditoria"
import { z } from "zod"

type Params = { params: Promise<{ id: string }> }

const updateSchema = z.object({
  tipo:          z.string().optional(),
  titulo:        z.string().min(2).optional(),
  numero:        z.string().nullable().optional(),
  emissor:       z.string().nullable().optional(),
  emitidoEm:     z.string().nullable().optional(),
  validoAte:     z.string().nullable().optional(),
  arquivo:       z.string().nullable().optional(),
  equipamentoId: z.string().uuid().nullable().optional(),
  prestadorId:   z.string().uuid().nullable().optional(),
  observacoes:   z.string().nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: Params) {
  const s = await exigirSessao(podeGerenciar)
  if (!s.ok) return s.res
  const corpo = await lerCorpo(req, updateSchema)
  if (!corpo.ok) return corpo.res
  const { id } = await params

  const atual = await prisma.certificado.findFirst({ where: { id, condominioId: s.data.condominioId } })
  if (!atual) return erro("Certificado não encontrado", 404)

  const d = corpo.data
  if (d.equipamentoId && !(await prisma.equipamento.findFirst({ where: { id: d.equipamentoId, condominioId: s.data.condominioId } }))) {
    return erro("Equipamento não encontrado", 404)
  }
  if (d.prestadorId && !(await prisma.prestador.findFirst({ where: { id: d.prestadorId, condominioId: s.data.condominioId } }))) {
    return erro("Prestador não encontrado", 404)
  }

  const certificado = await prisma.certificado.update({
    where: { id },
    data: {
      ...d,
      ...(d.emitidoEm !== undefined ? { emitidoEm: dataOuNull(d.emitidoEm) } : {}),
      ...(d.validoAte !== undefined ? { validoAte: dataOuNull(d.validoAte) } : {}),
    },
    include: { equipamento: { select: { id: true, nome: true } }, prestador: { select: { id: true, nome: true } } },
  })

  await registrarAuditoria(s.data, "EDITAR", "Certificado", id, `Editou "${atual.titulo}"`)
  return NextResponse.json(certificado)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const s = await exigirSessao(podeGerenciar)
  if (!s.ok) return s.res
  const { id } = await params

  const atual = await prisma.certificado.findFirst({ where: { id, condominioId: s.data.condominioId } })
  if (!atual) return erro("Certificado não encontrado", 404)

  await prisma.certificado.delete({ where: { id } })
  await registrarAuditoria(s.data, "EXCLUIR", "Certificado", id, `Excluiu "${atual.titulo}"`)
  return NextResponse.json({ ok: true })
}
