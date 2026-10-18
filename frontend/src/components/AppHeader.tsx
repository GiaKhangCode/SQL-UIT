import type { ReactNode } from "react";
import { RoleHeader } from "./RoleHeader";
export function AppHeader({ workspace, workspaceActions, workspaceProblemNavigation }: { workspaceActions?: ReactNode; workspaceProblemNavigation?: ReactNode; workspace?: { title: string; number: string; topic: string; source?: string; context?: string; backTo?: string } }) { return <RoleHeader role="student" workspace={workspace} workspaceActions={workspaceActions} workspaceProblemNavigation={workspaceProblemNavigation} />; }
