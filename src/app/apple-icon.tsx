import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "#18181b",
          borderRadius: 40,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: "white", fontSize: 50, fontWeight: 800, lineHeight: 1 }}>
          ZE
        </span>
        <span style={{ color: "#a1a1aa", fontSize: 50, fontWeight: 800, lineHeight: 1 }}>
          LO
        </span>
      </div>
    ),
    { ...size }
  )
}
