# Discovery Report — Auditoria de Assunção do The Loyalty

> Auditoria técnica de assunção (como um CTO recém-chegado). Base: branch
> `claude/loyalty-project-discovery-v8p2rf`. Fatos verificados (build, gates,
> git, leitura de código), não inferidos da documentação.

## Sumário executivo
Landing pronta, pipeline editorial técnico verde, **nenhuma edição real**. A engenharia está mais adiantada que a operação editorial. Existiam **quatro PRs abertos simultâneos** brigando pelo mesmo problema, **dois sistemas de renderização rivais e incompatíveis**, e o comando de publicação documentado (`npm run beehiiv`) **não existe** no `package.json`.

**Gates verificados nesta branch:** `build` ✅ · `validate` ✅ · `qa` ✅ APROVADO (0 bloqueios) · `beehiiv` ❌ script inexistente.

## Fase 1 — Inventário (resumo)
- **Canônico (System A):** `scripts/{lib,validate,render,render-web,render-system,publish,qa,pro,beehiiv-publish}.mjs`, `content/edition.schema.json`, `content/editions/*`, `lib/{editions,pro}.ts`, rotas `app/edicao/*` e `app/pro/*`, `components/{EditionArticle,ProReport}.tsx`.
- **Legado (System B):** `renderer/*`, `scripts/{render,validate}-daily.mjs`, `components/daily/DailyEdition.tsx`, `app/daily/preview`, `public/daily/*`, `renderer/edition.schema.json`.
- **Órfão/nunca usado:** `public/daily/*` (0 referências), enums de veredito não exercidos, campos `slug/tags/productType/scheduledAt`.
- **Sem CI:** não há `.github/`. Sem `vercel.json`.

## Fase 2 — Timeline
Todo o projeto nasceu em 8–9/07/2026 em conversas-agente paralelas. O **primeiro renderer** foi o System B (`renderer/`, PR#4); horas depois o **System A** (PR#6 "unificado") o substituiu na prática, mas ninguém removeu o B. PRs #10/#11/#12/#13 (abertos) tentaram, cada um por conta própria, arrumar a mesma bagunça; nenhum mergeado.

## Fase 3 — Sistema (hoje)
```
content/editions/NNNN.json → validate → render:system (email+plain+web+qa+manifest)
   → publish (latest/index) → qa (global) → node scripts/beehiiv-publish.mjs (MOCK)
Site vivo: /edicao/[numero] ← lib/editions.ts ;  /pro/[periodo] ← lib/pro.ts
Órfão: /daily/preview ← renderer/examples (System B)
```

## Fase 4 — Schemas
Dois formatos **rivais e incompatíveis** de edição (EN camelCase vs PT snake_case), vereditos divergentes. Schema oficial = `content/edition.schema.json`. **Nenhum `.schema.json` é carregado por máquina** — regras hard-coded e triplicadas (alto risco de drift). Campos mortos: `slug/tags/productType/scheduledAt`. Pro sem validador.

## Fase 5 — Renderer
Renderer verdadeiro do Daily = `scripts/render-system.mjs` (System A). `renderer/` + `*-daily.mjs` + `/daily/preview` + `components/daily` = órfão legado. 100% dos npm scripts apontam para `scripts/`; zero para `renderer/`.

## Fase 6 — Beehiiv
Publisher (`beehiiv-publish.mjs`): QA gate → lê `out/email/NNNN.html` → hash → idempotência → payload → mock/live. Draft por padrão; idempotência por `contentHash`; sem retry/rate-limit; só cria (não atualiza). Requer `BEEHIIV_API_KEY`+`BEEHIIV_PUBLICATION_ID` (`posts:write`, beta/Enterprise). **Ledger só tem registro mock; API real nunca tocada.** `npm run beehiiv` **não existe**.

## Fases 7–9 — Edição real, editorial, automação
Todo conteúdo é `illustrative:true` com fontes "(exemplo)". A máquina de *produzir e checar* existe; a de *decidir o que é uma edição* (pesquisa→curadoria→escrita→aprovação) **não existe como processo**. Automatizar primeiro: o gate de CI. Nunca automatizar: curadoria e o gatilho de Publish.

## Fase 10 — Gaps
Branch/Git (4 PRs concorrentes) · sem CI/Vercel/ESLint · `npm run beehiiv` inexistente · API Beehiiv nunca testada · dois renderers · schemas doc-only · **zero edições reais** · sem processo editorial · nome "The Loyal" vs "The Loyalty" · Weekly não construído · Lab/Special só resíduos em `out/`.

## Fase 11 — Roadmap
Fase 0 consolidar → 1 primeira edição real → 2 Daily operacional → 3 Weekly → 4 Lab → 5 Pro → 6 Cowork → 7 automação total.

## Respostas finais

**1. Publicar a #0001 amanhã?** Sim — mas manualmente. Gates verdes; o sistema gera o e-mail. Falta conteúdo real e a ponte marca→canal. Pelo caminho automático, não (script ausente, API nunca provada, `posts:write` não confirmado).

**2. Maior gargalo (um só):** a inexistência de conteúdo editorial real e de um processo de sourcing/curadoria. A engenharia ultrapassou a operação.

**3. Primeira tarefa da manhã:** consolidar a verdade em uma única `main` verde — decidir o destino dos 4 PRs, mergear a consolidação + restaurar `npm run beehiiv`. Primeiro uma fonte de verdade; depois a #0001.
