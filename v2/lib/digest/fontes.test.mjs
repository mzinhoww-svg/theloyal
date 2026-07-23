// Atribuição de fonte: o rótulo tem que casar o HOST da URL, e "oficial" só para
// domínio de PROGRAMA. node --test v2/lib/digest/fontes.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { hostDe, rotuloFonte, ehFonteOficial, rotuloBateHost } from './fontes.mjs';

test('rotuloFonte deriva o nome canônico do host (não do source_name armazenado)', () => {
  assert.equal(rotuloFonte('https://passageirodeprimeira.com/pp-15-anos'), 'Passageiro de Primeira');
  assert.equal(rotuloFonte('https://www.melhoresdestinos.com.br/milhas/x'), 'Melhores Destinos');
  assert.equal(rotuloFonte('https://www.idinheiro.com.br/cartao/x'), 'iDinheiro');
  assert.equal(rotuloFonte('https://smiles.com.br/promo'), 'Smiles');
});

test('rotuloFonte: domínio desconhecido cai no próprio host (nunca inventa outlet)', () => {
  assert.equal(rotuloFonte('https://blog-desconhecido.example/x'), 'blog-desconhecido.example');
  assert.equal(rotuloFonte('não-é-url'), 'fonte');
});

test('ehFonteOficial: só programa/emissor é oficial; outlet/agregador NÃO', () => {
  assert.equal(ehFonteOficial('https://smiles.com.br/promo'), true);
  assert.equal(ehFonteOficial('https://latampass.latam.com/x'), true);
  assert.equal(ehFonteOficial('https://www.bb.com.br/cartao'), true);
  // agregadores / mídia
  assert.equal(ehFonteOficial('https://www.idinheiro.com.br/x'), false);
  assert.equal(ehFonteOficial('https://passageirodeprimeira.com/x'), false);
  assert.equal(ehFonteOficial('https://www.melhoresdestinos.com.br/x'), false);
  // desconhecido nunca é oficial (não superestima)
  assert.equal(ehFonteOficial('https://qualquer-um.example/x'), false);
});

test('rotuloBateHost REPROVA rótulo que não casa o host (o bug real da nº29)', () => {
  // 'tavily' (ferramenta de busca) rotulando passageirodeprimeira → reprova
  assert.equal(rotuloBateHost('tavily', 'https://passageirodeprimeira.com/pp-15-anos'), false);
  // 'melhorescartoes' rotulando uma URL de melhoresdestinos → reprova (outlet errado)
  assert.equal(rotuloBateHost('melhorescartoes', 'https://www.melhoresdestinos.com.br/milhas/x'), false);
});

test('rotuloBateHost APROVA o rótulo canônico do host', () => {
  assert.equal(rotuloBateHost('Passageiro de Primeira', 'https://passageirodeprimeira.com/x'), true);
  assert.equal(rotuloBateHost('Melhores Destinos', 'https://www.melhoresdestinos.com.br/x'), true);
  assert.equal(rotuloBateHost('iDinheiro', 'https://www.idinheiro.com.br/x'), true);
});

test('hostDe normaliza www e caixa; URL inválida → null', () => {
  assert.equal(hostDe('https://WWW.Idinheiro.com.BR/x'), 'idinheiro.com.br');
  assert.equal(hostDe('lixo'), null);
});
