import { TranslatedText } from "../../../components/TranslatedText";
import { useLanguage } from "../../../context/LanguageContext";
import { Link } from "react-router-dom";
import { ArrowLeft, Clock, RefreshCw, Send, AlertCircle } from "lucide-react";
import { Dialog, Loading } from "../../../components/ui";
import "../../../styles/contest-exam.css";
import { useContestWorkspace } from "./useContestWorkspace";
import { ContestDdlWorkspace } from "./DdlWorkspace";
import { ContestDmlWorkspace } from "./DmlWorkspace";
import { ContestSqlWorkspace } from "./SqlWorkspace";

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00:00";
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}


export function ContestWorkspacePage() {
  const { t: tr } = useLanguage("workspace");
  const controller = useContestWorkspace();
  const {
    navigate,
    contest,
    loading,
    error,
    timeRemaining,
    activeTab,
    setActiveTab,
    schemaData,
    schemaLoading,
    showFullscreenDiagram,
    setShowFullscreenDiagram,
    activeQuestionIndex,
    submitting,
    showConfirmModal,
    setShowConfirmModal,
    showScorecardModal,
    setShowScorecardModal,
    scorecard,
    refreshSchema,
    handleSubmitExam,
    renderDiagramCanvas
  } = controller;
  if (loading) {
    return (
      <div className="contest-exam-container" style={{ justifyContent: "center", alignItems: "center" }}>
        <Loading label={tr("Setting up the exam workspace and your database...")} />
      </div>
    );
  }

  if (error || !contest) {
    return (
      <div className="contest-exam-container" style={{ justifyContent: "center", alignItems: "center", padding: 24 }}>
        <AlertCircle size={48} color="#ef4444" style={{ marginBottom: 16 }} />
        <h2><TranslatedText>{tr("Exam workspace unavailable")}</TranslatedText></h2>
        <p className="muted" style={{ margin: "8px 0 20px" }}><TranslatedText>{tr(error) || tr("The contest does not exist or has ended.")}</TranslatedText></p>
        <Link to="/contests" className="contest-btn-primary">
          <ArrowLeft size={16} /> <TranslatedText>{tr("Back to contests")}</TranslatedText>
        </Link>
      </div>
    );
  }

  const isTimeCritical = timeRemaining < 300000 && timeRemaining > 0; // Less than five minutes remaining
  const activeQuestion = contest.problemDetails[activeQuestionIndex];

  return (
    <div className="contest-exam-container">
      {/* --- EXAM TOP HEADER --- */}
      <header className="contest-exam-header">
        <div className="contest-exam-header-left">
          <Link to={`/contests/${contest.id}`} className="contest-exam-back-btn" title={tr("Leave exam")}>
            <ArrowLeft size={15} /> <TranslatedText>{tr("Leave exam")}</TranslatedText>
          </Link>
          <div className="contest-exam-title-group">
            <h1>
              {contest.title}
              <span className="contest-exam-badge"><TranslatedText>{tr("Comprehensive exam")}</TranslatedText></span>
            </h1>
          </div>
          {schemaData?.schemaName && (
            <div className="contest-db-pill" title={tr("Your personal database schema on Azure")}>
              <span className="contest-db-pulse" />
              <span><TranslatedText>{tr("DB: [")}</TranslatedText>{schemaData.schemaName}]</span>
            </div>
          )}
        </div>

        <div className="contest-exam-header-right">
          <div className={`contest-timer-pill ${isTimeCritical ? "warning" : ""}`} title={tr("Time remaining")}>
            <Clock size={15} />
            <span>{formatCountdown(timeRemaining)}</span>
          </div>

          <button
            type="button"
            className="contest-submit-btn"
            disabled={submitting}
            onClick={() => setShowConfirmModal(true)}
          >
            <Send size={15} />
            <span><TranslatedText>{submitting ? tr("Submitting...") : tr("Submit exam")}</TranslatedText></span>
          </button>
        </div>
      </header>

      {/* --- STEP TABS NAV --- */}
      <nav className="contest-steps-nav">
        <button
          type="button"
          className={`contest-step-tab ${activeTab === "ddl" ? "active" : ""}`}
          onClick={() => setActiveTab("ddl")}
        >
          <span className="contest-step-number">1</span>
          <span><TranslatedText>{tr("🏗️ 1. Schema design (DDL)")}</TranslatedText></span>
          <span className="contest-step-points">{contest.ddlPoints ?? 30} <TranslatedText>{tr("pts")}</TranslatedText></span>
        </button>

        <button
          type="button"
          className={`contest-step-tab ${activeTab === "dml" ? "active" : ""}`}
          onClick={() => setActiveTab("dml")}
        >
          <span className="contest-step-number">2</span>
          <span><TranslatedText>{tr("📥 2. Sample data (DML)")}</TranslatedText></span>
          <span className="contest-step-points">{contest.dmlPoints ?? 20} <TranslatedText>{tr("pts")}</TranslatedText></span>
        </button>

        <button
          type="button"
          className={`contest-step-tab ${activeTab === "queries" ? "active" : ""}`}
          onClick={() => setActiveTab("queries")}
        >
          <span className="contest-step-number">3</span>
          <span><TranslatedText>{tr("🔍 3. SQL queries")}</TranslatedText></span>
          <span className="contest-step-points">{contest.sqlPoints ?? 50} <TranslatedText>{tr("pts")}</TranslatedText></span>
        </button>
      </nav>

      {/* --- EXAM BODY CONTENT --- */}
      <main className="contest-exam-body">
        {/* ==================================================== */}
        {/* TAB 1: DDL STAGE */}
        {/* ==================================================== */}
        {activeTab === "ddl" && <ContestDdlWorkspace state={{ ...controller, contest }} />}

        {/* ==================================================== */}
        {/* TAB 2: DML STAGE */}
        {/* ==================================================== */}
        {activeTab === "dml" && <ContestDmlWorkspace state={{ ...controller, contest }} />}

        {/* ==================================================== */}
        {/* TAB 3: SQL QUERIES STAGE */}
        {/* ==================================================== */}
        {activeTab === "queries" && <ContestSqlWorkspace state={{ ...controller, contest }} />}
      </main>

      {/* --- FULLSCREEN ERD DIAGRAM MODAL --- */}
      {showFullscreenDiagram && (
        <Dialog
          title={tr("Database relationship diagram (ERD) — [{value0}]", { value0: schemaData?.schemaName ?? "Personal database" })}
          onClose={() => setShowFullscreenDiagram(false)}
        >
          <div className="contest-fullscreen-erd">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                <TranslatedText>{tr("Total:")}</TranslatedText> <b>{schemaData?.tableCount ?? 0}</b> <TranslatedText>{tr("tables and")}</TranslatedText> <b>{schemaData?.relationships?.length ?? 0}</b> <TranslatedText>{tr("foreign key relationships.")}</TranslatedText>
              </div>
              <button
                type="button"
                className="contest-btn-secondary"
                disabled={schemaLoading}
                onClick={refreshSchema}
              >
                <RefreshCw size={13} className={schemaLoading ? "spinning" : ""} /> <TranslatedText>{tr("Refresh schema")}</TranslatedText>
              </button>
            </div>
            {renderDiagramCanvas(true)}
          </div>
        </Dialog>
      )}

      {/* --- CONFIRM SUBMIT MODAL --- */}
      {showConfirmModal && (
        <Dialog title={tr("Confirm exam submission")} onClose={() => setShowConfirmModal(false)}>
          <div style={{ padding: "12px 0 20px" }}>
            <p style={{ margin: "0 0 12px 0", fontSize: 14 }}>
              <TranslatedText>{tr("Are you sure you want to submit your work for")}</TranslatedText> <b>{contest.title}</b>?
            </p>
            <div style={{ background: "var(--subtle)", padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 1.6 }}>
              <div>• <b><TranslatedText>{tr("DDL section:")}</TranslatedText></b> <TranslatedText>{tr("Table structures, data types, primary keys and foreign keys will be compared (")}</TranslatedText>{contest.ddlPoints ?? 30} <TranslatedText>{tr("pts).")}</TranslatedText></div>
              <div>• <b><TranslatedText>{tr("DML section:")}</TranslatedText></b> <TranslatedText>{tr("Compatibility with the sample data will be checked (")}</TranslatedText>{contest.dmlPoints ?? 20} <TranslatedText>{tr("pts).")}</TranslatedText></div>
              <div>• <b><TranslatedText>{tr("SQL section:")}</TranslatedText></b> <TranslatedText>{tr("All SQL queries will be graded automatically (")}</TranslatedText>{contest.sqlPoints ?? 50} <TranslatedText>{tr("pts).")}</TranslatedText></div>
            </div>
            <p style={{ marginTop: 14, fontSize: 13, color: "var(--muted)" }}>
              <TranslatedText>{tr("You will receive a detailed scorecard after submitting.")}</TranslatedText>
            </p>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" className="contest-btn-secondary" onClick={() => setShowConfirmModal(false)}>
              <TranslatedText>{tr("Continue working")}</TranslatedText>
            </button>
            <button type="button" className="contest-submit-btn" onClick={handleSubmitExam}>
              <Send size={14} /> <TranslatedText>{tr("Confirm submission")}</TranslatedText>
            </button>
          </div>
        </Dialog>
      )}

      {/* --- FINAL SCORECARD MODAL --- */}
      {showScorecardModal && scorecard && (
        <Dialog
          title={tr("Comprehensive exam scorecard")}
          onClose={() => {
            setShowScorecardModal(false);
            navigate(`/contests/${contest.id}`);
          }}
        >
          <div className="scorecard-modal-content">
            <div className="scorecard-hero">
              <div className="scorecard-total-badge">
                {scorecard.total_score} <span>/ {scorecard.max_score}</span>
              </div>
              <div className={`scorecard-status-pill ${scorecard.passed ? "pass" : "partial"}`}>
                <TranslatedText>{scorecard.passed ? tr("✓ PASSED") : tr("PARTIALLY COMPLETED")}</TranslatedText>
              </div>
            </div>

            <div className="scorecard-sections">
              {/* DDL Section */}
              <div className="scorecard-section-card">
                <div className="scorecard-section-header">
                  <span><TranslatedText>{tr("🏗️ 1. Schema design score (DDL)")}</TranslatedText></span>
                  <span className="scorecard-section-score">
                    {scorecard.ddl.score} / {scorecard.ddl.max_score} <TranslatedText>{tr("pts")}</TranslatedText>
                  </span>
                </div>
                <div style={{ fontSize: 13 }}>{scorecard.ddl.feedback}</div>
                {scorecard.ddl.details && scorecard.ddl.details.length > 0 && (
                  <ul className="scorecard-detail-list">
                    {scorecard.ddl.details.map((d: string, i: number) => (
                      <li key={i}><TranslatedText>{tr(d)}</TranslatedText></li>
                    ))}
                  </ul>
                )}
              </div>

              {/* DML Section */}
              <div className="scorecard-section-card">
                <div className="scorecard-section-header">
                  <span><TranslatedText>{tr("📥 2. Sample data score (DML)")}</TranslatedText></span>
                  <span className="scorecard-section-score">
                    {scorecard.dml.score} / {scorecard.dml.max_score} <TranslatedText>{tr("pts")}</TranslatedText>
                  </span>
                </div>
                <div style={{ fontSize: 13 }}>{scorecard.dml.feedback}</div>
                {scorecard.dml.details && scorecard.dml.details.length > 0 && (
                  <ul className="scorecard-detail-list">
                    {scorecard.dml.details.map((d: string, i: number) => (
                      <li key={i}><TranslatedText>{tr(d)}</TranslatedText></li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Queries Section */}
              <div className="scorecard-section-card">
                <div className="scorecard-section-header">
                  <span><TranslatedText>{tr("🔍 3. SQL query score")}</TranslatedText></span>
                  <span className="scorecard-section-score">
                    {scorecard.queries.score} / {scorecard.queries.max_score} <TranslatedText>{tr("pts")}</TranslatedText>
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {scorecard.queries.questions.map((q: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "var(--surface)",
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        fontSize: 13
                      }}
                    >
                      <div>
                        <b>{q.title}</b>: <span className="muted"><TranslatedText>{tr(q.message)}</TranslatedText></span>
                      </div>
                      <div style={{ fontWeight: 600, color: q.score > 0 ? "#22c55e" : "#ef4444" }}>
                        {q.score} / {q.max_score} <TranslatedText>{tr("pts")}</TranslatedText>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button
                type="button"
                className="contest-btn-primary"
                onClick={() => {
                  setShowScorecardModal(false);
                  navigate(`/contests/${contest.id}`);
                }}
              >
                <TranslatedText>{tr("Finish & return to contest")}</TranslatedText>
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export default ContestWorkspacePage;
