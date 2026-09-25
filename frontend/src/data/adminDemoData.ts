import { storage } from "../services/storage";

export type AdminUser = {
  name: string;
  email: string;
  role: "Student" | "Lecturer" | "Admin";
  status: "Active" | "Inactive" | "Pending";
  lastActive: string;
  joined: string;
  detail: string;
};

export const adminUsers: AdminUser[] = [
  { name: "Huy Lai", email: "huy@example.edu", role: "Lecturer", status: "Active", lastActive: "Today", joined: "Sep 01, 2026", detail: "Teaching 3 classes · Last active today at 09:41" },
  { name: "Bao Tran", email: "bao@example.edu", role: "Student", status: "Active", lastActive: "Today", joined: "Sep 03, 2026", detail: "Completed 18 SQL problems" },
  { name: "Ngoc Linh", email: "linh@example.edu", role: "Student", status: "Active", lastActive: "Yesterday", joined: "Sep 03, 2026", detail: "Completed 12 SQL problems" },
  { name: "Minh Nguyen", email: "minh@example.edu", role: "Lecturer", status: "Active", lastActive: "Sep 16", joined: "Aug 28, 2026", detail: "Teaching 2 classes · Last active Sep 16" },
  { name: "Duc Nguyen", email: "duc@example.edu", role: "Student", status: "Inactive", lastActive: "Sep 10", joined: "Aug 20, 2026", detail: "No recent course activity" },
];

const adminUsersKey = "querylab:admin:users:v1";

export function readAdminUsers(): AdminUser[] {
  try {
    const saved = storage.get(adminUsersKey);
    return saved ? (JSON.parse(saved) as AdminUser[]) : adminUsers;
  } catch {
    return adminUsers;
  }
}

export function saveAdminUsers(users: AdminUser[]) {
  storage.set(adminUsersKey, JSON.stringify(users));
}

export type AdminLecturerRequest = {
  name: string;
  email: string;
  department: string;
  submitted: string;
};

const lecturerRequestsKey = "querylab:admin:lecturer-requests:v1";
const initialLecturerRequests: AdminLecturerRequest[] = [
  { name: "Thu Pham", email: "thu.pham@example.edu", department: "Information Systems", submitted: "Sep 23, 2026" },
  { name: "An Vo", email: "an.vo@example.edu", department: "Computer Science", submitted: "Sep 22, 2026" },
];

export function readAdminLecturerRequests(): AdminLecturerRequest[] {
  try {
    const saved = storage.get(lecturerRequestsKey);
    return saved ? (JSON.parse(saved) as AdminLecturerRequest[]) : initialLecturerRequests;
  } catch {
    return initialLecturerRequests;
  }
}

export function saveAdminLecturerRequests(requests: AdminLecturerRequest[]) {
  storage.set(lecturerRequestsKey, JSON.stringify(requests));
}

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

export const adminClasses: AdminClass[] = [
  { course: "IS207 · Web Development", id: "IS207.R11", lecturer: "Huy Lai", students: 42, status: "Active", semester: "Semester 2, 2026", dates: "Sep 07 – Nov 28, 2026" },
  { course: "IS207 · Web Development", id: "IS207.R12", lecturer: "Unassigned", students: 39, status: "Draft", semester: "Semester 2, 2026", dates: "Sep 07 – Nov 28, 2026" },
  { course: "IS207 · Web Development", id: "IS207.R13", lecturer: "Minh Nguyen", students: 40, status: "Active", semester: "Semester 2, 2026", dates: "Sep 07 – Nov 28, 2026" },
  { course: "IS336 · ERP Planning", id: "IS336.R12", lecturer: "Minh Nguyen", students: 36, status: "Active", semester: "Semester 2, 2026", dates: "Sep 07 – Nov 28, 2026" },
];

const adminClassesKey = "querylab:admin:classes:v1";

export function readAdminClasses(): AdminClass[] {
  try {
    const saved = storage.get(adminClassesKey);
    if (!saved) return adminClasses;
    return (JSON.parse(saved) as Partial<AdminClass>[]).map((item) => ({
      ...adminClasses.find((sample) => sample.id === item.id),
      ...item,
      semester: item.semester === "Semester 1, 2025" || item.semester === "Semester 2, 2026"
        ? item.semester
        : "Semester 2, 2026",
    })) as AdminClass[];
  } catch {
    return adminClasses;
  }
}

export function saveAdminClasses(classes: AdminClass[]) {
  storage.set(adminClassesKey, JSON.stringify(classes));
}

export const adminProblems = [
  { title: "Customers without orders", author: "Huy Lai", status: "Pending review", submitted: "Sep 18", difficulty: "Medium", topics: "JOIN · MySQL", schema: "Schema loads successfully", reference: "Reference solution passes", expected: "Expected output is defined" },
  { title: "Revenue by category", author: "Bao Tran", status: "Published", submitted: "Sep 17", difficulty: "Easy", topics: "GROUP BY · MySQL", schema: "Schema loads successfully", reference: "Reference solution passes", expected: "Expected output is defined" },
  { title: "Top customers", author: "Minh Nguyen", status: "Pending review", submitted: "Sep 16", difficulty: "Hard", topics: "Subquery · PostgreSQL", schema: "Schema loads successfully", reference: "Reference solution passes", expected: "Expected output is defined" },
  { title: "Monthly order totals", author: "Huy Lai", status: "Published", submitted: "Sep 15", difficulty: "Medium", topics: "GROUP BY · MySQL", schema: "Schema loads successfully", reference: "Reference solution passes", expected: "Expected output is defined" },
];

