"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { LogOut, Lock, ChevronDown, Building2, Eye, EyeOff, Loader2, CheckCircle2, User } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

// ─── Mini painel de perfil ─────────────────────────────────────────────────

function PerfilPanel({ onClose }: { onClose: () => void }) {
  const { usuario, logout } = useAuth()
  const router = useRouter()

  const [view, setView] = useState<"menu" | "senha">("menu")
  const [senhaAtual, setSenhaAtual]   = useState("")
  const [novaSenha, setNovaSenha]     = useState("")
  const [confirmar, setConfirmar]     = useState("")
  const [mostrar, setMostrar]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [erro, setErro]               = useState("")
  const [sucesso, setSucesso]         = useState(false)

  const identificacao = [
    usuario?.bloco   && `Bloco ${usuario.bloco}`,
    usuario?.unidade && `Apto ${usuario.unidade}`,
  ].filter(Boolean).join(" · ")

  async function handleLogout() {
    onClose()
    await logout()
  }

  async function handleAlterarSenha() {
    if (!senhaAtual || !novaSenha || !confirmar) { setErro("Preencha todos os campos"); return }
    if (novaSenha !== confirmar)  { setErro("As senhas não coincidem"); return }
    if (novaSenha.length < 8)     { setErro("Mínimo 8 caracteres"); return }

    setSaving(true); setErro("")
    try {
      const res  = await fetch("/api/auth/alterar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senhaAtual, novaSenha }),
      })
      const json = await res.json()
      if (!res.ok) { setErro(json.message ?? "Erro ao alterar senha"); return }
      setSucesso(true)
      setTimeout(() => { onClose() }, 1500)
    } catch {
      setErro("Erro de conexão")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Painel */}
      <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-background rounded-2xl border border-border shadow-xl overflow-hidden">

        {view === "menu" ? (
          <>
            {/* Info do usuário */}
            <div className="px-4 py-4 border-b border-border bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <span className="text-primary-foreground text-sm font-bold">
                    {usuario?.nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{usuario?.nome}</p>
                  {identificacao && (
                    <p className="text-xs text-muted-foreground">{identificacao}</p>
                  )}
                  <p className="text-xs text-muted-foreground truncate">{usuario?.email}</p>
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="p-2">
              <Link
                href="/morador/perfil"
                onClick={onClose}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/60 transition-colors text-left"
              >
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Meu perfil</span>
              </Link>

              <button
                onClick={() => setView("senha")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/60 transition-colors text-left mt-0.5"
              >
                <Lock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Alterar senha</span>
              </button>

              <div className="my-1.5 border-t border-border" />

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 transition-colors text-left"
              >
                <LogOut className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-600">Sair</span>
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Header troca de senha */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <button
                onClick={() => { setView("menu"); setErro(""); setSenhaAtual(""); setNovaSenha(""); setConfirmar("") }}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                ← Voltar
              </button>
              <span className="text-sm font-semibold">Alterar senha</span>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {sucesso ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                  <p className="text-sm font-medium">Senha alterada!</p>
                </div>
              ) : (
                <>
                  {[
                    { id: "sa", label: "Senha atual",      value: senhaAtual, setter: setSenhaAtual },
                    { id: "ns", label: "Nova senha",       value: novaSenha,  setter: setNovaSenha },
                    { id: "cs", label: "Confirmar senha",  value: confirmar,  setter: setConfirmar },
                  ].map(({ id, label, value, setter }) => (
                    <div key={id}>
                      <label className="text-xs font-medium text-muted-foreground">{label}</label>
                      <div className="relative mt-1">
                        <input
                          type={mostrar ? "text" : "password"}
                          value={value}
                          onChange={e => setter(e.target.value)}
                          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        {id === "sa" && (
                          <button
                            type="button"
                            onClick={() => setMostrar(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                          >
                            {mostrar ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Indicador de força */}
                  {novaSenha && (
                    <div className="flex gap-1">
                      {[novaSenha.length >= 8, /[A-Z]/.test(novaSenha), /[0-9]/.test(novaSenha)].map((ok, i) => (
                        <div key={i} className={cn("h-1 flex-1 rounded-full", ok ? "bg-primary" : "bg-muted")} />
                      ))}
                    </div>
                  )}

                  {erro && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{erro}</p>}

                  <button
                    onClick={handleAlterarSenha}
                    disabled={saving}
                    className="w-full bg-primary text-primary-foreground rounded-xl py-2 text-sm font-medium flex items-center justify-center gap-2 mt-1"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Salvar nova senha
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ─── Header principal ──────────────────────────────────────────────────────

export function MoradorHeader() {
  const { usuario } = useAuth()
  const [aberto, setAberto] = useState(false)

  const iniciais = usuario?.nome
    .split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() ?? "?"

  const identificacao = [
    usuario?.bloco   && `Bloco ${usuario.bloco}`,
    usuario?.unidade && `Apto ${usuario.unidade}`,
  ].filter(Boolean).join(" · ")

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-[430px] lg:max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        {/* Condomínio — oculto no desktop (fica na sidebar) */}
        <div className="flex items-center gap-2 min-w-0 lg:hidden">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate leading-tight">
              {usuario?.condominio?.nome ?? "..."}
            </p>
            {identificacao && (
              <p className="text-[10px] text-muted-foreground leading-tight truncate">
                {identificacao}
              </p>
            )}
          </div>
        </div>

        {/* Título da página — visível só no desktop onde a sidebar já tem o logo */}
        <div className="hidden lg:block">
          <p className="text-sm font-semibold text-foreground">
            {usuario?.condominio?.nome ?? ""}
          </p>
          {identificacao && (
            <p className="text-xs text-muted-foreground">{identificacao}</p>
          )}
        </div>

        {/* Avatar + dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => setAberto(v => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-2 py-1 transition-colors",
              aberto ? "bg-accent" : "hover:bg-accent/60"
            )}
          >
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-[10px] font-bold">{iniciais}</span>
            </div>
            <span className="text-xs font-medium text-foreground hidden sm:block max-w-[100px] truncate">
              {usuario?.nome.split(" ")[0]}
            </span>
            <ChevronDown className={cn(
              "w-3 h-3 text-muted-foreground transition-transform",
              aberto && "rotate-180"
            )} />
          </button>

          {aberto && <PerfilPanel onClose={() => setAberto(false)} />}
        </div>
      </div>
    </header>
  )
}
