import { TranslatedText } from "../../components/TranslatedText";
import { LanguageSwitch } from "../../components/LanguageSwitch";
import { useLanguage } from "../../context/LanguageContext";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authService, validEmail } from "../../services/authService";
import { APP_NAME } from "../../data/models";
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
  const { t: tr } = useLanguage("auth");
  const [visible, setVisible] = useState(false);
  return (
    <label className="field" htmlFor={id}>
      <TranslatedText>{tr(label)}</TranslatedText>
      <span className="password-input">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          placeholder={tr(placeholder)}
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
          <TranslatedText>{visible ? tr("Hide") : tr("Show")}</TranslatedText>
        </button>
      </span>
      {error && (
        <small id={id + "-error"} className="field-error">
          <TranslatedText>{tr(error)}</TranslatedText>
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
  compact = false,
  children,
}: {
  register?: boolean;
  title?: string;
  subtitle?: string;
  showTeacherNote?: boolean;
  centered?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  const { t: tr } = useLanguage("auth");
  return (
    <main
      id="main-content"
      className={`auth-page${centered ? " auth-page--centered" : " auth-page--split"}${compact ? " auth-page--compact" : ""}${register ? " auth-page--register" : ""}`}
    >
      {!centered && (
      <section className="auth-brand-panel" aria-label={tr("{value0} introduction", { value0: APP_NAME })}>
        <div className="auth-wordmark"><img src="/favicon.svg" width="32" height="32" alt="" /><b>{APP_NAME}</b></div>
        <div className="auth-pitch">
          <div className="auth-pitch-copy"><span className="auth-eyebrow"><TranslatedText>{tr("SQL PRACTICE AT UIT")}</TranslatedText></span><h2><TranslatedText>{tr("Write queries.")}</TranslatedText><br /><span><TranslatedText>{tr("Understand data.")}</TranslatedText></span></h2><p><TranslatedText>{tr("Practice on real schemas, see the result of every query, and build your SQL skills one problem at a time.")}</TranslatedText></p></div>
          <div className="editor-preview" aria-label={tr("SQL editor preview")}>
            <div className="preview-bar"><b>join-orders.sql</b><span><TranslatedText>{tr("Run")}</TranslatedText></span></div>
            <pre><code><i>1</i>  <em>-- Orders per customer</em>{"\n"}<i>2</i>  <strong>SELECT</strong> c.name, COUNT(o.id) <strong>AS</strong> orders{"\n"}<i>3</i>  <strong>FROM</strong> customers c{"\n"}<i>4</i>  <strong>LEFT JOIN</strong> orders o <strong>ON</strong> o.customer_id = c.id{"\n"}<i>5</i>  <strong>GROUP BY</strong> c.name{"\n"}<i>6</i>  <strong>ORDER BY</strong> orders <strong>DESC</strong>;</code></pre>
            <div className="preview-result">
              <table aria-label={tr("Sample query result")}>
                <thead><tr><th scope="col">name</th><th scope="col">orders</th></tr></thead>
                <tbody>
                  <tr><td>Nguyen An</td><td>4</td></tr>
                  <tr><td>Tran Binh</td><td>3</td></tr>
                  <tr><td>Le Chi</td><td>0</td></tr>
                </tbody>
              </table>
              <b><TranslatedText>{tr("Accepted · 3 rows · 12 ms")}</TranslatedText></b>
            </div>
          </div>
        </div>
        <small>{APP_NAME} · <TranslatedText>{tr("Write queries. Understand data.")}</TranslatedText></small>
      </section>
      )}
      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <div className="u267-auth-language"><LanguageSwitch /></div>
          <div className="auth-heading">
            <span className="auth-form-eyebrow">{APP_NAME} <TranslatedText>{tr("ACCOUNT")}</TranslatedText></span>
            <h1><TranslatedText>{title ?? (register ? tr("Create your account") : tr("Welcome back"))}</TranslatedText></h1>
            <p>
              <TranslatedText>{tr(subtitle) ?? (register ? tr("Register with your student email to start practicing SQL.") : tr("Sign in to continue practicing SQL."))}</TranslatedText>
            </p>
          </div>
          {children}
          {showTeacherNote && (
            <p className="auth-note">
              <TranslatedText>{tr("Teacher accounts are created by an administrator.")}</TranslatedText>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
export function LoginPage() {
  const { t: tr } = useLanguage("auth");
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
    <AuthLayout showTeacherNote={false} compact>
      <form onSubmit={submit} noValidate>
        <label className="field" htmlFor="login-email">
          <TranslatedText>{tr("Email or account")}</TranslatedText>
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
          label={tr("Password")}
          value={password}
          onChange={setPassword}
          error={errors.password}
          autoComplete="current-password"
          placeholder={tr("Enter your password")}
        />
        <button
          className="forgot-link"
          type="button"
          onClick={() => navigate("/forgot-password", { state: { email } })}
        >
          <TranslatedText>{tr("Forgot password?")}</TranslatedText>
        </button>
        {message && (
          <p role="alert" className="form-message">
            <TranslatedText>{tr(message)}</TranslatedText>
          </p>
        )}
        <button className="button primary full" disabled={busy}>
          <TranslatedText>{busy ? tr("Signing in…") : tr("Sign in")}</TranslatedText>
        </button>
        <p className="auth-switch">
          <TranslatedText>{tr("New student?")}</TranslatedText> <Link to="/register"><TranslatedText>{tr("Create an account")}</TranslatedText></Link>
          <br />
          <TranslatedText>{tr("Want to teach?")}</TranslatedText> <Link to="/register-lecturer"><TranslatedText>{tr("Register as Lecturer")}</TranslatedText></Link>
        </p>
      </form>
    </AuthLayout>
  );
}

function RecoveryUnavailable() {
  const { t: tr } = useLanguage("auth");
  return (
    <p className="form-message" role="status">
      <TranslatedText>{tr("Password recovery is not connected yet. Ask an administrator to reset your account password.")}</TranslatedText>
    </p>
  );
}

export function ForgotPasswordPage() {
  const { t: tr } = useLanguage("auth");
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
      title={tr("Forgot your password?")}
      compact
      subtitle="Enter your email and we’ll send you a verification code."
      showTeacherNote={false}
    >
      <form onSubmit={submit} noValidate>
        <label className="field" htmlFor="recovery-email"><TranslatedText>{tr("Email")}</TranslatedText><input
            id="recovery-email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={!!error}
          />
          {error && <small className="field-error"><TranslatedText>{tr(error)}</TranslatedText></small>}
        </label>
        {unavailable && <RecoveryUnavailable />}
        <button className="button primary full" type="submit">
          <TranslatedText>{tr("Send code")}</TranslatedText>
        </button>
      </form>
      <p className="auth-switch"><Link to="/login"><TranslatedText>{tr("← Back to sign in")}</TranslatedText></Link></p>
    </AuthLayout>
  );
}

export function VerifyOtpPage() {
  const { t: tr } = useLanguage("auth");
  const location = useLocation();
  const email =
    (location.state as { email?: string } | null)?.email ?? "name@example.com";
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const cells = useRef<Array<HTMLInputElement | null>>([]);
  const [unavailable, setUnavailable] = useState(false);
  return (
    <AuthLayout
      title={tr("Verify your email")}
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
          <legend className="sr-only"><TranslatedText>{tr("Verification code")}</TranslatedText></legend>
          <div className="otp-cells">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(node) => { cells.current[index] = node; }}
                aria-label={tr("Verification code digit {value0} of 6", { value0: index + 1 })}
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
        <p className="tiny muted"><TranslatedText>{tr("Resend code in 42s")}</TranslatedText></p>
        {unavailable && <RecoveryUnavailable />}
        <button className="button primary full" type="submit">
          <TranslatedText>{tr("Verify")}</TranslatedText>
        </button>
      </form>
      <p className="auth-switch"><Link to="/forgot-password" state={{ email }}><TranslatedText>{tr("← Back")}</TranslatedText></Link></p>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const { t: tr } = useLanguage("auth");
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
      title={tr("Set a new password")}
      subtitle="Choose a new password for your account."
      showTeacherNote={false}
    >
      <form onSubmit={submit} noValidate>
        <PasswordField
          id="new-password"
          label={tr("New password")}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder={tr("Enter a new password")}
        />
        <p className="password-requirements"><TranslatedText>{tr("At least 8 characters.")}</TranslatedText></p>
        <PasswordField
          id="confirm-new-password"
          label={tr("Confirm password")}
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          placeholder={tr("Re-enter the new password")}
        />
        {error && (
          <p className="field-error" role="alert">
            <TranslatedText>{tr(error)}</TranslatedText>
          </p>
        )}
        {unavailable && <RecoveryUnavailable />}
        <button className="button primary full" type="submit">
          <TranslatedText>{tr("Update password")}</TranslatedText>
        </button>
      </form>
      <p className="auth-switch"><Link to="/login"><TranslatedText>{tr("← Back to sign in")}</TranslatedText></Link></p>
    </AuthLayout>
  );
}
export function RegisterPage() {
  const { t: tr } = useLanguage("auth");
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
    <AuthLayout register showTeacherNote={false}>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <label className="field" htmlFor="register-name">
          <TranslatedText>{tr("Full name")}</TranslatedText>
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
        <label className="field" htmlFor="register-email"><TranslatedText>{tr("Email")}</TranslatedText><input
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
          label={tr("Password")}
          value={password}
          onChange={setPassword}
          error={errors.password}
          autoComplete="new-password"
          placeholder={tr("Create a password")}
        />
        <p className="password-requirements"><TranslatedText>{tr("At least 8 characters.")}</TranslatedText></p>
        <PasswordField
          id="register-confirm"
          label={tr("Confirm password")}
          value={confirm}
          onChange={setConfirm}
          error={errors.confirm}
          autoComplete="new-password"
          placeholder={tr("Re-enter your password")}
        />
        {message && (
          <p role="alert" className="form-message">
            <TranslatedText>{tr(message)}</TranslatedText>
          </p>
        )}
        <button className="button primary full" disabled={busy}>
          <TranslatedText>{busy ? tr("Creating your account…") : tr("Continue")}</TranslatedText>
        </button>
        <p className="auth-switch" style={{ marginBottom: "0.5rem" }}>
          <TranslatedText>{tr("Already have an account?")}</TranslatedText> <Link to="/login"><TranslatedText>{tr("Sign in")}</TranslatedText></Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export function RegisterLecturerPage() {
  const { t: tr } = useLanguage("auth");
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
      <AuthLayout register title={tr("Request Submitted")} subtitle="Your lecturer account request is awaiting approval." showTeacherNote={false}>
        <div style={{ textAlign: "center", margin: "2rem 0" }}>
          <p style={{ marginBottom: "2rem" }}><TranslatedText>{tr("An administrator will review your request. You will be able to log in once it has been approved.")}</TranslatedText></p>
          <button className="button primary full" onClick={() => navigate("/login")}><TranslatedText>{tr("Back to Sign in")}</TranslatedText></button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout register title={tr("Register as Lecturer")} subtitle={`Submit a request to become a lecturer on ${APP_NAME}.`} showTeacherNote={false}>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <label className="field" htmlFor="reg-name">
          <TranslatedText>{tr("Full Name")}</TranslatedText>
          <input id="reg-name" type="text" placeholder="Nguyen Van A" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
          {errors.name && <small className="field-error">{errors.name}</small>}
        </label>
        
        <label className="field" htmlFor="reg-department">
          <TranslatedText>{tr("Department / Faculty")}</TranslatedText>
          <input id="reg-department" type="text" placeholder={tr("Computer Science")} value={department} onChange={(e) => setDepartment(e.target.value)} aria-invalid={!!errors.department} />
          {errors.department && <small className="field-error">{errors.department}</small>}
        </label>
        
        <label className="field" htmlFor="reg-email"><TranslatedText>{tr("Email")}</TranslatedText><input id="reg-email" type="email" autoComplete="email" placeholder="name@example.edu.vn" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
          {errors.email && <small className="field-error">{errors.email}</small>}
        </label>
        
        <PasswordField id="reg-password" label={tr("Password")} value={password} onChange={setPassword} error={errors.password} autoComplete="new-password" placeholder={tr("Create a password")} />
        <p className="password-requirements"><TranslatedText>{tr("At least 8 characters.")}</TranslatedText></p>
        
        <PasswordField id="reg-confirm" label={tr("Confirm password")} value={confirm} onChange={setConfirm} error={errors.confirm} autoComplete="new-password" placeholder={tr("Re-enter your password")} />
        
        {message && <p role="alert" className="form-message"><TranslatedText>{tr(message)}</TranslatedText></p>}
        
        <button className="button primary full" disabled={busy}><TranslatedText>{busy ? tr("Submitting…") : tr("Submit Request")}</TranslatedText></button>
        <p className="auth-switch" style={{ marginBottom: "0.5rem" }}><TranslatedText>{tr("Already have an account?")}</TranslatedText> <Link to="/login"><TranslatedText>{tr("Sign in")}</TranslatedText></Link></p>
      </form>
    </AuthLayout>
  );
}
