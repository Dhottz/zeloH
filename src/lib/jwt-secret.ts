/**
 * Segredo usado para assinar/verificar os JWTs.
 * Compatível com o runtime do proxy (sem imports de Node).
 *
 * Em produção, a ausência de JWT_SECRET é um erro: um segredo padrão
 * conhecido permitiria forjar sessões de qualquer usuário.
 */
const DEV_FALLBACK = "zeloh-dev-secret-apenas-para-desenvolvimento-local"

let cache: Uint8Array | null = null

export function getJwtSecret(): Uint8Array {
  if (cache) return cache
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET ausente ou curto demais (mínimo 32 caracteres).")
    }
    console.warn("[auth] JWT_SECRET não definido — usando segredo de desenvolvimento.")
    cache = new TextEncoder().encode(DEV_FALLBACK)
    return cache
  }
  cache = new TextEncoder().encode(secret)
  return cache
}
