import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import type { DataTable } from "../data/models";
export function Status({
  value,
  tone: explicitTone,
}: {
  value: string;
  tone?: "neutral" | "warning";
}) {
  const tone =
    explicitTone ||
    (/Accepted|Solved|Active/.test(value)
      ? "success"
      : /Wrong|Runtime|Hard/.test(value)
        ? "danger"
        : /Time Limit|Medium|Upcoming/.test(value)
          ? "warning"
          : /In progress/.test(value)
            ? "accent"
            : "neutral");
  return <span className={"status " + tone}>{value}</span>;
}
export function Loading({
  label = "Loading student data…",
}: {
  label?: string;
}) {
  return (
    <div role="status" className="empty-state">
      <span className="spinner" />
      {label}
    </div>
  );
}
export function Empty({
  title = "No results",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="empty-state" role="alert">
      <h2>{title}</h2>
      <p>{message}</p>
      {onRetry && <button className="button" type="button" onClick={onRetry}>Try again</button>}
    </div>
  );
}
export function DataGrid({ table }: { table: DataTable }) {
  return (
    <div className="table-scroll" tabIndex={0} aria-label={table.name}>
      <table className="data-table">
        <caption className="sr-only">{table.name}</caption>
        <thead>
          <tr>
            {table.columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={"dialog " + className}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const bounds = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < bounds.left ||
            e.clientX > bounds.right ||
            e.clientY < bounds.top ||
            e.clientY > bounds.bottom
          )
            onClose();
        }
      }}
    >
      <div className="section-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function PageHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="page-heading">
      <h1>{title}</h1>
      <p>{sub}</p>
    </div>
  );
}
