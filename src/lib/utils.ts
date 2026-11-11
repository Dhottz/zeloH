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
