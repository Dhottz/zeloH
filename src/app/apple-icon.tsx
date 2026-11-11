import { iconeApp } from "@/lib/icone-app"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

// O iOS aplica o arredondamento sozinho — ícone quadrado e sem transparência
export default function AppleIcon() {
  return iconeApp(180, { arredondado: false })
}
