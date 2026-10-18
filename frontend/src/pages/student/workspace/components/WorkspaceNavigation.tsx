import { TranslatedText } from "../../../../components/TranslatedText";
import { useLanguage } from "../../../../context/LanguageContext";
import type { WorkspacePart } from "../../../../data/models";
import { WORKSPACE_PART_DETAILS } from "../../../../utils/workspaceParts";

export function WorkspaceNavigation({ parts, active, onChange, lockedParts = [] }: {
  lockedParts?: WorkspacePart[]; parts: WorkspacePart[]; active: WorkspacePart; onChange: (part: WorkspacePart) => void;
}) {
  const { t: tr } = useLanguage("workspace");
  return <nav className="problem-workspace-tabs" aria-label={tr("Practice sections")}>
    {parts.map((part, index) => <button key={part} type="button" disabled={lockedParts.includes(part)} title={lockedParts.includes(part) ? tr("Confirm DDL before continuing.") : undefined} aria-current={active === part ? "page" : undefined} className={active === part ? "active" : ""} onClick={() => onChange(part)} aria-controls={`workspace-stage-${part}`}>
      <span>{index + 1}</span><b>{part}</b><small><TranslatedText>{tr(WORKSPACE_PART_DETAILS[part].title)}</TranslatedText></small>
    </button>)}
  </nav>;
}
