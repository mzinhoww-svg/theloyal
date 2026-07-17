# M2 · Slice — Verificação do MCP Beehiiv (SPEC + achados, sem publicar nada)

> **Por que agora.** Não toca score nem produção de dado — é confirmação de capacidade de
> uma ferramenta externa. O M0 (`PROJECT.md` §3) já fez uma primeira passada, em alto
> nível, antes de qualquer trabalho real do Daily começar. Esta slice **reverifica** (o
> workspace pode ter mudado desde 2026-07-08) e **aprofunda** exatamente no ponto que o M0
> não detalhou: o contrato de autoria de conteúdo (o que `save_post` de fato aceita), que
> é a peça que a Slice 1 (template de e-mail) precisa para não desenhar às cegas.
>
> **Modo: mede-e-propõe.** Toda chamada abaixo foi **read-only** (`list_*`, `get_*`,
> `learn_*`). Nenhum post, segmento, campo customizado ou template foi criado, editado ou
> publicado nesta verificação.

---

## 0. Método

Chamadas diretas ao MCP Beehiiv contra a publicação real `The Loyal`
(`pub_ff1dca66-ed29-42e7-b248-0d2e67f2a752`), nesta ordem: `list_publications` →
`get_current_user` → `get_workspace` → `get_publication` → `list_segments` →
`list_custom_fields` → `get_segment_schema` → `learn_post_authoring` → `learn_post_metadata`
→ `list_post_templates`. Todas responderam; nenhuma exigiu autenticação adicional.

## 1. Achados — atualização da tabela do M0 (`PROJECT.md` §3)

| Capacidade exigida pelo brief | Verificado agora | Detalhe novo vs. M0 |
|---|---|---|
| Publicação conectada | ✅ | `pub_ff1dca66-…`, workspace "mazinho's Hiiv", **plano `launch`**, teto 2.500 assinantes, owner `mzinhoww@gmail.com`. |
| Criar post | ✅ disponível, **com uma restrição estrutural nova** | Ver §2 — `html_content` não é HTML livre. |
| Contrato de conteúdo | ✅ `learn_post_authoring` | TOC completo mapeado agora: ~50 nós, ~10 marks, tabela de plan-gating por nó. |
| Segmentar por perfil | ✅ ferramentas disponíveis, **mas hoje não há como popular "perfil"** | Ver §3 — falta o dado, não a ferramenta. |
| Enviar/agendar | ✅ | `save_post` com `recipients{web,email}` + `scheduledAt`/`override_scheduled_at`. **Promoção/envio real continua ação humana na UI do Beehiiv** — o MCP só cria/edita draft, nunca dispara sozinho (confirma REQ-33/INV-10 de graça, sem precisar construir trava própria). |
| Estatísticas | ✅ (não reverificado nesta passada — `get_post_stats`/`get_post_stats_batch` seguem presentes na lista de tools; não é bloqueio) | — |

## 2. Achado crítico — `html_content` é parseado, não é HTML livre

`save_post`/`edit_post_content` recebem `html_content`, mas o texto é **parseado para os
blocos nativos do editor (schema Tiptap)** — não é injetado como está. Implicações
concretas, extraídas de `learn_post_authoring`:

- **`style="..."` inline é descartado no parse**, com **uma exceção**: a mark `textStyle`
  (`<span style="color:...; font-size:...">`) é preservada — é o único lugar onde CSS
  inline sobrevive.
- Layout de card (borda, fundo, padding, margem, visibilidade por canal/audiência) usa o
  nó **`section`**, estilizado por atributos `data-*` (`data-background-color`,
  `data-border-color`, `data-padding-top` etc.), não por `style=`.
- Colunas lado a lado usam o nó `columns` (`data-width`, `data-stack-on-mobile`).
- Tabelas (`table`/`tableCell`/`tableHeader`) usam **tokens de tema** para borda/grid
  (`table_border_width` etc., via `save_post_theme`) — **não** estilo por célula.
- Nós fora do contrato (a maioria dos widgets de anúncio/embed avançados) são **rejeitados
  no save** ou exigem inserção manual pelo editor Beehiiv — não são autoráveis via MCP.
- Merge tags confirmadas (úteis para o rodapé da marca): `{{unsubscribe_url}}`,
  `{{subscriber_preferences_url}}`, `{{live_url}}`, `{{first_name|there}}` (com fallback).

**Consequência prática:** o renderer HTML cru que já existe (`renderer/email.mjs`, feito
para Gmail-safety via tabelas + `style=` em toda tag) **não é injetável como está** no
`html_content` do MCP. Ele continua correto como artefato de **preview/versão web/QA**
(Slice 1), mas o **envio real via Beehiiv exige um segundo renderer** no dialeto acima —
ou aceitar que **o próprio Beehiiv gera o HTML final do e-mail** a partir dos blocos
autorados (o que, aliás, resolve Gmail-safety por conta deles, é o motor deles). Este é
o achado que conecta as duas slices — ver §5, Q1.

## 3. Achado — segmentação de perfil: ferramenta pronta, dado ausente

`list_segments`/`save_segment` funcionam; o DSL (`get_segment_schema`) é rico:

