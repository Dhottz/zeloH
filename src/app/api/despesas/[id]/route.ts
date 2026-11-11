import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { exigirSessao, lerCorpo, erro, dataOuNull } from "@/lib/api"
import { podeAprovar, podeGerenciar } from "@/lib/permissions"
import { registrarAuditoria } from "@/lib/auditoria"
import { formatMoeda } from "@/lib/utils"
import { z } from "zod"

type Params = { params: Promise<{ id: string }> }

const schema = z.object({
  acao:           z.enum(["editar", "aprovar", "reprovar", "pagar", "estornar"]),
  descricao:      z.string().min(2).optional(),
  categoria:      z.string().optional(),
  valor:          z.number().positive().optional(),
  competencia:    z.string().optional(),
  vencimento:     z.string().nullable().optional(),
  formaPagamento: z.string().nullable().optional(),
  comprovante:    z.string().nullable().optional(),
  notaFiscal:     z.string().nullable().optional(),
  observacoes:    z.string().nullable().optional(),
})

/**
 * PATCH — editar | aprovar | reprovar | pagar | estornar.
 * Aprovação: síndico, subsíndico ou conselho. Pagamento: gestores.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const s = await exigirSessao()
  if (!s.ok) return s.res
  const corpo = await lerCorpo(req, schema)
  if (!corpo.ok) return corpo.res
  const { id } = await params
  const { acao, ...d } = corpo.data

  const atual = await prisma.despesa.findFirst({ where: { id, condominioId: s.data.condominioId } })
  if (!atual) return erro("Despesa não encontrada", 404)

  const valorTxt = formatMoeda(Number(atual.valor))

  if (acao === "aprovar" || acao === "reprovar") {
    if (!podeAprovar(s.data.role)) return erro("Apenas síndico, subsíndico ou conselho aprovam despesas", 403)
    if (atual.status !== "PENDENTE_APROVACAO") return erro("Esta despesa não está aguardando aprovação")
    const despesa = await prisma.despesa.update({
      where: { id },
      data: {
        status: acao === "aprovar" ? "APROVADA" : "REPROVADA",
        aprovadoPor: s.data.nome,
        aprovadoEm: new Date(),
        ...(d.observacoes !== undefined ? { observacoes: d.observacoes } : {}),
      },
    })
    await registrarAuditoria(s.data, acao === "aprovar" ? "APROVAR" : "REPROVAR", "Despesa", id,
      `${acao === "aprovar" ? "Aprovou" : "Reprovou"} a despesa "${atual.descricao}" (${valorTxt})`)
    return NextResponse.json(despesa)
  }

  if (!podeGerenciar(s.data.role)) return erro("Sem permissão", 403)

  if (acao === "pagar") {
    if (atual.status !== "APROVADA") return erro("Só despesas aprovadas podem ser marcadas como pagas")
    const despesa = await prisma.despesa.update({
      where: { id },
      data: {
        status: "PAGA",
        pagoEm: new Date(),
        formaPagamento: d.formaPagamento ?? atual.formaPagamento,
        comprovante: d.comprovante ?? atual.comprovante,
      },
    })
    await registrarAuditoria(s.data, "EDITAR", "Despesa", id, `Registrou pagamento de "${atual.descricao}" (${valorTxt})`)
    return NextResponse.json(despesa)
  }

  if (acao === "estornar") {
    if (atual.status !== "PAGA") return erro("A despesa não está paga")
    const despesa = await prisma.despesa.update({ where: { id }, data: { status: "APROVADA", pagoEm: null } })
    await registrarAuditoria(s.data, "EDITAR", "Despesa", id, `Desfez o pagamento de "${atual.descricao}"`)
    return NextResponse.json(despesa)
  }

  // editar — mudar o valor de algo já aprovado volta para aprovação
  const mudouValor = d.valor !== undefined && d.valor !== Number(atual.valor)
  const voltaParaAprovacao = mudouValor && atual.status !== "PENDENTE_APROVACAO" && !podeAprovar(s.data.role)
  const despesa = await prisma.despesa.update({
    where: { id },
    data: {
      ...d,
      ...(d.competencia ? { competencia: new Date(d.competencia) } : {}),
      ...(d.vencimento !== undefined ? { vencimento: dataOuNull(d.vencimento) } : {}),
      ...(voltaParaAprovacao ? { status: "PENDENTE_APROVACAO", aprovadoPor: null, aprovadoEm: null } : {}),
    },
  })
  await registrarAuditoria(s.data, "EDITAR", "Despesa", id,
    mudouValor ? `Alterou o valor de "${atual.descricao}": ${valorTxt} → ${formatMoeda(d.valor!)}` : `Editou a despesa "${atual.descricao}"`)
  return NextResponse.json(despesa)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const s = await exigirSessao(podeGerenciar)
  if (!s.ok) return s.res
  const { id } = await params

  const atual = await prisma.despesa.findFirst({ where: { id, condominioId: s.data.condominioId } })
  if (!atual) return erro("Despesa não encontrada", 404)

  await prisma.despesa.delete({ where: { id } })
  await registrarAuditoria(s.data, "EXCLUIR", "Despesa", id, `Excluiu a despesa "${atual.descricao}" (${formatMoeda(Number(atual.valor))})`)
  return NextResponse.json({ ok: true })
}
