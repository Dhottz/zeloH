import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exigirSessao, lerCorpo, erro } from "@/lib/api"
import { podeAprovar } from "@/lib/permissions"
import { z } from "zod"

type Params = { params: Promise<{ id: string }> }

const schema = z.object({
  nota: z.number().int().min(1).max(5),
  comentario: z.string().max(1000).nullable().optional(),
})

/** POST — avalia a execução do prestador nesta manutenção (uma avaliação por manutenção). */
export async function POST(req: NextRequest, { params }: Params) {
  const s = await exigirSessao(podeAprovar)
  if (!s.ok) return s.res
  const corpo = await lerCorpo(req, schema)
  if (!corpo.ok) return corpo.res
  const { id } = await params

  const m = await prisma.manutencaoHistorico.findFirst({
    where: { id, condominioId: s.data.condominioId },
    select: { id: true, prestadorId: true, status: true },
  })
  if (!m) return erro("Manutenção não encontrada", 404)
  if (!m.prestadorId) return erro("Vincule um prestador cadastrado para avaliar")
  if (m.status !== "COMPLETED") return erro("Avalie depois que o serviço for concluído")

  const existente = await prisma.avaliacaoPrestador.findFirst({ where: { manutencaoId: id } })
  const dados = {
    nota: corpo.data.nota,
    comentario: corpo.data.comentario ?? null,
    autorId: s.data.sub,
    autorNome: s.data.nome,
  }

  const avaliacao = existente
    ? await prisma.avaliacaoPrestador.update({ where: { id: existente.id }, data: dados })
    : await prisma.avaliacaoPrestador.create({
        data: { ...dados, condominioId: s.data.condominioId, prestadorId: m.prestadorId, manutencaoId: id },
      })

  return NextResponse.json(avaliacao, { status: existente ? 200 : 201 })
}
