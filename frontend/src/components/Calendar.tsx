import { TranslatedText } from "./TranslatedText";
import { useLanguage } from "../context/LanguageContext";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Deadline } from "../data/models";
export function DeadlineList({ items }: { items: Deadline[] }) {
  const { t: tr } = useLanguage("common");
  return (
    <div className="deadline-list">
      {items.map((item) => (
        <Link key={item.id} to={item.to}>
          <b>{item.title}</b>
          <small>
            <TranslatedText>{tr(item.kind)}</TranslatedText> · {item.context}
          </small>
          <small>
            <TranslatedText>{tr("Due")}</TranslatedText> {item.date.slice(5)} · {item.time}
          </small>
        </Link>
      ))}
    </div>
  );
}
export function Calendar({
  items,
  compact = false,
  referenceDate = new Date().toLocaleDateString("en-CA"),
}: {
  items: Deadline[];
  compact?: boolean;
  referenceDate?: string;
}) {
  const { t: tr, locale: uiLocale } = useLanguage("common");
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [selected, setSelected] = useState("");
  const first = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month, 1).toLocaleDateString(uiLocale, {
    month: "long",
    year: "numeric",
  });
  const selectedItems = items.filter((i) => i.date === selected);
  function move(delta: number) {
    const date = new Date(year, month + delta, 1);
    setYear(date.getFullYear());
    setMonth(date.getMonth());
    setSelected("");
  }
  return (
    <section
      className={"calendar" + (compact ? " compact" : "")}
      aria-label={tr("Deadline calendar")}
    >
      {!compact && (
        <>
          <h3><TranslatedText>{tr("Deadlines")}</TranslatedText></h3>
          <p className="tiny muted"><TranslatedText>{tr("Across all your classes & groups")}</TranslatedText></p>
        </>
      )}
      <div className="calendar-heading">
        <button
          className="icon-button"
          onClick={() => move(-1)}
          aria-label={tr("Previous month")}
        >
          <ChevronLeft size={15} />
        </button>
        <b><TranslatedText>{tr(monthName)}</TranslatedText></b>
        <button
          className="icon-button"
          onClick={() => move(1)}
          aria-label={tr("Next month")}
        >
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="calendar-grid">
        {(uiLocale === "vi-VN" ? ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] : ["M", "T", "W", "T", "F", "S", "S"]).map((d, i) => (
          <span className="weekday" key={"w" + i}>
            <TranslatedText>{tr(d)}</TranslatedText>
          </span>
        ))}
        {Array.from({ length: first }, (_, i) => (
          <span key={"blank" + i} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const due = items.filter((d) => d.date === date);
          return (
            <button
              key={date}
              className={
                (due.length ? "marked " : "") +
                (selected === date ? "selected " : "") +
                (date === referenceDate ? "today" : "")
              }
              onClick={() => setSelected(date)}
              aria-pressed={selected === date}
              aria-label={`${monthName} ${day}${due.length ? `, ${due.length} deadlines` : ""}`}
            >
              {day}
              {due.length > 0 && <i />}
            </button>
          );
        })}
      </div>
      <p className="calendar-legend">
        <TranslatedText>{tr("● Due date")}</TranslatedText> <span><TranslatedText>{tr("Today is outlined")}</TranslatedText></span>
      </p>
      {selected && (
        <div className="calendar-selection" aria-live="polite">
          <b>
            {selected.slice(5)} · {selectedItems.length} <TranslatedText>{tr("deadlines")}</TranslatedText>
          </b>
          {selectedItems.length ? (
            <DeadlineList items={selectedItems} />
          ) : (
            <p className="tiny muted"><TranslatedText>{tr("No work due on this date.")}</TranslatedText></p>
          )}
        </div>
      )}
    </section>
  );
}
