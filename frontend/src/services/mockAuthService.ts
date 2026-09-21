import { delay, storage } from "./storage";
export type StudentSession = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: "student";
};
export const SESSION_KEY = "sql-practice:mock-session:v1";
export const demoStudent: StudentSession = {
  id: "student-demo",
  name: "Huy Lai",
  initials: "HL",
  email: "student@demo.local",
  role: "student",
};
export const validEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
function persist(session: StudentSession) {
  storage.set(SESSION_KEY, JSON.stringify(session));
  return session;
}
export const mockAuthService = {
  async login(email: string, password: string) {
    await delay(null);
    if (!validEmail(email) || !password.trim())
      throw new Error("Enter a valid email and a password.");
    if (email.toLowerCase() === "invalid@demo.local" || password === "invalid")
      throw new Error(
        "Mock sign-in rejected. Use a different email or password.",
      );
    return persist({ ...demoStudent, email: email.trim() });
  },
  async demoLogin() {
    return persist(await delay({ ...demoStudent }, 150));
  },
  async register(name: string, email: string, password: string) {
    await delay(null);
    if (
      !name.trim() ||
      !validEmail(email) ||
      password.length < 8 ||
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password)
    )
      throw new Error("Check the registration fields.");
    return persist({
      id: "student-local",
      name: name.trim(),
      email: email.trim(),
      initials: name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase(),
      role: "student",
    });
  },
  logout() {
    storage.remove(SESSION_KEY);
  },
  restoreSession(): StudentSession | null {
    try {
      const value: unknown = JSON.parse(storage.get(SESSION_KEY) || "null");
      if (
        value &&
        typeof value === "object" &&
        "role" in value &&
        value.role === "student" &&
        "id" in value &&
        typeof value.id === "string" &&
        "name" in value &&
        typeof value.name === "string" &&
        "email" in value &&
        typeof value.email === "string" &&
        "initials" in value &&
        typeof value.initials === "string"
      )
        return value as StudentSession;
    } catch {
      /* Ignore malformed mock sessions. */
    }
    return null;
  },
};
