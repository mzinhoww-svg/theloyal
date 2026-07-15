# Plano de Conversão — The Loyal

> Plano de execução para colocar em prática o diagnóstico de
> [`ANALISE-CONVERSAO.md`](./ANALISE-CONVERSAO.md): captura confiável de lead,
> ativos de aquisição, régua de ciclo de vida e caminho gratuito → pago.
>
> **Toda entrega respeita as regras invioláveis do `CLAUDE.md`** (sem urgência
> artificial, sem emoji no corpo/UI, sem promessa de ganho, disclaimer quando há
> recomendação, tokens de cor, uma única `h1`, AA, `prefers-reduced-motion`).
> Nenhum hex fora de `PontoMascot.tsx`/`graphics.tsx`. `npm run build` deve
> compilar sem erro a cada fase.

---

## Como ler este plano

Cada item traz: **objetivo**, **arquivos**, **passos**, **critério de aceite**.
As fases são incrementais e independentes — dá para entregar e medir uma a uma.
Ordem recomendada: **Fase 0 → 1 → 2 → 3**. A Fase 0 destrava receita e proteção
básica; sem ela, otimizar o resto rende pouco.

---

## Fase 0 — Fundação de captura e conformidade (destrava tudo)

### P0-A · Reconciliar o formulário com produção (eliminar o drift)

- **Objetivo:** garantir que o `main` reproduza o comportamento vivo (o form
  envia ao Beehiiv) e que um redeploy nunca regrida para o mock que descarta
  leads em silêncio.
- **Arquivos:** `components/SubscribeForm.tsx` (front), `app/api/subscribe/route.ts` (já pronto).
- **Passos:**
  1. Substituir o trecho mock (`await new Promise(setTimeout 900)`) por:
     `const res = await fetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, empresa }) })`.
  2. Enviar também o honeypot `empresa` (a rota já o trata server-side).
  3. Tratar respostas reais: `ok` → sucesso; `invalid_email` → erro de e-mail;
     `rate_limited` (429) → mensagem "muitas tentativas, tente em 1 minuto";
     `provider_error`/rede → erro genérico com opção de tentar de novo.
  4. Manter as mensagens de voz do Ponto já existentes (sucesso/erro).
  5. Preservar honeypot e `aria-live` (acessibilidade).
- **Critério de aceite:** cadastro real cai no Beehiiv em produção **a partir do
  código do `main`**; e-mail inválido não chama a rota; 429 exibe mensagem
  correta; `npm run build` limpo. Confirmar `BEEHIIV_API_KEY` e
  `BEEHIIV_PUBLICATION_ID` presentes no ambiente de produção da Vercel (sem elas
  a rota volta ao mock server-side).

### P0-B · Página `/privacidade` (LGPD)

- **Objetivo:** base legal para capturar e-mail; requisito, não enfeite.
- **Arquivos:** `app/privacidade/page.tsx` (nova), `components/shell.tsx` (link do rodapé).
- **Conteúdo mínimo:** dados coletados (e-mail), finalidade (envio da newsletter),
  base legal (consentimento), operador (Beehiiv), direitos do titular, contato,
  como cancelar (um clique). Tom próprio, sem copiar modelo de terceiros.
- **Critério de aceite:** rota `/privacidade` renderiza; link do rodapé aponta
  para ela; AA e `lang="pt-BR"`; uma `h1`.

### P0-C · Analytics + eventos de conversão

- **Objetivo:** parar de otimizar às cegas — medir view → submit → sucesso.
- **Arquivos:** `app/layout.tsx` (montar o componente), `SubscribeForm.tsx` (evento).
- **Passos:**
  1. Adicionar **Vercel Analytics** e **Speed Insights** (nativos, sem custo de
     setup, sem cookie de terceiro). Alternativa privacy-first: Plausible.
  2. Emitir evento `subscribe_success` no retorno `ok` do form (e opcional
     `subscribe_submit` no envio) para medir taxa por origem.
