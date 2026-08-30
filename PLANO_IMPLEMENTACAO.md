# Plano de implementação — 10 próximas evoluções

O plano abaixo parte da Fase 26 e prioriza primeiro fundações que reduzem retrabalho. As estimativas consideram uma pessoa desenvolvedora trabalhando no protótipo atual.

## 1. Simulação autoritativa e antitrapaça

**Prioridade:** crítica · **Estimativa:** 2–3 semanas

Mover pontuação, recompensas, compras e validação de partidas para regras executadas no servidor. O cliente enviaria eventos compactos com sequência, tempo e assinatura de sessão; o backend recalcularia o resultado e rejeitaria replay, teleporte, velocidade impossível e duplicação de recompensa.

**Aceite:** nenhum cliente consegue alterar XP, dinheiro, veículos ou ranking enviando apenas um payload fabricado.

## 2. Contas persistentes com refresh token

**Prioridade:** alta · **Estimativa:** 1–2 semanas

Adicionar cadastro opcional, senha com Argon2id, access token curto, refresh token rotativo em cookie `HttpOnly`, revogação de sessões e migração segura do perfil anônimo atual.

**Aceite:** login permanece válido entre dispositivos, logout revoga a sessão e tokens reutilizados são detectados.

## 3. Áudio espacial e trilha adaptativa

**Prioridade:** alta · **Estimativa:** 1 semana

Criar motor de áudio com Web Audio API: rotação do motor por RPM, derrapagem, colisões por material, sirenes posicionais, rádio policial e música que adiciona camadas conforme o nível de procurado.

**Aceite:** volume, filtro e direção respondem à distância; há controle independente de música, efeitos e acessibilidade.

## 4. Tráfego com faixas, mudança de pista e pedestres

**Prioridade:** alta · **Estimativa:** 2–3 semanas

Transformar a malha viária em grafo de faixas com sentido, preferência, conversões, pontos de parada e travessias. Adicionar mudança de faixa para ultrapassagem e pedestres com máquinas de estado ligadas aos semáforos.

**Aceite:** NPCs não se cruzam em sentidos incompatíveis, formam filas, ultrapassam com segurança e cedem em faixas de pedestre.

## 5. Diretor policial adaptativo

**Prioridade:** alta · **Estimativa:** 1–2 semanas

Criar um diretor que analisa estilo do jogador, rotas repetidas, colisões, distritos e eficácia das unidades. Ele escolheria composição da perseguição, áreas de busca, bloqueios, helicóptero e táticas sem simplesmente aumentar velocidade.

**Aceite:** duas fugas com estilos diferentes produzem respostas policiais diferentes e ainda oferecem uma rota justa de escape.

## 6. Streaming de mapa e novos distritos

**Prioridade:** média · **Estimativa:** 2 semanas

Dividir a cidade em células carregadas por proximidade, com LOD de edifícios e colisão. Usar essa base para adicionar rodovia, porto, aeroporto, bairro histórico, zona rural e interiores leves de garagem.

**Aceite:** mapa pelo menos quatro vezes maior mantendo a meta de FPS e uso de memória definidos para desktop e mobile.

## 7. Clima, horário e aderência dinâmica

**Prioridade:** média · **Estimativa:** 1–2 semanas

Implementar ciclo de horário, chuva, neblina e pista molhada. Iluminação, reflexos, distância de visão, trânsito, frenagem e aderência mudariam de forma coerente, com presets acessíveis para reduzir efeitos.

**Aceite:** cada condição altera visual e condução sem tornar texto, HUD ou minimapa ilegíveis.

## 8. Missões, economia e reputação

**Prioridade:** média · **Estimativa:** 2 semanas

Adicionar contratos com objetivos variados: entrega cronometrada, fuga sem colisão, veículo específico, combo de despiste e sequência por distritos. Recompensas e dificuldade seriam controladas pelo servidor.

**Aceite:** ao menos dez contratos reutilizam regras combináveis e têm progressão sem exploração de recompensa.

## 9. Customização visual e mecânica da garagem

**Prioridade:** média · **Estimativa:** 1–2 semanas

Oferecer pintura, rodas, placas, suspensão, relação de marchas e upgrades com vantagens e custos claros. Separar itens cosméticos de desempenho e salvar loadouts versionados no backend.

**Aceite:** alterações aparecem no jogo e na garagem, são persistentes e não permitem combinações de estatísticas fora dos limites.

## 10. Qualidade, telemetria e pipeline de entrega

**Prioridade:** contínua · **Estimativa inicial:** 1 semana

Adicionar testes unitários para IA e autenticação, testes Playwright da jornada completa, lint/format, orçamento de performance, auditoria de dependências e CI no GitHub. Coletar apenas telemetria agregada e consentida para balancear perseguições.

**Aceite:** cada pull request executa testes, verificação de segurança e orçamento de performance; falhas bloqueiam a integração.

## Ordem sugerida

1. Qualidade e CI como trilho de segurança.
2. Simulação autoritativa.
3. Contas e refresh tokens.
4. Diretor policial adaptativo.
5. Tráfego por faixas e pedestres.
6. Áudio espacial.
7. Streaming e distritos.
8. Clima e horário.
9. Missões e economia.
10. Customização da garagem.
