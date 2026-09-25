import { storage } from "../services/storage";

export type TeacherProblem = {
  id: string;
  number: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  visibility: "Private" | "Public";
  topics: string;
  statement: string;
  requirements: string;
  hints: string[];
  database: string;
  schema: string;
  seedData: string;
  seedSummary: string;
  referenceSolution: string;
  expectedColumns: string[];
  expectedRows: (string | number)[][];
  testCases?: { seedData: string; isHidden: boolean }[];
};

export const teacherProblems: TeacherProblem[] = [
  {
    id: "p1",
    number: "014",
    title: "Customers without orders",
    difficulty: "Medium",
    visibility: "Private",
    topics: "JOIN · SELECT · NULL",
    statement:
      "Given the Customers and Orders tables, find customers who have never placed an order.",
    requirements:
      "Return customer_id and customer_name. Sort by customer_id in ascending order.",
    hints: ["Use a LEFT JOIN and check for NULL matches."],
    database: "MySQL 8.0",
    schema: `CREATE TABLE Customers (
  customer_id INT PRIMARY KEY,
  customer_name VARCHAR(100)
);

CREATE TABLE Orders (
  order_id INT PRIMARY KEY,
  customer_id INT
);`,
    seedData: `INSERT INTO Customers (customer_id, customer_name) VALUES
  (1, 'An Nguyen'),
  (2, 'Bao Tran'),
  (3, 'Chi Le'),
  (4, 'Ngoc Linh');
  -- + 8 more rows

INSERT INTO Orders (order_id, customer_id) VALUES
  (101, 1),
  (102, 1),
  (103, 3);
  -- + 21 more rows`,
    seedSummary: "12 customers · 24 orders",
    referenceSolution: `SELECT c.customer_id, c.customer_name
FROM Customers AS c
LEFT JOIN Orders AS o
  ON c.customer_id = o.customer_id
WHERE o.order_id IS NULL
ORDER BY c.customer_id;`,
    expectedColumns: ["customer_id", "customer_name"],
    expectedRows: [
      [2, "Bao Tran"],
      [4, "Ngoc Linh"],
    ],
  },
  {
    id: "p11",
    number: "026",
    title: "Revenue by category",
    difficulty: "Medium",
    visibility: "Private",
    topics: "GROUP BY · SUM",
    statement: "Calculate total sales revenue for each product category.",
    requirements:
      "Return category and revenue, ordered by revenue from highest to lowest.",
    hints: ["Group rows by category before summing their revenue."],
    database: "MySQL 8.0",
    schema: "CREATE TABLE Sales (sale_id INT, category VARCHAR(80), amount DECIMAL(10,2));",
    seedData: "INSERT INTO Sales (sale_id, category, amount) VALUES\n  -- Demo seed rows",
    seedSummary: "24 sales across 6 categories",
    referenceSolution:
      "SELECT category, SUM(amount) AS revenue\nFROM Sales\nGROUP BY category\nORDER BY revenue DESC;",
    expectedColumns: ["category", "revenue"],
    expectedRows: [
      ["Hardware", 12450],
      ["Software", 9800],
    ],
  },
  {
    id: "p12",
    number: "052",
    title: "Top customers",
    difficulty: "Hard",
    visibility: "Private",
    topics: "JOIN · GROUP BY · ORDER BY",
    statement: "Find the three customers with the highest total order value.",
    requirements:
      "Return customer_id, customer_name and total_spend in descending spend order.",
    hints: ["Join customers to orders, aggregate, then sort and limit."],
    database: "MySQL 8.0",
    schema: "CREATE TABLE Customers (customer_id INT, customer_name VARCHAR(100));\nCREATE TABLE Orders (order_id INT, customer_id INT, amount DECIMAL(10,2));",
    seedData: "INSERT INTO Customers (customer_id, customer_name) VALUES\n  -- Demo seed rows",
    seedSummary: "12 customers · 24 orders",
    referenceSolution:
      "SELECT c.customer_id, c.customer_name, SUM(o.amount) AS total_spend\nFROM Customers c JOIN Orders o USING (customer_id)\nGROUP BY c.customer_id, c.customer_name\nORDER BY total_spend DESC\nLIMIT 3;",
    expectedColumns: ["customer_id", "customer_name", "total_spend"],
    expectedRows: [
      [7, "Mai Pham", 8120],
      [3, "Bao Tran", 7650],
      [2, "Ngoc Linh", 7310],
    ],
  },
];

