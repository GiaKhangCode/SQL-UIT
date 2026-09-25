import { spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const origin = "http://localhost:5173";
const title = "Browser E2E SQL lab";
const profile = await mkdtemp(join(tmpdir(), "sqluit-flow-"));
const chrome = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore", windowsHide: true });

let socket;
try {
  let port;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { port = Number((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  if (!port) throw new Error("Chrome did not open a debugging port");
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const pending = new Map();
  const failures = [];
  const exceptions = [];
  let nextId = 0;
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.method === "Network.responseReceived" && message.params.response.status >= 400)
      failures.push({ status: message.params.response.status, url: message.params.response.url });
    if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.text);
    if (!pending.has(message.id)) return;
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
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(`${result.exceptionDetails.text}: ${expression}`);
    return result.result.value;
  };
  const waitFor = async (expression, label) => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Timeout: ${label}; page ${await evaluate("location.pathname + ' ' + document.body.innerText.slice(-500)")}`);
  };
  const navigate = async path => {
    await send("Page.navigate", { url: origin + path });
    await waitFor(`location.pathname === ${JSON.stringify(path.split("?")[0])}`, path);
  };
  const setValue = (selector, value) => evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) throw new Error('Missing input ${selector}');
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return el.value;
  })()`);
  const clickText = (selector, label) => evaluate(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(x => x.textContent.trim() === ${JSON.stringify(label)});
    if (!el) throw new Error('Missing control ${label}');
    el.click(); return true;
  })()`);
  const api = (path, options = {}) => evaluate(`fetch(${JSON.stringify(path)}, {
    ...${JSON.stringify(options)},
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('sql-practice:access-token'), 'Content-Type': 'application/json' }
  }).then(async r => ({ status: r.status, body: await r.json() }))`);
  const login = async (email, password, home) => {
    await navigate("/login");
    await waitFor("!!document.querySelector('#login-email')", "login form");
    await setValue("#login-email", email);
    await setValue("#login-password", password);
    await clickText("form button", "Sign in");
    await waitFor(`location.pathname === ${JSON.stringify(home)}`, `${email} login`);
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  await login("instructor@demo.local", "password123", "/teacher/problems");
  let assignmentId;
  let item;
  let published;
  if (process.argv[2] !== "resume") {
  await navigate("/teacher/assignments/new");
  await waitFor("!!document.querySelector('.teacher-add-class') && !!document.querySelector('input[type=datetime-local]')", "builder");
  await setValue(".teacher-builder-setup input", title);
  await setValue(".teacher-builder-setup textarea", "Complete both customer queries. Scores are reviewed by the lecturer.");
  const dates = await evaluate(`(() => { const now = Date.now(); const local = t => { const d = new Date(t); return new Date(t - d.getTimezoneOffset() * 60000).toISOString().slice(0,16); }; return [local(now - 3600000), local(now + 2 * 86400000)]; })()`);
  await setValue("input[type=datetime-local]:first-of-type", dates[0]);
  await setValue(".teacher-schedule-section .teacher-field:nth-of-type(3) input", dates[1]).catch(async () => {
    await evaluate(`(() => { const el = document.querySelectorAll('input[type=datetime-local]')[1]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(dates[1])}); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  });
  await clickText("button", "+ Add class");
  await waitFor("!!document.querySelector('.teacher-class-options')", "class options");
  await evaluate(`document.querySelector('.teacher-class-options label').querySelector('input').click()`);
  await clickText(".teacher-class-options button", "Done");

  for (const problemTitle of ["Customer directory", "Orders over 100"]) {
    await clickText("button", "Add from library");
    await waitFor("!!document.querySelector('.teacher-add-problem-list')", "problem picker");
    await evaluate(`(() => { const row = [...document.querySelectorAll('.teacher-add-problem-list > div')].find(x => x.textContent.includes(${JSON.stringify(problemTitle)})); if (!row) throw new Error('Problem missing'); row.querySelector('button').click(); })()`);
  }
  await setValue('input[aria-label="Points for Customer directory"]', "17");
  await setValue('input[aria-label="Points for Orders over 100"]', "23");
  await evaluate(`document.querySelector('button[aria-label="Move Orders over 100 up"]').click()`);
  await waitFor("!document.querySelector('.teacher-page-actions button.primary').disabled", "publish enabled");
  await clickText(".teacher-page-actions button", "Save draft");
  await waitFor("location.pathname === '/teacher/assignments'", "saved draft list");
  const draft = await api("/api/assignments");
  item = draft.body.find(x => x.title === title);
  if (!item || item.published || item.classIds.length !== 1 || item.problemList.map(x => x.points).join() !== "23,17")
    throw new Error("Draft was not saved with class, order, and points: " + JSON.stringify(item));
  assignmentId = item.id;
  await navigate(`/teacher/assignments/${assignmentId}/edit`);
  await waitFor("!!document.querySelector('.teacher-page-actions button.primary')", "edit builder");
  await clickText(".teacher-page-actions button", "Publish");
  await waitFor("document.body.innerText.includes('Successfully published')", "published state");
  published = await api(`/api/assignments/${assignmentId}`);
  if (!published.body.published || published.body.status !== "Open") throw new Error("Publish failed: " + JSON.stringify(published));
  } else {
    const catalog = await api("/api/assignments");
    item = catalog.body.find(x => x.title === title);
    if (!item) throw new Error("Existing browser assignment missing");
    assignmentId = item.id;
    published = await api(`/api/assignments/${assignmentId}`);
  }

  await evaluate("localStorage.clear()");
  await login("student@demo.local", "password123", "/dashboard");
  await navigate(`/assignments/work/${assignmentId}`);
  await waitFor(`document.body.innerText.includes(${JSON.stringify(title)}) && document.body.innerText.includes('Orders over 100')`, "student assignment detail");
  await navigate(`/workspace/dev-where?source=Assignments&context=${encodeURIComponent(title)}`);
  await waitFor("!!document.querySelector('.cm-content')", "SQL editor");
  await evaluate("document.querySelector('.cm-content').focus()");
  await send("Input.insertText", { text: "SELECT order_id, amount FROM Orders WHERE amount > 100 ORDER BY order_id;" });
  await waitFor("document.querySelector('.cm-content').innerText.includes('SELECT order_id')", "SQL entered");
  await clickText("button", "Run all");
  await waitFor("document.querySelectorAll('.data-table tbody tr').length === 3", "SQL run result");
  const submitLabels = await evaluate("[...document.querySelectorAll('button')].map(x => x.textContent.trim()).filter(x => /submit/i.test(x))");
  await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(x => /Submit/i.test(x.textContent)); if (!b) throw new Error('Submit button missing'); b.click(); })()`);
  await waitFor("document.body.innerText.includes('Accepted')", "accepted submission");
  const studentSubs = await api("/api/submissions?source=Assignments");
  const submission = studentSubs.body.find(x => x.context === title && x.problemId === "dev-where");
  if (!submission || submission.result !== "Accepted") throw new Error("Student submission missing: " + JSON.stringify(studentSubs));

  await evaluate("localStorage.clear()");
  await login("instructor@demo.local", "password123", "/teacher/problems");
  await navigate("/teacher/results");
  await waitFor(`document.body.innerText.includes(${JSON.stringify(title)})`, "teacher result row");
  await navigate(`/teacher/results/review/${submission.id}`);
  await waitFor(`!!document.querySelector('input[aria-label="Final score"]')`, "manual review");
  await setValue('input[aria-label="Final score"]', "87");
  await setValue('.teacher-grading-panel textarea', "Correct query and ordering; clear work.");
  await clickText(".teacher-page-actions button", "Save review");
  await waitFor("document.body.innerText.includes('Review saved')", "review saved");

  const reviewed = await api(`/api/submissions/${submission.id}`);
  if (reviewed.body.finalScore !== 87) throw new Error("Review score missing: " + JSON.stringify(reviewed));
  await evaluate("localStorage.clear()");
  await login("student@demo.local", "password123", "/dashboard");
  await navigate("/submissions");
  await waitFor("document.body.innerText.includes('Orders over 100')", "student submissions");
  await evaluate(`(() => { const row = [...document.querySelectorAll('.submissions-table tbody tr')].find(x => x.textContent.includes(${JSON.stringify(title)})); if (!row) throw new Error('Assignment submission row missing'); row.querySelector('button').click(); })()`);
  await waitFor("document.body.innerText.includes('Correct query and ordering; clear work.') && document.body.innerText.includes('87/100')", "student submission details");
  const studentReview = await api("/api/submissions");
  const final = studentReview.body.find(x => x.id === submission.id);
  if (final?.evaluatedScore !== 87 || !final.feedback?.includes("Correct query"))
    throw new Error("Student review feedback missing: " + JSON.stringify(final));
  if (failures.length || exceptions.length) throw new Error("Browser failures: " + JSON.stringify({ failures, exceptions }));
  console.log(JSON.stringify({ assignmentId, submissionId: submission.id, draft: item, published: published.body.status, submitLabels, finalScore: final.evaluatedScore, feedback: final.feedback, failures, exceptions }, null, 2));
} finally {
  socket?.close();
  chrome.kill();
}
