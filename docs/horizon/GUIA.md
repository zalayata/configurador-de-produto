![Grupo Idugel — 30 anos](../../public/selo-30-anos.png)

# Controle de produção — Dosador Horizon · Guia de publicação e aceite

Grupo Idugel · Tecnologia em Processos de Moagem

Este guia diz o que é a página, como publicá-la, como atualizar o andamento sem novo build, quais regras de conteúdo valem e o que conferir na URL publicada. O contrato do arquivo de dados está em [CONTRATO-ANDAMENTO.md](CONTRATO-ANDAMENTO.md); o texto para quem atualiza o andamento, em [PROMPT-ATUALIZAR-ANDAMENTO.txt](PROMPT-ATUALIZAR-ANDAMENTO.txt).

## 1. O que é a página

`horizon.html` é a segunda página deste repositório (a primeira é o configurador 3D, `index.html`). Ela acompanha a produção do **Dosador Horizon** na Fábrica Idugel, em Joaçaba (SC), em nove capítulos: as oito etapas da produção e o histórico. O modelo 3D do dosador acompanha cada etapa — fantasma na engenharia, conjuntos chegando ao lugar na fabricação, cor mudando na pintura, rosca girando nos testes, engradado fechando na expedição.

| # | Hash | Capítulo | Modelo 3D |
| --- | --- | --- | --- |
| 01 | `#pedido` | Pedido confirmado | Dosador completo, acabamento final |
| 02 | `#engenharia` | Engenharia e detalhamento | Fantasma de todo o conjunto |
| 03 | `#suprimentos` | Suprimentos | Fantasma; mancais, motoredutor e painel ficam sólidos conforme chegam |
| 04 | `#fabricacao` | Fabricação — Fábrica Idugel, Joaçaba | Só os conjuntos fabricados, em aço bruto, chegando ao lugar |
| 05 | `#pintura` | Pintura e acabamento | Conjuntos fabricados passando do aço bruto ao acabamento final |
| 06 | `#montagem` | Montagem mecânica e elétrica | Mancais, motoredutor, bocal, tampas e painel vêm do afastamento ao lugar |
| 07 | `#testes` | Testes e inspeção final | Completo, rosca girando, painel ligado |
| 08 | `#expedicao` | Expedição e entrega | Completo sobre o estrado; engradado fecha conforme o percentual |
| 09 | `#atualizacoes` | Atualizações | Papel: histórico, fotos, resumo para imprimir e contato |

Tudo o que muda com o tempo — status, percentual, datas, passos, fotos e histórico — vem de **um único arquivo**, `horizon/andamento.json`, lido em tempo de execução. O código não guarda nenhuma data: a página calcula o estado de cada etapa pela data de hoje e pelas datas do arquivo (regra na seção 3 do contrato).

Navegação: linha do tempo persistente (clique leva ao capítulo), setas ← →, PageUp/PageDown, Home/End; Esc fecha a foto ampliada; voltar/avançar do navegador e chegada direta por hash funcionam. Com movimento reduzido no sistema, não há peça a meio caminho nem rotação automática.

Impressão: o botão **Imprimir** da barra superior captura o 3D no estado do capítulo aberto e abre a impressão da folha A4 (cabeçalho com o selo, título, captura, linha do tempo, tabela de etapas e datas, passos da etapa atual, atualizações, contato e rodapé). Ctrl+P imprime a mesma folha, sem a captura.

## 2. URL pública

**<https://zalayata.github.io/configurador-de-produto/horizon.html>**

Capítulo direto: `…/horizon.html#fabricacao`. O configurador continua em `…/configurador-de-produto/`.

## 3. Como publicar

```bash
npm ci
npm test          # vitest: cronograma, validação do andamento.json, termos reservados
npm run build     # gera dist/ com as duas páginas
npm run preview   # confere o build localmente antes de publicar
```

`dist/` sai com `index.html`, `horizon.html`, `horizon/andamento.json`, `selo-30-anos.png`, `logo-idugel.svg` e `assets/`. Publique a pasta inteira: os dois HTML, `horizon/`, o selo e `assets/` ficam lado a lado. O build usa caminhos relativos (`base: './'`), então funciona na raiz, em subpasta ou em domínio próprio. Não abrir por `file://`.

