# Plano GTM Social — The Loyal

> Planejamento de aquisição via **Twitter/X + LinkedIn** com foco em conquistar
> assinantes da newsletter, executado de forma **agressiva porém automatizada**
> (Claude + conectores Composio) partindo do **zero** em ambos os canais.
>
> Documento interno de estratégia. **Toda entrega respeita as regras invioláveis
> do `CLAUDE.md`** (sem urgência artificial, sem emoji no corpo/UI, sem promessa
> de ganho, disclaimer quando há recomendação, "Não confirmado" quando falta
> dado, redação própria). Em conflito, o `CLAUDE.md` tem precedência.
>
> Complementa, no topo de funil, o diagnóstico on-site de
> [`ANALISE-CONVERSAO.md`](./ANALISE-CONVERSAO.md) e
> [`PLANO-CONVERSAO.md`](./PLANO-CONVERSAO.md).

---

## Como usar este documento

1. **Seção 1** — o relatório granular (o "porquê"): produto, personas, funil.
2. **Seção 2** — o plano (o "como"): automação, canais, cadência, métricas.
3. **Seção 3** — o content: bios, fixados e os 5 formatos-pilar.
4. **Seção 4** — o calendário de 30 dias + o banco de posts evergreen prontos.
5. **Seção 5** — o guia de setup do Composio (conectar e ligar o auto-post).
6. **Seção 6** — guardrails e checklist de saída por peça.

> Onde aparece `[baseline]` ou `[preencher]`, o dado é seu — não é chutado
> (regra 9). As edições em `content/editions/` estão com `illustrative: true`;
> **nenhum deal específico delas pode ir ao social como oferta real** — servem
> de molde de formato, não de conteúdo publicável.

---

## Seção 1 — Relatório granular (`analyze`)

### 1.1 Product profile — o que se distribui

The Loyal não é "uma newsletter"; é um **sistema editorial com IP proprietário**
e um motor de dados por trás.

| Camada | Ativo (no repo) | O que é | Papel no GTM |
|---|---|---|---|
| Diário | `content/editions/` | Sinal do dia + Deal Desk + Fecha logo + Shopping Watch | Topo de funil — o hábito das 8h |
| Semanal | `content/weekly/` | Movimentos (novas/seguem/venceram) + radar de recorrência | Autoridade/tendência → LinkedIn |
| Mensal Pro | `content/pro/` | TL Score médio, distribuição de veredito, base CPM/VPM | Prova de profundidade → isca de Pro |
| Motor de dados | `content/forecast.json`, Radar/Supabase | 119 linhas de ledger, 23 rotas, 9 clusters, 8 com previsão | O fosso defensável |

**IP proprietário (granular):**

1. **TL Score (0–100)** — nota composta por **8 critérios** (campo `scoreBreakdown`
   das edições): valor, regra, vigência, fricção, aplicabilidade, liquidez,
   estoque, fontes. Mapeado para 6 vereditos (Vale agir → Evitaria → Não
   confirmado). É o selo e o ativo social mais compartilhável.
2. **Deal Desk** — a "conta feita": CPM final, VPM de resgate, spread, com fonte
   e vigência.
3. **Fecha logo** — oferta de vigência curta com a conta pronta (editorial, não
   urgência artificial).
4. **Shopping Watch / VPM** — VPM observado por categoria com `sampleN` e fonte;
   combate o "bônus cosmético".
5. **Forecast** — projeção de janela por recorrência do ledger, com aviso
   explícito de que cadência não é agenda. Honestidade como produto.

**Insight GTM:** o diferencial não é "achar promoção" (isso é blog de cupom), é
**método auditável + dado histórico**. A comunicação social vende o *método*, não
o *deal* — o deal expira, o método fideliza.

### 1.2 Personas (as 4 oficiais de `components/sections.tsx`)

