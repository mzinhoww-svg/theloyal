# Análise do Sistema — The Loyal

> Mapa funcional de **todo** o projeto, subsistema por subsistema. Para cada
> funcionalidade: **função · fatos · o que gerir / não gerir · como gerir ·
> estado · gaps**. No fim, o **plano de próximas ações** priorizado.
>
> Complementa `CONTEXTO-PROJETO.md` (briefing) e os docs de conversão
> (`ANALISE-CONVERSAO.md`, `PLANO-CONVERSAO.md`, `MONETIZACAO-BACKLOG.md`).

---

## Panorama

O projeto tem **sete subsistemas**:

1. **Site público / growth** — a landing e as páginas que convertem leitor.
2. **Pipeline editorial** — JSON → e-mail/web/plain → Beehiiv (Daily, Weekly, Pro).
3. **Motor de dados (Radar/VPM)** — coleta VPM observado de catálogo público.
4. **Motor de previsão (Forecast/Predict)** — projeta janelas de bônus.
5. **Painel admin** — a central de controle operacional (Supabase).
6. **Integração Beehiiv** — publicação e inscrição.
7. **Skills de agente** — `.claude/skills`, ferramentas de trabalho (não é produto).

### ⚠️ O achado transversal mais importante: o sistema tem "gêmeos"

Vários subsistemas carregam **duas implementações paralelas** da mesma função,
resíduo de evolução rápida. Isso é o maior risco estrutural do projeto — não por
estar quebrado, mas por **divergência silenciosa** (dois lugares para mudar, um
esquecido):

| Duplicação | A (uma geração) | B (outra) | Risco |
|---|---|---|---|
| Coletor de VPM | Gen-1 `scripts/collect/*` (fetch simples) | Gen-2 `scripts/shopping/*` (headless Playwright) | tabelas, chaves e estatística (MAD vs IQR) diferentes; `pro:vpm` só lê a Gen-1, admin só a Gen-2 |
| Motor de previsão | Forecast (`lib/forecast.ts`, publica) | Predict v2 (`lib/predict-engine.ts`, só admin) | o produto usa o motor fraco; o forte não chega ao leitor |
| Motor Forecast | `lib/forecast.ts` (TS) | `scripts/forecast-engine.mjs` (ESM) | cópia manual sem teste de equivalência |
| Publicação Beehiiv | `scripts/beehiiv-publish.mjs` (CLI) | Beehiiv MCP | ambos editam `beehiiv-status.json`; a 0028 foi publicada pelo MCP com campo `provenance` que o script não conhece |
| Autenticação admin | cookie SHA-256 (`ADMIN_TOKEN`) | Basic Auth (`ADMIN_USER/PASSWORD`) | dois esquemas desconectados; `/admin/sku` e `/admin/collect` fogem do cookie |
| Regras invioláveis | `validate.mjs` | duplicadas em `render-weekly.mjs` e `pro.mjs` | o `INTERNAL_RE` do Pro é **mais fraco** — termo interno pode passar só no Pro |
| Catálogo de SKU | `sku_catalog`/`sku_sources` (Gen-1) | `shopping_products`/`shopping_product_sources` (Gen-2) | dois catálogos paralelos |
| Pipeline de render | `scripts/` + `content/*.schema.json` (canônico) | `renderer/*` + `scripts/*-daily.mjs` (legado) | legado fora do build, mas ainda exposto em `package.json` |

**Consolidar esses gêmeos é o tema central do plano de ação.**

---

## 1. Site público / growth

Já detalhado em `ANALISE-CONVERSAO.md`. Resumo funcional:

| Rota | Função | Estado |
|---|---|---|
| `/` (landing) | Converter leitor em assinante; um CTA (e-mail grátis) | Live, captura funciona |
| `/edicao` | Arquivo de edições reais (puxa do Beehiiv, ISR 1h) | Live (depende de `BEEHIIV_API_KEY` na Vercel) |
| `/edicao/[numero]` | Leitura de edição via JSON | Fixture ilustrativa; não linkada |
| `/pro` + `/pro/[periodo]` | Índice/relatório executivo + waitlist com perfil | Live |
| `/guia/cpm` | Lead magnet (reciprocidade) | Live |
| `/anuncie` | Media kit + contato B2B (`/api/contato`) | Live |
| `/sobre`, `/privacidade` | Institucional / LGPD | Live |
| `/api/{subscribe,track,contato}` | Inscrição Beehiiv / telemetria / B2B | Live |

