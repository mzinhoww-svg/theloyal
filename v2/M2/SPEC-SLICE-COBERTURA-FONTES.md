# M2 · Slice — Expansão de cobertura de fontes oficiais (SPEC, antes de código)

> **Por que agora (D-050).** A máquina está provada; o Deal Desk vivo espera **oferta
> forte, não data**. O gargalo virou **cobertura**: no lote-1, **15 de 18** vivas
> crawleáveis não têm URL oficial de campanha → **nem chegam ao gate**. A máquina só
> enxerga oferta de quem tem **página oficial detectável**. Esta slice aumenta a
> probabilidade de capturar a próxima oferta forte no instante em que ela surgir.
>
> **Meta:** maximizar a fração de ofertas vivas com **fonte oficial confirmável**.
> Não é publicar mais — é **ver** mais, para o gate (D-048/D-049) poder decidir.

---

## 0. Estado atual (o buraco de cobertura)

- 4 adapters (Livelo, Smiles, Esfera, TAP) sobre sitemaps oficiais (D-009, D-029).
- Lote-1: 18 vivas crawleáveis → 1 corrobora_limpo (hilton), 1 ajuste (smiles), 1
  evergreen, **15 sem URL oficial**. Os 15 são compra/clube/acúmulo/intermediário
  vindos de **terceiro**, cuja **origem não tem adapter** ou cuja **campanha não está
  no sitemap coberto**.
- Consequência: uma oferta forte que apareça num programa **sem adapter** é **invisível**
  ao gate — perde-se a captura. Cobertura = alcance da rede de fontes oficiais.

---

## 1. Frente A — Mais adapters (priorizados por potencial de desbloqueio)

Adicionar adapters segue o padrão `criarAdapter(config)` (`v2/lib/adapters/base.mjs`):
sitemap oficial + `incluir`/`excluir` + robots + detecção de janela de vigência (D-047).
**TRAVA (priorização):** o corte que decide qual adapter construir é **"onde há oferta
FORTE viva bloqueada por falta de fonte"** — não volume bruto de campanhas históricas.
A métrica é: `vivas + tl_score_bruto alto ("Vale olhar"/"Vale agir") + sem TIER 1`, por
programa. Construir o adapter que destrava a oferta forte, não o que tem mais lixo
histórico. Medir na base, não chutar:

1. **Destinos que rodam campanha própria:** Azul Fidelidade, LATAM Pass, Smiles
   (origem já coberta; como **destino** têm página de campanha própria — ex.: a página
   oficial azul que resolveu o caso `livelo→azul`).
2. **Bancos emissores** (origem de transferência bonificada): Itaú, C6, Inter, BB,
   Bradesco, Santander — rodam "transfira X% para o parceiro" em página oficial.
3. **Varejo/compra** (origem `sem_destino` de compra de pontos): os merchants com mais
   vivas na fila (medir: quais `origem_code` de compra aparecem mais entre as vivas).

**Regra de entrada de adapter (D-009):** só programa com robots que permita + sitemap/
página de campanha estável. Sem isso → fica na Frente C (candidato manual).

---

## 2. Frente B — Reverse-lookup: da oferta de terceiro à página oficial (fecha os 15)

Hoje o fluxo é **sitemap → matcher → casa com vivas**. Falta o inverso: dada uma
**oferta viva já detectada** (de terceiro, com `origem_code`/`destino_code`/%), **ir
buscar** a página oficial correspondente.

**TRAVA (motor de busca + domínio):** o "motor de busca" do reverse-lookup é o
**sitemap OFICIAL do programa** (não web search geral). Critério de TIER 1: **só
domínio oficial do programa com página de campanha datada** vira TIER 1 — blog/agregador
que apareça em qualquer busca **NÃO** vira TIER 1 por ter sido encontrado (senão
readmite TIER 2 disfarçado — D-045). Fonte oficial é o domínio do programa, ponto.

**TRAVA (alimenta o gate, não o pula):** achar a página oficial **não confirma** a
oferta — a página passa pelo **gate de confiança (D-048/D-049)**, que corrobora, ajusta
ou refuta (como fez com o azul). Reverse-lookup **expande o alcance** do gate, não o
substitui.

**Fluxo proposto (reusa matcher-url + adapters):**
1. Para cada viva **sem** fonte oficial, com origem/destino em programa **com adapter**:
   gera **URL(s) candidata(s)** varrendo o **sitemap oficial** daquele programa por
   página de campanha do par (ex.: `livelo→azul` → procura no sitemap Livelo a página
   que o matcher mapeia para `azul`). Só domínio oficial.
2. Fetch + detecção de janela (D-047) + **gate de confiança (D-049)**: corrobora/ajuste/
   refuta. **Alimenta o mesmo gate da Parte A** — não pula nenhuma trava.
3. Sem candidata no sitemap coberto → cai na **fila de revisão** (Parte C) com a
   URL candidata **do domínio oficial** para confirmação manual (nunca um blog).

