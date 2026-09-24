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

export const adminClasses = [
  { course: "IS207 · Web Development", id: "IS207.R11", lecturer: "Huy Lai", students: 42, status: "Active", dates: "Sep 07 – Nov 28, 2026" },
  { course: "IS207 · Web Development", id: "IS207.R12", lecturer: "Unassigned", students: 39, status: "Draft", dates: "Sep 07 – Nov 28, 2026" },
  { course: "IS207 · Web Development", id: "IS207.R13", lecturer: "Minh Nguyen", students: 40, status: "Active", dates: "Sep 07 – Nov 28, 2026" },
  { course: "IS336 · ERP Planning", id: "IS336.R12", lecturer: "Minh Nguyen", students: 36, status: "Active", dates: "Sep 07 – Nov 28, 2026" },
];

export const adminProblems = [
  { title: "Customers without orders", author: "Huy Lai", status: "Pending review", submitted: "Sep 18", difficulty: "Medium", topics: "JOIN · MySQL", schema: "Schema loads successfully", reference: "Reference solution passes", expected: "Expected output is defined" },
  { title: "Revenue by category", author: "Bao Tran", status: "Published", submitted: "Sep 17", difficulty: "Easy", topics: "GROUP BY · MySQL", schema: "Schema loads successfully", reference: "Reference solution passes", expected: "Expected output is defined" },
  { title: "Top customers", author: "Minh Nguyen", status: "Pending review", submitted: "Sep 16", difficulty: "Hard", topics: "Subquery · PostgreSQL", schema: "Schema loads successfully", reference: "Reference solution passes", expected: "Expected output is defined" },
  { title: "Monthly order totals", author: "Huy Lai", status: "Published", submitted: "Sep 15", difficulty: "Medium", topics: "GROUP BY · MySQL", schema: "Schema loads successfully", reference: "Reference solution passes", expected: "Expected output is defined" },
];

export const adminActivity = [
  { action: "Problem published", by: "Huy Lai", time: "14:42" },
  { action: "Class IS207.R13 created", by: "Admin", time: "14:28" },
  { action: "Account deactivated", by: "Admin", time: "13:51" },
  { action: "Lecturer assigned to IS207.R12", by: "Admin", time: "11:20" },
  { action: "Week 3 assignment published", by: "Minh Nguyen", time: "10:45" },
];
