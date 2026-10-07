![Grupo Idugel — 30 anos](../../public/selo-30-anos.png)

# Contrato do `andamento.json` — Controle de produção do Dosador Horizon

Grupo Idugel · Tecnologia em Processos de Moagem

`public/horizon/andamento.json` (publicado em `horizon/andamento.json`, ao lado de `horizon.html`) é a **única fonte do andamento da produção**: datas das oito etapas, identificação do pedido, ajustes manuais, fotos e histórico. A página lê o arquivo em tempo de execução, a cada abertura, com `cache: 'no-cache'`; trocar só esse arquivo muda a página sem novo build. Nenhum valor dele é repetido no código. Este documento é o contrato campo a campo, a regra de cálculo e os exemplos de edição. O guia de publicação está em [GUIA.md](GUIA.md).

## 1. Leitura e validação

- Endereço: `BASE_URL + 'horizon/andamento.json'`, resolvido contra a página (funciona na raiz, em subpasta e em domínio próprio). O `<head>` de `horizon.html` já dispara a leitura antes do JavaScript da aplicação; `src/horizon/andamento.ts` reaproveita essa resposta.
- A página espera até 6 s pela primeira resposta e segue; a leitura continua em segundo plano (novas tentativas após erro de rede ou HTTP ≥ 500) e, quando o arquivo chega, a página se atualiza sem recarregar. A página nunca trava pelo JSON.
- **Validação única — `validarAndamento(dados)`** (função pura, em `src/horizon/andamento.ts`, testada): devolve `{ valido, problemas, andamento }`, com `andamento` como cópia saneada. Só um andamento aprovado chega à página. Arquivo **inválido** tem o mesmo efeito do arquivo ausente: a página mostra o texto afirmativo de contato da equipe (`PROJETO.semDados`) no lugar das datas, sem NaN e sem seção vazia. O que invalida está na seção 6.
- A data de hoje é a data local do navegador (`aaaa-mm-dd`); a página recalcula sozinha quando o dia vira. Em desenvolvimento (`npm run dev`) e nos testes, `?hoje=aaaa-mm-dd` simula outra data; em produção o parâmetro é ignorado.

## 2. Estrutura, campo a campo

Datas sempre em ISO, `aaaa-mm-dd`, e reais (31/02 não existe). Exibição: `dd/mm/aaaa`. Textos em português do Brasil, tom afirmativo, sem termos reservados (GUIA, seção 5), sem preços e sem nomes de terceiros.

### 2.1 Raiz

| Campo | Tipo | Obrigatório | Significado |
| --- | --- | --- | --- |
| `atualizadoEm` | data | sim | Data da última edição do arquivo. Aparece como "Atualizado em dd/mm/aaaa" (capítulo Atualizações, cabeçalho da impressão). |
| `projeto` | objeto | sim | Identificação do pedido (2.2). |
| `etapas` | lista | sim | As 8 etapas, nesta ordem (2.3). |
| `ajustes` | objeto | não | Sobreposição manual do cálculo, por etapa (2.4). `{}` = tudo automático. |
| `fotos` | lista | não | Fotos da produção (2.5). |
| `atualizacoes` | lista | não | Histórico (2.6). |

### 2.2 `projeto`

| Campo | Tipo | Obrigatório | Significado |
| --- | --- | --- | --- |
| `equipamento` | texto | não | Nome do equipamento no título da página e da impressão. Vazio ou ausente: "Dosador Horizon" (`PROJETO.equipamento`). |
| `modelo` | texto | não | Modelo ou variante, ao lado do nome ("Dosador Horizon · DH-300"). |
| `ordem` | texto | não | Número da ordem de produção ("Ordem de produção 2026-0412"). |
| `proposta` | texto | não | Número da proposta comercial ("Proposta 1115/0901/26"). |
| `quantidade` | inteiro > 0 | não | Quantidade de dosadores ("1 unidade", "2 unidades"). Outro valor é ignorado. |
| `cliente` | texto | não | Nome do cliente. Vazio ou ausente: a página não cita cliente. |
| `cidade` | texto | não | Cidade do cliente ("Cliente — Cidade (UF)"). Só aparece junto do cliente. |
| `confirmadoEm` | data | **sim** | Data da confirmação do pedido ("Pedido confirmado em dd/mm/aaaa"). Por regra, igual ao início e ao fim da etapa `pedido`. |
| `entregaLimite` | data | **sim** | Data-limite de entrega ("Entrega — data-limite dd/mm/aaaa"). Por regra, igual ao fim da etapa `expedicao`. |

