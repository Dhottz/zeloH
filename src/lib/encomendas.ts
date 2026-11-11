import type { Encomenda } from "@/generated/prisma/client"

/** Formato consumido pelas telas (mantido compatível com a versão anterior). */
export function serializarEncomenda(e: Encomenda) {
  return {
    id:             e.id,
    destNome:       e.destinatarioNome,
    destinatarioId: e.destinatarioId,
    remetente:      e.remetente ?? "",
    descricao:      e.descricao,
    codigoRastreio: e.codigoRastreio,
    unidade:        e.unidade,
    bloco:          e.bloco,
    foto:           e.foto,
    retirada:       e.status === "RETIRADA",
    retiradaEm:     e.retiradaEm,
    retiradoPor:    e.retiradoPorNome ?? e.retiradoPor,
    createdAt:      e.createdAt,
  }
}
