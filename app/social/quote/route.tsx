import { ImageResponse } from "next/og";
import { HEX, pickSize } from "@/lib/social-brand";
import { Seal, Footer, Kicker } from "@/lib/social-parts";

// Card de citação: uma frase forte (Mito/Método) em destaque editorial.
// /social/quote?text=...&kicker=...&size=square|wide
export const runtime = "edge";

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const text =
    searchParams.get("text")?.slice(0, 220) ||
    "Bônus de 100% pode ser um mau negócio. Quase sempre é.";
  const kicker = searchParams.get("kicker")?.slice(0, 40) || "A conta, não a manchete";
  const size = pickSize(searchParams.get("size"), "square");

  // Frases longas encolhem para caber sem estourar o card.
  const fontSize = text.length > 150 ? 52 : text.length > 90 ? 62 : 72;

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
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Seal on="paper" />
          <Kicker>{kicker}</Kicker>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
        >
          <div
            style={{
              fontSize,
              lineHeight: 1.12,
              fontWeight: 700,
              color: HEX.ink,
              letterSpacing: -1,
              maxWidth: size.width - 144,
            }}
          >
            {text}
          </div>
          <div
            style={{ width: 160, height: 8, background: HEX.green600, borderRadius: 999 }}
          />
        </div>

        <Footer text="theloyal.com.br · a conta feita, todo dia útil às 8h" />
      </div>
    ),
    size,
  );
}
