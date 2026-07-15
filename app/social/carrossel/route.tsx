import { ImageResponse } from "next/og";
import { HEX, VERDICT, isVerdict, SIZES } from "@/lib/social-brand";
import { Seal, Kicker } from "@/lib/social-parts";

// Painel de carrossel (LinkedIn, sempre portrait 1080x1350).
// /social/carrossel?i=1&n=6&kind=capa|texto|veredito|cta&kicker=...&title=...&body=...
//   kind=veredito aceita &score=88&verdict=vale-agir
export const runtime = "edge";

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const size = SIZES.portrait;
  const i = Math.max(1, Number(searchParams.get("i")) || 1);
  const n = Math.max(i, Number(searchParams.get("n")) || 6);
  const kind = searchParams.get("kind") || "texto";
  const kicker = searchParams.get("kicker")?.slice(0, 40) || "Método à mostra";
  const title = searchParams.get("title")?.slice(0, 160) || "";
  const body = searchParams.get("body")?.slice(0, 320) || "";

  const indicator = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Seal on="paper" />
      <div style={{ display: "flex", fontFamily: "monospace", fontSize: 26, color: HEX.gray400 }}>
        {i}/{n}
      </div>
    </div>
  );

  let core;
  if (kind === "capa") {
    core = (
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <Kicker>{kicker}</Kicker>
        <div
          style={{
            display: "flex",
            fontSize: 84,
            fontWeight: 700,
            color: HEX.ink,
            letterSpacing: -2,
            lineHeight: 1.05,
            maxWidth: size.width - 144,
          }}
        >
          {title || "Como a gente decide se uma promoção vale a pena"}
        </div>
        <div style={{ width: 180, height: 9, background: HEX.green600, borderRadius: 999 }} />
      </div>
    );
  } else if (kind === "veredito") {
    const verdict = isVerdict(searchParams.get("verdict"))
      ? (searchParams.get("verdict") as keyof typeof VERDICT)
      : "vale-agir";
    const v = VERDICT[verdict];
    const score = Number(searchParams.get("score"));
    const scoreTxt =
      verdict !== "nao-confirmado" && Number.isFinite(score) ? String(Math.round(score)) : "—";
    core = (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontFamily: "monospace",
              fontSize: 180,
              fontWeight: 700,
              color: HEX.ink,
              lineHeight: 0.9,
              letterSpacing: -5,
            }}
          >
            {scoreTxt}
          </div>
          <div
            style={{
              display: "flex",
              marginBottom: 22,
              padding: "12px 22px",
              borderRadius: 999,
              background: v.dashed ? HEX.paper : v.bg,
              color: v.fg,
              border: v.dashed ? `2px dashed ${HEX.gray400}` : "none",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            {v.label}
          </div>
        </div>
        {body ? (
          <div
            style={{
              display: "flex",
              fontSize: 38,
              lineHeight: 1.35,
              color: HEX.gray500,
              maxWidth: size.width - 144,
            }}
          >
            {body}
          </div>
        ) : (
          <div style={{ display: "flex" }} />
        )}
      </div>
    );
  } else if (kind === "cta") {
    core = (
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 700,
            color: HEX.ink,
            letterSpacing: -1,
            lineHeight: 1.1,
            maxWidth: size.width - 144,
          }}
        >
          {title || "A conta completa vira uma edição de 5 minutos, todo dia útil às 8h."}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            alignSelf: "flex-start",
            padding: "18px 34px",
            borderRadius: 8,
            background: HEX.green600,
            color: HEX.paper,
            fontSize: 34,
            fontWeight: 700,
          }}
        >
          {body || "Assine grátis · theloyal.com.br"}
        </div>
      </div>
    );
  } else {
    core = (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {title ? (
          <div
            style={{
              display: "flex",
              fontSize: 56,
              fontWeight: 700,
              color: HEX.ink,
              letterSpacing: -1,
              lineHeight: 1.1,
              maxWidth: size.width - 144,
            }}
          >
            {title}
          </div>
        ) : (
          <div style={{ display: "flex" }} />
        )}
        <div
          style={{
            display: "flex",
            fontSize: 40,
            lineHeight: 1.4,
            color: HEX.gray500,
            maxWidth: size.width - 144,
          }}
        >
          {body}
        </div>
      </div>
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: HEX.paper,
          padding: 72,
        }}
      >
        {indicator}
        {core}
        <div style={{ display: "flex", fontSize: 22, color: HEX.gray400, letterSpacing: 1 }}>
          The Loyal · pontos e milhas sem pegadinha
        </div>
      </div>
    ),
    size,
  );
}
