// Consistência do catálogo: cada grupo configurável existe no manifesto, cada acabamento padrão
// existe na lista de acabamentos, e os manifestos batem com os GLB publicados.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ler = (p) => JSON.parse(readFileSync(resolve(raiz, p), 'utf8'))
const fonteProdutos = readFileSync(resolve(raiz, 'src/catalog/products.js'), 'utf8')
const fonteAcabamentos = readFileSync(resolve(raiz, 'src/config/acabamentos.js'), 'utf8')
const idsAcabamento = [...fonteAcabamentos.matchAll(/\{ id: '([^']+)'/g)].map((m) => m[1])

const manifestos = readdirSync(resolve(raiz, 'src/catalog/modelos'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => ler(`src/catalog/modelos/${f}`))

test('há pelo menos um manifesto e cada um tem grupos, dimensões e proveniência', () => {
  assert.ok(manifestos.length >= 1)
  for (const m of manifestos) {
    assert.ok(m.id && m.nome && m.arquivo, `manifesto sem id/nome/arquivo: ${JSON.stringify(m).slice(0, 80)}`)
    assert.ok(Array.isArray(m.grupos) && m.grupos.length > 0, `${m.id}: sem grupos`)
    assert.ok(m.dimensoesMm.comprimento > 0 && m.dimensoesMm.altura > 0 && m.dimensoesMm.profundidade > 0)
    assert.match(m.origem.sha256, /^[0-9a-f]{64}$/)
    assert.match(m.glbSha256, /^[0-9a-f]{64}$/)
    const ids = m.grupos.map((g) => g.id)
    assert.equal(new Set(ids).size, ids.length, `${m.id}: grupo repetido`)
    for (const g of m.grupos) {
      assert.ok(g.rotulo && g.rotulo.trim(), `${m.id}/${g.id}: sem rótulo`)
      assert.equal(g.ancora.length, 3)
    }
  }
})

test('o GLB publicado é o mesmo do manifesto (hash e tamanho)', () => {
  for (const m of manifestos) {
    const glb = readFileSync(resolve(raiz, 'public/models', m.arquivo))
    assert.equal(glb.length, m.bytes, `${m.id}: tamanho do GLB difere do manifesto`)
    assert.equal(createHash('sha256').update(glb).digest('hex'), m.glbSha256, `${m.id}: hash do GLB difere do manifesto`)
  }
})

test('grupos configuráveis de products.js existem no manifesto e usam acabamentos conhecidos', () => {
  // leitura textual do módulo (sem importar JSON por ESM, para o teste rodar em qualquer Node)
  const blocos = [...fonteProdutos.matchAll(/id: '([a-z0-9-]+)',[\s\S]*?manifesto: (\w+),[\s\S]*?grupos: \{([\s\S]*?)\n    \},/g)]
  assert.ok(blocos.length >= 2, 'esperava ao menos dois produtos no catálogo')
  for (const [, id, , grupos] of blocos) {
    const manifesto = manifestos.find((m) => m.id === id)
    assert.ok(manifesto, `${id}: manifesto não encontrado em src/catalog/modelos`)
    const idsManifesto = new Set(manifesto.grupos.map((g) => g.id))
    for (const [, grupo, acabamento] of grupos.matchAll(/'?([a-z-]+)'?: \{ acabamento: '([^']+)' \}/g)) {
      assert.ok(idsManifesto.has(grupo), `${id}: grupo "${grupo}" não existe no manifesto`)
      assert.ok(idsAcabamento.includes(acabamento), `${id}/${grupo}: acabamento "${acabamento}" desconhecido`)
    }
  }
})

test('nenhum rótulo público cita fabricante terceiro ou traz texto do CAD', () => {
  const proibidos = [/\bWEG\b/i, /W20/, /[一-鿿]/, /Valor predeterminado/i, /solid\d/i]
  for (const m of manifestos) {
    for (const g of m.grupos) {
      for (const re of proibidos) {
        assert.doesNotMatch(`${g.rotulo} ${g.descricao}`, re, `${m.id}/${g.id}: rótulo público com texto do CAD`)
      }
    }
  }
  for (const re of proibidos) assert.doesNotMatch(fonteProdutos, re, 'products.js cita fabricante terceiro ou texto do CAD')
})
