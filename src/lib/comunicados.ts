import { prisma } from "./prisma"
import { notificarUsuarios } from "./notificacao"
import type { Comunicado } from "@/generated/prisma/client"

type Alvo = Pick<Comunicado, "destinatario" | "blocos" | "unidades">

/** O morador (bloco/unidade) está entre os destinatários do comunicado? */
export function ehDestinatario(c: Alvo, m: { bloco: string | null; unidade: string | null }): boolean {
  if (c.destinatario === "TODOS") return true
  if (c.destinatario === "BLOCOS") return !!m.bloco && c.blocos.includes(m.bloco)
  return !!m.unidade && c.unidades.includes(m.unidade)
}

/** Moradores ativos que devem receber o comunicado. */
export async function destinatariosDe(condominioId: string, c: Alvo) {
  const moradores = await prisma.usuario.findMany({
    where: { condominioId, role: "MORADOR", isActive: true },
    select: { id: true, nome: true, bloco: true, unidade: true },
  })
  return moradores.filter((m) => ehDestinatario(c, m))
}

/** Já está visível para os moradores? (publicado e, se agendado, a data chegou) */
export function estaNoAr(c: Pick<Comunicado, "publicado" | "publicarEm" | "arquivado">): boolean {
  return c.publicado && !c.arquivado && (!c.publicarEm || c.publicarEm.getTime() <= Date.now())
}

/** Dispara o aviso (app + push + e-mail) uma única vez por comunicado. */
export async function notificarComunicado(c: Comunicado): Promise<void> {
  if (c.notificadoEm || !estaNoAr(c)) return

  // Marca antes de enviar para não duplicar em chamadas concorrentes
  const { count } = await prisma.comunicado.updateMany({
    where: { id: c.id, notificadoEm: null },
    data: { notificadoEm: new Date() },
  })
  if (count === 0) return

  const destinatarios = await destinatariosDe(c.condominioId, c)
  const prefixo = c.tipo === "URGENTE" ? "🚨 " : c.tipo === "EVENTO" ? "📅 " : "📢 "
  await notificarUsuarios({
    condominioId: c.condominioId,
    usuarioIds:   destinatarios.map((d) => d.id),
    titulo:       `${prefixo}${c.titulo}`,
    descricao:    c.conteudo.length > 280 ? `${c.conteudo.slice(0, 277)}...` : c.conteudo,
    link:         "/morador/comunicados",
    assunto:      `${c.tipo === "URGENTE" ? "[URGENTE] " : ""}${c.titulo}`,
  })
}
