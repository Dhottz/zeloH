import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exigirSessao, exigirModulo, lerCorpo, erro } from "@/lib/api"
import { podeGerenciar } from "@/lib/permissions"
import { registrarAuditoria } from "@/lib/auditoria"
import { gerarPreventivas } from "@/lib/preventiva"
import { z } from "zod"

const planoSchema = z.object({
  titulo:           z.string().min(3, "Título obrigatório"),
  descricao:        z.string().nullable().optional(),
  equipamentoId:    z.string().uuid().nullable().optional(),
  prestadorId:      z.string().uuid().nullable().optional(),
  intervaloDias:    z.number().int().min(1, "Periodicidade inválida").max(3650),
  proximaEm:        z.string().min(1, "Informe a próxima execução"),
  antecedenciaDias: z.number().int().min(0).max(90).default(7),
  checklist:        z.array(z.string()).default([]),
  ativo:            z.boolean().default(true),
})

/** GET /api/planos?equipamentoId= — planos de manutenção preventiva. */
export async function GET(req: NextRequest) {
  const s = await exigirSessao((r) => r !== "MORADOR")
  if (!s.ok) return s.res

  const equipamentoId = req.nextUrl.searchParams.get("equipamentoId")
  const planos = await prisma.planoManutencao.findMany({
    where: {
      condominioId: s.data.condominioId,
      ...(equipamentoId ? { equipamentoId } : {}),
      ...(s.data.role === "PRESTADOR" ? { prestadorId: s.data.prestadorId ?? "__nenhum__" } : {}),
    },
    include: {
      equipamento: { select: { id: true, nome: true } },
      prestador:   { select: { id: true, nome: true } },
      _count:      { select: { manutencoes: true } },
    },
    orderBy: [{ ativo: "desc" }, { proximaEm: "asc" }],
  })
  return NextResponse.json({ planos })
}

export async function POST(req: NextRequest) {
  const s = await exigirSessao(podeGerenciar)
  if (!s.ok) return s.res
  const bloqueio = await exigirModulo(s.data.condominioId, "manutencoes")
  if (bloqueio) return bloqueio
  const corpo = await lerCorpo(req, planoSchema)
  if (!corpo.ok) return corpo.res
  const d = corpo.data

  const proximaEm = new Date(d.proximaEm)
  if (isNaN(proximaEm.getTime())) return erro("Data inválida")

  if (d.equipamentoId && !(await prisma.equipamento.findFirst({ where: { id: d.equipamentoId, condominioId: s.data.condominioId } }))) {
    return erro("Equipamento não encontrado", 404)
  }
  if (d.prestadorId && !(await prisma.prestador.findFirst({ where: { id: d.prestadorId, condominioId: s.data.condominioId } }))) {
    return erro("Prestador não encontrado", 404)
  }

  const plano = await prisma.planoManutencao.create({
    data: {
      ...d,
      checklist: d.checklist.map((c) => c.trim()).filter(Boolean),
      proximaEm,
      condominioId: s.data.condominioId,
    },
  })

  await registrarAuditoria(s.data, "CRIAR", "PlanoManutencao", plano.id, `Criou o plano preventivo "${plano.titulo}"`)

  // Se a primeira execução já está dentro da antecedência, gera a OS na hora
  const geradas = await gerarPreventivas(s.data.condominioId)

  return NextResponse.json({ ...plano, geradas }, { status: 201 })
}
