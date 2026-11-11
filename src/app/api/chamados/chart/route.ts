import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  const condominioId = session.condominioId
  const inicio = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  const chamados = await prisma.chamado.findMany({
    where: { condominioId, createdAt: { gte: inicio } },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  // Agrupa por dia
  const countPorDia: Record<string, number> = {}
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    countPorDia[key] = 0
  }
  for (const c of chamados) {
    const key = new Date(c.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    if (key in countPorDia) countPorDia[key]++
  }

  const porDia = Object.entries(countPorDia).map(([day, value]) => ({ day, value }))

  return NextResponse.json({ porDia, total: chamados.length })
}
