// Smiles — Shopping Smiles. Resgate em "milhas".
import { makeAdapter } from "./base.mjs";

export default makeAdapter({
  player: "smiles",
  channel: "Shopping",
  domains: ["smiles.com.br", "shopping.smiles.com.br"],
  pointsPatterns: [
    /por\s+([\d.]+)\s*milhas/i,
    /([\d.]+)\s*milhas\s+smiles/i,
    /([\d.]+)\s*milhas/i,
  ],
});
