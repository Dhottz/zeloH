import { NextRequest, NextResponse } from "next/server"
import { anthropic, ZIA_MODEL, extrairTexto } from "@/services/ai/assistant"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { podeGerenciar } from "@/lib/permissions"
import { exigirModulo } from "@/lib/api"
import { itensDeAtencao } from "@/lib/atencao"
import { rotuloCategoria } from "@/lib/equipamentos"


// ─── System prompt do síndico (inclui documentos) ────────────────────────────

async function buildSystemPrompt(condominioId: string, condominioNome: string): Promise<string> {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const [condo, documentos, comunicados, manutencoes, chamados] = await Promise.all([
    prisma.condominio.findUnique({
      where: { id: condominioId },
      select: { regimento: true },
    }),

    // Documentos — só disponíveis para o síndico
    prisma.documento.findMany({
      where: { condominioId, atual: true, tipo: { not: "ENTREGA" } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { nome: true, tipo: true, conteudo: true, createdAt: true },
    }),

    // Comunicados ativos
    prisma.comunicado.findMany({
      where: {
        condominioId,
        publicado: true,
        OR: [{ expiraEm: null }, { expiraEm: { gte: hoje } }],
      },
      orderBy: [{ fixado: "desc" }, { createdAt: "desc" }],
      take: 15,
      select: { titulo: true, conteudo: true, tipo: true, createdAt: true },
    }),

    // Manutenções ativas
    prisma.manutencaoHistorico.findMany({
      where: { condominioId, status: { in: ["OPEN", "IN_PROGRESS", "PENDING"] } },
      orderBy: { agendadoEm: "asc" },
      take: 10,
      select: { titulo: true, status: true, agendadoEm: true, prestadorNome: true, valor: true },
    }),

    // Chamados abertos (resumo)
    prisma.chamado.count({
      where: { condominioId, status: { in: ["ABERTO", "EM_ANDAMENTO", "AGUARDANDO_PRESTADOR"] } },
    }),
  ])

  const inicioAno = new Date(hoje.getFullYear(), 0, 1)
  const [atencao, equipamentos, contratos, despesasAno] = await Promise.all([
    itensDeAtencao(condominioId),
    prisma.equipamento.findMany({
      where: { condominioId, ativo: true },
      select: {
        nome: true, categoria: true, local: true, garantiaAte: true,
        planos: { where: { ativo: true }, select: { titulo: true, proximaEm: true }, take: 2 },
        manutencoes: { where: { status: "COMPLETED" }, orderBy: { concluidoEm: "desc" }, take: 1, select: { titulo: true, concluidoEm: true } },
        _count: { select: { manutencoes: true, chamados: true } },
      },
      take: 60,
    }),
    prisma.contrato.findMany({
      where: { condominioId, ativo: true },
      select: { titulo: true, valor: true, periodicidade: true, fim: true, prestador: { select: { nome: true } } },
    }),
    prisma.despesa.groupBy({
      by: ["categoria"],
      where: { condominioId, status: { in: ["APROVADA", "PAGA"] }, competencia: { gte: inicioAno } },
      _sum: { valor: true },
    }),
  ])

  const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—")
  const brl = (v: unknown) => `R$ ${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`

  const atencaoSection = atencao.length
    ? `\n## PENDÊNCIAS DE HOJE (prioridade)
` + atencao.map((a) => `• [${a.severidade}] ${a.titulo} — ${a.descricao}`).join("\n")
    : "\n## PENDÊNCIAS\nNenhuma pendência no momento.\n"

  const equipamentosSection = equipamentos.length
    ? `\n## EQUIPAMENTOS (${equipamentos.length})
` + equipamentos.map((e) =>
        `• ${e.nome} (${rotuloCategoria(e.categoria)}${e.local ? `, ${e.local}` : ""}) — ${e._count.manutencoes} manutenção(ões), ${e._count.chamados} ocorrência(s); ` +
        `última: ${e.manutencoes[0] ? `${e.manutencoes[0].titulo} em ${fmt(e.manutencoes[0].concluidoEm)}` : "nenhuma"}; ` +
        `preventiva: ${e.planos.map((p) => `${p.titulo} em ${fmt(p.proximaEm)}`).join(", ") || "sem plano"}` +
        (e.garantiaAte ? `; garantia até ${fmt(e.garantiaAte)}` : "")
      ).join("\n")
    : ""

  const contratosSection = contratos.length
    ? `\n## CONTRATOS ATIVOS
` + contratos.map((c) =>
        `• ${c.titulo}${c.prestador ? ` — ${c.prestador.nome}` : ""}${c.valor ? `, ${brl(c.valor)} (${c.periodicidade.toLowerCase()})` : ""}, vigência até ${fmt(c.fim)}`
      ).join("\n")
    : ""

  const financeiroSection = despesasAno.length
    ? `\n## DESPESAS DO ANO (aprovadas/pagas)
` + despesasAno.map((d) => `• ${d.categoria}: ${brl(d._sum.valor)}`).join("\n")
    : ""

  // ── Seções do prompt ──────────────────────────────────────────────────────

  const regimentoSection = condo?.regimento
    ? `\n## REGIMENTO DO CONDOMÍNIO\n${condo.regimento.slice(0, 6000)}${condo.regimento.length > 6000 ? "\n[...truncado]" : ""}\n`
    : "\n## REGIMENTO\nAinda não cadastrado.\n"

  const documentosSection = documentos.length > 0
    ? `\n## DOCUMENTOS E CONTRATOS (${documentos.length})\n` +
      documentos.map((d) => {
        const data = new Date(d.createdAt).toLocaleDateString("pt-BR")
        const conteudoTruncado = d.conteudo
          ? d.conteudo.slice(0, 3000) + (d.conteudo.length > 3000 ? "\n[...truncado]" : "")
          : "(sem texto extraído)"
        return `### ${d.nome} [${d.tipo}] — ${data}\n${conteudoTruncado}`
      }).join("\n\n")
    : "\n## DOCUMENTOS\nNenhum documento cadastrado ainda.\n"

  const comunicadosSection = comunicados.length > 0
    ? `\n## COMUNICADOS ATIVOS\n` +
      comunicados.map((c) => {
        const data = new Date(c.createdAt).toLocaleDateString("pt-BR")
        return `• [${c.tipo}] ${c.titulo} (${data})\n  ${c.conteudo.slice(0, 300)}${c.conteudo.length > 300 ? "..." : ""}`
      }).join("\n\n")
    : "\n## COMUNICADOS\nNenhum comunicado ativo.\n"

  const manutencoesSection = manutencoes.length > 0
    ? `\n## MANUTENÇÕES EM ANDAMENTO\n` +
      manutencoes.map((m) => {
        const data   = m.agendadoEm ? new Date(m.agendadoEm).toLocaleDateString("pt-BR") : "A definir"
        const status = { OPEN: "Aberta", IN_PROGRESS: "Em andamento", PENDING: "Agendada" }[m.status] ?? m.status
        const valor  = m.valor ? ` — R$ ${Number(m.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""
        return `• ${m.titulo} — ${status}, ${data}${m.prestadorNome ? `, por ${m.prestadorNome}` : ""}${valor}`
      }).join("\n")
    : "\n## MANUTENÇÕES\nNenhuma manutenção em andamento.\n"

  const chamadosSection = `\n## CHAMADOS ABERTOS\n${chamados} chamado(s) aguardando atenção.\n`

  return `Você é a Zia, assistente inteligente de gestão condominial do **${condominioNome}** no ZeloH.

Você está conversando com o **síndico** do condomínio. Seu papel é ser um parceiro estratégico:
- Responder perguntas sobre o **regimento** e os **documentos/contratos** cadastrados
- Ajudar a interpretar cláusulas contratuais e regulamentares
- Dar visibilidade sobre **pendências**, **manutenções**, **equipamentos**, **contratos**, **despesas**, **comunicados** e **chamados**
- Quando perguntarem "o que fazer hoje", priorize as PENDÊNCIAS (crítico → alerta → info)
- Apoiar na redação de comunicados e respostas a moradores
- Sugerir boas práticas de gestão condominial

**Regras:**
- Responda SEMPRE em português, com linguagem profissional mas acessível
- Baseie-se APENAS no contexto fornecido — não invente cláusulas ou valores que não estão nos documentos
- Se uma informação não estiver disponível no contexto, diga claramente
- Para dúvidas jurídicas complexas, recomende consulta a um advogado especialista
- Os documentos abaixo são CONFIDENCIAIS e não devem ser compartilhados com moradores
${atencaoSection}${regimentoSection}${documentosSection}${comunicadosSection}${manutencoesSection}${chamadosSection}${equipamentosSection}${contratosSection}${financeiroSection}`
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: "Não autenticado" }, { status: 401 })

  // Só gestores (o contexto inclui documentos confidenciais e finanças)
  if (!podeGerenciar(session.role)) {
    return NextResponse.json({ message: "Acesso negado" }, { status: 403 })
  }
  const bloqueio = await exigirModulo(session.condominioId, "zia")
  if (bloqueio) return bloqueio

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ message: "Payload inválido" }, { status: 400 })
  }

  const { mensagens } = body as { mensagens: Array<{ role: string; content: string }> }

  if (!Array.isArray(mensagens) || mensagens.length === 0) {
    return NextResponse.json({ message: "Mensagens inválidas" }, { status: 400 })
  }

  try {
    const condo = await prisma.condominio.findUnique({
      where: { id: session.condominioId },
      select: { nome: true },
    })

    const systemPrompt = await buildSystemPrompt(session.condominioId, condo?.nome ?? "Condomínio")

    const response = await anthropic.messages.create({
      model: ZIA_MODEL,   // Sonnet para síndico — respostas mais elaboradas
      max_tokens: 8000,
      output_config: { effort: "medium" },
      system: systemPrompt,
      messages: mensagens as Array<{ role: "user" | "assistant"; content: string }>,
    })

    const texto = extrairTexto(response)
    if (!texto) {
      return NextResponse.json({ resposta: "Não consegui processar. Tente novamente." })
    }

    return NextResponse.json({ resposta: texto })
  } catch (error) {
    console.error("[POST /api/sindico/chat]", error)
    return NextResponse.json({ resposta: "Erro interno. Tente novamente." }, { status: 500 })
  }
}
