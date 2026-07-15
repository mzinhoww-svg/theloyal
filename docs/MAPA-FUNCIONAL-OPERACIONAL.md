# Mapa Funcional e Operacional — The Loyal

> Análise funcional e operacional completa do produto, dos motores de dados, do
> pipeline editorial e das integrações. Transforma o inventário técnico atual em
> um **mapa de capacidades** para orientar a evolução. Base: implementação real
> do repositório (`app/`, `lib/`, `scripts/`, `supabase/`, `.github/`,
> `content/`) + `CLAUDE.md` + `docs/*`.
>
> **Etapa de leitura, não de execução.** Nenhum código, banco, migration,
> secret ou publicação foi alterado para produzir este documento.
>
> Data de referência: 2026-07-15.

## Nota de fontes (divergências encontradas na própria base)

Antes do conteúdo, três avisos de integridade da documentação — porque este
mapa precisa ser fiel ao código, não ao que a documentação afirma:

1. **`CONTEXTO-PROJETO.md` não existe** no repositório. O pedido o cita como
   fonte; ele não está versionado. Este documento usa `CLAUDE.md`, `docs/*`,
   `README.md`, `COWORK.md` e a implementação real como base.
2. **A hierarquia de verdade do `CLAUDE.md` aponta para arquivos-fantasma.**
   `THE-LOYALTY-LLM-SYSTEM.md`, `DESIGN.md`, `THE-LOYALTY-BRAND-GUIDELINES.md`,
   `PONTO-MASCOTE-GUIA.md`, `TL-GRAPHICS.md` e o "Operating Manual v1"
   **não existem** na árvore. As fontes de verdade reais são: `CLAUDE.md`, os
   schemas em `content/*.schema.json`, os scripts em `scripts/` e as três skills
   `tl-*`. (Registrado também na RFC-001 EKS, achado D-1.)
3. **Documentação divergente do código:** `RADAR-VPM.md`, `GO-LIVE.md` e
   `content/README.md` descrevem telas/rotas (`app/admin/route.ts`, seção
   "Catálogo de SKUs" no `/admin`) que **não existem mais** na árvore atual —
   sobreviveram apenas as rotas de escrita `app/admin/sku|collect/route.ts`, sem
   UI que as consuma.

---

## 1. Resumo executivo

**O que o The Loyal é, em software.** Uma mídia editorial vertical de loyalty
cujo produto central não é texto e sim **julgamento auditável** — cada
oportunidade recebe uma conta feita (CPM/VPM/spread), um TL Score (0–100) e um
veredito rastreável até a fonte. Ao redor disso há: um **site público** de
aquisição (Next.js SSG), um **pipeline editorial** file-based que gera e-mail /
web / plain a partir de um JSON por edição, um **admin operacional** ("Central de
Controle") que lê e opera o Supabase ao vivo, e **motores de dados** (Radar de
VPM por SKU, extração de campanhas por LLM, forecast/predict de janelas).

**Estado global honesto.** A **infraestrutura está madura e provada; o produto
ainda não começou a operar em regime.** Evidências convergentes:

- **Conteúdo 100% ilustrativo.** As 2 edições Daily, 1 Weekly e 1 relatório Pro
  versionados têm `illustrative: true`. O pipeline está provado ponta-a-ponta,
  mas nenhuma edição de produção foi criada. Um único rascunho real existe no
  Beehiiv (`daily-0028`, status `draft`) — e foi criado **via MCP, fora do gate**
  de QA/idempotência do script.
- **Tudo "live" depende de secrets ausentes por padrão.** Sem
  `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_TOKEN`, `BEEHIIV_*`, `GH_DISPATCH_TOKEN`,
  `TAVILY/OPENROUTER`, cada superfície cai graciosamente em **mock/leitura
  limitada**. Seguro por construção, porém inerte até a configuração.
- **Coleta de preços bloqueada por realidade externa.** Os marketplaces de
  resgate (LATAM/Azul/Smiles) são SPA e/ou exigem login; os adapters headless
  não estão afinados. O Radar exibe hoje um **seed histórico**, não coleta viva.
- **Funil de leads desconectado dos destinos.** Assinatura Beehiiv está correta
  no código mas em mock por falta de env; `track` e `/api/contato` só fazem
  `console.log` (sem persistência); Pro é vitrine + waitlist, **sem gateway,
  sem paywall, sem gate de conteúdo**.

**As cinco tensões estruturais que este mapa expõe** (detalhe na §8):

1. **Dois coletores de VPM** convivendo — Gen-1 `sku_*` (legado, órfão de UI) e
   Gen-2 `shopping_*` (canônico). Rotas de escrita Gen-1 vivas e sem consumidor.
2. **Dois renderers/schemas** — canônico (`scripts/` + `content/edition.schema.json`)
   e legado (`renderer/` + `*-daily.mjs`), o legado ainda no `package.json`.
3. **Forecast × Predict** — dois motores de janela sobre o mesmo ledger; a regra
   "predict `ready` é a fonte de verdade" (RFC-009) não é aplicada; Predict é
   isolado, não alimenta digest algum.
4. **Três vias de publicação Beehiiv** com garantias diferentes (CLI idempotente;
   workflow com gate humano; MCP sem gate) — a única publicação real usou a via
   sem gate.
5. **Duas autenticações e nenhum RBAC** — cookie `tl_admin` (painel) e Basic Auth
   (Radar), ambas segredo compartilhado de **admin único**; **zero trilha de
   auditoria** de mutações administrativas.

**Onde investir (resumo; §13 detalha as 3 fases).** (a) **Fundação de dados e
governança**: versionar as RPCs `admin_*` e a view `shopping_sku_latest_v` (hoje
só vivem no banco), introduzir trilha de auditoria e papéis; (b) **Destravar o
funil**: env do Beehiiv em produção, persistir `track`/`contato`, régua de
e-mail; (c) **Consolidar as duplicações** (VPM Gen-1/2, renderer legado,
forecast/predict, vias Beehiiv) e ligar o Predict/Radar ao editorial.

---

## 2. Mapa de capacidades

Legenda de estado: **OK** operacional · **OK−** operacional com limitações ·
**PARC** parcial · **MOCK** mock por falta de config · **ISO** isolado/não
integrado · **DUP** duplicado · **LEG** legado · **BLOQ** bloqueado (externo) ·
**N/I** não implementado.

| # | Capacidade | Subsistema | Fonte de verdade | Estado | Nota |
|---|---|---|---|---|---|
| C01 | Site público e growth | Site | `app/**` (SSG) | **OK** | Institucional completo, on-brand |
| C02 | Assinatura e captura de leads | Site | Beehiiv (via `/api/subscribe`) | **OK− / MOCK** | Código correto; mock sem `BEEHIIV_*` |
| C03 | Arquivo e leitura de edições | Site | `content/editions/*.json` (SSG) | **OK−** | Só conteúdo ilustrativo |
| C04 | Monetização Pro | Site/Negócio | `content/pro/*.json` | **N/I (esqueleto)** | Sem gateway/paywall/gate |
| C05 | Contato comercial / anunciantes | Site/B2B | Vercel Logs | **MOCK** | Só `console.log`; sem persistência |
| C06 | Rastreamento de conversão (track) | Site | Vercel Logs | **PARC** | Instrumentado; sem storage |
| C07 | Pipeline Daily | Editorial | `content/editions/NNNN.json` | **OK−** | Provado; conteúdo ilustrativo |
| C08 | Pipeline Weekly | Editorial | `content/weekly/*.json` | **PARC / ISO** | Sem via de publicação |
| C09 | Relatório Pro (render) | Editorial | `content/pro/AAAA-MM.json` | **PARC / ISO** | Sem via de publicação |
| C10 | Publicação no Beehiiv | Editorial | `content/beehiiv-status.json` + `editions` | **OK− / DUP** | 3 vias; live só via MCP |
| C11 | Digests (admin) | Editorial | `editions` / `edition_drafts` (Supabase) | **OK−** | QA fraco vs pipeline |
| C12 | Skills de agentes (`tl-*`, Cowork) | Editorial | `.claude/skills/*`, `COWORK.md` | **OK (guia)** | Não executam; orientam |
| C13 | Radar de VPM (Gen-2) | Dados | `shopping_*` (Supabase) | **OK− / BLOQ** | UI/cálculo OK; coleta bloqueada |
| C14 | Catálogo de SKUs | Dados | `shopping_products` (seed) | **OK−** | Curado por seed; sem UI de edição |
| C15 | Coleta de preços e pontos | Dados | `shopping_observations` | **BLOQ** | SPA/login; seed histórico |
| C16 | Matching de produtos | Dados | `canonical_key` (curado) | **PARC / N/I** | LLM/Jaccard/EAN não invocados |
| C17 | Benchmarks e bandas estatísticas | Dados | `shopping_recompute` RPC | **OK−** | Roda; sem dado vivo p/ alimentar |
| C18 | Coletor VPM Gen-1 (`sku_*`) | Dados | `retail_valuations` | **LEG / DUP** | Só alimenta Pro; UI órfã |
| C19 | Campanhas | Motor editorial | `campaigns` (Supabase) | **OK−** | Estados sem writer versionado |
| C20 | Notícias | Motor editorial | `news_raw` (Supabase) | **OK** | ingest→extract |
| C21 | Backfill | Motor editorial | `backfill_queue`/`_tracker` | **OK** | Depende de RPC não versionada |
| C22 | Forecast | Inteligência | `campaigns` + `content/forecast.json` | **OK−** | Espelho TS↔mjs sem teste |
| C23 | Predict v2 | Inteligência | `campaigns` + `predict_snapshots` | **PARC / ISO** | Motor OK; não integrado |
| C24 | Jobs e crons | Operação | `cron.job` (pg_cron) via RPC | **OK / não-versionado** | RPCs `admin_*` só no banco |
| C25 | Logs | Operação | `cron.job_run_details` + `runs` | **OK** | Read-only unificado |
| C26 | Observabilidade | Operação | derivado (campaigns/valuations/editions) | **OK** | Read-only |
| C27 | Autenticação | Segurança | `ADMIN_TOKEN` / Basic Auth | **OK− / DUP** | 2 esquemas; sem RBAC |
| C28 | Configurações e secrets | Segurança | env vars | **OK−** | Fallbacks hardcoded |
| C29 | Auditoria de mutações | Segurança | — | **N/I** | Sem trilha por operador |

---

## 3. Fichas funcionais

> Cada ficha segue o gabarito 2.1–2.13. Verdades globais que se repetem
> (admin único sem RBAC; sem trilha de auditoria; degradação para mock sem
> secret) são afirmadas por ficha, mas os papéis-alvo propostos estão na §7.

### C01 — Site público e growth

**2.1 Identidade.** Site institucional/marketing (`app/page.tsx`, `sobre`,
`guia/cpm`, `daily/preview`, `components/shell.tsx`, `sections.tsx`). Subsistema:
Site. Objetivo: apresentar a proposta (método auditável) e converter visita em
lead. Problema que resolve: topo de funil e prova de autoridade. Valor negócio:
aquisição orgânica. Valor usuário: entende em 1 tela o que o produto faz.
Atores: visitante (principal), fundador/editor (mantém copy). Usuário principal:
visitante anônimo.

**2.2 Função.** Renderiza páginas SSG estáticas com a copy da marca, Hero com
form, `StickyCTA` mobile (aparece após scroll >640px, dispara `cta_click`),
glossário, footer com disclaimer literal. **Não deve** capturar dado sensível,
prometer ganho, usar urgência/emoji. Decisões que suporta: nenhuma operacional —
é superfície. Dispara: telemetria de `cta_click`/`subscribe_*`. Consome o
resultado: Beehiiv (indireto), analytics. Fonte de verdade: código estático.

**2.3 Entradas.** Obrigatórias: nenhuma (conteúdo hardcoded). Opcionais: `source`
propagado ao form. Origem: código. Validações: n/a. Dep. externas: fontes Google
(web). Dep. internas: `components/*`, `lib/track.ts`. Campos observados/calc/edit:
todo o conteúdo é **editorial de código** (copy). Imutável em runtime.

**2.4 Saídas.** HTML estático; eventos de telemetria; nenhum artefato de dados.
Destinos: navegador; `/api/track`.

**2.5 Ações.** Automáticas: render SSG no build. Manuais: editar copy (deploy).
Nenhuma destrutiva/lote. Quem executa: fundador/editor via commit. Pré-condição:
build verde. Falhas: quebra de build. Desfazer: revert de commit. Auditoria: git.

**2.6 Ciclo de vida.** `rascunho de copy → commit → build SSG → deploy → vivo →
substituído por novo deploy`. Sem estados de erro em runtime além de 404.

**2.7 Gestão.** Gerir: copy, links, prova social. Quem: editor/fundador. Onde:
repositório. Como: PR + build. Não editável: tokens de marca sem revisão. Deve
ser automatizado: build/deploy. Supervisão humana: copy (regras invioláveis).
Revisão: a cada mudança de posicionamento. Retenção/arquivamento: git.

**2.8 Exceções.** Link morto → detectar por revisão/checagem de rota; não bloqueia
build. Falha de build → bloqueia deploy (CI). Sem analytics → otimização às
cegas (ver C06).

**2.9 Permissões e auditoria.** Visualizar: público. Criar/editar/publicar:
editor + administrador técnico (via PR/deploy). Excluir/reprocessar: n/a.
Auditar: histórico git. Hoje: sem trilha além do git.

**2.10 Indicadores.** Uso: pageviews (não instrumentado — precisa Vercel
Analytics). Conversão: `cta_click`→form (via track, hoje só log). Qualidade:
Lighthouse/AA. Meta inicial: LCP<2,5s, AA em todas as rotas. Alerta: build falho.

**2.11 Estado atual.** **OK.** 6+ rotas SSG completas, coerentes com a marca,
compilam estático (confirmado no build). Evidência: nenhuma rota pública usa
`dynamic`/`revalidate`; `sections.tsx` sem fetch/db.

**2.12 Gaps.** Produto: sem prova social real (falta volume). Config: analytics
de página não plugado. Conteúdo: prova de valor ainda ilustrativa (C03).

**2.13 Melhorias.** *Quick win:* Vercel Analytics/Speed Insights (impacto medição,
esforço baixo, risco nulo, reversível; aceite: eventos no painel). *Experiência:*
prova de processo honesta no hero (nº de edições/análises). *Aquisição:* já há
imagem OG dinâmica (`app/opengraph-image.tsx`).

---

### C02 — Assinatura e captura de leads

