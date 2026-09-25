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
};
