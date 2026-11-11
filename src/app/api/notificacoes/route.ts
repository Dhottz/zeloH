import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { podeGerenciar } from "@/lib/permissions"

export interface NotificacaoItem {
  id: string
  tipo: "CHAMADO" | "RESERVA" | "ENTREGA" | "ZELADOR_ACAO"
  titulo: string
  descricao: string
  href: string
  createdAt: string
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  const { condominioId } = session

  try {
    const isSindico = podeGerenciar(session.role) || session.role === "CONSELHO"

    const trintaDiasAtras = new Date()
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30)

    const [chamados, reservas, entregas, notifZelador] = await Promise.all([
      // Chamados abertos ou em andamento
      prisma.chamado.findMany({
        where: {
          condominioId,
          status: { in: ["ABERTO", "EM_ANDAMENTO", "AGUARDANDO_PRESTADOR"] },
        },
        select: {
          id: true, titulo: true, status: true, prioridade: true, createdAt: true,
          morador: { select: { nome: true, unidade: true, bloco: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),

      // Reservas pendentes de confirmação
      prisma.reserva.findMany({
        where: { condominioId, status: "PENDENTE" },
        select: {
          id: true, data: true, horaInicio: true, horaFim: true, createdAt: true,
          morador: { select: { nome: true } },
          area:    { select: { nome: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      // Encomendas aguardando retirada
      prisma.encomenda.findMany({
        where: { condominioId, status: "AGUARDANDO" },
        select: { id: true, destinatarioNome: true, unidade: true, bloco: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      // Ações do zelador — só para síndico/admin
      isSindico
        ? prisma.notificacao.findMany({
            where: { condominioId, usuarioId: null, criadaEm: { gte: trintaDiasAtras } },
            orderBy: { criadaEm: "desc" },
            take: 20,
          })
        : Promise.resolve([]),
    ])

    const notificacoes: NotificacaoItem[] = []

    // Chamados
    const PRIORIDADE_LABEL: Record<string, string> = {
      BAIXA: "Baixa", MEDIA: "Média", ALTA: "Alta", URGENTE: "Urgente",
    }
    const STATUS_LABEL: Record<string, string> = {
      ABERTO: "Aberto", EM_ANDAMENTO: "Em andamento", AGUARDANDO_PRESTADOR: "Aguard. prestador",
    }
    for (const c of chamados) {
      const loc = [c.morador.bloco && `Bl. ${c.morador.bloco}`, c.morador.unidade && `Apto ${c.morador.unidade}`]
        .filter(Boolean).join(" · ")
      notificacoes.push({
        id:        `chamado-${c.id}`,
        tipo:      "CHAMADO",
        titulo:    c.titulo,
        descricao: `${c.morador.nome}${loc ? ` · ${loc}` : ""} · ${STATUS_LABEL[c.status] ?? c.status} · ${PRIORIDADE_LABEL[c.prioridade] ?? c.prioridade}`,
        href:      "/ocorrencias",
        createdAt: c.createdAt.toISOString(),
      })
    }

    // Reservas
    for (const r of reservas) {
      const data = new Date(r.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
      notificacoes.push({
        id:        `reserva-${r.id}`,
        tipo:      "RESERVA",
        titulo:    `${r.area.nome} — ${r.morador.nome}`,
        descricao: `${data} · ${r.horaInicio}–${r.horaFim} · Aguardando confirmação`,
        href:      "/reservas",
        createdAt: r.createdAt.toISOString(),
      })
    }

    // Encomendas
    for (const e of entregas) {
      const loc = [e.bloco && `Bl. ${e.bloco}`, e.unidade && `Apto ${e.unidade}`].filter(Boolean).join(" · ")
      notificacoes.push({
        id:        `entrega-${e.id}`,
        tipo:      "ENTREGA",
        titulo:    e.destinatarioNome,
        descricao: `${loc ? loc + " · " : ""}Aguardando retirada`,
        href:      "/entregas",
        createdAt: e.createdAt.toISOString(),
      })
    }

    // Ações do zelador
    for (const n of notifZelador) {
      notificacoes.push({
        id:        `zelador-${n.id}`,
        tipo:      "ZELADOR_ACAO",
        titulo:    n.titulo,
        descricao: n.descricao ?? "",
        href:      n.link,
        createdAt: n.criadaEm.toISOString(),
      })
    }

    // Ordena por data desc e limita a 30
    notificacoes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ notificacoes: notificacoes.slice(0, 30) })
  } catch (error) {
    console.error("[GET /api/notificacoes]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}
