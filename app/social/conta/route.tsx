import { ImageResponse } from "next/og";
import { HEX, pickSize } from "@/lib/social-brand";
import { Seal, Footer, Kicker } from "@/lib/social-parts";

// Card "conta feita": o ContaBlock (fundo Ink, mono, resultado verde) como
// imagem. /social/conta?title=...&rows=custo:R$1.200|pontos:50.000&result=CPM:R$12/milheiro
export const runtime = "edge";

// Divide no primeiro ":" — valores como "R$ 12,00" não têm dois-pontos.
function parsePair(raw: string): [string, string] {
  const i = raw.indexOf(":");
  if (i === -1) return [raw.trim(), ""];
  return [raw.slice(0, i).trim(), raw.slice(i + 1).trim()];
}

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title =
    searchParams.get("title")?.slice(0, 90) || "A conta de hoje";
  const rows = (searchParams.get("rows") ||
    "custo origem:R$ 1.200,00|pontos origem:50.000|bônus:100%|milhas finais:100.000")
    .split("|")
    .slice(0, 7)
    .map(parsePair);
  const [resKey, resVal] = parsePair(
    searchParams.get("result") || "CPM final:R$ 12,00 /milheiro",
  );
  const size = pickSize(searchParams.get("size"), "portrait");

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
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Seal on="paper" />
          <Kicker>Deal Desk · conta feita</Kicker>
          <div
            style={{
              display: "flex",
              fontSize: 46,
              fontWeight: 700,
              color: HEX.ink,
              letterSpacing: -1,
              lineHeight: 1.1,
              maxWidth: size.width - 144,
            }}
          >
            {title}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            background: HEX.ink,
            borderRadius: 12,
            padding: "40px 44px",
            fontFamily: "monospace",
            color: HEX.paper,
            fontSize: 34,
            lineHeight: 1.7,
          }}
        >
          {rows.map(([k, val], idx) => (
            <div
              key={idx}
              style={{ display: "flex", justifyContent: "space-between", gap: 24 }}
            >
              <span style={{ color: HEX.gray400 }}>{k}</span>
              <span style={{ textAlign: "right" }}>{val}</span>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 24,
              marginTop: 18,
              paddingTop: 18,
              borderTop: `2px solid ${HEX.gray700}`,
              color: HEX.green500,
            }}
          >
            <span>{resKey}</span>
            <span style={{ fontWeight: 700, textAlign: "right" }}>{resVal}</span>
          </div>
        </div>

        <Footer text="Confira sempre as regras no site oficial antes de transferir." />
      </div>
    ),
    size,
  );
}
