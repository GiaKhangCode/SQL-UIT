import { TranslatedText } from "../../../components/TranslatedText";
import { useLanguage } from "../../../context/LanguageContext";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { AppHeader } from "../../../components/AppHeader";
import { Empty, Loading } from "../../../components/ui";
import { useLoad } from "../../../components/useLoad";
import { useAuth } from "../../../context/AuthContext";
import { studentApi } from "../../../services/studentApi";
import { ProblemWorkspace } from "./ProblemWorkspace";

import { WorkspaceExamProvider } from "./components/WorkspaceExamContext";

export function WorkspacePage() {
  const [params] = useSearchParams();
  const { session } = useAuth();
  return <WorkspaceExamProvider key={`${session?.id}:${params.get("source")}:${params.get("context")}`}><WorkspaceContent /></WorkspaceExamProvider>;
}

function WorkspaceContent() {
  const { t: tr } = useLanguage("workspace");
  const { problemId = "" } = useParams();
  const { session } = useAuth();
  const [params] = useSearchParams();
  const context = params.get("context") || (params.get("source") || "Practice");
  const { data, loading, error } = useLoad(
    () => studentApi.getProblem(problemId, context),
    [problemId, context],
  );
  if (loading)
    return (
      <>
        <AppHeader
          workspace={{ title: "Loading problem…", number: "", topic: "" }}
        />
        <main id="main-content">
          <Loading />
        </main>
      </>
    );
  if (error || !data)
    return (
      <>
        <AppHeader />
        <main id="main-content">
          <Empty title={tr("Problem unavailable")}>
            <TranslatedText>{tr(error) || tr("This problem ID does not exist.")}</TranslatedText>{" "}
            <Link to="/dashboard"><TranslatedText>{tr("Back to dashboard")}</TranslatedText></Link>
          </Empty>
        </main>
      </>
    );
  return <ProblemWorkspace key={`${session?.id}:${context}:${data.id}`} problem={data} />;
}