export type TeacherClass = {
  id: string;
  course: string;
  term: string;
  students: number;
  mode: "Group work" | "Individual" | string;
  status: "Active" | "Archived" | string;
  startDate?: string;
  endDate?: string;
  groups: {
    id: string;
    members: number;
    lastSubmission: string;
  }[];
};

export const teacherClasses: TeacherClass[] = [
  {
    id: "IS207.R11",
    course: "Web Development",
    term: "Semester 2, 2026",
    students: 42,
    mode: "Group work",
    status: "Active",
    groups: [
      { id: "Group 01", members: 5, lastSubmission: "Sep 18 · 14:32" },
      { id: "Group 02", members: 5, lastSubmission: "Sep 18 · 12:08" },
      { id: "Group 03", members: 4, lastSubmission: "Pending" },
      { id: "Group 04", members: 5, lastSubmission: "Sep 17 · 16:40" },
    ],
  },
  {
    id: "IS207.R12",
    course: "Web Development",
    term: "Semester 1, 2026",
    students: 39,
    mode: "Individual",
    status: "Active",
    groups: [
      { id: "Group 01", members: 1, lastSubmission: "Sep 18 · 16:03" },
      { id: "Group 02", members: 1, lastSubmission: "Sep 18 · 15:22" },
    ],
  },
  {
    id: "IS207.R13",
    course: "Database Systems",
    term: "Semester 1, 2025",
    students: 40,
    mode: "Group work",
    status: "Active",
    groups: [
      { id: "Group 01", members: 5, lastSubmission: "Sep 17 · 11:45" },
      { id: "Group 02", members: 5, lastSubmission: "Sep 16 · 09:12" },
    ],
  },
];

export type TeacherClassMember = {
  id?: string;
  name: string;
  email?: string;
  role: string;
  joinedAt?: string;
};

export const teacherRoster: TeacherClassMember[] = [
  { name: "Bao Tran", role: "Group leader" },
  { name: "Ngoc Linh", role: "Member" },
  { name: "Minh Anh", role: "Member" },
  { name: "Duc Nguyen", role: "Member" },
];

export type TeacherClassAssignmentProgress = {
  id: string;
  title: string;
  dueDate: string;
  submitted: number;
  expected: number;
  status: "In progress" | "Closed";
};

export type TeacherStudentProgress = {
  id: string;
  name: string;
  submissions: number;
  completedAssignments: number;
};

export type TeacherClassProgress = {
  assignments: TeacherClassAssignmentProgress[];
  students: TeacherStudentProgress[];
};

export const teacherClassProgress: Record<string, TeacherClassProgress> = {
  "IS207.R11": {
    assignments: [
      { id: "r11-a1", title: "HTML and CSS foundations", dueDate: "Sep 28, 2026", submitted: 33, expected: 42, status: "In progress" },
      { id: "r11-a2", title: "Interactive web pages", dueDate: "Oct 05, 2026", submitted: 28, expected: 42, status: "In progress" },
      { id: "r11-a3", title: "Responsive portfolio", dueDate: "Oct 12, 2026", submitted: 18, expected: 42, status: "In progress" },
    ],
    students: [
      { id: "22521234", name: "Khoa Tran", submissions: 5, completedAssignments: 2 },
      { id: "22520987", name: "Lan Pham", submissions: 3, completedAssignments: 2 },
      { id: "22521456", name: "Hung Vo", submissions: 1, completedAssignments: 1 },
      { id: "22521001", name: "Mai Do", submissions: 4, completedAssignments: 3 },
    ],
  },
  "IS207.R12": {
    assignments: [
      { id: "r12-a1", title: "HTML and CSS foundations", dueDate: "Mar 18, 2026", submitted: 32, expected: 39, status: "Closed" },
      { id: "r12-a2", title: "Interactive web pages", dueDate: "Mar 25, 2026", submitted: 26, expected: 39, status: "Closed" },
    ],
    students: [
      { id: "22521234", name: "Bao Tran", submissions: 4, completedAssignments: 2 },
      { id: "22520987", name: "Ngoc Linh", submissions: 5, completedAssignments: 2 },
      { id: "22521456", name: "Minh Anh", submissions: 2, completedAssignments: 1 },
      { id: "22521001", name: "Duc Nguyen", submissions: 3, completedAssignments: 2 },
    ],
  },
  "IS207.R13": {
    assignments: [
      { id: "r13-a1", title: "SQL foundations", dueDate: "Mar 10, 2025", submitted: 38, expected: 40, status: "Closed" },
      { id: "r13-a2", title: "Joins and aggregation", dueDate: "Mar 17, 2025", submitted: 36, expected: 40, status: "Closed" },
      { id: "r13-a3", title: "Database design", dueDate: "Mar 24, 2025", submitted: 31, expected: 40, status: "Closed" },
    ],
    students: [
      { id: "22521234", name: "Khoa Tran", submissions: 6, completedAssignments: 3 },
      { id: "22520987", name: "Lan Pham", submissions: 4, completedAssignments: 3 },
      { id: "22521456", name: "Hung Vo", submissions: 5, completedAssignments: 2 },
      { id: "22521001", name: "Mai Do", submissions: 3, completedAssignments: 2 },
    ],
  },
};