Textos vazios (`""`) valem como ausentes.

### 2.3 `etapas[]` — as 8, nesta ordem

Os ids são fixos e precisam vir **exatamente** nesta ordem; outra lista invalida o arquivo:

`pedido` → `engenharia` → `suprimentos` → `fabricacao` → `pintura` → `montagem` → `testes` → `expedicao`

| Campo | Tipo | Obrigatório | Significado |
| --- | --- | --- | --- |
| `id` | texto | sim | Um dos 8 ids acima, na posição certa. |
| `nome` | texto | sim | Nome da etapa no capítulo, na tabela da impressão e no histórico ("Fabricação"). O nome curto da linha do tempo é fixo no código (`NOMES_CURTOS`). |
| `inicio` | data | sim | Início da etapa (entra no cálculo; aparece se for pública). |
| `fim` | data | sim | Fim da etapa, ≥ `inicio`. A etapa está concluída a partir deste dia. Etapa de um dia: `inicio` = `fim` (pedido). |
| `local` | texto | não | Onde a etapa acontece ("Fábrica Idugel · Joaçaba (SC)"); texto secundário no capítulo e na tabela da impressão. |
| `rotulos` | objeto `{ inicio, fim }` | não | Rótulo de cada data pública no capítulo e na coluna "Datas" da impressão. Padrão "Início" / "Término". Ex.: `{ "inicio": "Início", "fim": "Conjuntos prontos" }`. Início igual ao fim aparece uma vez. |
| `datasPublicas` | lista com `"inicio"` e/ou `"fim"` | não | Quais datas da etapa aparecem na tela e no papel. Padrão: as duas. Uma data fora da lista **só entra no cálculo** (percentual, sequência) e nunca aparece — nem na linha do tempo, nem no capítulo, nem na impressão, nem no texto para leitor de tela. `dataPublica(etapa, campo)` é a única porta de saída de uma data de etapa. |

Datas crescentes: cada etapa começa quando a anterior termina (`inicio` da etapa = `fim` da anterior) ou depois. O arquivo publicado hoje tem as oito em sequência contínua.

### 2.4 `ajustes` — sobreposição manual, por etapa

`ajustes[<id da etapa>]` sobrepõe o cálculo automático **campo a campo**: cada campo presente e dentro da regra vale; cada campo ausente, `null` ou fora da regra é ignorado (`ajusteValido`), e o resto do bloco continua valendo. Apagar o bloco devolve a etapa ao automático. Ajuste para etapa inexistente é ignorado.

| Campo | Valores | Efeito |
| --- | --- | --- |
| `status` | `"concluida"` · `"em-andamento"` · `"programada"` | Força o estado. Sem `percentual`, o percentual vira 100 / 0 / o calculado (entre 1 e 99). |
| `percentual` | 0 a 100 (número; arredondado) | Força o percentual. Sem `status`, define o estado: 100 = concluída, 0 = programada, entre eles = em andamento. |
| `realizadoEm` | data | Fecha a etapa nessa data: é o fim efetivo (vale no cálculo) e a data de "Concluída em dd/mm/aaaa". |
| `inicio` | data | Remarca o início (sobrepõe `etapas[].inicio` no cálculo, no rótulo e nos campos do capítulo, respeitando `datasPublicas`). |
| `fim` | data | Remarca o fim (idem). |
| `mensagem` | texto | Nota curta da produção, mostrada no capítulo da etapa e na impressão junto da situação. Vazia é ignorada. |
| `passos` | objeto `{ "<idDoPasso>": status }` | Força o estado de passos da checklist (ids na seção 4). Vale só com a etapa em andamento ou concluída; etapa programada deixa todos os passos programados. |

