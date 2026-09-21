export function Activity({ small = false }: { small?: boolean }) {
  const columns = small ? 5 : 26;
  return (
    <div className={"activity" + (small ? " small" : "")}>
      <div className="activity-months">
        {(small
          ? ["September"]
          : ["Apr", "May", "Jun", "Jul", "Aug", "Sep"]
        ).map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
      <div className="activity-body">
        <div className="activity-days">
          <span>Mon</span>
          <span>Wed</span>
          <span>Fri</span>
        </div>
        <div
          className="activity-grid"
          style={{ gridTemplateColumns: `repeat(${columns},minmax(0,1fr))` }}
          role="img"
          aria-label="Mock SQL activity heatmap. Purple intensity indicates submissions per day."
        >
          {Array.from({ length: columns * 7 }, (_, i) => (
            <i
              key={i}
              className={"level-" + ((i * 7 + (i % 5)) % 5)}
              title={`${(i * 7 + (i % 5)) % 5} mock submissions`}
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
