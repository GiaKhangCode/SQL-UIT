import { useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { TranslatedText } from "../../../../components/TranslatedText";
import { useLanguage } from "../../../../context/LanguageContext";
import { useLoad } from "../../../../components/useLoad";
import { studentApi, type StudentAssignments } from "../../../../services/studentApi";
import type { Contest } from "../../../../data/models";

type ProblemOption = { id: string; title: string };
type ProblemList = { items: ProblemOption[] };

export function WorkspaceProblemSwitcher({ source, context, problemId, problemTitle }: {
  source: "Assignments" | "Contests";
  context: string;
  problemId: string;
  problemTitle: string;
}) {
  const { t: tr } = useLanguage("workspace");
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { data, loading } = useLoad<ProblemList>(async () => {
    if (source === "Assignments") {
      const assignments: StudentAssignments = await studentApi.getAssignments();
      const assignment = assignments.assignments.find((item) => item.id === context);
      return { items: (assignment?.problemIds || []).map((id) => ({ id, title: (assignments.problems || []).find((problem) => problem.id === id)?.title || "" })) };
    }
    const contests: Contest[] = await studentApi.getContests();
    const contest = contests.find((item) => item.id === context);
    return { items: (contest?.problemIds || []).map((id) => ({ id, title: (contest?.problemDetails || []).find((problem) => problem.id === id)?.title || "" })) };
  }, [source, context]);

  const items = useMemo(() => {
    const options = data?.items || [];
    if (options.some((item) => item.id === problemId)) return options;
    return [{ id: problemId, title: problemTitle }, ...options];
  }, [data, problemId, problemTitle]);
  const selectedIndex = Math.max(0, items.findIndex((item) => item.id === problemId));

  if (!loading && items.length < 2) return null;

  function switchProblem(nextProblemId: string) {
    if (!nextProblemId || nextProblemId === problemId) return;
    const nextParams = new URLSearchParams(searchParams);
    navigate({ pathname: `/workspace/${encodeURIComponent(nextProblemId)}`, search: nextParams.toString() ? `?${nextParams.toString()}` : "" }, { state: location.state });
  }

  return <label className="workspace-problem-switcher">
    <span><TranslatedText>{tr("Problem")}</TranslatedText> {String(selectedIndex + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}</span>
    <select value={problemId} aria-label={tr("Switch problem")} disabled={loading || items.length < 2} onChange={(event) => switchProblem(event.target.value)}>
      {items.map((item, index) => <option key={item.id} value={item.id}>{String(index + 1).padStart(2, "0")} · {item.title || tr("Problem {value0}", { value0: index + 1 })}</option>)}
    </select>
  </label>;
}