export type AdminPracticeProblem = {
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

const adminPracticeProblemsKey = "querylab:admin:practice-problems:v1";

export function readAdminPracticeProblems(): AdminPracticeProblem[] {
  try {
    const saved = storage.get(adminPracticeProblemsKey);
    return saved ? (JSON.parse(saved) as AdminPracticeProblem[]) : adminPracticeProblems;
  } catch {
    return adminPracticeProblems;
  }
}

export function saveAdminPracticeProblems(problems: AdminPracticeProblem[]) {
  storage.set(adminPracticeProblemsKey, JSON.stringify(problems));
}

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

const adminRolePolicyKey = "querylab:admin:role-policy:v1";

export function readAdminRolePolicy(): AdminRolePolicy {
  try {
    const saved = storage.get(adminRolePolicyKey);
    if (!saved) return defaultAdminRolePolicy;
    const parsed = JSON.parse(saved) as Partial<AdminRolePolicy>;
    const permissions = Object.fromEntries(adminCapabilities.map(({ key }) => [
      key,
      { ...defaultAdminRolePolicy.permissions[key], ...parsed.permissions?.[key] },
    ])) as AdminRolePolicy["permissions"];
    permissions.manageAccounts.Admin = true;
    return {
      permissions,
      scopes: {
        Student: { ...defaultAdminRolePolicy.scopes.Student, ...parsed.scopes?.Student },
        Lecturer: { ...defaultAdminRolePolicy.scopes.Lecturer, ...parsed.scopes?.Lecturer },
        Admin: { ...defaultAdminRolePolicy.scopes.Admin, ...parsed.scopes?.Admin },
      },
    };
  } catch {
    return defaultAdminRolePolicy;
  }
}

export function saveAdminRolePolicy(policy: AdminRolePolicy) {
  storage.set(adminRolePolicyKey, JSON.stringify(policy));
}

export const adminPracticeProblems: AdminPracticeProblem[] = [
  { title: "Revenue by category", topics: "GROUP BY · JOIN", difficulty: "Medium", solvedBy: 214, status: "Visible", author: "Bao Tran", published: "Sep 12", database: "MySQL", attempted: 214, acceptance: 71, submissions: 1024, comments: true, hints: true, note: "Featured in the Week 3 practice set.", featured: true, description: "Calculate total sales revenue for each product category using completed order items.", schemaPreview: "categories(id, name)\nproducts(id, category_id, name)\norder_items(product_id, quantity, unit_price)", expectedColumns: "category_name, revenue" },
  { title: "Employees by department", topics: "SELECT · WHERE", difficulty: "Easy", solvedBy: 612, status: "Visible", author: "Huy Lai", published: "Sep 10", database: "MySQL", attempted: 612, acceptance: 84, submissions: 1390, comments: true, hints: true, note: "", featured: false, description: "List each department with the number of active employees assigned to it.", schemaPreview: "departments(id, name)\nemployees(id, department_id, active)", expectedColumns: "department_name, employee_count" },
  { title: "Monthly order totals", topics: "Aggregation", difficulty: "Medium", solvedBy: 187, status: "Visible", author: "Minh Nguyen", published: "Sep 09", database: "MySQL", attempted: 187, acceptance: 68, submissions: 824, comments: true, hints: false, note: "", featured: false, description: "Group orders by calendar month and calculate the total value of each month's orders.", schemaPreview: "orders(id, created_at, status)\norder_items(order_id, quantity, unit_price)", expectedColumns: "order_month, order_total" },
  { title: "Duplicate emails", topics: "GROUP BY · HAVING", difficulty: "Easy", solvedBy: 95, status: "Hidden", author: "Huy Lai", published: "Sep 06", database: "MySQL", attempted: 95, acceptance: 76, submissions: 411, comments: false, hints: true, note: "", featured: false, description: "Find email addresses that appear on more than one customer record and show how many records share each address.", schemaPreview: "customers(id, name, email)", expectedColumns: "email, account_count" },
  { title: "Top customers", topics: "Subquery · CTE", difficulty: "Hard", solvedBy: 41, status: "Visible", author: "Minh Nguyen", published: "Sep 04", database: "PostgreSQL", attempted: 41, acceptance: 39, submissions: 206, comments: true, hints: false, note: "", featured: false, description: "Return the three customers with the highest lifetime spend across their orders.", schemaPreview: "customers(id, name)\norders(id, customer_id, status)\norder_items(order_id, quantity, unit_price)", expectedColumns: "customer_name, lifetime_spend" },
];

export const adminPracticeTopics = [
  { name: "SELECT", problems: 12 },
  { name: "WHERE", problems: 10 },
  { name: "JOIN", problems: 9 },
  { name: "GROUP BY", problems: 8 },
  { name: "ORDER BY", problems: 7 },
  { name: "Aggregation", problems: 6 },
  { name: "Subquery", problems: 5 },
  { name: "CTE", problems: 4 },
  { name: "HAVING", problems: 4 },
  { name: "NULL", problems: 3 },
  { name: "Window functions", problems: 2 },
  { name: "Dates", problems: 2 },
];

export const adminActivity = [
  { action: "Problem published", by: "Huy Lai", time: "14:42" },
  { action: "Class IS207.R13 created", by: "Admin", time: "14:28" },
  { action: "Account deactivated", by: "Admin", time: "13:51" },
  { action: "Lecturer assigned to IS207.R12", by: "Admin", time: "11:20" },
  { action: "Week 3 assignment published", by: "Minh Nguyen", time: "10:45" },
];
