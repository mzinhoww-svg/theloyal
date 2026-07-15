# Diagnóstico profundo — Daily, Weekly e Predict

> Diagnóstico de produto, operação, engenharia de conteúdo e automação das digests
> do The Loyal. Não descreve só o que existe: revela como o sistema funciona, onde
> estão os gargalos, o que falta e quais caminhos o tornam mais robusto, escalável
> e inteligente.
>
> **Escopo factual:** baseado no código e nos docs do repositório em 2026-07-15.
> Onde algo não existe no código, está marcado. Onde depende de decisão interna,
> está na seção de perguntas em aberto. Nada aqui foi chutado.

---

## Sumário executivo — os 10 achados que mudam a conversa

1. **O produto ainda não nasceu de verdade.** Todas as edições no repositório
   (`0027`, `0028`, `2026-W29`, `pro/2026-07`) têm `illustrative: true` — são
   exemplos, não edições publicadas. O diagnóstico é de um sistema **pré-operação**,
   com trilhos construídos e o trem ainda na estação.

2. **O TL Score não é calculado — é digitado.** Não existe, em todo o repositório,
   uma função que compute o TL Score a partir dos 8 critérios. O número é definido
   à mão (editor/agente Cowork) e o código só **valida a aritmética interna** — e
   apenas quando o `scoreBreakdown` está presente, que é opcional. O motor de
   priorização do produto é humano.

3. **Não existe nota de corte de publicação.** Nenhum score bloqueia ou libera
   publicação. As faixas de score mapeiam só `score → rótulo → cor`, nunca
   `score → ação`. Toda decisão de publicar é editorial, com o QA atuando como
   **gate binário** (passa/bloqueia regra inviolável), e o disparo no Beehiiv é
   **100% manual com confirmação**.

4. **Há dois motores de previsão, e o melhor está dormente.** O `forecast`
   (recorrência por mediana de intervalos) é o que alimenta os digests. O `predict`
   (sobrevivência/hazard + backtest walk-forward) é mais sofisticado, **mede
   acurácia**, e vive **só no admin** — nunca chega ao leitor. O leitor recebe o
   motor mais fraco e não-backtestado.

5. **O radar que o Weekly publica pode estar velho e desconectado.** O
   `content/forecast.json` é gerado **manualmente** (`npm run forecast`, sem cron).
   A auditoria interna encontrou o snapshot que alimenta o Weekly gerado com **119
   linhas de ledger enquanto o banco tinha ~2.438** — "o radar semanal está
   desconectado do estado atual". Há um gate de frescor (≤24h) que, na dúvida,
   **corta o radar** — melhor mudo do que errado, mas ainda assim uma lacuna.

6. **A coleta tem qualidade de dado comprometida.** Auditoria com dados reais:
   ~29% das campanhas de transferência são invisíveis aos motores; ~54% são mais
   antigas que 18 meses e ainda entram na série; a chave de deduplicação de
   campanha **não inclui a URL**, gerando duplicatas (o caso da janela projetada
   para 2029 nasce de uma `vigencia_fim` fabricada por erro de extração).

7. **O acoplamento Daily → Weekly é quase inexistente e manual.** Nenhum código lê
   as edições da semana para derivar os `movements`/`highlights` do Weekly. A única
   ponte automática é o radar (e só no Weekly). Hoje a Weekly é **redigida do zero**,
   não **consolidada** da Daily.

8. **A promessa da landing está à frente do produto.** A landing vende, no Weekly,
   "ranking de oportunidades vigentes e **estratégia por perfil**"; o Weekly real
   não tem ranking nem persona. Vende o **Lab** como "Incluído" — o Lab **não existe
   no código**. Vende o **Pro** como "Em breve" — o Pro **já está implementado**.

9. **Seis personas definidas, zero personalização.** A landing nomeia seis perfis
   de leitor (Consumidor, Heavy user, Alta renda, Profissional, Bancos, Varejo/CRM).
   O render não ramifica por nenhum. Uma edição, uma forma, para todos.

10. **A governança de segurança editorial é sólida; a de dado e automação é dívida.**
    "Nenhum e-mail sai sem ação humana" é regra inviolável bem implementada. Já os
    crons não são versionados (vivem só no banco), há dois pipelines de edição e
    dois coletores de VPM coexistindo, e os motores de previsão são espelhados à mão
    entre TS e `.mjs`. O que protege a **marca** está maduro; o que garante **escala
    e frescor** está pela metade.

---

## Parte 0 — Como o sistema realmente funciona (a arquitetura de verdade)

Antes de separar Daily e Weekly, é preciso desfazer três simplificações. O sistema
**não** é "coleta → digest". Ele é:

### 0.1. Quatro produtos, não três

| Produto | Cadência real | Artefato | Estado |
|---|---|---|---|
| **Daily** | Seg–sex, 8h, ~5 min | `content/editions/NNNN.json` | Trilhos prontos, edições ilustrativas |
| **Weekly** | Fim de semana (o exemplo diz 9h) | `content/weekly/AAAA-Wnn.json` | 1 edição ilustrativa; menos maduro |
| **Pro** | Mensal (B2B) | `content/pro/AAAA-MM.json` | Implementado, mas landing diz "em breve" |
| **Lab** | 2–4/mês (evergreen) | — | **Anunciado, inexistente no código** |

