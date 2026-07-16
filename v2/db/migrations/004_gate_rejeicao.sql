-- M2 slice 1 — Gate de rejeição. Aditiva, idempotente.
-- motivos_rejeicao: domínio-como-tabela (6º padrão entra por INSERT, não por deploy).
-- rejeicoes: trilha de cada rejeição (motivo + evidência + camada + confidence).

create table if not exists motivos_rejeicao (
  motivo        text primary key,
  descricao     text not null,
  camada_padrao text not null check (camada_padrao in ('deterministica','llm')),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);

insert into motivos_rejeicao (motivo, descricao, camada_padrao) values
  ('cupom_varejo',           'desconto/cupom de loja, combustível ou serviço, sem mecânica de ponto/milha', 'deterministica'),
  ('tarifa_pacote_dinheiro', 'passagem/diária/pacote em R$ (tarifa, não bônus nem acúmulo)',                'deterministica'),
  ('produto_blog',           'curso/produto da própria fonte editorial',                                    'deterministica'),
  ('perk_sem_pontos',        'benefício de cartão/assinatura sem ponto/milha/cashback (D-012)',              'deterministica'),
  ('stunt_rp',               'ação de marketing/PR/patrocínio/ops de companhia, sem oferta ao membro',       'llm'),
  ('exemplo_resgate',        'exemplo/disponibilidade de resgate; economia % que não é bônus',               'llm')
on conflict (motivo) do nothing;

create table if not exists rejeicoes (
  id           bigint generated always as identity primary key,
  news_item_id text not null,
  campaign_id  text references campaigns(id),
  motivo       text not null references motivos_rejeicao(motivo),
  camada       text not null check (camada in ('deterministica','llm')),
  evidencia    text not null,                                   -- trecho/domínio; sem isto não rejeita
  confidence   numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status       text not null default 'rejeitada' check (status in ('rejeitada','revisao')),
  decidido_em  timestamptz not null default now()
);

create index if not exists idx_rejeicoes_news   on rejeicoes(news_item_id);
create index if not exists idx_rejeicoes_status on rejeicoes(status);
create unique index if not exists uq_rejeicoes_news_motivo on rejeicoes(news_item_id, motivo);

comment on table motivos_rejeicao is 'Classes de rejeição do gate; extensível por INSERT (domínio como tabela).';
comment on table rejeicoes is 'Trilha de rejeição do gate. status=revisao = abstenção (D-016), não conta como rejeição.';
