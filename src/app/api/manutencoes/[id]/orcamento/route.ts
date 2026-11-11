import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exigirSessao, lerCorpo, erro } from "@/lib/api"
import { podeAprovar, podeOperar } from "@/lib/permissions"
import { registrarAuditoria } from "@/lib/auditoria"
import { notificarUsuarios, idsGestores } from "@/lib/notificacao"
import { formatMoeda } from "@/lib/utils"
import { z } from "zod"

type Params = { params: Promise<{ id: string }> }

const schema = z.discriminatedUnion("acao", [
  z.object({
    acao: z.literal("solicitar"),
    valor: z.number().positive("Informe o valor do orçamento"),
    arquivo: z.string().nullable().optional(),
    obs: z.string().nullable().optional(),
  }),
  z.object({ acao: z.literal("aprovar"), obs: z.string().nullable().optional() }),
  z.object({ acao: z.literal("reprovar"), obs: z.string().nullable().optional() }),
])

/**
 * POST /api/manutencoes/[id]/orcamento
 * - solicitar: equipe/prestador envia valor + arquivo → aguarda aprovação
 * - aprovar/reprovar: síndico, subsíndico ou conselho decide. Ao aprovar, lança a despesa no financeiro.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const s = await exigirSessao()
  if (!s.ok) return s.res
  const session = s.data
  const corpo = await lerCorpo(req, schema)
  if (!corpo.ok) return corpo.res
  const { id } = await params

  const m = await prisma.manutencaoHistorico.findFirst({
    where: { id, condominioId: session.condominioId },
  })
  if (!m) return erro("Manutenção não encontrada", 404)

  const d = corpo.data

  if (d.acao === "solicitar") {
    const ehPrestadorDaOS = session.role === "PRESTADOR" && !!m.prestadorId && session.prestadorId === m.prestadorId
    if (!podeOperar(session.role) && !ehPrestadorDaOS) return erro("Sem permissão", 403)

    await prisma.manutencaoHistorico.update({
      where: { id },
      data: {
        orcamentoStatus: "PENDENTE",
        orcamentoValor: d.valor,
        orcamentoArquivo: d.arquivo ?? null,
        orcamentoObs: d.obs ?? null,
        orcamentoDecididoPor: null,
        orcamentoDecididoEm: null,
      },
    })

    await notificarUsuarios({
      condominioId: session.condominioId,
      usuarioIds:   await idsGestores(session.condominioId, true),
      titulo:       `Orçamento aguardando aprovação`,
      descricao:    `${m.titulo}: ${formatMoeda(d.valor)}${m.prestadorNome ? ` — ${m.prestadorNome}` : ""}`,
      link:         "/manutencoes?filtro=orcamento",
    })
    await registrarAuditoria(session, "EDITAR", "Manutencao", id, `Enviou orçamento de ${formatMoeda(d.valor)} para "${m.titulo}"`)
    return NextResponse.json({ ok: true })
  }

  // Aprovação / reprovação
  if (!podeAprovar(session.role)) return erro("Apenas síndico, subsíndico ou conselho aprovam orçamentos", 403)
  if (m.orcamentoStatus !== "PENDENTE") return erro("Não há orçamento pendente nesta manutenção")

  const aprovado = d.acao === "aprovar"
  await prisma.$transaction(async (tx) => {
    await tx.manutencaoHistorico.update({
      where: { id },
      data: {
        orcamentoStatus: aprovado ? "APROVADO" : "REPROVADO",
        orcamentoDecididoPor: session.nome,
        orcamentoDecididoEm: new Date(),
        orcamentoObs: d.obs ?? m.orcamentoObs,
        ...(aprovado ? { valor: m.orcamentoValor } : {}),
      },
    })
    if (aprovado && m.orcamentoValor) {
      await tx.despesa.create({
        data: {
          condominioId:  session.condominioId,
          descricao:     m.titulo,
          categoria:     m.tipo === "PREVENTIVA" ? "Manutenção preventiva" : "Manutenção corretiva",
          valor:         m.orcamentoValor,
          competencia:   m.agendadoEm ?? new Date(),
          status:        "APROVADA",
          prestadorId:   m.prestadorId,
          equipamentoId: m.equipamentoId,
          manutencaoId:  m.id,
          notaFiscal:    m.orcamentoArquivo,
          criadoPor:     session.nome,
          aprovadoPor:   session.nome,
          aprovadoEm:    new Date(),
        },
      })
    }
  })

  await registrarAuditoria(
    session, aprovado ? "APROVAR" : "REPROVAR", "Manutencao", id,
    `${aprovado ? "Aprovou" : "Reprovou"} orçamento de ${formatMoeda(Number(m.orcamentoValor ?? 0))} — "${m.titulo}"`
  )

  // Avisa quem executa (usuários do prestador)
  if (m.prestadorId) {
    const usuarios = await prisma.usuario.findMany({
      where: { prestadorId: m.prestadorId, isActive: true, condominioId: session.condominioId },
      select: { id: true },
    })
    await notificarUsuarios({
      condominioId: session.condominioId,
      usuarioIds:   usuarios.map((u) => u.id),
      titulo:       `Orçamento ${aprovado ? "aprovado" : "reprovado"}: ${m.titulo}`,
      descricao:    d.obs ?? undefined,
      link:         "/manutencoes",
    })
  }

  return NextResponse.json({ ok: true })
}
