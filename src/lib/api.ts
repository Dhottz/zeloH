import { NextResponse } from "next/server"
import { prisma } from "./prisma"
import { getSession, type JwtPayload } from "./auth"
import { temModulo, planoMinimo, PLANOS, type Modulo, type AssinaturaInfo } from "./planos"
import type { ZodType } from "zod"

/** Helpers compartilhados pelas rotas de API. */

export function erro(message: string, status = 400) {
  return NextResponse.json({ message }, { status })
}

type Resultado<T> = { ok: true; data: T } | { ok: false; res: NextResponse }

/** Sessão obrigatória (+ checagem opcional de permissão). */
export async function exigirSessao(
  checagem?: (role: string) => boolean
): Promise<Resultado<JwtPayload>> {
  const session = await getSession()
  if (!session) return { ok: false, res: erro("Não autenticado", 401) }
  if (checagem && !checagem(session.role)) return { ok: false, res: erro("Sem permissão", 403) }
  return { ok: true, data: session }
}

/** Lê e valida o corpo JSON com um schema zod. */
export async function lerCorpo<T>(req: Request, schema: ZodType<T>): Promise<Resultado<T>> {
  let body: unknown
  try { body = await req.json() } catch { return { ok: false, res: erro("Payload inválido") } }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return { ok: false, res: erro(parsed.error.issues[0]?.message ?? "Dados inválidos") }
  return { ok: true, data: parsed.data }
}

export async function assinaturaDo(condominioId: string): Promise<AssinaturaInfo | null> {
  return prisma.condominio.findUnique({
    where: { id: condominioId },
    select: { plano: true, assinaturaStatus: true, trialAte: true },
  })
}

/** Bloqueia a rota quando o módulo não está no plano do condomínio. */
export async function exigirModulo(condominioId: string, modulo: Modulo): Promise<NextResponse | null> {
  const assinatura = await assinaturaDo(condominioId)
  if (!assinatura) return erro("Condomínio não encontrado", 404)
  if (temModulo(assinatura, modulo)) return null
  const plano = PLANOS[planoMinimo(modulo)].nome
  return NextResponse.json(
    { message: `Este recurso faz parte do plano ${plano}. Atualize a assinatura para liberar.`, upgrade: true },
    { status: 402 }
  )
}

/** Converte "" / undefined em null e strings de data em Date. */
export function dataOuNull(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}
