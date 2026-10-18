import { TranslatedText } from "../../components/TranslatedText";
import { useLanguage } from "../../context/LanguageContext";
import React, { useEffect, useMemo, useState, useRef, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Dialog, Empty, ErrorState, Loading } from "../../components/ui";
import {
  adminCapabilities,
  defaultAdminRolePolicy,
  type AdminClass,
  type AdminLecturerRequest,
  type AdminPracticeProblem,
  type AdminRoleName,
} from "../../data/adminPolicy";
import { adminService, type AdminUser } from "../../services/adminService";
import { teacherService } from "../../services/teacherService";
import type { TeacherClassMember } from "../../data/teacherTypes";
import { studentApi } from "../../services/studentApi";
import { academicTerms } from "../../utils/academicTerms";
import { localTime, parseServerDateTime } from "../../utils/serverDateTime";

function PageIntro({ title, sub, children, compact = false }: { title: string; sub?: string; children?: ReactNode; compact?: boolean }) {
  const { t: tr } = useLanguage("admin");
  return <div className={`admin-page-intro${compact ? " page-list-intro" : ""}`}><div><h1 className={compact ? "sr-only" : undefined}><TranslatedText>{title}</TranslatedText></h1>{sub && <p><TranslatedText>{tr(sub)}</TranslatedText></p>}</div>{children && <div className="admin-page-actions">{children}</div>}</div>;
}

function Split({ main, side, className = "" }: { main: ReactNode; side: ReactNode; className?: string }) {
  const { t: tr } = useLanguage("admin");
  return <div className={`admin-split ${className}`}><section className="admin-primary"><TranslatedText>{tr(main)}</TranslatedText></section><aside className="admin-side"><TranslatedText>{tr(side)}</TranslatedText></aside></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const { t: tr } = useLanguage("admin");
  return <label className="admin-field"><span><TranslatedText>{tr(label)}</TranslatedText></span>{children}</label>;
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="admin-notice" role="status">{children}</p>;
}

function AddUserDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (user: AdminUser) => void }) {
  const { t: tr } = useLanguage("admin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminUser["role"]>("Student");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    try {
      const newUser = await adminService.createUser({ name: name.trim(), email: email.trim(), role, password });
      onAdd(newUser);
    } catch (err: any) {
      setError(err.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  }

  return <Dialog title={tr("Add user")} onClose={onClose} className="admin-dialog"><form onSubmit={submit} className="admin-dialog-form">
    <Field label={tr("NAME")}><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("Full name")} required /></Field>
    <Field label={tr("EMAIL")}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.edu" required /></Field>
    <Field label={tr("PASSWORD")}><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tr("Password")} required minLength={8} /></Field>
    <Field label={tr("ROLE")}><select value={role} onChange={(e) => setRole(e.target.value as AdminUser["role"])}><option value="Student">{tr("Student")}</option><option value="Lecturer">{tr("Lecturer")}</option><option value="Admin">{tr("Admin")}</option></select></Field>
    {error && <p className="admin-warning" style={{ margin: 0 }}><TranslatedText>{tr(error)}</TranslatedText></p>}
    <div className="admin-dialog-actions"><button type="button" className="button" onClick={onClose} disabled={loading}><TranslatedText>{tr("Cancel")}</TranslatedText></button><button className="button primary" disabled={loading}><TranslatedText>{loading ? tr("Adding...") : tr("Add user")}</TranslatedText></button></div>
  </form></Dialog>;
}

function BulkImportDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: (message: string) => void }) {
  const { t: tr } = useLanguage("admin");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError("");
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
        setError("");
      } else {
        setError("Please upload a .csv file");
      }
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = "name,email,role,password\nNguyễn Văn A,nva@example.com,Student,12354678";
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "template_import_users.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a CSV file.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await adminService.importUsers(file);
      setResult(response);
    } catch (err: any) {
      setError(err.message || "Failed to import users");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog title={tr("Import Users from CSV")} onClose={onClose} className="admin-dialog">
      <form onSubmit={submit} className="admin-dialog-form">
        {!result ? (
          <>
            <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="text-button" onClick={handleDownloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                <TranslatedText>{tr("Download CSV Template")}</TranslatedText>
              </button>
            </div>

            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? "var(--color-primary, #6366f1)" : "#cbd5e1"}`,
                borderRadius: "8px",
                padding: "2.5rem 2rem",
                textAlign: "center",
                backgroundColor: isDragging ? "rgba(99, 102, 241, 0.05)" : "transparent",
                cursor: "pointer",
                transition: "all 0.2s ease",
                marginBottom: "1rem"
              }}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                ref={fileInputRef}
                style={{ display: "none" }}
              />
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={isDragging ? "var(--color-primary, #6366f1)" : "#94a3b8"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 1rem", transition: "stroke 0.2s ease" }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              {file ? (
                <div>
                  <p style={{ fontWeight: 600, color: "var(--color-primary, #6366f1)", margin: "0 0 0.25rem" }}>{file.name}</p>
                  <p className="admin-muted" style={{ fontSize: "0.875rem", margin: 0 }}>{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <>
                  <p style={{ fontWeight: 500, margin: "0 0 0.5rem" }}><TranslatedText>{tr("Drag & drop your CSV file here")}</TranslatedText></p>
                  <p className="admin-muted" style={{ fontSize: "0.875rem", margin: 0 }}><TranslatedText>{tr("or click to browse from your computer")}</TranslatedText></p>
                </>
              )}
            </div>

            <p className="admin-muted" style={{ fontSize: "0.875rem", textAlign: "center", margin: "1rem 0" }}>
              <TranslatedText>{tr("The CSV file must contain at least 2 columns:")}</TranslatedText> <code style={{ backgroundColor: "#f1f5f9", padding: "0.2rem 0.4rem", borderRadius: "4px" }}>name</code>, <code style={{ backgroundColor: "#f1f5f9", padding: "0.2rem 0.4rem", borderRadius: "4px" }}>email</code>.
            </p>

            <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fef08a", borderRadius: "6px", padding: "0.75rem", marginTop: "0.75rem" }}>
              <p style={{ fontSize: "0.8rem", color: "#854d0e", margin: 0, display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "0.1rem" }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                <span><strong><TranslatedText>{tr("Important:")}</TranslatedText></strong> <TranslatedText>{tr("When saving from Excel, please select")}</TranslatedText> <strong><TranslatedText>{tr("CSV UTF-8 (Comma delimited)")}</TranslatedText></strong> <TranslatedText>{tr("to prevent corruption of Vietnamese characters.")}</TranslatedText></span>
              </p>
            </div>

            {error && <p className="admin-warning" style={{ margin: "1rem 0 0", textAlign: "center" }}><TranslatedText>{tr(error)}</TranslatedText></p>}

            <div className="admin-dialog-actions" style={{ marginTop: "1.5rem" }}>
              <button type="button" className="button" onClick={onClose} disabled={loading}><TranslatedText>{tr("Cancel")}</TranslatedText></button>
              <button className="button primary" disabled={loading || !file}>
                <TranslatedText>{loading ? tr("Importing...") : tr("Import Users")}</TranslatedText>
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: "1.5rem", marginTop: "1rem" }}>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "56px", height: "56px", borderRadius: "50%", backgroundColor: result.failed_count === 0 ? "#dcfce7" : "#fef08a", color: result.failed_count === 0 ? "#166534" : "#854d0e", marginBottom: "1rem" }}>
                {result.failed_count === 0 ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                )}
              </div>
              <h3 style={{ margin: 0, fontSize: "1.25rem", color: "#0f172a" }}><TranslatedText>{tr("Import Complete")}</TranslatedText></h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", textAlign: "center", marginBottom: "1.5rem" }}>
              <div style={{ padding: "1rem", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <p className="admin-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.5rem" }}><TranslatedText>{tr("Processed")}</TranslatedText></p>
                <p style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0, color: "#334155" }}>{result.total_processed}</p>
              </div>
              <div style={{ padding: "1rem", backgroundColor: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0", color: "#166534" }}>
                <p style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.5rem", opacity: 0.8 }}><TranslatedText>{tr("Success")}</TranslatedText></p>
                <p style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>{result.success_count}</p>
              </div>
              <div style={{ padding: "1rem", backgroundColor: result.failed_count > 0 ? "#fef2f2" : "#f8fafc", borderRadius: "8px", border: `1px solid ${result.failed_count > 0 ? "#fecaca" : "#e2e8f0"}`, color: result.failed_count > 0 ? "#991b1b" : "inherit" }}>
                <p style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.5rem", color: result.failed_count > 0 ? "#991b1b" : "var(--color-text-muted)" }}><TranslatedText>{tr("Failed")}</TranslatedText></p>
                <p style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>{result.failed_count}</p>
              </div>
            </div>

            {result.errors && result.errors.length > 0 && (
              <div style={{ maxHeight: "180px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1rem", marginTop: "1rem", backgroundColor: "#f8fafc" }}>
                <p style={{ fontWeight: 600, margin: "0 0 0.75rem", fontSize: "0.875rem", color: "#334155" }}><TranslatedText>{tr("Error Details:")}</TranslatedText></p>
                <ul style={{ fontSize: "0.875rem", paddingLeft: "1.25rem", margin: 0, color: "#64748b", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  {result.errors.map((e: any, idx: number) => (
                    <li key={idx} style={{ lineHeight: 1.4 }}>
                      <span style={{ fontWeight: 600, color: "#475569" }}><TranslatedText>{tr("Row")}</TranslatedText> {e.row}:</span> {e.email} — <span style={{ color: "#ef4444" }}><TranslatedText>{tr(e.error)}</TranslatedText></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="admin-dialog-actions" style={{ marginTop: "2rem" }}>
              <button type="button" className="button primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => {
                onClose();
                if (result.success_count > 0) onSuccess(`Successfully imported ${result.success_count} users.`);
              }}>
                <TranslatedText>{tr("Done")}</TranslatedText>
              </button>
            </div>
          </>
        )}
      </form>
    </Dialog>
  );
}

function BulkImportMembersDialog({ classId, onClose, onSuccess }: { classId: string; onClose: () => void; onSuccess: (message: string) => void }) {
  const { t: tr } = useLanguage("admin");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError("");
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv') || droppedFile.name.endsWith('.txt')) {
        setFile(droppedFile);
        setError("");
      } else {
        setError("Please upload a .csv or .txt file");
      }
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await teacherService.importClassMembers(classId, file);
      setResult(response);
    } catch (err: any) {
      setError(err.message || "Failed to import members");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog title={tr("Import Class Members")} onClose={onClose} className="admin-dialog">
      <form onSubmit={submit} className="admin-dialog-form">
        {!result ? (
          <>
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? "var(--color-primary, #6366f1)" : "#cbd5e1"}`,
                borderRadius: "8px",
                padding: "2.5rem 2rem",
                textAlign: "center",
                backgroundColor: isDragging ? "rgba(99, 102, 241, 0.05)" : "transparent",
                cursor: "pointer",
                transition: "all 0.2s ease",
                marginBottom: "1rem"
              }}
            >
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                ref={fileInputRef}
                style={{ display: "none" }}
              />
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={isDragging ? "var(--color-primary, #6366f1)" : "#94a3b8"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 1rem", transition: "stroke 0.2s ease" }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              {file ? (
                <div>
                  <p style={{ fontWeight: 600, color: "var(--color-primary, #6366f1)", margin: "0 0 0.25rem" }}>{file.name}</p>
                  <p className="admin-muted" style={{ fontSize: "0.875rem", margin: 0 }}>{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <>
                  <p style={{ fontWeight: 500, margin: "0 0 0.5rem" }}><TranslatedText>{tr("Drag & drop your CSV/TXT file here")}</TranslatedText></p>
                  <p className="admin-muted" style={{ fontSize: "0.875rem", margin: 0 }}><TranslatedText>{tr("or click to browse from your computer")}</TranslatedText></p>
                </>
              )}
            </div>

            <p className="admin-muted" style={{ fontSize: "0.875rem", textAlign: "center", margin: "1rem 0" }}>
              <TranslatedText>{tr("The file can be a comma-separated list of emails or one email per line.")}</TranslatedText>
            </p>

            {error && <p className="admin-warning" style={{ margin: "1rem 0 0", textAlign: "center" }}><TranslatedText>{tr(error)}</TranslatedText></p>}

            <div className="admin-dialog-actions" style={{ marginTop: "1.5rem" }}>
              <button type="button" className="button" onClick={onClose} disabled={loading}><TranslatedText>{tr("Cancel")}</TranslatedText></button>
              <button className="button primary" disabled={loading || !file}>
                <TranslatedText>{loading ? tr("Importing...") : tr("Import Members")}</TranslatedText>
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: "1.5rem", marginTop: "1rem" }}>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "56px", height: "56px", borderRadius: "50%", backgroundColor: result.failed_count === 0 ? "#dcfce7" : "#fef08a", color: result.failed_count === 0 ? "#166534" : "#854d0e", marginBottom: "1rem" }}>
                {result.failed_count === 0 ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                )}
              </div>
              <h3 style={{ margin: 0, fontSize: "1.25rem", color: "#0f172a" }}><TranslatedText>{tr("Import Complete")}</TranslatedText></h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", textAlign: "center", marginBottom: "1.5rem" }}>
              <div style={{ padding: "1rem", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <p className="admin-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.5rem" }}><TranslatedText>{tr("Processed")}</TranslatedText></p>
                <p style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0, color: "#334155" }}>{result.total_processed}</p>
              </div>
              <div style={{ padding: "1rem", backgroundColor: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0", color: "#166534" }}>
                <p style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.5rem", opacity: 0.8 }}><TranslatedText>{tr("Added")}</TranslatedText></p>
                <p style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>{result.success_count}</p>
              </div>
              <div style={{ padding: "1rem", backgroundColor: result.skipped_count > 0 || result.failed_count > 0 ? "#fef2f2" : "#f8fafc", borderRadius: "8px", border: `1px solid ${result.skipped_count > 0 || result.failed_count > 0 ? "#fecaca" : "#e2e8f0"}`, color: result.skipped_count > 0 || result.failed_count > 0 ? "#991b1b" : "inherit" }}>
                <p style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.5rem", color: result.skipped_count > 0 || result.failed_count > 0 ? "#991b1b" : "var(--color-text-muted)" }}><TranslatedText>{tr("Skipped/Failed")}</TranslatedText></p>
                <p style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>{result.skipped_count + result.failed_count}</p>
              </div>
            </div>

            {result.errors && result.errors.length > 0 && (
              <div style={{ maxHeight: "180px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1rem", marginTop: "1rem", backgroundColor: "#f8fafc" }}>
                <p style={{ fontWeight: 600, margin: "0 0 0.75rem", fontSize: "0.875rem", color: "#334155" }}><TranslatedText>{tr("Failed/Skipped Details:")}</TranslatedText></p>
                <ul style={{ fontSize: "0.875rem", paddingLeft: "1.25rem", margin: 0, color: "#64748b", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  {result.errors.map((e: any, idx: number) => (
                    <li key={idx} style={{ lineHeight: 1.4 }}>
                      <span style={{ fontWeight: 600, color: "#475569" }}>{e.email}</span> — <span style={{ color: "#ef4444" }}><TranslatedText>{tr(e.error)}</TranslatedText></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="admin-dialog-actions" style={{ marginTop: "2rem" }}>
              <button type="button" className="button primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => {
                onClose();
                if (result.success_count > 0) onSuccess(`Successfully imported ${result.success_count} members.`);
              }}>
                <TranslatedText>{tr("Done")}</TranslatedText>
              </button>
            </div>
          </>
        )}
      </form>
    </Dialog>
  );
}

function AdminListPagination({ total, page, onPageChange, label, noun, alwaysVisible = false }: { total: number; page: number; onPageChange: (page: number) => void; label: string; noun: string; alwaysVisible?: boolean }) {
  const { t: tr, locale: uiLocale } = useLanguage("admin");
  const pageSize = 15;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * pageSize;
  return <div className="admin-list-table-footer">
    <p className="admin-table-footer" role="status"><TranslatedText>{tr("Showing")}</TranslatedText> {total === 0 ? 0 : firstIndex + 1}–{Math.min(firstIndex + pageSize, total)} <TranslatedText>{tr("of")}</TranslatedText> {total.toLocaleString(uiLocale)} <TranslatedText>{tr(noun)}</TranslatedText></p>
    {(pageCount > 1 || alwaysVisible) && <nav className="admin-table-pagination" aria-label={tr(label)}>
      <button type="button" className="button admin-button" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}><TranslatedText>{tr("← Previous")}</TranslatedText></button>
      <span><TranslatedText>{tr("Page")}</TranslatedText> {currentPage} <TranslatedText>{tr("of")}</TranslatedText> {pageCount}</span>
      <button type="button" className="button admin-button" disabled={currentPage === pageCount} onClick={() => onPageChange(currentPage + 1)}><TranslatedText>{tr("Next →")}</TranslatedText></button>
    </nav>}
  </div>;
}

export function AdminUsersPage() {
  const { t: tr, locale: uiLocale } = useLanguage("admin");
  const location = useLocation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [dialog, setDialog] = useState(false);
  const [bulkImportDialog, setBulkImportDialog] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    adminService.getUsers().then(data => {
      setUsers(data);
      if (data.length > 0) {
        setSelectedEmail(current => current || data[0].email);
      }
      setLoading(false);
    }).catch(err => {
      setLoadError(err instanceof Error ? err.message : "Failed to load users.");
      setLoading(false);
    });

    adminService.getLecturerRequests().then(requests => {
      setPendingRequestCount(requests.length);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (loading) return;
    const state = location.state as { selectedEmail?: string; notice?: string } | null;
    if (state?.selectedEmail) {
      setSelectedEmail(state.selectedEmail);
      const userIndex = filtered.findIndex(user => user.email === state.selectedEmail);
      if (userIndex >= 0) setPage(Math.floor(userIndex / pageSize) + 1);
    }
    if (state?.notice) setNotice(state.notice);
    if (state) window.history.replaceState({}, document.title);
  }, [location.state, loading]);

  const filtered = useMemo(() => users.filter((user) => {
    const matchesQuery = `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (roleFilter === "All roles" || user.role === roleFilter) && (statusFilter === "All statuses" || user.status === statusFilter);
  }), [users, query, roleFilter, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * pageSize;
  const pageUsers = filtered.slice(firstIndex, firstIndex + pageSize);
  const selected = pageUsers.find((user) => user.email === selectedEmail) || pageUsers[0];

  useEffect(() => {
    setPendingRole(null);
  }, [selected?.email]);

  useEffect(() => {
    setPage(current => Math.min(current, pageCount));
  }, [pageCount]);

  async function handleUpdateRole(userToUpdate: AdminUser, newRole: string) {
    try {
      const updated = await adminService.updateUser(userToUpdate.email, { ...userToUpdate, role: newRole });
      setUsers(all => all.map(u => u.email === updated.email ? updated : u));
    } catch (err: any) {
      setNotice(err.message || "Failed to update role");
    }
  }

  function exportCsv() {
    const csv = ["Name,Email,Role,Status", ...users.map((u) => [u.name, u.email, u.role, u.status].join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a"); link.href = url; link.download = "uit-sql-users.csv"; link.click(); URL.revokeObjectURL(url);
  }

  if (loading) return <div className={"admin-page compact-tables-page compact-admin-list-page" + (showUserDetails ? " show-user-details" : "")}><h1 className="sr-only"><TranslatedText>{tr("Users")}</TranslatedText></h1><Loading label={tr("Loading users…")} /></div>;
  if (loadError) return <div className={"admin-page compact-tables-page compact-admin-list-page" + (showUserDetails ? " show-user-details" : "")}><h1 className="sr-only"><TranslatedText>{tr("Users")}</TranslatedText></h1><ErrorState title={tr("Could not load users")} message={tr(loadError)} onRetry={() => window.location.reload()} /></div>;
  return <div className={"admin-page compact-tables-page compact-admin-list-page" + (showUserDetails ? " show-user-details" : "")}>
    <h1 className="sr-only"><TranslatedText>{tr("Users")}</TranslatedText></h1>
    {pendingRequestCount > 0 && <div className="admin-pending-banner"><span>{pendingRequestCount} <TranslatedText>{tr("lecturer registrations are awaiting approval. Lecturer access stays locked until approved.")}</TranslatedText></span><Link className="text-button" to="/admin/users/approvals"><TranslatedText>{tr("Review requests →")}</TranslatedText></Link></div>}
    <div className="admin-user-filter-row">
      <div className="admin-user-filters">
        <Field label={tr("SEARCH")}><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={tr("Search name or email...")} /></Field>
        <Field label={tr("ROLE")}><select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}><option value="All roles">{tr("All roles")}</option><option value="Student">{tr("Student")}</option><option value="Lecturer">{tr("Lecturer")}</option><option value="Admin">{tr("Admin")}</option></select></Field>
        <Field label={tr("STATUS")}><select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}><option value="Active">{tr("Active")}</option><option value="All statuses">{tr("All statuses")}</option><option value="Inactive">{tr("Inactive")}</option><option value="Pending">{tr("Pending")}</option></select></Field>
      </div>
      <div className="admin-user-actions">
        <button className="button admin-button" onClick={exportCsv} disabled={users.length === 0}><TranslatedText>{tr("Export all CSV")}</TranslatedText></button>
        <button className="button admin-button" onClick={() => setBulkImportDialog(true)}><TranslatedText>{tr("Import Users")}</TranslatedText></button>
        <button className="button primary admin-button" onClick={() => setDialog(true)}><TranslatedText>{tr("Add user")}</TranslatedText></button>
      </div>
    </div>
    {notice && <Notice><TranslatedText>{tr(notice)}</TranslatedText></Notice>}
    <Split main={<>
      <div className="admin-table-wrap compact-table-scroll" role="region" aria-label={tr("Users table")} tabIndex={0}><table className="admin-table admin-users-table"><thead><tr><th><TranslatedText>{tr("NAME / EMAIL")}</TranslatedText></th><th><TranslatedText>{tr("ROLE")}</TranslatedText></th><th><TranslatedText>{tr("STATUS")}</TranslatedText></th><th><TranslatedText>{tr("LAST ACTIVE")}</TranslatedText></th></tr></thead><tbody>
        {pageUsers.map((user) => <tr key={user.email} className={selected?.email === user.email ? "is-selected" : ""} onClick={() => { setSelectedEmail(user.email); setShowUserDetails(true); }}>
          <td data-label={tr("NAME / EMAIL")}><button className="admin-row-link" onClick={() => { setSelectedEmail(user.email); setShowUserDetails(true); }}>{user.name}</button><small>{user.email}</small></td><td data-label={tr("ROLE")}><TranslatedText>{tr(user.role)}</TranslatedText></td><td data-label={tr("STATUS")} className={user.status === "Active" ? "admin-success" : ""}><TranslatedText>{tr(user.status)}</TranslatedText></td><td data-label={tr("LAST ACTIVE")}>{user.lastActive}</td>
        </tr>)}
      </tbody></table>
      {filtered.length === 0 && <Empty title={users.length === 0 ? tr("No accounts yet") : tr("No matching accounts")}><TranslatedText>{users.length === 0 ? tr("Add a user to get started.") : tr("Try a different search or filter.")}</TranslatedText></Empty>}
      </div>
      <div className="admin-compact-list-footer">
        <div className="admin-compact-list-controls">
          <span role="status"><TranslatedText>{tr("Showing")}</TranslatedText> {filtered.length === 0 ? 0 : firstIndex + 1}–{Math.min(firstIndex + pageSize, filtered.length)} <TranslatedText>{tr("of")}</TranslatedText> {filtered.length.toLocaleString(uiLocale)} <TranslatedText>{tr("accounts")}</TranslatedText></span>
          <nav className="admin-table-pagination" aria-label={tr("User pages")}>
            <button type="button" className="button admin-button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><TranslatedText>{tr("← Previous")}</TranslatedText></button>
            <span><TranslatedText>{tr("Page")}</TranslatedText> {currentPage} <TranslatedText>{tr("of")}</TranslatedText> {pageCount}</span>
            <button type="button" className="button admin-button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}><TranslatedText>{tr("Next →")}</TranslatedText></button>
          </nav>
        </div>
      </div>
    </>} side={selected ? <>
      <div className="admin-compact-panel-header"><h2><TranslatedText>{tr("Account details")}</TranslatedText></h2><button type="button" className="text-button compact-panel-back" onClick={() => setShowUserDetails(false)}><TranslatedText>{tr("Back to users")}</TranslatedText></button></div><h3 className="admin-detail-title">{selected.name}</h3><p className="admin-muted">{selected.email}</p><div className="admin-detail-divider" />
      <Field label={tr("ROLE")}><select value={pendingRole ?? selected.role} onChange={(e) => setPendingRole(e.target.value)}><option value="Student">{tr("Student")}</option><option value="Lecturer">{tr("Lecturer")}</option><option value="Admin">{tr("Admin")}</option></select></Field>
      {pendingRole && pendingRole !== selected.role && (
        <button className="button primary admin-button" style={{ marginBottom: "1rem" }} onClick={() => { handleUpdateRole(selected, pendingRole); setPendingRole(null); }}><TranslatedText>{tr("Save role")}</TranslatedText></button>
      )}
      <p className={selected.status === "Active" ? "admin-success admin-detail-status" : "admin-warning admin-detail-status"}><TranslatedText>{tr(selected.status)}</TranslatedText> <TranslatedText>{tr("· Joined")}</TranslatedText> {selected.joined}</p><p className="admin-muted">{selected.detail}</p>
      <div className="admin-button-stack"><Link className="button admin-button" to={`/admin/users/${encodeURIComponent(selected.email)}/edit`}><TranslatedText>{tr("Edit account")}</TranslatedText></Link></div>
    </> : <><h2><TranslatedText>{tr("Account details")}</TranslatedText></h2><p className="admin-muted"><TranslatedText>{tr("Select an account to review its access.")}</TranslatedText></p></>} />
    {dialog && <AddUserDialog onClose={() => setDialog(false)} onAdd={(user) => { setUsers((all) => [...all, user]); setSelectedEmail(user.email); setPage(Math.floor(filtered.length / pageSize) + 1); setDialog(false); setNotice(`${user.name} was added successfully.`); }} />}
    {bulkImportDialog && <BulkImportDialog onClose={() => setBulkImportDialog(false)} onSuccess={(msg) => { setBulkImportDialog(false); setNotice(msg); adminService.getUsers().then(setUsers); }} />}
  </div>;
}

export function AdminEditAccountPage() {
  const { t: tr } = useLanguage("admin");
  const { email: encodedEmail = "" } = useParams();
  const email = decodeURIComponent(encodedEmail);
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [name, setName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [role, setRole] = useState<AdminUser["role"]>("Student");
  const [status, setStatus] = useState<AdminUser["status"]>("Active");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [confirmDeactivationSave, setConfirmDeactivationSave] = useState(false);

  useEffect(() => {
    adminService.getUsers().then(users => {
      const found = users.find(u => u.email === email);
      if (found) {
        setCurrentUser(found);
        setName(found.name);
        setAccountEmail(found.email);
        setRole(found.role);
        setStatus(found.status);
      }
    }).catch(err => setLoadError(err instanceof Error ? err.message : "Could not load account.")).finally(() => setLoading(false));
  }, [email]);

  if (loading) return <div className="admin-page"><Loading label={tr("Loading account…")} /></div>;
  if (loadError) return <div className="admin-page"><PageIntro title={tr("Could not load account")} /><Notice><TranslatedText>{tr(loadError)}</TranslatedText></Notice><Link className="button admin-button" to="/admin/users"><TranslatedText>{tr("Back to users")}</TranslatedText></Link></div>;
  if (!currentUser) return <div className="admin-page"><PageIntro title={tr("Account not found")} /><p className="admin-muted"><TranslatedText>{tr("This account may have been removed or its email has changed.")}</TranslatedText></p><Link className="button admin-button" to="/admin/users"><TranslatedText>{tr("Back to users")}</TranslatedText></Link></div>;

  async function persistAccount() {
    if (!currentUser) return;
    const nextName = name.trim();
    const nextEmail = accountEmail.trim().toLowerCase();
    if (!nextName || !nextEmail) { setNotice("Name and email are required."); return; }

    setConfirmDeactivationSave(false);
    setSaving(true);
    try {
      await adminService.updateUser(currentUser.email, {
        name: nextName,
        email: nextEmail,
        role,
        status
      });
      navigate("/admin/users", { state: { selectedEmail: nextEmail, notice: `Account updated for ${nextName}.` } });
    } catch (err: any) {
      setNotice(err.message || "Failed to update account.");
      setSaving(false);
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (currentUser?.status !== "Inactive" && status === "Inactive") {
      setConfirmDeactivationSave(true);
      return;
    }
    void persistAccount();
  }


  return <div className="admin-page">
    <div className="admin-edit-layout admin-account-edit-layout">
      <form className="admin-edit-form" onSubmit={save}>
        <div className="admin-account-form-header">
          <div><h1><TranslatedText>{tr("Account information")}</TranslatedText></h1><p className="admin-muted"><TranslatedText>{tr("Update this user’s profile, role, and sign-in status.")}</TranslatedText></p></div>
          <Link className="button admin-button" to="/admin/users"><TranslatedText>{tr("Back to users")}</TranslatedText></Link>
        </div>
        <div className="admin-account-fields">
        <Field label={tr("FULL NAME")}><input value={name} onChange={(event) => setName(event.target.value)} required /></Field>
        <Field label={tr("EMAIL ADDRESS")}><input type="email" value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} required /></Field>
        <Field label={tr("ROLE")}><select value={role} onChange={(event) => setRole(event.target.value as AdminUser["role"])}><option value="Student">{tr("Student")}</option><option value="Lecturer">{tr("Lecturer")}</option><option value="Admin">{tr("Admin")}</option></select></Field>
        <Field label={tr("ACCOUNT STATUS")}><select value={status} onChange={(event) => setStatus(event.target.value as AdminUser["status"])}><option value="Active">{tr("Active")}</option><option value="Inactive">{tr("Inactive")}</option><option value="Pending">{tr("Pending")}</option></select></Field>
        </div>
        {notice && <Notice><TranslatedText>{tr(notice)}</TranslatedText></Notice>}
        <div className="admin-edit-actions"><Link className="button admin-button" to="/admin/users"><TranslatedText>{tr("Cancel")}</TranslatedText></Link><button className="button primary admin-button" disabled={saving}><TranslatedText>{saving ? tr("Saving...") : tr("Save changes")}</TranslatedText></button></div>
      </form>
    </div>
    {confirmDeactivationSave && <Dialog title={tr("Deactivate account")} onClose={() => setConfirmDeactivationSave(false)} className="admin-dialog">
      <div className="admin-dialog-form">
        <p><TranslatedText>{tr("Save these changes and deactivate")}</TranslatedText> <strong>{currentUser.name}</strong> ({currentUser.email}<TranslatedText>{tr(")? They will no longer be able to sign in. Their classes and submissions will be retained.")}</TranslatedText></p>
        <div className="admin-dialog-actions"><button type="button" className="button" onClick={() => setConfirmDeactivationSave(false)}><TranslatedText>{tr("Cancel")}</TranslatedText></button><button type="button" className="button admin-reject-button" onClick={() => void persistAccount()}><TranslatedText>{tr("Save and deactivate")}</TranslatedText></button></div>
      </div>
    </Dialog>}
  </div>;
}

function RejectLecturerDialog({
  request,
  onClose,
  onReject,
}: {
  request: any;
  onClose: () => void;
  onReject: (reason: string) => void;
}) {
  const { t: tr } = useLanguage("admin");
  const [reason, setReason] = useState("");
  return <Dialog title={tr("Reject lecturer request")} onClose={onClose} className="admin-reject-dialog">
    <form className="admin-dialog-form" onSubmit={(event) => { event.preventDefault(); onReject(reason.trim()); }}>
      <p className="admin-muted">{request.name} · {request.email}</p>
      <Field label={tr("REASON (OPTIONAL, SENT TO APPLICANT)")}>
        <textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={tr("Explain why this request was declined…")} />
      </Field>
      <div className="admin-dialog-actions">
        <button type="button" className="button admin-button" onClick={onClose}><TranslatedText>{tr("Cancel")}</TranslatedText></button>
        <button className="button admin-button admin-reject-button"><TranslatedText>{tr("Reject request")}</TranslatedText></button>
      </div>
    </form>
  </Dialog>;
}

export function AdminLecturerApprovalsPage() {
  const { t: tr } = useLanguage("admin");
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedEmail, setSelectedEmail] = useState("");
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    adminService.getLecturerRequests().then(data => {
      setRequests(data);
      if (data.length > 0) setSelectedEmail(data[0].email);
      setLoading(false);
    }).catch(err => {
      setLoadError(err instanceof Error ? err.message : "Could not load lecturer requests.");
      setLoading(false);
    });
  }, []);

  const selected = requests.find((request) => request.email === selectedEmail) || requests[0];

  async function resolveRequest(request: any, approved: boolean, reason = "") {
    try {
      if (approved) {
        await adminService.approveLecturerRequest(request.id);
        setNotice(`${request.name} was approved as a lecturer.`);
      } else {
        await adminService.rejectLecturerRequest(request.id);
        setNotice(`${request.name}'s request was rejected.${reason ? " The reason was not sent because the server does not accept it." : ""}`);
      }
      const next = requests.filter((item) => item.email !== request.email);
      setRequests(next);
      setSelectedEmail(next[0]?.email || "");
      setRejecting(null);
    } catch (err: any) {
      setNotice(err.message || "Action failed.");
      setRejecting(null);
    }
  }

  return <div className="admin-page admin-approvals-page">
    <PageIntro title={tr("Lecturer approvals")} sub={tr("People & access / {value0} pending lecturer requests", { value0: requests.length })} />
    <div className="admin-section-tabs">
      <Link to="/admin/users"><TranslatedText>{tr("All users")}</TranslatedText></Link>
      <Link className="active" to="/admin/users/approvals"><TranslatedText>{tr("Lecturer approvals (")}</TranslatedText>{requests.length})</Link>
    </div>
    {notice && <Notice><TranslatedText>{tr(notice)}</TranslatedText></Notice>}
    {loading ? <Loading label={tr("Loading lecturer requests…")} /> : loadError ? <p className="admin-notice" role="alert"><TranslatedText>{tr(loadError)}</TranslatedText></p> :
    <Split main={<>
      <div className="admin-table-wrap sticky-list-table-wrap"><table className="admin-table sticky-list-table admin-approval-table"><thead><tr><th><TranslatedText>{tr("NAME / EMAIL")}</TranslatedText></th><th><TranslatedText>{tr("DEPARTMENT")}</TranslatedText></th><th><TranslatedText>{tr("SUBMITTED")}</TranslatedText></th><th><TranslatedText>{tr("STATUS")}</TranslatedText></th></tr></thead><tbody>
        {requests.map((request) => <tr key={request.email} className={request.email === selected?.email ? "is-selected" : ""} onClick={() => setSelectedEmail(request.email)}>
          <td data-label={tr("NAME / EMAIL")}><button className="admin-row-link" type="button" onClick={() => setSelectedEmail(request.email)}>{request.name}</button><small>{request.email}</small></td>
          <td data-label={tr("DEPARTMENT")}>{request.department}</td><td data-label={tr("SUBMITTED")}>{request.submitted}</td><td data-label={tr("STATUS")} className="admin-warning"><TranslatedText>{tr("Pending")}</TranslatedText></td>
        </tr>)}
        {!requests.length && <tr><td colSpan={4} className="admin-muted"><TranslatedText>{tr("No lecturer registrations are waiting for approval.")}</TranslatedText></td></tr>}
      </tbody></table></div>
      <p className="admin-table-footer"><TranslatedText>{tr("Showing")}</TranslatedText> {requests.length} <TranslatedText>{tr("pending requests")}</TranslatedText></p>
    </>} side={selected ? <>
      <h2><TranslatedText>{tr("Request details")}</TranslatedText></h2><h3 className="admin-detail-title">{selected.name}</h3><p className="admin-muted">{selected.email}</p><div className="admin-detail-divider" />
      <Field label={tr("DEPARTMENT")}><input value={selected.department} readOnly /></Field>
      <p className="admin-warning admin-detail-status"><TranslatedText>{tr("Pending · Submitted")}</TranslatedText> {selected.submitted}</p>
      <p className="admin-muted"><TranslatedText>{tr("Registered as Lecturer")}</TranslatedText><br /><TranslatedText>{tr("Lecturer access stays locked until approved.")}</TranslatedText></p>
      <button className="button primary admin-button" type="button" onClick={() => resolveRequest(selected, true)}><TranslatedText>{tr("Approve lecturer")}</TranslatedText></button>
      <div className="admin-detail-divider" />
      <button className="admin-danger-link" type="button" onClick={() => setRejecting(selected)}><TranslatedText>{tr("Reject request")}</TranslatedText></button>
      <p className="admin-muted"><TranslatedText>{tr("Lecturer access stays locked. The server does not send the entered reason.")}</TranslatedText></p>
    </> : <><h2><TranslatedText>{tr("Request details")}</TranslatedText></h2><p className="admin-muted"><TranslatedText>{tr("There are no pending lecturer requests.")}</TranslatedText></p></>} />}
    {rejecting && <RejectLecturerDialog request={rejecting} onClose={() => setRejecting(null)} onReject={(reason) => resolveRequest(rejecting, false, reason)} />}
  </div>;
}

export function AdminRolesPage() {
  const { t: tr } = useLanguage("admin");
  const [selectedRole, setSelectedRole] = useState<AdminRoleName>("Lecturer");
  const policy = defaultAdminRolePolicy;
  const roleInfo: Record<AdminRoleName, { title: string; description: string }> = {
    Student: { title: "Learning access", description: "Run and submit SQL for assigned work, and practice from the shared problem library." },
    Lecturer: { title: "Teaching access", description: "Create problems, assign work and review results in assigned classes." },
    Admin: { title: "System access", description: "Manage accounts, courses, classes, the Practice catalog, and platform activity." },
  };
  const enabledCount = adminCapabilities.filter(({ key }) => policy.permissions[key]?.[selectedRole]).length;
  return <div className="admin-page admin-roles-page">
    <h1 className="sr-only"><TranslatedText>{tr("Roles & permissions")}</TranslatedText></h1>
    <Split main={<div className="admin-table-wrap sticky-list-table-wrap"><table className="admin-table sticky-list-table admin-permissions-table"><thead><tr><th><TranslatedText>{tr("CAPABILITY")}</TranslatedText></th><th><TranslatedText>{tr("STUDENT")}</TranslatedText></th><th><TranslatedText>{tr("LECTURER")}</TranslatedText></th><th><TranslatedText>{tr("ADMIN")}</TranslatedText></th></tr></thead><tbody>{adminCapabilities.map(({ key, label }) => <tr key={key}><td data-label={tr("CAPABILITY")}><TranslatedText>{tr(label)}</TranslatedText></td>{(["Student", "Lecturer", "Admin"] as const).map((role) => {
      const enabled = policy.permissions[key]?.[role] ?? false;
      return <td data-label={tr(role.toUpperCase())} key={role}><span className={enabled ? "admin-success" : "admin-muted"}><TranslatedText>{enabled ? tr("Allowed") : "—"}</TranslatedText></span></td>;
    })}</tr>)}</tbody></table></div>} side={<>
      <div className="admin-role-tabs">{(["Student", "Lecturer", "Admin"] as const).map((role) => <button type="button" key={role} className={selectedRole === role ? "active" : ""} onClick={() => setSelectedRole(role)}><TranslatedText>{tr(role)}</TranslatedText></button>)}</div>
      <h3 className="admin-detail-title"><TranslatedText>{tr(roleInfo[selectedRole].title)}</TranslatedText></h3><p className="admin-muted"><TranslatedText>{tr(roleInfo[selectedRole].description)}</TranslatedText></p><div className="admin-detail-divider" /><h3 className="admin-subheading"><TranslatedText>{tr("Effective access")}</TranslatedText></h3>
      <p className="admin-role-summary">{enabledCount} <TranslatedText>{tr("of")}</TranslatedText> {adminCapabilities.length} <TranslatedText>{tr("capabilities enabled")}</TranslatedText></p>
      <dl className="teacher-list-detail-facts"><div><dt><TranslatedText>{tr("Class access")}</TranslatedText></dt><dd><TranslatedText>{tr(policy.scopes[selectedRole].classAccess)}</TranslatedText></dd></div><div><dt><TranslatedText>{tr("Problem access")}</TranslatedText></dt><dd><TranslatedText>{tr(policy.scopes[selectedRole].problemAccess)}</TranslatedText></dd></div></dl>
      <p className="admin-muted"><TranslatedText>{tr("This guide describes intended product roles. The server enforces access; these detailed capability labels are not fetched from it.")}</TranslatedText></p>
    </>} />
  </div>;
}

function CourseDialog({ onClose, onCreate, error, busy }: { onClose: () => void; onCreate: (id: string, course: string, term: string) => void; error: string; busy: boolean }) {
  const { t: tr } = useLanguage("admin");
  const [newClassForm, setNewClassForm] = useState({
    id: "",
    course: "",
    term: ""
  });

  return (
    <Dialog title={tr("Create a new class")} onClose={onClose}>
      <form className="teacher-manage-dialog" onSubmit={(e) => { e.preventDefault(); if (newClassForm.id.trim() && newClassForm.course.trim() && newClassForm.term) onCreate(newClassForm.id.trim(), newClassForm.course.trim(), newClassForm.term); }}>
        <p className="tiny muted"><TranslatedText>{tr("Set up a new class or section")}</TranslatedText></p>

        <label className="teacher-field" style={{ marginTop: "1rem" }}>
          <span><TranslatedText>{tr("CLASS CODE")}</TranslatedText></span>
          <input required autoFocus value={newClassForm.id} onChange={e => setNewClassForm({...newClassForm, id: e.target.value})} placeholder={tr("E.g. IS207.R14")} />
        </label>

        <label className="teacher-field">
          <span><TranslatedText>{tr("COURSE NAME")}</TranslatedText></span>
          <input required value={newClassForm.course} onChange={e => setNewClassForm({...newClassForm, course: e.target.value})} placeholder={tr("E.g. Web Development")} />
        </label>

        <label className="teacher-field">
          <span><TranslatedText>{tr("TERM")}</TranslatedText></span>
          <select required value={newClassForm.term} onChange={e => setNewClassForm({...newClassForm, term: e.target.value})}>
            <option value="" disabled>{tr("Select a term...")}</option>
            {academicTerms().map(t => (
              <option key={t} value={t}>{tr(t)}</option>
            ))}
          </select>
        </label>

        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
          <button type="button" className="button" onClick={onClose}><TranslatedText>{tr("Cancel")}</TranslatedText></button>
          <button className="button primary" disabled={busy} type="submit"><TranslatedText>{busy ? tr("Creating…") : tr("Create class")}</TranslatedText></button>
        </div>
        {error && <p className="admin-notice" role="alert"><TranslatedText>{tr(error)}</TranslatedText></p>}
      </form>
    </Dialog>
  );
}

export function AdminCoursesPage() {
  const { t: tr } = useLanguage("admin");
  const location = useLocation();
  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [showCourseDetails, setShowCourseDetails] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [semester, setSemester] = useState("All semesters");
  const [dialog, setDialog] = useState(false);
  const [notice, setNotice] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getClasses().then((classesData) => {
      setClasses(classesData);
      if (classesData.length > 0 && !selectedId) {
        setSelectedId(classesData[0].id);
      }
    }).catch((error) => setLoadError(error instanceof Error ? error.message : "Could not load classes.")).finally(() => setLoading(false));
  }, []);


  useEffect(() => {
    if (loading) return;
    const state = location.state as { selectedId?: string; notice?: string } | null;
    if (state?.selectedId) {
      setSelectedId(state.selectedId);
      const index = visible.findIndex(item => item.id === state.selectedId);
      if (index >= 0) setPage(Math.floor(index / pageSize) + 1);
    }
    if (state?.notice) setNotice(state.notice);
    if (state) window.history.replaceState({}, document.title);
  }, [location.state, loading]);

  const visible = classes.filter((item) =>
    `${item.course} ${item.id} ${item.lecturer}`.toLowerCase().includes(query.toLowerCase()) &&
    (semester === "All semesters" || item.semester === semester));
  const semesters = [...new Set(classes.map((item) => item.semester).filter(Boolean))].sort().reverse();
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageClasses = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = pageClasses.find(item => item.id === selectedId) || pageClasses[0];

  useEffect(() => { setPage(current => Math.min(current, pageCount)); }, [pageCount]);

  if (loading) return <div className="admin-page compact-tables-page compact-admin-list-page admin-course-page"><h1 className="sr-only"><TranslatedText>{tr("Courses & classes")}</TranslatedText></h1><Loading label={tr("Loading courses and classes…")} /></div>;
  if (loadError) return <div className="admin-page compact-tables-page compact-admin-list-page admin-course-page"><h1 className="sr-only"><TranslatedText>{tr("Courses & classes")}</TranslatedText></h1><ErrorState title={tr("Could not load courses")} message={tr(loadError)} onRetry={() => window.location.reload()} /></div>;

  return <div className={"admin-page compact-tables-page compact-admin-list-page admin-course-page" + (showCourseDetails ? " show-course-details" : "")}>
    <h1 className="sr-only"><TranslatedText>{tr("Courses & classes")}</TranslatedText></h1>
    <div className="admin-course-filter-row">
      <Field label={tr("SEARCH")}><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={tr("Search course or class...")} /></Field>
      <div className="admin-course-options">
        <Field label={tr("SEMESTER")}><select value={semester} onChange={(event) => { setSemester(event.target.value); setPage(1); }}><option value="All semesters">{tr("All semesters")}</option>{semesters.map((term) => <option key={term} value={term}>{tr(term)}</option>)}</select></Field>
        <button className="button primary admin-button" onClick={() => { setCreateError(""); setDialog(true); }}><TranslatedText>{tr("Add class")}</TranslatedText></button>
      </div>
    </div>
    {loadError && <Notice><TranslatedText>{tr(loadError)}</TranslatedText></Notice>}{notice && <Notice><TranslatedText>{tr(notice)}</TranslatedText></Notice>}
    <Split main={<><div className="admin-table-wrap compact-table-scroll" role="region" aria-label={tr("Courses and classes table")} tabIndex={0}><table className="admin-table admin-course-table"><thead><tr><th><TranslatedText>{tr("COURSE / CLASS")}</TranslatedText></th><th><TranslatedText>{tr("LECTURER")}</TranslatedText></th><th><TranslatedText>{tr("STUDENTS")}</TranslatedText></th><th><TranslatedText>{tr("STATUS")}</TranslatedText></th></tr></thead><tbody>{pageClasses.map((item) => <tr key={item.id} className={item.id === selected?.id ? "is-selected" : ""} onClick={() => { setSelectedId(item.id); setShowCourseDetails(true); }}><td data-label={tr("COURSE / CLASS")}><button className="admin-row-link" onClick={() => { setSelectedId(item.id); setShowCourseDetails(true); }}>{item.course}</button><small>{item.id}</small></td><td data-label={tr("LECTURER")} className={item.lecturer === "Unassigned" ? "admin-warning" : ""}>{item.lecturer}</td><td data-label={tr("STUDENTS")}>{item.students}</td><td data-label={tr("STATUS")} className={item.status === "Active" ? "admin-success" : "admin-warning"}><TranslatedText>{tr(item.status)}</TranslatedText></td></tr>)}</tbody></table>{!loadError && classes.length === 0 && <p className="admin-table-footer"><TranslatedText>{tr("No classes yet. Add a class to get started.")}</TranslatedText></p>}{!loadError && classes.length > 0 && visible.length === 0 && <p className="admin-table-footer"><TranslatedText>{tr("No classes match these filters.")}</TranslatedText></p>}</div><AdminListPagination total={visible.length} page={currentPage} onPageChange={setPage} label={tr("Course and class pages")} noun={tr("classes")} alwaysVisible /></>} side={selected ? <>
      <div className="admin-compact-panel-header"><h2>{selected.id}</h2><button type="button" className="text-button compact-panel-back" onClick={() => setShowCourseDetails(false)}><TranslatedText>{tr("Back to classes")}</TranslatedText></button></div><h3 className="admin-detail-title">{selected.course.split(" · ")[1] || selected.course}</h3><p className={selected.status === "Active" ? "admin-success" : "admin-warning"}><TranslatedText>{tr(selected.status)}</TranslatedText><TranslatedText>{selected.lecturer === "Unassigned" ? tr("· Lecturer needed") : ""}</TranslatedText></p><div className="admin-detail-divider" />
      <Field label={tr("SEMESTER")}><select value={selected.semester} onChange={async (event) => {
        const newSemester = event.target.value;
        try {
          const res = await adminService.updateClass(selected.id, { semester: newSemester });
          setClasses(all => all.map(c => c.id === selected.id ? res : c));
          setNotice(`${selected.id} semester updated.`);
        } catch (error) { setNotice(error instanceof Error ? error.message : "Could not update semester."); }
      }}>
        {academicTerms(selected.semester).map(t => (
          <option key={t} value={t}>{tr(t)}</option>
        ))}
      </select></Field>
      <Field label={tr("CLASS DATES")}><input readOnly value={selected.startDate && selected.endDate ? `${selected.startDate} – ${selected.endDate}` : selected.dates} /></Field><p className="admin-muted">{selected.students} <TranslatedText>{tr("enrolled student")}</TranslatedText><TranslatedText>{selected.students === 1 ? "" : tr("s")}</TranslatedText></p>
      <div className="admin-button-stack"><Link className="button admin-button" to={`/admin/courses/classes/${encodeURIComponent(selected.id)}/edit`}><TranslatedText>{tr("Edit class")}</TranslatedText></Link></div>
    </> : <h2><TranslatedText>{tr("Class details")}</TranslatedText></h2>} />
    {dialog && <CourseDialog error={createError} busy={creating} onClose={() => setDialog(false)} onCreate={async (id, course, term) => {
      if (classes.some((item) => item.id.toLowerCase() === id.toLowerCase())) { setCreateError(`A class with ID ${id} already exists.`); return; }
      setCreating(true);
      setCreateError("");
      try {
        const item = await adminService.createClass({ id, course, semester: term, lecturerId: "Unassigned" });
        setClasses((all) => [...all, item]); setSelectedId(id); setQuery(""); setSemester("All semesters"); setPage(Math.floor(classes.length / pageSize) + 1); setDialog(false); setNotice(`${id} was added.`);
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : "Could not create class.");
      } finally { setCreating(false); }
    }} />}
  </div>;
}

