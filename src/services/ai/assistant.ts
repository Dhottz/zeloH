import Anthropic from "@anthropic-ai/sdk"

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/** Modelo da Zia para o painel do síndico (respostas mais elaboradas). */
export const ZIA_MODEL = "claude-sonnet-5-5"

/**
 * Extrai o texto final de uma resposta da API.
 * Nos modelos atuais o raciocínio vem ligado por padrão, então o primeiro bloco
 * pode ser de "thinking" — por isso juntamos apenas os blocos de texto.
 * Retorna null quando o modelo recusou ou não produziu texto.
 */
export function extrairTexto(response: Anthropic.Message): string | null {
  if (response.stop_reason === "refusal") return null
  const texto = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim()
  return texto || null
}

export interface MensagemChat {
  role: "user" | "assistant"
  content: string
}

export async function responderAssistente(
  historico: MensagemChat[],
  condominioNome: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: ZIA_MODEL,
    max_tokens: 4096,
    output_config: { effort: "low" },
    system: `Você é o assistente virtual do condomínio "${condominioNome}".
Sua função é ajudar moradores e o síndico com dúvidas, registrar reclamações e agilizar demandas.
Seja objetivo, cordial e profissional. Responda sempre em português.
Quando um morador reportar um problema, colete: local do problema, descrição detalhada e urgência.
Nunca invente informações sobre o condomínio — se não souber, informe que vai repassar ao síndico.`,
    messages: historico,
  })

  const texto = extrairTexto(response)
  if (!texto) throw new Error("Resposta inesperada da IA")
  return texto
}
