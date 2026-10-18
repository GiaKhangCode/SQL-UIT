import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { Database, Play, Plus, Save, Table2, Trash2, Upload } from "lucide-react";
import { TranslatedText } from "../../components/TranslatedText";
import { useLanguage } from "../../context/LanguageContext";
import { TeacherField } from "./TeacherPageParts";
import { teacherService, type TeacherDatabaseLibraryDataset, type TeacherDatabaseLibraryEntry, type TeacherDatabaseLibraryEntryInput } from "../../services/teacherService";
import { ProblemSqlEditor } from "./problem-editor/ProblemSqlEditor";
import { DatabaseLibrarySqlImportError, parseDatabaseLibrarySql, sqlFileBaseName } from "../../utils/databaseLibraryImport";
import { parseDatabaseSchema } from "../../utils/parseDatabaseSchema";
import { parseSeedData } from "../../utils/parseSeedData";
import { TeacherSchemaDiagram } from "./problem-editor/TeacherSchemaDiagram";
import "../../styles/problem-workspace.css";
import "../../styles/database-library.css";

const blankEntry: TeacherDatabaseLibraryEntryInput = {
  title: "",
  createTableFileName: "database_createtable.sql",
  createTableSql: "",
  datasets: [{ fileName: "database_insertdata.sql", sql: "" }],
};

function scriptFileNames(title: string) {
  const base = title.toLowerCase().replace(/đ/g, "d").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "") || "database";
  return {
    createTableFileName: `${base}_createtable.sql`,
  };
}

function datasetFileNameForTitle(title: string, index: number) {
  const base = title.toLowerCase().replace(/đ/g, "d").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "") || "database";
  return index === 0 ? `${base}_insertdata.sql` : `${base}_dataset_${index + 1}.sql`;
}

function fileBaseName(value?: string | null) {
  return (value || "").replace(/\.sql$/i, "");
}

function fileNameFromEntry(entry: TeacherDatabaseLibraryEntry) {
  const defaults = scriptFileNames(entry.title);
  return {
    createTableFileName: entry.createTableFileName || defaults.createTableFileName,
  };
}

function datasetsFromEntry(entry: TeacherDatabaseLibraryEntry): TeacherDatabaseLibraryDataset[] {
  if (Array.isArray(entry.datasets) && entry.datasets.length) {
    return entry.datasets.map((dataset, index) => ({
      fileName: dataset.fileName || (index === 0 ? entry.insertIntoFileName : undefined) || datasetFileNameForTitle(entry.title, index),
      sql: dataset.sql || "",
    }));
  }
  return [{
    fileName: entry.insertIntoFileName || datasetFileNameForTitle(entry.title, 0),
    sql: entry.insertIntoSql || "",
  }];
}

function SqlFileNameField({ label, value, onChange, compact = false }: { label: string; value: string; onChange: (value: string) => void; compact?: boolean }) {
  return (
    <label className={`teacher-database-library-file-field${compact ? " is-compact" : ""}`}>
      <span>{label}</span>
      <span className="teacher-database-library-file-control">
        <input aria-label={label} value={fileBaseName(value)} onChange={(event) => {
          const base = event.target.value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").replace(/[. ]+$/g, "");
          onChange(base ? `${base}.sql` : "");
        }} />
        <span>.sql</span>
      </span>
    </label>
  );
}

