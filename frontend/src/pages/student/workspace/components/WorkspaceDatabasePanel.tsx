import type { DataTable } from "../../../../data/models";
import type { QueryResult } from "../../../../services/studentApi";
import type { SchemaTable } from "../../../../utils/parseDatabaseSchema";
import { DataGrid } from "../../../../components/ui";
import { TranslatedText } from "../../../../components/TranslatedText";
import { useLanguage } from "../../../../context/LanguageContext";
import { DatabaseDiagram } from "../../../../components/DatabaseDiagram";
import { SqlErrorMessage } from "./SqlErrorMessage";

export type WorkspaceDatabaseState = {
  schemaTables: SchemaTable[];
  tables: DataTable[];
  stale?: boolean;
};

export function ExecutionFeedback({ result, error }: { result?: QueryResult | null; error?: string }) {
  if (!error && result?.status !== "Error") return null;
  return <div className="workspace-execution-feedback is-error" role="alert">
    <SqlErrorMessage message={error || result?.message || result?.status || ""} />
  </div>;
}

export function WorkspaceDatabasePanel({ database, result, error }: {
  database: WorkspaceDatabaseState; result?: QueryResult | null; error?: string;
}) {
  const { t: tr } = useLanguage("workspace");
  return <div className="workspace-database-content">
    <ExecutionFeedback result={result} error={error} />
    {database.stale && <p className="muted tiny"><TranslatedText>{tr("Showing the last successful run. Run your updated script to refresh the database.")}</TranslatedText></p>}
    {database.schemaTables.length ? <DatabaseDiagram tables={database.schemaTables} allowDownload={false} /> : <p className="muted"><TranslatedText>{tr("Run DDL successfully to view your database diagram.")}</TranslatedText></p>}
    <section className="workspace-database-data">
      <h3><TranslatedText>{tr("Table data")}</TranslatedText></h3>
      {database.tables.length ? database.tables.map((table, index) => <section className="workspace-database-table" key={`${table.name}-${index}`}>
        <header><strong>{table.name}</strong><small>{table.rows.length} <TranslatedText>{tr("rows")}</TranslatedText></small></header>
        <DataGrid table={table} />
      </section>) : <p className="muted tiny"><TranslatedText>{tr("Run DML to view table data below the diagram.")}</TranslatedText></p>}
    </section>
  </div>;
}