### 2.5 `fotos[]`

| Campo | Tipo | Obrigatório | Significado |
| --- | --- | --- | --- |
| `arquivo` | texto | sim | Caminho relativo à página (à raiz do `dist/`): `"horizon/fotos/aaaa-mm-dd-nome.webp"`. No repositório o arquivo vai em `public/horizon/fotos/`. Foto cujo arquivo não carrega sai da faixa. |
| `data` | data | sim | Data da foto. Foto com data futura só aparece a partir dela. |
| `etapa` | id de etapa | sim | Etapa da foto (a faixa de fotos aparece no capítulo dela e no capítulo Atualizações). Id desconhecido: a foto sai da lista. |
| `legenda` | texto | não | Legenda curta (texto alternativo e legenda da foto ampliada). |

### 2.6 `atualizacoes[]`

| Campo | Tipo | Obrigatório | Significado |
| --- | --- | --- | --- |
| `data` | data | sim | Data do registro. Registro com data futura só aparece a partir dela. |
| `etapa` | id de etapa | sim | Etapa a que o registro se refere. Id desconhecido: o registro sai da lista. |
| `texto` | texto | sim | Uma frase afirmativa ("Caldeiraria da calha concluída. Moega em andamento."). |

A página lista o histórico da mais recente para a mais antiga; na impressão, as duas últimas seguem com o contato e o rodapé.

## 3. Regra de cálculo (`src/horizon/cronograma.ts`, função pura)

`calcular(andamento, hoje)` → `{ hoje, etapas[], etapaAtual, percentualGeral }`. Cada etapa calculada tem `status`, `percentual`, `rotulo`, `concluidaEm`, `publicas`, `rotulos`, `mensagem`, `local`, `passosForcados`, `ativa`. Os campos `inicio`/`fim` da etapa calculada são as datas **efetivas de cálculo** (podem ser internas): para exibir, só `dataPublica(etapa, 'inicio' | 'fim')`.

1. **Por data.** Datas efetivas: `ajustes.inicio`/`ajustes.fim` sobrepõem as do plano; `realizadoEm` é o fim efetivo. Então: `hoje < inicio` → **programada**, 0 %; `inicio ≤ hoje < fim` → **em andamento**, percentual = `round((hoje − inicio) / (fim − inicio) × 100)` limitado a 1..99; `hoje ≥ fim` → **concluída**, 100 % (no próprio dia do fim). Etapa com `inicio` = `fim` está concluída a partir daquele dia. Data ausente ou impossível nunca gera NaN: a etapa fica programada, 0 %, e o rótulo omite a data.
2. **Ajustes prevalecem campo a campo** (seção 2.4). O percentual andando por data é a regra; o ajuste é a exceção pontual da produção.
3. **Sequência obrigatória.** Uma etapa só fica em andamento ou concluída se a anterior está concluída. Se a anterior não concluiu (por data ou por ajuste), as seguintes ficam "Programada · até <seu fim efetivo>" mesmo com status forçado. Nunca há duas etapas em andamento.
4. **Concluída em.** `realizadoEm`; sem ele, o fim efetivo da etapa **se for público**; senão só "Concluída". Data fixa — nunca a data de hoje. Etapa fechada por ajuste (`status: "concluida"` ou `percentual: 100`) sem `realizadoEm` mostra o fim da etapa; `validar()` avisa no console de desenvolvimento.
5. **Texto do estado** (`partesDoRotulo` → `{ estado, data, sep }`; `rotuloDaEtapa` junta numa linha) — o mesmo na linha do tempo, no capítulo, na impressão e no texto para leitor de tela: concluída → "Concluída em dd/mm/aaaa"; em andamento → "Em andamento · n %" + " · até dd/mm/aaaa" quando o fim é público; programada → "Programada · até dd/mm/aaaa" quando o fim é público, senão "Programada · a partir de dd/mm/aaaa" (início público), senão "Programada". Exemplo com o plano publicado, em 20/11/2026: Pedido "Concluída em 05/10/2026"; Engenharia "Concluída em 16/10/2026"; Suprimentos "Concluída em 06/11/2026"; Fabricação "Em andamento · 50 % · até 04/12/2026"; Pintura "Programada · até 11/12/2026"; e assim por diante.
6. **Etapa atual** (`etapaAtual`, `ativa: true`): a etapa em andamento; sem nenhuma, a última concluída; sem nenhuma concluída, a primeira. É a etapa cujos passos a impressão lista.
7. **Percentual geral:** média dos percentuais ponderada pela duração de cada etapa.
8. **Passos (checklist) — `estadoDoPasso(etapa, passo)`.** Cada passo tem uma faixa `[a, b]` em % da etapa (seção 4): programado antes de `a`, em andamento de `a` até `b`, concluído a partir de `b`. Etapa concluída conclui todos; etapa programada deixa todos programados. `ajustes[etapa].passos[idDoPasso]` prevalece sobre a faixa (controle manual da produção), exceto com a etapa programada. As faixas se sobrepõem de propósito: na fábrica há mais de uma frente aberta. O 3D usa `fracaoDoPasso` (0..1 dentro da faixa) para trazer o conjunto ligado ao passo do fantasma ao lugar; passo concluído = conjunto no lugar. Texto do passo (impressão e leitor de tela): "concluída/concluído/concluídos/concluídas" concordando com o nome, "em andamento", "programada/…".
9. **Fotos e atualizações com data futura** só aparecem a partir da data (`ateHoje`).

