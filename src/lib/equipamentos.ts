/** Constantes de equipamentos e certificados (seguras para o client). */

export const CATEGORIAS_EQUIPAMENTO: { valor: string; rotulo: string }[] = [
  { valor: "ELEVADOR",   rotulo: "Elevador" },
  { valor: "BOMBA",      rotulo: "Bomba / recalque" },
  { valor: "PORTAO",     rotulo: "Portão / motor" },
  { valor: "INCENDIO",   rotulo: "Sistema de incêndio" },
  { valor: "ELETRICO",   rotulo: "Elétrico / quadro" },
  { valor: "GERADOR",    rotulo: "Gerador" },
  { valor: "HIDRAULICO", rotulo: "Hidráulico / reservatório" },
  { valor: "PISCINA",    rotulo: "Piscina" },
  { valor: "CFTV",       rotulo: "CFTV / segurança" },
  { valor: "INTERFONE",  rotulo: "Interfone / acesso" },
  { valor: "AR",         rotulo: "Ar-condicionado" },
  { valor: "OUTRO",      rotulo: "Outro" },
]

export function rotuloCategoria(valor: string): string {
  return CATEGORIAS_EQUIPAMENTO.find((c) => c.valor === valor)?.rotulo ?? valor
}

export const TIPOS_CERTIFICADO: { valor: string; rotulo: string }[] = [
  { valor: "AVCB",        rotulo: "AVCB / CLCB (Bombeiros)" },
  { valor: "SPDA",        rotulo: "Laudo SPDA (para-raios)" },
  { valor: "RESERVATORIO", rotulo: "Limpeza de reservatórios" },
  { valor: "ELEVADOR",    rotulo: "Relatório de inspeção do elevador" },
  { valor: "EXTINTORES",  rotulo: "Recarga de extintores" },
  { valor: "DEDETIZACAO", rotulo: "Dedetização / desratização" },
  { valor: "ELETRICO",    rotulo: "Laudo elétrico" },
  { valor: "GAS",         rotulo: "Laudo de estanqueidade de gás" },
  { valor: "SEGURO",      rotulo: "Apólice de seguro" },
  { valor: "OUTRO",       rotulo: "Outro" },
]

export function rotuloCertificado(valor: string): string {
  return TIPOS_CERTIFICADO.find((c) => c.valor === valor)?.rotulo ?? valor
}
