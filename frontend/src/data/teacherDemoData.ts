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
  seedSummary: string;
  referenceSolution: string;
  expectedColumns: string[];
  expectedRows: (string | number)[][];
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
    seedSummary: "12 customers / 24 orders",
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
    seedSummary: "12 customers / 24 orders",
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
  students: number;
  mode: "Group work" | "Individual";
  status: "Active" | "Archived";
  pendingJoinRequests: number;
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
    students: 42,
    mode: "Group work",
    status: "Active",
    pendingJoinRequests: 3,
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
    students: 39,
    mode: "Individual",
    status: "Active",
    pendingJoinRequests: 0,
    groups: [
      { id: "Group 01", members: 1, lastSubmission: "Sep 18 · 16:03" },
      { id: "Group 02", members: 1, lastSubmission: "Sep 18 · 15:22" },
    ],
  },
  {
    id: "IS207.R13",
    course: "Database Systems",
    students: 40,
    mode: "Group work",
    status: "Active",
    pendingJoinRequests: 1,
    groups: [
      { id: "Group 01", members: 5, lastSubmission: "Sep 17 · 11:45" },
      { id: "Group 02", members: 5, lastSubmission: "Sep 16 · 09:12" },
    ],
  },
];

export const teacherRoster = [
  { name: "Bao Tran", role: "Group leader" },
  { name: "Ngoc Linh", role: "Member" },
  { name: "Minh Anh", role: "Member" },
  { name: "Duc Nguyen", role: "Member" },
];

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