O "predict" do seu pedido **não é um produto** — é uma **camada** (o Radar de janelas)
que atravessa Daily, Weekly e Pro. A decisão-âncora dos docs é literal: *"Radar é o
produto; Forecast e Predict são motores internos, nunca produtos concorrentes."*

### 0.2. Dois pipelines de coleta que quase não se falam

- **Pipeline de notícias → campanhas (ledger)** — roda no **Supabase** via `pg_cron`.
  `ingest` (3×/dia) puxa portais → `news_raw`; `campaigns` (a cada 5 min) manda o
  texto ao LLM (Llama-4-Maverick via OpenRouter), que **extrai e classifica** a
  campanha (origem, destino, tipo, %, vigência) — **nunca faz conta**. Backfill de
  sitemaps preenche o histórico. Esse ledger alimenta os motores de previsão e é a
  matéria-prima do Deal Desk.
- **Pipeline de VPM/Shopping (SKUs de varejo)** — roda no **GitHub Actions** (Playwright
  headless, porque marketplaces renderizam preço/pontos via JS). Alimenta o
  `shoppingWatch` da Daily e a matriz do Pro. **Hoje é efetivamente mock/seed** — a
  coleta ao vivo esbarra em SPA/anti-bot (a Azul bloqueia headless) e em pontos que
  exigem login.

Além disso há **duplicação interna não reconciliada**: dois coletores de VPM (um com
outlier por MAD, outro por IQR, em tabelas diferentes) e dois pipelines de render de
edição (o ativo em camelCase e um legado em snake_case, `renderer/*.mjs`, que é código
zumbi — importado por scripts `daily:*`, mas nenhum conteúdo o alimenta).

### 0.3. Dois motores de previsão

| | **Forecast** (`forecast_recurrence_v1`) | **Predict** (`campaign_predict_v2`) |
|---|---|---|
| Algoritmo | Mediana dos intervalos entre "ondas" colapsadas; janela = centro ± metade do desvio | Sobrevivência empírica ponderada por recência → hazard → P{7,15,30,60,90,180}; + distribuição de bônus |
| Confiança | Só amostra + coeficiente de variação (CV) | Amostra + CV **rebaixada por backtest** |
| Backtest / acurácia | **Nenhum** | **Walk-forward** (erro de data, window-hit, Brier, ±5pp) |
| Onde vive | `scripts/forecast-engine.mjs` → `content/forecast.json` | `lib/predict-engine.ts` (só admin) |
| **Chega ao leitor?** | **Sim** (Daily/Weekly) | **Não** (dormente) |

Ou seja: o motor que **mede se acerta** não publica; o que **publica** não mede se
acerta. Esse é, isolado, o achado mais importante do diagnóstico da camada preditiva.

### 0.4. Onde entra o humano

Regra de ouro, bem implementada: *"nenhum e-mail é enviado sem ação humana explícita.
O pipeline para em rascunho por padrão."* A máquina **coleta, extrai e calcula
números determinísticos** (CPM, VPM, spread — funções puras testadas, o LLM nunca faz
conta). O humano **cura, arbitra veredito/TL Score, aprova QA e dispara** o envio no
Beehiiv (que exige `confirm=PUBLICAR`). O `/admin` é o cockpit: pausar/rodar crons,
reprocessar notícia, editar veredito/score inline, curar o Deal Desk, rodar QA,
aprovar, materializar no ledger, gerar rascunho/publicar/agendar.

---

## Parte 1 — Diagnóstico da DAILY

### 1.1. Finalidade e papel

**Problema que resolve:** "quase tudo parece bom no título". A Daily é o **filtro
diário de ruído com conta feita** — lê o regulamento, confirma a vigência, calcula o
milheiro final e emite um veredito antes de o leitor agir. Em 5 minutos: o que mudou,
por que importa, qual é a conta, qual é o risco.

**Decisão que deveria suportar:** uma decisão **operacional de curtíssimo prazo** —
"transfiro/compro/resgato hoje, ou espero?". É um produto de **timing + alerta**: o
`fechaLogo` (vence em ≤72h) e o Deal Desk com veredito existem para acionar ou conter
o gatilho **naquele dia**.

**Quando faz mais sentido:** manhã, antes do expediente (8h), janela em que o leitor
ainda pode agir sobre o que vence. A cadência seg–sex reforça o papel de rotina.

**O que a torna útil:** a **conta aberta e auditável** + o veredito honesto (incluindo
"Não confirmado" quando falta regulamento). **O que faria perder valor:** virar
agregador de banner (recomendar sem vigência), inflar TL Score, repetir o que todo
canal de cupom já diz, ou publicar todo dia mesmo sem sinal real ("encheção").

**Diferença real Daily × Weekly × Predict:** a Daily é **evento acionável hoje**; a
Weekly é **tendência e preparação para os próximos 7 dias**; o Predict é a **camada
de projeção** (quando a próxima janela deve abrir) que aparece nas duas, mas nunca
como veredito — sempre como projeção com incerteza explícita.

### 1.2. Público, uso e contexto

Seis personas na landing, **sem qualquer diferenciação no produto**: Consumidor
inteligente, Heavy user, Alta renda, Profissional de loyalty, Bancos/cartões,
Varejo/CRM. Na prática a Daily hoje serve melhor o **Heavy user** (conta, timing,
vigência, risco de estoque) — é para ele que o Deal Desk e o `fechaLogo` foram
desenhados. O Consumidor inteligente recebe densidade e jargão que a própria landing
sinaliza como travas (🟡 no glossário). O Profissional/B2B é servido pelo Pro, não
pela Daily.