export type TeacherSubmission = {
  id: string;
  student: string;
  problem: string;
  autoScore: number;
  maxScore: number;
  finalScore: number | null;
  status: "Needs review" | "Accepted";
  attempts: string;
  query: string;
  submittedAt: string;
};

export const teacherSubmissions: TeacherSubmission[] = [
  {
    id: "1042",
    student: "Bao Tran",
    problem: "Customers without orders",
    autoScore: 8,
    maxScore: 10,
    finalScore: 8,
    status: "Needs review",
    attempts: "2 of 3",
    query: `SELECT c.customer_id, c.customer_name
FROM Customers AS c
LEFT JOIN Orders AS o
  ON c.customer_id = o.customer_id
WHERE o.order_id IS NULL;`,
    submittedAt: "Sep 18, 14:32",
  },
  {
    id: "1043",
    student: "Ngoc Linh",
    problem: "Revenue by category",
    autoScore: 15,
    maxScore: 15,
    finalScore: 15,
    status: "Accepted",
    attempts: "1 of 3",
    query: teacherProblems[1].referenceSolution,
    submittedAt: "Sep 18, 14:18",
  },
  {
    id: "1044",
    student: "Minh Anh",
    problem: "Customers without orders",
    autoScore: 10,
    maxScore: 10,
    finalScore: 10,
    status: "Accepted",
    attempts: "3 of 3",
    query: teacherProblems[0].referenceSolution,
    submittedAt: "Sep 18, 13:54",
  },
  {
    id: "1045",
    student: "Duc Nguyen",
    problem: "Top customers",
    autoScore: 10,
    maxScore: 15,
    finalScore: null,
    status: "Needs review",
    attempts: "1 of 3",
    query: "SELECT customer_id, SUM(amount) AS total_spend FROM Orders GROUP BY customer_id;",
    submittedAt: "Sep 18, 13:21",
  },
  {
    id: "1046",
    student: "Thu Ha",
    problem: "Revenue by category",
    autoScore: 12,
    maxScore: 15,
    finalScore: 12,
    status: "Accepted",
    attempts: "2 of 3",
    query: "SELECT category, SUM(amount) FROM Sales GROUP BY category;",
    submittedAt: "Sep 18, 12:47",
  },
];

export const teacherTestResults = [
  { test: "01 · Sample data", result: "Passed", detail: "2 rows returned" },
  { test: "02 · Empty orders", result: "Passed", detail: "All customers returned" },
  { test: "03 · Duplicate orders", result: "Passed", detail: "No duplicates" },
  { test: "04 · Null handling", result: "Passed", detail: "Correct" },
  { test: "05 · Output ordering", result: "Failed", detail: "Expected ascending customer_id" },
];

export function readTeacherDraft<T>(key: string, fallback: T): T {
  try {
    const value = storage.get(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveTeacherDraft<T>(key: string, value: T) {
  storage.set(key, JSON.stringify(value));
}
