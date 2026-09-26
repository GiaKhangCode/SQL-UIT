import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authService, validEmail } from "../../services/authService";
type Errors = Record<string, string>;
function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete: string;
  placeholder?: string;
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
          placeholder={placeholder}
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
          {visible ? "Hide" : "Show"}
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
  title,
  subtitle,
  showTeacherNote = true,
  centered = false,
  children,
}: {
  register?: boolean;
  title?: string;
  subtitle?: string;
  showTeacherNote?: boolean;
  centered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main
      id="main-content"
      className={`auth-page${centered ? " auth-page--centered" : ""}`}
    >
      {!centered && (
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
      )}
      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <div className="auth-heading">
            <h1>{title ?? (register ? "Create your account" : "Welcome back")}</h1>
            <p>
              {subtitle ??
                (register
                  ? "Register with your student email to start practicing SQL."
                  : "Sign in to continue practicing SQL.")}
            </p>
          </div>
          {children}
          {showTeacherNote && (
            <p className="auth-note">
              Teacher accounts are created by an administrator.
            </p>
          )}
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
  const teacherDestination =
    intended && /^\/teacher(?:\/|\?|#|$)/.test(intended) ? intended : null;
  const adminDestination =
    intended && /^\/admin(?:\/|\?|#|$)/.test(intended) ? intended : null;
  const destination =
    intended &&
    /^\/(dashboard|practice|workspace|assignments|contests|submissions)(\/|\?|#|$)/.test(
      intended,
    )
      ? intended
      : "/dashboard";
  async function signIn() {
    if (busy) return;
    setErrors({});
    setMessage("");
    const next: Errors = {};
    if (
      !["teacher", "admin"].includes(email.trim().toLowerCase()) &&
      !validEmail(email.trim())
    ) {
      next.email = "Enter a valid email address or a demo account.";
    }
    if (!password.trim()) next.password = "Enter a password.";
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setBusy(true);
    try {
      const user = await auth.login(email.trim(), password);
      navigate(
        user.role === "admin"
          ? adminDestination || "/admin/overview"
          : user.role === "instructor"
            ? teacherDestination || "/teacher/problems"
            : destination,
        { replace: true },
      );
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
    <AuthLayout showTeacherNote={false}>
      <form onSubmit={submit} noValidate>
        <label className="field" htmlFor="login-email">
          Email or account
          <input
            id="login-email"
            type="text"
            autoComplete="username"
            placeholder="name@example.com, teacher, or admin"
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
          placeholder="Enter your password"
        />
        <p className="auth-note teacher-demo-note">
          Demo accounts: <code>teacher</code> / <code>123</code> · <code>admin</code> / <code>123</code>
        </p>
        <button
          className="forgot-link"
          type="button"
          onClick={() => navigate("/forgot-password", { state: { email } })}
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
          New student? <Link to="/register">Create an account</Link>
          <br />
          Want to teach? <Link to="/register-lecturer">Register as Lecturer</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

function RecoveryUnavailable() {
  return (
    <p className="form-message" role="status">
      Password recovery is not connected yet. Ask an administrator to reset
      your account password.
    </p>
  );
}

export function ForgotPasswordPage() {
  const location = useLocation();
  const [email, setEmail] = useState(
    (location.state as { email?: string } | null)?.email ?? "",
  );
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    setUnavailable(false);
    if (!validEmail(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setUnavailable(true);
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your email and we’ll send you a verification code."
      showTeacherNote={false}
      centered
    >
      <form onSubmit={submit} noValidate>
        <label className="field" htmlFor="recovery-email">
          Email
          <input
            id="recovery-email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={!!error}
          />
          {error && <small className="field-error">{error}</small>}
        </label>
        {unavailable && <RecoveryUnavailable />}
        <button className="button primary full" type="submit">
          Send code
        </button>
      </form>
      <p className="auth-switch"><Link to="/login">← Back to sign in</Link></p>
    </AuthLayout>
  );
}

export function VerifyOtpPage() {
  const location = useLocation();
  const email =
    (location.state as { email?: string } | null)?.email ?? "name@example.com";
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const cells = useRef<Array<HTMLInputElement | null>>([]);
  const [unavailable, setUnavailable] = useState(false);
  return (
    <AuthLayout
      title="Verify your email"
      subtitle={`Enter the 6-digit code sent to ${email}.`}
      showTeacherNote={false}
      centered
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setUnavailable(true);
        }}
      >
        <fieldset className="otp-fieldset">
          <legend className="sr-only">Verification code</legend>
          <div className="otp-cells">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(node) => { cells.current[index] = node; }}
                aria-label={`Verification code digit ${index + 1} of 6`}
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={digit}
                onChange={(event) => {
                  const next = [...code];
                  next[index] = event.target.value.replace(/\D/g, "").slice(-1);
                  setCode(next);
                  if (next[index] && index < 5) cells.current[index + 1]?.focus();
                }}
                onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                  if (event.key === "Backspace" && !digit && index > 0) {
                    cells.current[index - 1]?.focus();
                  }
                }}
                onPaste={(event) => {
                  event.preventDefault();
                  const pasted = event.clipboardData
                    .getData("text")
                    .replace(/\D/g, "")
                    .slice(0, 6);
                  if (!pasted) return;
                  const next = [...code];
                  pasted.split("").forEach((value, digitIndex) => {
                    next[digitIndex] = value;
                  });
                  setCode(next);
                  cells.current[Math.min(pasted.length, 5)]?.focus();
                }}
              />
            ))}
          </div>
        </fieldset>
        <p className="tiny muted">Resend code in 42s</p>
        {unavailable && <RecoveryUnavailable />}
        <button className="button primary full" type="submit">
          Verify
        </button>
      </form>
      <p className="auth-switch"><Link to="/forgot-password" state={{ email }}>← Back</Link></p>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  function submit(event: FormEvent) {
    event.preventDefault();
    setUnavailable(false);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords must match.");
    setError("");
    setUnavailable(true);
  }
  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a new password for your account."
      showTeacherNote={false}
    >
      <form onSubmit={submit} noValidate>
        <PasswordField
          id="new-password"
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder="Enter a new password"
        />
        <p className="password-requirements">At least 8 characters.</p>
        <PasswordField
          id="confirm-new-password"
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          placeholder="Re-enter the new password"
        />
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {unavailable && <RecoveryUnavailable />}
        <button className="button primary full" type="submit">
          Update password
        </button>
      </form>
      <p className="auth-switch"><Link to="/login">← Back to sign in</Link></p>
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
    if (password.length < 8) next.password = "Use at least 8 characters.";
    if (!confirm || confirm !== password)
      next.confirm = "Passwords must match.";
    setErrors(next);
    setMessage("");
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await auth.register(name.trim(), email, password);
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
            type="text"
            autoComplete="name"
            placeholder="Nguyen Van A"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <small className="field-error">{errors.name}</small>
          )}
        </label>
        <label className="field" htmlFor="register-email">
          Email
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
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
          placeholder="Create a password"
        />
        <p className="password-requirements">At least 8 characters.</p>
        <PasswordField
          id="register-confirm"
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          error={errors.confirm}
          autoComplete="new-password"
          placeholder="Re-enter your password"
        />
        {message && (
          <p role="alert" className="form-message">
            {message}
          </p>
        )}
        <button className="button primary full" disabled={busy}>
          {busy ? "Creating your account…" : "Continue"}
        </button>
        <p className="auth-switch" style={{ marginBottom: "0.5rem" }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
        <p className="auth-switch">
          Want to teach? <Link to="/register-lecturer">Register as Lecturer</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export function RegisterLecturerPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next: Errors = {};
    if (!name.trim()) next.name = "Enter your full name.";
    if (!department.trim()) next.department = "Enter your department.";
    if (!validEmail(email.trim())) next.email = "Enter a valid email address.";
    if (password.length < 8) next.password = "Use at least 8 characters.";
    if (!confirm || confirm !== password) next.confirm = "Passwords must match.";
    
    setErrors(next);
    setMessage("");
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await authService.registerLecturer(name, email, password, department);
      setSuccess(true);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <AuthLayout register title="Request Submitted" subtitle="Your lecturer account request is awaiting approval." showTeacherNote={false}>
        <div style={{ textAlign: "center", margin: "2rem 0" }}>
          <p style={{ marginBottom: "2rem" }}>An administrator will review your request. You will be able to log in once it has been approved.</p>
          <button className="button primary full" onClick={() => navigate("/login")}>Back to Sign in</button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout register title="Register as Lecturer" subtitle="Submit a request to become a lecturer on QueryLab." showTeacherNote={false}>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <label className="field" htmlFor="reg-name">
          Full Name
          <input id="reg-name" type="text" placeholder="Nguyen Van A" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
          {errors.name && <small className="field-error">{errors.name}</small>}
        </label>
        
        <label className="field" htmlFor="reg-department">
          Department / Faculty
          <input id="reg-department" type="text" placeholder="Computer Science" value={department} onChange={(e) => setDepartment(e.target.value)} aria-invalid={!!errors.department} />
          {errors.department && <small className="field-error">{errors.department}</small>}
        </label>
        
        <label className="field" htmlFor="reg-email">
          Email
          <input id="reg-email" type="email" autoComplete="email" placeholder="name@example.edu.vn" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
          {errors.email && <small className="field-error">{errors.email}</small>}
        </label>
        
        <PasswordField id="reg-password" label="Password" value={password} onChange={setPassword} error={errors.password} autoComplete="new-password" placeholder="Create a password" />
        <p className="password-requirements">At least 8 characters.</p>
        
        <PasswordField id="reg-confirm" label="Confirm password" value={confirm} onChange={setConfirm} error={errors.confirm} autoComplete="new-password" placeholder="Re-enter your password" />
        
        {message && <p role="alert" className="form-message">{message}</p>}
        
        <button className="button primary full" disabled={busy}>{busy ? "Submitting…" : "Submit Request"}</button>
        <p className="auth-switch" style={{ marginBottom: "0.5rem" }}>Already have an account? <Link to="/login">Sign in</Link></p>
        <p className="auth-switch">Are you a student? <Link to="/register">Register as Student</Link></p>
      </form>
    </AuthLayout>
  );
}
