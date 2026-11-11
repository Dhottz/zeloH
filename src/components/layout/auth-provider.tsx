"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { AuthContext, type Usuario } from "@/hooks/use-auth"
import type { Modulo } from "@/lib/planos"

function homeDo(role: string) {
  if (role === "MORADOR") return "/morador"
  if (role === "PRESTADOR") return "/manutencoes"
  return "/dashboard"
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

    await fetchMe()
    router.push(homeDo(data.usuario.role))
  }

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setUsuario(null)
    router.push("/login")
  }

  const trocarCondominio = async (condominioId: string) => {
    const res = await fetch("/api/auth/trocar-condominio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ condominioId }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message ?? "Não foi possível trocar de condomínio")
    // Recarrega a página inteira para limpar dados do condomínio anterior
    window.location.href = homeDo(data.role)
  }

  const temModulo = useCallback(
    (modulo: Modulo) => !usuario?.assinatura || usuario.assinatura.modulos.includes(modulo),
    [usuario]
  )

  return (
    <AuthContext.Provider
      value={{ usuario, loading, login, logout, recarregar: fetchMe, trocarCondominio, temModulo }}
    >
      {children}
    </AuthContext.Provider>
  )
}