O servidor precisa entregar `horizon/andamento.json` como `application/json` e sem cache longo — a página já o pede com `cache: 'no-cache'`, e o `<head>` de `horizon.html` dispara essa leitura antes do JavaScript da aplicação.

**GitHub Pages:** o workflow `.github/workflows/deploy.yml` publica a cada push na `main` e nos ramos `claude/**` (o último push vence). Nada a configurar além disso.

**Desenvolvimento:** `npm run dev` e abrir `http://localhost:5173/horizon.html`. Só em desenvolvimento a página aceita `?hoje=aaaa-mm-dd` para simular outra data (`…/horizon.html?hoje=2026-11-20#fabricacao`); em produção o parâmetro é ignorado. O console de desenvolvimento lista os avisos de `validar()` quando o JSON tem incoerências que não o invalidam.

## 4. Como atualizar o andamento sem rebuild

A página lê `horizon/andamento.json` a cada abertura. Trocar só esse arquivo muda status, datas, passos, fotos e histórico — nenhuma linha de código muda.

**Caminho A — pelo repositório (GitHub Pages):** editar `public/horizon/andamento.json`, fazer commit na `main` e aguardar o deploy (1 a 2 minutos). Fotos novas vão em `public/horizon/fotos/`.

**Caminho B — hospedagem própria:** substituir `horizon/andamento.json` (e, se houver, `horizon/fotos/`) na pasta publicada e invalidar o cache, se o servidor tiver um.

Depois de publicar, abrir a URL e conferir: a etapa e o percentual na linha do tempo, a data de "Atualizado em" no capítulo Atualizações e o texto recém-registrado no histórico. Um arquivo fora da estrutura ou com data fora de `aaaa-mm-dd` é recusado: a página mostra o texto de contato da equipe no lugar das datas até receber um arquivo válido. O passo a passo para quem atualiza está em [PROMPT-ATUALIZAR-ANDAMENTO.txt](PROMPT-ATUALIZAR-ANDAMENTO.txt).

## 5. Regras de conteúdo

1. **Tom afirmativo.** A página informa com segurança. Nenhum texto — visível, `alt`, `aria-label`, `title`, impressão ou campo do JSON (`nome`, `mensagem`, `texto`, `legenda`) — leva *previsto/previsão*, *a confirmar*, *ilustrativo*, *aproximadamente*, *estimado*, *indisponível*, *talvez*, *possivelmente* nem *sem representação* (`TERMOS_RESERVADOS` em `src/horizon/capitulos.ts`; os testes varrem textos e JSON).
2. **Vocabulário dos estados:** "Concluída em dd/mm/aaaa" · "Em andamento · n % · até dd/mm/aaaa" · "Programada · até dd/mm/aaaa" (ou "Programada · a partir de dd/mm/aaaa" quando só o início é público). O texto sai sempre de `etapa.rotulo`/`partesDoRotulo`; nenhuma data é montada à mão e só datas públicas (`datasPublicas`) aparecem.
3. **Sem preços**, custos ou condições comerciais. **Sem nomes de terceiros** (fornecedores de componentes, transportadoras).
4. **Logo oficial** `public/selo-30-anos.png` ("Grupo Idugel — 30 anos"), sem redesenho, recorte ou distorção, na tela e na impressão. O vermelho da marca aparece só no logo e nos acentos de interface já existentes (`--accent`); o progresso usa cromo e branco (trilho `#B9C6CF`, concluído `#FFFFFF`, ativo `#E6F0F6`) — nunca verde ou vermelho para indicar estado.
5. **Português do Brasil**, decimais com vírgula. Datas em ISO (`aaaa-mm-dd`) no JSON; `dd/mm/aaaa` na tela e no papel.
6. **Nenhum recurso externo**: fontes empacotadas (`@fontsource`), sem CDN, rastreadores ou analytics.

## 6. Matriz de aceite (conferir na URL publicada)

