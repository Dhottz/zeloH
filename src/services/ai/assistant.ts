import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface MensagemChat {
  role: "user" | "assistant"
  content: string
}

export async function responderAssistente(
  historico: MensagemChat[],
  condominioNome: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: `Você é o assistente virtual do condomínio "${condominioNome}".
Sua função é ajudar moradores e o síndico com dúvidas, registrar reclamações e agilizar demandas.
Seja objetivo, cordial e profissional. Responda sempre em português.
Quando um morador reportar um problema, colete: local do problema, descrição detalhada e urgência.
Nunca invente informações sobre o condomínio — se não souber, informe que vai repassar ao síndico.`,
    messages: historico,
  })

  const bloco = response.content[0]
  if (bloco.type !== "text") throw new Error("Resposta inesperada da IA")
  return bloco.text
}
