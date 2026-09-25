import { storage } from "./storage";
import { apiFetch } from "./apiClient";

export type StudentSession = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: "student" | "instructor" | "admin";
};

export const SESSION_KEY = "sql-practice:session:v1";
export const TOKEN_KEY = "sql-practice:access-token";
let sessionVersion = 0;

export const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

function persist(user: StudentSession, token: string) {
  sessionVersion += 1;
  storage.set(SESSION_KEY, JSON.stringify(user));
  storage.set(TOKEN_KEY, token);
  return user;
}

export const authService = {
  async login(email: string, password: string) {
    const account = email.trim().toLowerCase();
    const demoAlias = account === "teacher" ? "instructor@demo.local" : account === "admin" ? "admin@demo.local" : null;
    if ((!demoAlias && !validEmail(email)) || !password.trim())
      throw new Error("Enter a valid email and a password.");
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: demoAlias || email, password: demoAlias === "instructor@demo.local" && password === "123" ? "password123" : password }),
    });
    return persist(data.user, data.access_token);
  },
  
  async demoLogin() {
    const data = await apiFetch("/api/auth/demo", { method: "POST" });
    return persist(data.user, data.access_token);
  },
  
  async register(name: string, email: string, password: string) {
    if (!name.trim() || !validEmail(email) || password.length < 8) {
      throw new Error("Check the registration fields.");
    }
    const data = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    return persist(data.user, data.access_token);
  },

  async registerLecturer(name: string, email: string, password: string, department: string) {
    if (!name.trim() || !validEmail(email) || password.length < 8 || !department.trim()) {
      throw new Error("Check the registration fields.");
    }
    const data = await apiFetch("/api/auth/register-lecturer", {
      method: "POST",
      body: JSON.stringify({ name, email, password, department }),
    });
    return data; // Returns { message: "..." }
  },
  
  logout() {
    sessionVersion += 1;
    storage.remove(SESSION_KEY);
    storage.remove(TOKEN_KEY);
  },
  
  async restoreSessionAsync(): Promise<StudentSession | null> {
    const token = storage.get(TOKEN_KEY);
    if (!token) {
      storage.remove(SESSION_KEY);
      return null;
    }
    const version = sessionVersion;
    try {
      const user = await apiFetch("/api/auth/me");
      if (sessionVersion !== version || storage.get(TOKEN_KEY) !== token) return null;
      storage.set(SESSION_KEY, JSON.stringify(user));
      return user;
    } catch {
      if (sessionVersion === version && storage.get(TOKEN_KEY) === token) authService.logout();
      return null;
    }
  },
  
  restoreSession(): StudentSession | null {
    try {
      const value = JSON.parse(storage.get(SESSION_KEY) || "null");
      if (value && value.id) {
        return value as StudentSession;
      }
    } catch {
      /* Ignore malformed sessions. */
    }
    return null;
  }
};
