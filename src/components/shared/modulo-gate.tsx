"use client"

import Link from "next/link"
import { Lock } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { PLANOS, planoMinimo, type Modulo } from "@/lib/planos"
import { ehSindico } from "@/lib/permissions"
import { Button } from "@/components/ui/button"

/** Mostra o conteúdo apenas se o módulo estiver no plano; senão, um convite para fazer upgrade. */
export function ModuloGate({ modulo, children }: { modulo: Modulo; children: React.ReactNode }) {
  const { usuario, loading, temModulo } = useAuth()
  if (loading || !usuario) return null
  if (temModulo(modulo)) return <>{children}</>

  const plano = PLANOS[planoMinimo(modulo)]
  return (
    <div className="max-w-lg mx-auto mt-12 rounded-2xl border border-border bg-card p-8 text-center space-y-4">
      <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
        <Lock className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h2 className="font-heading text-xl font-semibold">Disponível no plano {plano.nome}</h2>
        <p className="text-sm text-muted-foreground mt-2">{plano.descricao}</p>
      </div>
      <ul className="text-sm text-left inline-block space-y-1">
        {plano.destaques.map((d) => <li key={d}>• {d}</li>)}
      </ul>
      <div>
        {ehSindico(usuario.role) ? (
          <Link href="/assinatura"><Button>Ver planos</Button></Link>
        ) : (
          <p className="text-xs text-muted-foreground">Fale com o síndico para liberar este módulo.</p>
        )}
      </div>
    </div>
  )
}
