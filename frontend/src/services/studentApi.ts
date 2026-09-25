import { apiFetch } from "./apiClient";
import { storage } from "./storage";
import {
  assignments,
  classes,
  contests,
  deadlines,
  groups,
} from "../data/mockData";

export type ProblemFilters = {
  includeTrending?: boolean;
  search?: string;
  topic?: string;
  difficulty?: string;
  progress?: string;
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
}

export const studentApi = {
  getLearningStreak: () => {
    // For now, returning a static or simple streak
    return 0;
  },

  getDashboard: async (): Promise<DashboardStats> => {
    return await apiFetch("/api/student/dashboard");
  },

  getProblems: async (f: ProblemFilters = {}) => {
    let url = "/api/problems";
    // We can add query params if the backend supports it, for now fetch all and filter in frontend or backend
    // Since our backend doesn't take query params yet for get_problems, we filter them here
    const problems: any[] = await apiFetch(url);
    
    return problems.filter(
      (p) =>
        (!f.search || `${p.title} ${p.number}`.toLowerCase().includes(f.search.toLowerCase())) &&
        (!f.topic || p.topic === f.topic) &&
        (!f.difficulty || p.difficulty === f.difficulty) &&
        (!f.progress || p.progress === f.progress)
    );
  },

  getProblem: async (id: string) => {
    return await apiFetch(`/api/problems/${id}`);
  },

  getAssignments: async () => {
    return await apiFetch("/api/student/assignments");
  },

  getContests: async () => {
    return contests;
  },


  runQuery: async (id: string, query: string, database: string): Promise<QueryResult> => {
    return await apiFetch(`/api/problems/${id}/run`, {
      method: "POST",
      body: JSON.stringify({ query, database, source: "Practice", context: "Practice" }),
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

  resetDatabase: async (id: string, database: string) => {
    // For Sandbox, nothing needs to be reset permanently for the user, just fetching the problem again
    const problem = await apiFetch(`/api/problems/${id}`);
    return problem.tables;
  },

  getHint: async (id: string, mode: "Hint" | "AI") => {
    const problem = await apiFetch(`/api/problems/${id}`);
    if (mode === "AI") {
        return "AI guidance: " + (problem.hint || "Phân tích kỹ đề bài và các bảng dữ liệu.");
    }
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
