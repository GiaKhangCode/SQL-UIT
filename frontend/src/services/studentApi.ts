import { apiFetch } from "./apiClient";
import { storage } from "./storage";
import type { Assignment, Deadline } from "../data/models";
import type { Contest } from "../data/models";
import { localDate, localTime, parseServerDateTime } from "../utils/serverDateTime";

export interface StudentAssignments {
  classes: { id: string; code: string; name: string; lecturer: string }[];
  assignments: Assignment[];
  deadlines: Deadline[];
  problems: { id: string; title: string; topic: string; difficulty: string }[];
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
  score?: number | null;
  scoreVisible?: boolean;
  maxScore?: number;
  submissionsUsed?: number | null;
  maxSubmissions?: number | null;
  executionTimeMs?: number;
  schemaTables?: import("../utils/parseDatabaseSchema").SchemaTable[];
  tables?: import("../data/models").DataTable[];
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
  longestStreak: number;
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
    return enrolled.assignments.filter((item: any) => item.isContest).map((item: any) => {
      return {
        id: item.id, title: item.title,
        status: item.contestStatus,
        date: item.opens ? localDate(item.opens) : "",
        time: item.opens ? localTime(item.opens) : "",
        endDate: item.closes ? localDate(item.closes) : "",
        endTime: item.closes ? localTime(item.closes) : "",
        opensAt: item.opens,
        closesAt: item.closes,
        scope: item.scope,
        audienceType: item.audienceType,
        shortDescription: item.shortDescription,
        description: item.description,
          rules: item.rules,
          bannerUrl: item.bannerUrl,
        submitters: item.submitters,
        problemIds: item.problemIds,
        problemCount: item.problemCount,
        problemDetails: item.problemDetails,
        totalPoints: item.totalPoints,
        score: item.score,
        rank: item.rank,
        leaderboardEnabled: item.leaderboardEnabled,
        aiAllowed: item.aiAllowed,
        examMode: item.examMode,
        showScoresAfterSubmit: item.showScoresAfterSubmit,
        maxSubmissions: item.maxSubmissions,
        submissionCounts: item.submissionCounts,
        leaderboard: item.leaderboard,
        examType: item.examType || item.exam_type || "classic",
        ddlPoints: item.ddlPoints ?? item.ddl_points ?? 30,
        dmlPoints: item.dmlPoints ?? item.dml_points ?? 20,
        sqlPoints: item.sqlPoints ?? item.sql_points ?? 50,
        dmlSeedScript: item.dmlSeedScript || item.dml_seed_script || "",
      } as Contest;
    });
  },


  submitWorkspace: async (id: string, input: { part: "DDL" | "DML" | "SQL"; ddl: string; dml: string; query: string; source: string; context: string }): Promise<QueryResult> => {
    return apiFetch(`/api/problems/${encodeURIComponent(id)}/workspace/submit`, { method: "POST", body: JSON.stringify(input) });
  },

  runWorkspace: async (id: string, input: { part: "DDL" | "DML" | "SQL"; ddl: string; dml: string; query: string; source: string; context: string }): Promise<QueryResult> => {
    return await apiFetch(`/api/problems/${encodeURIComponent(id)}/workspace/run`, { method: "POST", body: JSON.stringify(input) });
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

  setupContestDb: async (contestId: string): Promise<{
    status: string;
    schemaName: string;
    databaseName: string;
    tables: string[];
    examType: string;
    ddlPoints: number;
    dmlPoints: number;
    sqlPoints: number;
    hasSeedScript: boolean;
  }> => {
    return await apiFetch(`/api/contests/${contestId}/setup-db`, { method: "POST" });
  },

  runContestDdl: async (contestId: string, script: string): Promise<{
    status: string;
    messages: string[];
    tables: string[];
    schemaName: string;
  }> => {
    return await apiFetch(`/api/contests/${contestId}/run-ddl`, {
      method: "POST",
      body: JSON.stringify({ script }),
    });
  },

  seedContestDml: async (contestId: string): Promise<{
    status: string;
    message: string;
    tables: string[];
  }> => {
    return await apiFetch(`/api/contests/${contestId}/seed-dml`, { method: "POST" });
  },

  inspectContestSchema: async (contestId: string): Promise<{
    schemaName: string;
    tables: Array<{
      tableName: string;
      rowCount: number;
      columns: Array<{
        name: string;
        type: string;
        maxLen: number | null;
        nullable: boolean;
        isPk: boolean;
        isFk: boolean;
        fkTarget?: string | null;
      }>;
    }>;
    tableCount: number;
    relationships?: Array<{
      fromTable: string;
      fromCol: string;
      toTable: string;
      toCol: string;
    }>;
  }> => {
    return await apiFetch(`/api/contests/${contestId}/schema-inspector`);
  },

  runContestQuery: async (contestId: string, query: string): Promise<{
    status: string;
    columns: string[];
    rows: any[][];
    rowCount: number;
  }> => {
    return await apiFetch(`/api/contests/${contestId}/run-query`, {
      method: "POST",
      body: JSON.stringify({ query }),
    });
  },

  submitContestExam: async (
    contestId: string,
    ddlScript: string,
    queryAnswers: Record<string, string>
  ): Promise<{
    status: string;
    submissionId: string;
    scorecard: {
      total_score: number;
      max_score: number;
      passed: boolean;
      ddl: { score: number; max_score: number; feedback: string; details: string[] };
      dml: { score: number; max_score: number; feedback: string; details: string[] };
      queries: {
        score: number;
        max_score: number;
        questions: Array<{
          title: string;
          score: number;
          max_score: number;
          status: string;
          message: string;
          table?: any;
        }>;
      };
      schemaName: string;
    };
  }> => {
    return await apiFetch(`/api/contests/${contestId}/submit-exam`, {
      method: "POST",
      body: JSON.stringify({ ddlScript, queryAnswers }),
    });
  },

  getHint: async (id: string, context?: string) => {
    const problem = await apiFetch(`/api/problems/${id}${context ? `?context=${encodeURIComponent(context)}` : ""}`);
    return problem.hint || "No hint is available for this problem.";
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

  getDraft: (id: string) => {
    let prefix = "";
    try {
      const sessionStr = storage.get("sql-practice:session:v1");
      if (sessionStr) {
        const user = JSON.parse(sessionStr);
        if (user && user.id) prefix = user.id + ":";
      }
    } catch (e) {}
    
    return storage.get(`sql-practice:draft:${prefix}${id}`);
  },

  saveDraft: (id: string, query: string) => {
    let prefix = "";
    try {
      const sessionStr = storage.get("sql-practice:session:v1");
      if (sessionStr) {
        const user = JSON.parse(sessionStr);
        if (user && user.id) prefix = user.id + ":";
      }
    } catch (e) {}
    
    storage.set(`sql-practice:draft:${prefix}${id}`, query);
  },

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
  },

  getNotifications: async () => {
    return await apiFetch("/api/notifications");
  },
  
  getUnreadCount: async () => {
    return await apiFetch("/api/notifications/unread-count");
  },
  
  markAsRead: async (id: string) => {
    return await apiFetch(`/api/notifications/${id}/read`, { method: "PUT" });
  },
  
  markAllAsRead: async () => {
    return await apiFetch("/api/notifications/read-all", { method: "PUT" });
  }
};
