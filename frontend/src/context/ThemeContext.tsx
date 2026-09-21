import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { storage } from "../services/storage";
const ThemeContext = createContext({
  dark: false,
  toggle: () => {},
  setTheme: (_theme: "light" | "dark") => {},
});
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(
    () => storage.get("sql-practice:theme") === "dark",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    storage.set("sql-practice:theme", dark ? "dark" : "light");
  }, [dark]);
  return (
    <ThemeContext.Provider
      value={{
        dark,
        toggle: () => setDark((d) => !d),
        setTheme: (theme) => setDark(theme === "dark"),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
