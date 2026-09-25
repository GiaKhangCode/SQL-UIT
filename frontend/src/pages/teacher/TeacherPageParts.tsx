import { useState, useEffect, type ReactNode } from "react";
import { teacherService } from "../../services/teacherService";

export function TeacherPageIntro({
  title,
  context,
  children,
}: {
  title: string;
  context: string;
  children?: ReactNode;
}) {
  return (
    <div className="teacher-page-intro">
      <div>
        <h1>{title}</h1>
        <p>{context}</p>
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
      <h2>{title}</h2>
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
  return (
    <label className={`teacher-field ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function ClassPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);

  useEffect(() => {
    async function loadClasses() {
      try {
        const data = await teacherService.getClasses();
        setClasses(data);
      } catch (e) {
        console.error("Failed to load classes", e);
      }
    }
    loadClasses();
  }, []);

  return (
    <div className="teacher-class-picker">
      <div className="teacher-class-chips">
        {selected.map((id) => (
          <button
            type="button"
            className="teacher-class-chip"
            key={id}
            onClick={() => onChange(selected.filter((value) => value !== id))}
            aria-label={`Remove ${id}`}
            title={`Remove ${id}`}
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
          + Add class
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
          {classes.length === 0 && <span className="muted" style={{ display: 'block', padding: '8px' }}>No classes available.</span>}
          <button
            type="button"
            className="text-button"
            onClick={() => setOpen(false)}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
