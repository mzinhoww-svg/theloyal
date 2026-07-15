# Análise de Conversão — The Loyal

> Diagnóstico de código, infraestrutura (Vercel/GitHub) e da landing page
> `www.theloyal.com.br`, com foco em **aquisição, conversão de lead em
> assinante e monetização** (gratuito → pago).
>
> Complementa o plano de execução em [`PLANO-CONVERSAO.md`](./PLANO-CONVERSAO.md).
> Documento interno de estratégia — não substitui as regras invioláveis do
> `CLAUDE.md`, que têm precedência.

---

## 0. Escopo e método

Analisado: os arquivos da landing (`app/page.tsx`, `layout.tsx`, `globals.css`,
`tailwind.config.ts`, `components/shell.tsx`, `sections.tsx`, `EdicaoMock.tsx`,
`ui.tsx`, `graphics.tsx`, `PontoMascot.tsx`, `SubscribeForm.tsx`, `app/icon.svg`,
`apple-icon.png`, `api/subscribe/route.ts`, `CLAUDE.md`, `COPY-LANDING.md`), o
inventário de variáveis de ambiente do código, o projeto Vercel e o site
publicado.

---

## 1. Variáveis internas (código, Vercel, GitHub)

### 1.1 Variáveis de ambiente usadas no código

| Variável | Onde é lida | Função | Sem ela |
|---|---|---|---|
| `BEEHIIV_API_KEY` / `BEEHIIV_PUBLICATION_ID` | `api/subscribe/route.ts`, `scripts/beehiiv-publish.mjs` | Inscrição + publicação de edições | Modo mock (sucesso/dry-run simulado) |
| `ADMIN_TOKEN` | `middleware.ts`, `app/admin/login/actions.ts` | Senha única do painel `/admin` (cookie httpOnly SHA-256) | Login não autentica |
| `ADMIN_USER` / `ADMIN_PASSWORD` | `lib/admin.ts`, `app/admin/collect`, `app/admin/sku` | Basic auth legado do Radar | Endpoints do Radar respondem 401 |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | `lib/admin-db.ts`, `lib/admin.ts`, `scripts/collect/*`, `scripts/forecast.mjs`, `scripts/pro-vpm.mjs` | Motor do painel e do Radar | Painel em modo leitura vazia |
| `TAVILY_API_KEY` | `scripts/collect/tavily.mjs` | Descoberta de SKUs | Coletor em modo mock |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` / `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | `scripts/collect/llm.mjs` | Classificação por LLM no coletor | Coletor em modo mock |
| `GH_DISPATCH_TOKEN` / `GH_REPO` / `GH_COLLECT_WORKFLOW` / `GH_COLLECT_REF` | `app/admin/collect/route.ts` | Dispara o workflow do coletor via `workflow_dispatch` | Coletor não dispara pelo painel |

Todas server-only. `SUPABASE_URL` já vem preenchida no `.env.example`
(`https://qjqnqcsdnpvvmyzkavoq.supabase.co`); as chaves ficam vazias no exemplo.
Nenhuma credencial versionada no repo (correto). O `.env.example` está completo
e bem documentado.

### 1.2 Vercel (projeto `theloyal`)

- Framework **Next.js**, Node **24.x**. Último deploy inspecionado: **READY**.
- Domínios: `theloyal.com.br`, `www.theloyal.com.br` (+ previews de branch).
  Apex e www ligados.
- Os **valores** das env vars são secretos e não foram lidos (nem devem ser via
  API). O inventário acima vem do código e do `.env.example`.

### 1.3 GitHub

- Workflows em `.github/workflows/`: `ci.yml`, `beehiiv.yml` (publica edição no
  Beehiiv), `collect.yml` (coletor do Radar).
- Secrets do repositório não são legíveis por design.

---

## 2. Achado central: drift entre produção e repositório

**Fato verificado em campo (usuário):** o formulário de `www.theloyal.com.br`
subscreve no Beehiiv normalmente — captura de lead **funciona em produção**.

**Fato verificado no código:** em **todas** as branches do repositório (inclusive
`main`), `components/SubscribeForm.tsx` está no **mock** —
`await new Promise(r => setTimeout(r, 900))` seguido de estado de sucesso,
**sem** chamada de rede. A rota `app/api/subscribe/route.ts` (com honeypot,
rate-limit e chamada real ao Beehiiv) existe, mas **nenhum componente a chama**.

**Conclusão:** o que roda em produção **não é reproduzível a partir do `main`**.
Isso é um risco operacional real, não um bug de UX:

> ⚠️ **Risco de regressão (P1):** um novo deploy a partir do `main` pode
> substituir o form funcional pelo mock e passar a **descartar silenciosamente
> todos os leads** (o mock mostra "sucesso" mesmo sem enviar nada). O usuário
> não veria erro; os cadastros simplesmente parariam de chegar ao Beehiiv.

**Ação recomendada:** reconciliar o repositório com o que está em produção —
fazer o `SubscribeForm` chamar `POST /api/subscribe` (a rota já está pronta) e
garantir que `main` reflita o comportamento vivo. Detalhe no plano, item P0-A.

---

## 3. Landing — o que está forte (preservar)

- **Proposta clara e honesta:** "faz a conta em reais e diz se vale a pena".
- **Método auditável** como diferencial (TL Score, fórmula pública, fontes).
- **Tom Sage** consistente; o mascote Ponto funciona como prova de ceticismo,
  não como selo.
- **Foco:** um único CTA primário (e-mail grátis). Raro e correto.
- **Acessibilidade** e disciplina de marca (tokens, sem urgência artificial,
  sem emoji, disclaimer presente).

