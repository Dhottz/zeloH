import { prisma } from "./prisma"
import type { UserRole } from "@/generated/prisma/enums"
import { enviarPush } from "./push"
import { enviarEmail, layoutEmail, appUrl, escapeHtml } from "./email"

interface NotifInput {
  condominioId: string
  titulo: string
  descricao?: string
  link?: string
  autorNome?: string
}

/**
 * Cria uma notificação no painel do síndico (ex.: ação do zelador, alerta de vencimento).
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

/** Alias semântico para alertas automáticos do painel. */
export const notificarPainel = criarNotificacaoZelador

interface NotificarUsuariosInput {
  condominioId: string
  usuarioIds: string[]
  titulo: string
  descricao?: string
  link?: string
  /** Também envia e-mail (respeitando a preferência do usuário). Padrão: true */
  email?: boolean
  /** Assunto do e-mail; padrão = título */
  assunto?: string
}

/**
 * Notifica usuários específicos (moradores, equipe) por três canais:
 * sininho no app, push no celular e e-mail. Nunca lança erro.
 */
export async function notificarUsuarios(input: NotificarUsuariosInput): Promise<void> {
  const ids = [...new Set(input.usuarioIds)].filter(Boolean)
  if (ids.length === 0) return

  try {
    await prisma.notificacao.createMany({
      data: ids.map((usuarioId) => ({
        condominioId: input.condominioId,
        usuarioId,
        titulo:    input.titulo,
        descricao: input.descricao,
        link:      input.link ?? "/morador",
      })),
    })
  } catch (err) {
    console.error("[notificarUsuarios:app]", err)
  }

  await Promise.allSettled([
    enviarPush(ids, { titulo: input.titulo, corpo: input.descricao, link: input.link }),
    (async () => {
      if (input.email === false) return
      const usuarios = await prisma.usuario.findMany({
        where: { id: { in: ids }, isActive: true, notificarEmail: true },
        select: { email: true },
      })
      if (usuarios.length === 0) return
      await enviarEmail({
        para: usuarios.map((u) => u.email),
        assunto: input.assunto ?? input.titulo,
        html: layoutEmail({
          titulo: input.titulo,
          corpo: input.descricao ? `<p>${escapeHtml(input.descricao).replace(/\n/g, "<br>")}</p>` : "",
          botao: { texto: "Abrir no ZeloH", url: appUrl(input.link ?? "/morador") },
        }),
      })
    })(),
  ])
}

/** IDs dos moradores ativos de um condomínio, com filtro opcional por blocos/unidades. */
export async function idsMoradores(
  condominioId: string,
  filtro?: { blocos?: string[]; unidades?: string[] }
): Promise<string[]> {
  const usuarios = await prisma.usuario.findMany({
    where: {
      condominioId,
      isActive: true,
      role: "MORADOR",
      ...(filtro?.blocos?.length ? { bloco: { in: filtro.blocos } } : {}),
      ...(filtro?.unidades?.length ? { unidade: { in: filtro.unidades } } : {}),
    },
    select: { id: true },
  })
  return usuarios.map((u) => u.id)
}

/** IDs dos gestores (síndico, subsíndico, administradora, conselho opcional) de um condomínio. */
export async function idsGestores(condominioId: string, incluirConselho = false): Promise<string[]> {
  const roles: UserRole[] = ["SINDICO", "SUBSINDICO", "ADMIN", ...(incluirConselho ? (["CONSELHO"] as const) : [])]
  const [locais, vinculos] = await Promise.all([
    prisma.usuario.findMany({
      where: { condominioId, isActive: true, role: { in: [...roles] } },
      select: { id: true },
    }),
    prisma.usuarioCondominio.findMany({
      where: { condominioId, role: { in: [...roles] } },
      select: { usuarioId: true },
    }),
  ])
  return [...new Set([...locais.map((u) => u.id), ...vinculos.map((v) => v.usuarioId)])]
}
