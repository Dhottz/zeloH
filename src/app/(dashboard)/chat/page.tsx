"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Sparkles, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { CategoryBadge } from "@/components/chamados/category-badge"
import { NovaOcorrenciaModal } from "@/components/chamados/nova-ocorrencia-modal"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface Mensagem {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface ChamadoEstruturado {
  titulo: string
  categoria: string
  prioridade: string
  unidade: string
  prestador?: string
}

const sugestoes = [
  "Tem vazamento no banheiro",
  "Reservar o salão de festas",
  "Minhas encomendas",
]

const mensagensIniciais: Mensagem[] = [
  {
    id: "1",
    role: "assistant",
    content: "Olá, Marina! Sou a ZileIA, sua assistente aqui no ZeloH. Posso abrir solicitações, reservar áreas ou tirar dúvidas sobre o condomínio.",
    timestamp: new Date(),
  },
]

export default function ChatPage() {
  const [mensagens, setMensagens] = useState<Mensagem[]>(mensagensIniciais)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [chamadoEstruturado, setChamadoEstruturado] = useState<ChamadoEstruturado | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [mensagens])

  async function enviar(texto?: string) {
    const conteudo = texto ?? input.trim()
    if (!conteudo) return

    const novaMensagem: Mensagem = {
      id: Date.now().toString(),
      role: "user",
      content: conteudo,
      timestamp: new Date(),
    }
    setMensagens((prev) => [...prev, novaMensagem])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensagens: [...mensagens, novaMensagem].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })
      const data = await res.json()

      setMensagens((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.resposta,
          timestamp: new Date(),
        },
      ])

      if (data.chamado) {
        setChamadoEstruturado(data.chamado)
      }
    } catch {
      setMensagens((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Desculpe, tive um problema. Tente novamente em instantes.",
          timestamp: new Date(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Chat */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="mb-4">
          <h1 className="text-2xl font-heading font-bold">ZileIA</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Online · atende pedidos em linguagem natural
          </p>
        </div>

        {/* Messages */}
        <Card className="flex-1 min-h-0 flex flex-col overflow-hidden p-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {mensagens.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                {msg.role === "user" && (
                  <Avatar className="w-7 h-7 shrink-0">
                    <AvatarFallback className="text-[10px] bg-muted font-semibold">MA</AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    msg.role === "assistant"
                      ? "bg-muted text-foreground rounded-tl-sm"
                      : "bg-primary text-primary-foreground rounded-tr-sm"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Sugestões */}
          <div className="px-4 pb-2 flex gap-2 flex-wrap">
            {sugestoes.map((s) => (
              <button
                key={s}
                onClick={() => enviar(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-accent/60 transition-colors text-muted-foreground"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && enviar()}
              placeholder="Pergunte ou descreva um problema..."
              className="flex-1 text-sm"
              disabled={loading}
            />
            <Button
              size="icon"
              onClick={() => enviar()}
              disabled={!input.trim() || loading}
              className="shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Triagem automática */}
      <div className="w-72 shrink-0 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold">Triagem automática</h2>
          <p className="text-xs text-muted-foreground mt-0.5">linguagem natural → chamado estruturado</p>
        </div>

        {chamadoEstruturado ? (
          <Card className="p-4 flex flex-col gap-3 border-primary/20">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                Chamado estruturado
              </span>
            </div>
            <p className="text-sm font-medium text-foreground">{chamadoEstruturado.titulo}</p>
            <div className="flex flex-wrap gap-1.5">
              <CategoryBadge category={chamadoEstruturado.categoria} />
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700">
                {chamadoEstruturado.prioridade}
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">
                {chamadoEstruturado.unidade}
              </span>
              {chamadoEstruturado.prestador && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
                  → {chamadoEstruturado.prestador}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Encaminhado ao síndico para aprovação. Morador notificado no app.
            </p>
            <Button
              size="sm"
              className="w-full text-xs gap-1.5 mt-1"
              onClick={() => setModalAberto(true)}
            >
              Abrir chamado <ArrowRight className="w-3 h-3" />
            </Button>
          </Card>
        ) : (
          <Card className="p-4 flex flex-col items-center justify-center gap-2 text-center min-h-[160px] border-dashed">
            <Sparkles className="w-6 h-6 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              Quando um morador descrever um problema, a ZileIA estrutura automaticamente o chamado aqui.
            </p>
          </Card>
        )}
      </div>

      <NovaOcorrenciaModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        onCriado={() => setModalAberto(false)}
        initialValues={chamadoEstruturado ? {
          titulo: chamadoEstruturado.titulo,
          prioridade: chamadoEstruturado.prioridade,
        } : undefined}
      />
    </div>
  )
}
