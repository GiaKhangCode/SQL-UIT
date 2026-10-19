import { TranslatedText } from "../../../components/TranslatedText";
import { useLanguage } from "../../../context/LanguageContext";
import { StageEditor, type StageEditorProps } from "./components/StageEditor";
import CodeMirror from "@uiw/react-codemirror";
import { Database, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { sqlEditorExtensions } from "../../../components/sqlEditorExtensions";
import type { ContestWorkspaceController } from "./useContestWorkspace";
import type { Contest } from "../../../data/models";

export function DmlWorkspace(props: StageEditorProps) {
  const { t: tr } = useLanguage("workspace");
  return <StageEditor {...props} part="DML" description={tr("Write INSERT statements to recreate the target dataset. The instructor's table structure is already set up.")} placeholder="-- Write INSERT statements here" />;
}


export function ContestDmlWorkspace({ state }: { state: ContestWorkspaceController & { contest: Contest } }) {
  const { t: tr } = useLanguage("workspace");
  const {
    contest,
    error,
    schemaData,
    dmlRunning,
    dmlResult,
    refreshSchema,
    handleSeedDml
  } = state;
  return (
          <div className="contest-dml-layout">
            <div className="contest-dml-main">
              <div className="contest-dml-card">
                <h3><TranslatedText>{tr("📥 Load sample data")}</TranslatedText></h3>
                <p>
                  <TranslatedText>{tr("Your instructor has provided sample data to test the database structure you created in Step 1 and supply data for the SQL queries in Step 3.")}</TranslatedText>
                </p>
                <div className="contest-dml-actions">
                  <button
                    type="button"
                    className="contest-btn-primary"
                    disabled={dmlRunning}
                    onClick={handleSeedDml}
                  >
                    <Database size={15} />
                    <span><TranslatedText>{dmlRunning ? tr("Loading data...") : tr("🚀 Load data")}</TranslatedText></span>
                  </button>
                  <button
                    type="button"
                    className="contest-btn-secondary"
                    onClick={refreshSchema}
                  >
                    <RefreshCw size={14} /> <TranslatedText>{tr("Check row counts")}</TranslatedText>
                  </button>
                </div>

                {dmlResult && (
                  <div className={`contest-dml-status-box ${dmlResult.isError ? "error" : "success"}`}>
                    {dmlResult.isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                    <span><TranslatedText>{tr(dmlResult.message)}</TranslatedText></span>
                  </div>
                )}
              </div>

              {/* Status table overview */}
              <div className="contest-dml-card">
                <h3><TranslatedText>{tr("📊 Table statistics")}</TranslatedText></h3>
                {!schemaData?.tables || schemaData.tables.length === 0 ? (
                  <p style={{ margin: 0 }}><TranslatedText>{tr("No tables available. Complete Step 1 (DDL) before loading data.")}</TranslatedText></p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                    {schemaData.tables.map((t) => (
                      <div
                        key={t.tableName}
                        style={{
                          background: "var(--subtle)",
                          padding: "10px 14px",
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                      >
                        <span style={{ fontWeight: 600, fontFamily: "JetBrains Mono" }}>{t.tableName}</span>
                        <span className="contest-row-count-badge" style={{ fontWeight: 700, color: t.rowCount > 0 ? "#22c55e" : "inherit" }}>
                          {t.rowCount} <TranslatedText>{tr("rows")}</TranslatedText>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Read-only Seed Script Viewer */}
            <div className="contest-dml-seed-preview">
              <div className="contest-editor-header">
                <span><TranslatedText>{tr("Instructor sample DML script (read-only)")}</TranslatedText></span>
              </div>
              <div style={{ flex: 1, overflow: "auto" }}>
                <CodeMirror
                  value={contest.dmlSeedScript || "-- The instructor has not provided a sample data script."}
                  height="100%"
                  readOnly={true}
                  editable={false}
                  extensions={sqlEditorExtensions}
                  basicSetup={{ foldGutter: true }}
                />
              </div>
            </div>
          </div>
  );
}
