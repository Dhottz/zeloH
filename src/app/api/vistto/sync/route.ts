import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

const VISTTO_API_URL = process.env.VISTTO_API_URL
const VISTTO_API_KEY = process.env.VISTTO_API_KEY

interface VisttoServiceOrder {
  id: string
  friendlyCode: string | null
  title: string
  description?: string | null
  status: string
  priority: string
  clientId: string
  companyId: string
  company?: { document?: string | null; name?: string | null }
  technicianName?: string | null
  value?: number | null
  scheduledAt?: string | null
  completedAt?: string | null
  observations?: string | null
  location?: string | null
}

/**
 * POST /api/vistto/sync
 * Puxa todas as ordens de serviço do condomínio no VISTTO e faz upsert em ManutencaoHistorico.
 * Retorna a contagem de registros sincronizados.
 */
export async function POST(_req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  }

  if (!VISTTO_API_URL || !VISTTO_API_KEY) {
    return NextResponse.json(
      { message: "Integração VISTTO não configurada no servidor" },
      { status: 503 }
    )
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.sub },
    include: {
      condominio: {
        select: { id: true, cnpj: true, visttoClientId: true },
      },
    },
  })

  if (!usuario?.condominio) {
    return NextResponse.json({ message: "Condomínio não encontrado" }, { status: 404 })
  }

  const { condominio } = usuario

  if (!condominio.visttoClientId) {
    return NextResponse.json(
      {
        message:
          "Condomínio não vinculado ao VISTTO. Use /api/vistto/vincular primeiro.",
      },
      { status: 400 }
    )
  }

  // Busca OS no VISTTO filtradas pelo clientId
  let ordens: VisttoServiceOrder[]
  try {
    const res = await fetch(
      `${VISTTO_API_URL}/service-orders/by-client/${condominio.visttoClientId}?limit=500`,
      {
        headers: {
          "x-api-key": VISTTO_API_KEY,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(15000),
      }
    )

    if (!res.ok) {
      const body = await res.text()
      console.error("[sync] Erro VISTTO:", res.status, body)
      return NextResponse.json(
        { message: "Erro ao buscar OS no VISTTO." },
        { status: 502 }
      )
    }

    const json = await res.json()
    // VISTTO retorna { data: [...], total, page } ou diretamente um array
    ordens = Array.isArray(json) ? json : (json.data ?? [])
  } catch (err) {
    console.error("[sync] Falha na requisição ao VISTTO:", err)
    return NextResponse.json(
      { message: "Não foi possível conectar ao VISTTO." },
      { status: 503 }
    )
  }

  if (ordens.length === 0) {
    return NextResponse.json({ ok: true, sincronizados: 0 })
  }

  // Upsert em lote
  let sincronizados = 0
  const erros: string[] = []

  if (ordens.length > 0) {
    console.log("[sync] Exemplo de OS recebida:", JSON.stringify(ordens[0], null, 2))
  }

  const normalizarStatus = (s: string | null | undefined): string => {
    if (!s) return "OPEN"
    const v = s.toUpperCase()
    if (v === "OPEN"        || v === "ABERTA"      || v === "ABERTO")      return "OPEN"
    if (v === "IN_PROGRESS" || v === "EM_ANDAMENTO" || v === "IN PROGRESS") return "IN_PROGRESS"
    if (v === "PENDING"     || v === "AGENDADA"    || v === "AGENDADO")    return "PENDING"
    if (v === "COMPLETED"   || v === "CONCLUIDA"   || v === "CONCLUÍDO" || v === "CONCLUIDA") return "COMPLETED"
    if (v === "CANCELLED"   || v === "CANCELADA"   || v === "CANCELADO")   return "CANCELLED"
    return v
  }

  const normalizarPrioridade = (p: string | null | undefined): string | null => {
    if (!p) return null
    const v = p.toUpperCase()
    if (v === "URGENT"  || v === "URGENTE") return "URGENT"
    if (v === "HIGH"    || v === "ALTA")    return "HIGH"
    if (v === "MEDIUM"  || v === "MEDIA" || v === "MÉDIA") return "MEDIUM"
    if (v === "LOW"     || v === "BAIXA")   return "LOW"
    return v
  }

  for (const os of ordens) {
    try {
      await prisma.manutencaoHistorico.upsert({
        where: { visttoOsId: os.id },
        create: {
          condominioId:  condominio.id,
          visttoOsId:    os.id,
          visttoOsCod:   os.friendlyCode ?? null,
          titulo:        os.title,
          descricao:     os.description ?? null,
          status:        normalizarStatus(os.status),
          prioridade:    normalizarPrioridade(os.priority),
          prestadorNome: os.technicianName ?? null,
          prestadorCnpj: os.company?.document ?? null,
          empresaNome:   os.company?.name ?? null,
          observacoes:   os.observations ?? null,
          local:         os.location ?? null,
          valor:         os.value ?? null,
          agendadoEm:    os.scheduledAt ? new Date(os.scheduledAt) : null,
          concluidoEm:   os.completedAt ? new Date(os.completedAt) : null,
          origem:        "VISTTO",
          syncedAt:      new Date(),
        },
        update: {
          titulo:        os.title,
          descricao:     os.description ?? null,
          status:        normalizarStatus(os.status),
          prioridade:    normalizarPrioridade(os.priority),
          prestadorNome: os.technicianName ?? null,
          prestadorCnpj: os.company?.document ?? null,
          empresaNome:   os.company?.name ?? null,
          observacoes:   os.observations ?? null,
          local:         os.location ?? null,
          valor:         os.value ?? null,
          agendadoEm:    os.scheduledAt ? new Date(os.scheduledAt) : null,
          concluidoEm:   os.completedAt ? new Date(os.completedAt) : null,
          syncedAt:      new Date(),
        },
      })
      sincronizados++
    } catch (err) {
      console.error(`[sync] Erro ao sincronizar OS ${os.id}:`, err)
      erros.push(os.id)
    }
  }

  console.log(
    `[sync] Condomínio ${condominio.id}: ${sincronizados}/${ordens.length} OS sincronizadas`
  )

  return NextResponse.json({
    ok: true,
    sincronizados,
    total: ordens.length,
    erros: erros.length > 0 ? erros : undefined,
  })
}

/**
 * GET /api/vistto/sync
 * Retorna a data do último sync e contagem de registros.
 */
export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.sub },
    select: { condominioId: true },
  })

  if (!usuario?.condominioId) {
    return NextResponse.json({ message: "Condomínio não encontrado" }, { status: 404 })
  }

  const [total, ultimo] = await Promise.all([
    prisma.manutencaoHistorico.count({
      where: { condominioId: usuario.condominioId },
    }),
    prisma.manutencaoHistorico.findFirst({
      where: { condominioId: usuario.condominioId },
      orderBy: { syncedAt: "desc" },
      select: { syncedAt: true },
    }),
  ])

  return NextResponse.json({
    total,
    ultimoSyncEm: ultimo?.syncedAt ?? null,
  })
}