- **O que cada perfil precisa ver e não deveria ver:** o Heavy user precisa da conta
  e do timing; o Consumidor precisaria de tradução e menos jargão; o B2B precisa de
  benchmark e movimento estrutural (Pro), não do deal do dia. Hoje **todos veem a
  mesma coisa** — o que serve o Heavy user e subatende os demais.
- **Contexto de uso:** monitoramento diário + gatilho de ação. Não é ferramenta de
  reporte nem de alinhamento de time — é consumo individual, mobile-first, de rotina.

### 1.3. Fontes e coleta (aplicadas à Daily)

- **Fontes que alimentam a Daily:** (a) o **ledger de campanhas** (notícias extraídas
  por LLM) para os `deals` e o `fechaLogo`; (b) o **VPM/Shopping** para o
  `shoppingWatch`; (c) o **forecast** para o bloco `radar` opcional. Mas atenção:
  **hoje o Deal Desk é redigido manualmente** — o ledger sugere candidatos no admin
  (ordenados por `tl_score`), o humano cura.
- **Obrigatórias vs complementares vs experimentais:** obrigatório = ledger + LLM de
  extração (sem OpenRouter a extração para). Complementar = VPM/Shopping (não bloqueia
  a edição). Experimental/mock = praticamente todo o VPM ao vivo hoje, e Tavily (só
  descoberta de URL).
- **Confiabilidade:** a fonte mais confiável é o **regulamento oficial confirmado**
  (nível 1–2); a mais ruidosa é o **post social sem página oficial** (nível 4 → vira
  "Não confirmado", nunca recomendação — exatamente o caso do deal 2 da edição 0028).
- **Dedup/normalização:** existe por `id` de campanha (`origem-destino-tipo-vigencia_fim`,
  sem acento, minúsculo) e colapso de "ondas" (≤3 dias) na camada de forecast — **não
  na ingestão**. Fraqueza conhecida: a URL fica fora da chave; reprocessar com
  `vigencia_fim` diferente **duplica**. Não há fingerprint de texto para near-duplicate
  na `news_raw` — a mesma notícia em dois portais só deduplica se gerar o mesmo `id`.
- **O que falta em fontes:** lista de portais **não versionada** (impossível auditar
  cobertura pelo repo); **coleta autenticada** (grande parte do resgate real só
  aparece logado); validação estruturada da saída do LLM (bounds de %, enum de tipo,
  sanidade de data).

### 1.4. Automação e fluxo ponta a ponta (Daily)

Automático: ingest (3×/dia) → extração (5 min) → backfill; VPM (06h/08h/20h);
todo o CI de qualidade. **Para aqui.** A partir daí é humano: pesquisa/validação do
JSON (`npm run validate` + auditoria de fontes), curadoria do Deal Desk no admin, QA,
aprovação, materialização no ledger, e disparo do Beehiiv (draft por padrão).

- **Gatilhos:** predominância de **janela temporal (cron)**; um gatilho de **volume**
  (o extrator consome a fila `processed=false` a cada 5 min); **nenhum** gatilho por
  mudança de score.
- **Gargalos e retrabalho:** notícia que dá erro na extração vira `processed=true` e
  **some da fila** — reprocesso é manual; crons não versionados; motores espelhados à
  mão; e o radar da Daily é **escrito à mão no JSON** (o `digest.radarDaily` do
  forecast está **vazio** hoje — a Daily não é alimentada automaticamente pela
  previsão).
- **Por que o desenho é assim:** decisão de produto (segurança editorial) dominante,
  sobre restrição operacional (equipe enxuta) e necessidade técnica (headless no
  Actions). A desconexão forecast↔automação é **dívida acidental**, não escolha.

### 1.5. Curadoria, filtragem e descarte (Daily)

- **Entra:** campanha com fonte, conta fechável e (para recomendar) **vigência
  confirmada**. **Descartado/rebaixado:** sem vigência → veredito forçado a
  "Não confirmado" (overrule §5.4, aplicado no validador); sem fonte → não entra no
  Deal Desk; vigência vencida em relação à data da edição → bloqueia.
- **Sobe para destaque:** hoje, decisão editorial — o admin ordena candidatos por
  `tl_score`, mas quem promove é o humano.
- **Filtros objetivos** (código): disclaimer íntegro, zero emoji, zero urgência
  (regex), zero CMI/dado interno (regex), URL válida, score↔veredito coerentes,
  breakdown fecha com o score. **Filtros subjetivos** (humano): relevância, qualidade
  real da fonte (nível 1–4 **não é verificado por código**), força do sinal,
  originalidade.
- **Heurística escondida / viés:** o guardrail de emoji/urgência/CMI é **lista fixa
  de termos** — urgência parafraseada ou CMI reescrito passam. E o TL Score, por ser
  humano e opcionalmente sem breakdown, carrega o viés do editor sem trilha auditável.

### 1.6. Pesos, score e ranking (Daily)

Os 8 critérios e pesos (fonte: código `TL_WEIGHTS` + RFC-001 §5.4):

