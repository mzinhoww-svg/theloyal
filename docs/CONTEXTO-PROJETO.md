# Contexto do Projeto — The Loyal

> **Para o GPT:** este documento descreve o projeto The Loyal. Sua tarefa é, a
> partir de um pedido que eu (usuário) te der, **escrever um prompt refinado e
> preciso para o Claude Code** — um assistente agêntico que trabalha direto no
> repositório (edita arquivos, roda build/testes, abre PR). Use o contexto abaixo
> para que o prompt cite os subsistemas/arquivos certos, respeite as regras
> invioláveis, e peça validação (build + QA) e um PR draft ao final. Se o pedido
> for ambíguo, instrua o Claude a perguntar antes de agir. **Não invente
> arquivos, tabelas ou comandos que não estejam listados aqui.**

---

## 1. O que é

The Loyal é uma **mídia vertical independente** (pt-BR) sobre loyalty: pontos,
milhas, cartões, bancos, varejo, cashback, CRM e comportamento de consumo. Não é
blog de cupom, não é comunicação oficial de programa, não é SaaS genérico.

- Personalidade: analítico, independente, premium editorial. Arquétipo **Sage** —
  autoridade vem do método, não do tom.
- Promessa: em ~5 min o leitor entende o que mudou, por que importa, qual é a
  conta (em reais) e qual é o risco.
- Regra-mãe visual: *a imagem é dado* (data-art, não stock).
- Mascote **Ponto** (vira-lata caramelo cético) — companheiro do leitor, não selo.

## 2. Stack e regras de código (inegociáveis)

- **Next.js 14 (App Router) · TypeScript strict · Tailwind. ZERO outras
  dependências** de runtime (nada de framer-motion, shadcn, lucide, etc.).
- Cores só via **tokens da marca** (tailwind.config.ts). **Proibido hex hardcoded**
  em componente — exceção: `PontoMascot.tsx`, `graphics.tsx`, `opengraph-image.tsx`
  (assets gerados). Nenhuma cor default do Tailwind (slate/zinc/emerald…), nenhum
  `bg-white`/`text-white`. Fundo de página Paper `#FAF7F0`, cards Surface.
- Números de análise em **JetBrains Mono**; serif (Fraunces) só em títulos.
- **Regras invioláveis** (não quebrar nem a pedido no meio da tarefa):
  1. Nunca dado interno de empresa / CMI / métrica proprietária.
  2. Redação sempre própria (nunca copiar fonte externa).
  3. Nunca prometer ganho.
  4. Nunca urgência artificial ("corra", countdown, vermelho de urgência).
  5. Nunca emoji no corpo editorial ou UI.
  6. Nunca avião/cartão 3D/stock/gradiente decorativo.
  7. Amarelo `#F2C94C` nunca como texto; verde de texto/semântico em fundo claro
     é green-700 (`#007A57`), hover green-800 (`#005A3B`); green-600 (`#00A878`) e
     green-500 só em fill/SVG e sobre Ink (D-090 op.2).
  8. Faltou dado → classificar **"Não confirmado"**. Nunca chutar.
  9. Conteúdo com recomendação leva o disclaimer padrão.
- Acessibilidade é gate: `lang="pt-BR"`, skip link, uma única `h1`, AA, alvos
  ≥44px, `prefers-reduced-motion`.
- **`CLAUDE.md` na raiz governa tudo e tem precedência sobre a estética de
  qualquer skill.**

## 3. Subsistemas (arquitetura)

1. **Site público / growth** — `app/page.tsx` + `components/{shell,sections,ui,
   graphics,PontoMascot,SubscribeForm,EdicaoMock}.tsx`. Rotas públicas: `/`
   (landing), `/edicao` (arquivo de edições — puxa posts reais do Beehiiv via
   `lib/beehiiv-editions.ts`, ISR 1h), `/edicao/[numero]` (leitura de edição via
   JSON, hoje fixture ilustrativa), `/pro` (índice + waitlist), `/pro/[periodo]`
   (relatório executivo), `/guia/cpm` (lead magnet), `/anuncie` (media kit),
   `/sobre`, `/privacidade`. APIs: `/api/subscribe` (Beehiiv, honeypot,
   rate-limit, aceita `source`/`perfil`), `/api/track` (telemetria própria via
   beacon → Vercel Logs), `/api/contato` (B2B). Captura de lead **funciona em
   produção**.
2. **Pipeline editorial** — JSON (conforme `content/edition.schema.json`,
   `weekly.schema.json`, `pro-report.schema.json`) → `renderer/*` +
   `scripts/{validate,render,render-web,qa,publish,beehiiv-publish}.mjs` →
   e-mail HTML / plain text / página web / publicação Beehiiv. Três produtos:
   **Daily** (seg–sex), **Weekly** (fim de semana), **Lab/Pro**. QA gate editorial
   (`scripts/qa.mjs`, roda no CI como **editorial-gate**) bloqueia quebra de regra
   inviolável. Publisher é idempotente e roda em mock sem credencial.