Isso transforma "15 sem URL oficial" em: **X reencontram a página oficial** (viram
gate automático) e **Y** viram fila manual com candidato — em vez de simplesmente
invisíveis.

---

## 3. Frente C — Robustez dos adapters existentes

- **Detecção de janela de vigência** no regulamento (D-047) endurecida: distinguir
  campanha (janela datada) de evergreen (paridade institucional) de forma robusta,
  inclusive páginas JS (render Chromium quando o cru não tiver a janela).
- **Matcher URL→campanha:** cobrir mais padrões de URL oficial por programa.
- **Telemetria de coleta** (`coleta_execucoes`, D-028): registrar cobertura por
  execução (quantas vivas viram fonte, quantas ficaram invisíveis) — insumo do
  accuracy loop e desta própria priorização.

---

## 4. Priorização (proposta)

1. **Frente B primeiro** (maior retorno imediato): usa os 4 adapters que já temos
   sobre as vivas que já temos — reencontra páginas oficiais sem construir adapter novo.
2. **Frente A depois**, guiada por medição: adicionar adapters na ordem de quantas
   vivas cada um desbloqueia (medir antes de construir).
3. **Frente C contínua:** robustez entra junto, é dívida de qualidade dos adapters.

**Métrica-alvo:** fração de vivas com fonte oficial confirmável hoje (baixa) → medir
o ganho de B, depois de cada adapter de A. O objetivo não é um número de publicação
(D-050: publicação é gatilhada por oferta), é **alcance da rede de fontes**.

---

## 5. Fora de escopo + DEPENDÊNCIA (edge fn / vigência)

- Não liga auto-publish (D-050: espera calibração). A coleta segue confirma-e-mostra.
- Não constrói o track record (D-046, superfície M3) — é frente paralela de conteúdo.
- Não re-scora (Parte B da coleta já cuidou do lado-único).

**DEPENDÊNCIA CRÍTICA — correção da edge fn (vigência confiável) [vem do chat de predict]:**
o chat de predict descobriu que o **bug de corrupção temporal está VIVO na extração**
(a edge fn produz datas erradas em notícias novas). A cobertura vai trazer **mais
campanhas com data**; se a extração ainda corrompe o ano, as novas **nascem com vigência
errada**. Vigência é um dos **três portões** (D-044): campanha com data corrompida **falha
o portão de vigência** ou, pior, **passa com data errada**. **A correção da edge fn
(que o chat de predict está montando) é PRÉ-REQUISITO para que as campanhas capturadas
pela cobertura tenham vigência confiável.** Não trava a Frente B (reverse-lookup pode
rodar), MAS: a **vigência das novas campanhas só é confiável depois que a origem for
corrigida**. Alinhar com o chat de predict via HANDOFF — é o ponto concreto que liga o
chat principal ao de predict.

---

## 6. Definição de pronto

- Frente B: reverse-lookup rodando sobre as vivas sem fonte; mede quantas reencontram
  oficial (auto) vs viram fila manual com candidato.
- Frente A: N adapters novos (na ordem medida), cada um com robots verificado +
  detecção de janela + testes; mede vivas desbloqueadas por adapter.
- Frente C: telemetria de cobertura por execução; render Chromium no fluxo padrão.

---

## 7. Decisões para ratificar (com os 4 travamentos do operador baqueados)

Os **4 travamentos** do operador estão refletidos no corpo: (1) reverse-lookup **alimenta
o gate**, não o pula (§2); (2) **critério de domínio oficial** — só domínio do programa com
página datada vira TIER 1, blog não (§2); (3) adapter priorizado por **oferta forte viva
bloqueada por falta de fonte**, não volume (§1); (4) robustez testa a **URL compartilhada
campanha/evergreen** pela janela de vigência (§3, D-047). As 4 decisões para bater o martelo:

1. **Ordem B→A→C** — aprovada pelo operador (reverse-lookup primeiro, sem adapter novo).
2. **Motor de busca da Frente B = sitemap OFICIAL do programa** (não web search geral),
   com critério de **domínio oficial** (travamento 2). Ratificar este desenho? (a
   alternativa — web search geral — é o que readmitiria blog; por isso sitemap oficial.)
3. **Corte de priorização de adapter (Frente A) = "oferta forte viva sem TIER 1"**
   (travamento 3), não volume bruto. Ratificar? Com o OK, **meço na base e trago o
   ranking** de programas por oferta-forte-bloqueada **antes** de construir qualquer adapter.
4. **Escopo desta slice: só Frente B agora** (rápido, alto retorno, sem adapter novo) —
   A e C numa próxima. Recomendo. Ou quer as três juntas?

**Dependência registrada (§5):** vigência confiável das novas campanhas depende da
correção da edge fn (chat de predict). Não trava a Frente B.

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de
comprar, transferir ou resgatar.*
