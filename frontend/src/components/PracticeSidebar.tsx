import { useState } from "react";
import { Link } from "react-router-dom";
import { problems } from "../data/mockData";
import { Activity } from "./Activity";
// Exact intensity fixtures from Figma's September contribution calendar.
const calendarLevels: Record<number, number> = {
  1: 3,
  2: 1,
  4: 4,
  5: 3,
  7: 1,
  8: 1,
  9: 3,
  10: 4,
  12: 1,
  14: 4,
  15: 3,
  18: 2,
};
const ranges = ["Week", "Sep 2026", "All time"] as const;
type Range = (typeof ranges)[number];
const rankings: Record<Range, { id: string; learners: string }[]> = {
  Week: [
    { id: "p1", learners: "1.2k" },
    { id: "p2", learners: "986" },
    { id: "p6", learners: "742" },
    { id: "p9", learners: "624" },
    { id: "p10", learners: "518" },
  ],
  "Sep 2026": [
    { id: "p2", learners: "3.4k" },
    { id: "p1", learners: "2.8k" },
    { id: "p10", learners: "1.9k" },
    { id: "p6", learners: "1.5k" },
    { id: "p9", learners: "1.1k" },
  ],
  "All time": [
    { id: "p1", learners: "12.8k" },
    { id: "p6", learners: "9.6k" },
    { id: "p2", learners: "8.4k" },
    { id: "p9", learners: "6.2k" },
    { id: "p10", learners: "4.7k" },
  ],
};
export function PracticeActivity() {
  return (
    <section className="practice-activity">
      <h3>
        September activity <small>2026</small>
      </h3>
      <p className="tiny muted">24 submissions · 12 active days</p>
      <div
        className="practice-calendar"
        role="img"
        aria-label="September 2026 demonstration SQL activity calendar. Twelve active days; deeper purple indicates higher activity."
      >
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span className="practice-calendar-weekday" key={day}>
            {day}
          </span>
        ))}
        <span />
        {Array.from({ length: 30 }, (_, i) => (
          <span
            key={i}
            className={
              "practice-calendar-date calendar-level-" +
              (calendarLevels[i + 1] || 0)
            }
            title={
              "September " +
              (i + 1) +
              " · Activity level " +
              (calendarLevels[i + 1] || 0)
            }
          >
            {i + 1}
          </span>
        ))}
      </div>
      <div className="practice-calendar-legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((i) => (
          <i className={"calendar-level-" + i} key={i} />
        ))}
        <span>More</span>
      </div>
      <div className="practice-mobile-heatmap">
        <Activity small />
      </div>
    </section>
  );
}
export function PracticeTrending() {
  const [range, setRange] = useState<Range>("Week");
  return (
    <section className="practice-trending">
      <h3>Trending problems</h3>
      <div className="trending-range" aria-label="Trending range">
        {ranges.map((value) => (
          <button
            key={value}
            aria-pressed={range === value}
            onClick={() => setRange(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <div
        className="trending-scroll"
        tabIndex={0}
        aria-label={range + " trending problems"}
        key={range}
      >
        {rankings[range].map((row) => {
          const p = problems.find((p) => p.id === row.id)!;
          return (
            <Link
              className="trending-problem"
              key={row.id}
              to={"/workspace/" + row.id}
            >
              <span>
                <b>{p.number}</b> {p.title}
              </span>
              <small>
                {row.learners}
                <span className="trending-learners"> learners</span>
              </small>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
