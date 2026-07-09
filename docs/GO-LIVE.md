# Go-live operacional — The Loyalty

Guia de ativação da produção assistida: CI, publicação no Beehiiv, secrets,
ledger e o passo a passo de virada. Documenta o que é **mock**, o que é **real**,
o que é **automático** e o que é **manual**.

Regra de ouro: **nenhum e-mail é enviado sem ação humana explícita.** O pipeline
para em rascunho por padrão. Publicar/agendar exige confirmação.

---

## 1. Fluxo real de execução

| Etapa | Comando | Automático (CI) | Envia e-mail? | Depende de secret? |
|---|---|---|---|---|
| lint | `npm run lint` | sim | não | não |
| typecheck | `npm run typecheck` | sim | não | não |
| validate | `npm run validate` | sim | não | não |
| render | `npm run render` | sim | não | não |
| qa | `npm run qa` | sim | não | não |
| build | `npm run build` | sim | não | não |
| publish (índices locais) | `npm run publish` | sim | **não** | não |
| beehiiv draft | `npm run beehiiv` | **manual** | não | mock sem secret |
| beehiiv publish/schedule | `npm run beehiiv -- --publish` | **manual + confirmação** | **sim (real)** | sim |

- `npm run publish` **não** envia e-mail: só escreve `content/latest.json` e
  `content/index.json`. É seguro rodar em CI.
- `npm run beehiiv` publica a peça **já renderizada** (`out/email/NNNN.html`) sem
  reescrever conteúdo. Por padrão cria só **rascunho** (`--draft`).

### Mock vs. real

O Publisher e o `/api/subscribe` decidem o modo pela presença dos secrets:

- **Sem** `BEEHIIV_API_KEY` **ou** `BEEHIIV_PUBLICATION_ID` → **modo mock**: valida,
  grava o payload em `out/beehiiv/NNNN.request.json`, registra no ledger com
  `mode: "mock"`, **não toca a API**. Seguro por construção.
- `--dry-run` força modo `dry-run` mesmo com secrets presentes (nunca chama a API).
- **Com** ambos os secrets e sem `--dry-run` → **modo live**: chama
  `POST /v2/publications/{pub_id}/posts` e grava `mode: "live"`.

---

## 2. GitHub Actions

Workflows em `.github/workflows/`:

- **`ci.yml`** — roda em push e pull request. Jobs: `lint`, `typecheck`,
  `editorial-gate` (validate → render → qa → publish em passos sequenciais, porque
  compartilham o diretório `out/`) e `build`. Nenhum job toca o Beehiiv.
- **`beehiiv.yml`** — `workflow_dispatch` (manual). Input `action` = `draft`
  (padrão) / `publish` / `schedule`. Envio real exige `confirm=PUBLICAR`. Lê os
  secrets `BEEHIIV_API_KEY` e `BEEHIIV_PUBLICATION_ID`; sem eles roda mock.

### O que falta na plataforma para os workflows executarem

Os arquivos de workflow estão prontos. O que depende de configuração no GitHub
(fora do código, não contornável por script):

1. **Habilitar GitHub Actions no repositório** — Settings → Actions → General →
   "Allow all actions and reusable workflows". Enquanto Actions estiver desabilitado,
   nenhum workflow roda. Isto é um **bloqueio externo de plataforma**, não uma falha
   de código.
2. **Adicionar os secrets** `BEEHIIV_API_KEY` e `BEEHIIV_PUBLICATION_ID`
   (ver seção 3). Sem eles o `ci.yml` roda normalmente; o `beehiiv.yml` roda em mock.
3. **(Recomendado) Criar o GitHub Environment `beehiiv`** — Settings → Environments →
   New environment → `beehiiv`, com *Required reviewers*. O `beehiiv.yml` referencia
   `environment: beehiiv`; com reviewers, todo disparo (inclusive draft) pede
   aprovação humana antes de rodar.
4. **(Opcional) Branch protection** exigindo o check `CI` para merge na branch padrão.

---

## 3. Secrets e ambiente

Apenas **dois** secrets são necessários. Não há outros.

| Secret | Onde configurar | Usado por |
|---|---|---|
| `BEEHIIV_API_KEY` | GitHub → Settings → Secrets and variables → Actions; e no host de deploy (ex. Vercel → Project → Environment Variables) | `scripts/beehiiv-publish.mjs`, `app/api/subscribe/route.ts` |
| `BEEHIIV_PUBLICATION_ID` | idem | idem |

