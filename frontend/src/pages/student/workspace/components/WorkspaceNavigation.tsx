import { TranslatedText } from "../../../../components/TranslatedText";
import { useLanguage } from "../../../../context/LanguageContext";
import type { WorkspacePart } from "../../../../data/models";

import { WORKSPACE_PART_LABELS } from "../../../../utils/workspaceParts";

export function WorkspaceNavigation({ parts, active, onChange }: {
  parts: WorkspacePart[]; active: WorkspacePart; onChange: (part: WorkspacePart) => void;
}) {
  const { t: tr } = useLanguage("workspace");
  return <nav className="problem-workspace-tabs" aria-label={tr("Practice sections")}>
    {parts.map(part => <button key={part} type="button" aria-current={active === part ? "page" : undefined} className={active === part ? "active" : ""} onClick={() => onChange(part)} aria-controls={`workspace-stage-${part}`}>
      <b><TranslatedText>{tr(WORKSPACE_PART_LABELS[part])}</TranslatedText></b>
    </button>)}
  </nav>;
}
