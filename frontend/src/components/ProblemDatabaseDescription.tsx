import type { DatabaseRelationDescription } from "../data/models";
import { useLanguage } from "../context/LanguageContext";
import "../styles/database-description.css";

export function ProblemDatabaseDescription({ rows = [], visible = true }: { rows?: DatabaseRelationDescription[]; visible?: boolean }) {
  const { t: tr } = useLanguage("teacher");
  const content = rows.filter(row => row.tableName.trim() || row.attributes.trim() || row.predicate.trim());
  if (!visible || !content.length) return null;
  return <section className="problem-database-description" aria-label={tr("Database description")}>
    {content.map((row, index) => <div className="problem-database-relation" key={index}>
      {(row.tableName || row.attributes) && <p><strong>{row.tableName}</strong>{row.attributes && <> ({row.attributes})</>}</p>}
      {row.predicate && <p><em>{tr("Predicate")}: </em>{row.predicate}</p>}
    </div>)}
  </section>;
}
