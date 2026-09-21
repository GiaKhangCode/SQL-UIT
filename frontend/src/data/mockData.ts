export const APP_NAME = "QueryLab";
export type Progress = "Solved" | "In progress" | "Not started";
export type Verdict =
  | "Accepted"
  | "Wrong Answer"
  | "Runtime Error"
  | "Time Limit Exceeded";
export type DataTable = {
  name: string;
  columns: string[];
  rows: (string | number)[][];
};
export type Problem = {
  practiceListed?: boolean;
  id: string;
  number: string;
  title: string;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard";
  progress: Progress;
  description: string;
  requirements: string;
  draft: string;
  tables: DataTable[];
  expected: DataTable;
  hint: string;
};
const customers: DataTable = {
  name: "Customers",
  columns: ["customer_id", "customer_name"],
  rows: [
    [1, "Minh Anh"],
    [2, "Bao Tran"],
    [3, "Huy Lai"],
    [4, "Ngoc Linh"],
  ],
};
const orders: DataTable = {
  name: "Orders",
  columns: ["order_id", "customer_id", "amount"],
  rows: [
    [101, 1, 120],
    [102, 3, 85],
    [103, 1, 60],
  ],
};
const products: DataTable = {
  name: "Products",
  columns: ["product_id", "product_name", "price"],
  rows: [
    [1, "Keyboard", 45],
    [2, "Monitor", 180],
    [3, "Mouse", 25],
  ],
};
export const problems: Problem[] = [
  {
    id: "p1",
    number: "014",
    title: "Customers without orders",
    topic: "JOIN",
    difficulty: "Medium",
    progress: "In progress",
    description:
      "Given the Customers and Orders tables, find customers who have never placed an order.",
    requirements:
      "Return customer_id and customer_name. Sort the result by customer_id in ascending order.",
    draft:
      "-- Find customers without orders.\nSELECT c.customer_id, c.customer_name\nFROM Customers AS c\nLEFT JOIN Orders AS o\n  ON o.customer_id = c.customer_id\nWHERE o.order_id IS NULL\nORDER BY c.customer_id;",
    tables: [customers, orders],
    expected: {
      name: "Expected result",
      columns: customers.columns,
      rows: [
        [2, "Bao Tran"],
        [4, "Ngoc Linh"],
      ],
    },
    hint: "Which join preserves customers without a matching order? Consider checking for a missing value after joining.",
  },
  {
    id: "p2",
    number: "025",
    title: "Monthly revenue",
    topic: "GROUP BY",
    difficulty: "Medium",
    progress: "In progress",
    description:
      "Calculate total sales revenue for each month from the Sales table.",
    requirements: "Return month and revenue, ordered by month.",
    draft:
      "-- Group sales by month.\nSELECT month, SUM(amount) AS revenue\nFROM Sales\nGROUP BY month\nORDER BY month;",
    tables: [
      {
        name: "Sales",
        columns: ["sale_id", "month", "amount"],
        rows: [
          [1, "2026-09", 120],
          [2, "2026-09", 80],
          [3, "2026-10", 150],
        ],
      },
    ],
    expected: {
      name: "Expected result",
      columns: ["month", "revenue"],
      rows: [
        ["2026-09", 200],
        ["2026-10", 150],
      ],
    },
    hint: "Combine rows belonging to the same month before calculating their sum.",
  },
  {
    id: "p3",
    number: "001",
    title: "Filter products by price",
    topic: "WHERE",
    difficulty: "Easy",
    progress: "In progress",
    description: "Find products with a price greater than 30.",
    requirements: "Return product_id and product_name, ordered by product_id.",
    draft:
      "-- Filter products.\nSELECT product_id, product_name\nFROM Products\nWHERE price > 30\nORDER BY product_id;",
    tables: [products],
    expected: {
      name: "Expected result",
      columns: ["product_id", "product_name"],
      rows: [
        [1, "Keyboard"],
        [2, "Monitor"],
      ],
    },
    hint: "Use a row-level condition to exclude inexpensive products.",
  },
  {
    id: "p4",
    number: "032",
    title: "Revenue ranking",
    topic: "WINDOW FUNCTIONS",
    difficulty: "Hard",
    progress: "Not started",
    description:
      "Rank customers by total order amount. Equal totals should share the same rank.",
    requirements:
      "Return customer_id, total_spend and revenue_rank. Use dense ranking in descending spend order.",
    draft:
      "-- Calculate totals, then rank them.\nSELECT customer_id, SUM(amount) AS total_spend\nFROM Orders\nGROUP BY customer_id;",
    tables: [orders],
    expected: {
      name: "Expected result",
      columns: ["customer_id", "total_spend", "revenue_rank"],
      rows: [
        [1, 180, 1],
        [3, 85, 2],
      ],
    },
    hint: "Consider how dense ranking treats ties in aggregated rows.",
  },
  {
    id: "p5",
    number: "004",
    title: "Customer list",
    topic: "SELECT",
    difficulty: "Easy",
    progress: "Solved",
    description: "List every customer in the database.",
    requirements:
      "Return customer_id and customer_name in ascending customer_id order.",
    draft:
      "SELECT customer_id, customer_name\nFROM Customers\nORDER BY customer_id;",
    tables: [customers],
    expected: customers,
    hint: "Select the required columns and apply a stable order.",
  },
  {
    id: "p6",
    number: "019",
    title: "Join customers and orders",
    topic: "JOIN",
    difficulty: "Medium",
    progress: "Not started",
    description: "Show the customer name associated with each order.",
    requirements:
      "Return order_id, customer_name and amount, ordered by order_id.",
    draft:
      "SELECT o.order_id, c.customer_name, o.amount\nFROM Orders AS o\nJOIN Customers AS c ON c.customer_id = o.customer_id\nORDER BY o.order_id;",
    tables: [customers, orders],
    expected: {
      name: "Expected result",
      columns: ["order_id", "customer_name", "amount"],
      rows: [
        [101, "Minh Anh", 120],
        [102, "Huy Lai", 85],
        [103, "Minh Anh", 60],
      ],
    },
    hint: "Match the customer identifier in both tables. Which table determines the output rows?",
  },
];
problems.push(
  {
    id: "p7",
    number: "008",
    title: "Sort orders",
    topic: "ORDER BY",
    difficulty: "Easy",
    progress: "Not started",
    description: "List all orders, starting with the highest amount.",
    requirements:
      "Return order_id and amount. Sort by amount descending, then order_id ascending.",
    draft:
      "SELECT order_id, amount\nFROM Orders\nORDER BY amount DESC, order_id;",
    tables: [orders],
    expected: {
      name: "Expected result",
      columns: ["order_id", "amount"],
      rows: [
        [101, 120],
        [103, 60],
        [102, 85],
      ].sort((a, b) => b[1] - a[1]),
    },
    hint: "Use DESC for the amount and a second sort key to resolve ties.",
  },
  {
    id: "p8",
    number: "022",
    title: "Total spend by customer",
    topic: "JOIN",
    difficulty: "Medium",
    progress: "Not started",
    description:
      "Calculate the total order amount for every customer, including customers without orders.",
    requirements:
      "Return customer_id, customer_name and total_spend. Use zero for customers without orders and sort by customer_id.",
    draft:
      "SELECT c.customer_id, c.customer_name, COALESCE(SUM(o.amount), 0) AS total_spend\nFROM Customers AS c\nLEFT JOIN Orders AS o ON o.customer_id = c.customer_id\nGROUP BY c.customer_id, c.customer_name\nORDER BY c.customer_id;",
    tables: [customers, orders],
    expected: {
      name: "Expected result",
      columns: ["customer_id", "customer_name", "total_spend"],
      rows: [
        [1, "Minh Anh", 180],
        [2, "Bao Tran", 0],
        [3, "Huy Lai", 85],
        [4, "Ngoc Linh", 0],
      ],
    },
    hint: "Keep all customers with a LEFT JOIN. Aggregate the amounts and replace a null total with zero.",
  },
);
// Additional practice rows keep the infinite-scroll behavior easy to exercise.
problems.push(
  {
    id: "p9",
    number: "041",
    title: "Orders above average",
    practiceListed: false,
    topic: "SUBQUERY",
    difficulty: "Medium",
    progress: "Not started",
    description: "Find orders whose amount exceeds the average order amount.",
    requirements:
      "Return order_id and amount for orders above the average amount, sorted by order_id.",
    draft:
      "SELECT order_id, amount\nFROM Orders\nWHERE amount > (SELECT AVG(amount) FROM Orders)\nORDER BY order_id;",
    tables: [orders],
    expected: {
      name: "Expected result",
      columns: ["order_id", "amount"],
      rows: [[101, 120]],
    },
    hint: "Calculate the average in a scalar subquery and compare each order against it.",
  },
  {
    id: "p10",
    number: "047",
    title: "Running totals",
    practiceListed: false,
    topic: "WINDOW FUNCTIONS",
    difficulty: "Hard",
    progress: "Not started",
    description:
      "Calculate cumulative order revenue in order identifier sequence.",
    requirements:
      "Return order_id, amount and running_total, ordered by order_id.",
    draft:
      "SELECT order_id, amount,\n  SUM(amount) OVER (ORDER BY order_id ROWS UNBOUNDED PRECEDING) AS running_total\nFROM Orders\nORDER BY order_id;",
    tables: [orders],
    expected: {
      name: "Expected result",
      columns: ["order_id", "amount", "running_total"],
      rows: [
        [101, 120, 120],
        [102, 85, 205],
        [103, 60, 265],
      ],
    },
    hint: "Use a SUM window function with an ordered frame beginning at the first row.",
  },
);
export const classes = [
  {
    id: "c1",
    code: "DB101 · CLASS A",
    name: "Database Systems",
    lecturer: "Nguyen Minh",
    mode: "Group work",
  },
  {
    id: "c2",
    code: "SQL101 · CLASS B",
    name: "SQL Fundamentals",
    lecturer: "Tran Lan",
    mode: "Individual",
  },
  {
    id: "c3",
    code: "SQL201 · CLASS C",
    name: "Advanced SQL",
    lecturer: "Le An",
    mode: "Group work",
  },
  {
    id: "c4",
    code: "DA101 · CLASS D",
    name: "Data Analytics",
    lecturer: "Pham Huy",
    mode: "Individual",
  },
];
export const groups = [
  { id: "g1", name: "Group 03", code: "GROUP 03", classId: "c1", members: 4 },
  { id: "g2", name: "Group 02", code: "GROUP 02", classId: "c3", members: 3 },
];
export type Assignment = {
  id: string;
  title: string;
  classId: string;
  groupId?: string;
  date: string;
  time: string;
  status: Progress;
  problemIds: string[];
};
export const assignments: Assignment[] = [
  {
    id: "a1",
    title: "SELECT & filtering",
    classId: "c2",
    date: "2026-09-18",
    time: "23:59",
    status: "In progress",
    problemIds: ["p3", "p5"],
  },
  {
    id: "a2",
    title: "JOIN practice",
    classId: "c1",
    groupId: "g1",
    date: "2026-09-20",
    time: "23:59",
    status: "In progress",
    problemIds: ["p1", "p6"],
  },
  {
    id: "a3",
    title: "Schema design",
    classId: "c1",
    groupId: "g1",
    date: "2026-09-24",
    time: "23:59",
    status: "Not started",
    problemIds: ["p2", "p4"],
  },
  {
    id: "a4",
    title: "Window functions",
    classId: "c3",
    groupId: "g2",
    date: "2026-09-22",
    time: "23:59",
    status: "Not started",
    problemIds: ["p4", "p10"],
  },
  {
    id: "a5",
    title: "Revenue analysis",
    classId: "c4",
    date: "2026-09-29",
    time: "23:59",
    status: "Not started",
    problemIds: ["p2", "p8"],
  },
  {
    id: "a6",
    title: "Relational algebra",
    classId: "c1",
    date: "2026-09-27",
    time: "23:59",
    status: "Solved",
    problemIds: ["p5", "p6", "p7"],
  },
];
export type Contest = {
  id: string;
  title: string;
  status: "Active" | "Upcoming" | "Closed";
  date: string;
  time: string;
  endTime: string;
  scope: string;
  description: string;
  participants: number;
  problemIds: string[];
};
export const contests: Contest[] = [
  {
    id: "t1",
    title: "SQL Sprint #05",
    status: "Active",
    date: "2026-09-18",
    time: "19:00",
    endTime: "20:30",
    scope: "Database Systems · Group 03",
    description:
      "Joins under pressure. Solve SQL problems in a 90-minute challenge.",
    participants: 142,
    problemIds: ["p1", "p6", "p2"],
  },
  {
    id: "t2",
    title: "Campus Query Cup",
    status: "Upcoming",
    date: "2026-09-24",
    time: "19:30",
    endTime: "21:00",
    scope: "SQL Fundamentals · Individual",
    description:
      "Represent your class. A balanced challenge in joins and aggregation.",
    participants: 128,
    problemIds: ["p2", "p4", "p5"],
  },
  {
    id: "t3",
    title: "Data Logic Arena",
    status: "Upcoming",
    date: "2026-09-27",
    time: "18:00",
    endTime: "19:30",
    scope: "Database Systems · Group 03",
    description:
      "Four-person team challenge in data logic and query optimization.",
    participants: 86,
    problemIds: ["p4", "p6"],
  },
  {
    id: "t4",
    title: "SQL Sprint #04",
    status: "Closed",
    date: "2026-09-15",
    time: "19:00",
    endTime: "21:00",
    scope: "SQL Fundamentals · Individual",
    description: "Review the September warm-up and practice its problems.",
    participants: 94,
    problemIds: ["p1", "p3"],
  },
];
export type Submission = {
  id: string;
  problemId: string;
  source: "Practice" | "Assignments" | "Contests";
  context: string;
  result: Verdict;
  score: number;
  submittedAt: string;
  query?: string;
  database?: string;
  evaluatedScore?: number;
  feedback?: string;
};
export const submissions: Submission[] = [
  {
    id: "s1",
    query: "SELECT * FROM Customers; -- mock:timeout",
    database: "MySQL",
    problemId: "p1",
    source: "Contests",
    context: "SQL Sprint #04",
    result: "Time Limit Exceeded",
    score: 0,
    submittedAt: "2026-09-15T19:12:00+07:00",
  },
  {
    id: "s2",
    query: "SELECT customer_id, customer_name FROM Customers;",
    database: "MySQL",
    problemId: "p1",
    source: "Practice",
    context: "JOIN · Basic",
    result: "Wrong Answer",
    score: 40,
    submittedAt: "2026-09-15T19:10:00+07:00",
  },
  {
    id: "s3",
    query: problems.find((p) => p.id === "p1")!.draft,
    database: "MySQL",
    problemId: "p1",
    source: "Practice",
    context: "JOIN · Basic",
    result: "Accepted",
    score: 100,
    submittedAt: "2026-09-15T19:08:00+07:00",
  },
  {
    id: "s4",
    query: "SELECT * FROM MissingTable;",
    database: "Oracle",
    problemId: "p6",
    source: "Assignments",
    context: "JOIN practice",
    result: "Runtime Error",
    score: 0,
    submittedAt: "2026-09-15T19:05:00+07:00",
  },
  {
    id: "s5",
    query: problems.find((p) => p.id === "p5")!.draft,
    database: "MySQL",
    evaluatedScore: 92,
    feedback: "Correct result. Keep aliases and formatting consistent.",
    problemId: "p5",
    source: "Assignments",
    context: "SELECT & filtering",
    result: "Accepted",
    score: 100,
    submittedAt: "2026-09-14T21:05:00+07:00",
  },
];
export type Deadline = {
  id: string;
  title: string;
  date: string;
  time: string;
  kind: "Assignment" | "Contest";
  context: string;
  to: string;
};
export const deadlines: Deadline[] = [
  ...assignments
    .filter((a) => a.status !== "Solved")
    .map((a) => ({
      id: a.id,
      title: a.title,
      date: a.date,
      time: a.time,
      kind: "Assignment" as const,
      context:
        classes.find((c) => c.id === a.classId)!.name +
        (a.groupId
          ? " · " + groups.find((g) => g.id === a.groupId)!.name
          : " · Individual"),
      to: "/assignments?work=" + a.id,
    })),
  ...contests
    .filter((c) => c.status !== "Closed")
    .map((c) => ({
      id: c.id,
      title: c.title,
      date: c.date,
      time: c.endTime,
      kind: "Contest" as const,
      context: c.scope,
      to: "/contests?contest=" + c.id,
    })),
].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
