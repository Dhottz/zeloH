"use client"

import { useEffect, useRef, useState } from "react"
import { Sparkles, Send, Loader2, FileText, User, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Mensagem {
  role: "user" | "assistant"
  content: string
}

// ─── Sugestões rápidas ────────────────────────────────────────────────────────

const SUGESTOES = [
  "Quais contratos estão cadastrados?",
  "Resuma os chamados em aberto",
  "Me ajuda a redigir um comunicado urgente",
  "Quais manutenções estão em andamento?",
  "O que diz o regimento sobre barulho?",
  "Analisa o contrato de limpeza",
]

// ─── Componente de mensagem ───────────────────────────────────────────────────

function MensagemBubble({ msg }: { msg: Mensagem }) {
  const isUser = msg.role === "user"
  return (
    <div className={cn("flex gap-3 items-start", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
        isUser ? "bg-primary" : "bg-primary/10",
      )}>
        {isUser
          ? <User className="w-4 h-4 text-primary-foreground" />
          : <Sparkles className="w-4 h-4 text-primary" />}
      </div>

      {/* Balão */}
      <div className={cn(
        "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
        isUser
          ? "bg-primary text-primary-foreground rounded-tr-sm"
          : "bg-muted text-foreground rounded-tl-sm",
      )}>
        {msg.content}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ZiaSindicoPage() {
  const { usuario } = useAuth()
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [input, setInput]         = useState("")
  const [loading, setLoading]     = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [mensagens, loading])

  async function enviar(texto?: string) {
    const conteudo = (texto ?? input).trim()
    if (!conteudo || loading) return

    const novasMensagens: Mensagem[] = [...mensagens, { role: "user", content: conteudo }]
    setMensagens(novasMensagens)
    setInput("")
    setLoading(true)

    try {
      const res  = await fetch("/api/sindico/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagens: novasMensagens }),
      })
      const json = await res.json()
      setMensagens(prev => [...prev, { role: "assistant", content: json.resposta }])
    } catch {
      setMensagens(prev => [...prev, {
        role: "assistant",
        content: "Tive um problema ao processar sua mensagem. Tente novamente.",
      }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  const nomeAbreviado = usuario?.nome.split(" ")[0] ?? "Síndico"

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-4 lg:-m-6">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading font-semibold text-foreground">Zia</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-xs text-muted-foreground">Assistente de gestão · acesso a documentos e contratos</span>
            </div>
          </div>
        </div>

        {mensagens.length > 0 && (
          <button
            onClick={() => setMensagens([])}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-accent/60"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Nova conversa
          </button>
        )}
      </div>

      {/* ── Área de mensagens ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

        {/* Estado inicial */}
        {mensagens.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-semibold text-foreground">
                Olá, {nomeAbreviado}!
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Sou a Zia, sua assistente de gestão. Tenho acesso ao regimento, contratos,
                comunicados e manutenções do condomínio. Como posso ajudar?
              </p>
            </div>

            {/* Aviso documentos confidenciais */}
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-left w-full">
              <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-relaxed">
                <strong>Acesso exclusivo:</strong> Os documentos e contratos que consulto aqui são confidenciais e não são compartilhados com moradores.
              </p>
            </div>

            {/* Sugestões */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="text-left px-3 py-2.5 rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-primary/5 transition-colors text-sm text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mensagens */}
        {mensagens.map((msg, i) => (
          <MensagemBubble key={i} msg={msg} />
        ))}

        {/* Indicador de digitação */}
        {loading && (
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border bg-background px-6 py-4">
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre contratos, regimento, chamados..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-h-40 overflow-y-auto leading-relaxed"
            style={{ minHeight: "42px" }}
          />
          <Button
            onClick={() => enviar()}
            disabled={!input.trim() || loading}
            size="icon"
            className="rounded-xl h-[42px] w-[42px] shrink-0"
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground text-center mt-2">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  )
}
