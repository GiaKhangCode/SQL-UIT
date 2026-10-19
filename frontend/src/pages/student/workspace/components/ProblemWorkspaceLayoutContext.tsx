import { createContext, useContext, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { readLayouts } from "../../../../utils/workspacePreferences";

export type ProblemWorkspacePreferences = ReturnType<typeof readLayouts>;
type ProblemWorkspaceLayoutValue = {
  preferences: ProblemWorkspacePreferences;
  setPreferences: Dispatch<SetStateAction<ProblemWorkspacePreferences>>;
  focus?: boolean;
  setFocus?: Dispatch<SetStateAction<boolean>>;
};

const ProblemWorkspaceLayoutContext = createContext<ProblemWorkspaceLayoutValue | null>(null);

export function ProblemWorkspaceLayoutProvider({ value, children }: {
  value: ProblemWorkspaceLayoutValue;
  children: ReactNode;
}) {
  return <ProblemWorkspaceLayoutContext.Provider value={value}>{children}</ProblemWorkspaceLayoutContext.Provider>;
}

export function useProblemWorkspaceLayout() {
  return useContext(ProblemWorkspaceLayoutContext);
}
