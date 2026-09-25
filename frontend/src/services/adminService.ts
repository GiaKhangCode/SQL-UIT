import { apiFetch } from "./apiClient";

export interface AdminUser {
  id?: string;
  name: string;
  email: string;
  role: "Student" | "Lecturer" | "Admin" | string;
  status: "Active" | "Inactive" | "Pending" | string;
  lastActive: string;
  joined: string;
  detail: string;
}

export const adminService = {
  async getUsers(): Promise<AdminUser[]> {
    return apiFetch("/api/admin/users");
  },

  async updateUser(email: string, data: Partial<AdminUser>): Promise<AdminUser> {
    return apiFetch(`/api/admin/users/${encodeURIComponent(email)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async createUser(data: any): Promise<AdminUser> {
    return apiFetch("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getClasses(): Promise<any[]> {
    return apiFetch("/api/admin/classes");
  },

  async createClass(data: any): Promise<any> {
    return apiFetch("/api/admin/classes", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateClass(id: string, data: any): Promise<any> {
    return apiFetch(`/api/admin/classes/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async getLecturerRequests(): Promise<any[]> {
    return apiFetch("/api/admin/users/lecturer-requests");
  },

  async approveLecturerRequest(id: string): Promise<any> {
    return apiFetch(`/api/admin/users/lecturer-requests/${encodeURIComponent(id)}/approve`, {
      method: "POST"
    });
  },

  async rejectLecturerRequest(id: string): Promise<any> {
    return apiFetch(`/api/admin/users/lecturer-requests/${encodeURIComponent(id)}/reject`, {
      method: "POST"
    });
  },

  async getOverviewStats(): Promise<any> {
    return apiFetch("/api/admin/overview/stats");
  },

  async getActivities(): Promise<any[]> {
    return apiFetch("/api/admin/overview/activities");
  },

  async getErrors(): Promise<any[]> {
    return apiFetch("/api/admin/overview/errors");
  }
};
