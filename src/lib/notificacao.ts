import { prisma } from "./prisma"

interface NotifInput {
  condominioId: string
  titulo: string
  descricao?: string
  link?: string
  autorNome?: string
}

/**
 * Cria uma notificação para o síndico quando o zelador realiza uma ação.
 * Fire-and-forget — erros são logados mas não propagados.
 */
export async function criarNotificacaoZelador(data: NotifInput) {
  try {
    await prisma.notificacao.create({
      data: {
        condominioId: data.condominioId,
        titulo:       data.titulo,
        descricao:    data.descricao,
        link:         data.link ?? "/dashboard",
        autorNome:    data.autorNome,
      },
    })
  } catch (err) {
    console.error("[criarNotificacaoZelador]", err)
  }
}
