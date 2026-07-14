// Azul — Clube TudoAzul / Shopping. Pontos aparecem como "por N pontos".
import { makeAdapter } from "./base.mjs";

export default makeAdapter({
  player: "azul",
  channel: "Shopping",
  domains: ["voeazul.com.br", "tudoazul.com"],
  pointsPatterns: [
    /por\s+([\d.]+)\s*pontos/i,
    /([\d.]+)\s*pontos\s+tudoazul/i,
    /([\d.]+)\s*pontos/i,
  ],
});
