# Polícia VS Ladrão — Operação Cidade Aberta

Jogo/protótipo 3D de perseguição em **HTML + JavaScript + Three.js**, com backend REST em **Node.js**.

A base cobre as **Fases 1–18, 20–22 e 24–26**. A Fase 26 adiciona cidade expandida, IA tática, trânsito consciente, minimapa integral, emplacamento e sessões JWT. A Fase **19 (Áudio)** continua planejada.

## Fase 26 — Operação Cidade Aberta

- Cidade de **880 × 880 unidades**, com **11 × 11 cruzamentos** e até **100 quarteirões**.
- Minimapa completo delimitado pelos limites reais da cidade; `M` alterna para radar local.
- Polícia compartilha a última posição e velocidade confirmadas em vez de receber a posição exata de forma onisciente.
- Unidades varrem até seis nós próximos quando perdem contato visual.
- Interceptadores, flanqueadores e bloqueadores usam a inteligência compartilhada e sua idade.
- NPCs têm perfis de cautela/velocidade, respeitam fases semafóricas e cedem passagem a emergências.
- Luzes de freio reagem à frenagem dos veículos civis.
- Placas no padrão visual Mercosul são geradas proceduralmente para carros civis, jogador e viaturas.
- Backend emite JWT HS256 com validade de sete dias e exige a sessão para ler ou alterar o perfil e registrar partidas.
- Rate limiting, CSP, validação de partidas, limite de payload e proteção de caminhos foram adicionados ao servidor.

## Refino pós-Fase 25 — Realismo

Esta versão adiciona um passe extra de realismo sem mudar a física validada do jogador e das viaturas.

### Mapa expandido

- Área urbana ampliada para **880 × 880 unidades**.
- Rede viária ampliada para **11 × 11 cruzamentos**.
- Até **100 quarteirões** entre as vias da nova malha.
- Ruas continuam largas para suportar perseguições com várias viaturas.
- Novos quarteirões são distribuídos em regiões residenciais, centro, escritórios, indústria, armazéns, estacionamentos, parques, praças e postos.
- Calçadas e meios-fios mais definidos.
- Linhas laterais nas vias, faixas de pedestres menos repetitivas e marcação central.
- Mais postes, árvores, bancos, fachadas, equipamentos de cobertura e elementos industriais.
- Túnel e estrutura elevada em regiões periféricas.
- Neblina e distância de câmera foram reajustadas para o mapa maior.
- A luz direcional acompanha a região do jogador para preservar sombras locais sem aumentar excessivamente o custo de renderização.

### Veículos mais realistas

Foi criado `VehicleRealismSystem.js`, responsável exclusivamente pela apresentação visual.

#### Carros civis e carro do jogador

- Capô e porta-malas mais definidos.
- Para-choques dianteiro e traseiro.
- Grade frontal.
- Faróis e lanternas emissivas.
- Para-brisa e vidro traseiro.
- Retrovisores.
- Soleiras/detalhes laterais.
- Teto e acabamento de carroceria.
- Rodas com aros adicionais.
- Rodas giram visualmente conforme a velocidade.

#### Motos

- Tanque.
- Quadro/chassi.
- Garfo dianteiro.
- Guidão.
- Farol e lanterna.
- Aros.
- Inclinação visual durante curvas baseada na taxa de rotação e velocidade.

#### Caminhões

- Para-choque pesado.
- Para-brisa maior.
- Retrovisores externos.
- Faróis.
- Detalhes na carroceria/carga.

#### Ônibus

- Para-brisa e vidro traseiro.
- Fileiras de janelas laterais.
- Faróis e lanternas.
- Aros nas rodas.

#### Viaturas

- Para-choque/push-bar de perseguição.
- Faróis e lanternas.
- Retrovisores.
- Antena.
- Holofote lateral.
- Detalhes de carroceria por variante.
- Barras vermelha/azul com alternância visual.

### Trânsito mais natural

O tráfego passou de **25 para 56 veículos**, aproveitando o mapa maior.

A distribuição deixou de ser uniforme. Carros comuns são maioria, enquanto táxis, motos, caminhões e ônibus aparecem em proporções menores, deixando as ruas menos artificiais.

### Bloqueios policiais corrigidos

O sistema antigo destruía todos os bloqueios e os recriava periodicamente. Isso causava o efeito de barreiras aparecendo e desaparecendo.

Agora:

- bloqueios existentes permanecem estáveis;
- mudança de nó estratégico não destrói o bloqueio atual;
- mudança na quantidade é incremental;
- somente bloqueios muito distantes ou claramente deixados para trás são substituídos;
- o novo bloqueio é criado antes do antigo ser removido;
- apenas um bloqueio obsoleto é substituído por ciclo;
- as distâncias de criação foram ampliadas para o novo tamanho do mapa.

Os próprios bloqueios também receberam detalhes visuais melhores:

- barreiras de concreto;
- faixas refletivas;
- cones com base;
- duas viaturas estacionadas;
- push-bars e luzes;
- colisão física também nas viaturas do bloqueio.

## Sistemas principais

- Movimento e física de veículos.
- Cidade e rede viária ampliadas.
- IA policial com A* e papéis táticos.
- Sistema de procurado e escalonamento policial.
- Pontuação, combo e captura.
- Danos e integridade.
- Trânsito civil.
- Eventos dinâmicos.
- Power-ups.
- Progressão e garagem.
- HUD e minimapa.
- Game Over.
- Backend REST e persistência.
- Ranking diário, semanal, mensal e global.
- Partição espacial, pooling, LOD e resolução adaptativa.
- Polimento visual e passe adicional de realismo.

## Execução

Requer **Node.js 18+**.

```bash
npm start
```

Abra:

```text
http://localhost:8000
```

> O Three.js continua sendo carregado pelo import map via CDN, portanto o navegador precisa de acesso à internet para carregar a biblioteca nesta versão.

## Testes

```bash
npm test
```

## Controles

- `W` — acelerar
- `S` — frear / ré
- `A` — virar à esquerda
- `D` — virar à direita
- `Espaço` — freio de mão
- `Esc` — pausar

## Configuração de segurança

Em produção, defina um segredo estável e forte antes de iniciar o servidor:

```bash
JWT_SECRET="um-segredo-aleatorio-com-pelo-menos-32-bytes" npm start
```

Sem essa variável, o servidor cria um segredo efêmero adequado ao desenvolvimento local; as sessões expiram quando o processo reinicia.

O JWT autentica a sessão do jogador. A validação de plausibilidade bloqueia submissões obviamente impossíveis, mas um sistema antitrapaça competitivo completo ainda exigiria simulação autoritativa no servidor.

## Fase planejada

- **Fase 19 — Áudio espacial e adaptativo**
