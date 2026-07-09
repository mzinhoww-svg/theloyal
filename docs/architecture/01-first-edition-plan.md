# Plano — Primeira Edição Real (#0001) via Beehiiv MCP

> Refinado após descoberta de que o canal de publicação é o **MCP do Beehiiv**
> (não a API REST), que já existe uma publicação real ("The Loyal",
> `theloyal.beehiiv.com`) e um draft criado por MCP, e que a biblioteca de mídia
> está vazia (por isso "tem cor, mas não tem elementos nem assets").

## Diagnóstico do canal
- **Publicação real existe**; MCP autenticado como owner.
- **Draft existente** = esqueleto semântico achatado da 0028: headings, parágrafos, tabela default, bold, links. **Perdeu** TLBadge colorido, ContaBlock (card Ink), cards `section`, tema da marca. **Sem assets** (biblioteca = 0 imagens).
- **Causa-raiz:** mapeou só *texto → nós básicos*; não usou `section`/`columns`/`textStyle`/tema; não subiu assets. O `beehiiv-publish.mjs` (REST, HTML inline) é a ferramenta errada — o Beehiiv descarta `style=""` e monta o visual por nós + tokens de tema.

## Definition of Done (#0001)
- Conteúdo **real** (`illustrative:false`, sem fontes "(exemplo)"), aprovado pelo Editor-Chefe.
- Render no Beehiiv via MCP: header wordmark, ContaBlock como card Ink, TLBadge com cor semântica, divisores, tema da marca, footer com merge tags.
- `validate` + `source-audit` verdes; teste conferido em Gmail; `post_id` no ledger; disclaimer íntegro.

## Workstreams
| WS | Nome | Entrega |
|---|---|---|
| A | Contrato de marca no Beehiiv | 1 deal 0028 montado à mão = template canônico provado |
| B | Adapter `JSON → nós Beehiiv` | mapeador edição → HTML canônico de nós |
| C | Pipeline de assets | SVG da marca → PNG → upload → imageBlock |
| D | Operação editorial | sourcing/curadoria/aprovação + JSON da #0001 real |
| E | Ledger via MCP | `post_id` como chave de idempotência |
| F | Consolidação do repo (pré-requisito) | 1 sistema, 1 schema, `main` verde, `beehiiv` religado |

## Mapa marca → nó Beehiiv (resumo)
| Elemento | Nó | Regra |
|---|---|---|
| Wordmark/header | imageBlock (PNG) | sem stock/avião |
| Deal Desk (card) | section (borda, radius, padding) | Ponto nunca aqui |
| ContaBlock (Ink) | section fundo escuro + columns (label/valor) | CPM verde sobre Ink |
| TLBadge | section-pill + textStyle | verde de texto = green-600 |
| Fecha logo tag | section-pill amarelo + texto Ink | amarelo só como fill |
| Data-art | imageBlock (PNG) | "a imagem é dado" |
| Tema | tokens de marca (fontes, link verde, gridlines 0) | 1x por post |

## Fases
F consolidar repo → A provar template à mão → B adapter (paralelo C assets) → D conteúdo real → G publicar.

## Runbook de lançamento
1. `validate` + `source-audit` → 2. adapter gera nós → save draft → 3. tema → 4. assets → 5. render + teste → 6. ajustes idempotentes → 7. agendar/publicar (gatilho humano) → 8. gravar `post_id`.

## Riscos-chave
Fontes da marca indisponíveis no Beehiiv (usar imageBlock p/ wordmark) · Beehiiv achata estilo inline (usar section+tema) · publicar `illustrative:true` (gate recusa) · ledger dessincronizado (chave = `post_id`).

## Gargalos
Técnico nº 1: o **Adapter** (ponte marca→Beehiiv, inexistente). Editorial nº 1: conteúdo real + sourcing. Primeira tarefa: **Fase A** (provar 1 card Ink + TLBadge + tema + 1 asset à mão).