export function AdminEditClassPage() {
  const { t: tr } = useLanguage("admin");
  const { classId: routeId = "" } = useParams();
  const classId = decodeURIComponent(routeId);
  const navigate = useNavigate();
  const [record, setRecord] = useState<AdminClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [course, setCourse] = useState("");
  const [semester, setSemester] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [lecturer, setLecturer] = useState("Unassigned");
  const [status, setStatus] = useState<AdminClass["status"]>("Draft");
  const [notice, setNotice] = useState("");
  const [lecturers, setLecturers] = useState<{name: string, id: string}[]>([]);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<TeacherClassMember[]>([]);
  const [students, setStudents] = useState<TeacherClassMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState("");
  const [membersNotice, setMembersNotice] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberTab, setMemberTab] = useState<"remove" | "add">("remove");
  const [bulkImportDialog, setBulkImportDialog] = useState(false);
  const [memberBusyId, setMemberBusyId] = useState("");

  useEffect(() => {
    Promise.all([
      adminService.getClasses(),
      adminService.getUsers()
    ]).then(([classes, users]) => {
      const cls = classes.find(c => c.id === classId);
      if (cls) {
        setRecord(cls);
        setCourse(cls.course);
        setSemester(cls.semester);
        setStartDate(cls.startDate || "");
        setEndDate(cls.endDate || "");
        setLecturer(cls.lecturerId || "Unassigned");
        setStatus(cls.status as AdminClass["status"]);
      }
      setLecturers(users.filter((user: any) => user.role.toLowerCase() === "lecturer" || user.role === "instructor").map((user: any) => ({ name: user.name, id: user.id })));
      setLoading(false);
    }).catch((error) => { setLoadError(error instanceof Error ? error.message : "Could not load class details."); setLoading(false); });
  }, [classId]);

  useEffect(() => {
    let active = true;
    setMembersLoading(true);
    setMembersError("");
    Promise.all([teacherService.getClassMembers(classId), teacherService.getAllStudents()])
      .then(([classMembers, allStudents]) => {
        if (!active) return;
        setMembers(classMembers);
        setStudents(allStudents);
      })
      .catch((error) => {
        if (active) setMembersError(error instanceof Error ? error.message : "Could not load class members.");
      })
      .finally(() => { if (active) setMembersLoading(false); });
    return () => { active = false; };
  }, [classId]);

  if (loading) return <div className="admin-page"><Loading label={tr("Loading class details…")} /></div>;
  if (loadError) return <div className="admin-page"><Notice><TranslatedText>{tr(loadError)}</TranslatedText></Notice></div>;
  if (!record) return <div className="admin-page"><p className="admin-muted"><TranslatedText>{tr("This class may have been removed.")}</TranslatedText></p></div>;

  const currentRecord = record;

  const enrolledIds = new Set(members.map((member) => member.id).filter(Boolean));
  const normalizedMemberSearch = memberSearch.trim().toLowerCase();
  const filteredMembers = members.filter((member) =>
    `${member.name} ${member.id || ""} ${member.email || ""}`.toLowerCase().includes(normalizedMemberSearch),
  );
  const availableStudents = students.filter((student) =>
    student.id && !enrolledIds.has(student.id) &&
    `${student.name} ${student.id} ${student.email || ""}`.toLowerCase().includes(normalizedMemberSearch),
  );
  const availableStudentCount = students.filter((student) => student.id && !enrolledIds.has(student.id)).length;

  async function changeMembership(student: TeacherClassMember, action: "add" | "remove") {
    if (!student.id || memberBusyId) return;
    setMemberBusyId(student.id);
    setMembersError("");
    setMembersNotice("");
    try {
      if (action === "add") {
        const added = await teacherService.addClassMember(classId, { student_id: student.id });
        setMembers((current) => [...current, added].sort((a, b) => a.name.localeCompare(b.name)));
        setMembersNotice(`${student.name} added to this class.`);
      } else {
        await teacherService.removeClassMember(classId, student.id);
        setMembers((current) => current.filter((member) => member.id !== student.id));
        setMembersNotice(`${student.name} removed from this class.`);
      }
      setRecord((current) => current ? { ...current, students: Math.max(0, current.students + (action === "add" ? 1 : -1)) } : current);
    } catch (error) {
      setMembersError(error instanceof Error ? error.message : `Could not ${action} this student.`);
    } finally {
      setMemberBusyId("");
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!startDate.trim() || !endDate.trim()) { setNotice("Class dates are required."); return; }
    if (endDate < startDate) { setNotice("End date must be after the start date."); return; }
    setSaving(true);
    setNotice("");
    try {
      await adminService.updateClass(currentRecord.id, { course, semester, lecturerId: lecturer, status, startDate, endDate });
      navigate("/admin/courses", { state: { selectedId: currentRecord.id, notice: `${currentRecord.id} class details saved.` } });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not save class details.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="admin-page">
    <div className="admin-edit-layout admin-class-edit-layout">
    <form className="admin-edit-form admin-class-form" onSubmit={save}>
      <h2>{currentRecord.id} <TranslatedText>{tr("· Class details")}</TranslatedText></h2>
      <Field label={tr("CLASS ID")}><input value={currentRecord.id} readOnly /><small className="admin-muted"><TranslatedText>{tr("Class IDs stay fixed so existing student work keeps its link.")}</TranslatedText></small></Field>
      <Field label={tr("COURSE")}><input value={course} onChange={(event) => setCourse(event.target.value)} /></Field>
      <Field label={tr("SEMESTER")}><select value={semester} onChange={(event) => setSemester(event.target.value)}>
        {academicTerms(semester).map(t => (
          <option key={t} value={t}>{tr(t)}</option>
        ))}
      </select></Field>
      <Field label={tr("LECTURER")}><select value={lecturer} onChange={(event) => setLecturer(event.target.value)}><option value="Unassigned">{tr("Unassigned")}</option>{lecturers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
      <Field label={tr("CLASS STATUS")}><select value={status} onChange={(event) => setStatus(event.target.value as AdminClass["status"])}><option value="Draft">{tr("Draft")}</option><option value="Active">{tr("Active")}</option><option value="Archived">{tr("Archived")}</option></select></Field>
      {notice && <Notice><TranslatedText>{tr(notice)}</TranslatedText></Notice>}
      <div className="admin-class-form-bottom">
        <div className="admin-class-date-row">
          <Field label={tr("START DATE")}><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></Field>
          <Field label={tr("END DATE")}><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></Field>
        </div>
        <div className="admin-edit-actions admin-class-inline-actions"><Link className="button admin-button" to="/admin/courses"><TranslatedText>{tr("Cancel")}</TranslatedText></Link><button className="button primary admin-button" disabled={saving}><TranslatedText>{saving ? tr("Saving…") : tr("Save class")}</TranslatedText></button></div>
      </div>
    </form>
    <aside className="admin-edit-form admin-edit-members" aria-labelledby="admin-class-members-title">
      <div className="admin-members-heading">
        <div><h2 id="admin-class-members-title"><TranslatedText>{tr("Manage members")}</TranslatedText></h2><p className="admin-muted"><TranslatedText>{tr("Add students to or remove them from this class.")}</TranslatedText></p></div>
      </div>
      {membersError && <Notice><TranslatedText>{tr(membersError)}</TranslatedText></Notice>}
      {membersNotice && <p className="admin-member-notice" role="status"><TranslatedText>{tr(membersNotice)}</TranslatedText></p>}
      {membersLoading ? <Loading label={tr("Loading class members…")} /> : <>
        <Field label={tr("SEARCH STUDENTS")}><input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder={tr("Search by name, ID, or email...")} /></Field>
        <div className="admin-member-tabs" role="tablist" aria-label={tr("Manage class members")}>
          <button id="remove-students-tab" type="button" role="tab" aria-selected={memberTab === "remove"} aria-controls="remove-students-panel" className={memberTab === "remove" ? "is-active" : ""} onClick={() => setMemberTab("remove")}><TranslatedText>{tr("Remove students")}</TranslatedText> <span>{members.length}</span></button>
          <button id="add-students-tab" type="button" role="tab" aria-selected={memberTab === "add"} aria-controls="add-students-panel" className={memberTab === "add" ? "is-active" : ""} onClick={() => setMemberTab("add")}><TranslatedText>{tr("Add students")}</TranslatedText> <span>{availableStudentCount}</span></button>
          <button id="import-students-tab" type="button" role="tab" aria-selected={false} className="" onClick={() => setBulkImportDialog(true)}><TranslatedText>{tr("Import CSV")}</TranslatedText> <span>+</span></button>
        </div>
        {memberTab === "remove" ? <section id="remove-students-panel" className="admin-member-list" role="tabpanel" aria-labelledby="remove-students-tab">
          {filteredMembers.map((member) => <div className="admin-member-row" key={member.id || member.email}>
            <div><strong>{member.name}</strong><small>{member.email}</small></div>
            <button className="admin-member-remove" type="button" disabled={Boolean(memberBusyId)} onClick={() => void changeMembership(member, "remove")}><TranslatedText>{memberBusyId === member.id ? "…" : tr("Remove")}</TranslatedText></button>
          </div>)}
          {!filteredMembers.length && <p className="admin-member-empty"><TranslatedText>{members.length ? tr("No enrolled students match this search.") : tr("No students are enrolled yet.")}</TranslatedText></p>}
        </section> : <section id="add-students-panel" className="admin-member-list" role="tabpanel" aria-labelledby="add-students-tab">
          {availableStudents.map((student) => <div className="admin-member-row" key={student.id}>
            <div><strong>{student.name}</strong><small>{student.email}</small></div>
            <button className="admin-member-add" type="button" disabled={Boolean(memberBusyId)} onClick={() => void changeMembership(student, "add")}><TranslatedText>{memberBusyId === student.id ? "…" : tr("Add")}</TranslatedText></button>
          </div>)}
          {!availableStudents.length && <p className="admin-member-empty"><TranslatedText>{students.every((student) => !student.id || enrolledIds.has(student.id)) ? tr("All students are already in this class.") : tr("No available students match this search.")}</TranslatedText></p>}
        </section>}
      </>}
    </aside>
    </div>
    {bulkImportDialog && <BulkImportMembersDialog classId={classId} onClose={() => setBulkImportDialog(false)} onSuccess={(msg) => { setBulkImportDialog(false); setMembersNotice(msg); teacherService.getClassMembers(classId).then((data) => setMembers(data)).catch(() => {}); }} />}
  </div>;
}

export function AdminLecturersPage() {
  const { t: tr } = useLanguage("admin");
  const location = useLocation();
  const state = location.state as { selectedId?: string } | null;
  const initialSelectedId = state?.selectedId || "";

  const [assignments, setAssignments] = useState<AdminClass[]>([]);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [lecturer, setLecturer] = useState("Unassigned");
  const [notice, setNotice] = useState("");
  const [lecturers, setLecturers] = useState<{name: string, id: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      adminService.getClasses(),
      adminService.getUsers()
    ]).then(([classes, users]) => {
      const sorted = [...classes].sort((a, b) => Number(b.lecturer === "Unassigned") - Number(a.lecturer === "Unassigned"));
      setAssignments(sorted);
      if (sorted.length > 0 && !selectedId) {
        setSelectedId(sorted[0].id);
        setLecturer(sorted[0].lecturerId || "Unassigned");
      } else if (selectedId) {
        const cls = sorted.find(c => c.id === selectedId);
        if (cls) setLecturer(cls.lecturerId || "Unassigned");
      }
      setLecturers(users.filter((user: any) => user.role.toLowerCase() === "lecturer" || user.role === "instructor").map((user: any) => ({ name: user.name, id: user.id })));
    }).catch((error) => setLoadError(error instanceof Error ? error.message : "Could not load classes and lecturers.")).finally(() => setLoading(false));
  }, []);

  const selected = assignments.find((item) => item.id === selectedId);

  return <div className="admin-page">
    <PageIntro title={tr("Lecturer assignment")} sub={tr("Class ownership / {value0}", { value0: selected?.semester || "" })}>
      <button className="button primary admin-button" disabled={!selected || saving || lecturer === (selected.lecturerId || "Unassigned")} onClick={async () => {
        if (!selected) return;
        setSaving(true);
        setNotice("");
        try {
          const updated = await adminService.updateClass(selectedId, { lecturerId: lecturer === "Unassigned" ? "Unassigned" : lecturer });
          setAssignments((all) => all.map((item) => item.id === selectedId ? updated : item));
          setNotice(`${updated.lecturer} assigned to ${selectedId}.`);
        } catch (err) {
          setNotice(err instanceof Error ? err.message : "Could not assign lecturer.");
        } finally {
          setSaving(false);
        }
      }}><TranslatedText>{saving ? tr("Saving…") : tr("Save assignment")}</TranslatedText></button>
    </PageIntro>{notice && <Notice><TranslatedText>{tr(notice)}</TranslatedText></Notice>}
    {loading ? <Loading label={tr("Loading classes and lecturers…")} /> : loadError ? <p className="admin-notice" role="alert"><TranslatedText>{tr(loadError)}</TranslatedText></p> : assignments.length === 0 ? <p className="admin-muted"><TranslatedText>{tr("No classes are available for lecturer assignment.")}</TranslatedText></p> :
    <Split main={<div className="admin-table-wrap sticky-list-table-wrap"><table className="admin-table sticky-list-table admin-lecturer-table"><thead><tr><th><TranslatedText>{tr("CLASS")}</TranslatedText></th><th><TranslatedText>{tr("CURRENT LECTURER")}</TranslatedText></th><th><TranslatedText>{tr("STATUS")}</TranslatedText></th></tr></thead><tbody>{assignments.map((item) => <tr key={item.id} className={item.id === selectedId ? "is-selected" : ""} onClick={() => { setSelectedId(item.id); setLecturer(item.lecturerId || "Unassigned"); }}><td data-label={tr("CLASS")}><b>{item.id}</b></td><td data-label={tr("CURRENT LECTURER")} className={item.lecturer === "Unassigned" ? "admin-warning" : ""}>{item.lecturer}</td><td data-label={tr("STATUS")}><TranslatedText>{item.lecturer === "Unassigned" ? tr("Needs lecturer") : tr("Assigned")}</TranslatedText></td></tr>)}</tbody></table></div>} side={selected ? <>
      <h2><TranslatedText>{tr("Assign")}</TranslatedText> {selected.id}</h2><p className="admin-muted">{selected.course.split(" · ")[1] || selected.course} · {selected.semester} · {selected.students} <TranslatedText>{tr("student")}</TranslatedText><TranslatedText>{selected.students === 1 ? "" : tr("s")}</TranslatedText></p><Field label={tr("LECTURER")}><select value={lecturer} onChange={(e) => setLecturer(e.target.value)}><option value="Unassigned">{tr("Unassigned")}</option>{lecturers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field><div className="admin-detail-divider" /><h3 className="admin-subheading"><TranslatedText>{tr("Access preview")}</TranslatedText></h3><p className="admin-muted"><TranslatedText>{tr("The selected lecturer can manage assignments, view class results and review submissions after assignment is saved.")}</TranslatedText></p>
    </> : <h2><TranslatedText>{tr("No class selected")}</TranslatedText></h2>} />}
  </div>;
}

