"use client"

import { useState, useEffect, useContext } from "react"
import { useRouter } from "next/navigation"

interface Usuario {
  id: string
  nome: string
  email: string
  role: string
  unidade?: string | null
  bloco?: string | null
  primeiroAcesso?: boolean
  condominio: { id: string; nome: string; cnpj?: string | null }
}

interface AuthContextValue {
  usuario: Usuario | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

import { createContext } from "react"
export const AuthContext = createContext<AuthContextValue>({
  usuario: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}
