import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exigirSessao, lerCorpo, erro } from "@/lib/api"
import { podeGerenciar } from "@/lib/permissions"
import { registrarAuditoria } from "@/lib/auditoria"
import { gerarPreventivas } from "@/lib/preventiva"
import { z } from "zod"

type Params = { params: Promise<{ id: string }> }

const updateSchema = z.object({
  titulo:           z.string().min(3).optional(),
  descricao:        z.string().nullable().optional(),
  equipamentoId:    z.string().uuid().nullable().optional(),
  prestadorId:      z.string().uuid().nullable().optional(),
  intervaloDias:    z.number().int().min(1).max(3650).optional(),
  proximaEm:        z.string().optional(),
  antecedenciaDias: z.number().int().min(0).max(90).optional(),
  checklist:        z.array(z.string()).optional(),
  ativo:            z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: Params) {
  const s = await exigirSessao(podeGerenciar)
  if (!s.ok) return s.res
  const corpo = await lerCorpo(req, updateSchema)
  if (!corpo.ok) return corpo.res
  const { id } = await params

  const plano = await prisma.planoManutencao.findFirst({ where: { id, condominioId: s.data.condominioId } })
  if (!plano) return erro("Plano não encontrado", 404)

  const d = corpo.data
  const atualizado = await prisma.planoManutencao.update({
    where: { id },
    data: {
      ...d,
      ...(d.proximaEm ? { proximaEm: new Date(d.proximaEm) } : {}),
      ...(d.checklist ? { checklist: d.checklist.map((c) => c.trim()).filter(Boolean) } : {}),
    },
  })

  await registrarAuditoria(s.data, "EDITAR", "PlanoManutencao", id, `Editou o plano preventivo "${plano.titulo}"`, { campos: Object.keys(d) })
  if (atualizado.ativo) await gerarPreventivas(s.data.condominioId)

  return NextResponse.json(atualizado)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const s = await exigirSessao(podeGerenciar)
  if (!s.ok) return s.res
  const { id } = await params

  const plano = await prisma.planoManutencao.findFirst({ where: { id, condominioId: s.data.condominioId } })
  if (!plano) return erro("Plano não encontrado", 404)

  // As OS já geradas permanecem no histórico (planoId vira null)
  await prisma.planoManutencao.delete({ where: { id } })
  await registrarAuditoria(s.data, "EXCLUIR", "PlanoManutencao", id, `Excluiu o plano preventivo "${plano.titulo}"`)
  return NextResponse.json({ ok: true })
}