| # | Persona | Job-to-be-done | Canal | Objeção | Gancho | Ativo |
|---|---|---|---|---|---|---|
| P1 | "Usa pontos de vez em quando" | Não gastar à toa | X | "complicado demais" | 1 fórmula, 3 exemplos | Lead magnet CPM |
| P2 | "Já acumula bastante" | Preço/hora certos de transferir | X | "já sigo 5 fontes" | TL Score + Fecha logo | Daily / Deal Desk |
| P3 | "Tem/quer cartão premium" | Anuidade compensa? | X + LinkedIn | "o gerente já me diz" | Independência | "Mito vs. conta" |
| P4 | "Trabalha com o assunto" | Ler o mercado antes | LinkedIn | "preciso de rigor" | Método + tendência | Weekly / Pro |

X carrega P1/P2/P3 (consumidor); LinkedIn carrega P3/P4 (decisão e profissional).
P4 é também quem abre a porta B2B (`/anuncie`, patrocínio).

### 1.3 Auditoria de funil (estado real, esclarecido pelo cliente)

O form **funciona em produção** — o e-mail vai ao Beehiiv no cadastro. O mock só
existe no `main`, o que é **higiene de repo** (reconciliar para um redeploy não
regredir), não bloqueio de conversão. Decisão: **rodar social e ajustes de funil
em paralelo**.

| Item (funil) | Sev | Efeito no GTM social | Ação |
|---|---|---|---|
| Reconciliar form no `main` (P0-A) | 🟡 | Redeploy futuro pode regredir ao mock | Higiene, semana 1 |
| Analytics + UTM por origem (P0-C) | 🟠 | Sem isso não se sabe se X ou LinkedIn converte | **Fazer antes de medir** |
| Imagem OG (P1-A) | 🟠 | Todo link social sai sem card → CTR despenca | **Maior ROI no 0→1** |
| `/privacidade` (P0-B) | 🟠 | Base LGPD para captar via social | Pré-escala |
| Rodapé/edição real (P1-D) | 🟡 | Perfil manda pra landing com link morto | Higiene |

### 1.4 Baseline a capturar (você preenche — regra 9)

- Assinantes Beehiiv: `[baseline]` · open rate médio do Daily: `[baseline]`
- Seguidores X / LinkedIn: `[baseline]` / `[baseline]`
- Beehiiv Recommendations ativo? Automations de boas-vindas existem? `[verificar]`
- Verba p/ tráfego pago em 90 dias: `[baseline]` (ou zero → só orgânico)

### 1.5 Posicionamento e casa de mensagens

**Statement:** *The Loyal faz a conta em reais de cada promoção de pontos e milhas
e diz, com método auditável, se vale a pena — sem torcer para nenhum programa.*

| Pilar | Prova | Persona | Formato |
|---|---|---|---|
| "A conta, não a manchete" | Deal Desk / CPM / VPM | P1, P2 | Thread, print TL Score |
| "Método, não palpite" | TL Score 8 critérios | P3, P4 | Carrossel de método |
| "Independência" | Ninguém paga pela opinião | P3, P4 | Ensaio, "Mito vs. conta" |

---

## Seção 2 — O plano

### 2.1 Arquitetura de automação (Claude + Composio MCP)

```
FONTE (já existe)              MOTOR (Claude)                  SAÍDA (Composio MCP)
content/editions/*.json ─┐
content/weekly/*.json    ├─►  lê a edição do dia
content/pro/*.json       │    aplica guardrails         ┌─►  X (create tweet / thread)
content/forecast.json  ──┘    gera N peças por pilar  ──┤
                              classifica risco           └─►  LinkedIn (create post)
                                     │
                                     ▼
                            PORTÃO humano-no-loop
                 (deals/recomendação = aprovar; evergreen = auto)
```

**Regra de ouro (não-negociável — regra 9 + conteúdo `illustrative`):**

| Tipo de peça | Auto-postar? | Por quê |
|---|---|---|
| Método, Ponto comenta, "Mito vs. conta" evergreen, recaps | ✅ Auto | Não recomenda deal, não expira |
| Sinal do dia, Deal Desk, Fecha logo, print de TL Score | 🔴 Rascunho → aprovar | Carrega recomendação/veredito/vigência; exige verificar fonte + disclaimer |

