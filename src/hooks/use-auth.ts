"use client"

import { createContext, useContext } from "react"
import type { Modulo, PlanoId, StatusAssinatura } from "@/lib/planos"

export interface Usuario {
  id: string
  nome: string
  email: string
  role: string
  unidade?: string | null
  bloco?: string | null
  primeiroAcesso?: boolean
  prestadorId?: string | null
  notificarEmail?: boolean
  condominio: { id: string; nome: string; cnpj?: string | null; blocos?: string[] }
  condominios?: { id: string; nome: string; role: string }[]
  assinatura?: {
    plano: PlanoId
    status: StatusAssinatura
    trialAte: string | null
    diasTrial: number
    modulos: Modulo[]
  }
}

interface AuthContextValue {
  usuario: Usuario | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  recarregar: () => Promise<void>
  trocarCondominio: (condominioId: string) => Promise<void>
  temModulo: (modulo: Modulo) => boolean
}

export const AuthContext = createContext<AuthContextValue>({
  usuario: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  recarregar: async () => {},
  trocarCondominio: async () => {},
  temModulo: () => true,
})

export function useAuth() {
  return useContext(AuthContext)
}
