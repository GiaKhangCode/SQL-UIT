import { apiFetch } from "./apiClient";
import type { TeacherClass, TeacherClassMember } from "../data/teacherTypes";

export interface ClassCreate {
  id: string;
  course: string;
  term: string;
  startDate?: string;
  endDate?: string;
}

export interface ClassMemberAdd {
  student_id: string;
}

export interface TeacherDatabaseLibraryEntry {
  id: string;
  title: string;
  createTableFileName?: string | null;
  insertIntoFileName?: string | null;
  createTableSql: string;
  insertIntoSql: string;
  datasets?: TeacherDatabaseLibraryDataset[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherDatabaseLibraryDataset {
  fileName: string;
  sql: string;
}

export interface TeacherDatabaseLibraryEntryInput {
  title: string;
  createTableFileName: string;
  createTableSql: string;
  datasets: TeacherDatabaseLibraryDataset[];
}

export const teacherService = {
  async getDatabaseLibrary(): Promise<TeacherDatabaseLibraryEntry[]> {
    return apiFetch("/api/teacher/database-library");
  },

  async createDatabaseLibraryEntry(data: TeacherDatabaseLibraryEntryInput): Promise<TeacherDatabaseLibraryEntry> {
    return apiFetch("/api/teacher/database-library", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateDatabaseLibraryEntry(id: string, data: TeacherDatabaseLibraryEntryInput): Promise<TeacherDatabaseLibraryEntry> {
    return apiFetch(`/api/teacher/database-library/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deleteDatabaseLibraryEntry(id: string): Promise<void> {
    return apiFetch(`/api/teacher/database-library/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async getClasses(): Promise<TeacherClass[]> {
    return apiFetch("/api/teacher/classes");
  },

  async createProblem(data: any): Promise<any> {
    return apiFetch("/api/problems", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getAllProblems(): Promise<any[]> {
    return apiFetch("/api/problems");
  },

  async getProblem(id: string): Promise<any> {
    return apiFetch(`/api/problems/${encodeURIComponent(id)}`);
  },

  async updateProblem(id: string, data: any): Promise<any> {
    return apiFetch(`/api/problems/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deleteProblem(id: string): Promise<any> {
    return apiFetch(`/api/problems/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async validateSolution(data: any): Promise<any> {
    return apiFetch("/api/problems/validate", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getAllStudents(): Promise<TeacherClassMember[]> {
    return apiFetch("/api/teacher/classes/students");
  },

  async createClass(data: ClassCreate): Promise<TeacherClass> {
    return apiFetch("/api/teacher/classes", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getClassMembers(classId: string): Promise<TeacherClassMember[]> {
    return apiFetch(`/api/teacher/classes/${encodeURIComponent(classId)}/members`);
  },

  async addClassMember(classId: string, data: ClassMemberAdd): Promise<TeacherClassMember> {
    return apiFetch(`/api/teacher/classes/${encodeURIComponent(classId)}/members`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async removeClassMember(classId: string, studentId: string): Promise<void> {
    return apiFetch(`/api/teacher/classes/${encodeURIComponent(classId)}/members/${encodeURIComponent(studentId)}`, {
      method: "DELETE",
    });
  },

  async importClassMembers(classId: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);

    return apiFetch(`/api/teacher/classes/${encodeURIComponent(classId)}/members/import`, {
      method: "POST",
      body: formData,
    });
  },

  async getAssignments(): Promise<any[]> {
    return apiFetch("/api/assignments");
  },

  async getAudienceCount(audienceType: "classes" | "all_students", classIds: string[]): Promise<{ eligibleStudents: number }> {
    const params = new URLSearchParams({ audience_type: audienceType });
    classIds.forEach((id) => params.append("class_ids", id));
    return apiFetch(`/api/assignments/audience-count?${params.toString()}`);
  },

  async getAssignment(id: string): Promise<any> {
    return apiFetch(`/api/assignments/${encodeURIComponent(id)}`);
  },

  async uploadContestBanner(banner: Blob, source: Blob): Promise<{ bannerUrl: string; bannerSourceUrl: string }> {
    const body = new FormData();
    body.append("banner", banner, "contest-banner.webp");
    body.append("source", source, "contest-banner-source.webp");
    return apiFetch("/api/assignments/banners", { method: "POST", body });
  },

  async createAssignment(data: any): Promise<any> {
    return apiFetch("/api/assignments", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateAssignment(id: string, data: any): Promise<any> {
    return apiFetch(`/api/assignments/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deleteAssignment(id: string): Promise<any> {
    return apiFetch(`/api/assignments/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async getSubmission(id: string): Promise<any> {
    return apiFetch(`/api/submissions/${encodeURIComponent(id)}`);
  },

  async updateSubmissionReview(id: string, finalScore: number, feedback: string): Promise<any> {
    return apiFetch(`/api/submissions/${encodeURIComponent(id)}/review`, {
      method: "PUT",
      body: JSON.stringify({ finalScore, feedback }),
    });
  },

  async getAssignmentSubmissions(assignmentId: string): Promise<any[]> {
    return apiFetch(`/api/assignments/${encodeURIComponent(assignmentId)}/submissions`);
  },
};