A automação **gera 100%** e **posta sozinha só o que é seguro**. O que recomenda
passa por um toque humano de ~30s. Volume agressivo sem violar a marca.

### 2.2 Orçamento de 20k tool calls/mês (Composio free)

| Uso | Chamadas/mês (agressivo) |
|---|---|
| Posts X (3/dia ≈ 90, +mídia) | ~150 |
| Posts LinkedIn (1/dia ≈ 30) | ~50 |
| Ler menções/timeline p/ engajar (3x/dia) | ~1.800 |
| Respostas automatizadas (5/dia) | ~150 |
| Puxar métricas diárias | ~60 |
| **Total** | **~2.200 / 20.000** |

Os 20k **não são o gargalo** (sobra ~9x). O limite real é a qualidade editorial
(o portão humano).

> ⚠️ **Verificar (Não confirmado):** chamadas do Composio são separadas das cotas
> das APIs do X e do LinkedIn. A camada gratuita da API do X tem teto de *escrita*
> próprio (restrito e mutável) e a API de posts do LinkedIn exige app aprovado com
> escopo `w_member_social`. Confirmar os limites atuais das duas antes de assumir
> o volume agressivo. Se capar, priorizar LinkedIn + X manual.

### 2.3 Setup 0→1 dos canais (semana 1)

**Twitter/X:** handle consistente (ex.: `@theloyalbr`, verificar disponibilidade);
foto = selo TL; banner "a imagem é dado"; thread fixada (Seção 3); link na bio →
landing `?utm_source=twitter`.

**LinkedIn:** página da empresa + perfil pessoal como amplificador (no 0→1 o
pessoal cresce mais rápido; poste pela página, reamplifique no pessoal); "Featured"
= edição real; link no **primeiro comentário** (não no corpo) → `?utm_source=linkedin`.

**Track paralelo (funil):** reconciliar form no `main`; UTM + evento
`subscribe_success`; **imagem OG (prioridade máxima no 0→1)**.

### 2.4 Cadência agressiva (alimentada pela automação)

| | X/dia | LinkedIn/semana |
|---|---|---|
| Volume | 3 (Sinal do dia + 1 pilar + 1 engajamento/quote) | 5 (ensaio, método, mito, radar, +1) |
| Auto vs. aprovar | 1 auto + 2 aprovar | 2 auto + 3 aprovar |
| Bloco humano | 15 min/dia: aprovar deals + engajar | idem |

O motor gera o lote da semana no domingo + os "Sinais do dia" às 7h (antes do
Daily das 8h, para o social puxar pra edição).

### 2.5 Crescimento 0→1 (as primeiras 1.000 pessoas certas)

- **X:** 15 min/dia de reply analítico (com dado/conta) em threads de milhas/
  finanças. Canal nº1 de descoberta no 0→1. Claude propõe respostas para aprovar.
- **LinkedIn:** comentar denso em posts de líderes de loyalty/CRM/varejo antes de
  esperar tração própria. Distribuição > publicação nos primeiros 60 dias.
- **Beehiiv Recommendations:** ativar já — menor CAC para newsletter, independe de
  audiência social.
- **1 colaboração/mês** com criador/newsletter não-concorrente.

### 2.6 Métricas e roadmap de 90 dias

**North Star:** assinantes confirmados/semana (não seguidores).

| Fase | Semanas | Foco | Meta (sobre `[baseline]`) |
|---|---|---|---|
| 0 — Fundação | 1 | Setup + OG + UTM + automação conectada | Motor postando, medição ligada |
| 1 — Ritmo | 2–5 | Cadência completa + engajamento diário | 1ª leitura: X vs LinkedIn |
| 2 — Escala | 6–9 | Dobrar no canal/formato campeão + colab | +X% assinantes/sem |
| 3 — Otimização | 10–13 | Cortar o que não converte + régua de e-mail | Relatório 90d |

Instrumentar por `utm_source` é o que revela onde investir a energia agressiva.

---

## Seção 3 — Content base

### 3.1 Bios

**X (≤160 caract.):**
> A conta em reais de cada promoção de pontos e milhas. Método auditável, TL Score
> de 0 a 100, zero torcida. O Daily chega todo dia útil às 8h.

