import { Resend } from "resend"

/**
 * Envio de e-mail via Resend.
 * Sem RESEND_API_KEY configurada, o envio é ignorado (apenas loga) — o app continua funcionando.
 */

let client: Resend | null = null

function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!client) client = new Resend(process.env.RESEND_API_KEY)
  return client
}

export function emailConfigurado(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM
}

export function appUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001").replace(/\/$/, "")
  return `${base}${path}`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}

/** Layout simples com a identidade do ZeloH. */
export function layoutEmail(opts: { titulo: string; corpo: string; botao?: { texto: string; url: string } }): string {
  const botao = opts.botao
    ? `<p style="margin:24px 0"><a href="${opts.botao.url}" style="background:#B84A2E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(opts.botao.texto)}</a></p>`
    : ""
  return `<!doctype html><html><body style="margin:0;background:#FAF0E8;font-family:Inter,Arial,sans-serif;color:#1C1410">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    <p style="font-size:20px;font-weight:700;margin:0 0 24px">Zelo<span style="color:#B84A2E">H</span></p>
    <div style="background:#fff;border:1px solid #EDE0D4;border-radius:12px;padding:24px">
      <h1 style="font-size:18px;margin:0 0 12px">${escapeHtml(opts.titulo)}</h1>
      <div style="font-size:14px;line-height:1.6;color:#3d322c">${opts.corpo}</div>
      ${botao}
    </div>
    <p style="font-size:12px;color:#7C6E66;margin-top:16px">Você recebeu este e-mail porque está cadastrado em um condomínio que usa o ZeloH.</p>
  </div></body></html>`
}

export async function enviarEmail(opts: { para: string | string[]; assunto: string; html: string }): Promise<boolean> {
  const resend = getClient()
  const from = process.env.EMAIL_FROM
  const destinatarios = (Array.isArray(opts.para) ? opts.para : [opts.para])
    .filter((e) => e && !e.endsWith("@zeloh.internal"))

  if (!resend || !from || destinatarios.length === 0) {
    if (!resend) console.info(`[email] RESEND_API_KEY ausente — e-mail "${opts.assunto}" não enviado.`)
    return false
  }

  try {
    // Envia individualmente para não expor e-mails entre moradores
    await Promise.all(
      destinatarios.map((to) => resend.emails.send({ from, to, subject: opts.assunto, html: opts.html }))
    )
    return true
  } catch (err) {
    console.error("[email]", err)
    return false
  }
}

export { escapeHtml }
