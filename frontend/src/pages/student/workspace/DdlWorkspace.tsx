import { TranslatedText } from "../../../components/TranslatedText";
import { useLanguage } from "../../../context/LanguageContext";
import { StageEditor, type StageEditorProps } from "./components/StageEditor";
import CodeMirror from "@uiw/react-codemirror";
import { Database, Layers, Play, RefreshCw, Table as TableIcon, CheckCircle2, AlertCircle, PanelRightClose, PanelRightOpen, Maximize2, LayoutGrid } from "lucide-react";
import { sqlEditorExtensions } from "../../../components/sqlEditorExtensions";
import type { ContestWorkspaceController } from "./useContestWorkspace";
import type { Contest } from "../../../data/models";

export function DdlWorkspace(props: StageEditorProps) {
  const { t: tr } = useLanguage("workspace");
  return <StageEditor {...props} part="DDL" description={tr("Create and modify tables, primary keys and foreign keys.")} placeholder="-- Write CREATE TABLE and ALTER TABLE statements here" />;
}


export function ContestDdlWorkspace({ state }: { state: ContestWorkspaceController & { contest: Contest } }) {
  const { t: tr } = useLanguage("workspace");
  const {
    contest,
    error,
    ddlScript,
    setDdlScript,
    ddlRunning,
    ddlLog,
    schemaData,
    schemaLoading,
    schemaVisible,
    setSchemaVisible,
    schemaViewMode,
    setSchemaViewMode,
    setShowFullscreenDiagram,
    refreshSchema,
    handleRunDdl,
    renderDiagramCanvas,
    renderCardsView
  } = state;
  return (
          <div className="contest-ddl-layout">
            <div className="contest-ddl-editor-pane">
              <div className="contest-editor-header">
                <span><TranslatedText>{tr("DDL script (CREATE TABLE, ALTER TABLE, primary keys, foreign keys)")}</TranslatedText></span>
                <div className="contest-editor-actions">
                  <button
                    type="button"
                    className="contest-btn-secondary"
                    onClick={() => setSchemaVisible(!schemaVisible)}
                    title={schemaVisible ? tr("Hide the schema panel to expand the editor") : tr("Show the schema panel")}
                  >
                    {schemaVisible ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
                    <span><TranslatedText>{schemaVisible ? tr("Hide schema") : tr("Show schema")}</TranslatedText></span>
                  </button>
                  <button
                    type="button"
                    className="contest-btn-primary"
                    disabled={ddlRunning}
                    onClick={handleRunDdl}
                  >
                    <Play size={13} />
                    <span><TranslatedText>{ddlRunning ? tr("Running...") : tr("▶ Run DDL")}</TranslatedText></span>
                  </button>
                </div>
              </div>

              <div className="contest-editor-scroll">
                <CodeMirror
                  value={ddlScript}
                  height="100%"
                  extensions={sqlEditorExtensions}
                  onChange={(val) => setDdlScript(val)}
                  placeholder={`-- Enter DDL statements here. Example:\nCREATE TABLE Customers (\n    CustomerId VARCHAR(10) PRIMARY KEY,\n    FullName NVARCHAR(100) NOT NULL,\n    Phone VARCHAR(15)\n);\nGO`}
                  basicSetup={{ foldGutter: true, highlightActiveLine: true }}
                />
              </div>

              {ddlLog && (
                <div className={`contest-log-drawer ${ddlLog.status === "Success" ? "success" : "error"}`}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, fontWeight: 600 }}>
                    {ddlLog.status === "Success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span><TranslatedText>{ddlLog.status === "Success" ? tr("DDL executed successfully!") : tr("DDL execution failed")}</TranslatedText></span>
                  </div>
                  {ddlLog.messages.map((m, i) => (
                    <div key={i}><TranslatedText>{tr(m)}</TranslatedText></div>
                  ))}
                  {ddlLog.error && <div><TranslatedText>{tr(ddlLog.error)}</TranslatedText></div>}
                </div>
              )}
            </div>

            {/* FLOATING RESTORE BUTTON WHEN COLLAPSED */}
            {!schemaVisible && (
              <button
                type="button"
                className="contest-inspector-floating-btn"
                onClick={() => setSchemaVisible(true)}
                title={tr("Reopen the schema panel")}
              >
                <Database size={15} />
                <span><TranslatedText>{tr("Show schema (")}</TranslatedText>{schemaData?.tableCount ?? 0} <TranslatedText>{tr("tables)")}</TranslatedText></span>
              </button>
            )}

            {/* LIVE SCHEMA INSPECTOR */}
            <aside className={`contest-inspector-pane ${!schemaVisible ? "collapsed" : ""}`}>
              <div className="contest-inspector-header">
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Database size={15} color="var(--accent)" />
                  <span style={{ fontWeight: 600 }}><TranslatedText>{tr("Schema (")}</TranslatedText>{schemaData?.tableCount ?? 0})</span>

                  {/* Mode switcher: Diagram vs Cards */}
                  <div className="contest-view-mode-pill">
                    <button
                      type="button"
                      className={`contest-view-mode-btn ${schemaViewMode === "diagram" ? "active" : ""}`}
                      onClick={() => setSchemaViewMode("diagram")}
                      title={tr("Show the ER diagram")}
                    >
                      <LayoutGrid size={11} /> <TranslatedText>{tr("Diagram")}</TranslatedText>
                    </button>
                    <button
                      type="button"
                      className={`contest-view-mode-btn ${schemaViewMode === "cards" ? "active" : ""}`}
                      onClick={() => setSchemaViewMode("cards")}
                      title={tr("Show schema cards")}
                    >
                      <Layers size={11} /> <TranslatedText>{tr("List")}</TranslatedText>
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    type="button"
                    className="contest-btn-secondary"
                    onClick={() => setShowFullscreenDiagram(true)}
                    title={tr("Open the database diagram in full screen")}
                    style={{ padding: "4px 8px" }}
                  >
                    <Maximize2 size={13} />
                  </button>
                  <button
                    type="button"
                    className="contest-btn-secondary"
                    disabled={schemaLoading}
                    onClick={refreshSchema}
                    title={tr("Refresh the schema from the database")}
                    style={{ padding: "4px 8px" }}
                  >
                    <RefreshCw size={13} className={schemaLoading ? "spinning" : ""} />
                  </button>
                  <button
                    type="button"
                    className="contest-btn-secondary"
                    onClick={() => setSchemaVisible(false)}
                    title={tr("Hide the schema panel")}
                    style={{ padding: "4px 8px" }}
                  >
                    <PanelRightClose size={13} />
                  </button>
                </div>
              </div>

              <div className="contest-inspector-content">
                {!schemaData?.tables || schemaData.tables.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--muted)" }}>
                    <TableIcon size={32} style={{ opacity: 0.4, marginBottom: 12 }} />
                    <p style={{ margin: 0, fontSize: 13 }}><TranslatedText>{tr("No tables have been created in this schema.")}</TranslatedText></p>
                    <small><TranslatedText>{tr("Write a `CREATE TABLE` statement and click \"Run DDL\" to see the table structure here.")}</TranslatedText></small>
                  </div>
                ) : schemaViewMode === "diagram" ? (
                  renderDiagramCanvas(false)
                ) : (
                  renderCardsView()
                )}
              </div>
            </aside>
          </div>
  );
}