- **Atributos**: `channel`, `tier`, `status`, localização, UTMs, `signup_date`,
  `custom_field(id)`.
- **Medidas comportamentais**: `open_rate`, `click_through_rate`, `unique_opens`,
  `link_click(url)`, `post_email_event`, `poll_response`, `referral_count`,
  `automation_enrollment`.

**Hoje: 0 segmentos criados. Apenas 2 custom fields existem: `first_name`, `last_name`.**
Não há campo de "perfil" nem proxy comportamental óbvio configurado. Os 6 segmentos do
brief (`iniciante | emissao planejada | heavy user | alta renda | completar saldo |
cashback first`) descrevem **intenção/perfil declarado**, não comportamento observável nas
medidas disponíveis — não são construíveis hoje só com o que existe. **A lacuna não é a
ferramenta (o `save_segment`/DSL cobre o caso), é o dado**: falta (a) um `custom_field`
novo (ex.: `perfil`, `kind: string` ou `list`) e (b) um **mecanismo de captura** que
popule esse campo por assinante (quiz de onboarding, formulário, pergunta na confirmação
de inscrição) — **isso não existe em nenhum lugar do produto hoje**, nem no v1. D-008
("Segmentos Beehiiv viram slice do M2") aprovou a existência dos segmentos, mas não
resolveu de onde vem o dado de perfil — é uma sub-decisão nova, não coberta ainda.

## 4. Achados menores

- **1 template de post já existe** (`post_template_ad79ffdb-…`, nome "New template"),
  **vazio** — sem conteúdo, sem `content_tags`. Nenhum template "Daily" construído.
- **Plan gating** (plano `launch`): `htmlSnippet` ✅ disponível (bloco de HTML cru — mas
  ainda como **um bloco** dentro do documento Tiptap, não como wrapper do post inteiro;
  não contorna o parse do resto), `poll` ✅ disponível, `referralProgram` ✅ disponível mas
  **requer programa de referral ativo** (não configurado hoje), `ad_network_automated_ads`
  ❌ indisponível (esperado, sem ad network contratada).
- Tema padrão da publicação: parágrafo em Inter 16px `#374151`, headings em "Instrument
  Sans", `link_color #0C4A6E` — **nenhum destes bate com os tokens da marca** (`CLAUDE.md`:
  Ink `#111111`, JetBrains Mono para número, Fraunces para título). Ajustável via
  `save_post_theme` por post, ou nos padrões da publicação — decisão de quando fazer isso
  (agora, ou junto com o template Daily de fato) fica para quando o template Tiptap for
  construído (fora desta slice — ver §6).

## 5. Proposta — 3 perguntas para o operador

1. **Aceitar que o Beehiiv gera o HTML final do e-mail a partir do dialeto Tiptap** (em
   vez de perseguir controle pixel-a-pixel via HTML cru no envio real), mantendo
   `renderer/email.mjs` só para preview/web-embed/QA? **Recomendo sim** — é o caminho de
   menor atrito, e o motor deles resolve Gmail-safety de graça no envio real. A Slice 1 já
   assume essa separação (dois alvos de render).
2. **De onde vem "perfil" do assinante?** Formulário/quiz de onboarding no site (fora do
   M2 — precisa de UI nova), ou aproximar por comportamento via as medidas disponíveis
   (cliques em categorias de conteúdo, tags de conteúdo por post) sem campo declarado?
   **Recomendo adiar** para fora deste M2 — D-008 aprovou os segmentos, não a captura de
   perfil; travar isso agora sem UI pronta é inventar dado. Registrar como blocker
   explícito de M2.7 (Beehiiv MCP + Daily) até essa decisão vir.
3. **Construir o post_template "Daily" agora** (estrutura fixa: header + rodapé + merge
   tags, reduzindo o que cada edição precisa autorar), **ou** montar tudo via
   `html_content` puro a cada edição? **Recomendo template** — reduz payload por edição e
   fixa a marca (fonte/cor) num lugar só via `save_post_theme`/`save_post_template_theme`.
   Fica para quando M2.7 realmente ligar o envio (não nesta slice, que é só verificação).

## 6. Atualização a aplicar no `PROJECT.md` §3

Substituir a tabela e o parágrafo de "Limitações a registrar" do §3 pelos achados acima
(§1–§4 deste documento). É a mesma obrigação que o M0 já tinha assumido ("registrar as
limitações") — só que agora com o nível de detalhe que faltava (o contrato Tiptap e a
lacuna de dado de perfil, que o M0 não tinha aprofundado).

## 7. Fora de escopo

- Publicar, editar ou agendar qualquer post real.
- Criar segmentos, custom fields ou templates.
- Construir o renderer no dialeto Tiptap (decisão pendente da pergunta 1 — se aprovada,
  vira tarefa de M2.7, não desta slice).
- Resolver a captura de perfil (pergunta 2 — decisão de produto fora do M2 atual).

## 8. Definição de pronto

1. `PROJECT.md` §3 atualizado com os achados (edição real do arquivo).
2. As 3 perguntas do §5 respondidas pelo operador.
3. Zero posts/segmentos/campos/templates criados ou alterados no Beehiiv.

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de
comprar, transferir ou resgatar.*