**LinkedIn — tagline:**
> Mídia independente de loyalty. Fazemos a conta e dizemos se vale a pena — com
> método, não palpite.

**LinkedIn — Sobre:**
> The Loyal é uma mídia vertical independente sobre pontos, milhas, cartões,
> cashback e o comportamento de quem usa loyalty a sério. Não somos blog de cupom
> nem canal de programa. Pegamos cada promoção, fazemos a conta em reais (CPM, VPM,
> spread), atribuímos um TL Score de 0 a 100 com oito critérios auditáveis e
> dizemos, sem torcer para nenhum banco ou programa, se vale agir, vale olhar ou é
> melhor esperar. Quando falta regra ou vigência, classificamos como Não
> confirmado — não chutamos.

### 3.2 Thread fixada do X

> 1/ A maioria das "promoções imperdíveis" de milhas não sobrevive a uma conta
> simples. A gente faz essa conta todo dia.
>
> 2/ O método: pegamos a oferta, calculamos o CPM (quanto custa cada mil milhas
> depois do bônus) e o VPM (quanto ela vale no resgate real). Spread positivo?
> Talvez valha. Negativo? A manchete mentiu.
>
> 3/ Cada oferta recebe um TL Score de 0 a 100, com oito critérios: valor, regra,
> vigência, fricção, aplicabilidade, liquidez, estoque e fontes. A nota é
> auditável — mostramos como chegamos nela.
>
> 4/ E a régua é honesta: se falta regulamento ou data, não é "oportunidade". É
> Não confirmado. Preferimos perder o hype a errar a sua conta.
>
> 5/ Ninguém paga pela nossa opinião. Nenhum banco, nenhum programa. Se um dia
> houver anúncio, ele vem marcado antes do conteúdo.
>
> 6/ Isso vira uma edição de 5 minutos todo dia útil às 8h. O que mudou, por que
> importa, qual é a conta, qual é o risco.
>
> 7/ Se você usa pontos a sério, é de graça: [link]

### 3.3 Post fixado/Featured do LinkedIn

> Existe uma diferença entre saber que uma promoção existe e saber se ela vale a
> pena. A primeira qualquer canal entrega. A segunda exige uma conta.
>
> No The Loyal, toda oferta de pontos ou milhas passa pela mesma régua: o CPM
> depois do bônus, o VPM no resgate real, o spread entre os dois. O resultado vira
> um TL Score de 0 a 100 com oito critérios auditáveis — e um veredito direto:
> vale agir, vale olhar, ou melhor esperar.
>
> Quando falta regra publicada ou vigência, não forçamos um veredito. Classificamos
> como Não confirmado. É menos empolgante e mais útil.
>
> A análise completa vira uma edição diária de cinco minutos. Independente, sem
> torcida, sem letra miúda. (link no comentário)

### 3.4 Os 5 formatos-pilar (molde)

**1. Sinal do dia (X — diário, aprovar):**
> Sinal do dia: [programa] mexeu em [regra]. Na prática, o CPM do resgate mais
> usado saiu de R$ [x] para R$ [y]. Continua valendo? Depende do resgate. A conta
> feita e o TL Score na edição de hoje. [link]

**2. Deal Desk aberto (X — aprovar):**
> A conta de hoje: [origem] → [destino], com [bônus]% de bônus.
> Custo: R$ [x] · milhas finais: [n] · CPM: R$ [y]/milheiro.
> Isso é caro ou barato? Depende do VPM do seu resgate. O spread e o TL Score
> completo na edição. [link]
> (Promoções podem mudar sem aviso. Confira as regras no site oficial.)

**3. Método à mostra (LinkedIn/X — auto):**
> Por que a gente não confia em "bônus de 100%". Um bônus dobra a quantidade de
> pontos, não o valor deles. Se o ponto vale pouco no resgate, 100% de bônus sobre
> pouco continua pouco. O que decide é o VPM — quanto a milha vale quando você usa.