type CatalogProblem = AdminPracticeProblem & { id: string };
function PracticePreviewDialog({ problem, onClose }: { problem: CatalogProblem; onClose: () => void }) {
  const { t: tr } = useLanguage("admin");
  const reviewSignal = problem.attempted ? problem.acceptance < 45
    ? "Low solve rate · consider adding a hint"
    : problem.acceptance > 80
      ? "High solve rate · suitable for an introductory set"
      : "Balanced solve rate" : "Activity statistics unavailable";
  return <Dialog title={tr("Student practice preview")} onClose={onClose} className="admin-practice-preview">
    <div className="admin-preview-heading"><h3>{problem.title}</h3><p><TranslatedText>{tr(problem.difficulty)}</TranslatedText> · {problem.topics} · {problem.database}</p></div>
    <section className="admin-preview-section"><h4><TranslatedText>{tr("Problem")}</TranslatedText></h4><p>{problem.description}</p>{problem.expectedColumns && <p className="admin-muted"><TranslatedText>{tr("Return columns:")}</TranslatedText> <code>{problem.expectedColumns}</code></p>}</section>
    <section className="admin-preview-section"><h4><TranslatedText>{tr("Available tables")}</TranslatedText></h4><pre>{problem.schemaPreview}</pre></section>
    <section className="admin-preview-insight"><b><TranslatedText>{tr("Practice signal")}</TranslatedText></b><span><TranslatedText>{tr(reviewSignal)}</TranslatedText></span>{problem.attempted > 0 && <small>{problem.attempted} <TranslatedText>{tr("attempts ·")}</TranslatedText> {problem.acceptance}<TranslatedText>{tr("% accepted")}</TranslatedText></small>}</section>
    <div className="admin-dialog-actions"><button type="button" className="button primary admin-button" onClick={onClose}><TranslatedText>{tr("Done")}</TranslatedText></button></div>
  </Dialog>;
}

