export type AdminLecturerRequest = {
  name: string;
  email: string;
  department: string;
  submitted: string;
};

export type AdminClass = {
  course: string;
  id: string;
  lecturer: string;
  students: number;
  status: "Active" | "Draft" | "Archived" | string;
  semester: string;
  dates: string;
  startDate?: string;
  endDate?: string;
};

export type AdminPracticeProblem = {
  id?: string;
  title: string;
  topics: string;
  difficulty: "Easy" | "Medium" | "Hard";
  solvedBy: number;
  status: "Visible" | "Hidden";
  author: string;
  published: string;
  database: string;
  attempted: number;
  acceptance: number;
  submissions: number;
  comments: boolean;
  hints: boolean;
  note: string;
  featured: boolean;
  description: string;
  schemaPreview: string;
  expectedColumns: string;
};

export type AdminRoleName = "Student" | "Lecturer" | "Admin";
export type AdminRolePolicy = {
  permissions: Record<string, Record<AdminRoleName, boolean>>;
  scopes: Record<AdminRoleName, {
    classAccess: "No class access" | "Assigned classes only" | "All classes";
    problemAccess: "Published problems only" | "Own problems + shared library" | "All problems";
  }>;
};

export const adminCapabilities = [
  { key: "runSql", label: "Run & submit assigned SQL" },
  { key: "authorProblems", label: "Create and publish problems" },
  { key: "managePractice", label: "Manage Practice catalog" },
  { key: "manageClasses", label: "Assign work & manage groups" },
  { key: "reviewGrades", label: "Review and adjust grades" },
  { key: "manageAccounts", label: "Manage accounts & roles" },
  { key: "configureCourses", label: "Configure courses & terms" },
] as const;

export const defaultAdminRolePolicy: AdminRolePolicy = {
  permissions: {
    runSql: { Student: true, Lecturer: true, Admin: false },
    authorProblems: { Student: false, Lecturer: true, Admin: false },
    managePractice: { Student: false, Lecturer: false, Admin: true },
    manageClasses: { Student: false, Lecturer: true, Admin: true },
    reviewGrades: { Student: false, Lecturer: true, Admin: false },
    manageAccounts: { Student: false, Lecturer: false, Admin: true },
    configureCourses: { Student: false, Lecturer: false, Admin: true },
  },
  scopes: {
    Student: { classAccess: "Assigned classes only", problemAccess: "Published problems only" },
    Lecturer: { classAccess: "Assigned classes only", problemAccess: "Own problems + shared library" },
    Admin: { classAccess: "All classes", problemAccess: "All problems" },
  },
};