| Critério | Peso | O que representa |
|---|---|---|
| valor | 25 | Valor econômico (CPM/VPM/spread) — o que mais pesa |
| regra | 15 | Clareza/solidez da mecânica oficial |
| vigência | 15 | Confirmação e prazo |
| fricção | 10 | Esforço para executar |
| aplicabilidade | 10 | Abrangência do público |
| liquidez | 10 | Facilidade de resgate |
| estoque | 10 | Disponibilidade |
| fontes | 5 | Qualidade da fonte (nível 1–4) |

- **Onde o cálculo acontece:** em lugar nenhum, deterministicamente. É julgamento
  editorial; o código só confere `Σ(peso·critério/100) == tlScore` **se** houver
  breakdown. Faixas: 85–100 Vale agir · 70–84 Vale olhar · 55–69 Casos específicos ·
  40–54 Esperaria · 0–39 Evitaria · s/dado Não confirmado.
- **Incerteza:** tratada fora do score, no veredito "Não confirmado". **Conflito de
  sinais / qualidade da fonte vs força do conteúdo:** não há regra — é arbitragem
  humana. **Calibragem periódica:** não existe. Os pesos vêm de um "Operating Manual
  v1" **que não existe como arquivo** — vivem como constante em código + RFC.
- **Onde pode estar enviesado/desatualizado:** peso de `fontes` em 5 é baixíssimo para
  uma marca cuja tese é "confiança pelo método"; e a ausência de cálculo torna o score
  não-reprodutível entre editores.

### 1.7. Nota de corte e regra de publicação (Daily)

**Não existe nota de corte.** A publicação é editorial + gate binário de QA + disparo
manual. Um "Evitaria (20)" passa no QA e poderia ser publicado — a contenção é humana.
Ver a proposta de régua no bloco 14.4.

### 1.8. Estrutura editorial (Daily)

Ordem de render (e-mail/web idênticos em julgamento; formas diferentes):
**Header → Sinal do dia → Deal Desk (n deals) → Fecha logo → Shopping·VPM → Radar de
janelas → Fontes → Disclaimer.** A espinha obrigatória é **Sinal + ≥1 Deal + Fontes +
Disclaimer**; blocos 3–5 são opcionais (a 0028 exercita todos; a 0027 é mínima).

- **Narrativa:** "Sinal, conta, contexto e ação, nessa ordem" — funciona. O Sinal
  abre com a tese do dia; cada deal traz conta + veredito. **Bom.**
- **A melhorar:** o **radar** aparece em 5º, depois do shopping — para um produto de
  timing, a projeção de "quando abre a próxima janela" está enterrada. E há
  **duplicação de código de radar** entre `render.mjs` e `render-weekly.mjs`
  (candidato a extrair para `lib.mjs`). Detalhe de marca: o plain-text imprime
  "THE LOYALTY" e o web "The Loyalty", enquanto e-mail/weekly usam "The Loyal" —
  **inconsistência de nome entre superfícies**.
- **Versões:** não há versão curta/executiva/completa nem por persona — 3 saídas
  (e-mail/plain/web) do **mesmo** conteúdo.

### 1.9. Qualidade e validação (Daily)

Gate `npm run validate` (por edição) + `npm run qa` (4 superfícies) bloqueiam:
disclaimer, emoji, urgência, CMI, fonte obrigatória, vigência→não-confirmado, vigência
vencida, score↔veredito, breakdown, URL, radar sem `em-formacao`. **O que não é
validado:** nível real da fonte, veracidade dos 8 critérios, near-duplicate semântico,
e — por ser opcional — a composição do próprio score quando falta breakdown. Não há
controle **pós-publicação** de utilidade (o loop de `edition_stats` do Beehiiv existe
no schema, mas depende de operação real).

### 1.10. Escalabilidade (Daily)

O que quebra primeiro se dobrar/triplicar o volume: **a curadoria humana** (Deal Desk,
veredito, TL Score são O(edições·deals) e 100% manuais). Se aumentam as fontes: a
**extração LLM sem validação estruturada** e a **dedup frágil** (duplicatas). Se
aumentam os temas: o schema é fixo em transferência/compra/shopping — bancos/cartões,
varejo/coalizão e cashback (prometidos na landing) **não têm blocos próprios**.

---

## Parte 2 — Diagnóstico da WEEKLY

### 2.1. Finalidade e papel

**Problema que resolve (pretendido):** transformar o fluxo de eventos diários em
**tendência e preparação** — "onde a recorrência aponta a próxima janela, e o que ela
não garante". É o produto de **médio prazo e síntese**.

**Decisão que deveria suportar:** planejamento dos **próximos 7 dias** — que janelas
preparar, o que monitorar, onde não se antecipar. Menos "aja agora", mais "prepare a
conta e fique de olho".

**Quando faz mais sentido:** fim de semana, quando o leitor tem tempo para leitura de
preparação (a edição exemplo diz 9h). **O que a torna útil:** consolidar sem repetir a
Daily, e dar **leitura de recorrência honesta** (cadência ≠ agenda). **O que faria
perder valor:** repetir os deals da Daily, publicar radar velho como se fosse fresco,
ou prometer "ranking + estratégia por perfil" e entregar uma tese genérica.

### 2.2. Público e uso

Mesma base de personas, mesma ausência de personalização. A landing **promete
explicitamente** "ranking de oportunidades vigentes e **estratégia por perfil**" — o
Weekly real (W29) **não tem ranking nem persona**. Este é o maior gap de
expectativa-vs-entrega do produto. O Weekly serve hoje um leitor de **tendência**
(Heavy user estratégico, Profissional), mas entrega abaixo do prometido.

