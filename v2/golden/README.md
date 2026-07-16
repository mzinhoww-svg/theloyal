# Golden set — esquema de rótulo e amostragem (M1 slice 4)

> Corpus de referência que arbitra precision/recall da extração no CI. Sem proveniência não serve de árbitro — vira opinião (diretriz do operador).

## Esquema do gabarito (por item)

```json
{
  "id": "<url da notícia>",
  "fonte": "<news_sources.id>",
  "url": "<url canônica>",
  "publicado_em": "<date|null>",
  "input": { "titulo": "...", "trecho": "..." },
  "e_campanha": true,                          // false = notícia NÃO deve gerar campanha (negativo)
  "gabarito": {
    "tipo": "<um dos 9 | null>",
    "origem_programa": "<code | multiplos_cartoes | null>",
    "destino_programa": "<code | sem_destino | null>",
    "publico": "geral|selecionados|clube|cartao",
    "percentual": "<num|null>",
    "vigencia_fim": "<YYYY-MM-DD|indeterminada>"
  },
  "proveniencia": {                             // evidência POR CAMPO CRÍTICO (programa, %, vigência)
    "origem_programa": "<trecho que justifica>",
    "percentual": "<trecho>",
    "vigencia_fim": "<trecho>"
  },
  "extracao_atual": { ... },                    // o que o banco tem hoje (mostra o erro)
  "erro_extracao": "<classe do erro | null>"
}
```

**Campos críticos do portão** (brief §13): `programa` (origem+destino), `percentual`, `vigencia`. Meta: precision ≥95%, recall ≥90% nesses campos. Proveniência obrigatória neles.

## Amostragem estratificada (100 itens)

1. **Obrigatório:** os 22 `origem_generica_recuperavel` (insumo que treina a recuperação do banco).
2. **Cobertura dos 9 tipos** + casos de **lado único** + **negativos** (notícias que não são campanha — a extração gera falso-positivo).
3. **Preencher vagas priorizando tipos sub-representados** no banco (não os já abundantes).

Nunca as 100 primeiras; nunca aleatório puro.

## Classes de erro de extração (descobertas na leva 1)
- `origem_perdida_recuperavel` — notícia nomeia o banco, extração pôs genérico (ex.: "Ultrablue BTG" → `banco`).
- `origem_multi_banco` — promo genuinamente multi-cartão ("qualquer cartão → Azul"); genérico é CORRETO, não recuperável a 1 banco.
- `parceria_sem_bonus` — anúncio de parceria/prorrogação de rota sem % de bônus; rotulado como transferência mas sem valor.
- `falso_positivo` — cupom de varejo, produto do blog ou stunt de PR classificado como campanha; **não é campanha**.
- `resgate_como_compra` — exemplo de resgate ("Resgates de Primeira") vira `compra` e a "economia %" vira `percentual`.
