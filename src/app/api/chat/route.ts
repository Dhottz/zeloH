import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Você é a Zia, assistente virtual do condomínio no ZeloH.
Sua função é atender moradores com cordialidade, coletar informações sobre problemas e estruturar chamados.

Quando um morador reportar um problema:
1. Confirme o entendimento de forma breve e empática
2. Se faltar informação (local exato, descrição), pergunte de forma natural
3. Ao ter informação suficiente, informe que vai encaminhar ao síndico

Responda SEMPRE em português, de forma objetiva e amigável.
Nunca invente informações sobre o condomínio.

Se identificar um problema que deve virar chamado, além de responder normalmente, inclua no final da sua resposta um bloco JSON delimitado por <<<CHAMADO>>> e <<<FIM>>> com esta estrutura:
<<<CHAMADO>>>
{"titulo":"...","categoria":"Hidráulica|Elétrica|Infraestrutura|Convivência|Manutenção|Segurança|Administrativa","prioridade":"Baixa|Média|Alta|Urgente","unidade":"...","prestador":"...ou null"}
<<<FIM>>>`

export async function POST(req: NextRequest) {
  try {
    const { mensagens } = await req.json()

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: mensagens,
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
        // ignora parse error, retorna texto completo
      }
    }

    return NextResponse.json({ resposta, chamado })
  } catch (error) {
    console.error("[API/chat]", error)
    return NextResponse.json({ resposta: "Erro interno. Tente novamente." }, { status: 500 })
  }
}
