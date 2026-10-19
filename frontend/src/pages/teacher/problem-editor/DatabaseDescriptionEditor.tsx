import { useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { DatabaseRelationDescription } from "../../../data/models";
import { useLanguage } from "../../../context/LanguageContext";
import "../../../styles/database-description.css";

export function DatabaseDescriptionEditor({ rows, onChange }: {
  rows: DatabaseRelationDescription[];
  onChange: (rows: DatabaseRelationDescription[]) => void;
}) {
  const { t: tr } = useLanguage("teacher");
  const [expanded, setExpanded] = useState(true);
  const displayedRows = rows.length ? rows : [{ tableName: "", attributes: "", predicate: "" }];
  const updateRow = (index: number, field: keyof DatabaseRelationDescription, value: string) =>
    onChange(displayedRows.map((row, i) => i === index ? { ...row, [field]: value } : row));
  return <section className="database-description-editor">
    <header className="database-description-heading">
      <button type="button" className="database-description-collapse" aria-expanded={expanded} aria-controls="database-description-fields" onClick={() => setExpanded(!expanded)}>
        <ChevronDown size={18} className={expanded ? "is-expanded" : ""} aria-hidden="true" />
        <strong>{tr("Database description")}</strong>
      </button>
    </header>
    <div id="database-description-fields" className={`database-description-fold${expanded ? " is-expanded" : ""}`} ref={element => { if (element) element.inert = !expanded; }}>
      <div className="database-description-fold-inner"><div className="database-description-fields">
        {displayedRows.map((row, index) => <fieldset className="database-description-row" key={index}>
          <legend>{tr("Table")} {index + 1}</legend>
          <div className="database-description-row-actions"><button type="button" className="icon-button" aria-label={`${tr("Remove table")} ${index + 1}`} onClick={() => onChange(displayedRows.filter((_, i) => i !== index))}><Trash2 size={15} /></button></div>
          <div className="database-description-inputs">
            <label>{tr("Table name")}<input value={row.tableName} maxLength={255} placeholder="KHACHHANG" onChange={event => updateRow(index, "tableName", event.target.value)} /></label>
            <label>{tr("Attributes")}<textarea rows={2} value={row.attributes} maxLength={10000} placeholder="MAKH, HOTEN, DCHI, SODT" onChange={event => updateRow(index, "attributes", event.target.value)} /></label>
          </div>
          <label>{tr("Predicate")}<textarea rows={3} value={row.predicate} maxLength={20000} placeholder={tr("Describe the meaning of this table and its attributes.")} onChange={event => updateRow(index, "predicate", event.target.value)} /></label>
        </fieldset>)}
        <button type="button" className="button teacher-small-button" disabled={displayedRows.length >= 100} onClick={() => onChange([...displayedRows, { tableName: "", attributes: "", predicate: "" }])}><Plus size={15} aria-hidden="true" />{tr("Add table description")}</button>
      </div></div>
    </div>
  </section>;
}