## 4. Ids dos passos por etapa (`PASSOS` em `src/horizon/capitulos.ts`)

Use estes ids em `ajustes[etapa].passos`. A coluna "Conjunto do 3D" diz qual grupo do modelo entra em cena com o passo.

| Etapa | Id do passo | Passo | Faixa (% da etapa) | Conjunto do 3D |
| --- | --- | --- | --- | --- |
| `pedido` | — | (sem passos) | — | — |
| `engenharia` | `conjunto` | Desenho de conjunto | 0 – 40 | — |
| | `detalhamento` | Detalhamento das peças | 30 – 75 | — |
| | `lista` | Lista de materiais | 60 – 90 | — |
| | `liberacao` | Liberação para produção | 90 – 100 | — |
| `suprimentos` | `chapas` | Chapas, perfis e tubos | 0 – 40 | — |
| | `mancais` | Mancais e rolamentos | 20 – 55 | mancais |
| | `motoredutor` | Motoredutor | 35 – 80 | motoredutor |
| | `eletrica` | Componentes elétricos e painel | 60 – 100 | painel |
| `fabricacao` | `estrutura` | Corte, dobra e solda da estrutura | 0 – 35 | estrutura |
| | `calha` | Caldeiraria da calha | 20 – 60 | calha |
| | `moega` | Caldeiraria da moega | 45 – 80 | moega |
| | `rosca` | Usinagem do eixo e da rosca | 60 – 100 | rosca |
| `pintura` | `preparacao` | Preparação de superfície | 0 – 30 | — |
| | `fundo` | Fundo | 30 – 60 | — |
| | `acabamento` | Acabamento e escovamento do inox | 60 – 100 | — |
| `montagem` | `mancais` | Mancais e rosca | 0 – 25 | mancais |
| | `motoredutor` | Motoredutor e acoplamento | 20 – 50 | motoredutor |
| | `descarga` | Bocal de descarga | 45 – 65 | descarga |
| | `tampas` | Tampas e proteções | 60 – 80 | tampas |
| | `painel` | Painel e instalação elétrica | 75 – 100 | painel |
| `testes` | `giro` | Teste de giro em vazio | 0 – 40 | — |
| | `eletrica` | Verificação elétrica e de segurança | 35 – 75 | — |
| | `inspecao` | Inspeção final e liberação | 70 – 100 | — |
| `expedicao` | `embalagem` | Embalagem | 0 – 40 | — |
| | `carregamento` | Carregamento | 40 – 55 | — |
| | `transporte` | Transporte | 55 – 95 | — |
| | `entrega` | Entrega | 95 – 100 | — |

## 5. Como cada mudança aparece na página

