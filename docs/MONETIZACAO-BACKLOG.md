# Backlog de Monetização — The Loyal

> Documento vivo. Aqui você **anexa ideias** de monetização a qualquer momento e
> depois as move até o cadastro/execução. Não é o plano fechado (esse é
> [`PLANO-CONVERSAO.md`](./PLANO-CONVERSAO.md)) — é o caderno de captura.
>
> Regra da casa: nenhuma ideia aqui pode quebrar as regras invioláveis do
> `CLAUDE.md` (sem promessa de ganho, sem urgência artificial, publicidade sempre
> sinalizada, independência editorial). Se uma ideia exigir isso, ela morre no
> backlog.

---

## Como usar

1. Teve uma ideia? Cole no fim da seção **📥 Entrada rápida** usando o template.
2. Quando for avaliar, mova para a alavanca certa e dê um status.
3. Ao cadastrar/implementar (Beehiiv, Vercel, código), marque **No ar** e anote a data.

**Status:** `Ideia` → `Avaliando` → `Planejado` → `Em execução` → `No ar` · (ou `Descartado` com o motivo).

### Template de ideia (copie e cole)

```
- [ ] **<título curto>** · Status: Ideia
  - Alavanca: <assinatura paga | publicidade | régua | aquisição | outra>
  - Hipótese: <por que isso gera receita / retém>
  - Esforço: <baixo | médio | alto>  ·  Depende de: <o quê>
  - Como medir: <métrica de sucesso>
  - Notas:
```

---

## 📥 Entrada rápida (cole novas ideias aqui)

> Espaço livre. O que estiver aqui ainda não foi triado.

- _(vazio — cole a próxima ideia com o template acima)_

---

## 1. Assinatura paga — The Loyal Pro

Motor já existe no repo (`app/pro`, Radar/Supabase, `scripts/pro-vpm.mjs`,
`scripts/forecast.mjs`). Falta a camada de captura → cobrança.

- [x] **Waitlist do Pro com perfil** · Status: No ar (PR #45)
  - Captura e-mail + perfil (consumidor / heavy user / profissional) em `/pro`.
  - Como medir: leads na waitlist por perfil (`utm_source=pro-waitlist`, custom field `perfil`).
- [ ] **Definir preço e ciclo** · Status: Ideia
  - Alavanca: assinatura paga
  - Hipótese: ancorar contra o custo do erro evitado, não contra ganho prometido.
  - Notas: mensal vs anual; teste de faixa de preço com a waitlist.
- [ ] **Gateway de pagamento** · Status: Ideia
  - Alavanca: assinatura paga · Esforço: médio · Depende de: preço definido
  - Notas: avaliar Stripe vs oferta paga nativa do Beehiiv (premium subscriptions).
- [ ] **Corte de valor grátis vs Pro** · Status: Planejado (documentado no /pro)
  - Grátis = sinal + 1 Deal Desk + veredito. Pro = histórico, radar completo, benchmarks, alertas.
  - Regra: nunca travar o diário; travar profundidade e histórico.

## 2. Publicidade / Patrocínio

- [x] **Página /anuncie (media kit)** · Status: No ar (PR #45)
  - Contato B2B em `/api/contato`. Como medir: `anuncie_submit`.
- [ ] **Tabela de preços de patrocínio** · Status: Ideia
  - Alavanca: publicidade · Depende de: números de audiência reais
  - Notas: só publicar métricas quando forem verificáveis.
- [ ] **Formato "patrocínio da edição"** · Status: Ideia
  - Uma marca por edição, sinalizada antes do conteúdo. Definir inventário e cadência.

## 3. Régua de e-mail (retenção → upsell)

Configuração no **Beehiiv Automations** (fora do código).

- [ ] **Boas-vindas (D0) + lead magnet** · Status: Planejado
  - Entrega o guia do CPM; primeira "conta real".
- [ ] **D3 — como ler o TL Score** · Status: Ideia
- [ ] **D7 — primeira conta forte** · Status: Ideia
- [ ] **Convite ao Pro por engajamento** · Status: Ideia
  - Dispara por nº de aberturas, não por tempo. Segmenta por `perfil` da waitlist.

## 4. Aquisição (alimenta o topo do funil)

- [x] **Imagem OG dinâmica** · Status: No ar (PR #45)
- [x] **Lead magnet /guia/cpm** · Status: No ar (PR #45)
- [ ] **Guia 2 (VPM / quando usar milhas)** · Status: Ideia
- [ ] **Tráfego pago com o lead magnet como isca** · Status: Ideia
  - Depende de: analytics de conversão medindo custo por lead.

---

## Pendências externas que destravam receita

> Não são código — são configuração no painel. Sem elas, o resto rende menos.

- [ ] Confirmar `BEEHIIV_API_KEY` / `BEEHIIV_PUBLICATION_ID` em produção (Vercel).
- [ ] Montar as automações da régua no Beehiiv (seção 3).
- [ ] Ligar `/api/contato` a um e-mail real (Resend/SMTP) quando houver volume de leads B2B.

---

## Histórico de decisões

> Registre aqui o que foi decidido e por quê, para não reabrir discussão depois.

- 2026-07-15 — Waitlist do Pro captura perfil desde já, para segmentar o upsell antes mesmo do produto abrir.
- 2026-07-15 — Diário nunca vai para paywall; a monetização paga vem de profundidade/histórico (Pro), não de travar o hábito.
