# Testes — Versão Final com Refino de Realismo

## Resultado automatizado

**27/27 PASS** em `npm test`.

A bateria cobre os sistemas anteriores e os novos requisitos de realismo.

## Novos testes do refino

- Mapa com `halfSize = 330`.
- Nove centros viários em cada eixo.
- Malha equivalente a 9 × 9 cruzamentos.
- 64 quarteirões potenciais entre as vias.
- Construção procedural de distritos.
- Calçadas/meios-fios e detalhes de fachada.
- Bloqueios sem reconstrução periódica total.
- Substituição incremental de bloqueios obsoletos.
- `VehicleRealismSystem` presente e integrado.
- Detalhamento específico de carro, polícia, moto, caminhão e ônibus.
- Animação visual das rodas.
- Inclinação visual das motos.
- Trânsito configurado para 42 veículos e distribuição ponderada.

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
PlayerVehicle.js  d14b037ed39439df6664ab30650f6c233046711a010b30985b25187353b30a7b
PoliceVehicle.js  2fa556a373c21b1aea4bbed3e0c01f4e20c42ba3b791755879bfb3b6eb782cfd
```

## Validação estrutural

- **40** arquivos `.js/.mjs` passaram em `node --check`.
- **59** imports relativos verificados.
- **0** imports relativos ausentes.
- `npm test`: **27/27 PASS**.
- Backend iniciado em processo real.
- `GET /`: **200**.
- `GET /api/health`: **200**.
- Tentativa de acesso a `server/data/store.json`: **404**.

## Limitação do teste WebGL automatizado

O Chromium do ambiente de geração não consegue resolver o domínio externo usado pelo import map do Three.js. Por isso, a execução WebGL completa não foi marcada como teste aprovado neste ambiente. A lógica, sintaxe, backend, estrutura, persistência das barreiras e regressões foram validados separadamente.
