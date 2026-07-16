-- M2 slice 1 (ruling 2) — regra-mãe D-018: vantagem de ter o cartão sem mecânica
-- de ponto/milha/cashback fica FORA do universo de campanha. Novo motivo, por INSERT
-- (domínio-como-tabela; sem mudança de schema). Aditiva, idempotente.

insert into motivos_rejeicao (motivo, descricao, camada_padrao) values
  ('anuidade_sem_pontos', 'isenção de anuidade / benefício de cartão sem ponto/milha/cashback (regra-mãe D-018)', 'deterministica')
on conflict (motivo) do nothing;