### 2.3. Fontes e coleta (Weekly)

A Weekly tem **duas fontes reais**: (a) o **forecast** (`digest.radarWeekly`), puxado
automaticamente quando o JSON não traz radar próprio, **com gate de frescor (≤24h)** —
se o artefato está velho/incompleto, o radar é **cortado silenciosamente** (bom
princípio, lacuna de produto); (b) **redação manual** para tese, `movements` e
`highlights`. **Nenhum código deriva `movements`/`highlights` das edições da semana** —
é escrito do zero. A fonte "ledger interno" citada nas `sources` do W29 é, hoje,
narrativa, não pipeline.

### 2.4. Automação (Weekly)

**Não há cron semanal.** O `forecast.json` que a Weekly consome só muda quando alguém
roda `npm run forecast` **à mão**. Resultado documentado: o snapshot fica **defasado**
(gerado com 119 linhas enquanto o banco tinha ~2.438). O `/admin` recalcula a cada
request, mas **não persiste** e **não alimenta** o artefato publicado. A Weekly é,
portanto, o produto **mais exposto a dado velho** e o **menos automatizado**.

### 2.5. Curadoria, score e corte (Weekly)

A Weekly quase não tem score próprio: `highlights` **aceita** `verdict`+`score`
opcionais, mas o W29 não usa, e **o render web sequer mostra o badge**. Não há nota de
corte. O único filtro automático é o de radar: confiança só `alta|media|baixa`,
**nunca `em-formacao`**, e janela consistente com o forecast.

### 2.6. Estrutura editorial (Weekly)

Ordem: **Header → A semana em uma tese → Radar de janelas → Movimentos da semana
(Abriram/Seguem/Encerraram) → Destaques → O que monitorar → Fontes → Disclaimer.** O
Radar é o **centro** (2º bloco). `watch` é o único obrigatório além de tese/fontes.

- **Bom:** o Radar em posição de destaque; `movements` é um formato de síntese
  correto. **A melhorar:** falta o **ranking de oportunidades vigentes** e a
  **estratégia por perfil** prometidos; `highlights` sem badge no web desperdiça o
  vocabulário do Deal Desk; e não há **continuidade** com a Daily (nenhuma referência
  a "o deal X da terça segue vigente").

### 2.7. Qualidade e escala (Weekly)

Validação própria (`validateWeekly`) mais simples que a da Daily — **sem** a camada de
auditoria de artefato (600px, self-contained) nem manifest com sha256 que a Daily tem.
O que quebra primeiro: **o frescor do forecast** (já quebrado) e a **redação manual de
movements** (não escala e não é rastreável às edições da semana).

---

## Parte 3 — Diagnóstico do PREDICT (a camada de projeção)

### 3.1. Como entra hoje

Como **bloco Radar de janelas**: opcional e manual na Daily; central e (idealmente)
automático na Weekly; curva completa (P7–P180) no Pro (planejado). Aparece como
**projeção**, nunca veredito: label (rota/programa), janela em texto ("17 a 24 jul"),
confiança (alta/media/baixa), base ("6 janelas · cadência irregular ~8 dias") e bônus
típico ("~23%").

### 3.2. Maturidade real

- O motor **que publica** (forecast) é **estatística a priori**: mediana de intervalos
  + CV. **Sem backtest, sem acurácia medida.** Hoje **todas** as séries com previsão
  saem "baixa" e o `radarDaily` está vazio — pouco histórico denso o suficiente.
- O motor **robusto** (predict, com hazard e backtest walk-forward: erro de data,
  window-hit, Brier, ±5pp) está **dormente no admin** — sem CLI, sem cron, sem chegar
  ao leitor. A regra de ouro dele ("sem backtest, confiança nunca é 'alta'") é
  exatamente o que falta no motor que publica.
- **Acurácia real:** **não há número medido em produção.** Só metas de backtest
  (window-hit ≥0,5) e problemas de dado conhecidos.

### 3.3. Está sendo usado como predição, priorização ou interpretação?

As três, parcialmente: **prediz** a janela; **prioriza** (ordena por confiança e
proximidade, corta por horizonte — Daily media+/≤10d, Weekly baixa+/≤21d);
**interpreta** (traduz para card em pt-BR). **Não sugere ação** diretamente (o forecast
não diz "transfira") — e faz bem em não dizer, dado que não é backtestado.

### 3.4. O que falta para virar camada de produto

1. **Ligar o motor certo:** promover o `predict` (backtestado) a fonte canônica quando
   `ready`, com o `forecast` como fallback rotulado — decisão já desenhada nos docs,
   **não executada** (Predict fora do MVP, Ev.3/Ev.4).
2. **Automatizar e datar o artefato:** cron de forecast/predict + carimbo de frescor
   **visível ao leitor** ("baseado em N campanhas, atualizado há Xh").
3. **Explicabilidade anti-caixa-preta:** cada projeção com amostra, base, o que pode
   invalidar, e faixa (nunca ponto). O predict já gera `explain()`; falta expor.
4. **Corrigir o dado a montante:** dedup com URL, filtro de idade da série,
   reconciliação forecast×predict — sem isso, qualquer motor herda lixo.
5. **KPIs vivos:** window-hit real (Ev.4, via `prediction_outcomes` previsto×realizado),
   Brier/calibração, e "zero publicação inválida" como meta dura.

