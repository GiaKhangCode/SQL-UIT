import { apiFetch } from "./apiClient";
import { storage } from "./storage";
import type { Assignment, Deadline } from "../data/models";
import type { Contest } from "../data/models";
import { localDate, localTime, parseServerDateTime } from "../utils/serverDateTime";

export interface StudentAssignments {
  classes: { id: string; code: string; name: string; lecturer: string; mode: string }[];
  groups: { id: string; name: string; code: string; classId: string; members: number }[];
  assignments: Assignment[];
  deadlines: Deadline[];
  problems: { id: string; title: string; topic: string; difficulty: string; progress: string }[];
}

export type ProblemFilters = {
  includeTrending?: boolean;
  search?: string;
  topic?: string;
  difficulty?: string;
  progress?: string;
  includePrivate?: boolean;
};

export type QueryResult = {
  status: string;
  message: string;
  table?: any;
};

export interface DailySubmission {
  date: string;
  count: number;
}

export interface DashboardStats {
  solved: number;
  easy: number;
  medium: number;
  hard: number;
  continuing: any[];
  deadlines: any[];
  currentStreak: number;
  submissionsPerDay: DailySubmission[];
  deadlinesError?: string;
}

function localizeSchedule<T extends { date: string; time: string }>(item: T): T {
  if (!item.date || !item.time) return item;
  const timestamp = `${item.date}T${item.time}:00`;
  return { ...item, date: localDate(timestamp), time: localTime(timestamp) };
}

export const studentApi = {
  getDashboard: async (): Promise<DashboardStats> => {
    const tzOffset = new Date().getTimezoneOffset();
    const [dashboardResult, enrolledResult] = await Promise.allSettled([
      apiFetch(`/api/student/dashboard?tz_offset=${tzOffset}`) as Promise<DashboardStats>,
      apiFetch("/api/student/assignments") as Promise<StudentAssignments>,
    ]);
    if (dashboardResult.status === "rejected") throw dashboardResult.reason;
    const dashboard = dashboardResult.value;
    if (enrolledResult.status === "rejected") return { ...dashboard, deadlines: [], deadlinesError: "Could not load upcoming deadlines." };
    const enrolled = enrolledResult.value;
    const now = Date.now();
    const deadlines = (enrolled.deadlines || [])
      .filter((item) => item.date && item.time && parseServerDateTime(`${item.date}T${item.time}:00`).getTime() >= now)
      .map(localizeSchedule)
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    return { ...dashboard, deadlines };
  },

  getProblems: async (f: ProblemFilters = {}) => {
    const url = "/api/problems";
    // We can add query params if the backend supports it, for now fetch all and filter in frontend or backend
    // Since our backend doesn't take query params yet for get_problems, we filter them here
    const problems: any[] = (await apiFetch(url)).map((problem: any) => ({
      ...problem,
      progress: problem.progress || "Not started",
    }));
    
    return problems.filter(
      (p) =>
        (f.includePrivate ? true : p.practiceListed === true) &&
        (!f.search || `${p.title} ${p.number}`.toLowerCase().includes(f.search.toLowerCase())) &&
        (!f.topic || (p.topics && (p.topics as string[]).includes(f.topic))) &&
        (!f.difficulty || p.difficulty === f.difficulty) &&
        (!f.progress || p.progress === f.progress)
    );
  },

  getProblem: async (id: string, context?: string) => {
    const qs = context ? `?context=${encodeURIComponent(context)}` : "";
    return await apiFetch(`/api/problems/${id}${qs}`);
  },

  getAssignments: async (): Promise<StudentAssignments> => {
    const enrolled = (await apiFetch("/api/student/assignments")) as StudentAssignments;
    return {
      ...enrolled,
      assignments: enrolled.assignments.filter((item: any) => !item.isContest).map(localizeSchedule),
      deadlines: (enrolled.deadlines || []).map(localizeSchedule),
    };
  },

  getContests: async (): Promise<Contest[]> => {
    const enrolled = (await apiFetch("/api/student/assignments")) as StudentAssignments;
    const contestIds = enrolled.assignments.filter((item: any) => item.isContest).map(item => item.id);
    
    const contests = await Promise.all(
      contestIds.map(id => apiFetch(`/api/assignments/${encodeURIComponent(id)}`))
    );
    
    return contests.map((item: any) => {
      return {
        id: item.id, title: item.title,
        status: item.status === "Scheduled" ? "Upcoming" : item.status === "Closed" ? "Closed" : "Active",
        date: item.opens ? localDate(item.opens) : "",
        time: item.opens ? localTime(item.opens) : "",
        endDate: item.closes ? localDate(item.closes) : "",
        endTime: item.closes ? localTime(item.closes) : "",
        scope: item.classes || "Assigned classes",
        description: item.instructions || "Timed SQL challenge",
        submitters: Number.parseInt(item.submitted || "", 10) || 0,
        problemIds: (item.problemList || []).map((problem: { id: string }) => problem.id),
      } as Contest;
    });
  },


  runQuery: async (id: string, query: string, database: string, source = "Practice", context = "Practice"): Promise<QueryResult> => {
    return await apiFetch(`/api/problems/${id}/run`, {
      method: "POST",
      body: JSON.stringify({ query, database, source, context }),
    });
  },

  submitSolution: async (
    id: string,
    query: string,
    database: string,
    source: string = "Practice",
    context: string = "Practice"
  ): Promise<QueryResult> => {
    return await apiFetch(`/api/problems/${id}/submit`, {
      method: "POST",
      body: JSON.stringify({ query, database, source, context }),
    });
  },

  getHint: async (id: string) => {
    const problem = await apiFetch(`/api/problems/${id}`);
    return problem.hint || "Không có gợi ý cho bài tập này.";
  },

  askAi: async (problemContext: any, codeDraft: string, userMessage: string, sessionId?: string) => {
    return await apiFetch("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        problemContext,
        codeDraft,
        userMessage,
        sessionId,
      }),
    });
  },

  getAiChatSessions: async (problemId: string) => {
    return await apiFetch(`/api/ai/sessions/${problemId}`);
  },

  getAiChatMessages: async (sessionId: string) => {
    return await apiFetch(`/api/ai/sessions/messages/${sessionId}`);
  },

  getDraft: (id: string) => storage.get("sql-practice:draft:" + id),
  saveDraft: (id: string, query: string) => storage.set("sql-practice:draft:" + id, query),

  getPreferences: async () => {
    return await apiFetch("/api/student/preferences");
  },

  toggleFavorite: async (problemId: string) => {
    return await apiFetch(`/api/student/preferences/favorites/${problemId}`, {
      method: "POST"
    });
  },

  createList: async (name: string, problemIds: string[]) => {
    return await apiFetch("/api/student/preferences/lists", {
      method: "POST",
      body: JSON.stringify({ name, problemIds })
    });
  },

  getTrending: async (range: string) => {
    return await apiFetch(`/api/problems/trending?range=${encodeURIComponent(range)}`);
  },

  getSubmissions: async (filters: { search?: string; result?: string; source?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.search) params.append("search", filters.search);
    if (filters.result) params.append("result", filters.result);
    if (filters.source) params.append("source", filters.source);
    
    const qs = params.toString();
    const url = qs ? `/api/submissions?${qs}` : "/api/submissions";
    
    return await apiFetch(url);
  }
};
