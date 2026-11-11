import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Monta o system prompt com contexto dinâmico ─────────────────────────────

async function buildSystemPrompt(condominioId: string, condominioNome: string): Promise<string> {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const [condo, comunicados, manutencoes] = await Promise.all([
    // Regimento
    prisma.condominio.findUnique({
      where: { id: condominioId },
      select: { regimento: true },
    }),

    // Comunicados publicados e não expirados
    prisma.comunicado.findMany({
      where: {
        condominioId,
        publicado: true,
        OR: [
          { expiraEm: null },
          { expiraEm: { gte: hoje } },
        ],
      },
      orderBy: [{ fixado: "desc" }, { createdAt: "desc" }],
      take: 20,
      select: { titulo: true, conteudo: true, tipo: true, fixado: true, createdAt: true },
    }),

    // Manutenções visíveis para moradores (síndico seleciona quais compartilhar)
    prisma.manutencaoHistorico.findMany({
      where: {
        condominioId,
        status: { in: ["OPEN", "IN_PROGRESS", "PENDING"] },
        visivelParaMoradores: true,
      },
      orderBy: { agendadoEm: "asc" },
      take: 10,
      select: { titulo: true, status: true, agendadoEm: true, prestadorNome: true },
    }),
  ])

  const regimentoSection = condo?.regimento
    ? `\n## REGIMENTO DO CONDOMÍNIO\n${condo.regimento.slice(0, 8000)}${condo.regimento.length > 8000 ? "\n[...texto truncado]" : ""}\n`
    : "\n## REGIMENTO\nO regimento ainda não foi cadastrado pelo síndico.\n"

  const comunicadosSection = comunicados.length > 0
    ? `\n## COMUNICADOS ATIVOS (${comunicados.length})\n` + comunicados.map((c) => {
        const data = new Date(c.createdAt).toLocaleDateString("pt-BR")
        const prefixo = c.fixado ? "📌 " : "• "
        return `${prefixo}[${c.tipo}] ${c.titulo} (${data})\n  ${c.conteudo.slice(0, 200)}${c.conteudo.length > 200 ? "..." : ""}`
      }).join("\n\n")
    : "\n## COMUNICADOS\nNenhum comunicado ativo no momento.\n"

  const manutencoesSection = manutencoes.length > 0
    ? `\n## MANUTENÇÕES PROGRAMADAS\n` + manutencoes.map((m) => {
        const data = m.agendadoEm ? new Date(m.agendadoEm).toLocaleDateString("pt-BR") : "Data a definir"
        const status = { OPEN: "Aberta", IN_PROGRESS: "Em andamento", PENDING: "Agendada" }[m.status] ?? m.status
        return `• ${m.titulo} — ${status}, ${data}${m.prestadorNome ? `, por ${m.prestadorNome}` : ""}`
      }).join("\n")
    : "\n## MANUTENÇÕES\nNenhuma manutenção programada no momento.\n"

  return `Você é a Zia, assistente virtual inteligente do condomínio **${condominioNome}** no ZeloH.

Seu papel é ajudar os moradores com:
- Dúvidas sobre o **regimento** do condomínio
- Informações sobre **comunicados** e avisos ativos
- Status de **manutenções** programadas
- Abertura de **chamados** para problemas no condomínio

**Regras:**
- Responda SEMPRE em português, com linguagem amigável e objetiva
- Baseie suas respostas NO CONTEXTO fornecido abaixo
- Se não souber ou a informação não estiver no contexto, diga honestamente que não tem essa informação
- Nunca invente regras ou informações que não estão no regimento fornecido
- Se o morador relatar um problema físico (vazamento, elétrica, etc), ajude a estruturar um chamado

Quando identificar um problema que deve virar chamado, inclua no final da resposta um bloco delimitado por <<<CHAMADO>>> e <<<FIM>>>:
<<<CHAMADO>>>
{"titulo":"...","descricao":"...","prioridade":"BAIXA|MEDIA|ALTA|URGENTE"}
<<<FIM>>>
${regimentoSection}${comunicadosSection}${manutencoesSection}`
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ message: "Payload inválido" }, { status: 400 })
  }

  const { mensagens } = body as { mensagens: Array<{ role: string; content: string }> }

  if (!Array.isArray(mensagens) || mensagens.length === 0) {
    return NextResponse.json({ message: "Mensagens inválidas" }, { status: 400 })
  }

  try {
    // Busca nome do condomínio para o prompt
    const condo = await prisma.condominio.findUnique({
      where: { id: session.condominioId },
      select: { nome: true },
    })

    const systemPrompt = await buildSystemPrompt(
      session.condominioId,
      condo?.nome ?? "Condomínio"
    )

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",  // Haiku para respostas rápidas no mobile
      max_tokens: 600,
      system: systemPrompt,
      messages: mensagens as Array<{ role: "user" | "assistant"; content: string }>,
    })

    const bloco = response.content[0]
    if (bloco.type !== "text") {
      return NextResponse.json({ resposta: "Não entendi. Pode repetir?" })
    }

    const texto = bloco.text

    // Extrai chamado estruturado se presente
    const match = texto.match(/<<<CHAMADO>>>([\s\S]*?)<<<FIM>>>/)
    let chamado = null
    let resposta = texto

    if (match) {
      try {
        chamado = JSON.parse(match[1].trim())
        resposta = texto.replace(/<<<CHAMADO>>>[\s\S]*?<<<FIM>>>/, "").trim()
      } catch {
        // ignora erro de parse
      }
    }

    return NextResponse.json({ resposta, chamado })
  } catch (error) {
    console.error("[POST /api/morador/chat]", error)
    return NextResponse.json({ resposta: "Tive um problema. Tente novamente em instantes." }, { status: 500 })
  }
}