**4. Mito vs. conta (X — auto):**
> "Milha nunca desvaloriza." Desvaloriza sim — silenciosamente. Quando um programa
> sobe o custo de resgate sem anúncio, sua milha vale menos sem você notar. A conta
> que mostra isso é o VPM ao longo do tempo.

**5. Ponto comenta (X — auto, leve):**
> O Ponto viu mais um "bônus histórico". Levantou a sobrancelha. Foi conferir a
> vigência. Não achou regulamento. A sobrancelha continuou levantada.

---

## Seção 4 — Calendário de 30 dias + banco de posts

Regra de leitura do calendário: **Sinal do dia** e **Deal Desk** são
`[preencher]` diariamente com o deal verificado da edição (risco alto = aprovar).
Os slots **Método / Mito / Ponto / Ensaio** já vêm prontos no banco abaixo — são
evergreen e podem ir para a fila de auto-post.

### 4.1 Grade de 4 semanas

| Dia | X — post 1 | X — post 2 (pilar) | LinkedIn |
|---|---|---|---|
| S1 Seg | Thread fixada | Sinal do dia `[preencher]` | Post fixado + 3 comentários |
| S1 Ter | Sinal do dia `[preencher]` | Método M1 | comentar 15 min |
| S1 Qua | Sinal do dia `[preencher]` | Mito V1 | Carrossel de método (M1) |
| S1 Qui | Sinal do dia `[preencher]` | Deal Desk `[preencher]` | comentar 15 min |
| S1 Sex | Sinal do dia `[preencher]` | Ponto P1 | Ensaio E1 (Weekly) |
| S1 Sáb | Recap da semana | — | — |
| S2 Seg | Sinal do dia `[preencher]` | Método M2 | Ensaio E2 + comentários |
| S2 Ter | Sinal do dia `[preencher]` | Mito V2 | comentar 15 min |
| S2 Qua | Sinal do dia `[preencher]` | Deal Desk `[preencher]` | Carrossel de método (M2) |
| S2 Qui | Sinal do dia `[preencher]` | Ponto P2 | comentar 15 min |
| S2 Sex | Sinal do dia `[preencher]` | Método M3 | Ensaio E3 (radar) |
| S2 Sáb | Recap da semana | — | — |
| S3 Seg | Sinal do dia `[preencher]` | Mito V3 | Ensaio E4 + comentários |
| S3 Ter | Sinal do dia `[preencher]` | Método M4 | comentar 15 min |
| S3 Qua | Sinal do dia `[preencher]` | Deal Desk `[preencher]` | Carrossel de método (M4) |
| S3 Qui | Sinal do dia `[preencher]` | Ponto P3 | comentar 15 min |
| S3 Sex | Sinal do dia `[preencher]` | Mito V4 | Ensaio E5 |
| S3 Sáb | Recap da semana | — | — |
| S4 Seg | Sinal do dia `[preencher]` | Método M5 | Ensaio E6 + comentários |
| S4 Ter | Sinal do dia `[preencher]` | Ponto P4 | comentar 15 min |
| S4 Qua | Sinal do dia `[preencher]` | Deal Desk `[preencher]` | Carrossel de método (M5) |
| S4 Qui | Sinal do dia `[preencher]` | Mito V5 | comentar 15 min |
| S4 Sex | Sinal do dia `[preencher]` | Método M6 | Ensaio E7 |
| S4 Sáb | Recap do mês | — | — |

### 4.2 Banco — Método à mostra (M1–M6, evergreen, auto)

**M1.** Por que a gente não confia em "bônus de 100%". Um bônus dobra a quantidade
de pontos, não o valor deles. Se a milha vale pouco no resgate, 100% sobre pouco
continua pouco. O que decide é o VPM — quanto ela vale quando você usa. Por isso o
TL Score pesa liquidez de resgate, não tamanho de bônus.

**M2.** CPM em uma linha: pegue o quanto você pagou, divida pelas milhas em
milheiros. R$ 1.200 por 100 mil milhas dá R$ 12 por milheiro. Esse é o número que
diz se a oferta é cara. Sem ele, "100% de bônus" é só uma manchete.