- **Gerir:** copy, seções, formulários, segmentação (`source`/`perfil`).
- **Não gerir:** as edições em si (vêm do Beehiiv/pipeline).
- **Gaps:** telemetria é beacon próprio (sem agregação); rate-limit em memória.

---

## 2. Pipeline editorial

Fluxo: **um JSON** (fonte de verdade) → validate → render (email/plain/web) →
QA gate → publish (índices) → beehiiv-publish. Três produtos, três schemas.

| Etapa | Função | Como gerir | Estado |
|---|---|---|---|
| **Autoria JSON** | Peça estruturada conforme `content/*.schema.json` (`additionalProperties:false`, veredito enum, disclaimer `const`) | editar JSON em `content/editions|weekly|pro` | Maduro |
| **Validate** (`validate.mjs`) | Gate das regras invioláveis: disclaimer, emoji, urgência, CMI, vigência, TL Score↔veredito, breakdown fecha | `npm run validate [arquivo]` | Robusto |
| **Render** (`render.mjs`, `render-web.mjs`, `render-system.mjs`) | JSON → e-mail (600px, CSS inline, zero img/JS), plain, web (Fraunces/Inter/Mono, uma h1) | `npm run render` / `render:web` / `render:system` | Maduro |
| **QA gate** (`render-system.audit*`, `scripts/qa.mjs`) | Reaudita HTML gerado: email-safe, hex, cores, disclaimer, uma h1 | `npm run qa` (é o **editorial-gate** do CI) | Forte |
| **Publish** (`publish.mjs`) | Valida tudo + escreve `latest.json`/`index.json`. **Não envia e-mail** | `npm run publish` / `npm run edition` | Correto |
| **Beehiiv-publish** (`beehiiv-publish.mjs`) | Publica peça já renderizada; idempotente (hash); mock sem credencial | `npm run beehiiv [-- --schedule/--publish/--dry-run]` | Bem desenhado |

- **O que gere:** o conteúdo editorial e sua conformidade; a publicação idempotente.
- **O que NÃO gere:** não reescreve editorialmente no publish; não envia e-mail sem ação humana (publicação Beehiiv é manual, com `confirm=PUBLICAR`).
- **Produtos:** **Daily** (trilha completa, único com publisher wired) · **Weekly** (render próprio; radar puxa do `forecast.json`; **sem publisher Beehiiv**) · **Lab/Pro** (e-mail resumo + web SSG `/pro/[periodo]`; `derivedFrom` amarra o TL Score às edições do Daily).
- **Gaps principais:** (a) **marca "The Loyalty" hardcoded** no e-mail/web do Daily (resto usa "The Loyal"); (b) regras invioláveis **triplicadas** com `INTERNAL_RE` mais fraco no Pro; (c) duas trilhas de publicação (CLI vs MCP) no mesmo ledger; (d) `qa.mjs` não audita as superfícies **web**; (e) schema não é validado em runtime (sem `ajv`); (f) Radar do **Daily é colado à mão** (não injeta do forecast, ao contrário do Weekly).

---

## 3. Motor de dados — Radar de VPM (Shopping)

Converte preço público + pontos de resgate em **R$/milheiro (VPM observado)** por
programa/categoria. **Fronteira inviolável:** só catálogo público; CMI/dado interno
é barrado pelo gate `INTERNAL_RE`. Existem **duas gerações** (ver panorama).

| Componente | Função | Estado |
|---|---|---|
| Descoberta URL (Tavily) | Achar a página pública do produto por player | Mock (basket traz URL de home, não de produto) |
| Extração LLM (OpenRouter) | Match de SKU, classificar promo, extrair listagem — **nunca calcula VPM** | Funcional (degrada p/ heurística) |
| Adapters `azul/smiles/latam` | Normalizar cada portal a `{points, cash}` (JSON-LD p/ preço, regex p/ pontos) | **O ponto mais frágil** |
| Cálculo VPM (`stats.vpm`) | `cash / (points/1000)`, determinístico, fora do LLM | Sólido, testado |
| Banda estatística | Mediana + MAD (Gen-1) / IQR (Gen-2); confiança por amostra (≥3 confirma) | Determinístico |
| Escrita Supabase + gates | `runs`/`sku_observations`/`retail_valuations`; `gate_validate` (INTERNAL_RE + fonte) e `gate_audit` (recomputa VPM) | Seguro por construção |
| Injeção no Pro (`pro:vpm`) | VPM por player = mediana das medianas; só imprime, `--write` grava | Funcional (lê só Gen-1) |