**2.1 Identidade.** `components/SubscribeForm.tsx` → `app/api/subscribe/route.ts`
→ Beehiiv. Subsistema: Site. Objetivo: converter visitante em assinante da
newsletter. Problema: capturar o lead com confiabilidade e conformidade. Valor
negócio: base de audiência (ativo #1). Valor usuário: recebe o Daily. Atores:
visitante (principal), Beehiiv (operador de dados), fundador (config). Usuário
principal: visitante.

**2.2 Função.** Valida e-mail (client+server, mesma regex), honeypot `empresa`,
rate-limit in-memory (5/60s/IP → 429), e chama `POST
/v2/publications/{pub}/subscriptions` com `utm_source=<source>` e, quando houver,
`custom_fields.perfil`. `send_welcome_email:true` delega boas-vindas ao Beehiiv.
**Não deve** persistir localmente, coletar além de e-mail+perfil, nem confirmar
sucesso sem envio real (risco de descarte silencioso). Fonte de verdade: Beehiiv.

**2.3 Entradas.** Obrigatória: `email`. Opcionais: `empresa` (honeypot), `source`,
`perfil` (da waitlist). Origem: form. Validações: regex e-mail; honeypot;
rate-limit. Dep. externas: Beehiiv API. Dep. internas: `lib/track.ts`. Observados:
`email`, `source`, `perfil`. Calculados: nenhum. Editoriais: nenhum. Imutável:
n/a (append no Beehiiv).

**2.4 Saídas.** Inscrição no Beehiiv; eventos `subscribe_submit/success/error`;
`{ok, mock?}` ao client. Sem gravação local. Destinos: Beehiiv; `/api/track`.

**2.5 Ações.** Manual individual: inscrever (visitante). Automática: nenhuma.
Destrutiva: não. Confirmação: não. Quem executa: visitante. Pré-condição:
`BEEHIIV_API_KEY`+`BEEHIIV_PUBLICATION_ID` para envio real (senão mock).
Resultado: assinante criado. Falhas: `invalid_email` (400), `rate_limited`
(429), `provider_error` (502), **mock silencioso** sem env. Desfazer:
descadastro (no Beehiiv). Auditoria: só no Beehiiv.

**2.6 Ciclo de vida.** `submit → validado → (mock | enviado ao Beehiiv) →
subscription(created) → welcome (Beehiiv)`. Erro: `invalid_email`,
`rate_limited`, `provider_error`, `mock`.

**2.7 Gestão.** Gerir: presença dos secrets; taxa de conversão. Quem:
administrador técnico. Onde: Vercel env + Beehiiv. Automatizado: envio. Supervisão:
confirmar que produção **não** está em mock. Revisão: mensal. Retenção: no
Beehiiv (LGPD — `/privacidade` cita operadora).

**2.8 Exceções.** **Modo mock em produção** (env ausente) → detectar por ausência
de novos assinantes / log `console.warn`; **deve** alertar (risco de perder todos
os leads). Rate-limit por cold start → falso 429 raro; migrar para KV. Timeout/erro
upstream → 502, não vaza detalhe. Duplicidade: `reactivate_existing:false`.

**2.9 Permissões e auditoria.** Visualizar leads: administrador técnico/comercial
(no Beehiiv). Criar: visitante. Editar/excluir: no Beehiiv (LGPD). Auditar:
Beehiiv. Hoje: sem trilha local.

**2.10 Indicadores.** Conversão: `subscribe_submit→success` (via track, hoje só
log). Uso: novos assinantes/dia (Beehiiv). Falha: taxa 429/502. Meta inicial:
>2% view→assinante. Alerta: **zero inscrições em 24h** (proxy de mock em prod).
Ação abaixo da meta: revisar env e copy.

**2.11 Estado atual.** **OK− / MOCK.** Integração correta e o drift histórico
(form mock no `main`) **já foi reconciliado** — o form chama `/api/subscribe`.
Limitação: sem credenciais em produção → modo mock; rate-limit frágil. Evidência:
`route.ts` com honeypot/rate-limit/chamada real; sem `BEEHIIV_*` retorna
`{mock:true}`.

**2.12 Gaps.** Config: `BEEHIIV_*` em produção (gap #1 do funil). Integração:
rate-limit precisa de store externo (KV). Operação: sem alerta de mock.

**2.13 Melhorias.** *Correção obrigatória:* confirmar `BEEHIIV_*` em produção +
alerta de "zero inscrições" (impacto alto, esforço baixo, risco de regressão se
não monitorado; aceite: e-mail próprio cai no Beehiiv a partir do `main`).
*Redução de risco:* rate-limit em Vercel KV. *Automação:* double opt-in +
welcome com lead magnet (via Beehiiv).

---

### C03 — Arquivo e leitura de edições (web)

**2.1 Identidade.** `app/edicao/page.tsx` (índice) + `app/edicao/[numero]/page.tsx`
(SSG) via `lib/editions.ts`. Subsistema: Site. Objetivo: dar permalink web a cada
edição (prova e SEO). Problema: leitura pública e arquivamento. Valor negócio:
prova concreta + tráfego orgânico. Valor usuário: lê edições anteriores. Usuário
principal: visitante/assinante.

**2.2 Função.** `listEditions()` lê `content/editions/*.json` no build,
`generateStaticParams` gera uma página por número, `EditionArticle` renderiza.
**Não deve** expor edição não pronta. Fonte de verdade: JSON em `content/editions/`.
Nota: as páginas web **não** consomem `latest.json`/`index.json` (esses alimentam
o e-mail/pipeline).

**2.3 Entradas.** Obrigatório: `content/editions/NNNN.json` conforme
`edition.schema.json`. Origem: repositório. Validações: no pipeline (C07), não na
página. Observados/calc/editoriais: todo o conteúdo é editorial (produzido pelo
Cowork). Imutável pós-publicação (versionado).

**2.4 Saídas.** Páginas HTML estáticas `/edicao/N`. Destino: navegador/SEO.

**2.5 Ações.** Automática: SSG no build. Manual: adicionar edição (commit).
Destrutiva: remover edição (commit). Desfazer: revert. Auditoria: git.

**2.6 Ciclo de vida.** `JSON validado → build SSG → /edicao/N vivo → arquivado`.

**2.7 Gestão.** Gerir: quais edições ficam públicas. Quem: editor. Onde: repo.
Não editável: conteúdo já publicado (imutável). Revisão: por edição. Retenção:
permanente (arquivo).

**2.8 Exceções.** Número inexistente → `notFound()` (404). JSON inválido → quebra
de build (o schema é validado no pipeline antes).

**2.9 Permissões.** Visualizar: público. Criar/publicar: editor (via pipeline+PR).
Excluir: administrador técnico. Auditar: git.

**2.10 Indicadores.** Uso: pageviews por edição (não instrumentado). Cobertura: nº
de edições publicadas. Meta: ≥1 edição/dia útil quando em regime.

**2.11 Estado atual.** **OK−.** Mecânica funciona; **conteúdo ilustrativo**
(`0027`/`0028` com `illustrative:true`). Evidência: `content/index.json count:2`.

**2.12 Gaps.** Conteúdo: sem edições reais. Produto: landing não linka uma edição
real como prova (parcial — plano P1-D).

**2.13 Melhorias.** *Quick win:* linkar 1 edição real na landing (impacto médio,
esforço baixo). *Nova capacidade:* busca/filtro por editoria no arquivo.

---

### C04 — Monetização Pro

**2.1 Identidade.** `app/pro/page.tsx` (vitrine+waitlist), `components/ProWaitlist.tsx`,
`app/pro/[periodo]/page.tsx` (relatório SSG). Subsistema: Site/Negócio. Objetivo:
capturar intenção de pagar e (futuramente) vender profundidade/histórico. Problema:
monetização direta. Valor negócio: receita recorrente futura. Valor usuário: radar
completo, benchmarks, histórico. Usuário principal: heavy user/profissional.

**2.2 Função.** Lista relatórios via `listProReports()`, mostra corte "grátis vs
Pro", e capta waitlist (perfil + e-mail) reusando `/api/subscribe`
(`source:pro-waitlist`, `perfil`). **Não deve** travar o Daily. Fonte de verdade:
`content/pro/*.json`. Decisões que suporta: segmentação de upsell (perfil).

**2.3 Entradas.** Obrigatório: `email`; `perfil` (consumidor/heavy-user/profissional).
Origem: form. Validações: e-mail. Dep. externas: Beehiiv (custom field). Editoriais:
conteúdo do relatório Pro. Imutável: relatório publicado.

**2.4 Saídas.** Lead segmentado no Beehiiv; relatório SSG público. Destinos:
Beehiiv; navegador.

**2.5 Ações.** Manual: entrar na waitlist (visitante). Automática: SSG. Destrutiva:
não. **Ausentes:** checkout, cobrança, concessão de acesso (não existem).

**2.6 Ciclo de vida (LEAD PRO).** `interesse → waitlist(perfil) → [convite Pro —
não automatizado] → [conversão paga — N/I] → [acesso — N/I]`.

**2.7 Gestão.** Gerir: corte de valor grátis/Pro; preço; gateway. Quem: fundador
(decisão de negócio). Onde: decisão + Beehiiv/gateway. Automatizado: captura.
Supervisão: precificação. Revisão: ao abrir o Pro.

**2.8 Exceções.** Conteúdo Pro público sem gate → qualquer um lê
`/pro/2026-07` (indexável). Sem gateway → não há como cobrar.

**2.9 Permissões.** Visualizar relatório: **público hoje** (deveria ser Leitor Pro).
Criar waitlist: visitante. Publicar relatório: editor. Aprovar preço/gateway:
fundador. Excluir: administrador técnico.

**2.10 Indicadores.** Monetização: leads waitlist por perfil (Beehiiv);
conversão waitlist→pago (N/I). Receita: N/I. Meta inicial: definir preço/faixa
com a waitlist. Alerta: n/a até abrir.

**2.11 Estado atual.** **N/I (esqueleto).** Vitrine + captura de interesse; **sem
gateway, sem paywall, sem tier, sem gate**. Evidência: `package.json` só tem
`next/react/react-dom` (zero SDK de pagamento); relatório Pro público e
`illustrative`.

**2.12 Gaps.** Produto: toda a camada de acesso/cobrança. Decisão de negócio:
preço, ciclo, gateway (Stripe vs Beehiiv premium), o que fica atrás do gate.
Dependência do fundador: definição do modelo.

**2.13 Melhorias.** *Monetização:* decidir preço+gateway (impacto alto, esforço
médio, **depende de decisão de negócio**, risco médio, reversível; aceite: 1
assinatura paga de teste ponta-a-ponta). *Produto:* gate de conteúdo Pro por
tier do Beehiiv ou middleware. *Quick win:* `robots noindex` no relatório Pro até
haver gate.

---

### C05 — Contato comercial / anunciantes

**2.1 Identidade.** `app/anuncie/page.tsx` + `components/AnuncieForm.tsx` →
`app/api/contato/route.ts`. Subsistema: Site/B2B. Objetivo: captar lead de
patrocínio. Problema: abrir receita de publicidade. Valor negócio: receita B2B.
Valor usuário (anunciante): apresenta a marca ao público certo. Usuário principal:
anunciante; secundário: fundador/comercial.

**2.2 Função.** Valida e-mail, honeypot, rate-limit, e **apenas `console.log`** do
lead. **Não deve** perder o lead — mas hoje ele só existe em log. Fonte de
verdade: Vercel Logs (frágil). Não envia e-mail, não grava banco, não vai ao
Beehiiv.

**2.3 Entradas.** Obrigatório: `email`; opcionais `nome`, `empresa_nome`,
`mensagem`, honeypot `empresa`. Origem: form. Validações: e-mail, honeypot,
rate-limit. Editoriais: n/a.

**2.4 Saídas.** Linha `[contato]` em Vercel Logs; `{ok}`. Sem destino persistente.

**2.5 Ações.** Manual: enviar contato (anunciante). **Ausentes:** notificação,
CRM, e-mail. Desfazer: n/a (nada persistido). Auditoria: só log efêmero.

**2.6 Ciclo de vida.** `submit → validado → log → [triagem manual lendo logs]`.

**2.7 Gestão.** Gerir: leads B2B. Quem: comercial/fundador. Onde: **hoje só logs**
(deveria ser CRM/e-mail). Automatizado: nada. Supervisão: 100% manual.

**2.8 Exceções.** Lead perdido se ninguém lê o log → detectar: impossível hoje;
**deve** persistir. Rate-limit in-memory frágil. Sem provedor → modo log
(explícito no código).

**2.9 Permissões.** Visualizar leads: comercial/administrador técnico (via logs).
Criar: anunciante. Nenhum fluxo de aprovação.

**2.10 Indicadores.** Conversão: `anuncie_submit` (track, log). Receita: N/I. Meta:
plugar destino antes de dar tráfego. Alerta: n/a.

**2.11 Estado atual.** **MOCK (modo log).** Form e validação funcionam; lead só em
Vercel Logs. Evidência: comentário no `route.ts` "Trocar por envio real
(Resend/SMTP) quando houver credencial".

**2.12 Gaps.** Integração: sem sink (e-mail/CRM/tabela). Operação: triagem manual.
Dependência do fundador: leitura de logs.

**2.13 Melhorias.** *Correção obrigatória:* ligar `/api/contato` a e-mail
(Resend/SMTP) ou tabela (impacto alto p/ receita B2B, esforço baixo, risco baixo,
reversível; aceite: lead chega ao inbox/CRM). *Automação:* auto-resposta.

---

### C06 — Rastreamento de conversão (track)

**2.1 Identidade.** `lib/track.ts` (client) + `app/api/track/route.ts`. Subsistema:
Site. Objetivo: medir o funil. Problema: otimização às cegas. Valor negócio:
decisões de conversão baseadas em dado. Usuário principal: fundador/analista.

**2.2 Função.** `track(event)` via `sendBeacon` (fallback fetch keepalive), zero
cookie; server valida contra allowlist e **`console.log`**. Eventos:
`subscribe_submit/success/error`, `waitlist_submit/success`, `anuncie_submit`,
`cta_click`. **Não deve** usar cookie de terceiro nem PII além de source/perfil.
Fonte de verdade: Vercel Logs (efêmero).

**2.3 Entradas.** `event` (allowlist), `path`, `source`, `perfil`, `ref`, `at`.
Origem: client. Validações: allowlist (fora → 204 silencioso). Calculados: `at`.

**2.4 Saídas.** Linha `[track]` em Vercel Logs; 204. Sem agregação.

**2.5 Ações.** Automática: emissão no client. Nenhuma manual/destrutiva.

**2.6 Ciclo de vida.** `evento → beacon → allowlist → log → [drain — N/I]`.

**2.7 Gestão.** Gerir: taxa de conversão por origem. Quem: analista. Onde: hoje
logs (deveria: drain/analytics). Automatizado: coleta. Supervisão: definição de
eventos.

**2.8 Exceções.** Perda de eventos (cold start/log rotation) — sem storage.
Evento fora da allowlist → 204 (ignora). Nunca lança (try/catch silencioso).

**2.9 Permissões.** Visualizar: analista (via logs). Criar: sistema. Alterar
allowlist: administrador técnico.

**2.10 Indicadores.** Funil: `submit→success` por evento/origem — **não agregável
hoje**. Meta: instrumentar drain. Alerta: n/a.

**2.11 Estado atual.** **PARC.** Call sites corretos cobrindo o funil; sem
persistência/dashboard. Evidência: `route.ts` "Para agregação real, plugar um
drain de logs ou provedor depois".

**2.12 Gaps.** Integração: sem storage/agregação. Produto: nenhuma métrica lida
pelo painel.

**2.13 Melhorias.** *Quick win:* Vercel Analytics para pageviews + eventos custom
(impacto médio, esforço baixo). *Consolidação:* log drain → tabela Supabase
`events` para juntar com o admin.

---

### C07 — Pipeline Daily

**2.1 Identidade.** `scripts/{validate,render,render-web,render-system,publish,qa}.mjs`,
schema `content/edition.schema.json`, espelho TS `lib/editions.ts`. Subsistema:
Editorial. Objetivo: transformar 1 JSON por edição em e-mail/plain/web/QA/manifest
com gate inviolável. Problema: consistência e conformidade de marca em escala.
Valor negócio: produto diário confiável. Valor usuário: leitura de 5 min com a
conta feita. Usuário principal: Research Editor (Cowork) + editor humano.

**2.2 Função.** `render-system.mjs` orquestra: valida estrutura + regras
invioláveis (`validateEdition`), renderiza 3 saídas, reaudita artefatos
(`auditEmail`/`auditWeb`), grava `out/qa/NNNN.md` + `out/manifest/NNNN.json`
(sha256). Sai com **exit 1** em erro (gate de CI). **Não deve** publicar, enviar
e-mail, inventar dado, usar CMI/emoji/urgência. Fonte de verdade: **o JSON
versionado**. Consome: `/edicao/N` (web viva), publisher Beehiiv.

**2.3 Entradas.** Obrigatórios (schema): `number, date, weekday, publishTime,
readingMinutes, signal, deals, sources, disclaimer`. Cada deal: `conta, verdict,
tlScore, scoreBreakdown, vigencia, source`. Opcionais Beehiiv: `subject,
preheader, slug, tags, productType, scheduledAt`. Origem: Cowork (pesquisa+cálculo).
Validações: TL Score↔veredito coerente; breakdown soma 25/15/15/10/10/10/10/5;
vigência (ausente ⇒ `nao-confirmado`; vencida ⇒ erro); disclaimer íntegro; URLs;
sem CMI. **Campos observados** (pesquisa): preços, pontos, bônus, vigência.
**Calculados:** CPM/VPM/spread/TL Score. **Editoriais:** sinal, veredito, texto.
**Editáveis manualmente:** todo o JSON (autoria). **Imutáveis pós-publicação:** a
edição versionada.

**2.4 Saídas.** `out/email/NNNN.html`, `out/plain/NNNN.txt`, `out/web/NNNN.html`,
`out/qa/NNNN.md`, `out/manifest/NNNN.json`; índices `content/latest.json`/`index.json`
(via `publish`). Eventos: exit code (gate). Destinos: publisher Beehiiv; site.

**2.5 Ações.** Automática (CI): `validate→render→qa→publish` a cada push (nunca
envia e-mail). Manual: `npm run edition`; autoria do JSON. Destrutiva: sobrescrever
`out/` (regenerável). Reversível: sim (git). Confirmação: n/a. Auditoria: git +
`out/qa`.

**2.6 Ciclo de vida.** Ver §4.1. `autoria → validação → render → QA → publish(índices)
→ [aprovação humana + PR] → Beehiiv`.

**2.7 Gestão.** Gerir: qualidade e cadência editorial. Quem: editor + revisor +
Cowork. Onde: repo + CI. Não editável: regras invioláveis. Automatizado: gate de
QA. Supervisão: humana antes de publicar. Revisão: por edição. Retenção: git
(permanente).

**2.8 Exceções.** JSON inválido → exit 1 (bloqueia). Vigência vencida → erro. TL
Score incoerente → erro. Fonte http sem https → aviso. Todas apresentadas em
`out/qa/NNNN.md` e no exit code.

**2.9 Permissões.** Visualizar: qualquer. Criar/editar JSON: editor/Cowork.
Aprovar: revisor. Publicar: humano (§C10). Excluir: administrador técnico.
Auditar: git. Motivo da alteração: PR.

**2.10 Indicadores.** Qualidade: status APROVADA/REPROVADA por edição; nº de
findings. Cadência: edições/semana (hoje 0 reais). Velocidade: tempo autoria→QA.
Meta: 1/dia útil, 100% APROVADA. Alerta: QA REPROVADA no CI.

**2.11 Estado atual.** **OK− (modo ilustrativo).** Pipeline completo e wired (CI,
`edition`); mas 2 edições, ambas `illustrative:true`. Produto editorial ainda não
começou.

**2.12 Gaps.** Conteúdo: zero edições reais. Consolidação: renderer legado
concorrente (§4). Config: publisher só lê `out/email/` (limita Weekly/Pro).

**2.13 Melhorias.** *Nova capacidade:* produzir a 1ª edição real (impacto alto,
esforço editorial, risco de marca — usar `tl-source-audit`/`tl-qa`; aceite: QA
APROVADA + revisão humana). *Consolidação:* remover o renderer legado (§4).

---

### C08 — Pipeline Weekly

**2.1 Identidade.** `scripts/render-weekly.mjs`, schema `content/weekly.schema.json`.
Subsistema: Editorial. Objetivo: consolidação semanal (movimentos, radar de
janelas). Problema: visão de tendência que o Daily não dá. Valor negócio: retenção
e profundidade. Valor usuário: o que mudou na semana + próximas janelas. Usuário
principal: editor.

**2.2 Função.** Valida (validação própria, mais leve) e gera e-mail/plain/web.
Se o JSON não trouxer `radar`, puxa `digest.radarWeekly` de `content/forecast.json`
(acoplamento com o Forecast). **Não deve** repetir o Deal Desk do Daily. Fonte de
verdade: `content/weekly/AAAA-Wnn.json`.

**2.3 Entradas.** `signal, movements(novas/seguem/venceram), highlights[], watch[],
radar, sources, disclaimer`. Origem: editor + Forecast. Validações: disclaimer,
emoji, urgência, interno, radar, URLs. Sem `deals/tlScore` obrigatórios.

**2.4 Saídas.** `out/weekly/`, `out/weekly-plain/`, `out/weekly-web/`. Destino:
**nenhum publisher** hoje (isolado).

**2.5 Ações.** Manual: `npm run weekly`. Automática: nenhuma (não está no CI/edition).
Reversível: sim.

**2.6 Ciclo de vida.** `autoria → validate próprio → render (3 saídas) → [sem via
de publicação]`.

**2.7 Gestão.** Gerir: cadência semanal. Quem: editor. Onde: repo. Automatizado:
render. Supervisão: humana.

**2.8 Exceções.** Sem `radar` no JSON → fallback ao forecast; se `forecast.json`
ausente → radar vazio. Sem via de publicação → artefato preso.

**2.9 Permissões.** Como C07.

**2.10 Indicadores.** Cadência: 1/semana (hoje 0 reais). Cobertura de radar:
janelas com previsão.

**2.11 Estado atual.** **PARC / ISO.** Render funciona (1 arquivo `illustrative`);
**fora do `edition`, sem via Beehiiv** (publisher só lê `out/email/`); QA global
só audita se existir.

**2.12 Gaps.** Integração: sem via de publicação. Conteúdo: sem edição real.

**2.13 Melhorias.** *Consolidação:* ligar o publisher para ler `out/weekly/`
(impacto médio, esforço médio; aceite: rascunho weekly no Beehiiv).

---

### C09 — Relatório Pro (render)

**2.1 Identidade.** `scripts/pro.mjs` + `scripts/pro-vpm.mjs`, schema
`content/pro-report.schema.json`, espelho TS `lib/pro.ts`, SSG `/pro/[periodo]`.
Subsistema: Editorial. Objetivo: relatório executivo mensal (o produto pago).
Valor negócio: base do Pro. Valor usuário: benchmarks, matriz, alertas. Usuário
principal: assinante Pro (futuro).

**2.2 Função.** `validatePro` (regras próprias: benchmarks low/normal/high, alerts
insight/warning/danger, tom executivo) → e-mail `out/pro-email/` + SSG. `pro-vpm`
injeta `vpmObservado` (de `retail_valuations` Gen-1 ou mock) na matriz com
`--write`. **Não deve** prometer ganho; INTERNAL_RE próprio. Fonte de verdade:
`content/pro/AAAA-MM.json`.

**2.3 Entradas.** 10 seções obrigatórias: `summary, tlScorePeriod, benchmarks,
players, matrix, implications, alerts, watch, sources, disclaimer`. Origem: editor
+ `pro-vpm` (VPM). Validações: `validatePro` (INTERNAL_RE divergente do `lib.mjs`).

**2.4 Saídas.** `out/pro-email/PERIODID.html`, `out/qa/pro-*.md`, SSG
`/pro/[periodo]`. Destino: site (público hoje); **sem via Beehiiv**.

**2.5 Ações.** Manual: `npm run pro`, `pro:vpm`. Reversível: sim.

**2.6 Ciclo de vida.** `autoria → validatePro → e-mail+SSG → [sem publicação
Beehiiv]`.

**2.7 Gestão.** Gerir: cadência mensal + corte de valor. Quem: editor + fundador.
Supervisão: humana.

**2.8 Exceções.** `INTERNAL_RE` divergente do canônico → risco de gate inconsistente
(§4). VPM ausente → matriz sem `vpmObservado` (Gen-1 depende de banda `is_current`).

**2.9 Permissões.** Visualizar: público hoje (deveria Leitor Pro). Criar: editor.
Publicar: humano.

**2.10 Indicadores.** Cadência: 1/mês. Qualidade: `tlScorePeriod` (média +
distribuição). Cobertura: players com VPM observado.

**2.11 Estado atual.** **PARC / ISO.** Render + SSG OK (1 relatório `illustrative`);
sem publicação Beehiiv; VPM depende de Gen-1/mock.

**2.12 Gaps.** Integração: sem via de publicação; `INTERNAL_RE` duplicado
divergente (§4). Produto: sem gate (C04). Dados: VPM observado é seed (C13/C18).

**2.13 Melhorias.** *Consolidação:* unificar `INTERNAL_RE` no `lib.mjs` (impacto
médio, esforço baixo, risco baixo). *Nova capacidade:* via de publicação Pro.

---

### C10 — Publicação no Beehiiv

**2.1 Identidade.** `scripts/beehiiv-publish.mjs` (CLI), `.github/workflows/beehiiv.yml`
(workflow), ledger `content/beehiiv-status.json`; via admin em C11. Subsistema:
Editorial. Objetivo: enviar a peça renderizada ao Beehiiv com segurança. Problema:
publicar sem duplicar nem quebrar QA. Valor negócio: entrega do produto. Usuário
principal: editor/operador; secundário: CI.

**2.2 Função.** Lê `out/email/NNNN.html` + `out/plain`, roda **QA gate**
(`validateEdition` — exit 1 em erro), calcula `contentHash` (sha256), monta payload
Create Post, e chama `POST /v2/publications/{pub}/posts`. `draft` (default) idempotente;
`publish`/`schedule` bloqueiam duplicado salvo `--force`. **Não deve** enviar sem
QA nem duplicar. Regra de ouro: **nenhum e-mail sem ação humana**. Fonte de verdade:
`content/beehiiv-status.json` (arquivo) — divergente do ledger de banco (§4).

**2.3 Entradas.** Obrigatório: artefato renderizado + `BEEHIIV_API_KEY`/`PUBLICATION_ID`
(senão mock/dry-run). `subject→title`, `preheader→preview_text`, `slug→web_settings.slug`,
`tags→content_tags`, `scheduledAt`. Validações: QA gate + idempotência por hash.

**2.4 Saídas.** Post no Beehiiv (draft/confirmed); `content/beehiiv-status.json`
(post por slug, hash, status, mode, history append-only); `out/beehiiv/NNNN.{md,request.json,preview.html}`.
Eventos: exit code. Modes: `mock|dry-run|live`.

**2.5 Ações.** Manual: `--draft|--publish|--schedule|--test|--force|--dry-run`.
Via workflow: `workflow_dispatch` com `confirm=PUBLICAR` p/ publish/schedule +
`environment: beehiiv` (required reviewers) + `concurrency` serializado.
**Destrutiva/irreversível-ish:** `publish` envia e-mail real (não desfaz envio).
Confirmação: obrigatória p/ envio. Justificativa: `--force` consciente. Permissão
especial: secrets + reviewer. Como desfazer: não há "unsend"; só corrigir na
próxima. Auditoria: `history[]` no ledger + artefato do workflow.

**2.6 Ciclo de vida.** `renderizado → QA gate → draft → (publish|schedule) →
published/scheduled`; erro/mock/dry-run como estados paralelos.

**2.7 Gestão.** Gerir: o que vai ao ar e quando. Quem: editor + revisor (reviewer
do Environment). Onde: workflow/CLI. Não editável: conteúdo (publica o já
renderizado). Automatizado: gate/idempotência. Supervisão: **sempre humana** para
envio. Retenção: ledger versionado.

**2.8 Exceções.** Hash idêntico já publicado → bloqueia (exit 1). Chave sem
`posts:write` → erro API. Sem secret → mock. **Via MCP fora do gate** → publicação
sem idempotência/QA (§4). Publicação admin sem `edition_path` → publica
`latest.json`, não a edição do banco (§4).

**2.9 Permissões.** Visualizar ledger: editor/administrador técnico. Publicar:
**apenas com reviewer + confirmação** (papel: aprovador/editor-chefe). Reprocessar:
`--force` (administrador técnico). Auditar: `history[]`.

**2.10 Indicadores.** Confiabilidade: envios duplicados (meta 0 — trava atual).
Cobertura: edições publicadas/total. Falha: erros de API. Meta: 100% via gate.
Alerta: publicação sem `provenance` de gate.

**2.11 Estado atual.** **OK− / DUP.** CLI mock-first com idempotência+QA;
workflow gated; **o único draft real (`daily-0028`) foi criado via MCP
(`provenance:beehiiv-mcp`, `mode:live`), fora do gate**. Nenhuma edição
efetivamente **enviada** (só draft).

**2.12 Gaps.** Governança: MCP fora do gate (§4). Integração: banco↔arquivo
divergentes; publisher não lê Weekly/Pro. Config: `BEEHIIV_*`/`GH_DISPATCH_TOKEN`
ausentes.

**2.13 Melhorias.** *Redução de risco:* padronizar uma via canônica (CLI/workflow)
e registrar publicações MCP no ledger (impacto alto, esforço médio). *Correção:*
passar `edition_path` no dispatch do admin (aceite: publica a edição do banco, não
`latest.json`).

---

### C11 — Digests (admin)

**2.1 Identidade.** `app/admin/(panel)/digests/*`, `lib/admin-digests.ts`,
`lib/admin-digest-ops.ts`, migração `0007_digest_control.sql`. Subsistema:
Editorial (operação). Objetivo: curar, dar QA, aprovar, publicar e medir edições
a partir do banco. Problema: operação assistida do ciclo de vida editorial. Valor
negócio: throughput editorial controlado. Usuário principal: operador/editor.

**2.2 Função.** Entidades: `editions` (ledger), `edition_drafts` (curadoria),
`edition_qa_reports`, `edition_stats`, `edition_events` (trilha). A UI cura
(escolhe campanhas vigentes por TL Score), roda QA determinístico, aprova,
materializa no ledger, dispara o `beehiiv.yml` e busca métricas. **Não deve**
publicar sem gates. Fonte de verdade: banco (paralela ao arquivo — §4).

**2.3 Entradas.** `edition_drafts` (produto, data, sinal, destaque, assunto,
`deal_ids` de `campaigns`). Origem: operador + `getCandidateCampaigns`. Validações:
`runQa` (urgência/promessa/emoji/completude) — **mais fraco** que `validateEdition`
(ignora disclaimer/vigência/TL Score). Editáveis: subject/destaque/notes/deals.
Calculados: `gate_validate=qa.passed`, `gate_audit=!qa.blocking`, `quality_score`.

**2.4 Saídas.** `editions.json` compacto; `edition_qa_reports`; dispatch do
workflow; `edition_stats` (opens/clicks). Eventos: `edition_events`
(generated/curated/qa/approved/scheduled/published/stats). Destino: Beehiiv (via
workflow) + métricas.

**2.5 Ações.** Manuais: criar/salvar rascunho, **Rodar QA**, **Aprovar** (recusa
se `blocking`), **Materializar**, **Operar** (draft/publish/schedule — `dispatchGuarded`
recusa se gates não passam), **Atualizar métricas**. Destrutiva: publish (via
workflow). Confirmação: `confirm=PUBLICAR`. Auditoria: `edition_events` (a **única**
trilha real de operação no admin).

**2.6 Ciclo de vida.** `edition_drafts: draft → ready → approved → published`;
`editions.status: draft (+curated/gates/score) → scheduled_at/published_at`.
"No Beehiiv" = `!!beehiiv_post_id` (status pode ficar `draft` mesmo com post).

**2.7 Gestão.** Gerir: pipeline de edições. Quem: operador + editor + aprovador.
Onde: `/admin/digests`. Não editável: conteúdo já publicado. Automatizado: QA +
dispatch. Supervisão: aprovação humana. Retenção: banco.

**2.8 Exceções.** Gate fraco (QA do admin ≠ validate do pipeline) → verde no admin
não garante conformidade (§4). Sem `GH_DISPATCH_TOKEN`/`BEEHIIV_*` → operar retorna
erro claro. Dispatch sem `edition_path` → publica `latest.json` (§4).

**2.9 Permissões.** Visualizar: operador/editor. Criar rascunho: operador. Aprovar:
aprovador/editor-chefe. Publicar: aprovador (com confirmação). Reprocessar QA:
operador. Auditar: `edition_events` (mas **sem identidade de usuário** — sem
`user_id`).

**2.10 Indicadores.** Cobertura: `summarizeByProduct` (edições, gatesOk/total,
published/total, avgQuality, lastDate). Qualidade: `quality_score`. Tempo de
curadoria: derivável de `edition_events`. Desempenho: `edition_stats`
(open/click rate) — loop de mensuração existe só neste lado.

**2.11 Estado atual.** **OK− (depende de Supabase + secrets).** CRUD/QA/dispatch/stats
implementados; migração aplicada. Limitações: QA fraco; sem identidade na trilha;
banco↔arquivo divergentes.

**2.12 Gaps.** Governança: QA do ledger deriva do gate fraco, não do `validateEdition`.
Segurança: trilha sem `user_id`. Integração: divergência banco↔arquivo.

**2.13 Melhorias.** *Correção obrigatória:* fazer `gate_validate`/`gate_audit`
derivarem do `validateEdition` real (impacto alto, esforço médio; aceite: gate
verde ⇒ disclaimer/vigência/TL Score checados). *Segurança:* gravar operador em
`edition_events` (ver C29).

---

### C12 — Skills de agentes (`tl-*`) e Cowork Research Editor

**2.1 Identidade.** `.claude/skills/{tl-digest-template,tl-qa,tl-source-audit}`,
`COWORK.md`. Subsistema: Editorial (governança de agente). Objetivo: padronizar
pesquisa→validação→render→QA por IA sob regras invioláveis. Problema: consistência
e independência editorial. Valor negócio: escala editorial confiável. Usuário
principal: Cowork (Research Editor) + operador.

**2.2 Função.** `COWORK.md` define o Cowork como Research Editor: pesquisa, valida,
calcula, classifica e entrega **apenas JSON validado** (`npm run validate` = 0
erros); **não publica, não envia e-mail, não copia fonte**. `tl-source-audit` =
gate de fonte (Grupo 1 ⇒ REPROVADO); `tl-qa` = gate global; `tl-digest-template` =
render das 3 saídas. **Não devem** executar nada por si — orientam e apontam para
os `npm run`. Fonte de verdade: as skills + `CLAUDE.md`.

**2.3 Entradas.** Fontes 1–2 (oficiais) com URL; vigência ISO; fórmulas públicas
(CPM/VPM/spread). Validações: schema + regras invioláveis. Editoriais: todo o JSON.

**2.4 Saídas.** JSON editorial validado (handoff no passo 1); parecer de auditoria;
artefatos de render. Destino: PR + publicação humana.

**2.5 Ações.** Manuais (conceituais): `/daily-research`, auditoria, render.
Automáticas: nenhuma. Destrutiva: não. Aprovação: humana (passo 4). O Cowork
**nunca avança além do passo 1**.

**2.6 Ciclo de vida.** `pesquisa → validação → cálculo → JSON → auditoria (tl-source-audit)
→ render (tl-digest) → QA (tl-qa) → PR + Beehiiv (humano)`.

**2.7 Gestão.** Gerir: aderência às regras. Quem: editor-chefe. Onde: skills +
`CLAUDE.md`. Não editável: regras invioláveis. Supervisão: humana (publicação).

**2.8 Exceções.** Fonte Grupo 1 → REPROVADO. Regra inviolável quebrada → `tl-qa`
bloqueia. Sem vigência → `nao-confirmado`.

**2.9 Permissões.** Executar: Cowork/operador. Aprovar/publicar: humano. As skills
não têm privilégio de escrita em produção.

**2.10 Indicadores.** Qualidade: taxa de reprovação em `tl-source-audit`/`tl-qa`.
Retrabalho: edições que voltam da auditoria.

**2.11 Estado atual.** **OK (guia).** Skills e `COWORK.md` completos e coerentes;
são normativos, não executáveis. Alinhados ao pipeline C07/C10.

**2.12 Gaps.** Governança: regras invioláveis vivem em ≥4 lugares (skills,
`CLAUDE.md`, `scripts/lib.mjs`, `admin-digest-ops.runQa`) com uma divergência real
(QA fraco do admin — §4). Documentação: hierarquia de verdade aponta a arquivos
inexistentes (nota de fontes).

**2.13 Melhorias.** *Consolidação:* uma fonte única das regras invioláveis
(código) reusada pelo admin e pelos scripts (impacto médio, esforço médio, risco
baixo; aceite: QA do admin = `validateEdition`).

---

### C13 — Radar de VPM (Gen-2 `shopping_*`)

**2.1 Identidade.** `lib/admin-shopping.ts`, `app/admin/(panel)/shopping-vpm/*`,
`scripts/shopping/*`, migrações `0002/0003/0006`, `docs/SHOPPING-VPM.md`.
Subsistema: Dados. Objetivo: comparar o valor econômico (R$/1.000 pts) de resgate
de produtos entre LATAM/Azul/Smiles. Problema: dizer onde o ponto vale mais, com
método. Valor negócio: diferencial editorial + insumo do Pro. Valor usuário: sabe
onde resgatar melhor. Usuário principal: analista/editor.

**2.2 Função.** Cockpit lê 6 tabelas/views via `loadShopping`: resumo por programa,
comparativo por SKU, benchmarks por categoria, catálogo, lacunas, execuções. VPM
sempre determinístico (`reference_price/points×1000`); **LLM nunca toca a conta**.
`INTERNAL_RE` bloqueia CMI. **Não deve** estimar preço por pontos nem inventar
banda. Fonte de verdade: `shopping_*` no Supabase.

**2.3 Entradas.** `shopping_observations` (preço/pontos por programa). Origem:
coleta (C15) / seed. Validações: `match_confidence`, cobertura ≥ `expected_program_coverage`.
Observados: preço, pontos (standard/elite/hybrid), disponibilidade. Calculados:
`vpm_*`, benchmarks. Imutável: observações (append-only).

**2.4 Saídas.** `shopping_metrics`, `shopping_sku_comparisons`,
`shopping_category_benchmarks`. Destinos: cockpit; (futuro) Pro/Daily `shoppingWatch`.

**2.5 Ações.** Manual: **Recalcular** (RPC), **Coletar agora**/**Diagnóstico**
(dispara workflow). Automática: cron 2×/dia. Destrutiva: recompute é delete+insert
por `reference_date` (idempotente). Confirmação: não. Auditoria: `shopping_collection_runs`.

**2.6 Ciclo de vida.** Ver máquinas de estado §4 (fonte e coleta).

**2.7 Gestão.** Gerir: catálogo, fontes, afinação de adapters. Quem: operador de
dados. Onde: `/admin/shopping-vpm` + seed/SQL. Não editável: observações passadas.
Automatizado: recompute. Supervisão: validação de fonte. Revisão: por rodada.

**2.8 Exceções.** Amostra <3 → banda `n/c` (protege o indicador). Coleta sem
preço/pontos → lacuna, fonte volta a `pending_validation`. Ver C15 (bloqueio).

**2.9 Permissões.** Visualizar: analista/editor. Coletar/recalcular: operador de
dados. Aprovar SKU: operador de dados. Excluir: administrador técnico.

**2.10 Indicadores.** Cobertura: % SKUs `complete` vs `partial`; lacunas. Frescor:
`captured_at` recente; runs `success`. Qualidade: `sample_quality` por categoria.
Meta: ≥3 programas por SKU. Alerta: 0 runs `success` (hoje o caso).

**2.11 Estado atual.** **OK− / BLOQ.** UI, cálculo e seed funcionam; a coleta live
está bloqueada (§C15) → **dados exibidos = seed histórico de 2026-07-14**, não
coleta viva.

**2.12 Gaps.** Dados: sem coleta viva. Operação: view `shopping_sku_latest_v` **não
versionada** (só no banco). Integração: `shoppingWatch` editorial é mock,
desacoplado do banco.

**2.13 Melhorias.** *Fundação:* versionar a view + afinar adapters (impacto alto,
esforço alto — ver C15). *Nova capacidade:* pipeline banco→`shoppingWatch` da
edição.

---

### C14 — Catálogo de SKUs

**2.1 Identidade.** `shopping_products` + `shopping_product_sources` (Gen-2);
`scripts/shopping/seed.mjs`, `supabase/seeds/shopping_seed.sql`. Subsistema: Dados.
Objetivo: definir os produtos canônicos e suas URLs por programa. Problema: base
para a coleta e o matching. Valor negócio: qualidade da comparação. Usuário
principal: operador de dados.

**2.2 Função.** Fonte de verdade da coleta: `canonical_key` (imutável, unique),
marca/modelo/mpn/ean, `match_confidence`, `expected_program_coverage`, `status`,
`approved`; fontes com `source_url_type`, `extraction_method`, `requires_login/browser`,
`source_status`. **Semeado por SQL idempotente** (24 produtos, ~41 fontes). Modo
REST do seed **não implementado**. Fonte de verdade: banco.

**2.3 Entradas.** Curadoria manual (seed). Origem: humano. Validações: unique
`canonical_key`, FK `program_code`. Observados: nenhum (curado). Editoriais: todos.
Imutável: `canonical_key`.

**2.4 Saídas.** Linhas de catálogo/fontes. Destino: coleta (C15).

**2.5 Ações.** Manual: seed SQL (adicionar SKU/fonte). **Sem UI de edição** no
cockpit (só leitura). Destrutiva: alterar catálogo via SQL. Auditoria: nenhuma.

**2.6 Ciclo de vida (produto).** `status: active | paused | discontinued | review`
(default `active`) — **sem writer de transição no código** (efetivamente imutável
pós-seed).

**2.7 Gestão.** Gerir: quais SKUs entram. Quem: operador de dados. Onde: SQL/seed.
Não editável: `canonical_key`. Supervisão: curadoria. Revisão: ao expandir a cesta.

**2.8 Exceções.** Fonte só `category` (não valida SKU) → vira lacuna. GTIN/EAN
ausente → depende de match manual.

**2.9 Permissões.** Visualizar: analista. Criar/editar: operador de dados (via SQL).
Aprovar: operador. Excluir: administrador técnico.

**2.10 Indicadores.** Cobertura: fontes `product` vs `category`; SKUs por categoria
(banda fecha com ≥3). Qualidade: `match_confidence` distribuição.

**2.11 Estado atual.** **OK−.** Catálogo curado por seed, coerente; sem tela de
edição (só SQL). Gen-1 `sku_catalog` é o legado paralelo (C18).

**2.12 Gaps.** Operação: gestão de catálogo só por SQL (sem UI). Duplicação: Gen-1
`sku_catalog` órfão (C18/§4).

**2.13 Melhorias.** *Operacional:* UI de CRUD de SKU/fonte no cockpit (impacto
médio, esforço médio; aceite: adicionar SKU sem SQL). *Consolidação:* aposentar
`sku_catalog` (§4).

---

### C15 — Coleta de preços e pontos

**2.1 Identidade.** `scripts/shopping/collect.mjs` + `adapters.mjs` (Gen-2, Playwright
headless), `.github/workflows/shopping-collect.yml`. Subsistema: Dados. Objetivo:
observar preço e pontos nas páginas públicas dos programas. Problema: obter o dado
que alimenta o VPM. Valor negócio: dado próprio e auditável. Usuário principal:
sistema automatizado; operador de dados dispara/afina.

**2.2 Função.** Cria run, busca fontes ativas (`limit 40`), enfileira
(`shopping_collection_queue` com claim/retry/dead_letter), renderiza headless com
flags anti-bot, extrai via adapter (JSON-LD + heurística), **insere observação nova
(nunca sobrescreve)**, e chama `shopping_recompute`. Modo `--diagnose` salva
HTML+screenshot+candidatos sem escrever. **Não deve** inventar número (nulls quando
não confirma). Fonte de verdade: `shopping_observations`.

**2.3 Entradas.** Fontes do catálogo (C14) + `SUPABASE_SERVICE_KEY`. Dep. externas:
marketplaces (SPA/anti-bot/login), Playwright/Chromium. Validações: preço+pontos
presentes → `active`; senão `pending_validation`; falhas → `next_retry_at +1h`,
`consecutive_failures`.

**2.4 Saídas.** `shopping_observations` (`extraction_method='browser_headless'`,
`adapter_version='headless_v3'`), `queue`, `runs`, `product_sources`. Artefato
`shopping-diagnostics` (14d). Destino: recompute (C17).

**2.5 Ações.** Automática: cron 11h/23h UTC. Manual: **Coletar agora**/**Diagnóstico**
(dispara workflow via `GH_DISPATCH_TOKEN`). Destrutiva: não (append). Reversível:
observação é imutável; recompute recalcula. Auditoria: `runs`/`queue`.

**2.6 Ciclo de vida (coleta).** `run: running → success|partial|failed`;
`queue item: pending → running → success|error(→retry)`; `source: pending_validation
↔ active → broken (consecutive_failures)`.

**2.7 Gestão.** Gerir: afinação de adapter por portal; secrets. Quem: operador de
dados. Onde: Actions + `adapters.mjs`. Automatizado: coleta. Supervisão: validação
de extração (diagnóstico). Revisão: por portal quando quebra.

**2.8 Exceções.** SPA/login → extração nula (`pending_validation`). Azul anti-bot
(`ERR_HTTP2_PROTOCOL_ERROR`). Timeout → retry +1h; N falhas → `broken`. Sem
`SUPABASE_SERVICE_KEY` → mock (não persiste).

**2.9 Permissões.** Disparar: operador de dados. Afinar adapter: administrador
técnico. Aprovar dado: operador.

**2.10 Indicadores.** Confiabilidade: runs `success`/total (hoje ~0). Cobertura:
fontes `active` vs `pending_validation` vs `broken`. Frescor: `captured_at`. Meta:
1ª rodada live com ≥1 programa por SKU. Alerta: `dead_letter` crescente.

**2.11 Estado atual.** **BLOQ (integração externa).** Código e workflow prontos;
adapters `headless_v3` **não afinados**; marketplaces SPA/login. "Nenhuma rodada
ainda" no cockpit → dados = seed. Este é o gargalo do subsistema de dados.

**2.12 Gaps.** Integração externa (gargalo real): SPA/login/anti-bot; adapters não
calibrados. Config: `SUPABASE_SERVICE_KEY`+`GH_DISPATCH_TOKEN` + secrets do Actions.
Decisão de negócio: **usar login nos marketplaces?** (necessário para pontos em
alguns portais).

**2.13 Melhorias.** *Fundação/desbloqueio:* afinar adapters com o modo diagnóstico,
portal a portal (impacto alto, esforço alto, risco médio, reversível; aceite: ≥1
programa retorna preço+pontos reais). *Decisão:* política de login (§8).

---

### C16 — Matching de produtos

**2.1 Identidade.** `canonical_key` curado; `scripts/collect/llm.mjs` (`sameProduct`,
`heuristicSame`); campo `match_confidence`. Subsistema: Dados. Objetivo: garantir
que "o mesmo produto" seja comparado entre programas. Problema: comparabilidade.
Valor negócio: validade do VPM. Usuário principal: operador de dados.

**2.2 Função.** Hoje o vínculo produto↔fonte é **curadoria manual** (canonical_key +
URLs no seed). Existe biblioteca de match automático — LLM `sameProduct`, Jaccard
`heuristicSame` (threshold 0.6), GTIN exato (Gen-1) — mas **nenhum coletor a
invoca**; Gen-2 grava `match_confidence` fixo `"medium"` na coleta. **Não deve**
comparar SKUs distintos. Fonte de verdade: `canonical_key`.

**2.3 Entradas.** Títulos observados + catálogo. Validações: `match_confidence in
(low,rejected)` exclui da comparabilidade (`vpm.mjs` + RPC). Calculado:
`match_confidence` (herdado do catálogo, não computado na coleta).

**2.4 Saídas.** `match_confidence`, `comparison_reason='low_match_confidence'`.
Destino: comparações/benchmarks (C17).

**2.5 Ações.** Manual: curar `canonical_key`/fontes. **Automáticas ausentes na
prática** (código morto). Auditoria: nenhuma.

**2.6 Ciclo de vida.** `curado (high) → coleta herda medium → (rejected exclui)`.

**2.7 Gestão.** Gerir: qualidade do match. Quem: operador de dados. Onde: seed.
Automatizado: nada hoje. Supervisão: humana.

**2.8 Exceções.** Título ambíguo → deveria cair no LLM/Jaccard (não roda) → risco
de comparar variantes. EAN/MPN presentes mas **sem matching automático por EAN**.

**2.9 Permissões.** Curar: operador de dados. Ajustar limiar: administrador técnico.

**2.10 Indicadores.** Precisão: % observações `rejected`/`low`. Cobertura: SKUs com
match `high`. Meta: matching automático por EAN quando houver coleta.

**2.11 Estado atual.** **PARC / N/I na prática.** Central conceitualmente, mas é
curadoria manual; `sameProduct`/Jaccard/EAN não invocados (código reservado).

**2.12 Gaps.** Código: match automático definido e não chamado; sem match por EAN
apesar de campos existirem. Dados: `match_confidence` não reflete match real.

**2.13 Melhorias.** *Automação:* ligar match por EAN/MPN na coleta + `sameProduct`
como fallback (impacto alto p/ escala, esforço médio, depende de C15; aceite:
observação recebe `match_confidence` computado, não fixo).

---

### C17 — Benchmarks e bandas estatísticas

**2.1 Identidade.** RPC `shopping_recompute` (`0003`), espelho JS
`scripts/shopping/vpm.mjs`; Gen-1 `scripts/collect/stats.mjs`. Subsistema: Dados.
Objetivo: transformar observações em métricas, comparações e benchmarks (P25/med/P75).
Problema: banda estatística confiável por categoria. Valor negócio: régua de valor.
Usuário principal: analista/editor.

**2.2 Função.** RPC `security definer` em 3 passos: métricas 1:1, comparações por
SKU (`complete|partial`, `quality_status`), benchmarks por categoria×programa
(percentis, `coverage_rate`, `sample_quality`). Espelho JS validado 5/5. **Gen-1**
usa MAD (remove outliers) → `retail_valuations` (piso/mediana/teto). **Não deve**
calcular sem amostra mínima. Fonte de verdade: `shopping_*` (Gen-2) /
`retail_valuations` (Gen-1).

**2.3 Entradas.** Observações válidas. Validações: n≥3 p/ banda; `match_confidence`
exclui low/rejected. Calculados: todos os `vpm_*`, percentis, quality.

**2.4 Saídas.** `shopping_metrics/comparisons/benchmarks` (Gen-2);
`retail_valuations` (Gen-1). Destino: cockpit; Pro (`pro-vpm`).

**2.5 Ações.** Manual: **Recalcular**. Automática: pós-coleta. Destrutiva: delete+insert
por `reference_date` (idempotente). Reversível: recomputável.

**2.6 Ciclo de vida.** `observações → recompute → métricas/comparações/benchmarks
(por reference_date)`.

**2.7 Gestão.** Gerir: método estatístico. Quem: operador de dados/administrador
técnico. Não editável: fórmula (versionada `shopping_vpm_v1`). Supervisão: revisão
de método.

**2.8 Exceções.** n<3 → `n/c`/insufficient. **Divergência de método:** Gen-1 MAD
(remove) vs Gen-2 IQR (marca, mas a RPC **não aplica** — `outlier_status` sempre
`not_evaluated`). Sem reconciliação entre bandas Gen-1 e benchmarks Gen-2.

**2.9 Permissões.** Recalcular: operador de dados. Alterar método: administrador
técnico (via migração).

**2.10 Indicadores.** Qualidade: `sample_quality` (no_data→robust); `coverage_rate`.
Cobertura: categorias com banda `confirmed` (n≥3).

**2.11 Estado atual.** **OK−.** RPC + espelho funcionam; **sem dado vivo para
alimentar** (depende de C15). Outlier IQR não aplicado na RPC.

**2.12 Gaps.** Dados: sem coleta viva. Código: `outlier_status` nunca avaliado
(IQR só no JS). Consolidação: dois métodos estatísticos (MAD vs IQR) sem
reconciliação (§4).

**2.13 Melhorias.** *Consolidação:* aplicar IQR na RPC ou decidir método único
(impacto médio, esforço baixo). *Fundação:* alimentar com coleta viva (C15).

---

### C18 — Coletor VPM Gen-1 (`sku_*`) [legado]

**2.1 Identidade.** `scripts/collect-skus.mjs` + `scripts/collect/*`, migração
`0001_retail_vpm.sql`, `.github/workflows/collect.yml`, rotas `app/admin/sku|collect/route.ts`,
`docs/RADAR-VPM.md`. Subsistema: Dados (legado). Objetivo: 1ª geração do Radar
(não-aéreo). Valor: hoje só alimenta o relatório Pro via `pro-vpm`. Usuário
principal: sistema; operador (Basic Auth).

**2.2 Função.** Lê `content/sku-basket.json` (não o catálogo do banco!), coleta por
SKU×player (adapters `collect/*`), calcula banda MAD, persiste `sku_observations` +
`retail_valuations` (aposenta banda anterior `is_current=false`) + `runs`
(`kind='skus'`). **Não deve** ser a via canônica (a migração 0002 o declara a
aposentar). Fonte de verdade: `retail_valuations` (só p/ Pro).

**2.3 Entradas.** `content/sku-basket.json` (7 SKUs exemplo) + secrets. Validações:
`INTERNAL_RE`, missing source, recomputação. Observados: preço/pontos. Calculados:
banda (MAD).

**2.4 Saídas.** `sku_observations` (**sem leitor** no código), `retail_valuations`
(lido por `pro-vpm`), `runs`. Mock: `out/collect/latest.json`.

**2.5 Ações.** Automática: cron 09h UTC (`collect.yml`). Manual: `POST /admin/collect`
(dispara workflow, Basic Auth), `POST /admin/sku` (CRUD catálogo, Basic Auth) —
**ambos sem UI que os chame**. Destrutiva: aposenta banda (soft).

**2.6 Ciclo de vida (SKU Gen-1).** `pending → approved | rejected`
(`sku/route.ts`); catálogo do banco **desconectado** do coletor (que lê o basket).

**2.7 Gestão.** Gerir: aposentadoria. Quem: administrador técnico. Onde: repo/SQL.

**2.8 Exceções.** `sku_observations` órfã de leitura. Catálogo do banco não alimenta
o coletor (descontinuidade). Rotas Basic Auth vivas e isentas do gate de cookie =
**superfície de ataque órfã**.

**2.9 Permissões.** Operar: Basic Auth (`ADMIN_USER`/`PASSWORD`). Visualizar: n/a
(sem UI).

**2.10 Indicadores.** Bandas `confirmed` (n≥3) que chegam ao Pro. (Legado — não
priorizar métricas novas.)

**2.11 Estado atual.** **LEG / DUP.** Produz dados sem tela própria; só alimenta o
Pro; UI órfã; rotas Basic Auth sem consumidor. A migração 0002 já o marca a
aposentar.

**2.12 Gaps.** Duplicação com Gen-2 (§4). Segurança: rotas Basic Auth órfãs; anon
key hardcoded em `lib/admin.ts`. Dados: `sku_observations` sem leitor; catálogo
desconectado do coletor.

**2.13 Melhorias.** *Consolidação/redução de risco:* migrar o consumo do Pro para
Gen-2 e **remover** rotas/tabelas Gen-1 (impacto alto p/ segurança e clareza,
esforço médio, risco médio — precisa Pro apontar para `shopping_*`; aceite: Pro lê
Gen-2, rotas Gen-1 removidas).

---

### C19 — Campanhas

**2.1 Identidade.** `app/admin/(panel)/campanhas/*`, tipo `Campaign`
(`admin-db.ts`), `needsReview` (`admin-series.ts`), writer = edge function
`supabase/functions/campaigns`. Subsistema: Motor editorial. Objetivo: manter o
**ledger** de campanhas de loyalty (rota, %, vigência, veredito, TL Score).
Problema: base factual do produto e do forecast. Valor negócio: matéria-prima do
editorial. Usuário principal: analista/editor (revisão de veredito).

**2.2 Função.** Extração LLM (edge fn) faz upsert por `id`
(`origem-destino-tipo-vigenciafim`), grava campos observados + `status` derivado de
vigência + `notes` com `[confianca:alta|baixa]`. A UI filtra (status/origem/tipo/revisão),
sobe revisão ao topo, e permite **edição inline só de `verdict` e `tl_score`**.
**Não deve** deixar editar rota/%/CPM manualmente. Fonte de verdade: `campaigns`.

**2.3 Entradas.** Escrita pela edge fn: `origem, destino, tipo, percentual, paridade,
vigencia_*, source_*, first/last_seen, observed_at, origin='auto', notes, status,
discard_reason`. UI: `verdict` (contra `VERDICTS`), `tl_score` (0–100). Validações:
veredito fora da lista ignorado; score clampado. **Observados:** rota/%/vigência.
**Calculados:** `status` (de vigência), `cpm`. **Editoriais/editáveis:** `verdict`,
`tl_score`. **Imutáveis pela UI:** todo o resto.

**2.4 Saídas.** `PATCH campaigns {verdict, tl_score}`; leitura para forecast/predict/
observability/digests. Destino: inteligência + curadoria.

**2.5 Ações.** Manual individual: editar veredito/score (analista) — **sem confirmação,
sem justificativa, sem auditoria**. Automática: extração (edge fn). Destrutiva: não
(update de 2 campos). Reversível: sim (mas sem histórico do valor anterior).

**2.6 Ciclo de vida.** Ver §4. Writers versionados emitem só `continua|vence-72h|vencida`;
`vence-hoje|nova|descartada` aparecem na UI/métricas mas **sem writer versionado**
(transição diária externa/não versionada). `verdict`/`tl_score` mudam só por humano.

**2.7 Gestão.** Gerir: veredito/score (curadoria). Quem: analista/editor. Onde:
`/admin/campanhas`. Não editável: dados observados. Automatizado: extração/status.
Supervisão: humana no veredito. Revisão: diária (fila `needsReview`). Retenção:
banco (ledger permanente).

**2.8 Exceções.** `[confianca:baixa]` → `needsReview` (fila amarela, topo). Vigência
vencida → `discard_reason`. Extração contraditória → revisão humana. **Alteração
manual incorreta** → sem rollback (não há valor anterior). Duplicidade: upsert por
`id` estável.

**2.9 Permissões.** Visualizar: analista/editor. Editar veredito/score:
analista/revisor. Aprovar: revisor. Excluir/reprocessar: administrador técnico.
Auditar: **hoje nada** — `campaigns` não tem `updated_by`; recomendável exigir
motivo em mudança de veredito.

**2.10 Indicadores.** Retrabalho: campanhas `needsReview` (hoje na `AttentionStrip`).
Cobertura: campanhas com veredito/score. Qualidade: % `nao-confirmado`. Meta: fila
de revisão zerada no dia. Alerta: `venceHoje`/`vence72` (dashboard).

**2.11 Estado atual.** **OK−.** CRUD editorial funciona; **parte da máquina de
estados de status é externa/não versionada** (transição diária e backfill fora do
repo). Sem auditoria de edição.

**2.12 Gaps.** Código/arquitetura: writers de `vence-hoje/nova/descartada` não
versionados. Segurança: sem auditoria de mudança de veredito. Dados: `series_key`
rica (mercado/segmento/mecânica) inexistente (limita Predict — C23).

**2.13 Melhorias.** *Redução de risco:* trilha de auditoria de veredito
(quem/quando/antes→depois + motivo) (impacto alto p/ credibilidade, esforço médio;
ver C29). *Fundação:* versionar a RPC de transição de status (§4/§C24).

---

### C20 — Notícias

**2.1 Identidade.** `app/admin/(panel)/noticias/*`, `getNews`, tabela `news_raw`,
edge fn `campaigns` (extrator). Subsistema: Motor editorial. Objetivo: coletar
notícias (ingest) e extrair campanhas (extract). Problema: alimentar o ledger.
Valor negócio: descoberta de oportunidades. Usuário principal: operador.

**2.2 Função.** Lista amostra das 500 mais recentes (renderiza 200); totais reais
via RPC `admin_metrics`. Status: `erro|processada|pendente`. Ação: **reprocessar**
(reseta `processed/error` + `runNow('campaigns')`), **Rodar extração** (`runNow('campaigns')`).
**Não deve** editar conteúdo da notícia. Fonte de verdade: `news_raw`.

**2.3 Entradas.** `news_raw{source,title,url,published_at,fetched_at,processed,
campaigns_extracted,model_used,error}`. Origem: ingest (cron) + edge fn. Validações:
allowlist de status. **Observados/calculados:** todos (coleta/LLM). **Editáveis:**
só reprocessar (nenhum campo).

**2.4 Saídas.** Reenfileira notícia; dispara extrator. Destino: `campaigns` (C19).

**2.5 Ações.** Manual: **Reprocessar** (por linha, sem confirmação), **Rodar
extração**. Automática: ingest/extract (cron). Destrutiva: não. Reversível:
reprocessar de novo.

**2.6 Ciclo de vida.** `pendente → processada | erro`; reprocessar volta a `pendente`.
(RFC-009 propõe estados ricos `pending/processing/processed_no_campaign/…` — não
implementados.)

**2.7 Gestão.** Gerir: fila de extração e erros. Quem: operador. Onde: `/admin/noticias`.
Automatizado: ingest/extract. Supervisão: erros. Revisão: diária. Retenção: banco.

**2.8 Exceções.** `error` setado → status erro (fila). Fonte indisponível → ingest
falha (cron). Extração falha → `error`. Duplicidade: upsert por URL/id.

**2.9 Permissões.** Visualizar: operador. Reprocessar: operador. Alterar extrator:
administrador técnico.

**2.10 Indicadores.** `news_erro` (vermelho), `news_pendentes` (amarelo) no
dashboard. Cobertura: `campaigns_extracted`/notícia. Velocidade: fila pendente.
Meta: fila e erros baixos. Alerta: `news_erro>0`.

**2.11 Estado atual.** **OK.** ingest→extract com reprocessamento; métricas exatas
via `admin_metrics`.

**2.12 Gaps.** Dados: estados de notícia ainda booleanos (não a máquina rica do
RFC). Extração: campos ricos (mercado/segmento/mecânica) ausentes (limita Predict).

**2.13 Melhorias.** *Nova capacidade:* extração v2 com schema rico + estados
(RFC-009 Fase 1) (impacto alto p/ Predict, esforço alto, depende de decisão do
motor canônico — §8).

---

### C21 — Backfill

**2.1 Identidade.** `app/admin/(panel)/backfill/*`, `getBackfillProgress`, tabelas
`backfill_queue`/`backfill_tracker`, RPC `admin_backfill_progress`. Subsistema:
Motor editorial. Objetivo: reprocessar histórico (sitemaps → URLs → notícias).
Problema: cobertura histórica para o forecast/predict. Valor negócio: base para
recorrência. Usuário principal: operador.

**2.2 Função.** Mostra progresso (% done de tracker/queue) e listas; **reprocessar**
uma URL (`status=pending` + `runNow('backfill')`), **Rodar backfill-daily**. **Não
deve** editar conteúdo. Fonte de verdade: `backfill_queue`/`_tracker`.

**2.3 Entradas.** `backfill_queue{source,url,status,error_msg}`,
`backfill_tracker{sitemap_url,status,urls_found/inserted}`. Origem: sitemaps + cron.
Validações: allowlist de alvos (`RUN_TARGETS`).

**2.4 Saídas.** Reenfileira URL; dispara rodada. Destino: `news_raw` (ingest).

**2.5 Ações.** Manual: **Reprocessar** (sem confirmação), **Rodar backfill-daily**,
**Pausar/Ativar todos** (só grupo backfill em Jobs — com confirmação). Automática:
cron. Destrutiva: não. Em lote: pausar/ativar grupo.

**2.6 Ciclo de vida.** URL: `pending → done | error`; reprocessar volta a `pending`.
Tracker: `pending → done | error`.

**2.7 Gestão.** Gerir: cobertura histórica. Quem: operador. Onde: `/admin/backfill`.
Automatizado: rodadas. Supervisão: erros/dead-letter. Revisão: durante backfill.

**2.8 Exceções.** URL falha → `error` (reprocessar). Sitemap indisponível → tracker
erro. Depende da RPC `admin_run_now` existir (não versionada — §C24).

**2.9 Permissões.** Visualizar/reprocessar: operador. Pausar grupo: operador (com
confirmação). Disparar: operador.

**2.10 Indicadores.** Progresso: % done (barras). Fila: `backfill_queue_pendente`
(dashboard). Erros: itens `error`. Meta: cobertura por programa/mês (RFC-009 Fase 2).
Alerta: fila crescente / dead-letter.

**2.11 Estado atual.** **OK.** Fila/tracker + reprocessar + rodar; depende de RPC
não versionada (§C24) e da edge fn de backfill (fora do repo).

**2.12 Gaps.** Dados: sem medição de cobertura por programa/mês (o RFC aponta isso
como maior incógnita do Predict). Versionamento: RPC/edge fn externas.

**2.13 Melhorias.** *Fundação:* backfill observável com cobertura por fonte/mês
(RFC-009 Fase 2) (impacto alto p/ Predict, esforço alto).

---

### C22 — Forecast (radar rápido)

**2.1 Identidade.** `lib/forecast.ts` (verdade) + espelho `scripts/forecast-engine.mjs`,
`lib/admin-forecast.ts`, `app/admin/(panel)/forecast/*`, `scripts/forecast.mjs` →
`content/forecast.json`. Subsistema: Inteligência. Objetivo: prever "mais ou menos
quando cai a próxima janela" por rota/programa. Valor negócio: radar do daily/weekly.
Usuário principal: editor/analista.

**2.2 Função.** Heurística de recorrência de intervalo: filtra `transferencia`,
deriva data da janela (`windowDate`: `vigencia_inicio`→id→`vigencia_fim`; ignora
`observed_at`), colapsa ondas (epsilon 3), calcula mediana/CV, classifica cadência
e confiança (`em-formacao|baixa|media|alta`), projeta janela `center ± sd/2`.
**Não deve** fingir precisão do Predict; `em-formacao` sem base. Fonte de verdade:
`campaigns` (runtime) + `content/forecast.json` (artefato).

**2.3 Entradas.** `campaigns{id,tipo,origem,destino,percentual,vigencia_*}`.
Validações: descarta sem data/origem/destino; `percentual>0`. Config
(`forecast_config`, editável na UI + `forecast_overrides`): `waveEpsilonDays,
minSamples(2), samples/cv thresholds, horizon*`.

**2.4 Saídas.** Runtime: `buildForecast` em `/admin/forecast` e `/observability`.
Persistido (manual): `forecast_snapshots`. Artefato: `content/forecast.json`
(`clusters/routes/digest`). Destino: **weekly digest** (`radarWeekly`); `radarDaily`
gerado mas **sem consumidor**.

**2.5 Ações.** Manual: **Recalcular+snapshot**, salvar config, overrides
(pin/mute/confidence), `npm run forecast`. Automática: **nenhum cron**. Destrutiva:
não. Reversível: sim.

**2.6 Ciclo de vida.** Confiança: `em-formacao → baixa → media → alta` (por
samples+cv); override manual (pin/mute). Ver §4.

**2.7 Gestão.** Gerir: calibração + overrides. Quem: analista/editor. Onde:
`/admin/forecast`. Não editável: matemática (código). Automatizado: cálculo.
Supervisão: overrides. Revisão: por ciclo editorial.

**2.8 Exceções.** `<minSamples` → `em-formacao` (sem janela). Sem credenciais →
`forecast.mjs` modo offline (preserva JSON). Espelho TS↔mjs dessincronizado →
admin e digest divergem (sem teste de paridade).

**2.9 Permissões.** Visualizar: analista/editor. Calibrar/override: analista.
Alterar matemática: administrador técnico.

**2.10 Indicadores.** Cobertura: `withPrediction/(routes+clusters)` (hoje 8/32).
Distribuição de confiança. Precisão previsto-vs-real: **não medida** (só o Predict
tem backtest). Meta: >50% das rotas com previsão. Alerta: queda de cobertura.

**2.11 Estado atual.** **OK−.** Wired ponta-a-ponta com dados reais
(`content/forecast.json`: 119 rows, 8 previsões). Limitações: sem cron (manual);
só weekly consome; `radarDaily` órfão; espelho manual sem teste.

**2.12 Gaps.** Consolidação: espelho `lib/forecast.ts`↔`forecast-engine.mjs` sem
teste de paridade. Integração: daily não consome; sem cron. Doc: `forecast.schema.json`
cita `lib/predictions.ts` (renomeado).

**2.13 Melhorias.** *Consolidação:* teste de paridade TS↔mjs (impacto médio p/
confiabilidade, esforço baixo, risco baixo). *Automação:* cron do `forecast.mjs`.
*Correção:* ligar `radarDaily` ao daily (ou remover).

---

### C23 — Predict v2 (motor robusto)

**2.1 Identidade.** `lib/predict-engine.ts`, `lib/admin-predict.ts`,
`app/admin/(panel)/predict/*`, tabela `predict_snapshots` (`0002_predict_engine_mvp`),
RFC-009. Subsistema: Inteligência. Objetivo: previsão auditável por série (hazard +
distribuição de bônus + backtest + gate). Valor negócio: previsão confiável e
explicável (futuro insumo Pro). Usuário principal: analista.

**2.2 Função.** Determinístico e puro (LLM nunca entra). Modelo A ("quando"):
sobrevivência empírica ponderada por recência → P{7,15,30,60,90,180} monotônicas +
janela. Modelo B ("quanto"): distribuição de % → top-3 candidatos. Backtest
walk-forward (erro de data, window-hit-rate, acurácia de bônus). **Gate**: `n<3` →
`insufficient_history` (bloqueia); rebaixa por CV/backtest; nunca "alta" sem
backtest. **Não deve** inventar; bloqueia sem dado. Fonte de verdade: `campaigns`
(runtime) + `predict_snapshots` (manual).

**2.3 Entradas.** Mesma query que Forecast. `series_key = origem|destino|transferencia|
brasil|todos|percentual` — **mercado/segmento/mecânica são placeholder** (Fase 0
do RFC não feita). Config `DEFAULT_PREDICT_CONFIG` **hardcoded em TS, não editável**
(sem `predict_config`; `opts.config` nunca passado).

**2.4 Saídas.** Runtime: `buildPredict` em `/admin/predict`. Persistido (manual):
`predict_snapshots` (upsert `series_key,as_of_date`) — **único writer**; a página
**não exibe** o histórico (`getSnapshots` não é chamado → write-only). **Sem
artefato, sem consumidor de digest.**

**2.5 Ações.** Manual: **Gerar snapshot** (`snapshotAllAction`). Automática: nenhuma
(sem cron/CLI/`.mjs`). Config: só via deploy do TS.

**2.6 Ciclo de vida.** `readiness: insufficient_history (bloqueio) → ready_with_warnings
→ ready`; `confidence: insuficiente|baixa|media|alta`. (Type prevê `backfill_incomplete`/
`data_quality_blocked` e estados `expired/superseded` — **sem código que os emita**.)

**2.7 Gestão.** Gerir: calibração de pesos + gate. Quem: analista/administrador
técnico. Onde: **hoje só no código** (sem UI de config). Supervisão: leitura do
gate. Revisão: por ciclo.

**2.8 Exceções.** `<3 campanhas` → bloqueado. Backtest fraco → rebaixa confiança.
Config imutável sem deploy. Snapshots gravados mas não exibidos.

**2.9 Permissões.** Visualizar: analista. Snapshot: analista. Calibrar: administrador
técnico (deploy).

**2.10 Indicadores.** Já calculados (`predict_snapshots.backtest`): erro mediano de
data, window-hit-rate, acurácia de bônus (exata e ±5pp). Faltam: Brier por janela
(RFC §8), precisão out-of-sample sobre snapshots versionados, concordância
Forecast↔Predict. Meta: séries `ready` com backtest. Alerta: nenhum (não integrado).

**2.11 Estado atual.** **PARC / ISO.** Motor A/B + backtest **implementados e
ligados à UI** (dados reais); mas **sem config editável, sem `.mjs`/cron/CLI, sem
alimentar digests, `series_key` placeholder, snapshots write-only**. Entregue
essencialmente RFC Fases 4/5/7-parcial; não entregues Fases 0–3/6. É um **painel de
análise interno read-only**.

**2.12 Gaps.** Arquitetura: não reconciliado com Forecast (a regra "predict `ready`
= verdade" não é aplicada); não alimenta saída editorial. Dados: `series_key`
placeholder; sem catálogo `programs`/`program_aliases` (ainda `PROGRAM_ALIASES`
hardcoded). Config: sem `predict_config`. Código: estados/Brier declarados e não
implementados; `getSnapshots` não usado.

**2.13 Melhorias.** *Decisão + fundação:* decidir o **motor canônico** (§8) e, se
Predict, entregar Fase 0 (série rica + catálogo) e integrar a saída (impacto alto,
esforço alto, depende de decisão de negócio, risco médio). *Quick win:* exibir o
histórico de snapshots (`getSnapshots`) na página. *Consolidação:* passar
`opts.config` de uma tabela `predict_config`.

> **Auditoria forense (complemento):** a análise campanha-a-campanha com dados reais do
> Supabase está em **`docs/AUDITORIA-FORENSE-PREDICT-FORECAST.md`** (+ evidências em
> `docs/auditoria/`). Achado-raiz: os motores datam a campanha pela `vigencia_fim`
> extraída (com **erro de ano sistemático**, média +310 dias) e **ignoram `first_seen`**,
> produzindo séries cronologicamente falsas; o intervalo de 943 dias é a **mesma
> campanha duplicada** com data fabricada, não uma lacuna.

---

### C24 — Jobs e crons

**2.1 Identidade.** `app/admin/(panel)/jobs/*`, wrappers `getJobs/toggleJob/runNow`
(`admin-db.ts`), RPCs `admin_list_jobs/toggle_job/run_now` sobre `cron.job` (pg_cron).
Subsistema: Operação. Objetivo: agendar e disparar coleta/análise/backfill. Valor
negócio: motor sempre rodando. Usuário principal: operador/administrador técnico.

**2.2 Função.** Lista jobs por grupo (coleta→`ingest`, analise→`campaigns`,
backfill→`backfill-daily`); **Pausar/Ativar** (pausar exige confirmação inline),
**Rodar agora** (valida `fn` contra `RUN_TARGETS`), **Pausar/Ativar todos** (só
grupo backfill, confirmação). `admin_run_now` provavelmente faz `net.http_post` às
edge functions (**inferido**; SQL só no banco). Fonte de verdade: `cron.job`.

**2.3 Entradas.** `jobname`, `active`, `fn` (allowlist `[ingest,campaigns,backfill,
backfill-daily,backfill-simple]`). Validações: alvo fora da lista recusado.

**2.4 Saídas.** Toggle/execução de cron; `request_id` no toast. Destino: edge
functions.

**2.5 Ações.** Manual: toggle (confirma pausa), runNow, bulk toggle (confirma).
Automática: os próprios crons. Destrutiva: pausar (reversível). Confirmação: pausar
individual/grupo. Auditoria: **nenhuma por operador** (só `cron.job_run_details`).

**2.6 Ciclo de vida (job).** `active ↔ paused` (toggle); execução → `last_status`.
`backfill-simple` é alvo válido **órfão** (sem botão na UI).

**2.7 Gestão.** Gerir: agendamentos. Quem: operador/administrador técnico. Onde:
`/admin/jobs`. Não editável: schedule (só no pg_cron). Supervisão: jobs pausados/
falhos. Revisão: diária. Retenção: `cron.job_run_details`.

**2.8 Exceções.** RPC ausente (ambiente novo) → jobs não carregam (**risco de drift**,
§4). Alvo inválido → recusado. Falha de execução → `last_status=failed`
(`AttentionStrip`).

**2.9 Permissões.** Visualizar: operador. Pausar/rodar: operador. Bulk/alterar
schedule: administrador técnico. Auditar: só execuções (não o operador).

**2.10 Indicadores.** `jobsPausados` (dashboard). Taxa de falha de runs (derivável
de `admin_recent_runs`; **% não calculado**). Meta: 0 jobs pausados sem motivo.
Alerta: run `failed`.

**2.11 Estado atual.** **OK em runtime, NÃO VERSIONADO.** UI funciona; as RPCs
`admin_list_jobs/run_now/toggle_job/recent_runs/backfill_progress` **não têm DDL em
nenhuma migração** — só existem no banco. Risco de drift/perda e de ambiente novo
sem elas.

**2.12 Gaps.** Versionamento (crítico): RPCs `admin_*` fora do controle de versão.
Segurança: sem auditoria por operador. Operação: `backfill-simple` órfão.

**2.13 Melhorias.** *Fundação/correção obrigatória:* **versionar as RPCs `admin_*`
como migração** (impacto alto p/ continuidade, esforço médio, risco baixo,
reversível; aceite: ambiente novo sobe com jobs funcionando só das migrações).

---

### C25 — Logs

**2.1 Identidade.** `app/admin/(panel)/logs/page.tsx`, `admin_recent_runs` + tabela
`runs`. Subsistema: Operação. Objetivo: visão unificada de execuções (cron +
pipeline). Valor negócio: diagnóstico rápido. Usuário principal: operador.

**2.2 Função.** Une `admin_recent_runs` (cron) e `runs` (pipeline editorial) por
data; filtro por status/busca; deep-link `?status=failed`. Read-only. Fonte de
verdade: `cron.job_run_details` + `runs`.

**2.3 Entradas.** `Run{jobname,status,start_time,end_time,return_message}` +
`runs{product,kind,status,started_at,gate_*,human_note}`. Validações: n/a (leitura).

**2.4 Saídas.** Tabela unificada. Destino: operador.

**2.5 Ações.** Somente leitura/filtro. Nenhuma mutação.

**2.6 Ciclo de vida.** n/a (derivado).

**2.7 Gestão.** Gerir: nada (observação). Quem: operador. Retenção: conforme
`cron.job_run_details`/`runs`.

**2.8 Exceções.** RPC ausente → cron some da lista (§C24). Pipeline sem `runs` →
só cron.

**2.9 Permissões.** Visualizar: operador/administrador técnico.

**2.10 Indicadores.** Execuções/14d (sparkline). Falhas recentes. Meta: 0 falhas
persistentes. Alerta: `runFailed` (dashboard).

**2.11 Estado atual.** **OK (read-only).**

**2.12 Gaps.** Sem % de falha calculado; sem retenção/rotação definida.

**2.13 Melhorias.** *Operacional:* métrica de taxa de falha + tendência (impacto
baixo, esforço baixo).

---

### C26 — Observabilidade

**2.1 Identidade.** `app/admin/(panel)/observability/page.tsx`, `lib/admin-calendar.ts`,
`buildForecast`. Subsistema: Operação. Objetivo: derivar calendário de promoções,
previsão de janelas, régua de valor e edições do ledger. Valor negócio: visão
executiva. Usuário principal: editor/analista.

**2.2 Função.** SELECT-only sobre `campaigns` (calendário + forecast), `valuations`
(régua) e `editions` (publicadas). Deriva calendário de barras com marcador de hoje,
previsão (`em-formacao` some/vira nota), régua e tabela de edições. Read-only.
Fonte de verdade: derivado.

**2.3 Entradas.** `campaigns` (2000), `valuations` (`is_current`), `editions`.
Validações: n/a.

**2.4 Saídas.** Visualizações derivadas. Destino: leitura.

**2.5 Ações.** Somente leitura. `RUN_TARGETS` documentados aqui (ingest/campaigns/
backfill/backfill-daily/backfill-simple).

**2.6 Ciclo de vida.** n/a (derivado).

**2.7 Gestão.** Gerir: nada (observação). Quem: editor/analista.

**2.8 Exceções.** `valuations`/`editions` vazios → seções vazias. `forecast_config`
ausente → defaults.

**2.9 Permissões.** Visualizar: editor/analista.

**2.10 Indicadores.** Janelas previstas, régua de valor, edições publicadas.

**2.11 Estado atual.** **OK (read-only/derivado).**

**2.12 Gaps.** Nenhuma escrita (por design). Depende de `valuations`/`editions`
populados por outros processos.

**2.13 Melhorias.** *Experiência:* unificar com o dashboard (redução de superfícies).

---

### C27 — Autenticação

**2.1 Identidade.** `middleware.ts`, `lib/admin-auth.ts`, `app/admin/login/*`
(cookie); `lib/admin.ts` `checkBasicAuth` (Basic Auth Radar). Subsistema: Segurança.
Objetivo: proteger o admin. Problema: acesso controlado. Valor negócio: proteção do
motor. Usuário principal: operador/administrador técnico.

**2.2 Função.** **(A) Cookie** `tl_admin` httpOnly = SHA-256 do `ADMIN_TOKEN`
(comparado constant-time no middleware); `matcher /admin/:path*`; libera `/admin/login`
e `SELF_AUTH=[/admin/sku,/admin/collect]`. **(B) Basic Auth** (`ADMIN_USER/PASSWORD`)
para as rotas Radar, **fora do gate de cookie**. **Não deve** ter fallback de
segredo (correto: service key e `ADMIN_TOKEN` sem fallback). **Não há RBAC** — é
admin único em cada esquema.

**2.3 Entradas.** `ADMIN_TOKEN` (login) / `ADMIN_USER`+`ADMIN_PASSWORD` (Radar).
Validações: hash constant-time no middleware; **login compara senha `!==` (não
constant-time)**.

**2.4 Saídas.** Cookie de sessão (30 dias) / 401. Destino: navegador.

**2.5 Ações.** Manual: login/logout. Destrutiva: n/a. Permissão especial: os
segredos. Auditoria: **nenhuma** (sem identidade de usuário).

**2.6 Ciclo de vida.** `anônimo → login(senha=ADMIN_TOKEN) → cookie(hash) → sessão
30d → logout`. Sem `ADMIN_TOKEN` → painel inacessível.

**2.7 Gestão.** Gerir: segredos + (futuro) papéis. Quem: administrador técnico.
Onde: env. Não editável: sem UI de usuários. Supervisão: rotação de segredo.

**2.8 Exceções.** `ADMIN_TOKEN` ausente → redirect infinito ao login. Basic Auth
sem env → nega tudo. **Login não constant-time** (risco de timing, baixo).

**2.9 Permissões.** **Hoje: admin único** (segredo compartilhado nos dois esquemas,
sem `user_id`, sem papéis). Um operador do painel não autentica nas rotas Radar
(credenciais diferentes) e vice-versa.

**2.10 Indicadores.** Confiabilidade: tentativas de login (não medido). Segurança:
idade do segredo. Meta: RBAC + rotação. Alerta: falhas de login repetidas (não
instrumentado).

**2.11 Estado atual.** **OK− / DUP.** Protege o painel; **dois esquemas coexistem
sem RBAC**; login não constant-time; anon key hardcoded em `lib/admin.ts`.

**2.12 Gaps.** Segurança: sem RBAC/identidade; dois esquemas; login não constant-time;
rotas Basic Auth órfãs (C18). Consolidação: unificar auth.

**2.13 Melhorias.** *Redução de risco:* papéis + identidade por usuário (habilita
auditoria — C29) (impacto alto, esforço alto, **depende de decisão de papéis** — §8).
*Quick win:* login constant-time; remover anon key hardcoded.

---

### C28 — Configurações e secrets

**2.1 Identidade.** `.env.example`, leitura em `lib/admin-db.ts`, `lib/admin.ts`,
scripts e edge fn. Subsistema: Segurança/config. Objetivo: parametrizar modos
live/mock. Valor negócio: operação segura por construção. Usuário principal:
administrador técnico.

**2.2 Função.** Cada superfície decide live/mock pela presença do secret. Fonte de
verdade: env do host (Vercel) + GitHub Actions Secrets.

**2.3 Entradas (inventário).** `SUPABASE_SERVICE_ROLE_KEY`|`SUPABASE_SERVICE_KEY`
(painel/coletor), `SUPABASE_URL` (fallback hardcoded), `SUPABASE_ANON_KEY` (fallback
hardcoded), `ADMIN_TOKEN` (painel), `ADMIN_USER`/`ADMIN_PASSWORD` (Radar), `BEEHIIV_API_KEY`/
`BEEHIIV_PUBLICATION_ID` (assinatura/publisher), `GH_DISPATCH_TOKEN`/`GH_REPO`/`GH_COLLECT_*`
(dispatch), `TAVILY_API_KEY`, `OPENROUTER_API_KEY`/`OPENROUTER_MODEL`/`OLLAMA_*`
(LLM), `NODE_ENV`. Validações: presença → live; ausência → mock/erro claro.

**2.4 Saídas.** Modo de operação por superfície.

**2.5 Ações.** Manual: cadastrar/rotacionar secrets (Vercel/GitHub). Destrutiva:
remover secret (volta a mock). Permissão especial: acesso ao host.

**2.6 Ciclo de vida.** `ausente(mock) → presente(live) → rotacionado`.

**2.7 Gestão.** Gerir: secrets. Quem: administrador técnico/fundador. Onde: Vercel +
GitHub. Não versionar `.env` real. Supervisão: rotação; **remover fallbacks
hardcoded** (anon key/URL). Retenção: gestor de secrets do host.

**2.8 Exceções.** Secret ausente → mock (seguro). **Fallback hardcoded** (anon key,
URL, `GH_REPO`) → funciona sem env, mas expõe valor no código (pendência
reconhecida). Nome duplo da service key (`_ROLE_KEY` vs `_KEY`) → risco de config
divergente.

**2.9 Permissões.** Ver/alterar: administrador técnico/fundador. Nunca no client.

**2.10 Indicadores.** Cobertura de config: superfícies em live vs mock. Meta:
produção 100% live nas superfícies ativas. Alerta: superfície crítica em mock (ex.:
assinatura).

**2.11 Estado atual.** **OK− (degradação graciosa).** Bem documentado; fallbacks
hardcoded e nome duplo da chave são dívidas.

**2.12 Gaps.** Segurança: anon key/URL hardcoded; nome duplo da service key.
Operação: sem verificação central de "o que está live".

**2.13 Melhorias.** *Quick win:* remover fallbacks hardcoded; unificar o nome da
service key (impacto médio p/ segurança, esforço baixo, risco baixo). *Operacional:*
painel de saúde de config (o header já mostra Supabase/mock — estender).

---

### C29 — Auditoria de mutações administrativas [gap]

**2.1 Identidade.** *(Capacidade ausente, identificada como gap transversal.)*
Subsistema: Segurança/governança. Objetivo (desejado): registrar quem alterou o
quê, quando, antes→depois, e por quê. Valor negócio: credibilidade e conformidade
(a marca é "julgamento auditável"). Usuário principal: administrador técnico/editor-chefe.

**2.2 Função (hoje).** **Não existe trilha de auditoria de ações do admin.**
`updateCampaignAction` grava só `{verdict,tl_score}` sem `updated_by`/valor anterior;
`toggleJob/runNow/reprocess*` não registram autor; auth é segredo compartilhado sem
`user_id`. As únicas colunas de autoria (`forecast_config.updated_by`,
`forecast_overrides.created_by`) são `text` livre, área forecast. `edition_events`
registra ações de digest **sem identidade de usuário**. O que "fica" hoje: execuções
(`runs`, `cron.job_run_details`) e logs de app (`[track]`,`[contato]`) efêmeros.

**2.3 Entradas (desejadas).** Ator (via C27 com identidade), entidade, ação, antes,
depois, motivo, timestamp.

**2.4 Saídas (desejadas).** Tabela `admin_audit` append-only.

**2.5 Ações.** N/I. Ações que **deveriam** auditar: mudança de veredito/TL Score,
toggle/run de job, publicação Beehiiv, aprovação de digest, edição de catálogo.

**2.6 Ciclo de vida.** n/a.

**2.7 Gestão.** Gerir: retenção da trilha. Quem: administrador técnico. Onde: banco.
Imutável: registros de auditoria (append-only).

**2.8 Exceções.** Sem trilha → impossível investigar alteração incorreta ou fazer
rollback informado (ex.: veredito editado errado — C19).

**2.9 Permissões.** Ver auditoria: editor-chefe/administrador técnico. Ninguém
edita/apaga a trilha.

**2.10 Indicadores.** Cobertura: % de mutações auditadas (hoje ~0, exceto
`edition_events` sem autor). Meta: 100% das mutações sensíveis com autor+motivo.

**2.11 Estado atual.** **N/I.**

**2.12 Gaps.** Segurança/governança: ausência total de trilha por operador; depende
de C27 (identidade).

**2.13 Melhorias.** *Redução de risco (fundação):* tabela `admin_audit` + gravação
nas server actions sensíveis + `user_id` na sessão (impacto alto p/ credibilidade,
esforço médio, depende de papéis — §8; aceite: toda mudança de veredito registra
quem/antes→depois/motivo).

---

## 4. Máquinas de estado (entidades principais)

Marcação: `→` transição automática · `⇢` transição manual · `⊘` proibida/ausente.

### 4.1 Edição (pipeline de arquivo)
```
autoria(JSON) ⇢ validado → renderizado → qa_aprovada ⇢ publish(índices)
   ⇢ [aprovação humana + PR + confirm=PUBLICAR] ⇢ beehiiv_draft
   ⇢ beehiiv_published | beehiiv_scheduled → (sem loop de métricas neste lado)
Erros/bloqueios: qa_reprovada (exit 1) ⊘ publica · hash_idêntico ⊘ redispara
Modos paralelos: mock | dry-run | live
```
Inicial: `autoria`. Finais: `published`/`scheduled`. Erro: `qa_reprovada`.
Bloqueio: `hash_idêntico` (idempotência). Proibida: publicar sem QA / duplicar sem
`--force`.

### 4.2 Edição (pipeline de banco / admin digests)
```
edition_drafts: draft ⇢ ready ⇢ approved ⇢ published
editions:       draft(+curated,gate_validate,gate_audit,quality_score)
                 → scheduled_at/published_at (via dispatch)
edition_events:  generated → curated → qa → approved → scheduled → published → stats
```
"No Beehiiv" = `!!beehiiv_post_id` (o `status` pode ficar `draft`). Bloqueio:
`dispatchGuarded` recusa publish se gates falham. Proibida: aprovar com QA
`blocking`. **Sem identidade de usuário na trilha.**

### 4.3 Campanha
```
(extração) → continua → vence-72h → [vence-hoje] → vencida ⇢ [descartada]
                     ⇢ needsReview (confianca:baixa) → (revisão humana)
veredito/tl_score: null ⇢ editado_humano (sem histórico)
```
Writers versionados emitem só `continua|vence-72h|vencida` (+`discard_reason`).
`vence-hoje|nova|descartada` e `origin=daily/backfill` existem na UI/métricas mas
**sem writer versionado** (transição diária externa). Proibida (pela UI): editar
rota/%/CPM. **Sem rollback** de veredito (sem valor anterior).

### 4.4 Notícia (`news_raw`)
```
pendente → processada | erro
reprocessar: (processada|erro) ⇢ pendente → runNow('campaigns')
```
(RFC-009 propõe `pending/processing/processed_no_campaign/processed_with_campaign/
retry/error` — não implementado.)

### 4.5 Item de backfill
```
queue:   pending → done | error ; reprocessar: (error|done) ⇢ pending
tracker: pending → done | error
```

### 4.6 Coleta de VPM (Gen-2)
```
run:    running → success | partial | failed
queue:  pending → running → success | error → (next_retry_at +1h → retry) → dead_letter
source: pending_validation ↔ active → broken (consecutive_failures = MAX)
```
Observação: **imutável/append-only** (nunca sobrescreve). Estado atual efetivo: 0
runs `success` (dados = seed).

### 4.7 Produto/SKU (Gen-2)
```
status: active | paused | discontinued | review   (default active)
```
**Sem writer de transição** — efetivamente imutável pós-seed. `canonical_key`
one-way (imutável).

### 4.8 Previsão — Forecast
```
em-formacao (samples<minSamples) → baixa → media → alta   (por samples + CV)
override: ⇢ pin | mute | confidence(manual)
```

### 4.9 Previsão — Predict
```
insufficient_history (n<3, bloqueio) ⇢ ready_with_warnings → ready
confidence: insuficiente | baixa | media | alta   (rebaixa por CV/backtest)
⊘ "alta" sem backtest
declarados-e-não-emitidos: backfill_incomplete, data_quality_blocked, expired, superseded
```

### 4.10 Publicação Beehiiv (ledger de arquivo)
```
(renderizado+QA) → draft → scheduled | published   (+ error)
mode: mock | dry-run | live ; idempotência por contentHash
```

### 4.11 Lead / assinante
```
visita → captura(form) → validado → [mock | enviado_beehiiv] → subscription
   → welcome(Beehiiv) → [nutrição — N/I no repo] → [convite Pro — N/I]
   → [conversão paga — N/I] → [retenção — N/I]
```
Só `visita → captura` está plenamente em código; envio existe mas inativo por env;
tudo após welcome é plano/config externa (Beehiiv) ou N/I.

---

## 5. Jornadas completas (ponta a ponta)

### 5.1 Campanha até publicação
| Etapa | Entrada | Saída | Responsável | Automação | Ponto de revisão | Falhas | Indicador |
|---|---|---|---|---|---|---|---|
| Fonte | sitemap/feed | URL na fila | Sistema | cron ingest/backfill | — | fonte off/timeout | itens na fila |
| Notícia | URL | `news_raw` | Sistema | cron ingest | — | fetch falha → `erro` | `news_erro` |
| Extração | `news_raw` | `campaigns` (LLM) | Sistema (edge fn) | cron `campaigns` | `confianca:baixa`→revisão | LLM falha/`error` | `campaigns_extracted` |
| Campanha | linha extraída | ledger | Sistema | upsert por `id` | needsReview | duplicidade (mitigada) | novas/dia |
| Validação | campanha | veredito+TL Score | Analista/editor | ⇢ manual | **edição inline** | veredito errado (sem rollback) | fila de revisão |
| Histórico | `campaigns` | série por rota | Sistema | runtime | — | backfill incompleto | cobertura |
| Previsão | série | janela | Forecast/Predict | forecast manual | `em-formacao`/bloqueio | espelho dessincronizado | cobertura previsão |
| Curadoria | campanhas vigentes | `edition_drafts` | Operador | ⇢ manual | seleção por TL Score | gate fraco | rascunhos |
| Digest | rascunho | `editions` | Operador | QA + materialize | **Aprovar** | QA fraco vs pipeline | gatesOk/total |
| Beehiiv | edição | post (draft) | Aprovador | dispatch+confirm | reviewer do Environment | via MCP fora do gate; sem `edition_path` | publicadas/total |
| Arquivo web | JSON | `/edicao/N` | Editor | SSG build | PR | conteúdo ilustrativo | pageviews |

**Ruptura da jornada:** o forecast/predict **não** alimenta a curadoria/digest
automaticamente (o operador escolhe campanhas por TL Score, não por janela prevista),
e a publicação admin pode publicar `latest.json` em vez da edição do banco (§4/§C10).

### 5.2 SKU até análise Pro
| Etapa | Entrada | Saída | Responsável | Automação | Revisão | Falhas | Indicador |
|---|---|---|---|---|---|---|---|
| Catálogo | curadoria | `shopping_products` | Operador dados | seed SQL | manual | sem UI de edição | SKUs/categoria |
| Descoberta de fonte | catálogo | `product_sources` | Operador dados | seed | validação de URL | fonte `category` (não valida) | fontes `product` |
| Coleta | fontes ativas | `shopping_observations` | Sistema | cron 2×/dia | diagnóstico | **SPA/login/anti-bot (BLOQ)** | runs `success` (~0) |
| Matching | observação | `match_confidence` | Operador (curado) | ⊘ automático | manual | variantes confundíveis | % `rejected` |
| Validação | observação | `active`/`pending` | Sistema | pós-coleta | — | preço/pontos ausentes | fontes `active` |
| VPM | observação válida | `shopping_metrics` | Sistema | `recompute` | — | n<3 → n/c | comparáveis |
| Benchmark | métricas | `category_benchmarks` | Sistema | `recompute` | — | IQR não aplicado | `sample_quality` |
| Alerta | banda | (sem alerta automático) | — | ⊘ | — | N/I | — |
| Análise editorial | banda | `shoppingWatch`/Pro | Editor | ⇢ manual (`pro:vpm`) | humano | dado = seed | VPM por player |
| Pro | relatório | `/pro/[periodo]` | Editor | SSG | humano | sem publicação/gate | leitores Pro |

**Ruptura:** a jornada **está parada na Coleta** (bloqueio externo). Tudo a jusante
roda sobre **seed histórico**. Não há etapa de **alerta automático** (a banda não
dispara nada).

### 5.3 Lead até assinante Pro
| Etapa | Entrada | Saída | Responsável | Automação | Revisão | Falhas | Indicador |
|---|---|---|---|---|---|---|---|
| Visita | tráfego | pageview | Visitante | SSG | — | — | visitantes (não instrumentado) |
| Captura | form | `{email,perfil,source}` | Visitante | client | honeypot/rate-limit | mock silencioso (env) | `subscribe_submit` |
| Beehiiv | payload | subscription | Sistema | `/api/subscribe` | — | **mock sem env** | novos assinantes |
| Boas-vindas | subscription | e-mail D0 | Beehiiv | `send_welcome_email` | — | automação não montada | abertura D0 |
| Nutrição | assinante | régua D3/D7 | — | **N/I (Beehiiv Automations)** | — | não existe | abertura D7 |
| Segmentação | `utm_source`+`perfil` | segmentos | Beehiiv | sinais enviados | — | segmentação manual | por perfil |
| Convite Pro | engajamento | waitlist | — | **N/I (por engajamento)** | — | não automatizado | leads waitlist |
| Conversão | waitlist | assinante pago | — | **N/I (sem gateway)** | — | não existe | — |
| Retenção | pago | cohort | — | **N/I** | — | sem persistência | churn |

**Ruptura:** operacional só até **captura**; envio inativo por env; **tudo após
welcome é N/I ou configuração externa** (Beehiiv/gateway).

### 5.4 Edição até publicação
| Etapa | Entrada | Saída | Responsável | Automação | Revisão | Falhas | Indicador |
|---|---|---|---|---|---|---|---|
| Autoria | pesquisa | JSON | Cowork/editor | ⇢ | `tl-source-audit` | fonte Grupo 1 → reprova | edições/dia |
| Validação | JSON | ok/erro | Sistema | `validate` (CI) | — | schema/regra inviolável | APROVADA% |
| Renderização | JSON | e-mail/web/plain | Sistema | `render-system` | — | artefato inválido | manifest ok |
| QA | artefatos | APROVADA | Sistema | `qa`/`tl-qa` (CI) | — | REPROVADA (exit 1) | findings |
| Aprovação | edição | ok humano | Revisor/aprovador | ⇢ + confirm | PR + reviewer | — | tempo até aprovar |
| Publicação | renderizado | post Beehiiv | Aprovador | dispatch | confirm=PUBLICAR | MCP fora do gate | publicadas |
| Arquivo | JSON | `/edicao/N` | Editor | SSG | — | ilustrativo | pageviews |
| Mensuração | post | `edition_stats` | Sistema | fetchBeehiivStats | — | só no lado banco | open/click rate |

---

## 6. Matriz de gestão

> **Realidade hoje:** existe **admin único** (segredo compartilhado) + Basic Auth
> do Radar. Não há papéis. A matriz abaixo é o **modelo-alvo proposto** (base para
> a decisão de papéis — §12). Papéis: **O** Owner · **T** Administrador técnico ·
> **D** Operador de dados · **A** Analista · **E** Editor · **R** Revisor ·
> **C** Comercial · **P** Leitor Pro · **S** Sistema automatizado.
> "Publicar" e "Excluir" são deliberadamente restritos.

| Domínio | Entidade | Criar | Visualizar | Editar | Aprovar | Publicar | Reprocessar | Arquivar | Excluir |
|---|---|---|---|---|---|---|---|---|---|
| Conteúdo | Edição (JSON) | E, S | todos | E | R | R (+confirm) | T | E | T |
| Conteúdo | Digest/rascunho | E, D | O,T,E,R | E | R | R | D | E | T |
| Conteúdo | Publicação Beehiiv | — | O,T,E,R | — | R | **R (+reviewer)** | T (--force) | — | — |
| Motor | Campanha | S | O,T,A,E,R | **A (só veredito/TL)** | R | — | T | T | T |
| Motor | Notícia | S | O,T,D,A | — | — | — | D | T | T |
| Motor | Backfill (item) | S | O,T,D | — | — | D | T | — | T |
| Dados | SKU/catálogo | D | O,T,A,E | D | D | — | D | D | T |
| Dados | Fonte (source) | D | O,T,D | D | D | — | D | D | T |
| Dados | Observação VPM | S | O,T,D,A | ⊘ (imutável) | — | — | — | S | T |
| Dados | Benchmark/banda | S | O,T,A,E | ⊘ (recompute) | — | — | D | S | T |
| Inteligência | Forecast (config/override) | A | O,T,A,E | A | — | — | A | — | T |
| Inteligência | Predict (snapshot/config) | A, S | O,T,A | T (config) | — | — | A | — | T |
| Operação | Job/cron | T | O,T,D | T (schedule) | — | — | D (runNow) | — | T |
| Operação | Log/execução | S | O,T,D,A,E | ⊘ | — | — | — | S | T |
| Growth | Lead assinante | visitante,S | O,T,C | (no Beehiiv) | — | — | — | — | (LGPD) |
| Growth | Lead comercial | visitante | O,T,C | C | — | — | — | C | T |
| Growth | Relatório Pro | E | P (gate), O,T,A,E,R | E | R | R | — | E | T |
| Segurança | Secret/config | T,O | O,T | T | O | — | — | — | O |
| Segurança | Usuário/papel | O | O,T | O | O | — | — | O | O |
| Segurança | Trilha de auditoria | S | O,T,R | ⊘ (append-only) | — | — | — | S | ⊘ |

**Leitura da matriz.** Três princípios: (1) **Sistema** cria dados observados;
**humanos** só editam a camada editorial (veredito, texto, curadoria) — nunca o
dado observado. (2) **Publicar** (e-mail e Pro) exige papel de aprovação +
confirmação/reviewer — nunca operador/analista sozinho. (3) **Excluir** concentra
em **T/O**; auditoria é **append-only** (ninguém edita/apaga).

---

## 7. Matriz de permissões (por papel e ação sensível)

**Catálogo de papéis (proposto).**

| Papel | Escopo | Ações-chave | Não pode |
|---|---|---|---|
| **Owner (O)** | tudo | decisões de negócio, papéis, secrets críticos | — |
| **Administrador técnico (T)** | infra/dados/segurança | secrets, migrations, excluir, reprocessar, versionar RPCs | publicar edição sem aprovação |
| **Operador de dados (D)** | Radar/coleta/backfill | catálogo, coleta, recompute, reprocessar | editar veredito, publicar |
| **Analista (A)** | inteligência/campanhas | veredito+TL Score, forecast/predict, overrides | publicar, alterar dados observados |
| **Editor (E)** | conteúdo | autoria de edição/Pro, curadoria | publicar sozinho, alterar dados |
| **Revisor / editor-chefe (R)** | gate editorial | aprovar, publicar (com confirmação/reviewer) | alterar dados observados |
| **Comercial (C)** | growth B2B | ver/gerir leads comerciais, media kit | tocar motor/dados |
| **Leitor Pro (P)** | consumo | ler relatórios Pro (atrás de gate) | qualquer escrita |
| **Sistema automatizado (S)** | crons/edge fn | ingest, extração, coleta, recompute, stats | decisões editoriais/publicação |

**Ações sensíveis — quem pode, o que registrar, quando exigir motivo.**

| Ação sensível | Quem pode | Pré-condição | Auditar (antes→depois) | Exigir motivo |
|---|---|---|---|---|
| Editar veredito/TL Score da campanha | A, R | campanha existe | **sim** (hoje ausente — C29) | **sim** (mudança de veredito) |
| Publicar/agendar no Beehiiv | R (+reviewer) | gates OK + confirm | sim (history/ledger) | recomendável |
| Aprovar digest | R | QA não-blocking | sim (evento + autor) | não |
| Pausar cron / rodar agora | D, T | — | **sim** (hoje ausente) | pausa prolongada: sim |
| Editar catálogo de SKU/fonte | D | — | **sim** (hoje ausente) | não |
| Reprocessar notícia/backfill | D | item existe | recomendável | não |
| Alterar config Forecast/Predict | A (forecast), T (predict) | — | sim (`updated_by` só no forecast) | mudança de calibração: sim |
| Alterar secret/config | T, O | acesso ao host | fora da app (host) | sim |
| Excluir qualquer entidade | T, O | — | **sim** (append-only) | **sim** |
| Criar/alterar papel de usuário | O | — | **sim** | **sim** |

**Nota:** hoje **nenhuma** dessas ações grava autor/antes→depois no app (exceto
`edition_events` sem `user_id`). A coluna "Auditar" descreve o **alvo**; a
lacuna é C29. **Não** se deve assumir que um único admin tenha acesso irrestrito —
a separação Owner/Técnico/Editorial/Dados/Comercial é pré-requisito de
credibilidade ("julgamento auditável").

---

## Central de operações recomendada (avaliação)

Avaliação da estrutura de áreas proposta no pedido **contra a arquitetura atual**.
Veredito: a estrutura faz sentido e é largamente **realizável com o que já existe**
— o admin atual (pós-redesign) já agrupa em Operação/Conteúdo/Inteligência/Sistema,
o que se aproxima. Ajustes por área:

| Área | Objetivo | Entidades (reais hoje) | Ações | Indicadores | Alertas | Permissões |
|---|---|---|---|---|---|---|
| **Visão geral** | o que precisa de ação | métricas + `AttentionStrip` | ver, deep-link | pendências/erros/vencimentos | `news_erro`, `runFailed`, `venceHoje` | O,T,D,A,E |
| **Operações › Pendências** | fila de trabalho | needsReview, news pendentes, backfill | reprocessar | fila por tipo | fila crescente | D,A |
| **Operações › Execuções** | runs | `runs`, `cron.job_run_details` | ver/filtrar | execuções/14d | — | O,T,D |
| **Operações › Falhas** | o que falhou | runs `failed`, news `erro`, dead_letter | reprocessar | taxa de falha (**faltа calcular**) | falha persistente | T,D |
| **Conteúdo › Notícias** | ingest/extract | `news_raw` | reprocessar, rodar extração | pendentes/erro | `news_erro` | D |
| **Conteúdo › Campanhas** | ledger/veredito | `campaigns` | editar veredito/TL | revisão, vencimentos | `venceHoje` | A,R |
| **Conteúdo › Digests** | ciclo de edição | `editions`/`edition_drafts` | curar, QA, aprovar, publicar | gatesOk, qualidade | gate falho | E,R |
| **Conteúdo › Publicações** | envios | `beehiiv-status`/`edition_stats` | ver, medir | open/click | publicação fora do gate | R |
| **Inteligência › Forecast** | radar rápido | `forecast_*` | recalcular, override | cobertura previsão | — | A |
| **Inteligência › Predict** | motor robusto | `predict_snapshots` | snapshot | backtest, readiness | (não integrado) | A |
| **Inteligência › Radar VPM** | VPM por SKU | `shopping_*` | coletar, recalcular | cobertura, frescor | 0 runs success | D,A |
| **Inteligência › Benchmarks** | bandas | `shopping_category_benchmarks` | recalcular | `sample_quality` | banda `n/c` | D,A |
| **Dados › Programas** | catálogo canônico | `loyalty_programs` (+ `programs` do RFC — N/I) | curar | — | — | D,T |
| **Dados › Parceiros/Produtos/SKUs** | catálogo | `shopping_products`/`_sources` | curar (**hoje só SQL**) | fontes `active` | fonte `broken` | D |
| **Dados › Fontes** | URLs por programa | `shopping_product_sources` | validar, afinar | `pending_validation` | anti-bot | D,T |
| **Dados › Histórico** | observações | `shopping_observations` | ver (imutável) | frescor | — | D,A |
| **Config › Jobs** | crons | `cron.job` via RPC | pausar/rodar | pausados | run `failed` | T,D |
| **Config › Integrações** | Beehiiv/GitHub/Supabase | secrets/dispatch | testar | live vs mock | superfície em mock | T,O |
| **Config › Secrets** | env | env vars | rotacionar | cobertura de config | secret crítico ausente | T,O |
| **Config › Usuários** | papéis (**N/I**) | — | criar/alterar papel | — | — | O |
| **Config › Auditoria** | trilha (**N/I**) | `admin_audit` (proposto) | ver (append-only) | % mutações auditadas | ação sem autor | O,T,R |

**Lacunas para a estrutura fechar:** `Dados › Programas` depende do catálogo
`programs`/`program_aliases` (RFC, N/I); `Config › Usuários` e `Config › Auditoria`
dependem de RBAC + trilha (N/I); `Dados › Parceiros/Produtos` precisa de UI de
edição (hoje só SQL). O resto mapeia 1:1 com telas existentes.

---

## 8. Sobreposições e duplicações

### S1 — Coletor VPM Gen-1 (`sku_*`) × Gen-2 (`shopping_*`)
- **A (Gen-1):** `scripts/collect-skus.mjs`+`collect/*`, `0001_retail_vpm`, rotas
  `/admin/sku|collect` (Basic Auth), banda MAD → `retail_valuations`.
- **B (Gen-2):** `scripts/shopping/*` (headless), `0002/0003/0006`, cockpit
  `/admin/shopping-vpm`, RPC `shopping_recompute` → benchmarks.
- **Consome A:** só `scripts/pro-vpm.mjs` (VPM do Pro). `sku_observations` sem
  leitor. **Consome B:** `lib/admin-shopping.ts` → cockpit (fluxo fechado).
- **Diferenças:** B é headless, com fila/retry/dead_letter, tipos de ponto ricos,
  benchmarks P25/med/P75, `ADAPTER_VERSION`; A é fetch simples, banda min/med/max,
  UI órfã.
- **Risco:** rotas Basic Auth Gen-1 vivas e **fora do gate de cookie** = superfície
  de ataque órfã; anon key hardcoded; dois métodos estatísticos sem reconciliação;
  documentação cita telas Gen-1 inexistentes.
- **Canônica:** **B (Gen-2)** — a própria migração 0002 declara o Gen-1 "a
  migrar/aposentar".
- **Plano:** (1) apontar `pro-vpm` para `shopping_*`/benchmarks; (2) remover rotas
  `/admin/sku|collect` e a Basic Auth; (3) `DROP` das tabelas `sku_*` após confirmar
  que nada lê; (4) remover `content/sku-basket.json` e `collect.yml`.
- **Compat. temporária:** manter `retail_valuations` até o Pro migrar.
- **Critério p/ desativar A:** Pro lê Gen-2 em produção + `grep` confirmando zero
  leitores de `sku_*`/`retail_valuations`.

### S2 — Tabelas `sku_*` × `shopping_*`
Subcaso de S1 no nível de dados. **`runs`** é compartilhada (campanhas `kind=campaigns`
+ Gen-1 `kind=skus`); Gen-2 usa `shopping_collection_runs` separada. **Canônico:**
`shopping_*` + `shopping_collection_runs`. **Migração:** ao aposentar Gen-1, manter
`runs` só para campanhas. **Critério:** nenhuma escrita `kind=skus`.

### S3 — Forecast × Predict
- **A (Forecast):** `lib/forecast.ts` — mediana de intervalos, config editável,
  artefato `forecast.json`, alimenta **weekly**.
- **B (Predict):** `lib/predict-engine.ts` — hazard + backtest + gate, config
  hardcoded, snapshots write-only, **não alimenta digest**.
- **Consome A:** `/admin/forecast`, `/observability`, `render-weekly`. **Consome B:**
  só `/admin/predict`.
- **Diferenças:** ver §4.8/4.9; A bloqueia com <2, B com <3; B tem P{7..180}+backtest.
- **Risco:** esforço do motor robusto **não chega ao produto**; duas "verdades" de
  janela sem reconciliação; a regra do RFC ("predict `ready` = fonte de verdade")
  **não é aplicada em lugar nenhum**.
- **Canônica:** **convivência intencional** (RFC-009 §0) — Forecast = radar rápido;
  Predict = motor auditável e **fonte de verdade quando `ready`**. Não é duplicação
  a remover; é integração a completar.
- **Plano:** (1) reconciliador que, por rota, usa Predict quando `ready` e Forecast
  senão; (2) Predict passa a alimentar digests; (3) Fase 0 do RFC (série rica +
  catálogo) para o Predict deixar de bloquear a maioria.
- **Compat. temporária:** Forecast continua no digest até o reconciliador existir.
- **Critério p/ "promover" B:** ≥1 programa com séries `ready` e backtest, exibido
  no digest via reconciliador.

### S4 — `lib/forecast.ts` × `scripts/forecast-engine.mjs`
- **A:** TS (app Next). **B:** `.mjs` (pipeline de render sem build TS).
- **Diferença:** **cópia quase literal** (buildForecast/analyze/classify/…,
  `DEFAULT_FORECAST_CONFIG` duplicado). Sincronização **manual**; comentários pedem
  "replique lá".
- **Risco:** editar um lado sem o outro faz **admin e digests divergirem
  silenciosamente**; sem teste de paridade.
- **Canônica:** padrão TS↔.mjs é **intencional** (RFC §12) — não descartar, mas
  **blindar**.
- **Plano:** teste de paridade (ex.: rodar ambos sobre um fixture e comparar saída)
  no CI; ou gerar o `.mjs` a partir do TS.
- **Critério:** CI falha se as saídas divergirem.

### S5 — Publicação Beehiiv: CLI × Workflow × MCP
- **A (CLI `beehiiv-publish.mjs`):** idempotência (contentHash), QA gate, mock-first,
  ledger `beehiiv-status.json`.
- **B (Workflow `beehiiv.yml`):** mesma engine + gate humano (confirm/reviewer/
  concurrency).
- **C (MCP Beehiiv):** ferramentas `mcp__Beehiiv__*` — **sem idempotência, sem QA
  gate, sem ledger**; foi a via que **efetivamente criou o único draft live**
  (`provenance:beehiiv-mcp`).
- **Consome A/B:** dev/CI/admin. **Consome C:** operador via agente/MCP.
- **Risco:** a via sem gate é a mais fácil e foi a usada; risco de publicar sem QA/
  duplicar; ledger de arquivo desatualizado.
- **Canônica:** **B (workflow)** para envio, **A (CLI)** para dev/mock. **C** só
  para leitura/depuração, nunca como via de publicação.
- **Plano:** política escrita "publicação só via workflow"; se MCP for usado, um
  passo que **registra no ledger** e roda o QA gate antes.
- **Critério:** toda publicação tem `provenance` de gate no ledger.

### S6 — Cookie auth × Basic Auth
- **A (cookie `tl_admin`):** painel `(panel)/*`, hash SHA-256 do `ADMIN_TOKEN`.
- **B (Basic Auth):** rotas Radar `/admin/sku|collect`, `ADMIN_USER`/`PASSWORD`,
  **isentas do gate de cookie**.
- **Risco:** dois modelos, duas credenciais, sem RBAC; superfície Basic Auth órfã
  (S1); login não constant-time.
- **Canônica:** **A (cookie)**, evoluído para **sessão por identidade + RBAC**.
- **Plano:** remover as rotas Radar (S1) → some a razão da Basic Auth; ou, se
  mantidas, colocá-las sob o mesmo gate/identidade.
- **Critério:** um só modelo de auth com `user_id`.

### S7 — Regras editoriais duplicadas
- **Fontes:** (1) `scripts/lib.mjs` (`EMOJI_RE/URGENCY_RE/INTERNAL_RE/DISCLAIMER/
  TL_WEIGHTS`) — **canônica**; (2) `scripts/pro.mjs` (`INTERNAL_RE` próprio,
  divergente); (3) `lib/admin-digest-ops.runQa` (QA **mais fraco**: só subject/
  destaque/notes; ignora disclaimer/vigência/TL Score); (4) prosa em `CLAUDE.md` +
  3 skills.
- **Risco:** **gate verde no admin não garante conformidade** (deriva do QA fraco);
  `INTERNAL_RE` do Pro pode bloquear/liberar diferente.
- **Canônica:** `scripts/lib.mjs` (e o `validateEdition`).
- **Plano:** extrair um módulo único de regras reutilizado por `pro.mjs`,
  `admin-digest-ops` e (via porta ESM) pelo pipeline; `gate_validate/audit` do
  ledger passam a derivar de `validateEdition`.
- **Critério:** um único `INTERNAL_RE`; QA do admin = pipeline.

### S8 — Renderer canônico × legado
- **A (canônico):** `scripts/{render,validate,qa}.mjs` + `content/edition.schema.json`
  (camelCase). **B (legado):** `renderer/*` + `scripts/{render,validate,qa}-daily.mjs`
  + `renderer/edition.schema.json` (snake_case, `program_watch/bank_cards_watch/…`).
- **Consome A:** CI, `edition`, site. **Consome B:** **ninguém no fluxo** — mas os
  scripts `daily:*` seguem no `package.json`.
- **Risco:** alguém roda `daily:*` e gera artefato com **schema incompatível**;
  confusão de fonte de verdade.
- **Canônica:** **A**. **Plano:** remover `renderer/` e os scripts `daily:*`.
  **Compat.:** confirmar que `app/daily/preview` (que importa
  `renderer/examples/edition.example.json`) migre para um exemplo canônico antes de
  remover. **Critério:** `package.json` sem `daily:*`; `renderer/` ausente; preview
  usando exemplo canônico.

---

## 9. Indicadores (consolidado)

> Muitos já existem no código (dashboard, `deriveAttention`, `summarizeByProduct`,
> `predict_snapshots.backtest`); outros exigem instrumentação (marcados **‹novo›**).

| Indicador | Fórmula | Fonte | Periodicidade | Meta inicial | Alerta | Ação se abaixo |
|---|---|---|---|---|---|---|
| Conversão de assinatura | `subscribe_success / subscribe_submit` | track ‹novo:persistir› | diária | >2% view→lead | 0 inscrições/24h (proxy de mock) | checar `BEEHIIV_*` e copy |
| Leads waitlist Pro | contagem por `perfil` | Beehiiv | semanal | baseline p/ preço | queda abrupta | revisar oferta |
| Leads comerciais | contagem `[contato]` | Vercel Logs ‹novo:persistir› | semanal | — | lead sem resposta | plugar e-mail/CRM (C05) |
| Edições/semana | `count(editions where !illustrative)` | `editions`/`content` | semanal | 5 (dias úteis) | 0 na semana | destravar produção editorial |
| Taxa de gates OK | `gatesOk / total` | `summarizeByProduct` | por edição | 100% | <100% | corrigir antes de publicar |
| Qualidade média | média `quality_score` | `edition_qa_reports` | por edição | ≥85 | queda | revisar curadoria |
| Tempo de curadoria | `approved_at − curated_at` | `edition_events` | por edição | <2h | outliers | ajustar fluxo |
| Publicação no gate | `% posts com provenance de gate` | `beehiiv-status` | por publicação | 100% | publicação MCP fora do gate | política de via única (S5) |
| Open/click rate | do Beehiiv | `edition_stats` | por edição | benchmark do nicho | queda | revisar assunto |
| Campanhas em revisão | `count(needsReview)` | `campaigns` | diária | 0 no fim do dia | fila crescente | revisar veredito |
| Cobertura de veredito | `com_veredito / total` | `campaigns` | diária | >90% vigentes | queda | curadoria |
| Notícias com erro | `count(error)` | `admin_metrics` | horária | 0 | >0 | reprocessar/ajustar extrator |
| Fila de extração | `count(pendente)` | `admin_metrics` | horária | baixa | crescente | rodar extração |
| Taxa de falha de runs | `failed / total` ‹novo:calcular %› | `admin_recent_runs` | diária | <5% | falha persistente | diagnosticar job |
| Jobs pausados | `jobs_total − jobs_ativos` | `admin_metrics` | contínua | 0 sem motivo | >0 | reativar/justificar |
| Cobertura de backfill | `done/(done+pending)` por fonte/mês ‹novo› | `backfill_*` | durante backfill | crescente | estagnação | investigar sitemap |
| Cobertura de previsão (Forecast) | `withPrediction/(routes+clusters)` | `forecast.json` | por recálculo | >50% | queda | mais histórico |
| Precisão de janela (Predict) | erro mediano de data; window-hit-rate | `predict_snapshots.backtest` | por snapshot | hit-rate >0,5 | <0,5 | rebaixar confiança |
| Calibração (Predict) | Brier por janela ‹novo (RFC §8)› | backtest | por snapshot | baixo | alto | recalibrar pesos |
| Concordância Forecast↔Predict | divergência de janela p/ mesma rota ‹novo› | ambos | por recálculo | baixa | divergência alta | reconciliar (S3) |
| Runs de coleta VPM com sucesso | `success/total` | `shopping_collection_runs` | por rodada | >0 (hoje ~0) | 0 (bloqueio) | afinar adapters (C15) |
| Cobertura de matching | `SKUs complete / total` | `shopping_sku_comparisons` | por recompute | crescente | muitos `partial` | mais fontes/curadoria |
| Frescor da coleta | idade de `captured_at` | `shopping_observations` | diária | <48h (em regime) | dado velho | recoletar |
| Qualidade estatística | `sample_quality` por categoria | `shopping_category_benchmarks` | por recompute | ≥`indicative` | `no_data`/`insufficient` | ampliar cesta |
| Cobertura de config | superfícies live/total | env | por deploy | 100% críticas live | crítica em mock | cadastrar secret |
| % mutações auditadas | `auditadas/total` ‹novo (C29)› | `admin_audit` | contínua | 100% sensíveis | ação sem autor | implementar trilha |

---

## 10. Exceções (consolidado)

> Para cada classe: como detectar · classificar · apresentar no admin · bloqueia? ·
> retry? · revisão? · recuperar.

| Classe | Onde ocorre | Detecção | Apresentação | Bloqueia | Retry | Revisão | Recuperação |
|---|---|---|---|---|---|---|---|
| **Dados ausentes** | coleta VPM, campanha sem vigência | preço/pontos nulo; `vigencia` nula | lacuna / `nao-confirmado` / `n/c` | não (protege indicador) | próxima rodada | sim (fonte) | recoletar/confirmar fonte |
| **Dados inconsistentes** | TL Score↔veredito, breakdown | `validateEdition` | erro no QA (exit 1) | **sim** (publicação) | não | sim | corrigir JSON |
| **Duplicidade** | campanha, publicação, coleta | upsert por `id`/`canonical_key`; `contentHash` | bloqueio de dispatch | **sim** (Beehiiv) | `--force` consciente | não | forçar só se intencional |
| **Fonte indisponível** | ingest, coleta | fetch falha; SPA/anti-bot | `error`/`pending_validation` | não | sim (fila `+1h`) | sim (afinar adapter) | reprocessar/headless |
| **Timeout** | coleta headless, API | erro de rede | run `partial/failed`; `next_retry_at` | não | sim | não | retry automático |
| **Erro parcial** | rodada com N fontes | run `partial` | contadores no cockpit | não | itens em `error` | sim | reprocessar itens |
| **Falha externa** | Beehiiv/OpenRouter/Tavily | 4xx/5xx | `provider_error`/log | depende | conforme | sim | trocar chave/modelo |
| **Falha de autenticação** | painel / Radar / dispatch | 401/redirect | login / erro claro | **sim** (acesso) | não | não | conferir `ADMIN_TOKEN`/Basic/PAT |
| **Dados antigos** | Radar (seed), forecast.json | `captured_at` velho; `source:offline` | frescor / carimbo | não | recoletar | sim | rodar coleta/forecast |
| **Resultado contraditório** | Forecast vs Predict | divergência de janela ‹não medido› | — (gap) | não | não | **sim** (reconciliar) | S3 |
| **Execução duplicada** | publish, cron | `contentHash`; `concurrency` | bloqueio | **sim** | `--force` | não | — |
| **Alteração manual incorreta** | veredito/TL Score, catálogo | **não detectável** (sem auditoria) | — (gap C29) | não | não | **sim** | **sem rollback hoje** → C29 |
| **Necessidade de rollback** | edição publicada, veredito | — | — | não | não | sim | edição: só corrigir na próxima (sem "unsend"); veredito: sem histórico |

**Padrões faltantes (gaps de exceção):** (a) **sem detecção** de alteração manual
incorreta (C29); (b) **sem medição** de resultado contraditório Forecast↔Predict;
(c) **rollback** de publicação inexistente (assinatura do e-mail é irreversível —
mitigar com gate humano forte, já presente).

---

## 11. Backlog funcional ampliado

Prioridades: **P0** crítico · **P1** fundação · **P2** operação · **P3**
crescimento · **P4** otimização. Impacto/Esforço/Risco: B/M/A.

| ID | Capacidade | Problema | Usuário | Resultado | Imp | Esf | Dependências | Risco | Critério de aceite | Prio | Fase |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BL-01 | Versionar RPCs `admin_*` | jobs/backfill/logs dependem de RPC só no banco | T | continuidade garantida | A | M | acesso ao banco | B | migração cria todas as RPCs; ambiente novo opera só das migrations | **P0** | F1 |
| BL-02 | Confirmar `BEEHIIV_*` em prod + alerta de mock | assinatura pode cair em mock e descartar leads | T,O | captura confiável | A | B | Vercel env | A (regressão) | e-mail próprio cai no Beehiiv a partir do `main`; alerta de 0 inscrições | **P0** | F1 |
| BL-03 | Persistir `track` e `/api/contato` | telemetria e leads B2B só em logs efêmeros | A,C | dado utilizável | A | M | tabela `events`/e-mail | B | eventos e leads em store consultável | **P0** | F1 |
| BL-04 | Trilha de auditoria + identidade | mutações sem autor/rollback | O,T,R | credibilidade e rastreio | A | M | RBAC (BL-13) | M | veredito registra quem/antes→depois/motivo | **P0** | F1 |
| BL-05 | Versionar view `shopping_sku_latest_v` | view só no banco | T | Radar reproduzível | M | B | — | B | `CREATE VIEW` em migração | **P0** | F1 |
| BL-06 | QA do admin = `validateEdition` | gate verde não garante conformidade | R,E | gate confiável | A | M | módulo único de regras (BL-07) | M | gate verde ⇒ disclaimer/vigência/TL Score checados | **P1** | F1 |
| BL-07 | Módulo único de regras invioláveis | `INTERNAL_RE` divergente; QA fraco | E,R | consistência editorial | M | M | — | B | um só `INTERNAL_RE`; reuso por pro/admin/pipeline | **P1** | F1 |
| BL-08 | Remover fallbacks hardcoded + login constant-time | anon key/URL no código; timing | T | superfície reduzida | M | B | — | B | sem fallback; login usa `safeEqual` | **P1** | F1 |
| BL-09 | Afinar adapters de coleta VPM (desbloqueio) | SPA/login/anti-bot → seed | D | coleta viva | A | A | secrets, decisão de login (DP-07) | M | ≥1 programa retorna preço+pontos reais | **P1** | F2 |
| BL-10 | Aposentar coletor Gen-1 `sku_*` | duplicação + rotas Basic Auth órfãs | T,D | menos risco/ruído | A | M | Pro lê Gen-2 (BL-11) | M | rotas/tabelas Gen-1 removidas; zero leitores | **P1** | F2 |
| BL-11 | Pro consome VPM Gen-2 | Pro depende do legado | E | dado canônico no Pro | M | M | BL-09 | B | `pro-vpm` lê `shopping_*`/benchmarks | **P1** | F2 |
| BL-12 | Remover renderer legado (`renderer/`, `daily:*`) | schema incompatível vivo | T,E | fonte única de render | M | B | migrar `daily/preview` | B | `renderer/` ausente; preview canônico | **P1** | F2 |
| BL-13 | Papéis e permissões (RBAC) | admin único; sem separação | O,T | governança | A | A | decisão de papéis (DP-05) | M | login por identidade; matriz §6/§7 aplicada | **P1** | F2 |
| BL-14 | Teste de paridade Forecast TS↔mjs | divergência silenciosa | A,T | confiabilidade | M | B | — | B | CI falha se saídas divergem | **P2** | F2 |
| BL-15 | Cron do `forecast.mjs` | artefato só atualiza manual | A | radar sempre fresco | M | B | — | B | `forecast.json` atualizado por cron | **P2** | F2 |
| BL-16 | Publicação Beehiiv via via única + registrar MCP | 3 vias; live sem gate | R,T | envio governado | A | M | política escrita (DP-08) | M | todo post com `provenance` de gate | **P2** | F2 |
| BL-17 | Dispatch admin com `edition_path` | publica `latest.json`, não a edição do banco | R | consistência banco↔arquivo | M | B | — | B | publica a edição selecionada | **P2** | F2 |
| BL-18 | UI de CRUD de SKU/fonte | catálogo só por SQL | D | operação sem SQL | M | M | — | B | adicionar SKU pela UI | **P2** | F3 |
| BL-19 | Régua de e-mail (Beehiiv Automations) | sem nutrição | E,C | hábito → upsell | M | M | BL-02 | B | D0/D3/D7 + convite Pro por engajamento | **P2** | F3 |
| BL-20 | Rate-limit em store externo (KV) | in-memory frágil | T | proteção real | B | B | KV | B | limite compartilhado entre instâncias | **P3** | F3 |
| BL-21 | Vercel Analytics + pageviews | otimização às cegas | A | medição de página | M | B | — | B | pageviews/eventos no painel | **P3** | F1 |
| BL-22 | Ligar via de publicação Weekly/Pro | artefatos presos | E | Weekly/Pro publicáveis | M | M | BL-16 | B | publisher lê `out/weekly`/`out/pro-email` | **P3** | F3 |
| BL-23 | Predict Fase 0 (série rica + catálogo `programs`) | `series_key` placeholder | A | previsão homogênea | A | A | decisão motor canônico (DP-01), extração v2 | A | séries com mercado/segmento/mecânica reais | **P3** | F3 |
| BL-24 | Reconciliador Forecast↔Predict + Predict no digest | motor robusto isolado | A,E | previsão confiável no produto | A | M | BL-23 | M | rota com Predict `ready` aparece no digest | **P3** | F3 |
| BL-25 | Extração v2 (schema rico + estados) | campos ricos ausentes | A | base do Predict | A | A | DP-01 | A | RFC-009 Fase 1 entregue | **P3** | F3 |
| BL-26 | Backfill observável (cobertura por fonte/mês) | cobertura desconhecida | D,A | previsão sai do bloqueio | M | A | — | M | `cobertura_estimada` por programa/mês | **P3** | F3 |
| BL-27 | Matching automático (EAN/MPN + `sameProduct`) | curadoria manual; código morto | D | escala de catálogo | M | M | BL-09 | M | `match_confidence` computado, não fixo | **P3** | F3 |
| BL-28 | Monetização Pro (preço + gateway + gate) | vitrine sem cobrança | O | receita | A | M | decisão preço/gateway (DP-03) | M | 1 assinatura paga ponta-a-ponta | **P3** | F3 |
| BL-29 | `robots noindex` no relatório Pro até haver gate | Pro público indexável | E,O | proteção de valor | B | B | — | B | `/pro/[periodo]` não indexado | **P2** | F1 |
| BL-30 | Brier + precisão out-of-sample do Predict | calibração incompleta | A | previsão calibrada | M | M | BL-23 | B | Brier por janela em `predict_snapshots` | **P4** | F3 |
| BL-31 | Reconciliar método estatístico (MAD×IQR) | dois métodos sem reconciliação | D,T | banda coerente | B | B | BL-10 | B | método único documentado | **P4** | F3 |
| BL-32 | Exibir histórico de snapshots do Predict | `getSnapshots` não usado | A | análise temporal | B | B | — | B | página mostra snapshots | **P4** | F3 |

---

## 12. Decisões que dependem do usuário

Decisões que o código não pode tomar sozinho. Cada uma: contexto · alternativas ·
vantagens · desvantagens · recomendação · impacto de adiar.

### DP-01 — Motor de previsão canônico (Forecast × Predict)
- **Contexto.** Dois motores sobre o mesmo ledger; RFC-009 define convivência
  (Predict `ready` = verdade), mas nada reconcilia; Predict isolado.
- **Alternativas.** (a) Manter Forecast como única fonte e congelar o Predict;
  (b) completar o Predict (Fase 0–3) e reconciliar; (c) aposentar o Forecast.
- **Vantagens/Desvantagens.** (a) barato, mas abre mão do motor auditável;
  (b) previsão auditável e explicável, porém esforço alto e depende de backfill;
  (c) perde o radar barato sempre-ligado.
- **Recomendação.** **(b)** — convivência com reconciliador, investindo primeiro
  num programa-alvo (MVP do RFC). Manter Forecast no digest até o Predict alimentar.
- **Impacto de adiar.** Esforço do Predict continua sem chegar ao produto; duas
  "verdades" de janela seguem divergindo sem medição.

### DP-02 — Política de publicação (automática × com aprovação)
- **Contexto.** Regra de ouro atual: nenhum e-mail sem ação humana; workflow com
  confirm/reviewer.
- **Alternativas.** (a) Manter 100% manual; (b) auto-publicar após QA verde;
  (c) auto-agendar com janela de veto humano.
- **Vantagens/Desvantagens.** (a) segurança máxima, gargalo humano; (b) escala,
  risco de publicar erro; (c) equilíbrio, mais complexo.
- **Recomendação.** **(a) agora**, migrar para **(c)** quando houver histórico de
  QA confiável e trilha de auditoria (C29).
- **Impacto de adiar.** Cadência limitada pela disponibilidade humana — aceitável
  no estágio atual (0 edições reais).

### DP-03 — Preço e ciclo do Pro
- **Contexto.** Pro é vitrine+waitlist; sem preço definido.
- **Alternativas.** mensal × anual; faixas de preço; freemium de profundidade.
- **Vantagens/Desvantagens.** anual melhora caixa/retenção; mensal reduz atrito.
- **Recomendação.** testar faixa com a **waitlist segmentada por perfil** antes de
  fixar; ancorar contra "custo do erro evitado", nunca ganho prometido.
- **Impacto de adiar.** Sem preço, não há gateway nem receita Pro; waitlist esfria.

### DP-04 — Gateway de pagamento
- **Contexto.** Zero SDK de pagamento no código.
- **Alternativas.** Stripe × Beehiiv Premium Subscriptions × outro.
- **Vantagens/Desvantagens.** Stripe = controle/flexibilidade, mais integração;
  Beehiiv Premium = nativo à base, menos controle e travado no Beehiiv.
- **Recomendação.** se o gate de conteúdo for o próprio e-mail/site, **Beehiiv
  Premium** encurta caminho; se houver produto web rico (radar/export),
  **Stripe + gate próprio**. Decidir junto de DP-03.
- **Impacto de adiar.** Monetização Pro bloqueada.

### DP-05 — Papéis e permissões
- **Contexto.** Admin único; matriz §6/§7 é proposta.
- **Alternativas.** manter admin único; RBAC leve (3–4 papéis); RBAC completo (9).
- **Vantagens/Desvantagens.** único = simples/inseguro; completo = governança/
  esforço.
- **Recomendação.** **RBAC leve primeiro** (Owner, Técnico, Editorial, Dados) e
  expandir; habilita a auditoria (C29).
- **Impacto de adiar.** Sem separação nem auditoria — risco à credibilidade do
  "julgamento auditável".

### DP-06 — Retenção de dados
- **Contexto.** Observações VPM append-only; `runs`/logs sem política; leads no
  Beehiiv (LGPD).
- **Alternativas.** reter tudo; janela (ex.: 24 meses) com sumarização; purga.
- **Recomendação.** reter observações/campanhas (base do histórico); definir janela
  para logs de execução; leads conforme LGPD (direito de exclusão via Beehiiv).
- **Impacto de adiar.** Crescimento de tabelas e risco LGPD sem política.

### DP-07 — Uso de login nos marketplaces (coleta VPM)
- **Contexto.** Alguns portais só exibem pontos logados; coleta é o gargalo (C15).
- **Alternativas.** (a) só dado deslogado (aceitar lacunas); (b) sessão autenticada
  headless; (c) API interna do portal quando exposta.
- **Vantagens/Desvantagens.** (a) simples/limitado; (b) cobre mais, risco de ToS/
  bloqueio/credencial; (c) frágil a mudanças.
- **Recomendação.** começar por **(a)+(c)**; avaliar **(b)** só com clareza de ToS
  e credencial dedicada. **Fronteira inviolável mantida:** só dado público de
  catálogo.
- **Impacto de adiar.** Radar segue no seed; VPM do Pro sem dado vivo.

### DP-08 — Estratégia Beehiiv CLI × MCP
- **Contexto.** 3 vias; a única publicação real usou MCP (sem gate).
- **Alternativas.** (a) proibir MCP para publicar (só workflow/CLI); (b) permitir
  MCP com passo obrigatório de QA+registro no ledger.
- **Recomendação.** **(a)** para envio; MCP só para leitura/depuração. Se (b),
  automatizar o registro no ledger.
- **Impacto de adiar.** Risco recorrente de publicar sem QA/idempotência.

### DP-09 — Fonte de preço de referência (VPM)
- **Contexto.** VPM = `reference_price/points`; `reference_price` vem da observação
  do portal (preço listado).
- **Alternativas.** preço do próprio portal de resgate; preço de mercado externo
  (varejo); média de múltiplas fontes.
- **Vantagens/Desvantagens.** portal = coerente com o resgate, mas pode ser
  inflado; mercado externo = mais "justo", porém outra coleta.
- **Recomendação.** manter **preço observado do portal** como base (coerência), e
  avaliar um comparativo de varejo como contexto — **sempre observado, nunca
  estimado** (regra inviolável).
- **Impacto de adiar.** Interpretação do VPM permanece dependente do preço do portal.

### DP-10 — Primeira edição real de produção
- **Contexto.** 100% do conteúdo é `illustrative`; pipeline provado.
- **Alternativas.** iniciar Daily agora; esperar o Radar/Predict; esperar régua.
- **Recomendação.** **iniciar o Daily** (o motor já suporta) em paralelo às
  fundações; o produto editorial não depende do Radar/Predict para começar.
- **Impacto de adiar.** Sem produto vivo, não há aquisição/retenção reais para
  medir nada do funil.

---

## 13. Recomendação das próximas três fases

Sequência pensada para **destravar valor com o menor risco primeiro** e só então
consolidar e expandir. Cada fase é entregável e mensurável.

### Fase 1 — Fundação de confiança e captura (semanas 1–3)
**Tese:** tornar o que já existe **seguro, versionado e mensurável** — e não perder
lead. Itens: **BL-01** (versionar RPCs `admin_*`), **BL-02** (Beehiiv em prod +
alerta), **BL-03** (persistir track/contato), **BL-04**+**BL-13-leve** (auditoria +
RBAC mínimo), **BL-05** (versionar view), **BL-06/BL-07** (QA do admin = pipeline,
regras únicas), **BL-08** (remover fallbacks, login constant-time), **BL-21**
(analytics), **BL-29** (noindex Pro), **DP-10** (1ª edição real).
**Resultado:** operação reproduzível, leads capturados de verdade, gate editorial
confiável, primeira edição no ar. **Aceite:** ambiente novo sobe só das migrations;
e-mail próprio cai no Beehiiv; 1 edição real APROVADA publicada com trilha de autor.

### Fase 2 — Consolidação e desbloqueio (semanas 4–7)
**Tese:** remover as duplicações que geram risco e **destravar o Radar**. Itens:
**BL-09** (afinar adapters — DP-07), **BL-10/BL-11** (aposentar Gen-1, Pro em
Gen-2), **BL-12** (remover renderer legado), **BL-13** (RBAC completo), **BL-14/BL-15**
(paridade + cron do Forecast), **BL-16/BL-17** (via única de publicação, dispatch
correto). **Resultado:** uma geração de coletor, um renderer, um caminho de
publicação, governança por papel, Radar coletando ao vivo (≥1 programa).
**Aceite:** `grep` sem leitores de `sku_*`; `renderer/` removido; ≥1 rodada de
coleta `success`; toda publicação com `provenance` de gate.

### Fase 3 — Crescimento e inteligência (semanas 8–14)
**Tese:** com base sólida, **abrir receita e elevar a previsão ao produto**. Itens:
**BL-19** (régua de e-mail), **BL-28**+DP-03/DP-04 (monetização Pro), **BL-18**
(UI de catálogo), **BL-22** (publicar Weekly/Pro), **BL-23/BL-24/BL-25/BL-26**
(Predict Fase 0–3 + reconciliador + extração v2 + backfill observável — DP-01),
**BL-27** (matching automático). **Resultado:** funil gratuito→pago fechado,
Predict auditável alimentando o digest, catálogo operável sem SQL.
**Aceite:** 1 assinatura Pro paga ponta-a-ponta; rota com Predict `ready` no digest;
régua ativa no Beehiiv.

> **P4 (contínuo):** BL-30/BL-31/BL-32 (Brier, método estatístico único, histórico
> de snapshots) entram como otimização ao longo da Fase 3+.

---

## Validação de cobertura

Confirmação de que **nenhuma funcionalidade encontrada ficou sem classificação**.
As 26 do pedido + 3 extras identificadas no código estão em fichas (§3) e no mapa
(§2):

- Pedido 1–26 → C01 (site), C02 (assinatura), C03 (arquivo), C07/C08/C09
  (Daily/Weekly/Pro), C10 (Beehiiv), C13 (Radar VPM), C14 (SKUs), C15 (coleta),
  C16 (matching), C17 (benchmarks), C19 (campanhas), C20 (notícias), C21 (backfill),
  C22 (forecast), C23 (predict), C11 (digests), C24 (jobs), C25 (logs), C26
  (observabilidade), C27 (autenticação), C28 (config/secrets), C12 (skills), C04
  (monetização Pro), C05 (contato/anunciantes).
- **Extras encontradas no código (não listadas explicitamente):** **C06**
  rastreamento (track), **C18** coletor VPM Gen-1 (`sku_*`, legado), **C29**
  auditoria de mutações (gap).
- **Capacidades documentais/futuras registradas mas não implementadas** (para não
  ficarem sem menção): **RFC-001 EKS** (sistema de conhecimento editorial — draft
  fundador, não implementado); produtos **Lab** e **Special** citados em schemas/
  digests mas sem pipeline próprio (tratados dentro de C11/C07); **régua de e-mail**
  e **automações Beehiiv** (fora do repo — plano em `MONETIZACAO-BACKLOG.md`,
  cobertos em C02/C19-jornada 5.3 e BL-19).

Nada encontrado no repositório permaneceu sem estado (§2) e sem ficha (§3).

---

*Fim do documento. Etapa de análise — nenhum código, banco, migration, secret ou
publicação foi alterado.*
