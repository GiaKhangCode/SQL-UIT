import { TranslatedText } from "../../../../components/TranslatedText";
import { useLanguage } from "../../../../context/LanguageContext";
import type { Problem } from "../../../../data/models";

export function WorkspaceSolutionSwitcher({ solutions = [], selectedId, onChange, disabled = false }: {
  solutions?: Problem["sqlChecks"]; selectedId?: string; onChange: (id: string) => void; disabled?: boolean;
}) {
  const { t: tr } = useLanguage("workspace");
  if (!solutions.length) return null;
  const index = Math.max(0, solutions.findIndex(solution => solution.id === selectedId));
  return <label className="workspace-problem-switcher workspace-solution-switcher">
    <span><TranslatedText>{tr("Solution")}</TranslatedText> {String(index + 1).padStart(2, "0")} / {String(solutions.length).padStart(2, "0")}</span>
    <select value={solutions[index].id} aria-label={tr("Switch solution")} disabled={disabled || solutions.length < 2} onChange={event => onChange(event.target.value)}>
      {solutions.map((solution, number) => <option key={solution.id} value={solution.id}>{String(number + 1).padStart(2, "0")} · {solution.name}</option>)}
    </select>
  </label>;
}