**M3.** VPM é o outro lado da conta. Não basta a milha ser barata para acumular; ela
precisa valer mais do que custou quando você resgata. VPM abaixo do CPM significa
que você pagou caro por um crédito que vale pouco. Spread é a diferença entre os dois.

**M4.** Os oito critérios do TL Score: valor, regra, vigência, fricção,
aplicabilidade, liquidez, estoque e fontes. Uma oferta com bônus alto mas regra
obscura e liquidez baixa não tira nota alta. A nota premia a conta inteira, não o
número da capa.

**M5.** "Vigência confirmada" não é detalhe burocrático. Uma oferta sem regulamento
publicado é uma oferta que pode mudar antes de você agir. Por isso, sem regra e sem
data, a classificação é Não confirmado — e Não confirmado nunca vira recomendação.

**M6.** Por que separamos custo de acúmulo de custo de resgate. Muita gente compara
o preço de comprar pontos com o preço de comprar milhas de outro programa. A
comparação certa é entre o CPM de acúmulo e o VPM de resgate do *seu* destino. É aí
que a maioria das "oportunidades" se desfaz.

### 4.3 Banco — Mito vs. conta (V1–V5, evergreen, auto)

**V1.** "Milha nunca desvaloriza." Desvaloriza sim, silenciosamente. Quando um
programa sobe o custo de resgate sem anúncio, sua milha vale menos sem você notar.
A conta que mostra isso é o VPM ao longo do tempo.

**V2.** "Bônus alto é sempre bom negócio." Não. Bônus alto sobre um ponto de baixo
valor de resgate é bônus cosmético. O que importa é onde a milha final aterrissa, não
a porcentagem no anúncio.

**V3.** "Se todo mundo está transferindo, deve valer." Volume não é veredito.
Recorrência de uma janela no histórico ajuda a preparar a conta, mas não decide por
você — a régua continua sendo o CPM e o VPM no dia.

**V4.** "Cartão premium se paga na milha." Às vezes. A conta é anuidade contra o
valor real das milhas que você de fato resgata, não contra as que você acumula e
deixa expirar. Sem essa subtração, a milha vira custo, não benefício.

**V5.** "Comprar ponto em promoção é sempre barato." Barato em relação a quê? Sem o
VPM do resgate que você pretende, "30% de desconto" é um número solto. Desconto sobre
um preço já ruim continua ruim.

### 4.4 Banco — Ponto comenta (P1–P4, evergreen, auto, humor seco 3ª pessoa)

**P1.** O Ponto viu mais um "bônus histórico". Levantou a sobrancelha. Foi conferir a
vigência. Não achou regulamento. A sobrancelha continuou levantada.

**P2.** O Ponto adora um resgate. O que ele não adora é descobrir que o resgate dos
sonhos custa três vezes mais milhas do que mês passado. Ele anotou. Ele sempre anota.

**P3.** Perguntaram ao Ponto se aquela promoção valia a pena. Ele pediu a conta.
Ainda está esperando a conta.

**P4.** O Ponto não tem programa favorito. O Ponto tem planilha. É diferente.

### 4.5 Banco — Ensaios LinkedIn (E1–E7, ~200 palavras, aprovar se citar dado)

**E1 — Tendência (base Weekly).** Todo programa de fidelidade vive a mesma tensão:
margem de curto prazo contra confiança de longo prazo. Quando um programa aperta a
mecânica de transferência, ganha no trimestre e paga no churn. A conta que raramente
chega ao board é a do consumidor que percebe — e para de acumular. É esse tipo de
movimento que a gente destrincha com método, sem torcer para nenhum lado. (link no
comentário)

**E2 — Método como produto.** Existe uma diferença entre saber que uma promoção
existe e saber se ela vale a pena. A primeira qualquer canal entrega; a segunda
exige uma conta. Por isso toda oferta que analisamos passa pela mesma régua — CPM,
VPM, spread — e vira um TL Score auditável. Não é sobre ter opinião mais forte; é
sobre ter a conta à mostra. (link no comentário)

