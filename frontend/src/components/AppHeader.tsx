import { RoleHeader } from "./RoleHeader";
export function AppHeader({ workspace }: { workspace?: { title: string; number: string; topic: string; source?: string; context?: string; backTo?: string } }) { return <RoleHeader role="student" workspace={workspace} />; }
