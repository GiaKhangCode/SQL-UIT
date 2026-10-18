import { TranslatedText } from "../../../components/TranslatedText";
import { useLanguage } from "../../../context/LanguageContext";
import { useRef } from "react";
import { useAuth } from "../../../context/AuthContext";
import { workspaceDraftKey } from "../../../utils/workspaceParts";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Table as TableIcon, Key, Link2, ChevronDown, ChevronUp } from "lucide-react";
import { studentApi } from "../../../services/studentApi";
import type { Contest } from "../../../data/models";
import { parseServerDateTime } from "../../../utils/serverDateTime";
import "../../../styles/contest-exam.css";

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00:00";
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}


export function useContestWorkspace() {
  const { t: tr } = useLanguage("workspace");
  const { session } = useAuth();
  const hydratedDraftKey = useRef<string | null>(null);
  const { contestId = "" } = useParams();
  const navigate = useNavigate();
  const draftKey = workspaceDraftKey(session?.id || "anonymous", contestId, "exam");

  // Contest data
  const [contest, setContest] = useState<Contest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Time & Timer
  const [now, setNow] = useState(Date.now());
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Navigation tab: ddl | dml | queries
  const [activeTab, setActiveTab] = useState<"ddl" | "dml" | "queries">("ddl");

  // Step 1: DDL
  const [ddlScript, setDdlScript] = useState("");
  const [ddlRunning, setDdlRunning] = useState(false);
  const [ddlLog, setDdlLog] = useState<{ status: string; messages: string[]; error?: string } | null>(null);

  // Schema Inspector & Database Diagram
  const [schemaData, setSchemaData] = useState<{
    schemaName: string;
    tableCount: number;
    tables: Array<{
      tableName: string;
      rowCount: number;
      columns: Array<{
        name: string;
        type: string;
        maxLen: number | null;
        nullable: boolean;
        isPk: boolean;
        isFk: boolean;
        fkTarget?: string | null;
      }>;
    }>;
    relationships?: Array<{
      fromTable: string;
      fromCol: string;
      toTable: string;
      toCol: string;
    }>;
  } | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaVisible, setSchemaVisible] = useState(true);
  const [schemaViewMode, setSchemaViewMode] = useState<"diagram" | "cards">("diagram");
  const [showFullscreenDiagram, setShowFullscreenDiagram] = useState(false);
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});

  // Step 2: DML Seed
  const [dmlRunning, setDmlRunning] = useState(false);
  const [dmlResult, setDmlResult] = useState<{ status: string; message: string; isError?: boolean } | null>(null);

  // Step 3: SQL Queries
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [queryAnswers, setQueryAnswers] = useState<Record<string, string>>({});
  const [queryRunning, setQueryRunning] = useState(false);
  const [queryResult, setQueryResult] = useState<{
    columns: string[];
    rows: any[][];
    rowCount: number;
    error?: string;
  } | null>(null);

  // Submission & Scorecard
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showScorecardModal, setShowScorecardModal] = useState(false);
  const [scorecard, setScorecard] = useState<any | null>(null);

  // Load contest & setup database
  useEffect(() => {
    let isMounted = true;
    async function loadContest() {
      try {
        setLoading(true);
        const contests = await studentApi.getContests();
        const found = contests.find((c) => c.id === contestId);
        if (!found) {
          throw new Error("The contest was not found or is unavailable.");
        }
        if (found.examType !== "comprehensive") {
          throw new Error("This contest does not use the comprehensive exam format (DDL + DML + SQL).");
        }
        if (isMounted) setContest(found);

        // Set up the student exam database
        await studentApi.setupContestDb(contestId);

        // Load the initial table structure
        const schema = await studentApi.inspectContestSchema(contestId);
        if (isMounted) setSchemaData(schema);

        setDdlScript("");
        setQueryAnswers({});
        // Restore the locally saved draft, if available
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) {
          try {
            const parsed = JSON.parse(savedDraft);
            if (parsed.ddlScript && isMounted) setDdlScript(parsed.ddlScript);
            if (parsed.queryAnswers && isMounted) setQueryAnswers(parsed.queryAnswers);
          } catch {
            // ignore JSON parse error
          }
        }
        if (isMounted) hydratedDraftKey.current = draftKey;
      } catch (err: any) {
        if (isMounted) setError(err.message || "Unable to load the exam workspace.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadContest();
    return () => {
      isMounted = false;
    };
  }, [contestId, draftKey]);

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (contest?.closesAt) {
        const end = parseServerDateTime(contest.closesAt).getTime();
        setTimeRemaining(Math.max(0, end - current));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [contest]);

  // Auto-save draft to localStorage whenever ddlScript or queryAnswers change
  useEffect(() => {
    if (!contestId || loading || error || hydratedDraftKey.current !== draftKey) return;
    const draft = { ddlScript, queryAnswers };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [contestId, draftKey, ddlScript, queryAnswers, loading, error]);

  // Refresh Schema Inspector
  const refreshSchema = async () => {
    if (!contestId) return;
    try {
      setSchemaLoading(true);
      const schema = await studentApi.inspectContestSchema(contestId);
      setSchemaData(schema);
    } catch (e) {
      console.error("Unable to refresh the schema:", e);
    } finally {
      setSchemaLoading(false);
    }
  };

  // Step 1: Execute DDL
  const handleRunDdl = async () => {
    if (!contestId || !ddlScript.trim()) {
      setDdlLog({ status: "Error", messages: [], error: "Enter a DDL script before running it." });
      return;
    }
    try {
      setDdlRunning(true);
      setDdlLog(null);
      const res = await studentApi.runContestDdl(contestId, ddlScript);
      setDdlLog({ status: "Success", messages: res.messages });
      // Refresh the schema inspector
      await refreshSchema();
    } catch (err: any) {
      setDdlLog({ status: "Error", messages: [], error: err.message || "Unable to execute the DDL script." });
    } finally {
      setDdlRunning(false);
    }
  };

  // Step 2: Seed DML Data
  const handleSeedDml = async () => {
    if (!contestId) return;
    try {
      setDmlRunning(true);
      setDmlResult(null);
      const res = await studentApi.seedContestDml(contestId);
      setDmlResult({ status: "Success", message: res.message });
      // Refresh table row counts
      await refreshSchema();
    } catch (err: any) {
      setDmlResult({ status: "Error", message: err.message || "Unable to load the sample data.", isError: true });
    } finally {
      setDmlRunning(false);
    }
  };

  // Step 3: Run Query
  const handleRunQuery = async () => {
    if (!contest) return;
    const activeQuestion = contest.problemDetails[activeQuestionIndex];
    if (!activeQuestion) return;
    const query = queryAnswers[activeQuestion.id] || "";
    if (!query.trim()) {
      setQueryResult({ columns: [], rows: [], rowCount: 0, error: "Enter a SQL query." });
      return;
    }
    try {
      setQueryRunning(true);
      setQueryResult(null);
      const res = await studentApi.runContestQuery(contestId, query);
      setQueryResult(res);
    } catch (err: any) {
      setQueryResult({ columns: [], rows: [], rowCount: 0, error: err.message || "Unable to execute the SQL query." });
    } finally {
      setQueryRunning(false);
    }
  };

  // Final Submit
  const handleSubmitExam = async () => {
    setShowConfirmModal(false);
    try {
      setSubmitting(true);
      const result = await studentApi.submitContestExam(contestId, ddlScript, queryAnswers);
      setScorecard(result.scorecard);
      setShowScorecardModal(true);
      // Clear the draft after successful submission
      localStorage.removeItem(draftKey);
    } catch (err: any) {
      alert(err.message || "Unable to submit the exam. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCardCollapse = (tableName: string) => {
    setCollapsedCards((prev) => ({ ...prev, [tableName]: !prev[tableName] }));
  };

  const renderDiagramCanvas = (isModal: boolean = false) => {
    if (!schemaData?.tables || schemaData.tables.length === 0) {
      return (
        <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--muted)" }}>
          <TableIcon size={32} style={{ opacity: 0.4, marginBottom: 12 }} />
          <p style={{ margin: 0, fontSize: 13 }}><TranslatedText>{tr("No tables have been created in this schema.")}</TranslatedText></p>
          <small><TranslatedText>{tr("Write a `CREATE TABLE` statement and click \"Run DDL\" to see the database diagram here.")}</TranslatedText></small>
        </div>
      );
    }

    return (
      <div className="contest-diagram-canvas">
        <div className={isModal ? "contest-fullscreen-erd-grid" : "contest-diagram-grid"}>
          {schemaData.tables.map((tbl) => {
            const sortedCols = [...tbl.columns].sort((a, b) => {
              if (a.isPk && !b.isPk) return -1;
              if (!a.isPk && b.isPk) return 1;
              if (a.isFk && !b.isFk) return -1;
              if (!a.isFk && b.isFk) return 1;
              return 0;
            });

            return (
              <div key={tbl.tableName} className="contest-diagram-table-node">
                <div className="contest-diagram-table-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <TableIcon size={14} color="#0ea5e9" />
                    <span>{tbl.tableName.toUpperCase()}</span>
                  </div>
                  <span className="contest-row-count-badge">{tbl.rowCount} <TranslatedText>{tr("rows")}</TranslatedText></span>
                </div>

                <div className="contest-diagram-cols-list">
                  {sortedCols.map((c) => (
                    <div
                      key={c.name}
                      className={`contest-diagram-col-row ${c.isPk ? "is-pk" : ""} ${c.isFk ? "is-fk" : ""}`}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {c.isPk && (
                          <span className="contest-col-badge-pk" title={tr("Primary key (PK)")}>
                            <Key size={10} /> PK
                          </span>
                        )}
                        {c.isFk && (
                          <span className="contest-col-badge-fk" title={tr("Foreign key (FK)")}>
                            <Link2 size={10} /> FK
                          </span>
                        )}
                        <span style={{ fontWeight: c.isPk ? 700 : c.isFk ? 600 : 400 }}>
                          {c.name}
                        </span>
                        {c.fkTarget && (
                          <span className="contest-fk-target-chip" title={tr("References {value0}", { value0: c.fkTarget.toUpperCase() })}>
                            ➔ {c.fkTarget.toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--muted)", fontSize: "11px" }}>
                        <span>
                          {c.type.toUpperCase()}
                          {c.maxLen && c.maxLen > 0 ? `(${c.maxLen})` : ""}
                        </span>
                        {!c.nullable && <span style={{ color: "#ef4444", fontWeight: "bold" }}>*</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {schemaData.relationships && schemaData.relationships.length > 0 && (
          <div className="contest-diagram-relations-box">
            <h4>
              <Link2 size={14} /> <TranslatedText>{tr("Foreign key relationships")}</TranslatedText>
            </h4>
            <div className="contest-relations-list">
              {schemaData.relationships.map((rel, i) => (
                <div key={i} className="contest-relation-item">
                  <b>{rel.fromTable.toUpperCase()}</b> ({rel.fromCol})
                  <span className="contest-relation-arrow">──[ N : 1 ]──►</span>
                  <b>{rel.toTable.toUpperCase()}</b> ({rel.toCol})
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCardsView = () => {
    if (!schemaData?.tables || schemaData.tables.length === 0) {
      return (
        <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--muted)" }}>
          <TableIcon size={32} style={{ opacity: 0.4, marginBottom: 12 }} />
          <p style={{ margin: 0, fontSize: 13 }}><TranslatedText>{tr("No tables have been created in this schema.")}</TranslatedText></p>
          <small><TranslatedText>{tr("Write a `CREATE TABLE` statement and click \"Run DDL\" to see the table structure here.")}</TranslatedText></small>
        </div>
      );
    }

    return schemaData.tables.map((tbl) => {
      const isCollapsed = Boolean(collapsedCards[tbl.tableName]);
      return (
        <div key={tbl.tableName} className="contest-table-card">
          <div
            className="contest-table-card-header"
            onClick={() => toggleCardCollapse(tbl.tableName)}
            title={tr("Click to collapse or expand the table")}
          >
            <div className="contest-table-name">
              <TableIcon size={14} color="var(--accent)" />
              <span>{tbl.tableName.toUpperCase()}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="contest-row-count-badge">{tbl.rowCount} <TranslatedText>{tr("rows")}</TranslatedText></span>
              {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </div>
          </div>
          {!isCollapsed && (
            <div className="contest-table-columns">
              {tbl.columns.map((c) => (
                <div key={c.name} className="contest-col-item">
                  <div className="contest-col-left">
                    {c.isPk && (
                      <span className="contest-col-badge-pk" title={tr("Primary key (PK)")}>
                        <Key size={10} /> PK
                      </span>
                    )}
                    {c.isFk && (
                      <span className="contest-col-badge-fk" title={tr("Foreign key (FK)")}>
                        <Link2 size={10} /> FK
                      </span>
                    )}
                    <span>{c.name}</span>
                    {c.fkTarget && (
                      <span className="contest-fk-target-chip" title={tr("References {value0}", { value0: c.fkTarget.toUpperCase() })}>
                        ➔ {c.fkTarget.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="contest-col-right">
                    <span>
                      <TranslatedText>{tr(c.type)}</TranslatedText>
                      {c.maxLen && c.maxLen > 0 ? `(${c.maxLen})` : ""}
                    </span>
                    {!c.nullable && <span style={{ color: "#ef4444" }}>*</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    });
  };

  return { contestId, navigate, contest, setContest, loading, setLoading, error, setError, now, setNow, timeRemaining, setTimeRemaining, activeTab, setActiveTab, ddlScript, setDdlScript, ddlRunning, setDdlRunning, ddlLog, setDdlLog, schemaData, setSchemaData, schemaLoading, setSchemaLoading, schemaVisible, setSchemaVisible, schemaViewMode, setSchemaViewMode, showFullscreenDiagram, setShowFullscreenDiagram, collapsedCards, setCollapsedCards, dmlRunning, setDmlRunning, dmlResult, setDmlResult, activeQuestionIndex, setActiveQuestionIndex, queryAnswers, setQueryAnswers, queryRunning, setQueryRunning, queryResult, setQueryResult, submitting, setSubmitting, showConfirmModal, setShowConfirmModal, showScorecardModal, setShowScorecardModal, scorecard, setScorecard, refreshSchema, handleRunDdl, handleSeedDml, handleRunQuery, handleSubmitExam, toggleCardCollapse, renderDiagramCanvas, renderCardsView };
}


export type ContestWorkspaceController = ReturnType<typeof useContestWorkspace>;
