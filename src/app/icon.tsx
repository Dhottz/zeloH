import { ImageResponse } from "next/og"

export const size = { width: 512, height: 512 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: "#18181b",
          borderRadius: 112,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
        }}
      >
        <span style={{ color: "white", fontSize: 140, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>
          ZE
        </span>
        <span style={{ color: "#a1a1aa", fontSize: 140, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>
          LO
        </span>
      </div>
    ),
    { ...size }
  )
}
