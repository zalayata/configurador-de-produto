# Visualizador 3D — contrato e extensões

`src/viewer.js` e `src/viewer/*` são o `InstallationViewer` do hotsite da linha Chromium, portados sem
mudar o contrato original (CONTRATOS.md, seção 4, daquele pacote) e estendidos para o configurador.
Três.js é importado de `three` e `three/addons/...`; nenhum framework.

## 1. Contrato do modelo

Quem cria um modelo entrega ao visualizador:

```js
{
  id,          // string
  descricao,   // texto alternativo do canvas
  root,        // THREE.Group com tudo
  groups,      // { [groupId]: THREE.Group } — um por grupo, descendente de root
  anchors,     // { [groupId]: THREE.Vector3 } ponto (mundo) da etiqueta
  explode,     // { [groupId]: THREE.Vector3 } deslocamento (m) na vista explodida, fator 1
  bounds,      // THREE.Box3
  labels,      // { [groupId]: rótulo público }   (extensão: substitui ROTULOS_GRUPO do hotsite)
  capOrder,    // [groupId] ordem de desenho das tampas de corte (extensão; opcional)
  scopes,      // { [groupId]: 'incluso' | 'nao-incluso' | 'existente' } (opcional; o configurador não usa)
  animated,    // { update(dt, fator) } ou null
  dispose(),
}
```

Regras de malha: `userData = { groupId, label }` em toda `Mesh`; materiais `MeshStandardMaterial`
próprios por grupo (o visualizador recolore por grupo e nunca altera os originais: trabalha em clones).

Dois construtores entregam esse contrato:

| Módulo | Origem | Grupos |
| --- | --- | --- |
| `src/model/catalogo.js` | GLB de `public/models/` + manifesto de `src/catalog/modelos/` | um por conjunto do manifesto |
| `src/model/importado.js` | arquivo do usuário (STEP/IGES/BREP via OpenCascade WASM, GLB, STL, OBJ) | um por malha (`p1`, `p2`, …) |

## 2. API original (inalterada)

`setColorMode`, `setCut` (tampa sólida por stencil e hachura), `setIsolation` (fantasma), `setExplode`,
`setAnimationSpeed`, `setView` (`iso | frente | lateral | tras | topo | produto`), `setPose` (transição em
arco), `setFraming`, `setInteractive`, `setAutoRotate`, `setLabels`, `setLabelLayout`, `getState` /
`applyState`, `exportPNG`, `on('select' | 'hover' | 'statechange' | 'quadro')`, `resize`, `start`,
`stop`, `dispose`. Renderização sob demanda: o laço dorme quando nada se move e pausa fora da tela ou com a
aba oculta.

## 3. Extensões do configurador

| Método | O que faz |
| --- | --- |
| `setGroupAppearance(groupId, { cor, metalico, rugoso, intensidadeAmbiente }, { animate, duration })` | Acabamento de um grupo. Com `animate`, cor e parâmetros interpolam (0,45 s) e a tampa de corte acompanha. |
| `highlightGroup(groupId \| null)` | Realce programático (o mesmo do cursor), usado ao passar pelo painel. |
| `focusGroup(groupId, { duration, margem })` | Câmera em arco até enquadrar o grupo, mantendo a direção de observação. |
| `setGroupVisible(groupId, bool)` | Mostra ou esconde um grupo e refaz as tampas de corte. |
| `setExportInfo({ titulo, subtitulo, nota, cabecalhoLegenda, legenda: [{ cor, rotulo }] })` | Textos e legenda do PNG exportado (antes vinham de dados fixos do hotsite). |

Mudanças internas: `viewer/constantes.js` deixou de importar dados de escopo e passou a ser configurado
pelo modelo (`configurarVisualizador`); `viewer/exportar.js` recebe título/legenda por parâmetro; as luzes
"sob a laje" só existem quando o modelo tem geometria abaixo do piso; o teto do passo de tempo subiu de
50 ms para 100 ms para as transições manterem a duração real em máquinas lentas.

## 4. Página

`src/main.js` orquestra: carregador com percentual real (fontes, módulos, modelo, primeiro quadro), um
visualizador por modelo em exibição com fusão na troca (`Palco.mostrar`), etapas Produto → Acabamento →
Resumo, ferramentas Explorar (vistas, corte, explodida, etiquetas, giro), importação CAD, link na URL
(`src/page/estado.js`), resumo em texto, PNG e ficha de impressão A4 (`src/page/impressao.css`).
`?movimento=reduzido` força o modo sem animações; `?impressao=1` mostra a ficha na tela.
