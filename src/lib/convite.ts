import { SignJWT } from "jose"
import { getJwtSecret } from "./jwt-secret"
import { appUrl, enviarEmail, layoutEmail, escapeHtml } from "./email"

/**
 * Convite de primeiro acesso: link assinado (72h) para o usuário definir a senha.
 * O link só chega a quem controla o e-mail — ou é repassado pelo síndico.
 */
export async function gerarLinkConvite(usuarioId: string): Promise<string> {
  const token = await new SignJWT({ sub: usuarioId, tipo: "setup-senha" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("72h")
    .sign(getJwtSecret())
  return appUrl(`/primeiro-acesso?token=${token}`)
}

export async function enviarConvite(
  usuario: { id: string; nome: string; email: string },
  condominioNome: string
): Promise<{ link: string; enviado: boolean }> {
  const link = await gerarLinkConvite(usuario.id)
  const enviado = await enviarEmail({
    para: usuario.email,
    assunto: `Seu acesso ao ${condominioNome} no ZeloH`,
    html: layoutEmail({
      titulo: `Olá, ${usuario.nome.split(" ")[0]}!`,
      corpo: `<p>Você foi cadastrado no condomínio <strong>${escapeHtml(condominioNome)}</strong> no ZeloH.</p>
              <p>Clique no botão abaixo para criar sua senha. O link vale por 72 horas.</p>`,
      botao: { texto: "Criar minha senha", url: link },
    }),
  })
  return { link, enviado }
}
