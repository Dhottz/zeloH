import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exigirSessao, lerCorpo } from "@/lib/api"
import { podeGerenciar, podeVerFinanceiro } from "@/lib/permissions"
import { registrarAuditoria } from "@/lib/auditoria"
import { z } from "zod"

/**
 * GET /api/financeiro?ano= — orçado × realizado por categoria e mês,
 * custos por equipamento e por fornecedor.
 */
export async function GET(req: NextRequest) {
  const s = await exigirSessao(podeVerFinanceiro)
  if (!s.ok) return s.res
  const ano = parseInt(req.nextUrl.searchParams.get("ano") ?? String(new Date().getFullYear()))
  const cid = s.data.condominioId

  const [orcamentos, despesas] = await Promise.all([
    prisma.orcamento.findMany({ where: { condominioId: cid, ano }, orderBy: { categoria: "asc" } }),
    prisma.despesa.findMany({
      where: {
        condominioId: cid,
        status: { in: ["APROVADA", "PAGA"] },
        competencia: { gte: new Date(ano, 0, 1), lt: new Date(ano + 1, 0, 1) },
      },
      select: {
        valor: true, categoria: true, competencia: true,
        equipamento: { select: { id: true, nome: true } },
        prestador: { select: { id: true, nome: true } },
      },
    }),
  ])

  // Matriz categoria × mês
  const categorias = new Set<string>([...orcamentos.map((o) => o.categoria), ...despesas.map((d) => d.categoria)])
  const linhas = [...categorias].sort().map((categoria) => {
    const orcadoMensal = Number(orcamentos.find((o) => o.categoria === categoria)?.valorMensal ?? 0)
    const realizadoMes = Array.from({ length: 12 }, () => 0)
    for (const d of despesas) {
      if (d.categoria === categoria) realizadoMes[d.competencia.getMonth()] += Number(d.valor)
    }
    const realizado = realizadoMes.reduce((a, b) => a + b, 0)
    return { categoria, orcadoMensal, orcadoAno: orcadoMensal * 12, realizadoMes, realizado }
  })

  const agrupar = (chave: "equipamento" | "prestador") => {
    const mapa = new Map<string, { id: string; nome: string; total: number; quantidade: number }>()
    for (const d of despesas) {
      const ref = d[chave]
      if (!ref) continue
      const item = mapa.get(ref.id) ?? { id: ref.id, nome: ref.nome, total: 0, quantidade: 0 }
      item.total += Number(d.valor)
      item.quantidade++
      mapa.set(ref.id, item)
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total).slice(0, 10)
  }

  const totalMes = Array.from({ length: 12 }, (_, m) => linhas.reduce((t, l) => t + l.realizadoMes[m], 0))
  const orcadoMensalTotal = linhas.reduce((t, l) => t + l.orcadoMensal, 0)

  return NextResponse.json({
    ano,
    linhas,
    totalMes,
    orcadoMensalTotal,
    orcadoAnoTotal: orcadoMensalTotal * 12,
    realizadoAnoTotal: totalMes.reduce((a, b) => a + b, 0),
    porEquipamento: agrupar("equipamento"),
    porPrestador: agrupar("prestador"),
  })
}

const orcamentoSchema = z.object({
  ano: z.number().int().min(2000).max(2100),
  itens: z.array(z.object({ categoria: z.string().min(2), valorMensal: z.number().min(0) })),
})

/** PUT /api/financeiro — define o orçamento mensal por categoria do ano. */
export async function PUT(req: NextRequest) {
  const s = await exigirSessao(podeGerenciar)
  if (!s.ok) return s.res
  const corpo = await lerCorpo(req, orcamentoSchema)
  if (!corpo.ok) return corpo.res
  const { ano, itens } = corpo.data
  const cid = s.data.condominioId

  await prisma.$transaction([
    prisma.orcamento.deleteMany({ where: { condominioId: cid, ano, categoria: { notIn: itens.map((i) => i.categoria) } } }),
    ...itens.map((i) =>
      prisma.orcamento.upsert({
        where: { condominioId_ano_categoria: { condominioId: cid, ano, categoria: i.categoria } },
        create: { condominioId: cid, ano, categoria: i.categoria, valorMensal: i.valorMensal },
        update: { valorMensal: i.valorMensal },
      })
    ),
  ])

  await registrarAuditoria(s.data, "EDITAR", "Orcamento", null, `Atualizou o orçamento de ${ano} (${itens.length} categorias)`)
  return NextResponse.json({ ok: true })
}
