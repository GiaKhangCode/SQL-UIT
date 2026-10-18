import { TranslatedText } from "../../components/TranslatedText";
import { useLanguage } from "../../context/LanguageContext";
import { useState, type ReactNode } from "react";

export function TeacherPageIntro({
  title,
  context,
  children,
  compact = false,
}: {
  title: string;
  context: string;
  children?: ReactNode;
  compact?: boolean;
}) {
  const { t: tr } = useLanguage("teacher");
  return (
    <div className={`teacher-page-intro${compact ? " page-list-intro" : ""}`}>
      <div>
        <h1 className={compact ? "sr-only" : undefined}><TranslatedText>{title}</TranslatedText></h1>
        {context && <p><TranslatedText>{tr(context)}</TranslatedText></p>}
      </div>
      {children && <div className="teacher-page-actions">{children}</div>}
    </div>
  );
}

export function TeacherSectionTitle({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="teacher-section-title">
      <h2><TranslatedText>{title}</TranslatedText></h2>
      {children}
    </div>
  );
}

export function TeacherField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const { t: tr } = useLanguage("teacher");
  return (
    <label className={`teacher-field ${className}`}>
      <span><TranslatedText>{tr(label)}</TranslatedText></span>
      {children}
    </label>
  );
}

export function ClassPicker({
  selected,
  onChange,
  classes,
  loading,
  error,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  classes: { id: string }[];
  loading: boolean;
  error: string;
}) {
  const { t: tr } = useLanguage("teacher");
  const [open, setOpen] = useState(false);

  return (
    <div className="teacher-class-picker">
      <div className="teacher-class-chips">
        {selected.map((id) => (
          <button
            type="button"
            className="teacher-class-chip"
            key={id}
            onClick={() => onChange(selected.filter((value) => value !== id))}
            aria-label={tr("Remove {value0}", { value0: id })}
            title={tr("Remove {value0}", { value0: id })}
          >
            {id} <span aria-hidden="true">×</span>
          </button>
        ))}
        <button
          type="button"
          className="teacher-add-class"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <TranslatedText>{tr("+ Add class")}</TranslatedText>
        </button>
      </div>
      {open && (
        <div className="teacher-class-options">
          {classes.map((classInfo) => {
            const checked = selected.includes(classInfo.id);
            return (
              <label key={classInfo.id}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange(
                      checked
                        ? selected.filter((id) => id !== classInfo.id)
                        : [...selected, classInfo.id],
                    )
                  }
                />
                {classInfo.id}
              </label>
            );
          })}
          {loading ? <span className="muted"><TranslatedText>{tr("Loading classes…")}</TranslatedText></span> : error ? <span role="alert"><TranslatedText>{tr(error)}</TranslatedText></span> : classes.length === 0 && <span className="muted"><TranslatedText>{tr("No classes available.")}</TranslatedText></span>}
          <button
            type="button"
            className="text-button"
            onClick={() => setOpen(false)}
          >
            <TranslatedText>{tr("Done")}</TranslatedText>
          </button>
        </div>
      )}
    </div>
  );
}
