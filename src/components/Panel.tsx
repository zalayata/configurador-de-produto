import { useConfigurator, DEMO_STEPS, IMPORT_STEPS } from '../state/store'
import { ProdutoStep } from './steps/ProdutoStep'
import { AcabamentoStep } from './steps/AcabamentoStep'
import { OpcionaisStep } from './steps/OpcionaisStep'
import { PecasStep } from './steps/PecasStep'
import { ResumoStep } from './steps/ResumoStep'

const HINTS: Record<string, string> = {
  produto: 'Escolha o equipamento demonstrativo ou importe o seu modelo CAD.',
  acabamento: 'Defina o acabamento de cada conjunto — a cena atualiza em tempo real.',
  opcionais: 'Ative os opcionais e veja cada item aparecer no equipamento.',
  pecas: 'Selecione uma peça para trocar a cor ou ocultá-la.',
  resumo: 'Revise, compartilhe e envie sua configuração para a equipe comercial.',
}

export function Panel() {
  const source = useConfigurator((s) => s.source)
  const step = useConfigurator((s) => s.step)
  const next = useConfigurator((s) => s.next)
  const prev = useConfigurator((s) => s.prev)

  const steps = source === 'demo' ? DEMO_STEPS : IMPORT_STEPS
  const clamped = Math.min(step, steps.length - 1)
  const stepDef = steps[clamped]

  return (
    <aside className="panel" aria-label="Painel de configuração">
      <header className="panel-head">
        <div className="panel-step-count">
          Etapa {clamped + 1} de {steps.length}
        </div>
        <h1 className="panel-title">{stepDef.label}</h1>
        <p className="panel-hint">{HINTS[stepDef.id]}</p>
      </header>

      <div className="panel-scroll" key={stepDef.id}>
        {stepDef.id === 'produto' && <ProdutoStep />}
        {stepDef.id === 'acabamento' && <AcabamentoStep />}
        {stepDef.id === 'opcionais' && <OpcionaisStep />}
        {stepDef.id === 'pecas' && <PecasStep />}
        {stepDef.id === 'resumo' && <ResumoStep />}
      </div>

      <footer className="panel-foot">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={prev}
          disabled={clamped === 0}
        >
          ← Voltar
        </button>
        {clamped < steps.length - 1 && (
          <button type="button" className="btn btn-primary" onClick={next}>
            Avançar →
          </button>
        )}
      </footer>
    </aside>
  )
}
