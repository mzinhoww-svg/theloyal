import { ImageResponse } from "next/og";
import { HEX, VERDICT, isVerdict, pickSize } from "@/lib/social-brand";
import { Seal, Footer, Kicker } from "@/lib/social-parts";

// Card do TL Score: nota grande em mono + pill de veredito semântico + título.
// /social/tlscore?score=88&verdict=vale-agir&title=...&bars=92,90,100,80,85,80,75,90
export const runtime = "edge";

const CRITERIA = [
  "valor",
  "regra",
  "vigência",
  "fricção",
  "aplicab.",
  "liquidez",
  "estoque",
  "fontes",
];

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const verdictParam = searchParams.get("verdict");
  const verdict = isVerdict(verdictParam) ? verdictParam : "nao-confirmado";
  const v = VERDICT[verdict];
  const confirmed = verdict !== "nao-confirmado";

  const scoreRaw = Number(searchParams.get("score"));
  const hasScore = confirmed && Number.isFinite(scoreRaw);
  const score = hasScore
    ? String(Math.max(0, Math.min(100, Math.round(scoreRaw))))
    : "sem nota";

  const title =
    searchParams.get("title")?.slice(0, 120) ||
    "Transferência bonificada com compra de origem em desconto";
  const size = pickSize(searchParams.get("size"), "square");

  const bars = (searchParams.get("bars") || "")
    .split(",")
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n))
    .slice(0, 8);

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
          <Kicker>TL Score</Kicker>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 28 }}>
          <div
            style={{
              display: "flex",
              fontFamily: "monospace",
              fontSize: hasScore ? 220 : 92,
              fontWeight: 700,
              lineHeight: 0.9,
              color: hasScore ? HEX.ink : HEX.gray400,
              letterSpacing: hasScore ? -6 : -2,
              marginBottom: hasScore ? 0 : 20,
            }}
          >
            {score}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: 24,
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

        {bars.length === 8 ? (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 120 }}>
            {bars.map((b, i) => {
              const h = Math.max(6, Math.min(100, b)) * 1.0;
              return (
                <div
                  key={i}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
                >
                  <div
                    style={{
                      display: "flex",
                      width: 74,
                      height: h,
                      background: HEX.green600,
                      borderRadius: 4,
                    }}
                  />
                  <div style={{ fontSize: 15, color: HEX.gray400 }}>{CRITERIA[i]}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: "flex" }} />
        )}

        <div
          style={{
            display: "flex",
            fontSize: 34,
            lineHeight: 1.25,
            color: HEX.gray500,
            maxWidth: size.width - 144,
          }}
        >
          {title}
        </div>

        <Footer text="theloyal.com.br · nota de 0 a 100, oito critérios auditáveis" />
      </div>
    ),
    size,
  );
}
