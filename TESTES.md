# Testes — Operação Cidade Aberta

## Resultado automatizado

**33/33 PASS** em `npm test`.

A bateria cobre os sistemas anteriores e os novos requisitos de realismo.

## Novos testes da Fase 26

- Mapa com `halfSize = 440`.
- Onze centros viários em cada eixo.
- Malha equivalente a 11 × 11 cruzamentos.
- 100 quarteirões potenciais entre as vias.
- Construção procedural de distritos.
- Calçadas/meios-fios e detalhes de fachada.
- Bloqueios sem reconstrução periódica total.
- Substituição incremental de bloqueios obsoletos.
- `VehicleRealismSystem` presente e integrado.
- Detalhamento específico de carro, polícia, moto, caminhão e ônibus.
- Animação visual das rodas.
- Inclinação visual das motos.
- Trânsito configurado para 56 veículos e distribuição ponderada.
- Perfis de motorista, semáforos, luzes de freio e preferência a emergências.
- Busca policial por memória compartilhada e varredura de nós próximos.
- Minimapa completo limitado às dimensões reais da cidade e modo radar.
- Emplacamento procedural no padrão visual Mercosul.
- Sessões JWT HS256, rate limiting, CSP e validação de partidas.

## Teste isolado de persistência das barreiras

Além de `npm test`, foi executado um harness isolado do `RoadblockSystem`.

Resultado:

```text
PASS roadblock persistence
```

O teste cria um bloqueio válido, avança diversos ciclos de atualização e confirma que o mesmo objeto continua ativo, sem ser destruído/recriado apenas porque o timer de refresh venceu.

## Regressão da movimentação

A física não foi alterada no refino visual.

Hashes SHA-256:

```text
PlayerVehicle.js  049155b84a45abd5e5a5d4777668e43d0d189deaaec3d7f6103297ffb71f2242
PoliceVehicle.js  983fdebece8859011a2ef665dd530c9d8beb385527bfd824ac732c4f5dbd0453
```

## Validação estrutural

- **40** arquivos `.js/.mjs` passaram em `node --check`.
- **59** imports relativos verificados.
- **0** imports relativos ausentes.
- `npm test`: **33/33 PASS**.
- Backend iniciado em processo real.
- `GET /`: **200**.
- `GET /api/health`: **200**.
- Tentativa de acesso a `server/data/store.json`: **404**.

## Validação WebGL

O jogo foi aberto no navegador integrado, a partida foi iniciada e os modos **mapa completo** e **radar local** foram conferidos visualmente. O Three.js, o HUD, a cidade, o emplacamento e o minimapa carregaram sem erros de execução.
