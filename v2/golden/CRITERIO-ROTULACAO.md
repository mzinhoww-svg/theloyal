# Critério de rotulação do golden set — CONGELADO

> A run dedicada abre lendo ESTE doc, não o histórico do chat. Consolida D-009/010/011 + as 4 decisões de calibração (2026-07-16). Rotular fora deste critério corrompe o portão de precision/recall e enviesa toda a régua de regressão do M2. Não drife.

## 1. Esquema do rótulo (por CAMPANHA, não por notícia)

Formato **N linhas por notícia**: uma notícia com 2 destinos gera 2 linhas de gabarito (mesma fonte). Isso testa também se a extração sabe **separar campanhas coladas** na mesma notícia.

```json
{
  "id": "<url da notícia>#<n>",         // sufixo quando a notícia gera N campanhas
  "fonte": "<news_sources.id>",
  "url": "<url canônica>",
  "publicado_em": "<date|null>",
  "input": { "titulo": "...", "trecho": "..." },
  "classe": "campanha | nao_campanha",  // nao_campanha = negativo (ver §4)
  "gabarito": {                          // só quando classe=campanha
    "tipo": "<um dos 9 §2>",
    "origem_programa": "<code | multiplos_cartoes | null>",
    "destino_programa": "<code | sem_destino | null>",
    "publico": "geral|selecionados|clube|cartao",
    "percentual": "<num|null>",          // null quando não há % de bônus (parceria/prorrogação)
    "vigencia_fim": "<YYYY-MM-DD|indeterminada>"
  },
  "proveniencia": {                      // OBRIGATÓRIA nos campos críticos (programa, %, vigência)
    "origem_programa": "<trecho/URL que justifica>",
    "percentual": "<trecho>",
    "vigencia_fim": "<trecho>"
  },
  "extracao_atual": { ... },             // o que o banco tem hoje (arbitra o erro)
  "erro_extracao": "<classe do erro | null>"
}
```

**Campos críticos do portão** (brief §13): `programa` (origem+destino), `percentual`, `vigencia`. Meta: **precision ≥95%, recall ≥90%** nesses campos. Proveniência obrigatória neles — sem ela o rótulo não arbitra, vira opinião.

## 2. Os 9 tipos canônicos (taxonomia D-001)
`transferencia_bonificada | promocao_emissao | compra_pontos | clube | status_match | bonus_acumulo | shopping | pontos_mais_dinheiro | outro`.
Mapeamento de brutos e colapso de duplicatas: `v2/db/seed-aliases.json` (MAPA_TIPO).

## 3. Origem genérica: `multiplos_cartoes` vs recuperável (decisão de calibração 1)
- **`multiplos_cartoes`** (sentinela canônica VÁLIDA, `publico=cartao`): a campanha é **de fato** multi-cartão — "qualquer cartão / todos os parceiros / diversos bancos" → destino real. A extração **não errou**. Regra no matcher: origem genérica + `transferencia_bonificada` + destino real.
- **`origem_generica_recuperavel`** (DEFEITO a corrigir): a notícia nomeia um **banco específico** que o parser perdeu (ex.: "Ultrablue **BTG**" → `btg`). São só **3** na base (reaudit `REAUDIT-22.md`). Entram como treino.
- Nunca confundir os dois: a sentinela é valor correto; o recuperável é erro.

## 4. Classe `nao_campanha` (decisão de calibração 3) — OBRIGATÓRIA no golden set
Notícias que a extração transforma em campanha mas **não são**. Reservar **15–20 das 100**, cobrindo os 4 padrões:
- **cupom de varejo** (ex.: "Cama/mesa/banho 60% OFF, cupom do 9.9").
- **exemplo de resgate** (ex.: "Resgates de Primeira… economia 90%" — a economia NÃO é bônus).
- **stunt de RP** (ex.: "100 mil milhas pro 1º bebê").
- **produto do próprio blog** (ex.: "curso Dominando o Seats.aero").
O portão mede **duas** métricas: recall (achou as campanhas reais?) e **precision** (rejeitou o que não é campanha?). **A precision de `nao_campanha` é o número que vai para a metodologia pública** — reportar destacada do agregado (o risco de produto é publicar não-campanha como campanha).

## 5. Parceria/prorrogação sem bônus (decisão de calibração 2)
Anúncio de parceria/prorrogação de rota **sem % de bônus** → `tipo=outro` com `percentual=null` (não `transferencia_bonificada`, para não sujar o Deal Desk com "transferência de valor nulo"). Prorrogação de campanha já existente, se linkável, é **evento de vigência** em `campanha_versoes`, não campanha nova.

## 6. Composição das 100
- Cobertura dos **9 tipos** (mínimo por tipo, priorizando os escassos na base).
- Casos de **lado único**.
- Os **3** `origem_generica_recuperavel`.
- **15–20 negativos** (`nao_campanha`), cobrindo os 4 padrões.
- Vagas restantes → tipos escassos.
- **Tudo com proveniência.**

## 6b. Kickoff da run dedicada (sem reabrir nada)
1. Ler ESTE doc + `REAUDIT-22.md` + `BATCH-01-CALIBRACAO.md`.
2. Amostra pré-selecionada, **não rotulada:** `v2/golden/AMOSTRA-100.json` (102 linhas / 86 únicas; estratos: status_match, bonus_acumulo, clube, outro, transferencia, compra_pontos, lado_unico, os 3 recuperável, 20 negativo_candidato). Deduplicar e rotular no critério congelado.
3. **Gap de tipos a caçar:** `promocao_emissao`, `shopping`, `pontos_mais_dinheiro` têm **0** exemplos na base (a extração nunca os produz). A run deve incluir alguns casos que *deveriam* ser esses tipos (achados no conteúdo / entre os misclassificados) para o golden set cobrir os 9 e o portão medir esses buracos. `status_match` só tem 3 — já incluídos.
4. Topar até 100 priorizando os tipos escassos acima.
5. Medir precision/recall (críticos: programa, %, vigência) **com negativos**; reportar a **precision de `nao_campanha` destacada** do agregado (§4). Re-versionar as 20 migrations. Fechar a slice 4 → portão de milestone M1.

## 7. Regra de honestidade da medição
Se não bater 95/90 de primeira, **não forçar**. Reportar o **mapa de erros por tipo** (a leva 1 sugere que os maiores buracos são separação de campanhas coladas e rejeição de não-campanha). Portão honesto em 88% com diagnóstico > 95% ajustado.