Nada disso deve ser diluído pelas melhorias.

---

## 4. Landing — lacunas de conversão

| # | Lacuna | Impacto | Onde |
|---|---|---|---|
| L1 | Sem prova social / números | Cético não tem âncora de confiança social | Hero, CTA final |
| L2 | Sem imagem OG | Todo compartilhamento sai sem card → perde CTR orgânico | `app/layout.tsx` (metadata sem `images`) |
| L3 | Links de rodapé mortos | *Sobre*, *Anuncie*, *Privacidade* = `href="#"` | `components/shell.tsx` |
| L4 | Sem página `/privacidade` | Risco de LGPD ao capturar e-mail | inexistente |
| L5 | Sem página `/anuncie` | Rodapé e marca prometem, mas não entregam | inexistente |
| L6 | `/pro` sem captura de intenção | "Pro" é só um card "Em breve"; não há lista de espera | `app/pro/page.tsx` existe, mas não capta |
| L7 | Sem analytics/eventos | Otimização às cegas: não se mede view→submit→sucesso | ausente no `layout.tsx` |
| L8 | Prova de valor só ilustrativa | O mock de edição diz "números de exemplo"; há `app/edicao/[numero]` real não linkado da landing | `EdicaoMock.tsx` vs `app/edicao` |
| L9 | CTA único e estático | Sem sticky CTA no mobile; segunda captura só no fim | `shell.tsx` / `page.tsx` |

Observação sobre L6: o motor do produto pago **já existe** no repo
(`app/pro/[periodo]`, Radar/Supabase, `scripts/pro-vpm.mjs`,
`scripts/forecast.mjs`). O que falta é a **camada de captura e a régua de
upsell**, não a tecnologia.

---

## 5. Gatilhos mentais aplicáveis (dentro das regras invioláveis)

As regras proíbem urgência artificial, emoji e promessa de ganho. Gatilhos
**honestos** compatíveis com a marca Sage:

- **Autoridade / método** — tornar o método visível e alto (TL Score 0–100,
  8 critérios com pesos). É o diferencial; hoje aparece tarde na página.
- **Prova social real** — quando houver volume, "N leitores recebem às 8h".
  Enquanto não há, usar **prova de processo**: nº de edições publicadas, ofertas
  analisadas, quantas viraram "Não confirmado". Honestidade vira prova.
- **Reciprocidade** — entregar valor **antes** do e-mail (lead magnet).
- **Antecipação / consistência** — o ritual "todo dia útil às 8h" é gatilho de
  hábito; já explorado no CTA final, pode subir para o hero.
- **Aversão à perda honesta** — não countdown. Mas "essa oferta vence quinta
  23h59, a conta já está feita na edição" é *editorial*, não venda.
- **Especificidade** — números concretos (R$ 34 → R$ 24 → R$ 16) convertem mais
  que adjetivos. Já é praticado; ampliar.

---

## 6. Régua de ciclo de vida (visão)

```
VISITANTE
  │  landing + lead magnet + card OG
  ▼
LEAD (e-mail no Beehiiv)              ← funciona em prod; reconciliar no repo
  │  double opt-in + boas-vindas ("a 1ª conta")
  ▼
ASSINANTE ATIVO (abre o Daily das 8h)
  │  scoring de engajamento (aberturas/cliques do Beehiiv)
  │  Weekly + Lab (evergreen) constroem confiança
  ▼
LEAD QUENTE PARA PRO                  ← identificado por engajamento
  │  upsell contextual, não intrusivo
  ▼
ASSINANTE PAGO (Pro mensal)
```

**Gratuito → pago (The Loyal Pro):**

- **Fica grátis** (hábito, topo de funil): sinal do dia, 1 Deal Desk analisado,
  veredito. É o que cria o vício das 8h.
- **Vira Pro** (o que o heavy user/profissional paga): base histórica de
  CPM/VPM por categoria, radar de **todas** as ofertas vigentes ranqueadas,
  benchmarks, alertas por perfil, export. O motor já existe no repo.
- **Gatilho de upgrade honesto:** não travar o conteúdo diário; travar
  **profundidade e histórico**. "Hoje você viu 1 conta. O Pro mostra as 40
  ofertas vigentes ranqueadas."
- **Ancoragem de preço:** enquadrar contra o custo do erro evitado ("uma
  transferência errada custa R$ 200; o Pro custa R$ X/mês"). Sem prometer ganho.

---

## 7. Resumo dos achados por severidade

| Sev | Achado | Ação |
|---|---|---|
| 🔴 P0 | Drift produção↔repo no `SubscribeForm` (mock no `main`) | Reconciliar: form chama `/api/subscribe` |
| 🟠 P1 | Sem `/privacidade` (LGPD) | Criar página |
| 🟠 P1 | Sem analytics/eventos de conversão | Instrumentar |
| 🟠 P1 | Sem imagem OG | `opengraph-image` dinâmica |
| 🟠 P1 | Links de rodapé mortos | Ligar às páginas reais |
| 🟡 P2 | Sem prova social / sticky CTA mobile | Hero + CTA |
| 🟡 P2 | `/anuncie` inexistente | Media kit |
| 🟡 P2 | `/pro` sem captura de lista de espera | Form de intenção |
| 🟡 P2 | Edição real não linkada como prova | Linkar `app/edicao` |
| 🟢 P3 | Rate-limit em memória no `route.ts` | Migrar p/ KV quando escalar |

O plano de execução com sequência, esforço e critérios de aceite está em
[`PLANO-CONVERSAO.md`](./PLANO-CONVERSAO.md).
