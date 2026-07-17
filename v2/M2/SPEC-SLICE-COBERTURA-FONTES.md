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
**Priorizar por quantas vivas cada programa desbloquearia** (medir na base, não chutar):

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

**Fluxo proposto (reusa matcher-url + adapters):**
1. Para cada viva **sem** fonte oficial, com origem/destino em programa **com adapter**:
   gera **URL(s) candidata(s)** varrendo o sitemap daquele programa por página de
   campanha do par (ex.: `livelo→azul` → procura no sitemap Livelo a página que o
   matcher mapeia para `azul`).
2. Fetch + detecção de janela (D-047) + gate de confiança (D-049): corrobora/ajuste/
   refuta. Alimenta o mesmo gate da Parte A.
3. Sem candidata no sitemap coberto → cai na **fila de revisão** (Parte C) com a
   **URL candidata heurística** (site oficial do programa) para confirmação manual.

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

## 5. Fora de escopo

- Não liga auto-publish (D-050: espera calibração). A coleta segue confirma-e-mostra.
- Não constrói o track record (D-046, superfície M3) — é frente paralela de conteúdo.
- Não re-scora (Parte B da coleta já cuidou do lado-único).

---

## 6. Definição de pronto

- Frente B: reverse-lookup rodando sobre as vivas sem fonte; mede quantas reencontram
  oficial (auto) vs viram fila manual com candidato.
- Frente A: N adapters novos (na ordem medida), cada um com robots verificado +
  detecção de janela + testes; mede vivas desbloqueadas por adapter.
- Frente C: telemetria de cobertura por execução; render Chromium no fluxo padrão.

---

## 7. Decisões que aguardam o operador (paro aqui — spec antes de código)

1. **Ordem B→A→C confirmada?** Reverse-lookup primeiro (retorno sem adapter novo),
   depois adapters guiados por medição?
2. **Quais adapters priorizar na Frente A** — deixo a medição decidir (quantas vivas
   cada programa desbloqueia) e trago o ranking antes de construir, ou você já quer
   cravar os próximos (ex.: Azul + Itaú + C6)?
3. **URL candidata heurística** na fila manual (Frente B/C): gero o link candidato
   do site oficial por heurística de programa, ou só marco "buscar fonte oficial"
   sem chutar URL (mais conservador)?
4. **Escopo desta slice:** só Frente B agora (rápido, alto retorno) e A/C numa
   próxima, ou as três juntas?

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de
comprar, transferir ou resgatar.*
