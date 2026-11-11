/**
 * Perfis e permissões do ZeloH.
 * Arquivo sem dependências de servidor — pode ser importado no client.
 */

export type Role =
  | "SINDICO"
  | "SUBSINDICO"
  | "CONSELHO"
  | "ZELADOR"
  | "PORTEIRO"
  | "PRESTADOR"
  | "MORADOR"
  | "ADMIN"

export const ROLE_LABEL: Record<Role, string> = {
  SINDICO:    "Síndico",
  SUBSINDICO: "Subsíndico",
  CONSELHO:   "Conselho",
  ZELADOR:    "Zelador",
  PORTEIRO:   "Porteiro",
  PRESTADOR:  "Prestador",
  MORADOR:    "Morador",
  ADMIN:      "Administradora",
}

/** Perfis que podem ser atribuídos a um usuário pelo síndico. */
export const ROLES_ATRIBUIVEIS: Role[] = [
  "MORADOR", "ZELADOR", "PORTEIRO", "PRESTADOR", "CONSELHO", "SUBSINDICO", "SINDICO",
]

const GESTORES: Role[] = ["SINDICO", "SUBSINDICO", "ADMIN"]

/** Cria, edita e exclui cadastros do condomínio. */
export function podeGerenciar(role?: string | null): boolean {
  return GESTORES.includes(role as Role)
}

/** Equipe operacional: gestores + zelador (registra manutenções, encomendas…). */
export function podeOperar(role?: string | null): boolean {
  return podeGerenciar(role) || role === "ZELADOR"
}

/** Aprova orçamentos e despesas. */
export function podeAprovar(role?: string | null): boolean {
  return role === "SINDICO" || role === "ADMIN" || role === "CONSELHO" || role === "SUBSINDICO"
}

/** Acesso de leitura ao financeiro e aos relatórios. */
export function podeVerFinanceiro(role?: string | null): boolean {
  return podeGerenciar(role) || role === "CONSELHO"
}

/** Ações exclusivas do síndico/administradora (assinatura, auditoria, configurações). */
export function ehSindico(role?: string | null): boolean {
  return role === "SINDICO" || role === "ADMIN"
}

/** Qualquer perfil que usa o painel (todos menos morador). */
export function ehEquipe(role?: string | null): boolean {
  return !!role && role !== "MORADOR"
}
