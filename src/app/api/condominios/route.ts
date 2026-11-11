import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exigirSessao, lerCorpo } from "@/lib/api"
import { ehSindico } from "@/lib/permissions"
import { registrarAuditoria } from "@/lib/auditoria"
import { z } from "zod"

/**
 * Carteira de condomínios do usuário (síndico profissional / administradora).
 * GET: lista com indicadores; POST: cadastra um novo condomínio vinculado ao usuário.
 */

export async function GET() {
  const s = await exigirSessao(ehSindico)
  if (!s.ok) return s.res

  const usuario = await prisma.usuario.findUnique({
    where: { id: s.data.sub },
    select: { condominioId: true, role: true, vinculos: { select: { condominioId: true, role: true } } },
  })
  if (!usuario) return NextResponse.json({ condominios: [] })

  const ids = [usuario.condominioId, ...usuario.vinculos.map((v) => v.condominioId)]
  const roleDe = new Map<string, string>([
    [usuario.condominioId, usuario.role],
    ...usuario.vinculos.map((v) => [v.condominioId, v.role] as [string, string]),
  ])

  const agora = new Date()
  const condominios = await prisma.condominio.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: {
      id: true, nome: true, cidade: true, estado: true, plano: true, assinaturaStatus: true, trialAte: true,
      _count: {
        select: {
          usuarios: { where: { role: "MORADOR", isActive: true } },
          chamados: { where: { status: { in: ["ABERTO", "EM_ANDAMENTO", "AGUARDANDO_PRESTADOR"] } } },
          manutencoes: { where: { status: { in: ["OPEN", "PENDING", "IN_PROGRESS"] }, agendadoEm: { lt: agora } } },
        },
      },
    },
    orderBy: { nome: "asc" },
  })

  return NextResponse.json({
    condominioAtivo: s.data.condominioId,
    condominios: condominios.map((c) => ({
      id: c.id, nome: c.nome, cidade: c.cidade, estado: c.estado,
      plano: c.plano, assinaturaStatus: c.assinaturaStatus, trialAte: c.trialAte,
      role: roleDe.get(c.id),
      moradores: c._count.usuarios,
      ocorrenciasAbertas: c._count.chamados,
      manutencoesAtrasadas: c._count.manutencoes,
    })),
  })
}

const createSchema = z.object({
  nome:   z.string().min(2, "Nome obrigatório"),
  cnpj:   z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  estado: z.string().max(2).optional().nullable(),
})

export async function POST(req: NextRequest) {
  const s = await exigirSessao(ehSindico)
  if (!s.ok) return s.res
  const corpo = await lerCorpo(req, createSchema)
  if (!corpo.ok) return corpo.res

  const cnpj = corpo.data.cnpj ? corpo.data.cnpj.replace(/\D/g, "") || null : null
  if (cnpj && (await prisma.condominio.findUnique({ where: { cnpj } }))) {
    return NextResponse.json({ message: "CNPJ já cadastrado" }, { status: 409 })
  }

  const condominio = await prisma.condominio.create({
    data: {
      nome: corpo.data.nome,
      cnpj,
      cidade: corpo.data.cidade ?? null,
      estado: corpo.data.estado ?? null,
      vinculos: { create: { usuarioId: s.data.sub, role: s.data.role === "ADMIN" ? "ADMIN" : "SINDICO" } },
    },
  })

  await registrarAuditoria(
    { ...s.data, condominioId: condominio.id },
    "CRIAR", "Condominio", condominio.id, `Condomínio "${condominio.nome}" cadastrado`
  )

  return NextResponse.json(condominio, { status: 201 })
}