**E3 — Radar/recorrência.** Recorrência no histórico é uma ferramenta perigosa
quando mal usada. Ver que uma janela de transferência se repetiu cinco vezes tenta a
gente a tratar a próxima como agenda. Não é. Cadência com desvio alto prepara a
conta, não marca a data. A diferença entre as duas leituras é o que separa disciplina
de aposta. (link no comentário)

**E4 — Independência.** A pergunta que mais recebemos: "vocês recebem de algum
programa?" Não. E isso muda o que podemos escrever. Um canal que depende do anunciante
não pode dizer "esperaria" quando o dado pede. Independência não é postura moral aqui;
é pré-requisito de método. (link no comentário)

**E5 — Loyalty e comportamento.** Programa de pontos é, no fundo, um contrato de
confiança com prazo indefinido. Cada mudança silenciosa de regra é um saque nessa
conta de confiança. Alguns programas sacam demais e se surpreendem com o churn. O
dado do consumidor avançado é o primeiro a virar. (link no comentário)

**E6 — Por que "Não confirmado" existe.** A categoria mais impopular do nosso
vocabulário também é a mais útil. Quando falta regra publicada, não forçamos um
veredito bonito. Classificamos como Não confirmado e seguimos. Perder o hype de uma
manchete custa menos do que errar a conta de quem confiou nela. (link no comentário)

**E7 — Para o profissional de CRM/loyalty.** Do lado de quem opera um programa, a
lição é simétrica à do consumidor: o valor percebido da milha é o ativo, não o
passivo contábil. Otimizar o resgate para baixo melhora o balanço e corrói a base.
A conta que importa no longo prazo é a da recorrência, não a do trimestre. (link no
comentário)

### 4.6 Recaps (Sáb, auto)

**Recap semanal (X):** A semana no The Loyal, sem enrolação: [n] ofertas passaram
pela régua, [n] viraram Não confirmado por falta de regra. O padrão continua o
mesmo — a manchete promete, a conta decide. Tudo destrinchado nas edições: [link]

---

## Seção 5 — Guia de setup do Composio

> Objetivo: conectar os MCPs de **LinkedIn** e **X (Twitter)** do Composio ao
> Claude e ligar a rotina de geração + auto-post, dentro do plano free (20k tool
> calls/mês).

### 5.1 Pré-requisitos

1. Conta no Composio (plano free).
2. Conta de desenvolvedor do **X** com app criado e acesso de *escrita*
   (`tweet.write`, `users.read`) — **verificar o teto de escrita da camada
   gratuita atual** antes de assumir 3 posts/dia.
3. **LinkedIn**: app aprovado com escopo `w_member_social` (post no perfil) e/ou
   `w_organization_social` (post pela página da empresa). A aprovação do LinkedIn
   costuma ser o passo mais lento — começar por ele.

### 5.2 Conectar ao Claude (MCP)

1. No Composio, criar as **connections** para X e LinkedIn (OAuth de cada conta).
2. Pegar a URL/credencial do **MCP server** do Composio.
3. Adicionar como conector MCP no cliente Claude que vai rodar a rotina
   (Claude Code / app), autenticando via OAuth.
4. Validar com uma chamada de leitura (ex.: `get me` de cada rede) antes de
   habilitar escrita.

> Nesta sessão os conectores do Composio não estão ligados; o passo acima é feito
> por você no ambiente onde a rotina vai rodar. Depois de ligado, as ferramentas
> aparecem como `mcp__composio__*` (ou nome equivalente).

### 5.3 A rotina de auto-post

Fluxo diário sugerido (07h, antes do Daily das 8h):

1. Claude lê a edição do dia em `content/editions/` (ou weekly/pro).
2. Aplica o **prompt gerador** (5.4) e produz o lote em JSON, com `risk` por peça.
3. **Auto-posta** as peças `risk: "low"` (Método/Mito/Ponto/recap) via Composio.
4. **Segura** as peças `risk: "high"` (Sinal do dia/Deal Desk) num rascunho para
   você aprovar no bloco de 15 min. Aprovadas → posta.
5. Loga o que saiu (id do post, canal, horário) para o relatório de métricas.

