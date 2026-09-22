import { DailySubmission } from "../services/studentApi";

export function Activity({
  small = false,
  submissions = [],
}: {
  small?: boolean;
  submissions?: DailySubmission[];
}) {
  const columns = small ? 5 : 26; // 6 months is approx 26 weeks
  const submissionsMap = new Map(submissions.map((s) => [s.date, s.count]));

  const today = new Date();
  // Find the Saturday of the current week to align the grid properly
  const endSaturday = new Date(today);
  endSaturday.setDate(today.getDate() + (6 - today.getDay()));

  const months: string[] = [];
  let currentMonth = "";

  const cells = Array.from({ length: columns * 7 }, (_, i) => {
    const daysAgo = columns * 7 - 1 - i;
    const d = new Date(endSaturday);
    d.setDate(endSaturday.getDate() - daysAgo);
    
    // For month labels
    if (d.getDay() === 0) { // Sunday, start of the column
      const monthStr = d.toLocaleString("default", { month: "short" });
      if (monthStr !== currentMonth && !small) {
        months.push(monthStr);
        currentMonth = monthStr;
      } else if (small && i === 0) {
        months.push(d.toLocaleString("default", { month: "long" }));
      } else if (months.length < Math.floor(i / 7) + 1 && !small) {
        // Keep spacing consistent if month doesn't change
        months.push("");
      }
    }

    const dateStr = d.toISOString().split("T")[0];
    const isFuture = d > today;
    const count = isFuture ? 0 : submissionsMap.get(dateStr) || 0;

    let level = 0;
    if (count >= 1 && count <= 2) level = 1;
    else if (count >= 3 && count <= 4) level = 2;
    else if (count >= 5 && count <= 6) level = 3;
    else if (count >= 7) level = 4;

    return {
      dateStr,
      count,
      level,
      isFuture,
    };
  });

  return (
    <div className={"activity" + (small ? " small" : "")}>
      <div className="activity-months">
        {months.map((m, i) => (
          <span key={i}>{m}</span>
        ))}
      </div>
      <div className="activity-body">
        <div className="activity-days">
          <span>Sun</span>
          <span>Tue</span>
          <span>Thu</span>
          <span>Sat</span>
        </div>
        <div
          className="activity-grid"
          style={{ gridTemplateColumns: `repeat(${columns},minmax(0,1fr))` }}
          role="img"
          aria-label="SQL activity heatmap"
        >
          {cells.map((cell, i) => (
            <i
              key={i}
              className={`level-${cell.level}`}
              title={
                cell.isFuture
                  ? ""
                  : `${cell.count} submissions on ${cell.dateStr}`
              }
              style={{ opacity: cell.isFuture ? 0 : 1 }}
            />
          ))}
        </div>
      </div>
      <div className="activity-legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((n) => (
          <i key={n} className={"level-" + n} />
        ))}
        <span>More</span>
        {!small && (
          <span className="activity-caption">Submissions per day</span>
        )}
      </div>
    </div>
  );
}
