import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const role = process.argv[2];
const width = Number(process.argv[3] || "1440");
const output = process.argv[4] || join(tmpdir(), `sqluit-real-${role}.png`);
const sweep = process.argv[5] === "sweep";
const theme = process.argv[6] === "dark" ? "dark" : "light";
const accounts = {
  student: { email: "student@demo.local", password: "password123", home: "/dashboard", forbidden: "/admin/overview" },
  instructor: { email: "instructor@demo.local", password: "password123", home: "/teacher/problems", forbidden: "/dashboard" },
  admin: { email: "admin@demo.local", password: "123", home: "/admin/overview", forbidden: "/teacher/problems" },
};
const account = accounts[role];
if (!account) throw new Error("Role must be student, instructor, or admin.");

const profile = await mkdtemp(join(tmpdir(), "sqluit-real-auth-"));
const chrome = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore", windowsHide: true });

let socket;
try {
  let port;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      port = Number((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]);
      break;
    } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  if (!port) throw new Error("Chrome did not open a debugging port.");
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  const failures = [];
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.method === "Network.responseReceived" && message.params.response.status >= 400) {
      failures.push({ status: message.params.response.status, path: new URL(message.params.response.url).pathname });
    }
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (predicate, label) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(predicate)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for ${label}; current path: ${await evaluate("location.pathname")}`);
  };
  const navigate = async path => {
    await send("Page.navigate", { url: `http://localhost:5173${path}` });
    await waitFor(`location.pathname === ${JSON.stringify(path)}`, path);
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
  await navigate("/login");
  await waitFor("!!document.querySelector('#login-email')", "login form");
  await evaluate("document.querySelector('#login-email').focus()");
  await send("Input.insertText", { text: account.email });
  await evaluate("document.querySelector('#login-password').focus()");
  await send("Input.insertText", { text: account.password });
  await evaluate("document.querySelector('form button.primary').click()");
  await waitFor(`location.pathname === ${JSON.stringify(account.home)}`, `${role} redirect`);
  await new Promise(resolve => setTimeout(resolve, 1000));
  if (theme === "dark") {
    await evaluate("document.querySelector('.account-trigger').click()");
    await waitFor("!!document.querySelector('#role-account-menu')", "appearance menu");
    await evaluate("[...document.querySelectorAll('#role-account-menu button')].find(button => button.textContent.includes('Dark mode')).click()");
    await waitFor("document.documentElement.dataset.theme === 'dark'", "dark theme");
    await evaluate("document.querySelector('.account-trigger').click()");
  }
  const afterLogin = await evaluate("({path: location.pathname, role: JSON.parse(localStorage.getItem('sql-practice:session:v1') || 'null')?.role, hasToken: !!localStorage.getItem('sql-practice:access-token'), scrollWidth: document.documentElement.scrollWidth, innerWidth})");
  const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(output, Buffer.from(screenshot.data, "base64"));

  await send("Page.reload");
  await waitFor(`location.pathname === ${JSON.stringify(account.home)} && !!document.querySelector('.role-header')`, "restored session");
  await new Promise(resolve => setTimeout(resolve, 300));
  const restored = await evaluate("({path: location.pathname, role: JSON.parse(localStorage.getItem('sql-practice:session:v1') || 'null')?.role})");
  await send("Page.navigate", { url: `http://localhost:5173${account.forbidden}` });
  await waitFor(`location.pathname === ${JSON.stringify(account.home)}`, "role guard redirect");
  const guarded = await evaluate("location.pathname");

  const pages = [];
  if (sweep) {
    const routes = {
      student: ["/dashboard", "/practice", "/workspace/p1", "/assignments", "/contests", "/submissions"],
      instructor: ["/teacher/problems", "/teacher/problems/new", "/teacher/assignments", "/teacher/assignments/new", "/teacher/contests", "/teacher/contests/new", "/teacher/classes", "/teacher/results"],
      admin: ["/admin/overview", "/admin/users", "/admin/users/approvals", "/admin/courses", "/admin/courses/lecturers", "/admin/practice", "/admin/roles"],
    }[role];
    for (const path of routes) {
      failures.length = 0;
      await navigate(path);
      await new Promise(resolve => setTimeout(resolve, 900));
      await waitFor("document.body.innerText.trim().length > 45 && !document.body.innerText.includes('Loading ') && !document.body.innerText.includes('Loading…') && !document.body.innerText.includes('Loading...')", `${path} settled`);
      const state = await evaluate("({path: location.pathname, scrollWidth: document.documentElement.scrollWidth, innerWidth, heading: document.querySelector('h1')?.textContent || '', text: document.body.innerText.slice(0, 220)})");
      const shotPath = join(tmpdir(), `sqluit-real-${role}-${path.replaceAll("/", "-")}-${width}-${theme}.png`);
      const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      await writeFile(shotPath, Buffer.from(shot.data, "base64"));
      pages.push({ ...state, failures: [...failures], screenshot: shotPath });
    }
    await navigate(account.home);
    await waitFor("!!document.querySelector('.account-trigger')", "account button");
  }

  await evaluate("document.querySelector('.account-trigger').click()");
  await waitFor("!!document.querySelector('#role-account-menu')", "account menu");
  await evaluate("[...document.querySelectorAll('#role-account-menu button')].find(button => button.textContent.includes('Log out')).click()");
  await waitFor("location.pathname === '/login'", "logout redirect");
  const afterLogout = await evaluate("({path: location.pathname, hasToken: !!localStorage.getItem('sql-practice:access-token'), hasSession: !!localStorage.getItem('sql-practice:session:v1')})");
  await send("Page.navigate", { url: `http://localhost:5173${account.home}` });
  await waitFor("location.pathname === '/login'", "protected route after logout");
  process.stdout.write(JSON.stringify({ role, theme, afterLogin, restored, guarded, afterLogout, failures, screenshot: output, pages }, null, 2) + "\n");
} finally {
  socket?.close();
  chrome.kill();
}