export function AdminPracticeCatalogPage() {
  const { t: tr, locale: uiLocale } = useLanguage("admin");
  const [problems, setProblems] = useState<CatalogProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [showPracticeDetails, setShowPracticeDetails] = useState(false);
  const [topic, setTopic] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [difficulty, setDifficulty] = useState("All levels");
  const [visibility, setVisibility] = useState("All");
  const [notice, setNotice] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [previewing, setPreviewing] = useState<CatalogProblem | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  useEffect(() => {
    studentApi.getProblems().then(data => {
      const mapped: CatalogProblem[] = data.map((p: any) => ({
        id: p.id,
        title: p.title,
        topics: p.topics ? p.topics.join(" · ") : (p.topic || ""),
        difficulty: p.difficulty,
        solvedBy: p.solvedBy || 0,
        status: p.practiceListed ? "Visible" : "Hidden",
        author: "—",
        published: p.updatedAt ? new Date(p.updatedAt).toLocaleDateString(uiLocale) : "—",
        database: p.databaseType || "SQL Server",
        attempted: p.attempted || 0,
        acceptance: p.acceptance || 0,
        submissions: p.submissions || 0,
        comments: false,
        hints: false,
        note: "",
        featured: false,
        description: "",
        schemaPreview: "",
        expectedColumns: ""
      }));
      setProblems(mapped);
      if (mapped.length > 0) {
        setSelectedId(mapped[0].id);
      }
      setLoading(false);
    }).catch(err => {
      setCatalogError(err instanceof Error ? err.message : "Could not load the Practice catalog.");
      setLoading(false);
    });
  }, []);

  async function openPreview(problem: CatalogProblem) {
    setPreviewBusy(true);
    setNotice("");
    try {
      const detail = await studentApi.getProblem(problem.id);
      setPreviewing({ ...problem, description: detail.description || "", schemaPreview: detail.schema || "" });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load problem preview.");
    } finally {
      setPreviewBusy(false);
    }
  }

  const list = useMemo(() => problems.filter((problem) =>
    problem.title.toLowerCase().includes(query.toLowerCase()) &&
    (difficulty === "All levels" || problem.difficulty === difficulty) &&
    (visibility === "All" || problem.status === visibility) &&
    (!topic || problem.topics.split(" · ").some(name => name.trim() === topic))), [problems, query, difficulty, visibility, topic]);

  const computedTopics = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of problems) {
      if (!p.topics) continue;
      const parts = p.topics.split(" · ");
      for (const t of parts) {
        if (!t.trim()) continue;
        counts[t.trim()] = (counts[t.trim()] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, problems: count }))
      .sort((a, b) => b.problems - a.problems);
  }, [problems]);

  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageProblems = list.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = pageProblems.find(problem => problem.id === selectedId) || pageProblems[0];
  useEffect(() => { setPage(current => Math.min(current, pageCount)); }, [pageCount]);

  if (loading) {
    return <div className="admin-page compact-tables-page compact-admin-list-page admin-practice-page"><h1 className="sr-only"><TranslatedText>{tr("Practice catalog")}</TranslatedText></h1><Loading label={tr("Loading catalog…")} /></div>;
  }
  if (catalogError) return <div className="admin-page compact-tables-page compact-admin-list-page admin-practice-page"><h1 className="sr-only"><TranslatedText>{tr("Practice catalog")}</TranslatedText></h1><ErrorState title={tr("Could not load catalog")} message={tr(catalogError)} onRetry={() => window.location.reload()} /></div>;

  return <div className={"admin-page compact-tables-page compact-admin-list-page admin-practice-page" + (showPracticeDetails ? " show-practice-details" : "")}>
    <h1 className="sr-only"><TranslatedText>{tr("Practice catalog")}</TranslatedText></h1>
    {notice && <Notice><TranslatedText>{tr(notice)}</TranslatedText></Notice>}
    <div className="admin-practice-filters admin-practice-topic-filters">
      <div className="admin-practice-main-filters">
        <Field label={tr("SEARCH")}><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={tr("Search title...")} /></Field>
        <Field label={tr("TOPIC")}><select value={topic} onChange={event => { setTopic(event.target.value); setPage(1); }}><option value="">{tr("All topics")}</option>{computedTopics.map(item => <option key={item.name} value={item.name}>{item.name} ({item.problems})</option>)}</select></Field>
        <Field label={tr("DIFFICULTY")}><select value={difficulty} onChange={(event) => { setDifficulty(event.target.value); setPage(1); }}><option value="All levels">{tr("All levels")}</option><option value="Easy">{tr("Easy")}</option><option value="Medium">{tr("Medium")}</option><option value="Hard">{tr("Hard")}</option></select></Field>
      </div>
      <Field label={tr("VISIBILITY")}><select value={visibility} onChange={(event) => { setVisibility(event.target.value); setPage(1); }}><option value="All">{tr("All")}</option><option value="Visible">{tr("Visible")}</option><option value="Hidden">{tr("Hidden")}</option></select></Field>
    </div>
    <Split className="admin-practice-split" main={<><div className="admin-table-wrap compact-table-scroll" role="region" aria-label={tr("Practice problems table")} tabIndex={0}><table className="admin-table admin-practice-table"><thead><tr><th><TranslatedText>{tr("PROBLEM")}</TranslatedText></th><th><TranslatedText>{tr("TOPICS")}</TranslatedText></th><th><TranslatedText>{tr("DIFFICULTY")}</TranslatedText></th><th><TranslatedText>{tr("SOLVED BY")}</TranslatedText></th><th><TranslatedText>{tr("STATUS")}</TranslatedText></th></tr></thead><tbody>
      {pageProblems.map((problem) => <tr key={problem.id} className={problem.id === selected?.id ? "is-selected" : ""} onClick={() => { setSelectedId(problem.id); setShowPracticeDetails(true); }}>
        <td data-label={tr("PROBLEM")}><button className="admin-row-link" type="button" onClick={() => { setSelectedId(problem.id); setShowPracticeDetails(true); }}>{problem.title}</button></td><td data-label={tr("TOPICS")}>{problem.topics}</td><td data-label={tr("DIFFICULTY")}><TranslatedText>{tr(problem.difficulty)}</TranslatedText></td><td data-label={tr("SOLVED BY")}>{problem.solvedBy}</td><td data-label={tr("STATUS")} className={problem.status === "Visible" ? "admin-success" : ""}><TranslatedText>{tr(problem.status)}</TranslatedText></td>
      </tr>)}
      {!list.length && <tr><td colSpan={5} className="admin-muted"><TranslatedText>{tr("No practice problems match these filters.")}</TranslatedText></td></tr>}
    </tbody></table></div><AdminListPagination total={list.length} page={currentPage} onPageChange={setPage} label={tr("Practice problem pages")} noun={tr("problems")} alwaysVisible /></>} side={selected ? <>
      <div className="admin-compact-panel-header"><h2>{selected.title}</h2><button type="button" className="text-button compact-panel-back" onClick={() => setShowPracticeDetails(false)}><TranslatedText>{tr("Back to problems")}</TranslatedText></button></div>
      {selected.published !== "—" && <p className="admin-muted"><TranslatedText>{tr("Updated")}</TranslatedText> {selected.published}</p>}
      <p className="admin-accent"><TranslatedText>{tr(selected.difficulty)}</TranslatedText> · {selected.database}</p>
      {selected.topics && <p className="admin-muted">{selected.topics}</p>}
      <div className="admin-detail-divider" />
      <dl className="teacher-list-detail-facts">
        <div><dt><TranslatedText>{tr("Visibility")}</TranslatedText></dt><dd><TranslatedText>{tr(selected.status)}</TranslatedText></dd></div>
        <div><dt><TranslatedText>{tr("Attempts")}</TranslatedText></dt><dd>{selected.attempted}</dd></div>
        <div><dt><TranslatedText>{tr("Acceptance")}</TranslatedText></dt><dd>{selected.attempted ? selected.acceptance + "%" : "—"}</dd></div>
        <div><dt><TranslatedText>{tr("Submissions")}</TranslatedText></dt><dd>{selected.submissions}</dd></div>
      </dl>
      <div className="admin-practice-actions"><button className="button admin-button" type="button" disabled={previewBusy} onClick={() => void openPreview(selected)}><TranslatedText>{previewBusy ? tr("Loading…") : tr("View details")}</TranslatedText></button></div>
    </> : <p className="admin-muted"><TranslatedText>{tr("Select a problem.")}</TranslatedText></p>} />
    {previewing && <PracticePreviewDialog problem={previewing} onClose={() => setPreviewing(null)} />}
  </div>;
}

