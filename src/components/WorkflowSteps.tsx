import { Check, ChevronRight } from 'lucide-react';

export default function WorkflowSteps({ steps, current, onChange, canVisit }: { steps: { title: string; description: string }[]; current: number; onChange: (step: number) => void; canVisit: (step: number) => boolean }) {
  return <nav className="workflow-steps" aria-label="Etapas de criação">{steps.map((step, index) => <button key={step.title} type="button" className={`workflow-step ${index === current ? 'is-active' : ''} ${index < current ? 'is-complete' : ''}`} aria-current={index === current ? 'step' : undefined} disabled={!canVisit(index)} onClick={() => onChange(index)}><span className="workflow-number">{index < current ? <Check size={16}/> : String(index + 1).padStart(2, '0')}</span><span className="workflow-copy"><strong>{step.title}</strong><small>{step.description}</small></span>{index < steps.length - 1 && <ChevronRight size={16} className="workflow-chevron"/>}</button>)}</nav>;
}
