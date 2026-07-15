import { ImageResponse } from "next/og";

// Card social gerado on-the-fly (Next/OG). Asset visual — como graphics.tsx,
// usa os hex documentados da marca diretamente, nao tokens de classe.
export const runtime = "edge";
export const alt = "The Loyal — pontos e milhas sem pegadinha, a conta feita em reais";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#FAF7F0";
const INK = "#111111";
const GREEN = "#00A878";
const MUTED = "#555555";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PAPER,
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              background: INK,
              color: PAPER,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: -1,
            }}
          >
            TL
          </div>
          <div style={{ display: "flex", gap: 8, fontSize: 30, color: INK, letterSpacing: 1 }}>
            <span>The</span>
            <span style={{ fontWeight: 800 }}>Loyal</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 72,
              lineHeight: 1.05,
              fontWeight: 800,
              color: INK,
              letterSpacing: -2,
              maxWidth: 980,
            }}
          >
            Pontos e milhas sem pegadinha.
          </div>
          <div style={{ fontSize: 34, color: MUTED, marginTop: 24, maxWidth: 900 }}>
            A gente faz a conta, em reais, e diz se vale a pena. Todo dia útil, às 8h.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 120, height: 8, background: GREEN, borderRadius: 999 }} />
          <div style={{ fontSize: 26, color: INK, fontWeight: 600 }}>
            Newsletter grátis · 5 min de leitura
          </div>
        </div>
      </div>
    ),
    size,
  );
}
