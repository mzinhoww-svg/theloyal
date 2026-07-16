# M2 · Slice 1 — Gate de rejeição (SPEC, antes de código)

> Trava antes de qualquer linha. Aprovação do operador exigida (D-014). Determinismo-primeiro: regra onde couber, LLM só para julgamento. Mede contra os 86 rótulos do golden.

## 0. Por que esta é a 1ª slice do M2

A base publica **36% de não-campanha como campanha** (0/31 negativos rejeitados). Pontuar com precisão uma base 36% suja é lixo com casas decimais. Este gate é o maior ROI do projeto agora (D-014). Ele **não calcula nada** (nem score, nem CPM) e **não reescreve conteúdo** — só decide *entra / não entra / revisão*, com trilha.

## 1. As classes de rejeição — domínio como tabela (fechadas, extensíveis por INSERT)

Tabela nova `motivos_rejeicao` (seed abaixo). **Um sexto padrão entra por INSERT, não por deploy** — mesma filosofia de `programa_aliases`/`pares_transferencia` do M1.

| motivo | descrição | camada que decide |
|---|---|---|
| `cupom_varejo` | desconto/cupom de loja, combustível, serviço — sem mecânica de ponto/milha | determinística |
| `tarifa_pacote_dinheiro` | passagem/diária/pacote em R$ (não é bônus nem acúmulo) | determinística |
| `produto_blog` | curso/produto da própria fonte (UDM, "Dominando o Seats.aero") | determinística (domínio+padrão) |
| `perk_sem_pontos` | benefício de cartão/assinatura sem ponto/milha/cashback (D-012) | determinística (ausência de mecânica no payload) |
| `stunt_rp` | ação de marketing/PR/patrocínio/ops de companhia (sem oferta ao membro) | LLM (julgamento) |
| `exemplo_resgate` | exemplo/disponibilidade de resgate; "economia X%" que não é bônus | LLM (julgamento) |

Cada linha carrega `camada_padrao` (`deterministica|llm`) e `ativo`. A seed é o ponto de partida; a base pode ganhar motivos sem tocar código.

## 2. Arquitetura da decisão — determinismo primeiro, LLM por exceção

Pipeline de duas camadas. **Ordem importa: determinística primeiro, LLM só no que sobrou.**

**Camada A — determinística (barata, auditável por construção):**
- `produto_blog`: domínio da `news_source` marcado como fonte-produto **ou** padrão de título (`curso|mentoria|assine nosso|dominando o`). Casa por dado, não por julgamento.
- `perk_sem_pontos`: o payload extraído **não tem** `percentual` de bônus **nem** unidade de ponto/milha/cashback no destino/mecânica → perk. (D-012: sem CPM/VPM não é campanha.)
- `cupom_varejo`: presença de `OFF|cupom|% de desconto|R$ N de desconto` **sem** unidade de ponto/milha, **e** destino não é programa de fidelidade.
- `tarifa_pacote_dinheiro`: preço em R$/"a partir de" **sem** bônus, tipo hotelaria/tarifa e destino não-programa.

Camada A **só rejeita com regra explícita**; na dúvida, **passa para B**, nunca rejeita por conta própria.

**Camada B — LLM (julgamento, não cálculo):**
- Recebe só o que passou por A. Classifica `stunt_rp` / `exemplo_resgate` / **`campanha`** (aprovado).
- Prompt força **veredito + motivo + evidência (trecho)** e **confidence**. LLM **não inventa número**; só rotula e cita.
- Confidence abaixo do limiar (ver §4) → **não rejeita: manda para revisão** (fila do admin), nunca descarta.

**Registro obrigatório em ambas:** qual camada decidiu (`deterministica|llm`), o `motivo`, a `evidencia` (trecho/domínio) e `confidence`.

## 3. Contrato de auditabilidade (rejeição silenciosa é bug)

Tabela nova `rejeicoes`:

```
rejeicoes(
  id, news_item_id, campaign_id nullable,
  motivo        text  references motivos_rejeicao,
  camada        text  check (camada in ('deterministica','llm')),
  evidencia     text  not null,          -- trecho/domínio que justifica
  confidence    numeric,                 -- null na determinística (é certeza de regra)
  status        text  check (status in ('rejeitada','revisao')) default 'rejeitada',
  decidido_em   timestamptz default now()
)
```