| Mudança | Onde aparece |
| --- | --- |
| `etapas[].inicio`/`fim` ou `ajustes.inicio`/`fim` | Linha do tempo, estado do capítulo, campos de data do capítulo, tabela da impressão, percentual e sequência — tudo junto, só nas datas públicas |
| `ajustes.realizadoEm` | "Concluída em dd/mm/aaaa" e fim efetivo da etapa |
| `ajustes.status`/`percentual` | Estado, percentual, passos e posição dos conjuntos no 3D |
| `ajustes.mensagem` | Nota no capítulo da etapa e na impressão |
| `ajustes.passos` | Marcadores da checklist e conjuntos do 3D ligados aos passos |
| `fotos` | Faixa de fotos no capítulo da etapa e no capítulo Atualizações; foto ampliada (Esc fecha) |
| `atualizacoes` | Histórico no capítulo Atualizações; as duas últimas na impressão com o contato |
| `atualizadoEm` | "Atualizado em" no capítulo Atualizações e no cabeçalho da impressão |
| `projeto.*` | Título, identificação do pedido e datas do pedido (capítulo Pedido e impressão) |

## 6. O que invalida o arquivo (e o que é só ignorado)

**Inválido** — a página mostra o texto de contato no lugar das datas (`validarAndamento`):

- arquivo que não é um objeto JSON (ou JSON mal formado);
- `projeto` ausente, ou `projeto.confirmadoEm` / `projeto.entregaLimite` fora de `aaaa-mm-dd` real;
- `atualizadoEm` fora de `aaaa-mm-dd` real;
- `etapas` sem ser exatamente as 8 com os ids `pedido, engenharia, suprimentos, fabricacao, pintura, montagem, testes, expedicao`, nesta ordem;
- etapa sem `nome`, ou com `inicio`/`fim` fora de `aaaa-mm-dd` real;
- `etapas[].datasPublicas` que não seja uma lista só com `"inicio"` e/ou `"fim"`; `etapas[].rotulos` que não seja objeto;
- `fotos` ou `atualizacoes` que não sejam listas, item que não seja objeto, ou **qualquer `data` fora de `aaaa-mm-dd` real** — "10/02/2027" e "2027-02-30" invalidam o arquivo.

**Ignorado campo a campo** — o resto do arquivo vale:

- em `ajustes`: `status` desconhecido, `percentual` fora de 0..100, `realizadoEm`/`inicio`/`fim` fora do formato, `mensagem` vazia, `passos` com status desconhecido, ajuste para etapa inexistente;
- `projeto.quantidade` que não seja inteiro positivo; textos vazios em `projeto`, `local`, `rotulos`, `legenda`;
- foto sem `arquivo` ou com `etapa` desconhecida; atualização sem `texto` ou com `etapa` desconhecida (saem da lista).

**Avisos de desenvolvimento** (`validar()` no console, não invalidam): fim antes do início; início antes do início da etapa anterior; etapa fechada por ajuste sem `realizadoEm`; ajuste para etapa inexistente; foto ou atualização com campos inválidos. `npm test` barra as incoerências do arquivo publicado (ordem, datas crescentes, termos reservados).

## 7. Exemplos de edição

Em todos os casos: acrescentar uma linha em `atualizacoes` e atualizar `atualizadoEm`.

**Remarcar uma etapa** (a fabricação passa a terminar em 11/12/2026; as seguintes deslocam junto). Caminho 1, no plano:

```json
"etapas": [
  …,
  { "id": "fabricacao", "nome": "Fabricação", "inicio": "2026-11-06", "fim": "2026-12-11", "local": "Fábrica Idugel · Joaçaba (SC)", "rotulos": { "inicio": "Início", "fim": "Conjuntos prontos" } },
  { "id": "pintura", "nome": "Pintura e acabamento", "inicio": "2026-12-11", "fim": "2026-12-18", … },
  …
]
```

Caminho 2, por ajuste (o plano fica registrado e o ajuste pode ser apagado depois):

```json
"ajustes": {
  "fabricacao": { "fim": "2026-12-11", "mensagem": "Caldeiraria da moega concluída; usinagem da rosca em andamento." }
}
```