function OverviewPagination({ total, page, onPageChange, label }: { total: number; page: number; onPageChange: (page: number) => void; label: string }) {
  const { t: tr } = useLanguage("admin");
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  return <nav className="admin-table-pagination" aria-label={tr(label)}>
      <button type="button" className="button admin-button" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}><TranslatedText>{tr("← Previous")}</TranslatedText></button>
      <span><TranslatedText>{tr("Page")}</TranslatedText> {currentPage} <TranslatedText>{tr("of")}</TranslatedText> {pageCount}</span>
      <button type="button" className="button admin-button" disabled={currentPage === pageCount} onClick={() => onPageChange(currentPage + 1)}><TranslatedText>{tr("Next →")}</TranslatedText></button>
    </nav>;
}

function OverviewLecturerApprovalsPanel({ onClose, onResolved }: { onClose: () => void; onResolved: (pendingCount: number) => void }) {
  const { t: tr } = useLanguage("admin");
  const [requests, setRequests] = useState<(AdminLecturerRequest & { id: string })[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const selected = requests.find(request => request.id === selectedId) || requests[0];

  async function loadRequests() {
    setLoading(true);
    setError("");
    try {
      const data = await adminService.getLecturerRequests();
      setRequests(data);
      setSelectedId(data[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load lecturer requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  async function resolveRequest(approved: boolean) {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (approved) await adminService.approveLecturerRequest(selected.id);
      else await adminService.rejectLecturerRequest(selected.id);
      const remaining = requests.filter(request => request.id !== selected.id);
      setRequests(remaining);
      setSelectedId(remaining[0]?.id || "");
      setConfirmReject(false);
      setNotice(approved ? selected.name + " was approved as a lecturer." : selected.name + "'s request was rejected.");
      onResolved(remaining.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this request.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="admin-overview-approvals">
    <div className="admin-overview-panel-header"><h2><TranslatedText>{tr("Lecturer approvals")}</TranslatedText></h2><button type="button" className="text-button" disabled={busy} onClick={onClose}><TranslatedText>{tr("Close")}</TranslatedText></button></div>
    {loading ? <Loading label={tr("Loading lecturer requests…")} /> : <>
      {notice && <Notice><TranslatedText>{tr(notice)}</TranslatedText></Notice>}
      {error && <p className="admin-warning" role="alert"><TranslatedText>{tr(error)}</TranslatedText></p>}
      {selected ? <>
        <Field label={"PENDING REQUESTS (" + requests.length + ")"}><select value={selected.id} disabled={busy} onChange={event => { setSelectedId(event.target.value); setConfirmReject(false); setError(""); setNotice(""); }}>{requests.map(request => <option key={request.id} value={request.id}>{request.name} · {request.email}</option>)}</select></Field>
        <div className="admin-detail-divider" />
        <h3 className="admin-detail-title">{selected.name}</h3>
        <dl className="teacher-list-detail-facts">
          <div><dt><TranslatedText>{tr("Email")}</TranslatedText></dt><dd>{selected.email}</dd></div>
          <div><dt><TranslatedText>{tr("Department")}</TranslatedText></dt><dd>{selected.department || "—"}</dd></div>
          <div><dt><TranslatedText>{tr("Submitted")}</TranslatedText></dt><dd>{selected.submitted || "—"}</dd></div>
        </dl>
        {confirmReject ? <div className="admin-overview-reject-confirm">
          <p><TranslatedText>{tr("Reject the registration for")}</TranslatedText> <strong>{selected.name}</strong>?</p>
          <div className="admin-overview-request-actions"><button type="button" className="button admin-button" disabled={busy} onClick={() => setConfirmReject(false)}><TranslatedText>{tr("Cancel")}</TranslatedText></button><button type="button" className="button admin-button admin-reject-button" disabled={busy} onClick={() => void resolveRequest(false)}><TranslatedText>{busy ? tr("Rejecting…") : tr("Confirm rejection")}</TranslatedText></button></div>
        </div> : <div className="admin-overview-request-actions">
          <button type="button" className="button primary admin-button" disabled={busy} onClick={() => void resolveRequest(true)}><TranslatedText>{busy ? tr("Approving…") : tr("Approve lecturer")}</TranslatedText></button>
          <button type="button" className="button admin-button admin-reject-button" disabled={busy} onClick={() => setConfirmReject(true)}><TranslatedText>{tr("Reject request")}</TranslatedText></button>
        </div>}
      </> : error ? <button type="button" className="button admin-button" onClick={() => void loadRequests()}><TranslatedText>{tr("Retry")}</TranslatedText></button> : <>
        <p className="admin-muted"><TranslatedText>{tr("No pending requests.")}</TranslatedText></p>
        <button type="button" className="text-button" onClick={() => void loadRequests()}><TranslatedText>{tr("Refresh")}</TranslatedText></button>
      </>}
    </>}
  </div>;
}

function OverviewActivityPanel({ activity, onClose }: { activity: any; onClose: () => void }) {
  const { t: tr, locale: uiLocale } = useLanguage("admin");
  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const classId = /^(?:Created|Updated) class (.+)$/.exec(activity.action)?.[1];
  const relatedClass = classes.find(item => item.id === classId);
  const namedActors = users.filter(user => user.name === activity.by);
  const actor = namedActors.length === 1 ? namedActors[0] : undefined;

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([adminService.getClasses(), adminService.getUsers()]).then(([classResult, userResult]) => {
      if (cancelled) return;
      if (classResult.status === "fulfilled") setClasses(classResult.value);
      if (userResult.status === "fulfilled") setUsers(userResult.value);
      if (classResult.status === "rejected" || userResult.status === "rejected") setError("Some related information could not be loaded.");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return <div className="admin-overview-details">
    <div className="admin-overview-panel-header"><h2><TranslatedText>{tr("Activity details")}</TranslatedText></h2><button type="button" className="text-button" onClick={onClose}><TranslatedText>{tr("Close")}</TranslatedText></button></div>
    <h3 className="admin-detail-title"><TranslatedText>{tr(activity.action)}</TranslatedText></h3>
    <dl className="teacher-list-detail-facts">
      <div><dt><TranslatedText>{tr("Performed by")}</TranslatedText></dt><dd><TranslatedText>{activity.by || tr("System")}</TranslatedText></dd></div>
      <div><dt><TranslatedText>{tr("Time")}</TranslatedText></dt><dd><TranslatedText>{activity.time ? parseServerDateTime(activity.time).toLocaleString(uiLocale) : tr("Unknown")}</TranslatedText></dd></div>
    </dl>
    {loading ? <Loading label={tr("Loading related information…")} /> : <>
      {error && <p className="admin-warning" role="alert"><TranslatedText>{tr(error)}</TranslatedText></p>}
      {classId && <>
        <div className="admin-detail-divider" />
        <h3 className="admin-subheading"><TranslatedText>{tr("Current class information")}</TranslatedText></h3>
        {relatedClass ? <dl className="teacher-list-detail-facts">
          <div><dt><TranslatedText>{tr("Class code")}</TranslatedText></dt><dd>{relatedClass.id}</dd></div>
          <div><dt><TranslatedText>{tr("Course")}</TranslatedText></dt><dd>{relatedClass.course}</dd></div>
          <div><dt><TranslatedText>{tr("Semester")}</TranslatedText></dt><dd>{relatedClass.semester || "—"}</dd></div>
          <div><dt><TranslatedText>{tr("Lecturer")}</TranslatedText></dt><dd>{relatedClass.lecturer}</dd></div>
          <div><dt><TranslatedText>{tr("Students")}</TranslatedText></dt><dd>{relatedClass.students}</dd></div>
          <div><dt><TranslatedText>{tr("Status")}</TranslatedText></dt><dd><TranslatedText>{tr(relatedClass.status)}</TranslatedText></dd></div>
          <div><dt><TranslatedText>{tr("Dates")}</TranslatedText></dt><dd><TranslatedText>{relatedClass.startDate && relatedClass.endDate ? relatedClass.startDate + " – " + relatedClass.endDate : tr("Not specified")}</TranslatedText></dd></div>
        </dl> : <p className="admin-muted"><TranslatedText>{tr("Class")}</TranslatedText> <TranslatedText>{tr(classId)}</TranslatedText><TranslatedText>{tr(": current information is unavailable.")}</TranslatedText></p>}
        <p className="admin-muted admin-overview-context-note"><TranslatedText>{tr("Class information reflects its current state. This activity record does not contain the previous field values.")}</TranslatedText></p>
      </>}
      {actor && <>
        <div className="admin-detail-divider" /><h3 className="admin-subheading"><TranslatedText>{tr("Current account information")}</TranslatedText></h3>
        <dl className="teacher-list-detail-facts"><div><dt><TranslatedText>{tr("Email")}</TranslatedText></dt><dd>{actor.email}</dd></div><div><dt><TranslatedText>{tr("Role")}</TranslatedText></dt><dd><TranslatedText>{tr(actor.role)}</TranslatedText></dd></div><div><dt><TranslatedText>{tr("Status")}</TranslatedText></dt><dd><TranslatedText>{tr(actor.status)}</TranslatedText></dd></div><div><dt><TranslatedText>{tr("Joined")}</TranslatedText></dt><dd>{actor.joined}</dd></div>{actor.detail && <div><dt><TranslatedText>{tr("Department")}</TranslatedText></dt><dd>{actor.detail}</dd></div>}</dl>
      </>}
    </>}
    <details className="admin-overview-record-reference"><summary><TranslatedText>{tr("Record reference")}</TranslatedText></summary><p className="admin-muted">{activity.id}</p></details>
  </div>;
}

function OverviewUnassignedClassesPanel({ onClose }: { onClose: () => void }) {
  const { t: tr } = useLanguage("admin");
  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const selected = classes.find(item => item.id === selectedId) || classes[0];

  async function loadClasses() {
    setLoading(true);
    setError("");
    try {
      const data = await adminService.getClasses();
      const unassigned = data.filter(item => item.status !== "Archived" && item.lecturer === "Unassigned");
      setClasses(unassigned);
      setSelectedId(unassigned[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load classes.");
    } finally { setLoading(false); }
  }
  useEffect(() => { void loadClasses(); }, []);

  return <div className="admin-overview-details">
    <div className="admin-overview-panel-header"><h2><TranslatedText>{tr("Classes without a lecturer")}</TranslatedText></h2><button type="button" className="text-button" onClick={onClose}><TranslatedText>{tr("Close")}</TranslatedText></button></div>
    {loading ? <Loading label={tr("Loading classes…")} /> : error ? <><p className="admin-warning" role="alert"><TranslatedText>{tr(error)}</TranslatedText></p><button type="button" className="button admin-button" onClick={() => void loadClasses()}><TranslatedText>{tr("Retry")}</TranslatedText></button></> : selected ? <>
      <Field label={"UNASSIGNED CLASSES (" + classes.length + ")"}><select value={selected.id} onChange={event => setSelectedId(event.target.value)}>{classes.map(item => <option key={item.id} value={item.id}>{item.id} · {item.course}</option>)}</select></Field>
      <div className="admin-detail-divider" />
      <h3 className="admin-detail-title">{selected.id}</h3>
      <dl className="teacher-list-detail-facts">
        <div><dt><TranslatedText>{tr("Course")}</TranslatedText></dt><dd>{selected.course}</dd></div>
        <div><dt><TranslatedText>{tr("Semester")}</TranslatedText></dt><dd>{selected.semester || "—"}</dd></div>
        <div><dt><TranslatedText>{tr("Status")}</TranslatedText></dt><dd><TranslatedText>{tr(selected.status)}</TranslatedText></dd></div>
        <div><dt><TranslatedText>{tr("Lecturer")}</TranslatedText></dt><dd className="admin-warning"><TranslatedText>{tr("Unassigned")}</TranslatedText></dd></div>
        <div><dt><TranslatedText>{tr("Students")}</TranslatedText></dt><dd>{selected.students}</dd></div>
        <div><dt><TranslatedText>{tr("Dates")}</TranslatedText></dt><dd>{selected.startDate && selected.endDate ? selected.startDate + " – " + selected.endDate : selected.dates || "—"}</dd></div>
      </dl>
    </> : <p className="admin-muted"><TranslatedText>{tr("All classes have an assigned lecturer.")}</TranslatedText></p>}
  </div>;
}

export function AdminOverviewPage() {
  const { t: tr, locale: uiLocale } = useLanguage("admin");
  const [notice, setNotice] = useState("");
  const [stats, setStats] = useState({ users: 0, classes: 0, pendingRequests: 0, unassignedClasses: 0, submissionsToday: 0, gradingErrors: 0 });
  const [activities, setActivities] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [attentionPage, setAttentionPage] = useState(1);
  const [selection, setSelection] = useState<{ type: "attention" | "activity"; id: string } | null>(null);
  const selectedActivity = selection?.type === "activity" ? activities.find(item => item.id === selection.id) : undefined;
  const [activityPage, setActivityPage] = useState(1);
  const pageSize = 10;
  const attentionItems = [
    { id: "registrations", title: "Lecturer registrations", count: stats.pendingRequests, unit: "pending" },
    { id: "unassigned", title: "Classes without a lecturer", count: stats.unassignedClasses, unit: "class(es)" },
  ];
  const currentAttentionPage = Math.min(attentionPage, Math.max(1, Math.ceil(attentionItems.length / pageSize)));
  const currentActivityPage = Math.min(activityPage, Math.max(1, Math.ceil(activities.length / pageSize)));
  const visibleAttention = attentionItems.slice((currentAttentionPage - 1) * pageSize, currentAttentionPage * pageSize);
  const visibleActivities = activities.slice((currentActivityPage - 1) * pageSize, currentActivityPage * pageSize);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminService.getOverviewStats(),
      adminService.getActivities(),
      adminService.getErrors()
    ]).then(([statsData, activitiesData, errorsData]) => {
      setStats({
        users: statsData.users,
        classes: statsData.classes,
        pendingRequests: statsData.pendingRequests,
        unassignedClasses: statsData.unassignedClasses,
        submissionsToday: statsData.submissionsToday,
        gradingErrors: statsData.gradingErrors
      });
      setActivities(activitiesData);
      setErrors(errorsData);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setNotice("Failed to load overview data.");
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className={"admin-page compact-tables-page admin-overview-page" + (selection ? " has-overview-selection" : "")}><h1 className="sr-only"><TranslatedText>{tr("System overview")}</TranslatedText></h1><Loading label={tr("Loading overview…")} /></div>;
  }
  if (notice) return <div className={"admin-page compact-tables-page admin-overview-page" + (selection ? " has-overview-selection" : "")}><h1 className="sr-only"><TranslatedText>{tr("System overview")}</TranslatedText></h1><p className="admin-notice" role="alert"><TranslatedText>{tr(notice)}</TranslatedText></p></div>;

  return <div className={"admin-page compact-tables-page admin-overview-page" + (selection ? " has-overview-selection" : "")}>
    <h1 className="sr-only"><TranslatedText>{tr("System overview")}</TranslatedText></h1>
    <Split className="admin-overview-split" main={<>
      <section className="admin-attention">
        <div className="admin-overview-table-heading">
          <h2 className="admin-section-heading"><TranslatedText>{tr("Needs attention")}</TranslatedText></h2>
          <div className="admin-overview-table-controls">
            <span className="admin-muted" role="status"><TranslatedText>{tr("Showing")}</TranslatedText> {attentionItems.length === 0 ? 0 : (currentAttentionPage - 1) * pageSize + 1}–{Math.min(currentAttentionPage * pageSize, attentionItems.length)} <TranslatedText>{tr("of")}</TranslatedText> {attentionItems.length.toLocaleString(uiLocale)} <TranslatedText>{tr("items")}</TranslatedText></span>
            <OverviewPagination total={attentionItems.length} page={currentAttentionPage} onPageChange={setAttentionPage} label={tr("Needs attention pages")} />
          </div>
        </div>
        <div className="compact-table-scroll" role="region" aria-label={tr("Needs attention table")} tabIndex={0}>
        <table className="admin-table admin-attention-table"><thead><tr><th><TranslatedText>{tr("ITEM")}</TranslatedText></th><th><TranslatedText>{tr("COUNT")}</TranslatedText></th></tr></thead><tbody>
          {visibleAttention.map(item => {
            const isSelected = selection?.type === "attention" && selection.id === item.id;
            const selectRow = () => setSelection({ type: "attention", id: item.id });
            return <tr key={item.id} className={isSelected ? "is-selected" : ""} onClick={selectRow}>
              <td data-label={tr("ITEM")}><button type="button" className="admin-overview-row-button" aria-pressed={isSelected} onClick={selectRow}><TranslatedText>{tr(item.title)}</TranslatedText></button></td>
              <td data-label={tr("COUNT")} className={item.count > 0 ? "admin-warning" : ""}>{item.count} <TranslatedText>{tr(item.unit)}</TranslatedText></td>
            </tr>;
          })}
        </tbody></table>
        </div>
      </section>
      <section className="admin-recent-activity">
        <div className="admin-overview-table-heading">
          <h2 className="admin-section-heading"><TranslatedText>{tr("Recent activity")}</TranslatedText></h2>
          <div className="admin-overview-table-controls">
            <span className="admin-muted" role="status"><TranslatedText>{tr("Showing")}</TranslatedText> {activities.length === 0 ? 0 : (currentActivityPage - 1) * pageSize + 1}–{Math.min(currentActivityPage * pageSize, activities.length)} <TranslatedText>{tr("of")}</TranslatedText> {activities.length.toLocaleString(uiLocale)} <TranslatedText>{tr("items")}</TranslatedText></span>
            <OverviewPagination total={activities.length} page={currentActivityPage} onPageChange={setActivityPage} label={tr("Recent activity pages")} />
          </div>
        </div>
        <div className="compact-table-scroll" role="region" aria-label={tr("Recent activity table")} tabIndex={0}>
        <table className="admin-table admin-activity-table"><thead><tr><th><TranslatedText>{tr("ACTION")}</TranslatedText></th><th><TranslatedText>{tr("BY")}</TranslatedText></th><th><TranslatedText>{tr("TIME")}</TranslatedText></th></tr></thead><tbody>
          {activities.length > 0 ? visibleActivities.map(item => {
            const isSelected = selection?.type === "activity" && selection.id === item.id;
            const selectRow = () => setSelection({ type: "activity", id: item.id });
            return <tr key={item.id} className={isSelected ? "is-selected" : ""} onClick={selectRow}>
              <td><button type="button" className="admin-overview-row-button" aria-pressed={isSelected} onClick={selectRow}><TranslatedText>{tr(item.action)}</TranslatedText></button></td><td>{item.by}</td><td><TranslatedText>{item.time ? localTime(item.time) : tr("Unknown")}</TranslatedText></td>
            </tr>;
          }) : <tr><td colSpan={3} className="admin-muted"><TranslatedText>{tr("No recent activity")}</TranslatedText></td></tr>}
        </tbody></table>
        </div>
      </section>
    </>} side={selection?.type === "attention" && selection.id === "registrations" ? <OverviewLecturerApprovalsPanel onClose={() => setSelection(null)} onResolved={pendingCount => {
      setStats(current => ({ ...current, pendingRequests: pendingCount }));
      adminService.getActivities().then(setActivities).catch(console.error);
    }} /> : selection?.type === "attention" && selection.id === "unassigned" ? <OverviewUnassignedClassesPanel onClose={() => setSelection(null)} /> : selectedActivity ? <OverviewActivityPanel key={selectedActivity.id} activity={selectedActivity} onClose={() => setSelection(null)} /> : <>
      <h2><TranslatedText>{tr("Grading health")}</TranslatedText></h2><p className={stats.gradingErrors === 0 ? "admin-health" : "admin-health admin-warning"}><TranslatedText>{stats.gradingErrors === 0 ? tr("Operational") : tr("Needs Attention")}</TranslatedText></p><p className="admin-muted">{stats.submissionsToday} <TranslatedText>{tr("submitted today /")}</TranslatedText> {stats.gradingErrors} <TranslatedText>{tr("need attention")}</TranslatedText></p><div className="admin-detail-divider" /><h3 className="admin-subheading"><TranslatedText>{tr("Recent errors")}</TranslatedText></h3>
      {errors.length > 0 ? errors.map(err => <p key={err.id} className="admin-warning admin-error">#{err.id.substring(0, 8)} · {err.errorType}<br />{err.problemTitle}</p>) : <p className="admin-muted"><TranslatedText>{tr("No errors recently")}</TranslatedText></p>}
    </>} />
  </div>;
}