Pode ser disparada por cron/Routine/agendador do seu ambiente. O importante é o
**portão humano** entre gerar e postar recomendação.

### 5.4 Prompt gerador (system prompt da rotina)

```
Você gera posts sociais para o The Loyal (X e LinkedIn) a partir da edição do dia.

FONTE: leia o JSON da edição em content/editions/ (ou weekly/pro).

REGRAS INVIOLÁVEIS (nunca quebrar):
- Sem emoji. Sem urgência artificial ("corre", "imperdível", "garanta já").
- Sem promessa de ganho. Bônus alto não é valor automático.
- Se a edição está marcada "illustrative": true, NÃO poste números como reais —
  gere apenas peças de método/evergreen, nunca um deal específico.
- Todo post com recomendação inclui o disclaimer: "Promoções podem mudar sem
  aviso. Confira sempre as regras no site oficial antes de comprar, transferir
  ou resgatar."
- Faltou regra/vigência = "Não confirmado". Nunca chute.
- Voz Sage: analítica, direta, sem hype. Ponto só em 3ª pessoa, humor seco.

SAÍDA (por edição, em JSON, um objeto por peça):
{ "channel": "x" | "linkedin", "format": "...", "text": "...",
  "risk": "low" | "high", "cta_link": "..." }
- x_sinal_do_dia -> risk high
- x_deal_desk -> risk high
- metodo / mito / ponto / recap -> risk low
- linkedin_ensaio -> risk low se evergreen, high se citar dado da edição

CTA: peças de deal terminam com "a conta completa e o TL Score na edição: [link]".
Link X = <landing>?utm_source=twitter
Link LinkedIn = <landing>?utm_source=linkedin (postar no 1º comentário, não no corpo)
```

### 5.5 Economia de chamadas (ficar folgado nos 20k)

- Gerar o lote da semana num único passo no domingo (menos idas ao MCP).
- Ler menções/timeline em lote (paginação enxuta), não item a item.
- Puxar métricas 1x/dia, não a cada post.
- Priorizar escrita (barata em nº de chamadas) sobre polling de leitura (caro).

---

## Seção 6 — Guardrails e checklist de saída (por peça)

Antes de qualquer post (auto ou aprovado), passar por:

- [ ] Sem urgência artificial (nada de "corre", "imperdível", "garanta já",
      countdown, vermelho de urgência).
- [ ] Sem promessa de ganho. Bônus alto ≠ bom negócio automático.
- [ ] Sem emoji no corpo.
- [ ] Recomendação → disclaimer presente.
- [ ] Faltou dado → "Não confirmado", nunca chuta.
- [ ] Redação própria; nada copiado de fonte externa.
- [ ] Sem dado interno de empresa/CMI.
- [ ] Nenhum deal `illustrative` publicado como real.
- [ ] Ponto: 3ª pessoa, humor seco, fora de bloco de cálculo, sem promessa.
- [ ] Imagem = dado (sem avião, cartão 3D, stock, gradiente decorativo).
- [ ] Link com `utm_source` correto por canal.
- [ ] LGPD: captura via social só com `/privacidade` no ar.

---

## Dependências e ordem de execução

| Ordem | Item | Bloqueia | Esforço |
|---|---|---|---|
| 1 | Imagem OG (P1-A) | CTR de todo link social | baixo |
| 2 | UTM + evento `subscribe_success` (P0-C) | medir X vs LinkedIn | baixo |
| 3 | Setup canais 0→1 (bio, fixados) | tudo | baixo |
| 4 | Conectar Composio (LinkedIn primeiro) | auto-post | médio |
| 5 | Rotina + prompt gerador | cadência agressiva | médio |
| 6 | `/privacidade` (P0-B) | escala de captura (LGPD) | baixo |
| 7 | Reconciliar form no `main` (P0-A) | evitar regressão | baixo |
| 8 | Beehiiv Recommendations + régua de boas-vindas | retenção/CAC | médio |

A Fase 0 (itens 1–3) destrava medição e presença; sem ela, o volume agressivo
rende pouco.
