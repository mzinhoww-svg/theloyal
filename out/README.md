# out/ — digests renderizados

Saídas prontas das edições do The Loyal (Lab e Special). Cada peça tem quatro
formatos. Os arquivos são versionados com `git add -f` (o `.gitignore` ignora `/out/`
por causa do export do Next; estes são conteúdo curado, não build).

```
out/
  lab/       edições evergreen (Loyal Lab)
    cpm.html         web (fontes via Google Fonts)
    cpm.email.html   e-mail-safe (600px, table-based, inline)
    cpm.txt          plain text
    cpm.qa.md        checklist de QA
  special/   edições especiais de foco único
    cpm-final.html · cpm-final.email.html · cpm-final.txt · cpm-final.qa.md
```

Cada peça segue o checklist de saída da marca (tokens, mono nos números, serif só em
título, Paper de fundo, verde-texto green-600, disclaimer, texto próprio). Números em
blocos de conta são ilustrativos da fórmula — nunca ofertas reais.
