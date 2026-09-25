import { apiFetch } from "./apiClient";
import type { TeacherClass, TeacherClassMember } from "../data/teacherDemoData";

export interface ClassCreate {
  id: string;
  course: string;
  term: string;
  mode?: string;
  startDate?: string;
  endDate?: string;
}

export interface ClassMemberAdd {
  student_id: string;
}

export const teacherService = {
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

  async getAssignments(): Promise<any[]> {
    return apiFetch("/api/assignments");
  },

  async getAssignment(id: string): Promise<any> {
    return apiFetch(`/api/assignments/${encodeURIComponent(id)}`);
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
