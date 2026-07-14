// LATAM Pass — Shopping LATAM Pass. Resgate em "pontos" (referência interna do
// The Loyal: aparece como qualquer outro player, pelo catálogo público).
import { makeAdapter } from "./base.mjs";

export default makeAdapter({
  player: "latam",
  channel: "Shopping LATAM Pass",
  domains: ["latampass.latam.com", "shopping.latam.com"],
  pointsPatterns: [
    /por\s+([\d.]+)\s*pontos/i,
    /([\d.]+)\s*pontos\s+latam/i,
    /([\d.]+)\s*pontos/i,
  ],
});