| # | Verificação | Esperado |
| --- | --- | --- |
| 1 | Abrir a URL | Página abre com o selo oficial, o título "Dosador Horizon", o modelo 3D e a linha do tempo; **nenhum erro no console** |
| 2 | Rede | Nenhum 404; `horizon/andamento.json` entregue como `application/json`; nenhuma requisição a domínio externo feita pela página |
| 3 | Nove capítulos pelo hash | Abrir `#pedido`, `#engenharia`, `#suprimentos`, `#fabricacao`, `#pintura`, `#montagem`, `#testes`, `#expedicao` e `#atualizacoes` diretamente: cada um chega ao capítulo certo, com o modelo no estado certo; voltar/avançar do navegador funcionam |
| 4 | Teclado | Setas, PageUp/PageDown, Home/End trocam o capítulo; Esc fecha a foto ampliada |
| 5 | Linha do tempo | As 8 etapas com nome curto e as datas do JSON (só as públicas); clique leva ao capítulo |
| 6 | Status coerente com a data de hoje | Etapa em curso entre 1 e 99 % com "até <fim>"; anteriores "Concluída em dd/mm/aaaa"; posteriores "Programada · até <fim>"; nunca duas etapas em andamento; nunca "NaN" nem data vazia |
| 7 | Passos | O capítulo da etapa em andamento mostra os passos com estado (programado / em andamento / concluído) coerente com o percentual; etapa concluída conclui todos; etapa programada deixa todos programados |
| 8 | Modelo 3D | Acompanha o capítulo (fantasma na engenharia, conjuntos chegando na fabricação, cor na pintura, itens entrando na montagem, rosca girando nos testes, engradado na expedição); rotação automática e recentrar funcionam |
| 9 | Trocar só `horizon/andamento.json` | A página muda sem novo build (testar com uma cópia com `ajustes` preenchido e depois restaurar) |
| 10 | JSON fora da regra | Com arquivo ausente ou inválido a página mostra o texto de contato da equipe, sem NaN, sem seção vazia, sem erro no console |
| 11 | Celular 390 × 844 | Sem rolagem horizontal; textos inteiros; todo elemento que recebe toque com área ≥ 44 × 44 px; linha do tempo legível e rolável |
| 12 | Impressão A4 | Botão Imprimir: folha com o selo oficial, "CONTROLE DE PRODUÇÃO", situação em dd/mm/aaaa, captura do 3D, linha do tempo com 8 itens, tabela de etapas e datas, passos da etapa atual, atualizações, contato e rodapé com razão social e CNPJ; sem página em branco; Ctrl+P imprime a mesma folha |
| 13 | Busca por termos reservados | Procurar na página e no JSON por "previs", "a confirmar", "ilustrativ", "aproximad", "estimad", "indisponível", "talvez": nenhuma ocorrência |
| 14 | `?hoje=` | Em produção o parâmetro é ignorado (a página usa a data do navegador); em `npm run dev` simula a data |
| 15 | Atualizações | Capítulo Atualizações lista o histórico da mais recente para a mais antiga; registro ou foto com data futura só aparece a partir da data |
| 16 | Movimento reduzido | Com `prefers-reduced-motion`, sem rotação automática nem peça a meio caminho; todo o conteúdo continua acessível |
| 17 | Logo e cores | Selo oficial sem redesenho na tela e no papel; progresso em cromo/branco; vermelho só no logo e nos acentos de interface |

## 7. Dados a preencher — o arquivo de hoje é um PLANO INICIAL

O `public/horizon/andamento.json` publicado hoje foi montado para pôr a página no ar com a estrutura completa. **Ele é um plano inicial, a ajustar pela equipe de PCP e Engenharia antes de o link seguir ao cliente.** Nada nele é definitivo:

