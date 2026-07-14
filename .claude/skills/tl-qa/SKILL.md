---
name: tl-qa
description: QA global do The Loyal — audita landing, JSON editorial, HTML de e-mail e página web de uma vez e BLOQUEIA qualquer regra inviolável quebrada. Use antes de fazer merge, publicar uma edição ou abrir PR; sempre que precisar confirmar que uma superfície (landing, e-mail, web ou JSON) está conforme o contrato de marca.
---

# tl-qa

Gate único sobre as quatro superfícies. Roda os checks mecânicos e **reprova (exit 1)**
se qualquer regra inviolável for quebrada.

## Como rodar

```bash
npm run render   # garante que out/email existe (o QA de e-mail lê o HTML gerado)
npm run qa       # audita landing + JSON + e-mail + web; sai !=0 em bloqueio
```

`npm run qa` = `node scripts/qa.mjs`.

## O que audita (e bloqueia)

**Landing / página web (código de `app/` e `components/`):**
- Hex hardcoded em componente fora de `PontoMascot.tsx`/`graphics.tsx` → **bloqueia**.
- Cor default do Tailwind (`bg-white`, `text-white`, slate, zinc, indigo…) → **bloqueia**.
  (gray/green/blue/yellow/red são tokens redefinidos da marca — permitidos.)
- Disclaimer oficial presente no footer e na metodologia → **bloqueia** se ausente.
- Fundo de página Paper, nunca branco.

**JSON editorial (`content/editions/*.json`):** roda o validador — disclaimer íntegro,
zero emoji/urgência, fonte por deal, overrule de vigência (sem vigência ⇒ `nao-confirmado`),
TL Score coerente com a faixa, breakdown que fecha, fontes com URL.

**E-mail HTML (`out/email/*.html`):**
- Emoji ou urgência artificial no corpo → **bloqueia**.
- Amarelo `#F2C94C` como cor de texto → **bloqueia** (amarelo só é fill).
- `<script>` ou recurso externo (`src=http`, `url(http)`) → **bloqueia** (e-mail self-contained).
- Disclaimer oficial ausente → **bloqueia**.

**Página web:** herda a validação do JSON (o conteúdo vem do mesmo JSON) + o scan de fonte
dos componentes que a renderizam.

## Política

- Qualquer item de **bloqueio** ⇒ parecer **REPROVADO**; não fazer merge nem publicar até corrigir.
- Avisos não bloqueiam, mas devem ser resolvidos ou justificados.
- Este gate complementa **tl-source-audit** (julgamento editorial: qualidade de fonte, cálculo,
  anti-cópia) — rode os dois antes de publicar.
