"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Sparkles, Loader2, Plus, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Mensagem {
  id: string
  role: "user" | "assistant"
  content: string
}

interface ChamadoSugerido {
  titulo: string
  descricao?: string
  prioridade: "BAIXA" | "MEDIA" | "ALTA" | "URGENTE"
}

const PRIOR_LABEL: Record<string, string> = {
  BAIXA: "Baixa", MEDIA: "Média", ALTA: "Alta", URGENTE: "Urgente",
}
const PRIOR_COLOR: Record<string, string> = {
  BAIXA:   "bg-gray-100 text-gray-700",
  MEDIA:   "bg-blue-100 text-blue-700",
  ALTA:    "bg-orange-100 text-orange-700",
  URGENTE: "bg-red-100 text-red-700",
}

const SUGESTOES = [
  "Quais são as regras para uso da piscina?",
  "Tem alguma manutenção programada?",
  "O que diz o regimento sobre animais?",
  "Quais comunicados estão ativos?",
]

// ─── Bubble ───────────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-2.5 items-end">
      <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
        <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ZiaChatPage() {
  const { usuario } = useAuth()
  const primeiroNome = usuario?.nome.split(" ")[0] ?? "Morador"

  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      id: "1",
      role: "assistant",
      content: `Olá, ${primeiroNome}! Sou a Zia 👋\n\nPosso te ajudar com dúvidas sobre o regimento do condomínio, comunicados ativos, manutenções programadas ou abrir um chamado para algum problema. Em que posso ajudar?`,
    },
  ])
  const [input, setInput]               = useState("")
  const [loading, setLoading]           = useState(false)
  const [chamado, setChamado]           = useState<ChamadoSugerido | null>(null)
  const [criandoChamado, setCriandoChamado] = useState(false)
  const [chamadoCriado, setChamadoCriado]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [mensagens, loading])

  const enviar = useCallback(async (texto?: string) => {
    const conteudo = (texto ?? input).trim()
    if (!conteudo || loading) return

    const novaMensagem: Mensagem = {
      id: Date.now().toString(),
      role: "user",
      content: conteudo,
    }

    setMensagens((prev) => [...prev, novaMensagem])
    setInput("")
    setLoading(true)
    setChamado(null)
    setChamadoCriado(false)

    try {
      const historico = [...mensagens, novaMensagem].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res  = await fetch("/api/morador/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagens: historico }),
      })
      const data = await res.json()

      setMensagens((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: data.resposta },
      ])

      if (data.chamado) {
        setChamado(data.chamado)
      }
    } catch {
      setMensagens((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: "Desculpe, tive um problema. Tente novamente." },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [input, loading, mensagens])

  async function abrirChamado() {
    if (!chamado) return
    setCriandoChamado(true)
    try {
      const res = await fetch("/api/chamados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: chamado.titulo,
          descricao: chamado.descricao,
          prioridade: chamado.prioridade,
        }),
      })
      if (res.ok) {
        setChamadoCriado(true)
        setChamado(null)
        setMensagens((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: `✅ Chamado "${chamado.titulo}" aberto com sucesso! O síndico foi notificado e vai acompanhar.`,
          },
        ])
      }
    } catch {
      // silencioso
    } finally {
      setCriandoChamado(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] bg-background">
      {/* Header */}
      <div className="bg-background border-b border-border px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold font-heading">Zia</h1>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[11px] text-muted-foreground">Assistente do condomínio</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {mensagens.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-2.5 items-end",
              msg.role === "user" && "flex-row-reverse"
            )}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mb-0.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                msg.role === "assistant"
                  ? "bg-muted text-foreground rounded-bl-sm"
                  : "bg-primary text-primary-foreground rounded-br-sm"
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && <TypingIndicator />}

        {/* Card de chamado sugerido */}
        {chamado && !chamadoCriado && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="text-xs font-semibold text-amber-800">Chamado identificado</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{chamado.titulo}</p>
            {chamado.descricao && (
              <p className="text-xs text-muted-foreground leading-relaxed">{chamado.descricao}</p>
            )}
            <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit", PRIOR_COLOR[chamado.prioridade])}>
              Prioridade {PRIOR_LABEL[chamado.prioridade]}
            </span>
            <Button
              size="sm"
              onClick={abrirChamado}
              disabled={criandoChamado}
              className="w-full rounded-xl text-xs gap-1.5"
            >
              {criandoChamado
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Abrindo chamado...</>
                : <><Plus className="w-3.5 h-3.5" /> Abrir chamado</>
              }
            </Button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Sugestões (só na primeira mensagem) */}
      {mensagens.length === 1 && (
        <div className="px-4 pb-2 shrink-0">
          <p className="text-[11px] text-muted-foreground mb-2">Perguntas frequentes:</p>
          <div className="flex flex-col gap-1.5">
            {SUGESTOES.map((s) => (
              <button
                key={s}
                onClick={() => enviar(s)}
                className="text-left text-xs px-3 py-2 rounded-xl border border-border bg-muted/50 hover:bg-accent/60 transition-colors text-foreground flex items-center justify-between gap-2"
              >
                <span>{s}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-background shrink-0 pb-safe">
        <div className="flex gap-2 items-end">
          <div className="flex-1 bg-muted rounded-2xl flex items-center px-4 py-2.5 gap-2 min-h-[44px]">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar() } }}
              placeholder="Pergunte à Zia..."
              disabled={loading}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button
            onClick={() => enviar()}
            disabled={!input.trim() || loading}
            className={cn(
              "w-11 h-11 rounded-2xl flex items-center justify-center transition-colors shrink-0",
              input.trim() && !loading
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </button>
        </div>
      </div>
    </div>
  )
}
