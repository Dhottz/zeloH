/** Categorias de despesa operacional (seguras para o client). */
export const CATEGORIAS_DESPESA = [
  "Manutenção preventiva",
  "Manutenção corretiva",
  "Contratos de serviço",
  "Limpeza e conservação",
  "Portaria e segurança",
  "Água e esgoto",
  "Energia elétrica",
  "Gás",
  "Jardinagem",
  "Material de consumo",
  "Obras e melhorias",
  "Seguros e taxas",
  "Administrativo",
  "Outros",
] as const

export const STATUS_DESPESA: Record<string, { rotulo: string; cor: string }> = {
  PENDENTE_APROVACAO: { rotulo: "Aguardando aprovação", cor: "bg-amber-100 text-amber-800" },
  APROVADA:           { rotulo: "Aprovada",             cor: "bg-blue-50 text-blue-700" },
  REPROVADA:          { rotulo: "Reprovada",            cor: "bg-red-50 text-red-700" },
  PAGA:               { rotulo: "Paga",                 cor: "bg-green-50 text-green-700" },
}

export const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