**Fechar uma etapa na data real** (a engenharia liberou a produção em 14/10/2026, antes do fim do plano):

```json
"ajustes": {
  "engenharia": { "status": "concluida", "realizadoEm": "2026-10-14" }
}
```

Resultado: "Concluída em 14/10/2026"; Suprimentos passa a contar pela data a partir do seu início.

**Forçar um passo** (a estrutura ficou pronta antes do percentual da etapa; o 3D põe a estrutura no lugar):

```json
"ajustes": {
  "fabricacao": { "passos": { "estrutura": "concluida", "calha": "em-andamento" } }
}
```

**Registrar uma atualização:**

```json
"atualizadoEm": "2026-11-20",
"atualizacoes": [
  { "data": "2026-11-20", "etapa": "fabricacao", "texto": "Estrutura soldada e calha em caldeiraria." },
  { "data": "2026-10-05", "etapa": "pedido", "texto": "Pedido confirmado. Produção do Dosador Horizon programada." }
]
```

**Foto** (arquivo em `public/horizon/fotos/2026-11-20-calha.webp`):

```json
"fotos": [
  { "arquivo": "horizon/fotos/2026-11-20-calha.webp", "data": "2026-11-20", "etapa": "fabricacao", "legenda": "Calha em caldeiraria" }
]
```

**Voltar ao automático:** apagar o bloco da etapa em `ajustes` (ou deixar `"ajustes": {}`).

## 8. Arquivo publicado hoje (plano inicial)

Datas, ordem de produção e cliente deste arquivo são um plano inicial, a conferir pela equipe (GUIA, seção 7).

```json
{
  "atualizadoEm": "2026-10-07",
  "projeto": {
    "equipamento": "Dosador Horizon",
    "ordem": "",
    "proposta": "",
    "quantidade": 1,
    "cliente": "",
    "cidade": "",
    "confirmadoEm": "2026-10-05",
    "entregaLimite": "2027-01-29"
  },
  "etapas": [
    { "id": "pedido",      "nome": "Confirmação do pedido",        "inicio": "2026-10-05", "fim": "2026-10-05", "rotulos": { "inicio": "Confirmado em", "fim": "Confirmado em" } },
    { "id": "engenharia",  "nome": "Engenharia e detalhamento",    "inicio": "2026-10-05", "fim": "2026-10-16", "rotulos": { "inicio": "Início", "fim": "Liberação para produção" } },
    { "id": "suprimentos", "nome": "Suprimentos",                  "inicio": "2026-10-16", "fim": "2026-11-06", "rotulos": { "inicio": "Início", "fim": "Materiais na fábrica" } },
    { "id": "fabricacao",  "nome": "Fabricação",                   "inicio": "2026-11-06", "fim": "2026-12-04", "local": "Fábrica Idugel · Joaçaba (SC)", "rotulos": { "inicio": "Início", "fim": "Conjuntos prontos" } },
    { "id": "pintura",     "nome": "Pintura e acabamento",         "inicio": "2026-12-04", "fim": "2026-12-11", "rotulos": { "inicio": "Início", "fim": "Acabamento concluído" } },
    { "id": "montagem",    "nome": "Montagem mecânica e elétrica", "inicio": "2026-12-11", "fim": "2027-01-08", "rotulos": { "inicio": "Início", "fim": "Montagem concluída" } },
    { "id": "testes",      "nome": "Testes e inspeção final",      "inicio": "2027-01-08", "fim": "2027-01-15", "rotulos": { "inicio": "Início", "fim": "Liberado para expedição" } },
    { "id": "expedicao",   "nome": "Expedição e entrega",          "inicio": "2027-01-15", "fim": "2027-01-29", "rotulos": { "inicio": "Liberado para expedição", "fim": "Entrega — data-limite" } }
  ],
  "ajustes": {},
  "fotos": [],
  "atualizacoes": [
    { "data": "2026-10-05", "etapa": "pedido", "texto": "Pedido confirmado. Produção do Dosador Horizon programada." }
  ]
}
```