- **Escopo da chave:** o Create Post exige `posts:write` (beta/Enterprise do Beehiiv).
- **Normalização do publication id:** o script aceita o id com ou sem o prefixo
  `pub_` — se vier sem, ele adiciona (`pub_${id}`). Basta colar o id como o Beehiiv
  entrega.
- **Nunca** versionar `.env` real nem expor as chaves no client. `.env.example`
  já documenta as duas variáveis (arquivo modelo, sem valores).
- Para o deploy da landing (subscribe): as mesmas variáveis no host. Sem elas o
  formulário opera em modo mock (sucesso simulado) — útil para preview.

---

## 4. Checklist de go-live (virada manual)

Ordem exata. **Manual** salvo onde indicado como automático.

- [ ] **a. Habilitar GitHub Actions** no repositório (Settings → Actions → General).
      *Manual, uma vez.*
- [ ] **b. Adicionar os secrets** `BEEHIIV_API_KEY` e `BEEHIIV_PUBLICATION_ID` em
      Actions secrets (e no host de deploy). *Manual, uma vez.*
- [ ] **b.1 (recomendado)** Criar o Environment `beehiiv` com required reviewers.
- [ ] **c. Confirmar o CI verde** — abrir um PR ou push e ver `ci.yml` passar
      (lint, typecheck, editorial-gate, build). *Automático ao push.*
- [ ] **d. Gerar o rascunho no Beehiiv** — Actions → "Beehiiv Publish (manual)" →
      Run workflow → `action = draft`. *Manual.* Isto cria/atualiza um **rascunho**
      no Beehiiv (modo live) ou grava o payload (modo mock). Não envia e-mail.
- [ ] **e. Validar o preview** — abrir o rascunho no Beehiiv (ou o
      `out/beehiiv/NNNN.preview.html` do artefato) e conferir assunto, preheader,
      Deal Desk, TL Score, disclaimer. Opcional: `--test voce@exemplo.com` para
      registrar um envio de teste ao próprio e-mail.
- [ ] **f. Publicar somente após aprovação** — Actions → "Beehiiv Publish (manual)"
      → `action = publish` (ou `schedule` + `schedule_at`) **e** `confirm = PUBLICAR`.
      *Manual + confirmação.* A trava de idempotência impede disparo duplicado do
      mesmo conteúdo (use `--force`/re-run consciente só se realmente necessário).

### Automático vs. manual — resumo

- **Automático:** todo o gate de qualidade (`ci.yml`) a cada push/PR.
- **Manual:** habilitar Actions, cadastrar secrets, gerar rascunho, validar preview
  e publicar. Publicar/agendar sempre exige confirmação humana.

---

## 5. Ledger e segurança operacional

Ledger em `content/beehiiv-status.json`. Chave por `slug` (`daily-NNNN`). Cada post
registra: `number`, `date`, `productType`, `slug`, `contentHash`, `action`, `mode`,
`postId`, `previewUrl`, `postUrl`, `scheduledAt`, `status`, `updatedAt` (timestamp)
e um `history[]` append-only de cada tentativa.

**Anti-duplicação (verificado):**

- O `contentHash` (SHA-256) cobre HTML + texto + slug + subject + preheader + tags
  + `scheduledAt`. Mesmo conteúdo → mesmo hash.
- Ações que disparam e-mail (`publish`, `schedule`): se o hash é idêntico ao
  registrado **e** o status já é `published`/`scheduled`, o script **bloqueia**
  (exit 1) com "conteúdo idêntico já publicado/agendado". `--force` é a única
  saída consciente.
- `draft` é idempotente: mesmo conteúdo já registrado → "nada a fazer".
- O workflow `beehiiv.yml` usa `concurrency` serializado para reforçar a trava.

Comportamento confirmado localmente: 1º publish → `published`; 2º publish idêntico →
**bloqueado**; `--force` → re-dispara. O ledger sobrevive entre execuções (versionado).

---

## 6. Como validar antes de publicar

```bash
npm ci
npm run lint
npm run typecheck
npm run validate
npm run render
npm run qa            # gate editorial — precisa passar
npm run build
npm run beehiiv -- --dry-run   # rascunho simulado, nada enviado
```

Só depois de tudo verde e do preview aprovado é que se roda o `--publish` (manual,
com confirmação).