- **O que gere:** o VPM observado público e sua banda auditável.
- **O que NÃO gere:** nunca CMI/dado interno; nunca inventa número (sem preço+pontos → lacuna `n/c`); não estima preço a partir de pontos.
- **Como gerir:** `npm run collect [-- --mock]`, `npm run pro:vpm [-- --write ...]`; semear catálogo pelo `/admin/sku`; afinar adapters contra a página ao vivo.
- **Estado:** hoje efetivamente **mock/seed**. A coleta ao vivo esbarra em: portais SPA/anti-bot (só a Gen-2 headless tem chance) e **pontos que exigem login** (nenhum pipeline autentica).
- **Gaps:** ver tabela de gêmeos; gate `INTERNAL_RE` é regex de superfície e só roda na Gen-1; cobertura de categorias estreita.

---

## 4. Motor de previsão (Forecast / Predict)

Prevê **quando cai a próxima janela de bônus de transferência** e **qual o %**,
por rota (`origem→destino`) e cluster (`→destino`). Ambos determinísticos, sem LLM.
Leem a tabela `campaigns` (o ledger). **Dois motores** (ver panorama).

| Componente | Função | Estado |
|---|---|---|
| **Forecast** (`lib/forecast.ts`) | Intervalo mediano/média + CV → janela + confiança. Publica no radar dos digests | Funcional, **em produção** |
| **Predict v2** (`lib/predict-engine.ts`) | Sobrevivência/hazard + distribuição de bônus + backtest walk-forward; gate bloqueia série <3 | Funcional **só no admin** |
| `forecast-engine.mjs` | Espelho ESM do Forecast p/ o render rodar sem TS | Duplicação manual (risco) |
| `forecast.mjs` (CLI) | Gera `content/forecast.json` do ledger; offline preserva artefato | Funcional |
| `/admin/forecast` | Calibra parâmetros + overrides (pin/mute/confiança) + snapshots | Completo |
| `/admin/predict` | Probabilidades P7…P180, backtest, "ondas (datas)", explicação | Fiel à RFC-009, isolado |

- **O que gere:** janelas de bônus com confiança rotulada; overrides do operador.
- **O que NÃO gere:** não prevê preço nem status; `<minSamples` → sem janela / bloqueado (respeita a regra 9 — não chuta).
- **Como gerir:** `npm run forecast`; calibrar em `/admin/forecast`; snapshot em `/admin/predict`.
- **Gaps:** (a) o produto publica o **motor fraco** (Forecast, `minSamples=2`) e esconde o forte (Predict, com gate+backtest); (b) duplicação TS↔mjs sem teste; (c) **radar do Daily colado à mão**; (d) camada de dados pobre (119 linhas, 8/32 séries com previsão) — a RFC-009 (catálogo de programas, enriquecimento de campanhas) não foi implementada; (e) janelas de stdev enorme viram projeções para 2027-2029 rotuladas "baixa".

---

## 5. Painel admin (central de controle)

Supabase via PostgREST puro com **SERVICE key** (bypassa RLS). Sem a key → leitura
vazia + banner amarelo.

| Tela | Função | Gere? |
|---|---|---|
| **Dashboard** `/admin` | HUD: atenção agora, tendências 14d, últimas execuções | Não (navegação) |
| **Crons** `/admin/jobs` | Pausar/ativar/rodar `pg_cron` (RPCs `admin_*`) | Sim, os agendamentos |
| **Backfill** `/admin/backfill` | Progresso da recuperação histórica; reprocessar URL | Sim, a fila |
| **Notícias** `/admin/noticias` | Coleta→extração; reprocessar; disparar extrator LLM | Sim, o estado das notícias |
| **Campanhas** `/admin/campanhas` | **Curadoria editorial**: veredito + TL Score inline | Sim (principal tela de escrita) |
| **Digests** `/admin/digests` | Ciclo de vida das edições; gates; link Beehiiv | Não (leitura) |
| **Logs** `/admin/logs` | Timeline de execuções | Não |
| **Forecast** `/admin/forecast` | Calibrar motor + overrides + snapshots | Sim, os parâmetros |
| **Predict** `/admin/predict` | Snapshots do motor v2 | Sim (gerar snapshot) |
| **Radar VPM** `/admin/shopping-vpm` | Recalcular + disparar coleta headless (GitHub Actions) | Sim |
| **Observability** `/admin/observability` | Calendário/valuations/edições | Não (leitura) |
| `/admin/sku`, `/admin/collect` | Escrever catálogo / disparar coletor (Basic Auth) | Sim (sem UI no menu) |

