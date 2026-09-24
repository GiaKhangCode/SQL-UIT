import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import {
  authService,
  type StudentSession,
} from "../services/authService";
type Auth = {
  session: StudentSession | null;
  login: (email: string, password: string) => Promise<StudentSession>;
  register: (name: string, email: string, password: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  logout: () => void;
};
const AuthContext = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(authService.restoreSession);

  // Background session verify
  useEffect(() => {
    authService.restoreSessionAsync().then(user => {
      if (!user && session) setSession(null);
      if (user && !session) setSession(user);
    });
  }, []);

  const auth: Auth = {
    session,
    login: async (e, p) => {
      const user = await authService.login(e, p);
      setSession(user);
      return user;
    },
    register: async (n, e, p) =>
      setSession(await authService.register(n, e, p)),
    demoLogin: async () => setSession(await authService.demoLogin()),
    logout: () => {
      authService.logout();
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
