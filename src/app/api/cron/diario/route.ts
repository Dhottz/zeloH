import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { gerarPreventivas } from "@/lib/preventiva"
import { notificarComunicado } from "@/lib/comunicados"
import { notificarUsuarios, idsGestores } from "@/lib/notificacao"

export const runtime = "nodejs"
export const maxDuration = 60

const DIA = 86_400_000
const AVISAR_EM = [30, 7, 1, 0] // dias antes do vencimento

function diasAte(d: Date) {
  return Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / DIA)
}

/**
 * Rotina diária (Vercel Cron):
 * 1. gera as OS dos planos preventivos que entraram na antecedência
 * 2. dispara o aviso dos comunicados agendados que chegaram na data
 * 3. avisa os gestores sobre contratos, certificados e garantias perto de vencer (30, 7, 1 e 0 dias)
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 })
  }

  const resultado = { preventivas: 0, comunicados: 0, alertas: 0 }

  // 1. Preventivas
  resultado.preventivas = await gerarPreventivas()

  // 2. Comunicados agendados
  const agendados = await prisma.comunicado.findMany({
    where: { publicado: true, arquivado: false, notificadoEm: null, publicarEm: { not: null, lte: new Date() } },
  })
  for (const c of agendados) {
    await notificarComunicado(c)
    resultado.comunicados++
  }

  // 3. Vencimentos
  const hoje = new Date(new Date().setHours(0, 0, 0, 0))
  const limite = new Date(hoje.getTime() + 31 * DIA)
  const [contratos, certificados, garantias] = await Promise.all([
    prisma.contrato.findMany({ where: { ativo: true, fim: { gte: hoje, lte: limite } }, select: { condominioId: true, titulo: true, fim: true, renovacaoAutomatica: true } }),
    prisma.certificado.findMany({ where: { validoAte: { gte: hoje, lte: limite } }, select: { condominioId: true, titulo: true, validoAte: true } }),
    prisma.equipamento.findMany({ where: { ativo: true, garantiaAte: { gte: hoje, lte: limite } }, select: { condominioId: true, id: true, nome: true, garantiaAte: true } }),
  ])

  const alertas: { condominioId: string; titulo: string; descricao: string; link: string }[] = []
  const quando = (n: number) => (n === 0 ? "vence hoje" : `vence em ${n} dia${n > 1 ? "s" : ""}`)

  for (const c of contratos) {
    const n = diasAte(c.fim!)
    if (AVISAR_EM.includes(n)) {
      alertas.push({
        condominioId: c.condominioId,
        titulo: `Contrato ${quando(n)}: ${c.titulo}`,
        descricao: c.renovacaoAutomatica ? "Renovação automática — confira se quer manter." : "Renove ou faça novas cotações.",
        link: "/contratos",
      })
    }
  }
  for (const c of certificados) {
    const n = diasAte(c.validoAte!)
    if (AVISAR_EM.includes(n)) {
      alertas.push({ condominioId: c.condominioId, titulo: `${c.titulo} ${quando(n)}`, descricao: "Providencie a renovação para não ficar irregular.", link: "/contratos?aba=certificados" })
    }
  }
  for (const g of garantias) {
    const n = diasAte(g.garantiaAte!)
    if (n === 30 || n === 7) {
      alertas.push({ condominioId: g.condominioId, titulo: `Garantia ${quando(n)}: ${g.nome}`, descricao: "Se houver defeito, acione o fabricante antes do fim da garantia.", link: `/equipamentos/${g.id}` })
    }
  }

  const gestoresDe = new Map<string, string[]>()
  for (const a of alertas) {
    if (!gestoresDe.has(a.condominioId)) gestoresDe.set(a.condominioId, await idsGestores(a.condominioId))
    await notificarUsuarios({
      condominioId: a.condominioId,
      usuarioIds: gestoresDe.get(a.condominioId)!,
      titulo: a.titulo,
      descricao: a.descricao,
      link: a.link,
    })
    resultado.alertas++
  }

  return NextResponse.json(resultado)
}