- **Critério de aceite:** eventos aparecem no painel; nenhum hex/estilo fora dos
  tokens; sem violar `prefers-reduced-motion`.

**Saída da Fase 0:** captura confiável, conformidade legal e medição. A partir
daqui todo ganho é mensurável.

---

## Fase 1 — Ativos de aquisição (trazer gente nova)

> Item 4 do pedido: os ativos de aquisição estão priorizados aqui.

### P1-A · Imagem OG dinâmica (maior ROI/hora de aquisição orgânica)

- **Objetivo:** todo link compartilhado (WhatsApp, LinkedIn, X) vira um card com
  o Ponto + tese, elevando o CTR de quem nunca ouviu falar da marca.
- **Arquivos:** `app/opengraph-image.tsx` (Next gera on-the-fly), `app/layout.tsx`
  (`metadataBase` + `openGraph.images`).
- **Passos:** compor com tokens da marca (Paper de fundo, Ink, um único destaque
  verde), Fraunces no título, o selo TL. Sem stock, sem gradiente, sem avião.
- **Critério de aceite:** validar no debugger de OG do LinkedIn/WhatsApp; imagem
  1200×630; texto legível; contraste AA.

### P1-B · Lead magnet — "Como calcular o CPM antes de comprar pontos"

- **Objetivo:** reciprocidade — entregar valor antes do e-mail; vira também a
  isca para tráfego pago futuro.
- **Arquivos:** conteúdo evergreen (pode reaproveitar o Lab), página de captura
  dedicada ou modal, entrega por e-mail via Beehiiv.
- **Passos:** um guia curto (1–2 páginas) com a fórmula `CPM = R$ / (milhas ÷ 1.000)`
  e 3 exemplos reais. Entregar no e-mail de boas-vindas (double opt-in).
- **Critério de aceite:** novo lead recebe o guia; a promessa da isca não usa
  linguagem de ganho garantido; disclaimer presente.

### P1-C · Prova social/processo no hero + sticky CTA mobile

- **Objetivo:** dar âncora de confiança ao cético e uma segunda chance de
  conversão no scroll mobile.
