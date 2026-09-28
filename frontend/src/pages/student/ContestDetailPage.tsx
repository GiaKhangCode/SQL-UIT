import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { studentApi } from "../../services/studentApi";
import { useLoad } from "../../components/useLoad";
import { Empty, ErrorState, Loading } from "../../components/ui";
import { parseServerDateTime } from "../../utils/serverDateTime";
import { ContestDetailView } from "./ContestDetailView";

export function ContestDetailPage() {
  const { contestId } = useParams();
  const { data, loading, error, mutate } = useLoad(studentApi.getContests);
  const [now, setNow] = useState(Date.now());
  const refreshedBoundary = useRef("");
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const current = data?.find((item) => item.id === contestId);
    if (!current) return;
    const boundary = current.status === "Upcoming" && now >= parseServerDateTime(current.opensAt).getTime()
      ? `${contestId}:start` : current.status === "Live" && now >= parseServerDateTime(current.closesAt).getTime()
        ? `${contestId}:end` : "";
    if (boundary && refreshedBoundary.current !== boundary) {
      refreshedBoundary.current = boundary;
      void mutate();
    }
  }, [data, contestId, now, mutate]);

  if (loading) return <section className="page contest-detail-page"><Loading label="Loading contest…" /></section>;
  if (!data || error) return <section className="page contest-detail-page"><ErrorState title="Contest unavailable" message={error || "Could not load contest."} onRetry={() => window.location.reload()} /></section>;
  const contest = data.find((item) => item.id === contestId);
  if (!contest) return <Empty title="Contest unavailable"><Link to="/contests">Back to contests</Link></Empty>;

  const starts = parseServerDateTime(contest.opensAt).getTime();
  const ends = parseServerDateTime(contest.closesAt).getTime();
  const phase = now < starts ? "Upcoming" : now >= ends ? "Closed" : "Live";
  return <section className="page contest-detail-page">
    <Link className="detail-back" to="/contests">← Back to contests</Link>
    <ContestDetailView contest={contest} phase={phase} now={now} />
  </section>;
}