function DatasetDataPreview({ datasetNumber, seedData }: { datasetNumber: number; seedData: string }) {
  const { t: tr } = useLanguage("teacher");
  const tables = parseSeedData(seedData);
  const rowCount = tables.reduce((total, table) => total + table.rows.length, 0);

  return (
    <section className="teacher-database-library-preview" aria-label={tr("Dataset {value0} preview", { value0: datasetNumber })} aria-live="polite">
      <div className="teacher-database-library-preview-heading">
        <div className="teacher-database-library-preview-title"><Table2 size={14} aria-hidden="true" /><strong><TranslatedText>{tr("Dataset {value0} preview", { value0: datasetNumber })}</TranslatedText></strong></div>
        {tables.length > 0 && <span><TranslatedText>{tr("{value0} tables · {value1} rows", { value0: tables.length, value1: rowCount })}</TranslatedText></span>}
      </div>
      {tables.length > 0 ? (
        <div className="teacher-database-library-preview-tables">
          {tables.map((table, tableIndex) => (
            <section className="teacher-database-library-preview-table" key={`${table.name}-${tableIndex}`}>
              <div className="teacher-database-library-preview-table-heading"><strong>{table.name}</strong><span><TranslatedText>{tr("{value0} rows", { value0: table.rows.length })}</TranslatedText></span></div>
              <div className="teacher-database-library-preview-scroll">
                <table>
                  <thead><tr>{table.columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead>
                  <tbody>{table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, columnIndex) => <td key={`${table.columns[columnIndex]}-${columnIndex}`}>{value}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="teacher-database-library-preview-empty"><TranslatedText>{tr("No INSERT rows to preview in this dataset.")}</TranslatedText></p>
      )}
    </section>
  );
}

function SqlScriptEditor({ label, value, placeholder, onChange }: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <ProblemSqlEditor
      className="teacher-database-library-editor"
      label={label}
      value={value}
      placeholder={placeholder}
      onChange={onChange}
    />
  );
}

export function DatabaseLibraryPage() {
  const { t: tr } = useLanguage("teacher");
  const [entries, setEntries] = useState<TeacherDatabaseLibraryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<TeacherDatabaseLibraryEntryInput>(blankEntry);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [schemaDiagram, setSchemaDiagram] = useState<{ source: string; tables: ReturnType<typeof parseDatabaseSchema> } | null>(null);
  const [importStatus, setImportStatus] = useState("");
  const [importError, setImportError] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewDatasetIndex, setPreviewDatasetIndex] = useState<number | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    teacherService.getDatabaseLibrary().then((data) => {
      if (active) setEntries(data);
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : tr("Could not load database library."));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [tr]);

  function startNewEntry() {
    setSelectedId(null);
    setForm({ ...blankEntry, datasets: blankEntry.datasets.map((dataset) => ({ ...dataset })) });
    setSaveStatus("");
    setSaveError("");
    setImportStatus("");
    setImportError("");
    setPreviewDatasetIndex(null);
    setSchemaDiagram(null);
  }

  function selectEntry(entry: TeacherDatabaseLibraryEntry) {
    setSelectedId(entry.id);
    setForm({
      title: entry.title,
      ...fileNameFromEntry(entry),
      createTableSql: entry.createTableSql || "",
      datasets: datasetsFromEntry(entry),
    });
    setSaveStatus("");
    setSaveError("");
    setImportStatus("");
    setImportError("");
    setPreviewDatasetIndex(null);
    setSchemaDiagram(null);
  }

  function updateForm<K extends keyof TeacherDatabaseLibraryEntryInput>(key: K, value: TeacherDatabaseLibraryEntryInput[K]) {
    setForm((current) => {
      if (key !== "title") return { ...current, [key]: value };
      const nextTitle = String(value);
      const previousDefaults = scriptFileNames(current.title);
      const nextDefaults = scriptFileNames(nextTitle);
      const datasets = current.datasets.map((dataset, index) => ({
        ...dataset,
        fileName: dataset.fileName === datasetFileNameForTitle(current.title, index)
          ? datasetFileNameForTitle(nextTitle, index)
          : dataset.fileName,
      }));
      return {
        ...current,
        title: nextTitle,
        createTableFileName: current.createTableFileName === previousDefaults.createTableFileName ? nextDefaults.createTableFileName : current.createTableFileName,
        datasets,
      };
    });
    setSaveStatus(tr("Unsaved changes"));
    setSaveError("");
    setImportStatus("");
    setImportError("");
  }

  function updateDataset(index: number, patch: Partial<TeacherDatabaseLibraryDataset>) {
    setForm((current) => ({
      ...current,
      datasets: current.datasets.map((dataset, datasetIndex) => datasetIndex === index ? { ...dataset, ...patch } : dataset),
    }));
    setSaveStatus(tr("Unsaved changes"));
    setSaveError("");
    setImportStatus("");
    setImportError("");
  }

  function runCreateTableDdl() {
    setSchemaDiagram({ source: form.createTableSql, tables: parseDatabaseSchema(form.createTableSql) });
  }

  function addDataset() {
    let index = form.datasets.length;
    let fileName = datasetFileNameForTitle(form.title, index);
    while (form.datasets.some((dataset) => dataset.fileName.toLowerCase() === fileName.toLowerCase())) {
      index += 1;
      fileName = datasetFileNameForTitle(form.title, index);
    }
    setForm((current) => ({ ...current, datasets: [...current.datasets, { fileName, sql: "" }] }));
    setSaveStatus(tr("Unsaved changes"));
    setSaveError("");
    setImportStatus("");
    setImportError("");
  }

  function removeDataset(index: number) {
    if (index === 0) return;
    if (form.datasets[index]?.sql.trim() && !window.confirm(tr("Dataset {value0} contains SQL data. Delete it?", { value0: index + 1 }))) return;
    setPreviewDatasetIndex((current) => current === index ? null : current !== null && current > index ? current - 1 : current);
    setForm((current) => ({ ...current, datasets: current.datasets.filter((_, datasetIndex) => datasetIndex !== index) }));
    setSaveStatus(tr("Unsaved changes"));
    setSaveError("");
    setImportStatus("");
    setImportError("");
  }

  async function importSqlFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setImportStatus("");
    setImportError("");
    if (!/\.sql$/i.test(file.name)) {
      setImportError(tr("Choose a .sql file to import."));
      return;
    }

    try {
      const imported = parseDatabaseLibrarySql(await file.text());
      if ((form.createTableSql.trim() || form.datasets.some((dataset) => dataset.sql.trim())) && !window.confirm(tr("Importing a file replaces both scripts. Continue?"))) return;
      const baseName = sqlFileBaseName(file.name);
      const displayName = file.name.replace(/\.sql$/i, "").replace(/[_-]+/g, " ").trim();
      setForm((current) => ({
        ...current,
        title: current.title.trim() ? current.title : displayName || tr("Imported database"),
        createTableFileName: `${baseName}_createtable.sql`,
        createTableSql: imported.createTableSql,
        datasets: [{ fileName: `${baseName}_dataset.sql`, sql: imported.insertIntoSql }],
      }));
      setSaveStatus(tr("Unsaved changes"));
      setSaveError("");
      setImportStatus(tr("Imported {value0} CREATE TABLE and {value1} INSERT INTO statements from {value2}.", {
        value0: imported.createTableCount,
        value1: imported.insertIntoCount,
        value2: file.name,
      }));
    } catch (error) {
      if (error instanceof DatabaseLibrarySqlImportError) {
        if (error.kind === "empty") setImportError(tr("The SQL file is empty."));
        else if (error.kind === "no-supported-statements") setImportError(tr("No CREATE TABLE or INSERT INTO statements were found."));
        else setImportError(tr("Only CREATE TABLE and INSERT INTO statements are allowed. Found: {value0}.", { value0: error.command }));
      } else {
        setImportError(error instanceof Error ? error.message : tr("Could not read this SQL file."));
      }
    }
  }

  async function saveEntry() {
    if (!form.title.trim()) {
      setSaveError(tr("Give this database a name before saving."));
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const saved = selectedId
        ? await teacherService.updateDatabaseLibraryEntry(selectedId, form)
        : await teacherService.createDatabaseLibraryEntry(form);
      setEntries((current) => [saved, ...current.filter((entry) => entry.id !== saved.id)]);
      setSelectedId(saved.id);
      setForm({ title: saved.title, ...fileNameFromEntry(saved), createTableSql: saved.createTableSql, datasets: datasetsFromEntry(saved) });
      setSaveStatus(tr("All changes saved"));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : tr("Could not save database library entry."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry() {
    if (!selectedId || !window.confirm(tr("Delete this database library entry?"))) return;
    setSaving(true);
    setSaveError("");
    try {
      await teacherService.deleteDatabaseLibraryEntry(selectedId);
      setEntries((current) => current.filter((entry) => entry.id !== selectedId));
      startNewEntry();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : tr("Could not delete database library entry."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section className="teacher-page teacher-database-library-page"><p role="status"><TranslatedText>{tr("Loading database library…")}</TranslatedText></p></section>;
  if (loadError) return <section className="teacher-page teacher-database-library-page"><div className="teacher-database-library-error" role="alert"><TranslatedText>{tr("Could not load database library.")}</TranslatedText><button className="button" type="button" onClick={() => window.location.reload()}><TranslatedText>{tr("Try again")}</TranslatedText></button></div></section>;

  return (
    <section className="teacher-page teacher-database-library-page">
      <div className="teacher-database-library-layout">
        <aside className="teacher-database-library-sidebar">
          <div className="teacher-database-library-sidebar-heading">
            <div className="teacher-database-library-sidebar-title"><Database size={17} aria-hidden="true" /><h1><TranslatedText>{tr("Database library")}</TranslatedText></h1></div>
            <p><TranslatedText>{tr("{value0} saved databases", { value0: entries.length })}</TranslatedText></p>
          </div>
          <button className="button primary teacher-database-library-new" type="button" onClick={startNewEntry}><Plus size={15} aria-hidden="true" /><TranslatedText>{tr("New database")}</TranslatedText></button>
          <nav className="teacher-database-library-list" aria-label={tr("Saved databases")}>
            {entries.map((entry) => (
              <button key={entry.id} type="button" className={`teacher-database-library-item${selectedId === entry.id ? " is-active" : ""}`} onClick={() => selectEntry(entry)}>
                <strong>{entry.title}</strong>
                <span><code>CREATE TABLE · INSERT INTO</code></span>
              </button>
            ))}
            {!entries.length && <p className="teacher-database-library-empty"><TranslatedText>{tr("Your saved database scripts will appear here.")}</TranslatedText></p>}
          </nav>
          <Link className="button teacher-database-library-back" to="/teacher/problems"><TranslatedText>{tr("Back to Problems")}</TranslatedText></Link>
        </aside>

        <main className="teacher-database-library-main">
          <section className="teacher-database-library-card">
            <div className="teacher-database-library-section-heading">
              <h3><TranslatedText>{tr("Database details")}</TranslatedText></h3>
              {saveStatus && <span className={`teacher-database-library-save-status${saveStatus === tr("Unsaved changes") ? " is-unsaved" : ""}`}><TranslatedText>{saveStatus}</TranslatedText></span>}
            </div>
            <div className="teacher-database-library-identity-fields">
              <TeacherField label={tr("Database name")}>
                <input value={form.title} maxLength={255} placeholder={tr("e.g. Sales database")} onChange={(event) => updateForm("title", event.target.value)} />
              </TeacherField>
              <div className="teacher-database-library-import-control">
                <input ref={importInputRef} className="teacher-database-library-import-input" type="file" accept=".sql,application/sql,text/plain" aria-label={tr("Import SQL file")} onChange={(event) => void importSqlFile(event)} />
                <button className="button teacher-database-library-import-button" type="button" onClick={() => importInputRef.current?.click()}>
                  <Upload size={14} aria-hidden="true" />
                  <TranslatedText>{tr("Import SQL file")}</TranslatedText>
                </button>
                <small><TranslatedText>{tr("CREATE TABLE + INSERT INTO only")}</TranslatedText></small>
              </div>
            </div>

            {importError && <p className="teacher-database-library-error" role="alert"><TranslatedText>{importError}</TranslatedText></p>}
            {importStatus && <p className="teacher-database-library-import-status" role="status"><TranslatedText>{importStatus}</TranslatedText></p>}

            <div className="teacher-database-library-script-section">
              <div className="teacher-database-library-section-heading">
                <h3><TranslatedText>{tr("Create table script")}</TranslatedText> <code>CREATE TABLE</code></h3>
                <SqlFileNameField label={tr("Table file name")} value={form.createTableFileName} onChange={(value) => updateForm("createTableFileName", value)} />
              </div>
              <SqlScriptEditor
                label={tr("Create table script")}
                value={form.createTableSql}
                placeholder={tr("Write CREATE TABLE statements…")}
                onChange={(value) => updateForm("createTableSql", value)}
              />
              <div className="teacher-schema-run-row">
                <p><TranslatedText>{tr("Preview tables, keys, and relationships from this database script.")}</TranslatedText></p>
                <button className="button primary" type="button" onClick={runCreateTableDdl} disabled={!form.createTableSql.trim()}>
                  <Play size={14} aria-hidden="true" />
                  <TranslatedText>{tr("Run DDL")}</TranslatedText>
                </button>
              </div>
              <div className="teacher-schema-diagram-result" aria-live="polite">
                {!schemaDiagram && <p className="teacher-schema-diagram-message"><TranslatedText>{tr("Run DDL to preview tables and key relationships.")}</TranslatedText></p>}
                {schemaDiagram && schemaDiagram.source !== form.createTableSql && <p className="teacher-schema-diagram-message is-stale"><TranslatedText>{tr("Database structure changed since the last preview. Run DDL to refresh the diagram.")}</TranslatedText></p>}
                {schemaDiagram?.source === form.createTableSql && schemaDiagram.tables.length === 0 && <p className="teacher-schema-diagram-message is-error"><TranslatedText>{tr("No CREATE TABLE statements found. Add at least one table, then run DDL again.")}</TranslatedText></p>}
                {schemaDiagram?.source === form.createTableSql && schemaDiagram.tables.length > 0 && <TeacherSchemaDiagram tables={schemaDiagram.tables} />}
              </div>
            </div>

            <div className="teacher-database-library-script-section">
              <div className="teacher-database-library-section-heading teacher-database-library-dataset-section-title">
                <h3><TranslatedText>{tr("Insert data script")}</TranslatedText> <code>INSERT INTO</code></h3>
              </div>
              <div className="teacher-database-library-datasets">
                {form.datasets.map((dataset, index) => (
                  <div className="teacher-database-library-dataset" key={index}>
                    <div className="teacher-database-library-dataset-heading">
                      <div className="teacher-database-library-dataset-identity">
                        <strong><TranslatedText>{tr("Dataset {value0}", { value0: index + 1 })}</TranslatedText></strong>
                        <SqlFileNameField compact label={tr("Dataset file name")} value={dataset.fileName} onChange={(value) => updateDataset(index, { fileName: value })} />
                      </div>
                      <div className="teacher-database-library-dataset-actions">
                        <button className={`button teacher-database-library-preview-toggle${previewDatasetIndex === index ? " is-active" : ""}`} type="button" aria-expanded={previewDatasetIndex === index} onClick={() => setPreviewDatasetIndex((current) => current === index ? null : index)}>
                          <Table2 size={13} aria-hidden="true" />
                          <TranslatedText>{tr(previewDatasetIndex === index ? "Hide preview" : "Preview data")}</TranslatedText>
                        </button>
                        {index === 0 && <button className="button teacher-database-library-add-dataset" type="button" onClick={addDataset}><Plus size={13} aria-hidden="true" /><TranslatedText>{tr("Add dataset")}</TranslatedText></button>}
                        {index > 0 && <button className="button teacher-database-library-remove-dataset" type="button" aria-label={tr("Delete dataset {value0}", { value0: index + 1 })} onClick={() => removeDataset(index)}><Trash2 size={13} aria-hidden="true" /><TranslatedText>{tr("Delete")}</TranslatedText></button>}
                      </div>
                    </div>
                    <SqlScriptEditor
                      label={tr("Dataset {value0} SQL", { value0: index + 1 })}
                      value={dataset.sql}
                      placeholder={tr("Write INSERT INTO statements…")}
                      onChange={(value) => updateDataset(index, { sql: value })}
                    />
                    {previewDatasetIndex === index && <DatasetDataPreview datasetNumber={index + 1} seedData={dataset.sql} />}
                  </div>
                ))}
              </div>
            </div>

            {saveError && <p className="teacher-database-library-error" role="alert"><TranslatedText>{saveError}</TranslatedText></p>}
            <div className="teacher-database-library-actions">
              {selectedId && <button className="button teacher-danger-button" type="button" disabled={saving} onClick={() => void deleteEntry()}><Trash2 size={14} aria-hidden="true" /><TranslatedText>{tr("Delete")}</TranslatedText></button>}
              <button className="button primary" type="button" disabled={saving || !form.title.trim()} onClick={() => void saveEntry()}><Save size={14} aria-hidden="true" /><TranslatedText>{saving ? tr("Saving…") : selectedId ? tr("Save changes") : tr("Save to library")}</TranslatedText></button>
            </div>
          </section>
        </main>
      </div>
    </section>
  );
}