- **Auth:** cookie SHA-256 do `ADMIN_TOKEN` (middleware) + Basic Auth separado nas rotas de escrita do Radar. Segredo único, sem usuários/roles/rate-limit no login.
- **Gaps:** sem paginação (limites fixos 100/500/2000, filtros client-side); `/admin/sku` é endpoint de escrita **sem UI**; Forecast × Predict × Observability se sobrepõem; sem trilha de auditoria em quem alterou veredito/score; URL/anon Supabase e branch de dispatch **hardcoded**.

---

## 6. Integração Beehiiv

- **Inscrição:** `/api/subscribe` (honeypot, rate-limit, `source`/`perfil`). Publication real `pub_ff1dca66-…` (`theloyal.beehiiv.com`).
- **Publicação:** `scripts/beehiiv-publish.mjs` (idempotente) **e** o MCP do Beehiiv — duas trilhas no mesmo ledger `beehiiv-status.json`.
- **Arquivo web:** `/edicao` lê os posts publicados via API (`lib/beehiiv-editions.ts`).
- **Gerir:** publicação de edições, automações da régua (no painel Beehiiv).
- **Pendências:** `BEEHIIV_API_KEY`/`PUBLICATION_ID` em produção; régua de e-mail.

---

## 7. Skills de agente

`.claude/skills`: as `tl-*` do projeto (digest-template, qa, source-audit) + o
pacote de design instalado (impeccable, apple-design, layers-*, taste, etc.).
Ferramentas de trabalho do agente, não código de produto. Gerir = adicionar/remover
skills; não afetam runtime.

---

# Plano de próximas ações (priorizado)

Organizado por impacto. "Consolidar gêmeos" e "destravar receita" primeiro.

## P0 — Destrava receita / evita perda de dado
1. **Confirmar `BEEHIIV_API_KEY`/`PUBLICATION_ID` na Vercel** (inscrição + `/edicao`).
2. **Montar a régua de e-mail no Beehiiv** (boas-vindas → D3 → D7 → convite Pro).
3. **Unificar a publicação Beehiiv (CLI × MCP).** Definir uma trilha única de escrita do `beehiiv-status.json` ou fazer o script reconhecer `provenance` — hoje a idempotência pode estar cega ao que o MCP publicou.

## P1 — Consolidar gêmeos (elimina divergência silenciosa)
4. **Regras invioláveis numa fonte única** (`assertEditorialRules` em `lib.mjs`), reusada em Daily/Weekly/Pro — o `INTERNAL_RE` do Pro hoje é mais fraco.
5. **Unificar o coletor na Gen-2 headless**; migrar `pro:vpm` para ler `shopping_*`; aposentar/reduzir a Gen-1.
6. **Conectar o Predict v2 aos digests** (ou, no mínimo, subir `minSamples` do Forecast e exigir confiança `média+` no weekly). Publicar o motor forte, não o fraco.
7. **Teste de equivalência TS↔mjs** para `forecast.ts` × `forecast-engine.mjs` (falha na primeira divergência).
8. **Corrigir marca "The Loyalty" → "The Loyal"** no e-mail/web do Daily.

## P2 — Robustez e operação
9. **Login do admin:** rate-limit + lockout + comparação constant-time; caminho para usuários/roles (Supabase Auth) e trilha de auditoria em veredito/TL Score.
10. **Remover hardcodes:** URL/anon Supabase → env obrigatória; branch de dispatch `GH_COLLECT_REF` → produção (não a branch de trabalho).
11. **Resolver login/sessão nos adapters headless** (pontos de resgate exigem autenticação — é o bloqueio real da coleta ao vivo).
12. **Paginação server-side** em campanhas/notícias/backfill/logs; expor UI para `/admin/sku`.
13. **Estender `qa.mjs` às superfícies web**; validar JSON contra schema em runtime (`ajv`).
14. **Automatizar o radar do Daily** (hoje colado à mão) ou documentar que é manual.

## P3 — Crescimento do produto (do backlog de monetização)
15. **Pro pago:** preço, gateway, abrir o beta a partir da waitlist segmentada.
16. **Ampliar cobertura do Radar** (categorias além de áudio) para as bandas fecharem.
17. **Aposentar formalmente o pipeline legado** (`renderer/*`, `daily:*` no package.json).

---

> Cada item do plano pode virar um pedido isolado. Para gerar prompts refinados de
> execução, use `CONTEXTO-PROJETO.md` como briefing.