- **Arquivos:** `components/shell.tsx` (Hero), `app/page.tsx` (sticky).
- **Passos:**
  1. Uma linha de prova **honesta** perto do form (ex.: "N edições publicadas ·
     todas com a conta aberta"). Enquanto não há volume de assinantes, usar
     prova de processo, nunca número inflado.
  2. Barra sticky discreta no mobile com o CTA "Receber grátis" que abre/foca o
     form — respeitando `prefers-reduced-motion` e alvos ≥ 44px.
- **Critério de aceite:** sem urgência artificial; a prova é verificável; sticky
  não cobre conteúdo nem quebra foco; AA.

### P1-D · Ligar rodapé + linkar 1 edição real como prova

- **Objetivo:** eliminar links mortos e trocar o mock ilustrativo por prova
  concreta.
- **Arquivos:** `components/shell.tsx` (rodapé), link para `app/edicao/[numero]`.
- **Critério de aceite:** *Sobre*, *Metodologia*, *Anuncie*, *Privacidade*
  apontam para páginas reais; a landing linka uma edição publicada.

---

## Fase 2 — Monetização B2B e intenção de pago

### P2-A · Página `/anuncie` (media kit)

- **Objetivo:** abrir receita de patrocínio cedo, no tom Sage.
- **Arquivos:** `app/anuncie/page.tsx` (nova), link do rodapé (feito na Fase 1).
- **Estrutura:** quem lê (os perfis já mapeados em `sections.tsx`) · números
  (quando reais) · formatos (patrocínio **sempre sinalizado antes do conteúdo**,
  já é regra da marca — vira argumento de venda) · política de independência ·
  formulário de contato B2B (reaproveita a infra de form/route).
- **Critério de aceite:** rota renderiza; nenhuma métrica inventada; disclaimer
  de patrocínio explícito; AA.

### P2-B · `/pro` com captura de lista de espera

- **Objetivo:** transformar o card "Em breve" em captura de intenção de pagar e
  segmentação antecipada.
- **Arquivos:** `app/pro/page.tsx` (já existe — adicionar captura).
- **Passos:** form de lista de espera (e-mail + perfil: consumidor / heavy user /
  profissional). Gravar segmento no Beehiiv (custom field) para a régua de
  upsell. Descrever o valor do Pro sem prometer retorno financeiro.
- **Critério de aceite:** lead de waitlist entra segmentado; copy sem promessa de
  ganho; disclaimer presente.

---

## Fase 3 — Régua e caminho gratuito → pago

### P3-A · Régua de e-mail (Beehiiv Automations)

- **Objetivo:** transformar cadastro em hábito e hábito em cliente.
- **Sequência sugerida:**
  - **D0** boas-vindas + lead magnet ("sua 1ª conta").
  - **D3** "como ler o TL Score" (ensina a usar o produto).
  - **D7** "sua primeira conta real" (mostra uma edição forte).
  - **Após N aberturas** convite ao Pro (gatilho por engajamento, não por tempo).
- **Critério de aceite:** automações ativas no Beehiiv; convite ao Pro dispara
  por score de engajamento; sem urgência artificial.

### P3-B · Modelo de valor gratuito → Pro

- **Objetivo:** definir com clareza o que fica grátis e o que é pago, sem
  degradar a experiência gratuita (o hábito diário é o ativo).
- **Regra:** **não travar o conteúdo diário**; travar **profundidade e
  histórico**. Grátis = sinal do dia + 1 Deal Desk + veredito. Pro = histórico
  CPM/VPM, radar completo de ofertas vigentes ranqueadas, benchmarks, alertas por
  perfil, export. O motor já existe (`app/pro/[periodo]`, Radar/Supabase,
  `scripts/pro-vpm.mjs`, `scripts/forecast.mjs`).
- **Ancoragem de preço:** contra o custo do erro evitado, nunca contra ganho
  prometido.
- **Critério de aceite:** página do Pro comunica o corte de valor sem sugerir
  retorno garantido; disclaimer presente.

---

## Sequência, esforço e dependências

| Ordem | Item | Esforço | Depende de |
|---|---|---|---|
| 1 | P0-A form ↔ produção | ~30 min | rota já pronta |
| 2 | P0-B `/privacidade` | baixo | — |
| 3 | P0-C analytics + eventos | baixo | — |
| 4 | P1-A imagem OG | baixo | — |
| 5 | P1-D rodapé + edição real | baixo | P0-B (privacidade) |
| 6 | P1-C prova social + sticky | médio | P0-C (medir) |
| 7 | P1-B lead magnet | médio | P0-A (entrega) |
| 8 | P2-A `/anuncie` | médio | P1-D (link) |
| 9 | P2-B `/pro` waitlist | médio | P0-A (infra form) |
| 10 | P3-A régua de e-mail | médio | P0-A, P2-B |
| 11 | P3-B modelo grátis→pago | estratégico | P2-B |

---

## Gates de saída (rodar antes de entregar cada item)

Reaproveitar o **Checklist de saída do `CLAUDE.md`** (12 itens) e, além dele:

1. Cadastro real chega ao Beehiiv (P0-A) — testar com e-mail próprio.
2. Nenhum lead descartado em silêncio: erro de rede exibe erro, não "sucesso".
3. Evento de conversão dispara e aparece no analytics.
4. Nenhuma promessa de ganho, nenhum countdown, nenhum emoji em UI.
5. Disclaimer presente onde há recomendação.
6. `npm run build` compila sem erro nem type error.

---

## Métricas para acompanhar (depois da Fase 0)

- **Aquisição:** visitantes, origem, CTR do card OG.
- **Conversão:** taxa view → submit → sucesso do form.
- **Ativação:** abertura do 1º e do 7º e-mail (Beehiiv).
- **Retenção:** abertura média do Daily ao longo de 4 semanas.
- **Monetização:** leads na waitlist do Pro por perfil; conversão waitlist → pago
  quando o Pro abrir.
