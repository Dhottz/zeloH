import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

interface VisttoWebhookPayload {
  event: "service_order.completed" | "service_order.updated" | "service_order.created"
  data: {
    id: string
    friendlyCode: string | null
    title: string
    description?: string | null
    status: string
    priority: string
    clientId: string
    clientDocument: string | null
    companyId: string
    companyName?: string | null
    companyDocument: string | null
    technicianName: string | null
    value: number | null
    scheduledAt: string | null
    completedAt: string | null
    observations: string | null
    location?: string | null
  }
  timestamp: string
}

export async function POST(req: NextRequest) {
  // Valida segredo do webhook
  const secret  = req.headers.get("x-webhook-secret")
  const expected = process.env.VISTTO_WEBHOOK_SECRET

  if (expected && secret !== expected) {
    return NextResponse.json({ message: "Webhook secret inválido" }, { status: 401 })
  }

  let payload: VisttoWebhookPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ message: "Payload inválido" }, { status: 400 })
  }

  const { event, data } = payload

  try {
    // Encontra o condomínio vinculado ao clientDocument (CNPJ)
    const condominio = data.clientDocument
      ? await prisma.condominio.findFirst({
          where: {
            OR: [
              { cnpj: data.clientDocument },
              { visttoClientId: data.clientId },
            ],
          },
        })
      : null

    if (!condominio) {
      // OS recebida mas sem condomínio vinculado — apenas loga
      console.log(`[Webhook VISTTO] ${event} — OS ${data.friendlyCode} sem condomínio vinculado no ZeloH`)
      return NextResponse.json({ ok: true, vinculado: false })
    }

    // Upsert no histórico de manutenções
    await prisma.manutencaoHistorico.upsert({
      where: { visttoOsId: data.id },
      create: {
        condominioId:  condominio.id,
        visttoOsId:    data.id,
        visttoOsCod:   data.friendlyCode,
        titulo:        data.title,
        descricao:     data.description ?? null,
        status:        data.status,
        prioridade:    data.priority,
        empresaNome:   data.companyName ?? null,
        prestadorNome: data.technicianName,
        prestadorCnpj: data.companyDocument,
        observacoes:   data.observations ?? null,
        local:         data.location ?? null,
        valor:         data.value,
        agendadoEm:    data.scheduledAt ? new Date(data.scheduledAt) : null,
        concluidoEm:   data.completedAt ? new Date(data.completedAt) : null,
        origem:        "VISTTO",
        syncedAt:      new Date(),
      },
      update: {
        titulo:        data.title,
        descricao:     data.description ?? null,
        status:        data.status,
        prioridade:    data.priority,
        empresaNome:   data.companyName ?? null,
        prestadorNome: data.technicianName,
        prestadorCnpj: data.companyDocument,
        observacoes:   data.observations ?? null,
        local:         data.location ?? null,
        valor:         data.value,
        agendadoEm:    data.scheduledAt ? new Date(data.scheduledAt) : null,
        concluidoEm:   data.completedAt ? new Date(data.completedAt) : null,
        syncedAt:      new Date(),
      },
    })

    // Se o chamado no ZeloH estiver vinculado a esta OS, atualiza o status
    if (data.status === "COMPLETED") {
      await prisma.chamado.updateMany({
        where: {
          condominioId: condominio.id,
          visttoOsId:   data.id,
          status:       { not: "CONCLUIDO" },
        },
        data: {
          status:      "CONCLUIDO",
          resolvidoEm: data.completedAt ? new Date(data.completedAt) : new Date(),
        },
      })
    }

    console.log(`[Webhook VISTTO] ${event} — OS ${data.friendlyCode} sincronizada no ZeloH`)
    return NextResponse.json({ ok: true, vinculado: true, condominioId: condominio.id })

  } catch (error) {
    console.error("[Webhook VISTTO] Erro:", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}