### 3.5. Riscos de expor previsão

Expor acurácia baixa cedo demais mina a marca Sage; publicar janela de série
duplicada/anômala (caso 2029) destrói confiança; tratar projeção como agenda contradiz
a própria tese ("cadência não é agenda"). Mitigação já parcialmente no código: gate C0
(mín. 5 ondas editoriais, bloqueio de intervalo ≥540d e horizonte >180d, frescor ≤24h),
mas **o artefato em disco é anterior a esse gate** — mostra séries a 2029 que o motor
atual bloquearia. Há **divergência motor↔artefato** a sanar.

---

## Parte 4 — Comparativo Daily × Weekly × Predict (o que é de cada um)

| Dimensão | Daily | Weekly | Predict (camada) |
|---|---|---|---|
| **Exclusivo** | Deal Desk, conta feita, TL Score, fechaLogo, shoppingWatch | Movements da semana, tese, watch, ranking (prometido) | Backtest, probabilidade, distribuição de bônus |
| **Compartilhado** | Sinal, Radar, Fontes, Disclaimer, chassis visual | idem | Aparece nos dois formatos |
| **Redundante hoje** | — | Radar é idêntico ao da Daily (código duplicado) | Mesma série em dois cortes de confiança |
| **Faltando** | Radar automático, temas (bancos/varejo/cashback) | Ranking, estratégia por perfil, continuidade com a Daily | Motor backtestado no leitor, frescor visível, acurácia |

- **Daily deve alimentar a Weekly** — hoje **não alimenta** (movements são manuais).
  Proposta: derivar `movements` das campanhas que entraram/venceram/seguem nas edições
  da semana (o ledger já tem `status`), e `highlights` dos deals de maior TL Score do
  período (o Pro já faz isso via `derivedFrom` — lineage edição→deal→score; falta
  trazer para a Weekly).
- **Weekly deve consolidar sem repetir** — mostrar o **estado atual** dos deals já
  vistos (segue vigente? venceu?), não recontá-los.
- **Predict consistente nos dois** — mesma fonte reconciliada (`radar-consistency`),
  Daily expõe P30, Weekly P30+P90, Pro a curva. **A ponte narrativa** sinal (Daily) →
  tendência (Weekly) → previsão (Predict) → ação (veredito) é o fio condutor que hoje
  existe conceitualmente nos docs, mas não no produto renderizado.

---

## Parte 5 — Possibilidades fora da caixa (avaliadas, não só listadas)

Priorizadas por **relação valor/esforço** e aderência à marca Sage:

**Alta prioridade (alavancam o que já existe):**
- **Clusters em vez de notícias individuais.** A infra de colapso de ondas e de
  cluster por destino já existe. Agrupar "3 origens abriram bônus para LATAM na mesma
  janela" é mais Sage que listar 3 deals — e reduz repetição Daily↔Weekly.
- **Alertas críticos separados de insights estratégicos.** Hoje `fechaLogo` (urgente)
  e `radar` (estratégico) convivem no mesmo fluxo. Separar "age hoje" de "prepare-se"
  é barato e melhora a escaneabilidade.
- **Score composto = valor de negócio × confiança × acionabilidade.** O TL Score mede
  qualidade da oferta; falta um **eixo de acionabilidade/confiança** que module o
  destaque. Casa com o `predict` (confiança medida) e com o Editorial Score já
  desenhado nos docs.
