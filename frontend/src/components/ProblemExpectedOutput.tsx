import type { DataTable, ExpectedOutputSample } from "../data/models";
import { useLanguage } from "../context/LanguageContext";
import { TranslatedText } from "./TranslatedText";

export function ProblemExpectedOutput({ table, samples, className = "" }: {
  table?: DataTable; samples?: ExpectedOutputSample[]; className?: string;
}) {
  const { t: tr } = useLanguage("common");
  const outputs = samples?.length ? samples : table ? [{ dataset: 0, table }] : [];
  if (!outputs.length) return null;
  return <section className={`problem-expected-output ${className}`}>
    <h3><TranslatedText>{tr("Expected output")}</TranslatedText></h3>
    {outputs.map(({ dataset, table: output }) => <div className="problem-expected-sample" key={dataset}>
      {dataset > 0 && <h4><TranslatedText>{tr("Dataset {value0}", { value0: dataset })}</TranslatedText></h4>}
      <div className="table-scroll" tabIndex={0} aria-label={tr("Expected output")}>
        <table className="data-table">
          <thead><tr>{output.columns.map((column, index) => <th key={index}>{column}</th>)}</tr></thead>
          <tbody>{output.rows.length ? output.rows.map((row, rowIndex) => <tr key={rowIndex}>
            {row.map((value, columnIndex) => <td key={columnIndex}>{String(value ?? "NULL")}</td>)}
          </tr>) : <tr><td colSpan={Math.max(1, output.columns.length)}><TranslatedText>{tr("No rows returned.")}</TranslatedText></td></tr>}</tbody>
        </table>
      </div>
    </div>)}
    <p className="tiny muted"><TranslatedText>{tr("Output shown for the sample dataset.")}</TranslatedText></p>
  </section>;
}
