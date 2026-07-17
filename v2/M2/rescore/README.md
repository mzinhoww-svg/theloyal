# Re-score runner (M2 · DRY-RUN, D-038)

Roda o TL Score sobre a base inteira **em memória** e reporta. **Não grava nada.**

## Regra-mãe (D-038)
O runner **importa** as funções puras testadas — nunca copia/forka:
- `montarEntradas`  ← `../../lib/derivacao.mjs` (derivação, `DERIVACAO_V1`)
- `calcularScore`   ← `../../lib/score.mjs` (engine, SLICE-4)

Os vetores são **lidos do banco**: `score_pesos.v1` e `derivacao_config.derivacao.v1`.
O runner só orquestra (lê → agrupa por rota → chama as funções → coleta).

## Arquivos
- `golden-replay.mjs` — gate de fidelidade DB-independente: alimenta os componentes
  congelados da PROPOSTA §2 no `calcularScore` importado e exige 79/37/77/59/44/27.
  `node v2/M2/rescore/golden-replay.mjs` (exit≠0 se algum golden divergir).
- `rescore-dryrun.mjs` — o runner. Roda a gate, lê o banco via PostgREST, pontua,
  classifica os 4 baldes por programa, levanta anomalias por linha e por programa,
  escreve `out/rescore-dryrun.json` e imprime o resumo. **Nunca faz `INSERT`/`UPDATE`.**

## Rodar
```bash
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_ANON_KEY=<anon key>          # leitura pública de campaigns/derivacao_config
# score_pesos tem RLS restrito à anon; passe a linha do banco (lida via MCP/service):
export SCORE_PESOS_V1_JSON='{"versao":"v1","peso_percentil":0.45,"peso_eficiencia":0.30,"peso_raridade":0.15,"peso_abrangencia":0.10,"shrink_k":5,"min_samples":3}'
node v2/M2/rescore/rescore-dryrun.mjs
```
Sem chave → o runner para com erro explícito (não inventa dado). Nenhuma credencial
é versionada.

## Notas de fidelidade
- `tem_tier1` vem hoje de `campaigns.tier===1` (default de `montarEntradas`), porque
  `campanha_fontes` está vazia. Quando encher, `tem_tier1` deve vir de lá (INV-02).
- A derivação usa `derivacao_config.derivacao.v1` do banco (raridade n=1 → 0,85, D-037).
- Golden vivo pode divergir da PROPOSTA por **drift de dado** (rotas crescem); a
  fidelidade do engine é aferida pela `golden-replay`, não pelo golden vivo.
