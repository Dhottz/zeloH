import { ImageResponse } from "next/og"

/**
 * Ícone do app ZeloH (terracota + creme), gerado em qualquer tamanho.
 * `maskable` deixa margem de segurança para o recorte circular/arredondado do Android.
 */
export function iconeApp(tamanho: number, opts: { maskable?: boolean; arredondado?: boolean } = {}) {
  const { maskable = false, arredondado = true } = opts
  const escala = maskable ? 0.62 : 0.8 // conteúdo dentro da "zona segura" no maskable
  const lado = Math.round(tamanho * escala)
  const fonte = Math.round(lado * 0.3)

  return new ImageResponse(
    (
      <div
        style={{
          width: tamanho,
          height: tamanho,
          background: maskable ? "#B84A2E" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: maskable ? lado : tamanho,
            height: maskable ? lado : tamanho,
            background: "#B84A2E",
            borderRadius: arredondado && !maskable ? Math.round(tamanho * 0.22) : 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "#FAF0E8", fontSize: fonte * (maskable ? 1 : 1.25), fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>
            ZELO
          </span>
          <span style={{ color: "#FAF0E8", opacity: 0.85, fontSize: fonte * (maskable ? 0.55 : 0.7), fontWeight: 700, lineHeight: 1.2, letterSpacing: 4 }}>
            H
          </span>
        </div>
      </div>
    ),
    { width: tamanho, height: tamanho }
  )
}
