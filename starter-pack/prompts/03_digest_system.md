# 03_digest_system.md

Objetivo: construir o sistema de renderização dos produtos editoriais do The Loyalty.

Você deve transformar um JSON editorial validado em:
1. HTML de e-mail-safe;
2. plain text fallback;
3. HTML web archive;
4. checklist de QA;
5. arquivos gerados.

Produtos suportados:
- The Loyalty Daily;
- The Loyalty Weekly;
- The Loyalty Lab;
- The Loyalty Pro;
- The Loyalty Special.

Regras gerais:
- não usar dado interno;
- não usar CMI;
- não copiar texto de fonte externa;
- não usar emoji editorial;
- não usar urgência artificial;
- não usar aviões, stock photos ou cartões 3D;
- não usar gradiente;
- não usar sombras pesadas;
- não quebrar o brand system;
- não colocar Ponto dentro de blocos de análise, Deal Desk ou contas;
- toda recomendação deve carregar disclaimer;
- todo número de análise deve usar fonte mono;
- toda promoção sem vigência confirmada deve virar "Não confirmado".

Identidade:
- fundo da página: Paper;
- cards: Surface;
- texto principal: Ink;
- links editoriais: Insight;
- CTA: Primary;
- warning: fill apenas;
- danger: Evitar;
- neutral: Não confirmado.

Tipografia:
- títulos: Fraunces;
- corpo: Inter;
- dados e fórmulas: JetBrains Mono;
- no e-mail, usar fallback seguro.

Componentes canônicos:
1. TL Score Badge;
2. Deal Card;
3. Conta Block;
4. Section Divider;
5. Sinal do dia;
6. Watch Table;
7. Sources Block;
8. Disclaimer Block;
9. Footer Block;
10. Ponto apenas em hero, footer, empty states ou sucesso de inscrição, quando permitido.

Regras de renderização:
- Daily: leitura em 5 minutos, foco em síntese e decisão.
- Weekly: tese da semana, consolidação, padrões, ranking e aprendizado.
- Lab: explicação evergreen, mais didática, menos urgente.
- Pro: tom mais analítico, mais densidade, mais indicadores, mais benchmark.
- Special: foco único, estrutura curta e forte.

E-mail-safe:
- largura máxima de 600px;
- uma coluna;
- CSS inline quando possível;
- sem JavaScript;
- sem layout complexo;
- sem Google Fonts;
- sem :root;
- sem grid complexo;
- sem imagem obrigatória;
- sem efeitos que quebrem em Gmail.

Web archive:
- pode usar componentes React;
- pode usar fontes reais;
- pode usar composição mais rica;
- deve continuar seguindo os tokens oficiais;
- deve manter a mesma hierarquia editorial do e-mail.

Validação final:
- JSON íntegro;
- vigência clara;
- cálculo correto;
- texto próprio;
- Ponto não entrou em bloco proibido;
- e-mail abre sem CSS externo;
- plain text foi gerado;
- disclaimer aparece;
- nada viola o brand system.

Se faltar dado, não chutar.
Se a promoção não estiver confirmada, marcar como "Não confirmado".
Se o conteúdo estiver fraco, simplificar sem quebrar a arquitetura visual.
