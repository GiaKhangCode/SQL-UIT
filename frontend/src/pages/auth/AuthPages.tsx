import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { APP_NAME } from "../../data/mockData";
import { validEmail } from "../../services/mockAuthService";
import { ThemeToggle } from "../../components/AppHeader";
type Errors = Record<string, string>;
function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="field" htmlFor={id}>
      {label}
      <span className="password-input">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? id + "-error" : undefined}
        />
        <button
          type="button"
          className="icon-button"
          onClick={() => setVisible((v) => !v)}
          aria-label={
            visible
              ? "Hide " + label.toLowerCase()
              : "Show " + label.toLowerCase()
          }
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
      {error && (
        <small id={id + "-error"} className="field-error">
          {error}
        </small>
      )}
    </label>
  );
}
function AuthLayout({
  register = false,
  children,
}: {
  register?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main id="main-content" className="auth-page">
      <section className="auth-brand-panel" aria-label="QueryLab introduction">
        <div className="auth-wordmark"><span>Q</span><b>QueryLab</b></div>
        <div className="auth-pitch">
          <div><h2>Write the query.<br />See the result.</h2><p>Practice on real schemas and check every run against the expected output.</p></div>
          <div className="editor-preview" aria-label="SQL editor preview">
            <div className="preview-bar"><b>join-orders.sql</b><span>Run</span></div>
            <pre><code><i>1</i>  <em>-- Orders per customer</em>{"\n"}<i>2</i>  <strong>SELECT</strong> c.name, COUNT(o.id) <strong>AS</strong> orders{"\n"}<i>3</i>  <strong>FROM</strong> customers c{"\n"}<i>4</i>  <strong>LEFT JOIN</strong> orders o <strong>ON</strong> o.customer_id = c.id{"\n"}<i>5</i>  <strong>GROUP BY</strong> c.name{"\n"}<i>6</i>  <strong>ORDER BY</strong> orders <strong>DESC</strong>;</code></pre>
            <div className="preview-result"><code>name              orders{"\n"}Nguyen An              4{"\n"}Tran Binh               3{"\n"}Le Chi                  0</code><b>Accepted · 3 rows · 12 ms</b></div>
          </div>
        </div>
        <small>UIT · Web SQL Practice</small>
      </section>
      <section className="auth-form-panel">
        <div className="auth-theme"><ThemeToggle /></div>
        <div className="auth-form-wrap">
          <div className="auth-heading">
            <h1>{register ? "Create your account" : "Welcome back"}</h1>
            <p>{register ? "Register with your student email to start practicing SQL." : "Sign in to continue practicing SQL."}</p>
          </div>
          {children}
          <p className="auth-note">Teacher accounts are created by an administrator.</p>
        </div>
      </section>
    </main>
  );
}
export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const intended = (location.state as { from?: string } | null)?.from;
  const destination =
    intended &&
    /^\/(dashboard|practice|workspace|assignments|contests|submissions)(\/|\?|#|$)/.test(
      intended,
    )
      ? intended
      : "/dashboard";
  async function signIn(demo = false) {
    if (busy) return;
    setErrors({});
    setMessage("");
    if (!demo) {
      const next: Errors = {};
      if (!validEmail(email.trim()))
        next.email = "Enter a valid email address.";
      if (!password.trim()) next.password = "Enter a password.";
      if (Object.keys(next).length) {
        setErrors(next);
        return;
      }
    }
    setBusy(true);
    try {
      if (demo) await auth.demoLogin();
      else await auth.login(email.trim(), password);
      navigate(destination, { replace: true });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Sign-in failed. Try again.");
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void signIn();
  }
  return (
    <AuthLayout>
      <form onSubmit={submit} noValidate>
        <label className="field" htmlFor="login-email">
          Email
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            placeholder="student@demo.local"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <small id="email-error" className="field-error">
              {errors.email}
            </small>
          )}
        </label>
        <PasswordField
          id="login-password"
          label="Password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          autoComplete="current-password"
        />
        <button
          className="forgot-link"
          type="button"
          onClick={() =>
            setMessage(
              "Password recovery is unavailable in this frontend demo. Continue as a demo student instead.",
            )
          }
        >
          Forgot password?
        </button>
        {message && (
          <p role="alert" className="form-message">
            {message}
          </p>
        )}
        <button className="button primary full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="auth-switch">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </form>
      <button
        className="button full"
        disabled={busy}
        onClick={() => void signIn(true)}
      >
        Continue as demo student
      </button>
      <details className="demo-details">
        <summary>Demo credentials & validation</summary>
        <p>
          Use student@demo.local with any non-empty password, or any valid
          email. To demonstrate rejection, use invalid@demo.local or the
          password invalid. This is mock authentication.
        </p>
      </details>
    </AuthLayout>
  );
}
export function RegisterPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next: Errors = {};
    if (!name.trim()) next.name = "Enter your full name.";
    if (!validEmail(email.trim())) next.email = "Enter a valid school email.";
    if (
      password.length < 8 ||
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password)
    )
      next.password = "Use at least 8 characters with a letter and a number.";
    if (!confirm || confirm !== password)
      next.confirm = "Passwords must match.";
    setErrors(next);
    setMessage("");
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await auth.register(name, email, password);
      navigate("/dashboard", { replace: true, state: { welcome: true } });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout register>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <label className="field" htmlFor="register-name">
          Full name
          <input
            id="register-name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name}
          />
          {errors.name && <small className="field-error">{errors.name}</small>}
        </label>
        <label className="field" htmlFor="register-email">
          School email
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            placeholder="you@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <small className="field-error">{errors.email}</small>
          )}
        </label>
        <PasswordField
          id="register-password"
          label="Password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          autoComplete="new-password"
        />
        <p className="password-requirements">
          At least 8 characters, including a letter and a number.
        </p>
        <PasswordField
          id="register-confirm"
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          error={errors.confirm}
          autoComplete="new-password"
        />
        {message && (
          <p role="alert" className="form-message">
            {message}
          </p>
        )}
        <button className="button primary full" disabled={busy}>
          {busy ? "Creating your account…" : "Create account"}
        </button>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
