"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { AuthContext } from "@/hooks/use-auth"

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me")
      if (res.ok) {
        const data = await res.json()
        setUsuario(data.usuario)
      } else {
        setUsuario(null)
      }
    } catch {
      setUsuario(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.message ?? "Erro ao fazer login")
    }

    // Primeiro acesso: redireciona para definir senha
    if (data.primeiroAcesso) {
      router.push(`/primeiro-acesso?token=${data.setupToken}`)
      return
    }

    setUsuario(data.usuario)
    // Moradores têm interface mobile própria
    router.push(data.usuario.role === "MORADOR" ? "/morador" : "/dashboard")
  }

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setUsuario(null)
    router.push("/login")
  }

  return (
    <AuthContext.Provider value={{ usuario, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
