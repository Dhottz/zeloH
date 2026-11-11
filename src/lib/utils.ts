import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, "")
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
}

export function stripCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, "")
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Faz fetch e garante que a resposta é JSON.
 * Se o servidor retornar HTML (erro 500 em dev), lança um erro legível
 * em vez de "Unexpected token '<'".
 */
export async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, init)
  const ct  = res.headers.get("content-type") ?? ""
  if (!ct.includes("application/json")) {
    throw new Error(`[${res.status}] ${url} retornou ${ct || "resposta vazia"}`)
  }
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.message ?? `Erro ${res.status}`)
  }
  return data as T
}

export function formatMoeda(valor: number | string | null | undefined): string {
  const n = typeof valor === "string" ? Number(valor) : valor ?? 0
  return (isNaN(n as number) ? 0 : (n as number)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

/** Dias entre hoje e a data (negativo = já passou). */
export function diasAte(data: Date | string | null | undefined): number | null {
  if (!data) return null
  const alvo = new Date(data)
  const hoje = new Date()
  alvo.setHours(0, 0, 0, 0)
  hoje.setHours(0, 0, 0, 0)
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000)
}

/** Data ISO → valor de <input type="date"> (yyyy-mm-dd). */
export function paraInputData(data: Date | string | null | undefined): string {
  if (!data) return ""
  const d = new Date(data)
  if (isNaN(d.getTime())) return ""
  return d.toISOString().slice(0, 10)
}

/** Texto amigável de prazo: "vence em 5 dias", "venceu há 2 dias", "vence hoje". */
export function textoPrazo(data: Date | string | null | undefined, verbo = "vence"): string {
  const d = diasAte(data)
  if (d === null) return ""
  if (d === 0) return `${verbo} hoje`
  if (d > 0) return `${verbo} em ${d} dia${d > 1 ? "s" : ""}`
  const passado = verbo === "vence" ? "venceu" : verbo
  return `${passado} há ${-d} dia${d < -1 ? "s" : ""}`
}