| Campo | Hoje | A fazer |
| --- | --- | --- |
| `projeto.confirmadoEm` | 05/10/2026 | Conferir com a data real da confirmação do pedido |
| `projeto.entregaLimite` | 29/01/2027 | Conferir com a data-limite de entrega acordada (igual ao fim da etapa `expedicao`) |
| `projeto.ordem` | vazio | Número da ordem de produção |
| `projeto.proposta` | vazio | Número da proposta comercial |
| `projeto.cliente` / `projeto.cidade` | vazios (a página não cita cliente) | Nome do cliente e cidade, se a página for compartilhada com ele |
| `projeto.quantidade` | 1 | Quantidade de dosadores do pedido |
| `projeto.modelo` | ausente | Modelo/variante do dosador, se houver |
| `etapas[].inicio` / `fim` | Pedido 05/10/2026 · Engenharia 05/10 → 16/10/2026 · Suprimentos 16/10 → 06/11/2026 · Fabricação 06/11 → 04/12/2026 · Pintura 04/12 → 11/12/2026 · Montagem 11/12/2026 → 08/01/2027 · Testes 08/01 → 15/01/2027 · Expedição 15/01 → 29/01/2027 | Ajustar à ordem e às janelas reais da produção (cada etapa começa quando a anterior termina; datas crescentes) |
| `etapas[].rotulos` | "Início" / "Liberação para produção", "Materiais na fábrica", "Conjuntos prontos", … | Manter ou trocar pelos marcos que a fábrica usa |
| `etapas[].datasPublicas` | ausente (início e fim aparecem) | Omitir uma data interna, se houver, com `["inicio"]` ou `["fim"]` |
| `ajustes` | `{}` (cálculo automático) | Preencher só para sobrepor o cálculo (remarcar, fechar com `realizadoEm`, forçar um passo) |
| `fotos` | `[]` | Fotos da produção em `public/horizon/fotos/` (`horizon/fotos/aaaa-mm-dd-nome.webp`) |
| `atualizacoes` | 1 registro (pedido confirmado) | Uma linha a cada mudança relevante |

Com o plano ajustado: `npm test` (os testes conferem a ordem das etapas, datas crescentes e termos reservados), commit e deploy — ou só a troca do arquivo na hospedagem.

## 8. Capturas de referência

Capturas feitas no build de 07/10/2026 (Chromium, datas simuladas com `?hoje=` em desenvolvimento), em [`capturas/`](capturas/):

| Captura | O que mostra |
| --- | --- |
| [01-pedido](capturas/01-pedido.jpg) | Abertura (1440 × 900): dosador completo, painel do pedido e linha do tempo |
| [04-fabricacao](capturas/04-fabricacao.jpg) | Fabricação a 50 %: conjuntos em aço bruto chegando ao lugar, passos da etapa |
| [06-montagem](capturas/06-montagem.jpg) | Montagem a 61 %: fabricados pintados, itens de montagem entrando |
| [08-expedicao](capturas/08-expedicao.jpg) | Expedição a 36 %: engradado fechando sobre o estrado |
| [09-atualizacoes](capturas/09-atualizacoes.jpg) | Atualizações: resumo, histórico, etapas e contato |
| [celular-fabricacao](capturas/celular-fabricacao.jpg) | Celular 390 × 844: faixa da linha do tempo, palco e folha |
| [impressao-a4](capturas/impressao-a4.jpg) | Folha de impressão A4 com o selo oficial |

## 9. Mapa do código

| O quê | Onde |
| --- | --- |
| Entrada e montagem da página | `horizon.html` → `src/horizon/main.tsx` → `src/horizon/App.tsx` |
| Capítulos, passos, grupos do 3D, termos reservados | `src/horizon/capitulos.ts` |
| Cálculo do cronograma (puro, testado) | `src/horizon/cronograma.ts` |
| Leitura e validação do JSON | `src/horizon/andamento.ts` |
| Dados fixos (equipamento, fornecedor, contato) | `src/horizon/dados.ts` (usa `src/config/branding.ts`) |
| Estado da página (zustand) | `src/horizon/estado.ts` |
| Componentes (barra, painel, linha do tempo, ferramentas, avisos) | `src/horizon/components/` |
| Folha de impressão A4 | `src/horizon/components/FolhaImpressao.tsx` + `src/horizon/impressao.css` |
| Modelo 3D e palco | `src/horizon/three/` (luzes e piso compartilhados em `src/three/stage.tsx`) |
| Dados do andamento | `public/horizon/andamento.json` |
| Logo oficial | `public/selo-30-anos.png` (original em `docs/marca/`) |
