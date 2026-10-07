# Configurador de Produto — alinhamento à linha do hotsite Chromium

Referência: pacote do hotsite do banco de cilindros Linha Chromium (V1_4, 01/10/2026), composto por
`chromium-koene/` (aplicação Vite + Three.js), `CONTRATOS.md`, `DIRECAO-DE-ARTE.md`, `MODELO-3D.md`,
`PROJETO.md` e `GUIA-MANUS.md`. Este documento resume o que define aquela linha, onde o configurador
atual se afasta dela e como aproximar os dois, em etapas.

O pacote de referência contém dados comerciais de um cliente e não é copiado para este repositório.

## 1. O que define a linha

| # | Traço | Como aparece no hotsite |
| --- | --- | --- |
| 1 | **Palco escuro em tela cheia, objeto grande** | Fundo petróleo/grafite com gradiente por capítulo, névoa, farinha em canvas 2D, grão de filme, vinheta. O equipamento ocupa 58–76 % da altura. Sem piso espelhado. |
| 2 | **Interface cromo, cor só com contrato** | Paleta `--tinta`, `--grafite`, `--cromo`, acento `--aco` (azul-aço). O vermelho da marca aparece só no logotipo. Verde `#0B8A43` e vermelho `#C8201E` são reservados a escopo (incluso / não incluso); cinza `#8C9296` a obra civil. |
| 3 | **Tipografia condensada em caixa alta** | Barlow Condensed (títulos, contorno ou preenchido) + Manrope (texto), fontes locais OFL, peso único, `font-synthesis: none`. Numerais monumentais (`--t-numeral`). Decimal com vírgula, milhar com ponto. |
| 4 | **Controles circulares e indicadores** | Botões em anel de 1 px (44 / 64 / 96 px), pílulas de contorno, coluna de indicadores circulares à direita, menu em tela inteira com íris, carregador com percentual real. |
| 5 | **Logo oficial em plaqueta clara** | `idugel-30-anos.png` (1200 × 309) sobre plaqueta `--papel`, nunca recolorido nem sobre fundo escuro direto. |
| 6 | **Dados em fonte única** | Todo conteúdo técnico vem de um módulo de dados (`scope-data.js`) com testes que barram inconsistências. A página não contém números soltos. |
| 7 | **Visualizador com contrato** | `InstallationViewer`: cores (natural / escopo com onda), corte X/Y/Z com tampa sólida (stencil), isolamento com fantasma, explodida contínua, vistas nomeadas, poses em arco, etiquetas HTML com linha-guia, estado na URL (`getState` / `applyState`), PNG com logo e legenda, pausa fora da tela. |
| 8 | **Modelo híbrido CAD + procedural** | Peças do projeto Idugel convertidas para GLB compacto (`KHR_mesh_quantization`, normais calculadas na leitura, `userData` por malha com `groupId`, `scope`, `label`, `peca`, `codigo`); o restante é procedural e alinhado ao desenho, com teste numérico de alinhamento. |
| 9 | **Narrativa por capítulos** | Rolagem por capítulos com hash na URL, patamares de leitura, leitura linear e `prefers-reduced-motion` com todo o conteúdo, folha de impressão A4. |
| 10 | **Tom afirmativo** | Sem ressalvas, sem "ilustrativo", sem preços, sem terceiros. |

## 2. Onde o configurador atual se afasta

| Área | Configurador hoje | Linha Chromium |
| --- | --- | --- |
| Stack | Vite + React + TypeScript, react-three-fiber/drei, Zustand | Vite + JavaScript ES modules + Three.js puro, sem framework |
| Palco | Piso espelhado (`MeshReflectorMaterial`), anel vermelho, vinheta | Laje/piso do projeto, névoa, farinha, grão; sem reflexo |
| Paleta | Acento vinho `#D3262C` em botões, foco, seleção, rail | Acento azul-aço; vermelho só no logo; verde/vermelho reservados a escopo |
| Tipografia | Saira SemiCondensed + Archivo (npm @fontsource) | Barlow Condensed + Manrope, locais em `public/fonts/`, caixa alta |
| Logo | SVG recriado (`logo-idugel.svg`) + selo PNG | PNG oficial 30 anos em plaqueta clara, sem redesenho |
| Controles | Botões retangulares com raio 10–16 px, painel lateral de 380 px | Círculos em anel, pílulas de contorno, indicadores circulares, painel de vidro de 320 px |
| Modelo | Moinho de martelos procedural genérico; importação STEP/GLB no navegador | Banco de cilindros com acionamento do CAD 711156, GLB preparado offline, grupos com contrato |
| Dados | `product.ts` (acabamentos, grupos, opcionais) | Módulo de dados único com testes |
| Visualizador | Presets de câmera por etapa, auto-rotate, captura PNG simples | Corte com tampa, isolamento, explodida, vistas, etiquetas, PNG com legenda, estado na URL |
| Navegação | Etapas Produto → Acabamento → Opcionais → Resumo em painel | Capítulos por rolagem com hash; o configurador pede etapas, não rolagem |
| Saídas | Link, resumo em texto, PNG, impressão, GLB | PNG com logo/legenda, link de estado, impressão A4, documentos PDF |

