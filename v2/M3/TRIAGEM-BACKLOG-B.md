# Triagem do backlog histórico — Trilha B (M3)

> Build mecânico (sem decisão pendente). Classifica todo o `campaigns` pela
> pré-superfície (D-060/D-061) em `limpo | revisao | historico_confirmado`,
> gravando trilha 1:1 em `campanha_versoes`. Autoridade dos checks:
> `v2/lib/verificacao/pre-superficie.mjs` (transcrita em SQL e **validada** —
> ver abaixo). Nada foi reclassificado nem descartado: a triagem só **rotula**.

## Regra de classificação (exata, para o operador conferir)

Cada item recebe os 7 flags da pré-superfície (mesma lógica de
`verificarPreSuperficie`): `vigencia_bug_ano`, `valor_sem_data`,
`tipo_suspeito_acumulo_em_parceiro`, `tipo_suspeito_sorteio`,
`tipo_suspeito_beneficio_tarifa`, `confianca_baixa_para_destaque`,
`percentual_acima_teto_sanidade`.

- **revisao** — tem qualquer flag "de conteúdo" (os 6 exceto vigência), **ou**
  tem `vigencia_bug_ano` num item que **ainda não** está em estado histórico
  (year-bug real escondendo promoção viva — o padrão BNB).
- **historico_confirmado** — item em estado `historica`/`encerrada`/`vencida`
  cujo único "flag" seria vigência antiga. É ingestão retroativa **legítima**,
  não sujeira (definição do operador): o FSM já o aposentou; a vigência velha
  não é erro de extração, é a idade real da campanha.
- **limpo** — sem flag acionável e não aposentado.

**Interpretação registrada:** o carve-out `historico_confirmado` (tirar da
`revisao` o que é só-vigência-antiga em estado já histórico) é leitura direta da
definição do operador ("vigência antiga legítima de ingestão retroativa, não é
sujeira"). O check `vigencia_bug_ano` sozinho não distingue year-bug de
ingestão retroativa; o **estado do FSM** desempata. Se o operador quis outra
régua, ajustar aqui (a trilha é rótulo, reversível).

## Validação SQL ≡ JS

A transcrição SQL dos 7 checks foi validada contra a autoridade JS na fatia
viva: entre os 58 vivos, o SQL flaga **exatamente** os mesmos 3 que o
`verificarPreSuperficie` (`costa_cruzeiros`, `flyingblue`, `smiles-375`).
Contagens de flag batem com a medição do D-060 (`percentual_acima_teto` 193,
`valor_sem_data` 554, tipo-suspeito 41, etc.).

## Distribuição (dado do banco, não estimativa)

Total real: **3641** (a estimativa do gate era "~3.632"; o banco tem 3641).

| categoria | itens |
|---|---|
| revisao | 1.031 |
| historico_confirmado | 1.629 |
| limpo | 981 |
| **total** | **3.641** |

## Must-haves (verificados no banco)

- **(a)** `SELECT categoria, count(*)` fecha exatamente em **3.641** (1.031 +
  1.629 + 981). Toda campaign tem trilha (`campaigns_sem_trilha = 0`).
- **(b)** **zero** item vivo saiu de vivo: `vivos_como_historico = 0`; vivos
  seguem 58; `estado` nunca foi mutado (só rótulo em `campanha_versoes`).
- **(c)** re-execução do INSERT (guard `not exists` por `campaign_id`+`evento`)
  insere **0 linhas** — idempotente.

## Rotas elegíveis para o placar do /promocoes

- **152 rotas** `origem→destino` (destino ≠ `sem_destino`) com histórico
  confirmado; **359** incluindo os limpos.
- Top lastro (janelas · faixa de bônus histórica): `livelo→livelo` 156 (6–300%),
  `smiles→smiles` 106 (0–300%), `esfera→esfera` 73 (5–250%),
  `azul→azul` 55 (14–300%), `itau→latam_pass` 50 (20–40%),
  `livelo→azul` 29 (50–120%), `esfera→smiles` 18 (70–100%).

Trilha: `campanha_versoes`, `evento='triagem_backlog_m3'`,
`payload_depois = {categoria, flags, regra}`, `origem='triagem backlog M3 (sessao claude)'`.
