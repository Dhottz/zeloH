import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exigirSessao, exigirModulo } from "@/lib/api"

const PODE_VER = (role: string) => ["SINDICO", "ADMIN", "CONSELHO"].includes(role)

/** GET /api/auditoria?entidade=&busca=&pagina= — histórico de alterações do condomínio. */
export async function GET(req: NextRequest) {
  const s = await exigirSessao(PODE_VER)
  if (!s.ok) return s.res
  const bloqueio = await exigirModulo(s.data.condominioId, "auditoria")
  if (bloqueio) return bloqueio

  const sp = req.nextUrl.searchParams
  const entidade = sp.get("entidade") ?? ""
  const busca    = sp.get("busca") ?? ""
  const pagina   = Math.max(1, parseInt(sp.get("pagina") ?? "1"))
  const limite   = 40

  const where = {
    condominioId: s.data.condominioId,
    ...(entidade ? { entidade } : {}),
    ...(busca ? {
      OR: [
        { descricao:   { contains: busca, mode: "insensitive" as const } },
        { usuarioNome: { contains: busca, mode: "insensitive" as const } },
      ],
    } : {}),
  }

  const [registros, total, entidades] = await Promise.all([
    prisma.auditLog.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (pagina - 1) * limite, take: limite,
      select: { id: true, usuarioNome: true, acao: true, entidade: true, entidadeId: true, descricao: true, createdAt: true },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["entidade"], where: { condominioId: s.data.condominioId }, _count: { _all: true } }),
  ])

  return NextResponse.json({
    registros,
    total,
    totalPaginas: Math.max(1, Math.ceil(total / limite)),
    entidades: entidades.map((e) => ({ entidade: e.entidade, total: e._count._all })),
  })
}
