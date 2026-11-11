import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession, type JwtPayload } from "@/lib/auth"
import { podeGerenciar } from "@/lib/permissions"
import { registrarAuditoria } from "@/lib/auditoria"
import { notificarPainel } from "@/lib/notificacao"
import { MANUTENCAO_INCLUDE } from "@/lib/preventiva"
import { z } from "zod"

type Params = { params: Promise<{ id: string }> }

const updateSchema = z.object({
  titulo:        z.string().trim().min(1).optional(),
  descricao:     z.string().nullable().optional(),
  status:        z.enum(["OPEN", "IN_PROGRESS", "PENDING", "COMPLETED", "CANCELLED"]).optional(),
  prioridade:    z.enum(["URGENT", "HIGH", "MEDIUM", "LOW"]).optional(),
  tipo:          z.enum(["PREVENTIVA", "CORRETIVA"]).optional(),
  empresaNome:   z.string().nullable().optional(),
  prestadorNome: z.string().nullable().optional(),
  prestadorCnpj: z.string().nullable().optional(),
  prestadorId:   z.string().uuid().nullable().optional(),
  equipamentoId: z.string().uuid().nullable().optional(),
  local:         z.string().nullable().optional(),
  observacoes:   z.string().nullable().optional(),
  valor:         z.number().nullable().optional(),
  agendadoEm:    z.string().nullable().optional(),
  visivelParaMoradores: z.boolean().optional(),
  checklist:     z.array(z.object({ item: z.string(), feito: z.boolean() })).optional(),
  fotos:         z.array(z.string()).optional(),
  anexos:        z.array(z.string()).optional(),
})

// Campos que a equipe de execução (zelador / prestador) pode atualizar
const CAMPOS_EXECUCAO = new Set(["status", "checklist", "fotos", "anexos", "observacoes"])

function podeEditar(session: JwtPayload, prestadorId: string | null) {
  if (podeGerenciar(session.role)) return "total" as const
  if (session.role === "ZELADOR") return "execucao" as const
  if (session.role === "PRESTADOR" && prestadorId && session.prestadorId === prestadorId) return "execucao" as const
  return null
}

async function carregar(id: string, session: JwtPayload) {
  return prisma.manutencaoHistorico.findFirst({
    where: {
      id,
      condominioId: session.condominioId,
      ...(session.role === "PRESTADOR" ? { prestadorId: session.prestadorId ?? "__nenhum__" } : {}),
    },
    include: MANUTENCAO_INCLUDE,
  })
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  if (session.role === "MORADOR") return NextResponse.json({ message: "Sem permissão" }, { status: 403 })
  const { id } = await params
  const m = await carregar(id, session)
  if (!m) return NextResponse.json({ message: "Manutenção não encontrada" }, { status: 404 })
  return NextResponse.json(m)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  const { id } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ message: "Payload inválido" }, { status: 400 })
  }
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
  }

  try {
    const existe = await carregar(id, session)
    if (!existe) return NextResponse.json({ message: "Manutenção não encontrada" }, { status: 404 })

    const nivel = podeEditar(session, existe.prestadorId)
    if (!nivel) return NextResponse.json({ message: "Sem permissão" }, { status: 403 })

    const d = parsed.data
    if (nivel === "execucao" && Object.keys(d).some((k) => !CAMPOS_EXECUCAO.has(k))) {
      return NextResponse.json({ message: "Você só pode atualizar status, checklist, fotos e observações" }, { status: 403 })
    }

    const data: Record<string, unknown> = { ...d }
    if (d.agendadoEm !== undefined) data.agendadoEm = d.agendadoEm ? new Date(d.agendadoEm) : null

    if (d.prestadorId !== undefined) {
      if (d.prestadorId) {
        const p = await prisma.prestador.findFirst({ where: { id: d.prestadorId, condominioId: session.condominioId } })
        if (!p) return NextResponse.json({ message: "Prestador não encontrado" }, { status: 404 })
        data.prestadorNome = d.prestadorNome ?? p.nome
        data.empresaNome   = d.empresaNome ?? p.nome
        data.prestadorCnpj = d.prestadorCnpj ?? p.cnpj
      }
    }
    if (d.equipamentoId) {
      const e = await prisma.equipamento.findFirst({ where: { id: d.equipamentoId, condominioId: session.condominioId } })
      if (!e) return NextResponse.json({ message: "Equipamento não encontrado" }, { status: 404 })
    }

    const concluindo = d.status === "COMPLETED" && existe.status !== "COMPLETED"
    if (concluindo) data.concluidoEm = new Date()
    if (d.status && d.status !== "COMPLETED" && existe.status === "COMPLETED") data.concluidoEm = null

    if (Object.keys(data).length === 0)
      return NextResponse.json({ message: "Nenhum campo válido para atualizar" }, { status: 400 })

    const atualizado = await prisma.manutencaoHistorico.update({
      where: { id },
      data,
      include: MANUTENCAO_INCLUDE,
    })

    if (concluindo) {
      await registrarAuditoria(session, "CONCLUIR", "Manutencao", id, `Concluiu a manutenção "${existe.titulo}"`)
      if (!podeGerenciar(session.role)) {
        await notificarPainel({
          condominioId: session.condominioId,
          titulo:       `Manutenção concluída: ${existe.titulo}`,
          descricao:    `${session.nome} finalizou o serviço${(d.fotos ?? existe.fotos).length ? " com fotos" : ""}.`,
          link:         "/manutencoes",
          autorNome:    session.nome,
        })
      }
    } else if (nivel === "total" && !(Object.keys(d).length === 1 && "visivelParaMoradores" in d)) {
      await registrarAuditoria(session, "EDITAR", "Manutencao", id, `Editou a manutenção "${existe.titulo}"`, { campos: Object.keys(d) })
    }

    return NextResponse.json(atualizado)
  } catch (error) {
    console.error("[PATCH /api/manutencoes/[id]]", error)
    return NextResponse.json({ message: "Erro interno" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })
  if (!podeGerenciar(session.role)) return NextResponse.json({ message: "Sem permissão" }, { status: 403 })

  const { id } = await params
  const existe = await prisma.manutencaoHistorico.findFirst({ where: { id, condominioId: session.condominioId } })
  if (!existe) return NextResponse.json({ message: "Manutenção não encontrada" }, { status: 404 })
  if (existe.visttoOsId) {
    return NextResponse.json({ message: "OS sincronizada do VISTTO não pode ser excluída aqui" }, { status: 400 })
  }

  await prisma.manutencaoHistorico.delete({ where: { id } })
  await registrarAuditoria(session, "EXCLUIR", "Manutencao", id, `Excluiu a manutenção "${existe.titulo}"`)
  return NextResponse.json({ ok: true })
}