- **Explicação por probabilidade e impacto** no Radar (P30 + faixa de bônus + "o que
  invalida"). O `predict.explain()` já produz isso; é expor, não construir.
- **Feedback loop de utilidade.** `edition_stats` (opens/clicks por bloco) já está no
  schema — fechar o loop e realimentar a curadoria ("o Deal Desk converte mais que o
  shopping?").

**Média prioridade (novos trilhos, valor claro):**
- **Versão curta/executiva/completa** da mesma edição (TL;DR no topo, conta no corpo,
  metodologia no rodapé). Um único KO, três projeções — arquitetura já prevista no RFC.
- **Digest por persona** (Consumidor traduzido vs Heavy user com conta vs B2B com
  benchmark) — a landing **já vende isso**; começar por 2 trilhas (consumidor/heavy).
- **Comparação histórica e benchmarking temporal** ("bônus de hoje vs mediana dos
  últimos 6 meses") — o `typicalPercent` do forecast já dá o comparador.
- **Recomendação automática de próxima ação** ("monitorar", "preparar saldo",
  "aguardar regulamento") — derivada do veredito + frescor, não do LLM.

**Visão futura (dependem de maturidade de dado/modelo):**
- **Digest adaptativa por comportamento** (o que o leitor abre/clica molda o próximo).
- **Leitura de tendência, sazonalidade e anomalia** (o predict v2 é o caminho).
- **Publicação híbrida com níveis de aprovação por risco** (auto para "monitorar",
  humano para "vale agir") — só depois de acurácia medida.
- **Auditoria de qualidade por amostragem** (revisar N% das edições contra realizado).
- **Trilha de aprendizado** (o Lab prometido, ligando cada jargão do digest à
  explicação evergreen).

---

## Parte 6 — ENTREGA FINAL

### 14.1. Diagnóstico atual

**O que existe e funciona:**
- Núcleo editorial da Daily maduro: schema sólido, conta feita determinística (LLM
  nunca calcula), veredito com vocabulário fixo, "Não confirmado" honesto, gates de QA
  que bloqueiam quebra de regra inviolável, publicação manual segura (draft + confirm),
  idempotência por hash. Build/tsc/testes verdes.
- Coleta de notícias automatizada (ingest + extração LLM + backfill) e cockpit `/admin`
  competente (crons, reprocesso, curadoria, QA, aprovação, dispatch).
- Camada de projeção com **princípios corretos**: incerteza explícita, gate de frescor,
  gate C0 (amostra/intervalo/horizonte), e um motor backtestado (predict) já escrito.

**O que não funciona / não está ligado:**
- O motor que publica (forecast) **não é backtestado**; o que é (predict) **não
  publica**. `radarDaily` vazio; `forecast.json` **defasado e manual** (119 vs ~2.438
  linhas); artefato em disco **anterior ao gate C0** (mostra janelas de 2029).
- Qualidade de dado: ~29% de campanhas invisíveis, ~54% velhas demais na série,
  duplicatas por chave sem URL.
- Weekly abaixo da promessa (sem ranking/persona), movements manuais, sem cron semanal.
- TL Score não-calculado e opcionalmente sem breakdown → não reprodutível/auditável.

**O que está confuso:**
- Dois pipelines de edição (ativo + legado zumbi), dois coletores de VPM (MAD × IQR),
  dois motores de previsão espelhados à mão, "Operating Manual v1" e 6 docs de
  autoridade **citados mas inexistentes**, nome da marca inconsistente entre
  superfícies, e a landing anunciando Lab (inexistente) e Pro ("em breve", mas pronto).

### 14.2. Gap analysis por categoria

| Categoria | Gaps principais |
|---|---|
| **Produto** | Weekly não entrega ranking/persona prometidos; zero personalização apesar de 6 personas; sem versão curta/executiva; Lab inexistente; Pro escondido; nome da marca inconsistente. |
| **Conteúdo** | Temas prometidos sem bloco (bancos/cartões, varejo/coalizão, cashback); Daily→Weekly sem consolidação; radar duplicado; jargão sem tradução para o Consumidor. |
| **Automação** | Sem cron de forecast/predict; sem cron semanal; crons do banco não versionados; notícia com erro some da fila (reprocesso manual); motores espelhados à mão; dois coletores VPM. |
| **Cálculo** | TL Score digitado, não calculado; breakdown opcional (buraco de validação); nível de fonte não verificado por código; pesos sem calibragem; sem eixo de confiança/acionabilidade. |
| **Publicação** | Sem nota de corte nem faixas de decisão (tudo humano); guardrails por lista fixa de termos; `--force` fura idempotência. |
| **Predict** | Motor forte dormente; motor publicado sem backtest; sem acurácia real; frescor invisível ao leitor; artefato divergente do motor. |
| **Governança** | ADRs todos "proposed"; docs de autoridade fantasmas; `verify_jwt` desabilitado; dupla chave de service key; sem auditoria pós-publicação. |
| **Qualidade** | Dado sujo a montante (duplicatas, idade); Weekly com validação mais fraca que a Daily; sem loop de utilidade operante; predict/scraping (o mais frágil) é o menos testado. |

### 14.3. Oportunidades de evolução

**Curto prazo (semanas, alto valor/baixo esforço — usam o que já existe):**
1. **Ligar o forecast à automação:** cron diário para regenerar `forecast.json` +
   carimbo de frescor **visível** no Radar. Elimina o risco de radar velho.
2. **Tornar `scoreBreakdown` obrigatório** quando há `tlScore` (fecha o buraco de
   validação e torna o score auditável).
3. **Derivar `movements` da Weekly do ledger** (campanhas que abriram/venceram/seguem
   na semana) — acaba com a redação manual e cria a ponte Daily→Weekly.
4. **Trazer o `derivedFrom` (lineage) do Pro para a Weekly** como ranking de
   oportunidades do período — entrega parte da promessa da landing.
5. **Extrair o radar duplicado para `lib.mjs`** e **corrigir o nome da marca**
   ("The Loyal") nas três superfícies.
6. **Alinhar a landing à realidade:** ajustar Lab/Pro/"estratégia por perfil".

**Médio prazo (1–2 ciclos):**
7. **Promover o predict (backtestado) a fonte canônica do Radar** quando `ready`, com
   forecast como fallback rotulado; expor P30 (Daily) / P30+P90 (Weekly) + explicação.
8. **Corrigir o dado a montante:** dedup com URL na chave, filtro de idade de série,
   reconciliador forecast×predict, validação estruturada da saída do LLM.
9. **Separar alertas críticos de insights estratégicos** e adotar **clusters** como
   unidade editorial.
10. **Versão executiva/curta** e **primeira trilha por persona** (consumidor × heavy).
11. **Fechar o loop de utilidade** (`edition_stats`) e realimentar a curadoria.

**Visão futura:**
12. **Régua de publicação híbrida por risco** (auto para "monitorar", humano para
    "vale agir"), só após acurácia medida (`prediction_outcomes`, Brier/calibração).
13. **Digest adaptativa por comportamento** e **camada de sazonalidade/anomalia**.
14. **Lab como trilha de aprendizado** ligada ao jargão dos digests.
15. **Auditoria por amostragem** (previsto × realizado, N% das edições).

### 14.4. Proposta de desenho ideal

**Daily ideal** — produto de **timing acionável**. Ordem: Sinal → **Radar em cima**
(quando abre a próxima janela, P30 + frescor) → Deal Desk (conta + score
**com breakdown obrigatório**) → **Alertas críticos** (fechaLogo isolado) → Shopping →
Fontes → Disclaimer. Radar alimentado **automaticamente** pelo motor canônico. Temas
como blocos opcionais (bancos, varejo, cashback) para cumprir a promessa da landing.

**Weekly ideal** — produto de **síntese e preparação**, **derivada** da Daily, não
redigida do zero. Tese → **Ranking de oportunidades vigentes** (do lineage da semana,
ordenado por score × confiança × acionabilidade) → Radar de médio prazo (P30+P90) →
Movimentos (auto do ledger) → **Estratégia por perfil** (2 trilhas para começar) →
O que monitorar → Fontes. Cron semanal próprio; sem dado velho.

**Automação ideal:** cron de forecast/predict diário + snapshot persistido e datado;
extração LLM com validação estruturada e auto-retry; crons versionados em migration;
um só coletor de VPM; um só pipeline de edição (aposentar o legado). Fronteira
inviolável mantida: máquina calcula, humano aprova, e-mail só por ação humana.

**Coleta ideal:** lista de fontes versionada e auditável; dedup com URL + fingerprint
de texto; filtro de idade de série; cobertura autenticada onde for legal/possível;
nível de fonte (1–4) como campo estruturado, não só julgamento.

**Régua de qualidade ideal (o que hoje não existe):**

| Faixa TL Score | Política proposta |
|---|---|
| 85–100 (Vale agir) | Publicável, mas **exige** breakdown + fonte nível 1–2 + vigência confirmada; revisão humana obrigatória (alto risco de marca). |
| 70–84 (Vale olhar) | Publicável com breakdown; revisão padrão. |
| 55–69 / 40–54 | Publicável; entra como contexto, não destaque. |
| 0–39 (Evitaria) | Publicável como alerta de "não caia nessa" (valor editorial), nunca como recomendação. |
| s/ dado (Não confirmado) | Só radar de monitoramento; **bloqueia** qualquer linguagem de recomendação. |

Condições que **forçam revisão humana mesmo com score alto:** fonte nível 3–4,
vigência não confirmada, série duplicada/anômala, radar não-fresco, primeiro deal de
um programa novo. **Condições que bloqueiam auto-publicação mesmo com score alto:**
qualquer regra inviolável, dataset incompleto, artefato stale. Modelo recomendado:
**aprovação por exceção** — o sistema propõe, os bloqueios críticos nunca recebem
override, e o humano só toca no que cai fora dos trilhos.

**Predict ideal:** motor `predict_v2` como fonte, com backtest visível internamente e
frescor + amostra + "o que invalida" visíveis ao leitor; probabilidade como faixa,
nunca ponto; KPI window-hit real medindo previsto × realizado.

### 14.5. Perguntas que ainda precisam de resposta interna

Cada uma trava uma decisão de produto:

1. **O produto vai lançar com qual motor de Radar?** Forecast (pronto, sem acurácia) ou
   esperar o Predict (acurácia, mas dormente e fora do MVP)? *Decide se o Radar sai no
   go-live ou fica "em breve".*
2. **Qual é a política real de publicação?** Vai existir nota de corte / faixas de
   decisão, ou segue 100% editorial? *Decide se há automação parcial ou não.*
3. **O TL Score deve ser calculado por código?** Se sim, os 8 critérios viram campos
   obrigatórios com regras de derivação — precisa do "Operating Manual v1" que **não
   existe**. *Decide reprodutibilidade e escala da curadoria.*
4. **As personas são de produto ou só de marketing?** Se de produto, qual persona é a
   primeira trilha? *Decide se há personalização e por onde começar.*
5. **A Weekly consolida a Daily automaticamente?** Aceita-se derivar movements/ranking
   do ledger, ou a Weekly é curadoria independente? *Decide o acoplamento e o esforço
   semanal.*
6. **Qual a cadência e o horário oficiais da Weekly?** A landing diz "fim de semana"; o
   exemplo diz 9h; falta cron. *Decide a operação semanal.*
7. **Lab e Pro:** Lab entra no roadmap (está vendido como "Incluído") e o Pro sai de
   "em breve" (está pronto)? *Decide o alinhamento landing↔produto.*
8. **Cobertura de fontes:** qual é a lista canônica de portais e ela pode ser
   versionada? Coleta autenticada está no escopo? *Decide a cobertura real e o teto de
   qualidade do dado.*
9. **Os ADRs do Radar e a hierarquia de autoridade serão ratificados** (hoje todos
   "proposed"; docs de autoridade fantasmas)? *Decide a governança formal.*
10. **Qual o orçamento de correção de dado a montante** (dedup, idade, reconciliação)
    antes de expor previsão ao leitor? *Decide se o Radar publicado é confiável.*

> **Onde faltou dado, não chutei:** a frequência exata dos crons do Supabase, a lista
> de portais de notícia, a lógica de origem do `tl_score` no banco `campaigns` e a
> acurácia real do predict **não estão no repositório** — vivem no banco/operação ou
> ainda não foram medidas. Estão nas perguntas 8, 10 e 1 acima porque são exatamente as
> informações que faltam para fechar a construção.