3. **Motor de dados — Radar de VPM (Shopping)** — `scripts/collect-skus.mjs` +
   `scripts/collect/*` (Tavily descobre URLs, OpenRouter/LLM extrai, adapters
   `azul/smiles/latam`), estatística de banda, escrita no Supabase (`sku_catalog`,
   `sku_sources`, `sku_observations`, `retail_valuations`, `runs`). Fronteira
   inviolável: **só VPM observado de catálogo público**; CMI/dado interno é
   bloqueado pelo gate `INTERNAL_RE`. Injeta no Pro via `npm run pro:vpm`. Ver
   `docs/RADAR-VPM.md` e `docs/SHOPPING-VPM.md`. **Em grande parte mock** até ter
   os secrets do Supabase e adapters afinados (portais são SPA/exigem login).
4. **Motor de previsão (predict/forecast)** — `lib/{predict-engine,forecast}.ts`,
   `scripts/forecast*.mjs`, `content/forecast.json`. Estima janelas (ex.: bônus de
   transferência) com confiança alta/média/baixa; aparece no `radar[]` do Daily e
   no admin. Regra 8 vale: sem dado → "Não confirmado".
5. **Painel admin** — `app/admin/(panel)/*`: dashboard, backfill, campanhas,
   digests, forecast, jobs, logs, noticias, observability, predict, shopping-vpm.
   Protegido por `middleware.ts` (cookie SHA-256 do `ADMIN_TOKEN`); endpoints do
   Radar (`/admin/sku`, `/admin/collect`) têm Basic Auth própria. Dados via
   Supabase (`lib/admin-*.ts`); sem `SUPABASE_SERVICE_KEY` degrada para leitura
   vazia.
6. **Integração Beehiiv** — publicação de edições (`scripts/beehiiv-publish.mjs`)
   e inscrição (`/api/subscribe`). Publication real: `pub_ff1dca66-...`
   (`theloyal.beehiiv.com`). MCP do Beehiiv disponível.
7. **Skills de agente** — `.claude/skills/` (as `tl-*` do projeto + pacote de
   design instalado: impeccable, apple-design, layers-*, taste, etc.). Uso em
   sessões de aprimoramento; não são código de produto.

## 4. Estado atual e pendências

- **Live:** landing com captura funcional; `/edicao` puxando edições reais do
  Beehiiv; docs de conversão e backlog de monetização (`docs/ANALISE-CONVERSAO.md`,
  `PLANO-CONVERSAO.md`, `MONETIZACAO-BACKLOG.md`).
- **Pendências de operador (fora do código, no painel):**
  - Setar `BEEHIIV_API_KEY` / `BEEHIIV_PUBLICATION_ID` em produção na Vercel
    (sem elas, `/api/subscribe` e `/edicao` caem em mock/empty state).
  - Montar as automações de e-mail no Beehiiv (régua boas-vindas → D3 → D7 →
    convite Pro).
  - Secrets do Supabase + Tavily + OpenRouter para o Radar sair do mock.
- **Produto pago (Pro):** motor existe; falta preço, gateway e abrir o beta.

## 5. Como o Claude Code opera neste repo (para calibrar o prompt)

- Trabalha na branch **`claude/clever-mendel-3mevif`**, base
  **`claude/loyalty-landing-page-v1-7vbjq7`**. Abre **PR draft**, valida com
  `npm run build` e `npm run qa` (o **editorial-gate** do CI precisa passar).
- Tem MCP de **GitHub, Vercel, Beehiiv, Supabase** disponível.
- Comandos úteis: `npm run dev/build/qa/validate/render/edition/beehiiv`,
  `daily:*`, `weekly`, `collect`, `pro:vpm`, `forecast`.

## 6. Instrução final ao GPT (o que gerar)

Ao receber meu pedido, produza **um prompt para o Claude Code** contendo:
1. **Objetivo** claro e o resultado esperado.
2. **Subsistema e arquivos** prováveis (da seção 3).
3. **Restrições**: respeitar as regras invioláveis e os tokens; sem dependência
   nova; sem hex fora das exceções.
4. **Validação exigida**: `npm run build` + `npm run qa` verdes; abrir PR draft.
5. **Quando perguntar**: se o pedido tocar arquitetura, preço, dado externo ou
   for ambíguo, instruir o Claude a usar AskUserQuestion antes de codar.
Escreva o prompt em português, direto e sem floreio.
