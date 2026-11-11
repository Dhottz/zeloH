import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exigirSessao, exigirModulo, lerCorpo, dataOuNull } from "@/lib/api"
import { podeGerenciar } from "@/lib/permissions"
import { registrarAuditoria } from "@/lib/auditoria"
import { z } from "zod"

const schema = z.object({
  tipo:          z.string().default("OUTRO"),
  titulo:        z.string().min(2, "Título obrigatório"),
  numero:        z.string().nullable().optional(),
  emissor:       z.string().nullable().optional(),
  emitidoEm:     z.string().nullable().optional(),
  validoAte:     z.string().nullable().optional(),
  arquivo:       z.string().nullable().optional(),
  equipamentoId: z.string().uuid().nullable().optional(),
  prestadorId:   z.string().uuid().nullable().optional(),
  observacoes:   z.string().nullable().optional(),
})

const INCLUDE = {
  equipamento: { select: { id: true, nome: true } },
  prestador:   { select: { id: true, nome: true } },
} as const

/** GET /api/certificados — AVCB, laudos, limpeza de reservatório, seguro... ordenados pelo vencimento. */
export async function GET() {
  const s = await exigirSessao((r) => !["MORADOR", "PRESTADOR", "PORTEIRO"].includes(r))
  if (!s.ok) return s.res

  const certificados = await prisma.certificado.findMany({
    where: { condominioId: s.data.condominioId },
    include: INCLUDE,
    orderBy: { validoAte: { sort: "asc", nulls: "last" } },
  })
  return NextResponse.json({ certificados })
}

export async function POST(req: NextRequest) {
  const s = await exigirSessao(podeGerenciar)
  if (!s.ok) return s.res
  const bloqueio = await exigirModulo(s.data.condominioId, "contratos")
  if (bloqueio) return bloqueio
  const corpo = await lerCorpo(req, schema)
  if (!corpo.ok) return corpo.res
  const d = corpo.data

  // Garante que os vínculos pertencem ao condomínio
  const [eq, pr] = await Promise.all([
    d.equipamentoId ? prisma.equipamento.findFirst({ where: { id: d.equipamentoId, condominioId: s.data.condominioId } }) : null,
    d.prestadorId ? prisma.prestador.findFirst({ where: { id: d.prestadorId, condominioId: s.data.condominioId } }) : null,
  ])

  const certificado = await prisma.certificado.create({
    data: {
      ...d,
      equipamentoId: eq?.id ?? null,
      prestadorId: pr?.id ?? null,
      emitidoEm: dataOuNull(d.emitidoEm),
      validoAte: dataOuNull(d.validoAte),
      condominioId: s.data.condominioId,
    },
    include: INCLUDE,
  })

  await registrarAuditoria(s.data, "CRIAR", "Certificado", certificado.id, `Cadastrou "${certificado.titulo}"`)
  return NextResponse.json(certificado, { status: 201 })
}