## 3. O que se preserva do configurador

- A lógica de **configuração por etapas** (Produto → Acabamento → Opcionais → Resumo). O hotsite é narrativa; o configurador é ferramenta. A linha visual é a mesma, a navegação não.
- A **importação CAD no navegador** (STEP/IGES/GLB/STL/OBJ via OpenCascade WASM) e a exportação de GLB otimizado, como caminho para preparar produtos novos.
- O **deploy estático** em GitHub Pages com `base: './'` e uso em iframe.

## 4. Plano em etapas

### Etapa A — Identidade visual (sem mexer em 3D)

1. Trazer os tokens de `DIRECAO-DE-ARTE.md` §2.2 para `src/styles/global.css`: `--tinta-*`, `--grafite-*`, `--cromo-*`, `--aco`, `--papel`, escalas tipográficas e durações.
2. Fontes locais Barlow Condensed e Manrope em `public/fonts/` (OFL), `font-synthesis: none`; remover `@fontsource/*`.
3. Logo oficial 30 anos em plaqueta `--papel` no cabeçalho; aposentar `logo-idugel.svg` como logotipo (o vinho da marca fica só no logo).
4. Acento passa de vinho para `--aco`. Verde e vermelho saem de toda a interface (toggles, foco, seleção).
5. Botões e ferramentas do viewport viram controles circulares em anel; o rail de etapas vira indicadores circulares; o painel vira vidro de 320 px com cantos `--r-2`.
6. Títulos de etapa em Barlow Condensed caixa alta, com o título grande passando atrás do objeto (sanduíche C2/C3/C5).
7. Teste de disciplina cromática (varredura do CSS gerado) como no hotsite.

### Etapa B — Palco e visualizador

1. Trocar o piso espelhado por laje/palco com transparência radial, névoa de cor igual ao centro do gradiente, farinha em duas camadas de canvas 2D e grão de filme.
2. Luz do hotsite: softbox quente, recorte fria, hemisférica, `RoomEnvironment`, ACES.
3. Portar para o configurador as capacidades do `InstallationViewer`: corte com tampa sólida, isolamento com fantasma, explodida, vistas nomeadas, poses em arco, etiquetas com linha-guia, PNG com logo e legenda, estado completo na URL.
4. Decisão de arquitetura (ver §5): reaproveitar `src/viewer.js` do hotsite como classe independente do React (envolvida por um componente fino) ou reescrever as mesmas capacidades em react-three-fiber.

### Etapa C — Produto real

1. Primeiro produto do catálogo: o próprio banco de cilindros Linha Chromium, reutilizando o modelo híbrido (GLB do acionamento + banco procedural) e seus testes de alinhamento.
2. Módulo de dados único por produto (variantes: rolo 1000 / 1250 / sobreposto; acabamentos; opcionais) com testes.
3. Mapear opcionais e acabamentos aos `groupId` do modelo, para que cada escolha acenda ou recolora um grupo.
4. Ficha de impressão A4 no padrão do hotsite (fio de cabeçalho, logo 42 mm, duas colunas).

### Etapa D — Catálogo

1. Pipeline Inventor → STEP → GLB compacto com `userData` por peça (`tools/cad/`), nos moldes de `build-glb.py`.
2. Seletor de produto na etapa Produto lendo o catálogo.
3. Leitura linear e `prefers-reduced-motion` com todo o conteúdo.

## 5. Decisões em aberto

1. **Stack.** Manter React + TypeScript e portar a linha visual e as capacidades do visualizador, ou migrar para JavaScript ES modules + Three.js puro e reaproveitar `viewer.js`, `machine-model.js` e os módulos de modelo do hotsite sem adaptação. A segunda opção reduz o custo das etapas B e C e mantém um único código de visualizador entre hotsite e configurador.
2. **Primeiro produto.** Começar pelo banco de cilindros Chromium (modelo já pronto e testado) ou por outro equipamento do portfólio.
3. **Importação CAD no navegador.** Manter como recurso do produto final ou mover para ferramenta interna de preparação de catálogo.
4. **Escopo das cores.** No configurador, verde/vermelho continuam reservados a escopo de fornecimento (incluso / não incluso), ou o configurador não usa esse eixo e as duas cores simplesmente saem da interface.
