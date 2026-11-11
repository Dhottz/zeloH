import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exigirSessao, exigirModulo, lerCorpo, dataOuNull } from "@/lib/api"
import { podeGerenciar } from "@/lib/permissions"
import { registrarAuditoria } from "@/lib/auditoria"
import { STATUS_ABERTOS } from "@/lib/preventiva"
import { z } from "zod"

const schema = z.object({
  nome:         z.string().min(2, "Nome obrigatório"),
  categoria:    z.string().default("OUTRO"),
  marca:        z.string().nullable().optional(),
  modelo:       z.string().nullable().optional(),
  numeroSerie:  z.string().nullable().optional(),
  local:        z.string().nullable().optional(),
  instaladoEm:  z.string().nullable().optional(),
  garantiaAte:  z.string().nullable().optional(),
  vidaUtilAnos: z.number().int().min(0).max(100).nullable().optional(),
  fotos:        z.array(z.string()).default([]),
  anexos:       z.array(z.string()).default([]),
  observacoes:  z.string().nullable().optional(),
})

/** GET /api/equipamentos?busca=&categoria= — lista com próxima manutenção e pendências. */
export async function GET(req: NextRequest) {
  const s = await exigirSessao((r) => r !== "MORADOR")
  if (!s.ok) return s.res

  const sp = req.nextUrl.searchParams
  const busca = sp.get("busca") ?? ""
  const categoria = sp.get("categoria") ?? ""
  const status = sp.get("status") ?? "ativos"
  const hoje = new Date(new Date().setHours(0, 0, 0, 0))

  const equipamentos = await prisma.equipamento.findMany({
    where: {
      condominioId: s.data.condominioId,
      ...(status === "ativos" ? { ativo: true } : status === "inativos" ? { ativo: false } : {}),
      ...(categoria ? { categoria } : {}),
      ...(busca ? {
        OR: [
          { nome:        { contains: busca, mode: "insensitive" } },
          { local:       { contains: busca, mode: "insensitive" } },
          { marca:       { contains: busca, mode: "insensitive" } },
          { numeroSerie: { contains: busca, mode: "insensitive" } },
        ],
      } : {}),
      // Prestador vê só equipamentos ligados aos seus planos/ordens
      ...(s.data.role === "PRESTADOR" ? {
        OR: [
          { planos: { some: { prestadorId: s.data.prestadorId ?? "__nenhum__" } } },
          { manutencoes: { some: { prestadorId: s.data.prestadorId ?? "__nenhum__" } } },
        ],
      } : {}),
    },
    include: {
      planos: { where: { ativo: true }, select: { proximaEm: true }, orderBy: { proximaEm: "asc" }, take: 1 },
      manutencoes: {
        where: { status: { in: STATUS_ABERTOS } },
        select: { id: true, agendadoEm: true },
      },
      _count: { select: { manutencoes: true, chamados: true } },
    },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  })

  return NextResponse.json({
    equipamentos: equipamentos.map(({ planos, manutencoes, ...e }) => ({
      ...e,
      proximaPreventiva: planos[0]?.proximaEm ?? null,
      osAbertas: manutencoes.length,
      osAtrasadas: manutencoes.filter((m) => m.agendadoEm && m.agendadoEm < hoje).length,
    })),
  })
}

export async function POST(req: NextRequest) {
  const s = await exigirSessao(podeGerenciar)
  if (!s.ok) return s.res
  const bloqueio = await exigirModulo(s.data.condominioId, "equipamentos")
  if (bloqueio) return bloqueio
  const corpo = await lerCorpo(req, schema)
  if (!corpo.ok) return corpo.res
  const d = corpo.data

  const equipamento = await prisma.equipamento.create({
    data: {
      ...d,
      instaladoEm: dataOuNull(d.instaladoEm),
      garantiaAte: dataOuNull(d.garantiaAte),
      condominioId: s.data.condominioId,
    },
  })

  await registrarAuditoria(s.data, "CRIAR", "Equipamento", equipamento.id, `Cadastrou o equipamento "${equipamento.nome}"`)
  return NextResponse.json(equipamento, { status: 201 })
}
