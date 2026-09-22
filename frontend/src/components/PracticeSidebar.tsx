import { useState } from "react";
import { Link } from "react-router-dom";
import { problems } from "../data/mockData";
import { Activity } from "./Activity";
import { DailySubmission, studentApi } from "../services/studentApi";
import { useLoad } from "./useLoad";

function formatLearners(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k";
  }
  return num.toString();
}

const ranges = ["Week", "Month", "All time"] as const;
type Range = (typeof ranges)[number];
export function PracticeActivity({ submissions = [] }: { submissions?: DailySubmission[] }) {
  const now = new Date();
  const currentMonth = now.toLocaleString('default', { month: 'long' });
  const currentYear = now.getFullYear();
  
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  // 0 = Sunday, 1 = Monday, ... 6 = Saturday. We want Monday=0, Sunday=6
  const emptyCells = (firstDayOfWeek + 6) % 7;
  
  // Calculate activity levels for the month
  const calendarLevels: Record<number, number> = {};
  let activeDays = 0;
  let totalSubmissions = 0;
  
  submissions.forEach(sub => {
    const d = new Date(sub.date);
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      const day = d.getDate();
      let level = 1;
      if (sub.count >= 7) level = 4;
      else if (sub.count >= 5) level = 3;
      else if (sub.count >= 3) level = 2;
      
      calendarLevels[day] = level;
      activeDays++;
      totalSubmissions += sub.count;
    }
  });

  return (
    <section className="practice-activity">
      <h3>
        {currentMonth} activity <small>{currentYear}</small>
      </h3>
      <p className="tiny muted">{totalSubmissions} submissions · {activeDays} active days</p>
      <div
        className="practice-calendar"
        role="img"
        aria-label={`${currentMonth} ${currentYear} SQL activity calendar. ${activeDays} active days; deeper purple indicates higher activity.`}
      >
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span className="practice-calendar-weekday" key={day}>
            {day}
          </span>
        ))}
        {Array.from({ length: emptyCells }, (_, i) => (
          <span key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => (
          <span
            key={i}
            className={
              "practice-calendar-date calendar-level-" +
              (calendarLevels[i + 1] || 0)
            }
            title={
              `${currentMonth} ${i + 1} · Activity level ${calendarLevels[i + 1] || 0}`
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
        <Activity small submissions={submissions} />
      </div>
    </section>
  );
}
export function PracticeTrending() {
  const [range, setRange] = useState<Range>("Week");
  
  const { data: trendingProblems, loading } = useLoad(
    async () => await studentApi.getTrending(range),
    [range]
  );
  
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
        {loading ? (
          <div style={{ padding: "16px", color: "var(--muted)", fontSize: 13 }}>Loading...</div>
        ) : trendingProblems?.map((row: any) => {
          const p = problems.find((p) => p.id === row.id);
          if (!p) return null;
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
                {formatLearners(row.learners)}
                <span className="trending-learners"> learners</span>
              </small>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
