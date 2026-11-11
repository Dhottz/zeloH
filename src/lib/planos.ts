/**
 * Planos de assinatura e módulos liberados.
 * Sem dependências de servidor — pode ser importado no client.
 */

export type PlanoId = "ESSENCIAL" | "GESTAO" | "COMPLETO"
export type StatusAssinatura = "TRIAL" | "ATIVA" | "INADIMPLENTE" | "CANCELADA"

export type Modulo =
  | "ocorrencias"
  | "comunicados"
  | "enquetes"
  | "encomendas"
  | "reservas"
  | "moradores"
  | "manutencoes"
  | "equipamentos"
  | "prestadores"
  | "contratos"
  | "documentos"
  | "financeiro"
  | "zia"
  | "auditoria"

const ESSENCIAL: Modulo[] = ["ocorrencias", "comunicados", "enquetes", "encomendas", "reservas", "moradores"]
const GESTAO: Modulo[]    = [...ESSENCIAL, "manutencoes", "equipamentos", "prestadores", "contratos", "documentos"]
const COMPLETO: Modulo[]  = [...GESTAO, "financeiro", "zia", "auditoria"]

export const PLANOS: Record<PlanoId, { nome: string; descricao: string; modulos: Modulo[]; destaques: string[] }> = {
  ESSENCIAL: {
    nome: "Essencial",
    descricao: "Comunicação, encomendas e ocorrências organizadas.",
    modulos: ESSENCIAL,
    destaques: ["Ocorrências com fotos", "Comunicados e enquetes", "Encomendas com aviso ao morador", "Reservas de áreas comuns"],
  },
  GESTAO: {
    nome: "Gestão",
    descricao: "Controle de manutenção, equipamentos, contratos e fornecedores.",
    modulos: GESTAO,
    destaques: ["Tudo do Essencial", "Manutenção preventiva com checklist", "Equipamentos com QR Code", "Contratos, certificados e documentos"],
  },
  COMPLETO: {
    nome: "Completo",
    descricao: "Gestão operacional, financeira e inteligência artificial.",
    modulos: COMPLETO,
    destaques: ["Tudo do Gestão", "Financeiro: orçado × realizado", "Zia, assistente com IA", "Auditoria de alterações"],
  },
}

export const DIAS_TRIAL = 14

export interface AssinaturaInfo {
  plano: PlanoId
  assinaturaStatus: StatusAssinatura
  trialAte: Date | string | null
}

/** Trial vigente → tudo liberado. Assinatura ativa/inadimplente → módulos do plano. Expirada → Essencial. */
export function modulosLiberados(c: AssinaturaInfo): Modulo[] {
  if (c.assinaturaStatus === "TRIAL") {
    const fim = c.trialAte ? new Date(c.trialAte).getTime() : 0
    return fim > Date.now() ? COMPLETO : ESSENCIAL
  }
  if (c.assinaturaStatus === "CANCELADA") return ESSENCIAL
  return PLANOS[c.plano]?.modulos ?? ESSENCIAL
}

export function temModulo(c: AssinaturaInfo, modulo: Modulo): boolean {
  return modulosLiberados(c).includes(modulo)
}

/** Dias restantes de teste (0 quando expirado ou fora de trial). */
export function diasRestantesTrial(c: AssinaturaInfo): number {
  if (c.assinaturaStatus !== "TRIAL" || !c.trialAte) return 0
  const ms = new Date(c.trialAte).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

/** Plano mínimo que libera um módulo (para a mensagem de upgrade). */
export function planoMinimo(modulo: Modulo): PlanoId {
  if (ESSENCIAL.includes(modulo)) return "ESSENCIAL"
  if (GESTAO.includes(modulo)) return "GESTAO"
  return "COMPLETO"
}