Regras invioláveis do gate:
1. **Toda rejeição grava `motivo` + `evidencia` + `camada` (+`confidence` na B).** Sem evidência, não rejeita.
2. **Campanha real derrubada nunca some.** Se o gate rejeita algo que era campanha (falso-negativo), o operador vê na **fila de revisão** (`status='revisao'` ou baixa confidence) com o motivo — descobre por presença, não por ausência.
3. **Determinística não rejeita no escuro:** só com regra nomeada; ambíguo sobe para B; B ambíguo vai para revisão.
4. Evento espelhado em `campanha_versoes` quando houver `campaign_id` (trilha, coerente com o M1).

## 4. Métricas e alvos do portão da slice (medidos contra os 86 rótulos)

As **duas juntas, sempre** — não aceito ganhar precision de rejeição derrubando campanha boa:

| métrica | alvo que defendo | por quê |
|---|---|---|
| **recall de campanha real** (das 55, quantas sobrevivem) | **≥ 0,95** (perde no máx. 2–3, e para revisão, nunca silêncio) | credibilidade-primeiro: derrubar campanha real é o pior erro |
| **precision de rejeição** (das que o gate rejeita, quantas são mesmo `nao_campanha`) — **número público** | **≥ 0,90** | é o compromisso de metodologia; sai de 0/31 |
| **recall de rejeição** (dos 31 negativos, quantos o gate pega) | **≥ 0,70** (honesto, secundário) | nem todos os 31 são pegáveis com segurança; não super-rejeito p/ inflar |

**Alvo declarado antes de implementar (D-014):** rejeição **precision ≥ 0,90** com **recall de campanha ≥ 0,95**. Recall de rejeição ≥ 0,70 é meta de melhoria, não trava. Se não bater, reporto o mapa de erros por motivo (quais negativos escaparam, quais campanhas caíram) — não forço o número (§7 do critério).

Racional do alvo: ~20 dos 31 negativos são deterministicamente pegáveis (cupom, tarifa, blog, perk) com precision ~1,0; os ~11 restantes (stunt, resgate, ambíguos) vão para a LLM, onde priorizo **precision sobre recall** (confidence baixa → revisão). Isso torna ≥0,90 de precision defensável sem arriscar o recall de campanha.

## 5. Ponto no pipeline

**Entre extração e resolução de identidade.** Não-campanha nem chega a consumir matcher, score nem vaga de digest. Rejeitar cedo é mais barato e mais limpo.

```
coleta → extração (payload cru) → [GATE DE REJEIÇÃO] → resolução de identidade → score → digest
                                        │
                          rejeitada / revisão → tabela rejeicoes (+ fila admin)
```

O gate roda como job na `job_queue` (M1 slice 2), enfileirado após a extração; idempotente por `news_item_id`.

## 6. Fora de escopo desta slice (para não inchar)

- Não recalcula score/CPM/VPM (é a slice do engine, depois).
- Não constrói adapters TIER 1 (dívida M2/M3).
- Não reconcilia o modelo shopping/self-loop do golden (dívida de manutenção do golden, separada — ver `REVALIDACAO-POSCANON.md`).
- LLM só **julga e cita**; jamais calcula ou inventa número (determinismo-primeiro).

## 7. Definição de pronto

1. `motivos_rejeicao` + `rejeicoes` criadas (migration `004`, aditiva, idempotente).
2. Camada A (determinística) + Camada B (LLM auditável) implementadas, cada decisão com trilha.
3. Medição contra os 86: **precision de rejeição e recall de campanha lado a lado**, com mapa de erros por motivo.
4. Falsos-negativos (campanha derrubada) visíveis na fila de revisão — verificado.
5. Fecho `gsd-output-formatter`; sem tocar regra inviolável.

---

**Aguardo sua aprovação desta spec antes de codar.** Ao aprovar: implemento, meço contra os 86, e trago precision de rejeição + recall de campanha lado a lado.
