import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Deadline } from "../data/mockData";
export function DeadlineList({ items }: { items: Deadline[] }) {
  return (
    <div className="deadline-list">
      {items.map((item) => (
        <Link key={item.id} to={item.to}>
          <b>{item.title}</b>
          <small>
            {item.kind} · {item.context}
          </small>
          <small>
            Due {item.date.slice(5)} · {item.time} ICT
          </small>
        </Link>
      ))}
    </div>
  );
}
export function Calendar({
  items,
  compact = false,
  referenceDate = "2026-09-18",
}: {
  items: Deadline[];
  compact?: boolean;
  referenceDate?: string;
}) {
  const [month, setMonth] = useState(8);
  const [year, setYear] = useState(2026);
  const [selected, setSelected] = useState("");
  const first = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month, 1).toLocaleDateString("en-US", {
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
      aria-label="Deadline calendar"
    >
      {!compact && (
        <>
          <h3>Deadlines</h3>
          <p className="tiny muted">Across all your classes & groups</p>
        </>
      )}
      <div className="calendar-heading">
        <button
          className="icon-button"
          onClick={() => move(-1)}
          aria-label="Previous month"
        >
          <ChevronLeft size={15} />
        </button>
        <b>{monthName}</b>
        <button
          className="icon-button"
          onClick={() => move(1)}
          aria-label="Next month"
        >
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="calendar-grid">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span className="weekday" key={"w" + i}>
            {d}
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
        ● {referenceDate === "2026-09-17" ? "Assignment due" : "Due date"}{" "}
        <span>
          {referenceDate === "2026-09-17" ? "" : "Demo today: Sep 18"}
        </span>
      </p>
      {selected && (
        <div className="calendar-selection" aria-live="polite">
          <b>
            {selected.slice(5)} · {selectedItems.length} deadlines
          </b>
          {selectedItems.length ? (
            <DeadlineList items={selectedItems} />
          ) : (
            <p className="tiny muted">No work due on this date.</p>
          )}
        </div>
      )}
    </section>
  );
}
