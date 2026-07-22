-- =====================================================================
-- Migration 019 — daily_sends: trava DURÁVEL de envio diário (resend lock
-- à prova de runner efêmero). C2 · M2.7 · BETA.
--
-- POR QUÊ. A idempotência de envio vivia em `content/daily-status.json` — um
-- arquivo NÃO versionado, no working dir de um runner do GitHub Actions que é
-- DESCARTADO a cada rodada. Logo a trava era inerte: um "Re-run job" (runner
-- novo, ledger vazio) via `prev=undefined` e DISPARAVA UM SEGUNDO ENVIO REAL do
-- mesmo dia. A verdade do "já enviei hoje?" tem de morar onde sobrevive ao
-- runner: no banco (ou no próprio Beehiiv). Esta tabela é essa verdade durável.
--
-- MODELO. Uma linha por DATA de edição (PK). `enviado` é MONOTÔNICO — uma vez
-- true, nunca volta a false (reenvio é o pecado capital, não o não-envio).
-- `post_id` guarda o post do dia (draft OU enviado) para o reuso PATCH-vs-POST
-- funcionar entre runners diferentes (o arquivo local não guardava isso de forma
-- durável). Aditiva: cria tabela + função; não toca nada existente.
--
-- A função `reservar_envio_diario` faz o CLAIM ATÔMICO: transição enviado
-- false→true numa só instrução condicional. Quem faz a transição GANHA o envio;
-- qualquer chamada concorrente ou posterior recebe reservado=false / ja_enviado=
-- true e NÃO envia. É a garantia contra corrida real (dois runners no mesmo
-- minuto) além da checagem durável sequencial do runner.
-- =====================================================================

create table if not exists public.daily_sends (
  edition_date   date primary key,
  edition_number int,
  post_id        text,
  content_hash   text,
  enviado        boolean not null default false,
  sent_at        timestamptz,
  updated_at     timestamptz not null default now()
);

comment on table public.daily_sends is
  'Trava durável de envio do Daily, por data de edição. Substitui content/daily-status.json (efêmero no runner). enviado é monotônico; post_id permite reuso de post entre runners (C2/019).';

-- Claim atômico do envio do dia. Retorna reservado=true SÓ para quem faz a
-- transição enviado false→true; concorrentes/posteriores recebem ja_enviado=true.
create or replace function public.reservar_envio_diario(
  p_edition_date   date,
  p_edition_number int default null
)
returns table (reservado boolean, ja_enviado boolean, post_id text)
language plpgsql
as $$
declare
  v_post_id text;
begin
  -- Garante a linha do dia sem sobrescrever uma reserva/estado já existente.
  insert into public.daily_sends (edition_date, edition_number, enviado)
  values (p_edition_date, p_edition_number, false)
  on conflict (edition_date) do nothing;

  -- Transição condicional: só marca quem ainda não estava enviado.
  update public.daily_sends
     set enviado = true, sent_at = now(), updated_at = now()
   where edition_date = p_edition_date
     and not enviado
  returning public.daily_sends.post_id into v_post_id;

  if found then
    return query select true, false, v_post_id;   -- reservou o envio deste runner
  else
    select ds.post_id into v_post_id from public.daily_sends ds where ds.edition_date = p_edition_date;
    return query select false, true, v_post_id;    -- já estava enviado: ninguém reenvia
  end if;
end;
$$;

comment on function public.reservar_envio_diario(date, int) is
  'Claim atômico do envio diário (transição enviado false→true). reservado=true só para o primeiro; demais recebem ja_enviado=true e não devem enviar (C2/019).';
