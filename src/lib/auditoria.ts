import { prisma } from "./prisma"
import type { JwtPayload } from "./auth"
import type { Prisma } from "@/generated/prisma/client"

export type AcaoAuditoria =
  | "CRIAR"
  | "EDITAR"
  | "EXCLUIR"
  | "APROVAR"
  | "REPROVAR"
  | "CONCLUIR"
  | "PUBLICAR"
  | "ASSINATURA"

/**
 * Registra uma alteração importante no histórico de auditoria.
 * Fire-and-forget: nunca interrompe a operação principal.
 */
export async function registrarAuditoria(
  session: Pick<JwtPayload, "sub" | "nome" | "condominioId">,
  acao: AcaoAuditoria,
  entidade: string,
  entidadeId: string | null,
  descricao: string,
  dados?: Prisma.InputJsonValue
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        condominioId: session.condominioId,
        usuarioId:    session.sub,
        usuarioNome:  session.nome,
        acao,
        entidade,
        entidadeId,
        descricao,
        dados,
      },
    })
  } catch (err) {
    console.error("[auditoria]", err)
  }
}
