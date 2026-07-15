/* eslint-disable @next/next/no-img-element */
// Peças reutilizáveis dos cards sociais (next/og). Retornam elementos que o
// satori renderiza. Regras do satori respeitadas: todo container com mais de um
// filho declara display flex.
import { HEX } from "@/lib/social-brand";

// Selo TL + wordmark. `on` = "paper" (card claro) ou "ink" (bloco escuro).
export function Seal({ on = "paper" }: { on?: "paper" | "ink" }) {
  const sealBg = on === "ink" ? HEX.paper : HEX.ink;
  const sealFg = on === "ink" ? HEX.ink : HEX.paper;
  const wordFg = on === "ink" ? HEX.paper : HEX.ink;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 48,
          height: 48,
          background: sealBg,
          color: sealFg,
          borderRadius: 6,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: -1,
        }}
      >
        TL
      </div>
      <div style={{ display: "flex", gap: 7, fontSize: 26, color: wordFg }}>
        <span>The</span>
        <span style={{ fontWeight: 800 }}>Loyal</span>
      </div>
    </div>
  );
}

// Rodapé editorial: destaque verde curto + linha de assinatura.
export function Footer({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div
        style={{ width: 96, height: 7, background: HEX.green600, borderRadius: 999 }}
      />
      <div style={{ fontSize: 24, color: HEX.gray500, fontWeight: 600 }}>{text}</div>
    </div>
  );
}

// Kicker/label CAPS da marca.
export function Kicker({ children }: { children: string }) {
  return (
    <div
      style={{
        fontSize: 22,
        letterSpacing: 3,
        textTransform: "uppercase",
        color: HEX.gray500,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}
