import { createContext, useContext, useState, type ReactNode } from "react";
import {
  mockAuthService,
  type StudentSession,
} from "../services/mockAuthService";
type Auth = {
  session: StudentSession | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  logout: () => void;
};
const AuthContext = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(mockAuthService.restoreSession);
  const auth: Auth = {
    session,
    login: async (e, p) => setSession(await mockAuthService.login(e, p)),
    register: async (n, e, p) =>
      setSession(await mockAuthService.register(n, e, p)),
    demoLogin: async () => setSession(await mockAuthService.demoLogin()),
    logout: () => {
      mockAuthService.logout();
      setSession(null);
    },
  };
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("AuthProvider is required");
  return auth;
}
