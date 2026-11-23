import Select from "./ui/Select";
import CoveredLives, {
  LifeCoverList,
  completeLives,
  livesBody,
  otherLives,
  useLifeQuote,
} from "./CoveredLives";
import React, { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Building2,
  Cable,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Circle,
  CircleCheck,
  ClipboardList,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  FileSearch,
  FileText,
  Heart,
  HeartHandshake,
  HeartPulse,
  Handshake,
  Headset,
  Info,
  Landmark,
  Layers3,
  LayoutDashboard,
  Lightbulb,
  LogIn,
  LogOut,
  Mail,
  Menu,
  MessageSquareText,
  PieChart,
  Plus,
  RotateCcw,
  ScanText,
  Search,
  SearchX,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  ShieldPlus,
  SlidersHorizontal,
  Sparkles,
  Table2,
  TrendingUp,
  Upload,
  UserPlus,
  UserRoundCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
const Icons = {
  Cable,
  Handshake,
  Headset,
  Landmark,
  Mail,
  PieChart,
  ShieldPlus,
  SlidersHorizontal,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Circle,
  CircleCheck,
  ClipboardList,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  FileSearch,
  FileText,
  Heart,
  HeartHandshake,
  HeartPulse,
  Info,
  Layers3,
  LayoutDashboard,
  Lightbulb,
  LogIn,
  LogOut,
  Menu,
  MessageSquareText,
  Plus,
  RotateCcw,
  ScanText,
  Search,
  SearchX,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Table2,
  TrendingUp,
  Upload,
  UserPlus,
  UserRoundCheck,
  Users,
  Wallet,
  X,
};
import { money, initials } from "./data";
import ProductConfig from "./ProductConfig";
import RateTables from "./RateTables";
import { closeSession, fetchFile, openSession, request, setUnauthorizedHandler, uploadFile, verifySignInCode } from "./api";
import AccessAdmin from "./AccessAdmin";
import Controls from "./Controls";
import { PAGE_ACCESS, canDo, canOpen, isWorkspacePage, landingPage } from "./access";
import "./access.css";
import GroupAdmin from "./GroupAdmin";
import Finance, { InstalmentLedger } from "./Finance";
import Distribution from "./Distribution";
import Reinsurance from "./Reinsurance";
import Underwriting from "./Underwriting";
import PolicyServicing from "./PolicyServicing";
import CreditLife from "./CreditLife";
import CareCash from "./CareCash";
import GroupLife from "./GroupLife";
import PlatformServices from "./PlatformServices";
import PartnerPortal from "./PartnerPortal";
import Operations, { ClaimPayouts } from "./Operations";
import Communications from "./Communications";
import ServiceDesk from "./ServiceDesk";
import IntegrationMonitor from "./IntegrationMonitor";
import ManagementReports from "./ManagementReports";
import { can, DataTable, Tabs, ThemeSwitch, when } from "./ui/workspace";
import PaymentTransactions from "./PaymentTransactions";
import { EvidenceQueue, QuoteComparison } from "./NewBusiness";
import "./new-business.css";
import { CustomFieldInputs, PolicyAttributesPanel, cleanValues, usePolicyForm } from "./configuration/PolicyFields";
import ConfigReleases from "./ConfigReleases";
import { PayoutExceptionQueue } from "./PayoutInstructions";
import { environmentLabel, useInsurer } from "./insurer";
import { Dialog, Drawer } from "./ui/overlay";
import { CustomerView360, DuplicateReview, PartyContacts, PartyKyc, PartyRelationships } from "./PartyMaster";
import { useToast } from "./ui/toast";
import CustomerPortal from "./CustomerPortal";
import {
  CLAIM_STATES,
  NEEDS_AUDIT,
  ClaimLodgeForm,
  ClaimWorkflowPanel,
  GRACE,
  IN_COVER_STATES,
  NO_COVER,
  SETTLED_CLAIM,
  POLICY_STATES,
  PolicyWorkflowPanel,
  ApplicationChecklist,
  QuotePanel,
  policyTone,
  ReasonAction,
  WorkflowTimeline,
  ClaimDocuments,
  PolicyDocuments,
} from "./Workflow";
import LandingPage from "./LandingPage";
import {
  AnimatedWorkspace,
  AnimatedMetric,
  ShimmerText,
  IntelligenceOrb,
  BorderBeam,
  ActionSearch,
} from "./ui/animated";


// The sidebar, grouped by area. An item is [page, label, icon]; which pages a user sees comes from the access map
// (src/access.js), the same one the router and the ⌘K palette use. A group opens to show its items, and a group
// with a page (Customers) also goes there when clicked, if the user may open it. Items the user cannot open are
// hidden, and so is a group left empty.
const navGroups = [
  { key: "partner-portal", item: ["partner-portal", "My portal", "Handshake"] },
  { key: "overview", item: ["overview", "Overview", "LayoutDashboard"] },
  { key: "work-queue", item: ["work-queue", "Work queue", "ClipboardList"] },
  {
    key: "customer-care",
    label: "Customers",
    icon: "Users",
    page: "customers",
    items: [
      ["customers", "All customers", "Users"],
      ["applications", "Applications", "FilePlus2"],
      ["underwriting", "Underwriting", "FileSearch"],
      ["policies", "Policies", "ShieldCheck"],
      ["servicing", "Policy servicing", "ClipboardList"],
      ["credit-life", "Credit life", "Landmark"],
      ["claims", "Claims", "HeartHandshake"],
      ["care-cash", "Hospital cash", "HeartPulse"],
      ["collections", "Collections", "Wallet"],
      ["service-desk", "Service desk", "Headset"],
      ["communications", "Communications", "Mail"],
    ],
  },
  { key: "group-business", label: "Group business", icon: "Building2", items: [["schemes", "Group schemes", "Building2"], ["scheme-lifecycle", "Scheme lifecycle", "ClipboardList"]] },
  {
    key: "products",
    label: "Products & pricing",
    icon: "Layers3",
    items: [
      ["products", "Products", "Layers3"],
      ["product-config", "Product studio", "Settings2"],
      ["rate-tables", "Rate tables", "Table2"],
      ["configuration", "Configuration", "Settings2"],
    ],
  },
  {
    key: "finance-partners",
    label: "Finance & partners",
    icon: "Landmark",
    items: [
      ["finance", "Finance", "Landmark"],
      ["distribution", "Distribution", "Handshake"],
      ["reinsurance", "Reinsurance", "ShieldPlus"],
    ],
  },
  {
    key: "insights",
    label: "Insights & operations",
    icon: "PieChart",
    items: [
      ["reports", "Management", "PieChart"],
      ["integration", "Integration", "Cable"],
      ["data-assistants", "Data & assistants", "Sparkles"],
    ],
  },
  {
    key: "administration",
    label: "Administration",
    icon: "ShieldCheck",
    items: [
      ["access", "Access", "ShieldCheck"],
      ["controls", "Controls", "SlidersHorizontal"],
    ],
  },
];
const NAV_OPEN_KEY = "nsure-nav-open";
function Icon({ name, small = false, ...props }) {
  const C = Icons[name] || Icons.Circle;
  return (
    <C
      className={small ? "icon icon-sm" : "icon"}
      strokeWidth={1.8}
      aria-hidden="true"
      {...props}
    />
  );
}
function Badge({ children }) {
  const s = String(children).toLowerCase();
  // Policy states first (spec 10 §1.3): "Active - No Cover" is a warning although it says active; "Claimed" ended
  // the policy by paying out, so it is neither good news nor a failure.
  const color = policyTone(children)
    ? policyTone(children)
    : /force|verified|ready|settled|approved|active|paid|issued/.test(
    s,
  )
    ? "green"
    : /pending|evidence|grace|review|assessment|recommended|initiated/.test(s)
      ? "amber"
      : /lapsed|failed|rejected|declined|expired|cancelled/.test(s)
        ? "red"
        : /draft/.test(s)
          ? "gray"
          : "blue";
  return (
    <span className={"badge " + color}>
      <span className="status-dot" />
      {children}
    </span>
  );
}
function Person({ name, sub }) {
  return (
    <div className="person-cell">
      <span className="avatar">{initials(name)}</span>
      <div>
        <div className="person-name">{name}</div>
        <div className="person-sub">{sub}</div>
      </div>
    </div>
  );
}
function Button({ children, icon, onClick, variant = "primary", ...props }) {
  return (
    <button className={"btn " + variant} onClick={onClick} {...props}>
      {icon && <Icon name={icon} small />}
      {children}
    </button>
  );
}
function Heading({ title, subtitle, children }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">YOUR CONNECTED WORKSPACE</div>
        <h1>{title}</h1>
        <p className="subtitle">{subtitle}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
function Panel({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={"panel " + className}>
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="subtitle">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function Empty({
  text = "No matching records",
  detail = "Try a different search or filter.",
}) {
  return (
    <div className="empty-state">
      <Icon name="SearchX" />
      <h3>{text}</h3>
      <p>{detail}</p>
    </div>
  );
}
function downloadCSV(filename, rows) {
  const content = rows
    .map((row) =>
      row
        .map((value) => '"' + String(value ?? "").replaceAll('"', '""') + '"')
        .join(","),
    )
    .join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8;" }),
  );
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}
function Modal({ title, onClose, children, wide = false }) {
  return (
    <Dialog title={title} eyebrow="Nsure" onClose={onClose} size={wide ? "lg" : "md"}>
      {children}
    </Dialog>
  );
}
function Field({ label, children, full = false }) {
  const labelId = React.useId();
  return (
    <label className={"form-label " + (full ? "full" : "")}>
      <span id={labelId}>{label}</span>
      {["input", "select", "textarea"].includes(children.type) ||
      children.type === Select
        ? React.cloneElement(children, { "aria-labelledby": labelId })
        : children}
    </label>
  );
}
function Stat({
  label,
  value,
  change,
  icon,
  color = "green",
  note = "vs. last month",
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        <span className={"stat-icon " + color}>
          <Icon name={icon} />
        </span>
      </div>
      <div className="stat-value">
        <AnimatedMetric value={value} />
      </div>
      <div className="stat-trend" hidden={!change}>
        <span className="positive">
          <Icon name="TrendingUp" small />
          {change}
        </span>
        <span>{note}</span>
      </div>
    </div>
  );
}

function Login({ onLogin, initialAudience = "customer", onAudienceChange }) {
  const audience = initialAudience;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Staff and partner sign-in is two steps: the password, then a one-time code the server checks. `pending` holds
  // the server's challenge, never a session: the session token is issued only for the right code.
  const [pending, setPending] = useState(null);
  const [code, setCode] = useState("");
  const customerLogin = audience === "customer";
  const startAgain = () => {
    setPending(null);
    setCode("");
    setError("");
  };
  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand">
          <img
            className="brand-logo"
            src="/brand/nsure-life-logo-light.svg"
            alt="Nsure Life"
          />
        </div>
        <div className="login-story-content">
          <span className="demo-pill">
            {customerLogin ? "Customer sign-in" : "A little clarity. A lot of confidence."}
          </span>
          <h1>
            {customerLogin ? (
              <>
                Sign in, choose a product,
                <br />
                and <em>request your cover.</em>
              </>
            ) : (
              <>
                Behind every policy,
                <br />
                there’s a <em>person.</em>
              </>
            )}
          </h1>
          <p>
            {customerLogin
              ? "Use the username and password saved on your customer record."
              : "Bring your people, policies, and possibilities together in one thoughtful workspace."}
          </p>
          <img
            className="login-photo"
            src="/products/term-life.jpg"
            alt="A family together at home"
          />
          <div className="login-feature">
            <span className="avatar">AD</span>
            <span className="avatar">TM</span>
            <span className="avatar">NK</span>
            <div>
              One workspace.
              <br />
              <strong>Every step of the insurance journey.</strong>
            </div>
          </div>
        </div>
        <p className="login-note">Nsure © 2026</p>
      </section>
      <section className="login-card">
        <div className="login-form">
          <a className="login-home-link" href="#/home">← Back to Nsure</a>
          <div className="login-switch" aria-label="Sign-in type">
            <button
              type="button"
              className={customerLogin ? "" : "active"}
              onClick={() => {
                onAudienceChange("admin");
                setEmail("");
                setPassword("");
                startAgain();
              }}
            >
              Admin
            </button>
            <button
              type="button"
              className={customerLogin ? "active" : ""}
              onClick={() => {
                onAudienceChange("customer");
                setEmail("");
                setPassword("");
                startAgain();
              }}
            >
              Customer
            </button>
          </div>
          <h2>{customerLogin ? "Customer sign-in" : "Admin sign-in"}</h2>
          <p className="subtitle">
            {customerLogin
              ? "Sign in with the username and password on your customer record. Then choose a product and send a request; our team reviews it before it becomes your policy."
              : "Sign in to the operations workspace."}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setBusy(true);
              try {
                if (pending) {
                  // The server checks the code; a wrong, expired or used code is refused there.
                  const next = await verifySignInCode(pending.challenge, code.trim());
                  sessionStorage.setItem("nsure-session", JSON.stringify(next));
                  onLogin(next);
                  return;
                }
                // The password is sent once; only the session token is kept (NS-SH11-001).
                const opened = await openSession(email.trim().toLowerCase(), password);
                if (opened.secondFactorRequired) {
                  // Only staff and partner accounts are asked for a code.
                  if (customerLogin) {
                    setError("This form is for customers. Use the username and password saved on the customer.");
                    return;
                  }
                  setCode("");
                  setPending(opened);
                  return;
                }
                const me = await request(opened, "/me");
                if (customerLogin && !me.data.customerPortal) {
                  closeSession(opened);
                  setError("This form is for customers. Use the username and password saved on the customer.");
                  return;
                }
                // Customer accounts sign in on the customer portal only, never the operations workspace.
                if (!customerLogin && me.data.customerPortal) {
                  closeSession(opened);
                  setError("This is a customer account. Choose Customer above to sign in to the customer portal.");
                  return;
                }
                sessionStorage.setItem("nsure-session", JSON.stringify(opened));
                onLogin(opened);
              } catch (err) {
                setError(!pending && err.status === 401 ? "Username or password is incorrect." : err.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Username">
              <input
                className="input"
                required
                value={email}
                readOnly={Boolean(pending)}
                placeholder="Your username"
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </Field>
            <Field label="Password">
              <div className="password-field">
                <input
                  className="input"
                  type={show ? "text" : "password"}
                  required
                  minLength={4}
                  value={password}
                  readOnly={Boolean(pending)}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                >
                  <Icon name={show ? "EyeOff" : "Eye"} />
                </button>
              </div>
            </Field>
            {error && <p className="form-error">{error}</p>}
            <div className="login-hint">
              <Icon name="Info" small />{" "}
              {customerLogin
                ? "Use the username and password set when the customer was added."
                : "Use your staff username and password, then the one-time code."}
            </div>
            {pending && (
              <Field label="One-time code">
                <input
                  className="input"
                  required
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  placeholder="6-digit code"
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  autoComplete="one-time-code"
                />
              </Field>
            )}
            {pending?.demoCode && (
              <div className="login-hint">
                <Icon name="Info" small />
                <span>
                  Demo installation: no SMS is sent. Use the code <strong>{pending.demoCode}</strong>.
                </span>
              </div>
            )}
            <Button type="submit" icon="ArrowRight" disabled={busy || (pending && code.length !== 6)}>
              {busy ? "Signing in…" : pending ? "Verify and enter" : customerLogin ? "Sign in" : "Enter workspace"}
            </Button>
          </form>
          {pending && (
            <div className="signup-otp-actions">
              <button type="button" className="link-button" disabled={busy} onClick={startAgain}>
                ← Start again with your password
              </button>
            </div>
          )}
          {customerLogin && (
            <p className="signup-link">
              New to Nsure? <a href="#/signup">Create an account</a>
            </p>
          )}
          {customerLogin && !pending && <PasswordRecovery />}
          <div className="notice">
            <Icon name="ShieldCheck" />
            <p>
              <strong>Your sign-in is protected.</strong>
              <br />
              Sign-in uses your Nsure account. Records are loaded from the database.
            </p>
          </div>
          <p className="login-note">Made for people who care for people.</p>
        </div>
      </section>
    </div>
  );
}

/**
 * NS-SH11-001 customer account recovery: a code goes to the mobile number registered on the account, then a new
 * password is set. The answer never says whether an account exists; staff ask their administrator.
 */
function PasswordRecovery() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [sent, setSent] = useState(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <p className="signup-link">
        <button type="button" className="link-button" onClick={() => setOpen(true)}>
          Forgot your password?
        </button>
      </p>
    );
  }
  const run = async (fn) => {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="login-form recovery-form"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          if (!sent) {
            const r = await request(null, "/public/password-reset/otp", { method: "POST", body: { username } });
            setSent(r.data);
          } else {
            await request(null, "/public/password-reset", {
              method: "POST",
              body: { challenge: sent.challenge, code, password },
            });
            setSent(null);
            setCode("");
            setPassword("");
            setMessage("Your password is changed. Sign in with the new one.");
          }
        });
      }}
    >
      <h3>Reset your password</h3>
      {!sent ? (
        <Field label="Username">
          <input className="input" required value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </Field>
      ) : (
        <>
          <p className="login-note">If the account exists, a code was sent to {sent.sentTo}.</p>
          {sent.demoCode && (
            <div className="login-hint">
              <Icon name="Info" small />
              <span>
                Demo installation: no SMS is sent. Use the code <strong>{sent.demoCode}</strong>.
              </span>
            </div>
          )}
          <Field label="Code">
            <input
              className="input"
              required
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              autoComplete="one-time-code"
            />
          </Field>
          <Field label="New password (at least 8 characters)">
            <input className="input" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </Field>
        </>
      )}
      {message && (
        <p className="login-note" role="status">
          {message}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Please wait…" : sent ? "Set the new password" : "Send a code"}
      </Button>
      <button type="button" className="link-button" onClick={() => setOpen(false)}>
        Back to sign-in
      </button>
    </form>
  );
}

export default function App() {
  const insurer = useInsurer();
  const [session, setSession] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("nsure-session") || "null");
      // A session saved before tokens held the password: drop it, so the password leaves browser storage.
      if (saved && !saved.token) {
        sessionStorage.removeItem("nsure-session");
        return null;
      }
      return saved;
    } catch {
      return null;
    }
  });
  const loggedIn = Boolean(session);
  const [page, setPage] = useState(() => location.hash.slice(2) || "overview");
  const [profile, setProfile] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Which sidebar group is open (one at a time); remembered per browser, Customers open the first time.
  const [navOpen, setNavOpen] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(NAV_OPEN_KEY) || "null") || { "customer-care": true };
    } catch {
      return { "customer-care": true };
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(NAV_OPEN_KEY, JSON.stringify(navOpen));
    } catch {
      // Storage can be blocked; the sidebar still works for this visit.
    }
  }, [navOpen]);
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [customers, setCustomers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [claims, setClaims] = useState([]);
  const [products, setProducts] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [productConfigs, setProductConfigs] = useState([]);
  const [receipts, setReceipts] = useState([]);
  // Collections page: premium receipts, or the payment transactions behind them (spec 13, READ_PAYMENT).
  const [collectionsTab, setCollectionsTab] = useState("receipts");
  // IL01 workspace: the application workbench, the missing-evidence queue and quote comparison.
  const [applicationsTab, setApplicationsTab] = useState("workbench");
  const [shop, setShop] = useState(null);
  const [notifications, setNotifications] = useState(true);
  const [compact, setCompact] = useState(false);
  const [period, setPeriod] = useState("Last 6 months");
  // Staff alerts from GET /me/alerts (only those whose permission the user holds), shown under the header bell.
  const [alerts, setAlerts] = useState([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const alertsRef = useRef(null);
  const notify = useToast();
  const go = (next) => {
    location.hash = "/" + next;
    setPage(next);
    setSearch("");
    setFilter("All");
    setMobileOpen(false);
    setModal(null);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const onHash = () => {
      setPage(location.hash.slice(2) || "overview");
      setSearch("");
      setFilter("All");
      setModal(null);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    const handler = (e) => {
      if (loggedIn && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setModal((current) =>
          current?.type === "command" ? null : { type: "command" },
        );
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [loggedIn]);
  const close = React.useCallback(() => setModal(null), []);
  const logout = () => {
    closeSession(session);
    sessionStorage.removeItem("nsure-session");
    setSession(null);
    setProfile(null);
    setShop(null);
    setModal(null);
    setAlerts([]);
    setAlertsOpen(false);
    go("home");
  };
  // A 401 on any call after sign-in (password changed, user disabled) signs out here, staff and customers alike.
  // The handler acts once: logout() clears the stored session, so later 401s from calls still in flight do nothing.
  useEffect(() => {
    if (!session) return undefined;
    return setUnauthorizedHandler(() => {
      if (!sessionStorage.getItem("nsure-session")) return;
      notify("Your sign-in is no longer valid. Please sign in again.", "info");
      logout();
    });
  }, [session]);
  useEffect(() => {
    if (!session) return undefined;
    let active = true;
    (async () => {
      try {
        const meR = await request(session, "/me");
        if (!active) return;
        setProfile(meR.data);
        if (meR.data.customerPortal) {
          try {
            const shopR = await request(session, "/portfolio/shop");
            if (!active) return;
            setShop(shopR.data);
          } catch (error) {
            if (!active) return;
            setShop({ error: error.message, products: [], policies: [] });
          }
          return;
        }
        const me = meR.data;
        const [
          customersR,
          applicationsR,
          policiesR,
          claimsR,
          productsR,
          schemesR,
          receiptsR,
          configsR,
        ] = await Promise.all(
          [
            ["/portfolio/customers", "READ_CUSTOMER"],
            ["/portfolio/applications", "READ_APPLICATION"],
            ["/portfolio/policies", "READ_POLICY"],
            ["/portfolio/claims", "READ_CLAIM"],
            ["/portfolio/products", null],
            ["/portfolio/schemes", "READ_POLICY"],
            ["/portfolio/receipts", "READ_PAYMENT"],
            ["/portfolio/product-configs", "READ_PRODUCT"],
          ].map(([path, code]) =>
            // Each list needs its own read permission (the code its endpoint checks); a role without it gets an
            // empty list and is not sent to ask.
            code && !can(me, code)
              ? Promise.resolve({ data: [] })
              : request(session, path).catch((error) => {
                  if (error.status === 403) return { data: [] };
                  throw error;
                }),
          ),
        );
        if (!active) return;
        setCustomers(customersR.data);
        setApplications(applicationsR.data);
        setPolicies(policiesR.data);
        setClaims(claimsR.data);
        setProducts(productsR.data);
        setSchemes(schemesR.data);
        setReceipts(receiptsR.data);
        setProductConfigs(configsR.data);
      } catch (error) {
        if (!active) return;
        if (error.status === 401) logout();
        else notify(error.message, "error");
      }
    })();
    return () => {
      active = false;
    };
  }, [session]);
  // The sidebar shows the pages the access map lets this user open.
  const allowed = (item) => canOpen(profile, item[0]);
  const visibleGroups = navGroups
    .map((g) => (g.items ? { ...g, items: g.items.filter(allowed) } : g))
    .filter((g) => (g.item ? allowed(g.item) : g.items.length > 0));
  const menuItems = visibleGroups.flatMap((g) => (g.item ? [g.item] : g.items));
  // The page to show. Overview is the home page: a user without READ_DASHBOARD, or on an address that is no
  // workspace page, lands on the first page they can open. Any other page they cannot open shows "no access".
  const landing = landingPage(profile);
  const view =
    profile && (!isWorkspacePage(page) || (page === "overview" && !canOpen(profile, "overview"))) ? landing : page;
  useEffect(() => {
    if (profile && !profile.customerPortal && view !== page) {
      history.replaceState(null, "", "#/" + view);
      setPage(view);
    }
  }, [profile, view, page]);
  // The core registers are loaded once at sign-in. Work done on another screen (an underwriting decision, a
  // servicing change, a credit claim) changes them, so they are read again each time one of their pages opens.
  useEffect(() => {
    if (!profile || profile.customerPortal) return undefined;
    if (!["overview", "customers", "applications", "policies", "claims", "collections", "schemes"].includes(view)) return undefined;
    let active = true;
    [
      ["/portfolio/customers", "READ_CUSTOMER", setCustomers],
      ["/portfolio/applications", "READ_APPLICATION", setApplications],
      ["/portfolio/policies", "READ_POLICY", setPolicies],
      ["/portfolio/claims", "READ_CLAIM", setClaims],
      ["/portfolio/schemes", "READ_POLICY", setSchemes],
      ["/portfolio/receipts", "READ_PAYMENT", setReceipts],
    ].forEach(([path, code, set]) => {
      if (!can(profile, code)) return;
      request(session, path)
        .then((r) => active && set(r.data))
        .catch(() => {});
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  const groupOf = (key) => visibleGroups.find((g) => g.items?.some((item) => item[0] === key))?.key;
  const activeGroup = groupOf(view);
  // Opening a page (from search, a link or the address bar) also opens its group, so the highlight is visible.
  useEffect(() => {
    if (activeGroup) setNavOpen((open) => (open[activeGroup] ? open : { [activeGroup]: true }));
  }, [activeGroup]);
  const activeName =
    menuItems.find((n) => n[0] === view)?.[1] ||
    (view === "settings" ? "Settings" : view === "overview" ? "Overview" : "No access");
  // Staff alerts: loaded with the profile and every minute after, and again when the bell opens.
  const loadAlerts = React.useCallback(() => {
    if (!session) return;
    request(session, "/me/alerts")
      .then((r) => setAlerts(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, [session]);
  useEffect(() => {
    if (!profile || profile.customerPortal) return undefined;
    loadAlerts();
    const timer = setInterval(loadAlerts, 60000);
    return () => clearInterval(timer);
  }, [profile, loadAlerts]);
  useEffect(() => {
    if (!alertsOpen) return undefined;
    const onDown = (e) => {
      if (alertsRef.current && !alertsRef.current.contains(e.target)) setAlertsOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setAlertsOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [alertsOpen]);
  const visible = (rows) =>
    rows.filter(
      (r) =>
        (filter === "All" || r.status === filter || (filter === NEEDS_AUDIT && r.auditFlag)) &&
        Object.values(r).join(" ").toLowerCase().includes(search.toLowerCase()),
    );
  const detail = (type, record) =>
    setModal({ type: "detail", entity: type, record });
  const exportRows = (name, rows) => {
    const withTier = name === "policies";
    downloadCSV(name + ".csv", [
      ["Reference", "Name", "Product", ...(withTier ? ["Tier"] : []), "Amount", "Status"],
      ...rows.map((r) => [
        r.id, r.name, r.product, ...(withTier ? [r.tier || ""] : []), r.amount || "", r.status,
      ]),
    ]);
    notify("Your export is ready.");
  };
  // KYC or EDD outcome: VERIFIED, or FAILED with a reason the customer sees. Returns the updated customer, or null.
  const reviewCustomer = async (review, customer, decision, reason) => {
    try {
      const updated = await request(session, "/portfolio/customers/" + customer.id + "/" + review, {
        method: "POST",
        body: { decision, reason },
        // The record as this screen showed it: a decision on a customer changed meanwhile is refused (NS-TXN-001).
        version: customer.version,
      });
      setCustomers((rows) => rows.map((row) => (row.id === customer.id ? updated.data : row)));
      notify(
        customer.name + " " + review.toUpperCase() +
          (decision === "VERIFIED" ? " review is verified." : " review is rejected."),
      );
      return updated.data;
    } catch (error) {
      notify(error.message, "error");
      return null;
    }
  };
  const reviewEdd = (customer, decision, reason) => reviewCustomer("edd", customer, decision, reason);
  const reviewKyc = (customer, decision, reason) => reviewCustomer("kyc", customer, decision, reason);
  // A workflow action returned the record's new state: keep the list and the open detail in step.
  const policyUpdated = (record) => {
    setPolicies((rows) => rows.map((row) => (row.id === record.id ? record : row)));
    setModal({ type: "detail", entity: "policy", record });
    if (record.status === "Active") {
      if (can(profile, "READ_CUSTOMER")) {
        request(session, "/portfolio/customers").then((r) => setCustomers(r.data)).catch(() => {});
      }
      if (can(profile, "READ_PAYMENT")) {
        request(session, "/portfolio/receipts").then((r) => setReceipts(r.data)).catch(() => {});
      }
    }
  };
  // An application changed on its checklist (evidence, submission): keep it an application, and read it again so its
  // status, premium and row version (If-Match on issue) are the server's.
  const applicationUpdated = (record) => {
    setApplications((rows) => rows.map((row) => (row.id === record.id ? { ...row, ...record } : row)));
    setModal((current) =>
      current?.type === "detail" && current.record?.id === record.id
        ? { ...current, entity: "application", record: { ...current.record, ...record } }
        : current,
    );
    request(session, "/portfolio/applications")
      .then((r) => {
        setApplications(r.data);
        const fresh = r.data.find((row) => row.id === record.id);
        if (fresh) {
          setModal((current) =>
            current?.type === "detail" && current.record?.id === record.id ? { ...current, record: fresh } : current,
          );
        }
      })
      .catch(() => {});
  };
  const claimUpdated = (record) => {
    setClaims((rows) => rows.map((row) => (row.id === record.id ? record : row)));
    setModal({ type: "detail", entity: "claim", record });
  };
  const pendingPolicies = policies.filter((p) => p.status === "Pending Payment");
  // extra: the insurer-configured policy fields collected on the application ({formVersionId, customAttributes}).
  const issue = async (record, extra = {}) => {
    let created;
    try {
      // NS-IL01-006: the server takes the customer from the application, marks it Issued in the same step and
      // refuses a second issue; the fixed key makes a double click return the same offer.
      created = await request(session, "/portfolio/policies", {
        method: "POST",
        idempotencyKey: "issue-" + record.id,
        version: record.version,
        body: {
          applicationRef: record.id,
          product: record.product,
          tier: record.tier || undefined,
          amount: record.amount,
          premium: record.premium || 0,
          // The application's other lives carry over and are re-priced at issue (R-18).
          ...(record.lives?.length ? { lives: otherLives(record) } : {}),
          ...extra,
        },
      });
    } catch (error) {
      // The backend refuses a policy until the customer's KYC is verified; say so instead of failing silently.
      notify(error.message, "error");
      return;
    }
    setPolicies((p) => [created.data, ...p.filter((x) => x.id !== created.data.id)]);
    setApplications((a) =>
      a.map((x) => (x.id === record.id ? { ...x, status: "Issued" } : x)),
    );
    setModal({ type: "detail", entity: "policy", record: created.data });
    notify("Offer " + created.data.id + " created. Record the first premium to start cover.");
  };
  if (!loggedIn) {
    const publicPages = ["overview", "home", "cover", "how-it-works", "questions"];
    if (publicPages.includes(page)) return <LandingPage section={page} />;
    if (page === "signup") {
      return <CustomerSignup onLogin={(next) => { setSession(next); go("overview"); }} />;
    }
    // A customer back from the payment provider whose sign-in did not survive lands on a /buy/ result route: sign
    // in as a customer, then show that result.
    const paymentReturn = page.startsWith("buy/");
    return <Login
      key={page}
      initialAudience={page === "login/customer" || paymentReturn ? "customer" : "staff"}
      onAudienceChange={(audience) => go("login/" + audience)}
      onLogin={(next) => { setSession(next); go(paymentReturn ? page : "overview"); }}
    />;
  }
  if (!profile) {
    return (
      <div className="login-page">
        <p className="login-note">Loading your workspace…</p>
      </div>
    );
  }
  if (profile.customerPortal) {
    return (
      <CustomerPortal
        session={session}
        shop={shop}
        notify={notify}
        onLogout={logout}
        onShop={setShop}
        route={page}
        onNavigate={go}
      />
    );
  }

  function Filters({
    statuses = ["All"],
    placeholder = "Search by name or reference…",
    count,
  }) {
    return (
      <div className="filters">
        <div className="filter-tabs">
          {statuses.map((s) => (
            <button
              key={s}
              className={"filter-tab " + (filter === s ? "active" : "")}
              onClick={() => setFilter(s)}
            >
              {s}
              {s === "All" && count !== undefined && <span>{count}</span>}
            </button>
          ))}
        </div>
        <label className="search-box">
          <Icon name="Search" small />
          <input
            aria-label="Search records"
            placeholder={placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
    );
  }
  // Called as a function, not <RecordsTable/>: it is declared inside App, so a JSX
  // element would remount on every App render and drop the table's sort and page.
  function RecordsTable({ rows, type = "application", short = false, total }) {
    const columns = [
      {
        key: "name",
        label: type === "claim" ? "Claimant" : "Customer",
        render: (r) => <Person name={r.name} sub={r.id} />,
      },
      { key: "product", label: "Product" },
      type === "policy" && {
        key: "tier",
        label: "Tier",
        render: (r) =>
          r.tier ? (
            <span className={"tier-pill " + r.tier.toLowerCase()}>{r.tier}</span>
          ) : (
            <span className="muted">-</span>
          ),
      },
      !short && {
        key: "amount",
        label: type === "collection" ? "Amount due" : "Cover / benefit",
        className: "amount",
        render: (r) => money(r.amount),
      },
      { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
      !short && {
        key: "date",
        label: type === "policy" ? "Inception" : "Created",
        className: "muted",
        sortValue: (r) => Date.parse(r.date) || r.date,
      },
      {
        key: "act",
        label: "",
        render: (r) => (
          <button className="icon-btn" aria-label={"View " + r.id} onClick={() => detail(type, r)}>
            <Icon name="ArrowUpRight" small />
          </button>
        ),
      },
    ].filter(Boolean);
    return (
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={(r) => detail(type, r)}
        pageSize={short ? 0 : 10}
        searchFrom={Infinity}
        total={short ? undefined : total}
        empty="No matching records"
        emptyDetail={short ? undefined : "Try another status or clear the search."}
      />
    );
  }
  function Overview() {
    const heights =
      period === "Last 6 months"
        ? [43, 59, 51, 76, 67, 89]
        : [32, 49, 61, 56, 81, 94];
    const productMix = portfolioMix(policies);
    // Each shortcut opens a form whose save needs its own write permission; one the user lacks is not offered.
    const shortcuts = [
      ["New application", "Start a new chapter", "FilePlus2", "application", "green", "newApplication"],
      ["Register a claim", "Be there when it matters", "HeartHandshake", "claim", "purple", "newClaim"],
      ["Add a customer", "Welcome someone new", "UserPlus", "customer", "blue", "newCustomer"],
    ].filter((shortcut) => canDo(profile, shortcut[5]));
    return (
      <>
        <Heading
          title="A good day to make a difference. 👋"
          subtitle="Here’s what’s happening across your business today."
        >
          <span className="date-chip">
            <Icon name="CalendarDays" small /> {todayLabel(insurer?.timezone)}
          </span>
          {canDo(profile, "newApplication") && (
            <Button icon="Plus" onClick={() => setModal({ type: "application" })}>
              New application
            </Button>
          )}
        </Heading>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <Icon name="Sparkles" small /> NSURE INTELLIGENCE
            </span>
            <h2>
              A little intelligence.
              <br />
              <ShimmerText>A world of possibility.</ShimmerText>
            </h2>
            <p>
              Your team is looking after <strong>{customers.length} customers</strong> and{" "}
              <strong>{policies.length} policies</strong>.
              <br />
              Let’s keep the good work going.
            </p>
            {canOpen(profile, "policies") && (
              <Button
                variant="secondary"
                icon="ArrowRight"
                onClick={() => go("policies")}
              >
                Explore your portfolio
              </Button>
            )}
          </div>
          <div className="hero-art ai-art">
            <IntelligenceOrb />
          </div>
          <span className="hero-ai-chip">
            <span /> Connected thinking. Human decisions.
          </span>
          <BorderBeam />
        </section>
        <section className="smart-brief">
          <span>
            <Icon name="Sparkles" />
          </span>
          <div>
            <h3>
              <ShimmerText>Your next best step starts here.</ShimmerText>
            </h3>
            <p>Explore intelligent workflows across your workspace.</p>
          </div>
          <div className="smart-brief-actions">
            {canOpen(profile, "applications") && (
              <button onClick={() => go("applications")}>
                Review applications <Icon name="ArrowUpRight" small />
              </button>
            )}
            {canOpen(profile, "product-config") && (
              <button onClick={() => go("product-config")}>
                Design a product <Icon name="ArrowUpRight" small />
              </button>
            )}
          </div>
        </section>
        <div className="stat-grid">
          <Stat
            label="Active policies"
            value={policies.filter((policy) => IN_COVER_STATES.includes(policy.status)).length}
            icon="ShieldCheck"
          />
          <Stat
            label="Monthly premium in force"
            value={money(policies.filter((policy) => IN_COVER_STATES.includes(policy.status)).reduce((sum, policy) => sum + Number(policy.premium || 0), 0))}
            icon="Wallet"
            color="purple"
          />
          <Stat
            label="New applications"
            value={applications.length}
            icon="FilePlus2"
            color="blue"
          />
          <Stat
            label="Claims settled"
            value={claims.length ? Math.round((100 * claims.filter((claim) => SETTLED_CLAIM.includes(claim.status)).length) / claims.length) + "%" : "0%"}
            icon="HeartHandshake"
            color="amber"
          />
        </div>
        <div className="dashboard-grid">
          <Panel
            title="A little growth, every month"
            subtitle="Premium collections · BWP millions"
            action={
              <Select
                className="select small-select"
                aria-label="Chart period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option>Last 6 months</option>
                <option>Previous 6 months</option>
              </Select>
            }
          >
            <div className="chart-legend">
              <span>
                <i className="legend-dot" />
                Collected
              </span>
              <span>
                <i className="legend-dot pale" />
                Target
              </span>
            </div>
            <div className="chart">
              <div className="chart-axis">
                <span>3.2m</span>
                <span>2.1m</span>
                <span>1.1m</span>
                <span>0</span>
              </div>
              <div className="chart-bars">
                {heights.map((h, i) => (
                  <div className="bar-group" key={i}>
                    <div className="bars">
                      <div
                        className="bar"
                        style={{ height: h + "%" }}
                        title={money(Math.round(h * 31910))}
                      >
                        <span>{(h * 0.03191).toFixed(2)}m</span>
                      </div>
                      <div
                        className="bar bar-secondary"
                        style={{ height: h + 8 + "%" }}
                      />
                    </div>
                    <span className="chart-label">
                      {
                        (period === "Last 6 months"
                          ? ["Apr", "May", "Jun", "Jul", "Aug", "Sep"]
                          : ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"])[i]
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
          <Panel
            title="Protection, in every form"
            subtitle="Your portfolio by product"
          >
            <div className="donut-wrap">
              <div
                className="donut"
                style={{ background: donutGradient(productMix) }}
              >
                <div className="donut-center">
                  <strong>{policies.length}</strong>
                  <span>protected lives</span>
                </div>
              </div>
            </div>
            <div className="legend-list">
              {productMix.length ? (
                productMix.map((slice) => (
                  <div className="legend-row" key={slice.name}>
                    <span>
                      <i className={"legend-dot " + slice.color} />
                      {slice.name}
                    </span>
                    <strong>{slice.percent}%</strong>
                  </div>
                ))
              ) : (
                <div className="legend-row">
                  <span>
                    <i className="legend-dot pale" />
                    No policies yet
                  </span>
                </div>
              )}
            </div>
          </Panel>
        </div>
        {shortcuts.length > 0 && (
        <section className="quick-actions">
          {shortcuts.map(([title, sub, icon, action, color]) => (
            <button
              key={title}
              className="quick-action"
              onClick={() => setModal({ type: action })}
            >
              <span className={"quick-icon " + color}>
                <Icon name={icon} />
              </span>
              <span>
                <strong>{title}</strong>
                <small>{sub}</small>
              </span>
              <Icon name="ChevronRight" small />
            </button>
          ))}
        </section>
        )}
        <div className="bottom-grid">
          <Panel
            title="On your radar"
            subtitle="Recent applications that need a little attention"
            action={
              canOpen(profile, "applications") && (
                <button className="text-link" onClick={() => go("applications")}>
                  View all <Icon name="ArrowRight" small />
                </button>
              )
            }
          >
            {RecordsTable({ rows: applications.slice(0, 4), short: true })}
          </Panel>
          <Panel
            title="The latest happenings"
            subtitle="Small moments. Meaningful progress."
          >
            <div className="activity-list">
              {[
                [
                  "ShieldCheck",
                  "green",
                  "A new chapter begins",
                  "Policy POL-10842 is now active.",
                  "12 min ago",
                ],
                [
                  "HeartHandshake",
                  "purple",
                  "Support, delivered",
                  "Claim CLM-0839 payment settled.",
                  "38 min ago",
                ],
                [
                  "Users",
                  "blue",
                  "Growing together",
                  "12 members joined Okavango Holdings.",
                  "1 hour ago",
                ],
                [
                  "FileText",
                  "amber",
                  "One step closer",
                  "New evidence received for review.",
                  "2 hours ago",
                ],
              ].map(([i, c, t, d, time]) => (
                <div className="activity-item" key={t}>
                  <span className={"activity-dot " + c}>
                    <Icon name={i} small />
                  </span>
                  <div className="activity-copy">
                    <strong>{t}</strong>
                    <p>{d}</p>
                    <span className="activity-time">{time}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </>
    );
  }

  function Customers() {
    return (
      <CustomerDirectory
        customers={customers}
        search={search}
        setSearch={setSearch}
        session={session}
        profile={profile}
        notify={notify}
        onReload={() => request(session, "/portfolio/customers").then((r) => setCustomers(r.data)).catch(() => {})}
        canReviewKyc={can(profile, "KYC_CUSTOMER")}
        canReviewEdd={can(profile, "EDD_CUSTOMER")}
        onEdd={reviewEdd}
        onAddCustomer={canDo(profile, "newCustomer") ? () => setModal({ type: "customer" }) : null}
        onAddPolicy={canDo(profile, "newApplication") ? (c) => setModal({ type: "application", customer: c.id }) : null}
        onView={(c) => detail("customer", c)}
        onKyc={reviewKyc}
        onExport={(rows) => {
          downloadCSV("customers.csv", [
            ["Customer ID", "Full name", "POI type", "POI number", "Date of birth", "Mobile", "Email", "KYC", "EDD review"],
            ...rows.map((c) => [
              c.id, c.name, c.poiType || "", c.poiNumber || "", c.dateOfBirth || "",
              c.phone || "", c.email || "",
              kycLabel(c), eddLabel(c) || "N/A",
            ]),
          ]);
          notify("Customer export is ready.");
        }}
      />
    );
  }
  function RecordsPage({ kind }) {
    const config = {
      applications: {
        title: "Every application is a new beginning.",
        sub: "From first hello to confidently covered.",
        rows: applications,
        type: "application",
        action: canDo(profile, "newApplication") ? "New application" : null,
        statuses: [
          "All",
          "Draft",
          "Under review",
          "Evidence needed",
          "Ready to issue",
          "Issued",
        ],
      },
      policies: {
        title: "Protection you can keep track of.",
        sub: "Every policy, every person, all in one place.",
        rows: policies,
        type: "policy",
        // NS-IL01-005: every policy is issued from an underwritten application, so new cover starts there.
        action: canDo(profile, "newApplication") ? "New application" : null,
        statuses: ["All", ...POLICY_STATES],
      },
      claims: {
        title: "Here for the moments that matter.",
        sub: "Thoughtful claims handling, from notification to resolution.",
        rows: claims,
        type: "claim",
        action: canDo(profile, "newClaim") ? "Register claim" : null,
        statuses: ["All", ...CLAIM_STATES, NEEDS_AUDIT],
      },
      collections: {
        title: "A clearer view of your collections.",
        sub: "Follow premium payments and give every exception a next step.",
        rows: receipts,
        type: "collection",
        action: null,
        statuses: ["All", "Paid", "Pending", "Overdue"],
      },
    }[kind];
    const paymentsTab = kind === "collections" && collectionsTab === "payments" && can(profile, "READ_PAYMENT");
    const ledgerTab = kind === "collections" && collectionsTab === "ledger" && can(profile, "READ_FINANCE");
    const collectionsTabs = [
      ["receipts", "Premium receipts"],
      ...(can(profile, "READ_FINANCE") ? [["ledger", "Instalment ledger"]] : []),
      ...(can(profile, "READ_PAYMENT") ? [["payments", "Payments"]] : []),
    ];
    const newBusinessTab = kind === "applications" && applicationsTab !== "workbench" ? applicationsTab : null;
    return (
      <>
        <Heading title={config.title} subtitle={config.sub}>
          {!paymentsTab && !ledgerTab && (
            <Button
              variant="secondary"
              icon="Download"
              onClick={() => exportRows(kind, visible(config.rows))}
            >
              Export CSV
            </Button>
          )}
          {config.action && (
            <Button
              icon="Plus"
              onClick={() =>
                setModal({
                  type:
                    kind === "claims" ? "claim" : "application",
                })
              }
            >
              {config.action}
            </Button>
          )}
        </Heading>
        {kind === "applications" && (
          <Tabs
            tabs={[
              ["workbench", "Applications"],
              ["evidence", "Missing evidence"],
              ["compare", "Compare quotes"],
            ]}
            value={applicationsTab}
            onChange={setApplicationsTab}
          />
        )}
        {newBusinessTab === "evidence" && (
          <EvidenceQueue
            session={session}
            onOpen={(ref) => {
              const record = applications.find((a) => a.id === ref);
              if (record) detail("application", record);
            }}
          />
        )}
        {newBusinessTab === "compare" && (
          <QuoteComparison
            session={session}
            customers={customers.filter((c) => c.kycStatus === "VERIFIED")}
            products={products}
            notify={notify}
            profile={profile}
            onDraftCreated={(created) => setApplications((rows) => [created, ...rows])}
          />
        )}
        {kind === "collections" && collectionsTabs.length > 1 && (
          <Tabs tabs={collectionsTabs} value={collectionsTab} onChange={setCollectionsTab} />
        )}
        {newBusinessTab ? null : paymentsTab ? (
          <PaymentTransactions session={session} notify={notify} />
        ) : ledgerTab ? (
          <InstalmentLedger session={session} />
        ) : (
          <>
        {kind === "collections" && (
          <div className="stat-grid three">
            <Stat
              label="Collected"
              value={money(receipts.filter((x) => x.status === "Paid").reduce((sum, x) => sum + Number(x.amount || x.premium || 0), 0))}
              icon="Wallet"
            />
            <Stat
              label="Collection rate"
              value={receipts.length ? Math.round((100 * receipts.filter((x) => x.status === "Paid").length) / receipts.length) + "%" : "0%"}
              icon="CircleCheck"
              color="blue"
            />
            <Stat
              label="Needs attention"
              value={money(receipts.filter((x) => x.status !== "Paid").reduce((sum, x) => sum + Number(x.amount || x.premium || 0), 0))}
              change={receipts.filter((x) => x.status !== "Paid").length + " invoices"}
              note="pending or overdue"
              icon="Clock3"
              color="amber"
            />
          </div>
        )}
        <Panel
          title={
            kind === "applications"
              ? "Application workbench"
              : kind === "policies"
                ? "Your policy portfolio"
                : kind === "claims"
                  ? "Claims workbench"
                  : "Premium transactions"
          }
          subtitle={
            kind === "policies"
              ? `${config.rows.length} policies saved in this workspace`
              : `${config.rows.length} records`
          }
        >
          {Filters({ statuses: config.statuses, count: config.rows.length })}
          {RecordsTable({ rows: visible(config.rows), type: config.type, total: config.rows.length })}
        </Panel>
        {kind === "claims" && <ClaimPayouts session={session} go={go} />}
        {kind === "claims" && can(profile, "READ_CLAIM") && (
          <PayoutExceptionQueue
            session={session}
            profile={profile}
            notify={notify}
            onOpen={(row) => {
              const claim = row.sourceType === "CLAIM" && claims.find((c) => c.id === row.sourceRef);
              if (claim) detail("claim", claim);
              else if (row.sourceType === "CARE_CASH") go("care-cash");
            }}
          />
        )}
          </>
        )}
        {kind === "applications" && canDo(profile, "newApplication") && (
          <div className="notice">
            <Icon name="Lightbulb" />
            <p>
              <strong>Try the whole journey.</strong> Create an application,
              review it, and issue the policy. Your new policy will
              appear in the portfolio.
            </p>
          </div>
        )}
      </>
    );
  }
  function Products() {
    return (
      <section className="product-catalog" aria-label="Product catalogue">
        <Heading
          title="Your protection lineup"
          subtitle="Thoughtful cover for every chapter. Find the right fit for your customers."
        >
          {canOpen(profile, "product-config") && (
            <Button icon="Settings2" onClick={() => go("product-config")}>
              Configure products
            </Button>
          )}
        </Heading>
        <div className="catalog-toolbar">
          <div className="catalog-label">
            <h2>Explore products</h2>
            <span>{products.length} available</span>
          </div>
          <p>
            <Icon name="Info" small /> Benefits and premiums as currently published
          </p>
        </div>
        <div className="product-grid">
          {products.map((p) => (
            <article className="product-card" key={p.name}>
              <div className="catalog-image">
                {p.image ? (
                  <img
                    src={p.image}
                    alt=""
                    style={{ objectPosition: p.imageFocus || "center" }}
                  />
                ) : (
                  <div className="catalog-image-placeholder">
                    <Icon name={p.icon} />
                  </div>
                )}
                <span className="catalog-category">
                  {p.highlight || p.needLabel || "Protection"}
                </span>
              </div>
              <div className="catalog-card-body">
                <div className="catalog-title">
                  <span className="catalog-icon">
                    <Icon name={p.icon} />
                  </span>
                  <h2>{p.name}</h2>
                  {p.productType && <span className="rt-type">{p.productType}</span>}
                </div>
                <p className="catalog-description">{p.description}</p>
                <dl className="catalog-pricing">
                  <div>
                    <dt>Cover</dt>
                    <dd>{p.cover}</dd>
                  </div>
                  <div>
                    <dt>Monthly premium</dt>
                    <dd>{p.premium}</dd>
                  </div>
                </dl>
                {canDo(profile, "newApplication") && (
                  <button
                    type="button"
                    className="catalog-action"
                    aria-label={"Start application for " + p.name}
                    onClick={() =>
                      setModal({ type: "application", product: p.name })
                    }
                  >
                    <span>Start application</span>
                    <Icon name="ArrowUpRight" />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
        <p className="catalog-disclaimer">
          Figures do not constitute approved insurance quotations.
        </p>
      </section>
    );
  }
  function Schemes() {
    // Figures are the scheme records' own (D-29): active by status, members and premium summed over active schemes.
    const active = schemes.filter((s) => /^active$/i.test(s.status || "ACTIVE"));
    return (
      <>
        <Heading
          title="Stronger, together."
          subtitle="One connected home for employers, schemes, and their people."
        />
        <div className="stat-grid three">
          <Stat
            label="Active schemes"
            value={active.length}
            change={schemes.length !== active.length ? schemes.length + " in total" : undefined}
            note=""
            icon="Building2"
          />
          <Stat
            label="Covered members"
            value={active.reduce((sum, s) => sum + Number(s.members || 0), 0).toLocaleString("en-GB")}
            icon="Users"
            color="purple"
          />
          <Stat
            label="Monthly scheme premium"
            value={money(active.reduce((sum, s) => sum + Number(s.premium || 0), 0))}
            icon="Wallet"
            color="blue"
          />
        </div>
        <div className="scheme-grid">
          {schemes.map((s) => (
            <article className="scheme-card panel" key={s.id}>
              <div className="scheme-card-top">
                <span className={"avatar " + s.color}>{s.initials}</span>
                <Badge>{schemeStatus(s)}</Badge>
              </div>
              <h2>{s.name}</h2>
              <p className="subtitle">{s.sector}</p>
              <div className="scheme-meta">
                <div>
                  <small>Covered members</small>
                  <strong>{s.members}</strong>
                </div>
                <div>
                  <small>Monthly premium</small>
                  <strong>{money(s.premium)}</strong>
                </div>
              </div>
              <div className="scheme-renewal">
                <Icon name="CalendarDays" small /> Renews {s.renewal}
              </div>
              <Button
                variant="secondary"
                icon="ArrowRight"
                onClick={() => detail("scheme", s)}
              >
                Explore scheme
              </Button>
            </article>
          ))}
        </div>
        <div className="notice">
          <Icon name="Info" />
          <p>
            Members, census imports and billing are managed in group scheme administration, which needs the
            scheme permission (READ_SCHEME). This overview shows each scheme's record only.
          </p>
        </div>
      </>
    );
  }
  function Settings() {
    return (
      <>
        <Heading
          title="Make yourself at home."
          subtitle="A few preferences for this workspace."
        />
        <div className="settings-grid">
          <Panel title="Your profile" subtitle="Signed-in account">
            <Person
              name={profile?.username || "Signed in"}
              sub={(profile?.roles || []).join(", ") || "Staff"}
            />
            <div className="detail-grid">
              <div className="detail-item">
                <small>Workspace</small>
                <strong>Nsure Life</strong>
              </div>
              <div className="detail-item">
                <small>Currency</small>
                <strong>Botswana pula (BWP)</strong>
              </div>
            </div>
          </Panel>
          <Panel title="Workspace preferences">
            <div className="setting-row">
              <div>
                <strong>Appearance</strong>
                <p>Light, dark, or follow your device.</p>
              </div>
              <ThemeSwitch />
            </div>
            <div className="setting-row">
              <div>
                <strong>Notifications</strong>
                <p>Show the alert count on the bell.</p>
              </div>
              <button
                role="switch"
                aria-checked={notifications}
                aria-label="Notifications"
                className={"toggle " + (notifications ? "active" : "")}
                onClick={() => setNotifications(!notifications)}
              />
            </div>
            <div className="setting-row">
              <div>
                <strong>Compact tables</strong>
                <p>Fit a little more into your workbench.</p>
              </div>
              <button
                role="switch"
                aria-checked={compact}
                aria-label="Compact tables"
                className={"toggle " + (compact ? "active" : "")}
                onClick={() => setCompact(!compact)}
              />
            </div>
          </Panel>
          <Panel
            title="Refresh data"
            subtitle="Read every list again from the server. Nothing is changed or deleted."
          >
            <Button
              variant="secondary"
              icon="RotateCcw"
              onClick={() => setModal({ type: "reset" })}
            >
              Refresh data
            </Button>
          </Panel>
        </div>
      </>
    );
  }

  function NoAccess() {
    const codes = PAGE_ACCESS[view] || [];
    const landingName = menuItems.find((n) => n[0] === landing)?.[1] || "Settings";
    return (
      <>
        <Heading
          title="You don’t have access to this page."
          subtitle="Your roles do not include the permission this page needs, so it is not shown."
        />
        <Panel
          title="Access is limited"
          subtitle={
            codes.length
              ? "This page needs " + (codes.length > 1 ? "one of " : "") + codes.join(", ") + "."
              : "This address is not a page in the workspace."
          }
        >
          <div className="notice">
            <Icon name="ShieldAlert" />
            <p>
              Ask an administrator to grant {codes.length > 1 ? "one of these permissions" : "this permission"} to one
              of your roles. The sidebar only lists the pages you can open.
            </p>
          </div>
          <div className="detail-actions">
            <Button icon="ArrowRight" onClick={() => go(landing)}>
              Go to {landingName}
            </Button>
          </div>
        </Panel>
      </>
    );
  }

  // The bell: the server's alerts for this user, plus customer purchases awaiting their first premium for those who
  // can record it. An alert about a control opens the Controls page when the user may open it.
  const ALERT_PAGES = { CONTROL_DISABLED: "controls", STP_RATE_ZERO: "controls" };
  const alertItems = [
    ...alerts.map((a) => ({
      key: "alert-" + a.id,
      icon: "ShieldAlert",
      tone: "warn",
      title: a.title,
      body: a.body,
      at: a.createdAt,
      page: canOpen(profile, ALERT_PAGES[a.type]) ? ALERT_PAGES[a.type] : null,
    })),
    ...(can(profile, "UPDATE_POLICY") && canOpen(profile, "policies") && pendingPolicies.length
      ? [
          {
            key: "pending-policies",
            icon: "Wallet",
            tone: "",
            title:
              pendingPolicies.length === 1
                ? "A policy is awaiting its first premium"
                : pendingPolicies.length + " policies are awaiting their first premium",
            body: "Record the payment, or cancel a purchase the customer no longer wants.",
            page: "policies",
          },
        ]
      : []),
  ];

  return (
    <div className={"app-shell " + (compact ? "compact" : "")}>
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}
      <aside className={"sidebar " + (mobileOpen ? "open" : "")}>
        <a
          href={"#/" + landing}
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            go(landing);
          }}
        >
          <img
            className="brand-logo"
            src="/brand/nsure-life-logo-light.svg"
            alt="Nsure Life"
          />
        </a>
        <div className="workspace-label">
          <span className="workspace-icon" style={insurer?.primaryColor ? { background: insurer.primaryColor } : undefined}>
            {(insurer?.displayName || "N").slice(0, 1)}
          </span>
          <div>
            <strong>{insurer?.displayName || "Nsure workspace"}</strong>
            <small title={insurer ? "Installation for insurer " + insurer.insurerCode : undefined}>
              {insurer ? environmentLabel(insurer.environment) + " · " + insurer.currency : "Operations team"}
            </small>
          </div>
          <Icon name="ChevronsUpDown" small />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation" className="nav-tree">
          {visibleGroups.map((group) => {
            const renderItem = ([key, label, icon], sub) => (
              <a
                key={key}
                href={"#/" + key}
                onClick={(e) => {
                  e.preventDefault();
                  go(key);
                }}
                className={"nav-item " + (sub ? "nav-sub-item " : "") + (view === key ? "active" : "")}
                aria-current={view === key ? "page" : undefined}
              >
                <Icon name={icon} />
                <span>{label}</span>
                {key === "applications" && (
                  <span className="nav-count">
                    {applications.filter((a) => a.status !== "Issued").length}
                  </span>
                )}
                {key === "policies" && can(profile, "UPDATE_POLICY") && pendingPolicies.length > 0 && (
                  <span className="nav-count" title="Customer purchases awaiting payment">
                    {pendingPolicies.length}
                  </span>
                )}
              </a>
            );
            if (group.item) return renderItem(group.item, false);
            const open = Boolean(navOpen[group.key]);
            const panelId = "nav-group-" + group.key;
            return (
              <div className={"nav-group " + (open ? "open" : "")} key={group.key}>
                <button
                  type="button"
                  className={"nav-item nav-group-head " + (activeGroup === group.key ? "has-active" : "")}
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => {
                    // Customers goes to its own page (when the user may open it) and opens; any other group just
                    // opens or closes. One group open at a time, so the whole sidebar fits on one screen.
                    if (group.page && view !== group.page && canOpen(profile, group.page)) {
                      setNavOpen({ [group.key]: true });
                      go(group.page);
                    } else {
                      setNavOpen((o) => (o[group.key] ? {} : { [group.key]: true }));
                    }
                  }}
                >
                  <Icon name={group.icon} />
                  <span>{group.label}</span>
                  <span className="nav-chevron" aria-hidden="true">
                    <Icon name="ChevronDown" small />
                  </span>
                </button>
                {open && (
                  <div className="nav-sub" id={panelId} role="group" aria-label={group.label}>
                    {group.items.map((item) => renderItem(item, true))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span>🌿 A space to explore</span>
            <p>
              People, policies, and claims
              <br />
              in one workspace.
            </p>
          </div>
          <a
            href="#/settings"
            className={"nav-item " + (view === "settings" ? "active" : "")}
            onClick={(e) => {
              e.preventDefault();
              go("settings");
            }}
          >
            <Icon name="Settings2" />
            Settings
          </a>
          <button type="button" className="nav-item" onClick={logout}>
            <Icon name="LogIn" />
            Customer sign-in
          </button>
          <div className="user-profile">
            <span className="avatar">
              {(profile?.username || "IN").slice(0, 2).toUpperCase()}
            </span>
            <div className="user-info">
              <strong>{profile?.username || "Signed in"}</strong>
              <small>{(profile?.roles || []).join(", ") || "Staff"}</small>
            </div>
            <button
              className="logout icon-btn"
              onClick={logout}
              aria-label="Sign out"
            >
              <Icon name="LogOut" small />
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
          >
            <Icon name="Menu" />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span> <Icon name="ChevronRight" small />
            <strong>{activeName}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="command-launcher"
              onClick={() => setModal({ type: "command" })}
              aria-label="Open command palette"
            >
              <Icon name="Search" small />
              <span>Ask or jump to anything…</span>
              <kbd>⌘ K</kbd>
            </button>
            <ThemeSwitch compact />
            <div className="alerts-menu" ref={alertsRef}>
              <button
                type="button"
                className="icon-btn notification"
                aria-label={alertItems.length ? "Alerts, " + alertItems.length + " to look at" : "Alerts"}
                aria-haspopup="true"
                aria-expanded={alertsOpen}
                onClick={() => {
                  if (!alertsOpen) loadAlerts();
                  setAlertsOpen((o) => !o);
                }}
              >
                <Icon name="Bell" />
                {notifications && alertItems.length > 0 && (
                  <span className="alerts-count" aria-hidden="true">
                    {alertItems.length > 9 ? "9+" : alertItems.length}
                  </span>
                )}
              </button>
              {alertsOpen && (
                <div className="cd-menu alerts-dropdown" role="region" aria-label="Alerts">
                  <div className="alerts-head">
                    <strong>Alerts</strong>
                    <small>{alertItems.length ? alertItems.length + " to look at" : "All clear"}</small>
                  </div>
                  {alertItems.length === 0 ? (
                    <div className="cd-menu-note">Nothing needs your attention right now.</div>
                  ) : (
                    alertItems.map((item) => {
                      const Tag = item.page ? "button" : "div";
                      const link = item.page
                        ? {
                            type: "button",
                            onClick: () => {
                              setAlertsOpen(false);
                              go(item.page);
                            },
                          }
                        : {};
                      return (
                        <Tag key={item.key} {...link} className={"cd-menu-item alerts-item " + item.tone}>
                          <Icon name={item.icon} small />
                          <span className="cd-menu-text">
                            <span>{item.title}</span>
                            {item.body && <small className="cd-menu-hint">{item.body}</small>}
                            {item.at && <small className="alerts-time">{when(item.at)}</small>}
                          </span>
                        </Tag>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            <button
              className="avatar profile-button"
              aria-label="Your profile"
              onClick={() => go("settings")}
            >
              {(profile?.username || "IN").slice(0, 2).toUpperCase()}
            </button>
          </div>
        </header>
        {/* Emergency access (Nsure Life NS-SH11-003): the holder always sees what they hold and until when. */}
        {profile?.emergencyAccess?.length > 0 && (
          <div className="notice emergency-banner" role="status">
            <Icon name="ShieldAlert" />
            <p>
              <strong>Emergency access active:</strong>{" "}
              {profile.emergencyAccess
                .map(
                  (grant) =>
                    grant.permission +
                    " until " +
                    new Date(grant.expiresAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) +
                    " (granted by " +
                    grant.grantedBy +
                    ")",
                )
                .join("; ")}
              . Everything you do with it is audited and reviewed afterwards.
            </p>
          </div>
        )}
        <AnimatedWorkspace page={view} key={view}>
          {/* A typed address the user may not open shows why, never the page (spec 04 A-9). */}
          {!canOpen(profile, view) ? (
            NoAccess()
          ) : view === "overview" ? (
            Overview()
          ) : view === "customers" ? (
            Customers()
          ) : ["applications", "policies", "claims", "collections"].includes(
              view,
            ) ? (
            RecordsPage({ kind: view })
          ) : view === "products" ? (
            Products()
          ) : view === "rate-tables" ? (
            <RateTables session={session} notify={notify} profile={profile} />
          ) : view === "product-config" ? (
            <ProductConfig
              session={session}
              products={products}
              profile={profile}
              records={productConfigs}
              setRecords={setProductConfigs}
              notify={notify}
              onSaveRecord={async (record) => {
                const exists = productConfigs.some((item) => item.id === record.id);
                const saved = await request(
                  session,
                  exists ? "/portfolio/product-configs/" + record.id : "/portfolio/product-configs",
                  { method: exists ? "PUT" : "POST", body: record },
                );
                return saved.data;
              }}
            />
          ) : view === "schemes" ? (
            // Group administration with READ_SCHEME; READ_POLICY alone keeps the older scheme overview.
            can(profile, "READ_SCHEME") ? (
              <GroupAdmin session={session} notify={notify} profile={profile} />
            ) : (
              Schemes()
            )
          ) : view === "reports" ? (
            <ManagementReports session={session} notify={notify} profile={profile} go={go} />
          ) : view === "finance" ? (
            <Finance session={session} notify={notify} profile={profile} />
          ) : view === "distribution" ? (
            <Distribution session={session} notify={notify} profile={profile} />
          ) : view === "reinsurance" ? (
            <Reinsurance session={session} notify={notify} profile={profile} />
          ) : view === "underwriting" ? (
            <Underwriting session={session} notify={notify} profile={profile} />
          ) : view === "servicing" ? (
            <PolicyServicing session={session} notify={notify} profile={profile} />
          ) : view === "credit-life" ? (
            <CreditLife session={session} notify={notify} profile={profile} />
          ) : view === "partner-portal" ? (
            <PartnerPortal session={session} notify={notify} profile={profile} />
          ) : view === "work-queue" ? (
            <Operations session={session} notify={notify} profile={profile} go={go} />
          ) : view === "data-assistants" ? (
            <PlatformServices session={session} notify={notify} profile={profile} />
          ) : view === "scheme-lifecycle" ? (
            <GroupLife session={session} notify={notify} profile={profile} />
          ) : view === "care-cash" ? (
            <CareCash session={session} notify={notify} profile={profile} />
          ) : view === "service-desk" ? (
            <ServiceDesk session={session} notify={notify} profile={profile} />
          ) : view === "communications" ? (
            <Communications session={session} notify={notify} profile={profile} />
          ) : view === "integration" ? (
            <IntegrationMonitor session={session} notify={notify} profile={profile} />
          ) : view === "configuration" ? (
            <ConfigReleases session={session} notify={notify} profile={profile} products={products} />
          ) : view === "access" ? (
            <AccessAdmin session={session} notify={notify} profile={profile} />
          ) : view === "controls" ? (
            <Controls session={session} notify={notify} profile={profile} />
          ) : view === "settings" ? (
            Settings()
          ) : (
            NoAccess()
          )}
          <footer className="page-footer">
            <span>
              Thoughtfully connected. <strong>Nsure.</strong>
            </span>
          </footer>
        </AnimatedWorkspace>
      </main>
      {modal && (
        <Modal
          title={
            modal.type === "application"
              ? modal.draft
                ? "Continue application " + modal.draft.id
                : "Start a new application"
              : modal.type === "policy"
                ? "Add a policy"
              : modal.type === "customer"
                ? "Welcome a new customer"
                : modal.type === "claim"
                  ? "Register a claim"
                  : modal.type === "detail"
                    ? modal.record.name
                    : modal.type === "reset"
                          ? "Refresh this workspace?"
                          : modal.type === "command"
                            ? "Your workspace, one shortcut away."
                            : "Nsure"
          }
          onClose={close}
        >
          {modal.type === "command" && (
            <ActionSearch
              actions={[
                // Only what this user may do: the two shortcuts need their create permission, and the pages are the
                // sidebar's, which the access map has already filtered.
                ...(canDo(profile, "newApplication")
                  ? [
                      {
                        id: "new-application",
                        label: "New application",
                        description: "Start an application wizard",
                      },
                    ]
                  : []),
                ...(canDo(profile, "newClaim")
                  ? [
                      {
                        id: "new-claim",
                        label: "Register a claim",
                        description: "Open claim intake",
                      },
                    ]
                  : []),
                ...menuItems.map(([id, label]) => ({
                  id,
                  label,
                  description: "Open the " + label.toLowerCase() + " workspace",
                })),
              ]}
              onSelect={(id) =>
                id === "new-application"
                  ? setModal({ type: "application" })
                  : id === "new-claim"
                    ? setModal({ type: "claim" })
                    : go(id)
              }
            />
          )}
          {modal.type === "application" && modal.draft && (
            <ApplicationForm
              session={session}
              customers={customers}
              products={products}
              draft={modal.draft}
              onCancel={close}
              onSave={async ({ status, ...body }) => {
                // A resumed draft (NS-UX-001): save what was completed, then submit it when asked to.
                const ref = modal.draft.id;
                try {
                  const saved = (
                    await request(session, "/portfolio/applications/" + ref + "/details", {
                      method: "PUT",
                      body,
                      version: modal.draft.version,
                    })
                  ).data;
                  let checklist = null;
                  if (status !== "Draft") {
                    checklist = (
                      await request(session, "/portfolio/applications/" + ref + "/submit", {
                        method: "POST",
                        version: saved.version,
                      })
                    ).data;
                  }
                  const fresh = await request(session, "/portfolio/applications").catch(() => null);
                  if (fresh) setApplications(fresh.data);
                  close();
                  go("applications");
                  notify(checklist ? ref + " submitted: " + checklist.status + "." : ref + " saved as a draft.");
                } catch (error) {
                  notify(error.message, "error");
                }
              }}
            />
          )}
          {modal.type === "application" && !modal.draft && (
            <ApplicationForm
              session={session}
              defaultProduct={modal.product}
              defaultCustomer={modal.customer}
              customers={customers}
              products={products}
              onCancel={close}
              onSave={async (data) => {
                try {
                  const created = await request(session, "/portfolio/applications", {
                    method: "POST",
                    body: data,
                  });
                  setApplications((a) => [created.data, ...a]);
                  close();
                  go("applications");
                  notify("Application saved.");
                } catch (error) {
                  notify(error.message, "error");
                }
              }}
            />
          )}
          {modal.type === "customer" && (
            <CustomerForm
              onCancel={close}
              onSave={async (data) => {
                try {
                  const created = await request(session, "/portfolio/customers", {
                    method: "POST",
                    body: data,
                  });
                  setCustomers((c) => [created.data, ...c]);
                  close();
                  go("customers");
                  notify(
                    (created.data.duplicateReview ? "Customer saved and referred for duplicate review. " : "Customer saved. ") +
                      "Sign in as " +
                      created.data.loginUsername +
                      " after KYC is successful.",
                  );
                } catch (error) {
                  // A possible duplicate (409) is answered on the form itself.
                  if (error.status === 409) throw error;
                  notify(error.message, "error");
                }
              }}
            />
          )}
          {modal.type === "claim" && (
            <ClaimLodgeForm
              staff
              policies={policies.filter((p) => ["Active", GRACE, NO_COVER, "Lapsed"].includes(p.status))}
              onCancel={close}
              onSave={async (data) => {
                try {
                  const created = await request(session, "/portfolio/claims", {
                    method: "POST",
                    body: data,
                  });
                  setClaims((c) => [created.data, ...c]);
                  go("claims");
                  setModal({ type: "detail", entity: "claim", record: created.data });
                  notify(
                    created.data.status === "Approved"
                      ? created.data.id + " passed every check and is approved straight through."
                      : created.data.id + " is lodged and sent for review.",
                  );
                } catch (error) {
                  notify(error.message, "error");
                }
              }}
            />
          )}
          {modal.type === "reset" && (
            <>
              <p>
                Every list is read again from the server. Saved changes stay as they are; nothing is reset or
                deleted. Anything typed into a form and not yet saved is lost. You stay signed in.
              </p>
              <div className="modal-footer">
                <Button variant="secondary" onClick={close}>
                  Cancel
                </Button>
                <Button icon="RotateCcw" onClick={() => location.reload()}>
                  Refresh
                </Button>
              </div>
            </>
          )}
          {modal.type === "detail" && (
            <Detail
              entity={modal.entity}
              record={modal.record}
              customers={customers}
              policies={policies}
              claims={claims}
              onGo={go}
              onIssue={canDo(profile, "issuePolicy") ? issue : null}
              session={session}
              profile={profile}
              onPolicyUpdated={policyUpdated}
              onApplicationUpdated={applicationUpdated}
              onClaimUpdated={claimUpdated}
              canReviewKyc={can(profile, "KYC_CUSTOMER")}
              canReviewEdd={can(profile, "EDD_CUSTOMER")}
              onEdd={async (record, decision, reason) => {
                const updated = await reviewEdd(record, decision, reason);
                // From a customer, show the updated customer; from an application, stay on it so it can be issued.
                if (updated) {
                  setModal((current) =>
                    current?.entity === "customer" ? { type: "detail", entity: "customer", record: updated } : current,
                  );
                }
                return Boolean(updated);
              }}
              onKyc={async (record, decision, reason) => {
                const updated = await reviewKyc(record, decision, reason);
                if (updated) setModal({ type: "detail", entity: "customer", record: updated });
                return Boolean(updated);
              }}
              onAddPolicy={
                canDo(profile, "newApplication") ? (record) => setModal({ type: "application", customer: record.id }) : null
              }
              onResume={
                can(profile, "UPDATE_APPLICATION")
                  ? (record) => setModal({ type: "application", draft: record })
                  : null
              }
              onCustomerUpdated={async (updated) => {
                // A KYC verification returns the customer; an approved contact change is re-read from the list.
                let record = updated;
                if (!record && modal.record?.id) {
                  try {
                    const all = await request(session, "/portfolio/customers");
                    setCustomers(all.data);
                    record = all.data.find((c) => c.id === modal.record.id);
                  } catch {
                    record = null;
                  }
                } else if (record) {
                  setCustomers((rows) => rows.map((row) => (row.id === record.id ? record : row)));
                }
                if (record) setModal({ type: "detail", entity: "customer", record });
              }}
              notify={notify}
            />
          )}
        </Modal>
      )}
    </div>
  );
}

// draft: a saved draft application to resume (NS-UX-001). Its customer and priced cover are fixed by its quote; the
// form reopens on the details step so the payer, disclosures and declaration can be completed and submitted.
function ApplicationForm({
  session,
  defaultProduct,
  defaultCustomer,
  customers,
  products = [],
  draft = null,
  onSave,
  onCancel,
}) {
  const [step, setStep] = useState(draft ? 2 : 0);
  const [data, setData] = useState(() => {
    if (draft) {
      return {
        customerRef: draft.customerRef || "",
        name: draft.name,
        product: draft.product,
        tier: draft.tier || "",
        amount: draft.amount,
        premium: draft.premium,
      };
    }
    const p = products.find((item) => item.name === defaultProduct) ||
      popularProduct(products) || { name: "", cover: "0", premium: "0" };
    const tier = defaultTier(p);
    const first = customers.find((c) => c.id === defaultCustomer) || customers[0];
    return {
      // Chosen by reference: two customers can share a name (NS-SH01-001).
      customerRef: first?.id || "",
      name: first?.name || "",
      product: p.name,
      tier: tier?.name || "",
      amount: tier ? tier.cover : amountOf(p.cover),
      premium: tier ? tier.premium : amountOf(p.premium),
    };
  });
  const [consent, setConsent] = useState(false);
  const chosen = products.find((p) => p.name === data.product);
  const tiers = productTiers(chosen);
  const ratedTier = tiers.find((t) => t.name === data.tier && t.priceIsFrom);
  const [lives, setLives] = useState([]);
  // NS-IL01-002/003: who pays and how, the channel, and the product's disclosure questions.
  const [details, setDetails] = useState({
    payerName: "",
    payerRelationship: "",
    mandateMethod: "",
    mandateInstitution: "",
    mandateAccount: "",
    mandateDebitDay: "",
    channel: "DIRECT",
    intermediaryCode: "",
    disclosures: {},
    occupation: "",
    proposerName: "",
    proposerRelationship: "",
    proposerRef: "",
    payerRef: "",
    beneficiaries: [],
  });
  const [questions, setQuestions] = useState([]);
  // Section 06 Term Life: the policy terms the product sells (empty when it sells none).
  const [termOptions, setTermOptions] = useState([]);
  const [termYears, setTermYears] = useState("");
  useEffect(() => {
    let live = true;
    if (!data.product) return undefined;
    request(session, "/portfolio/application-terms?product=" + encodeURIComponent(data.product))
      .then((r) => {
        if (!live) return;
        setTermOptions(r.data || []);
        setTermYears((r.data || []).length ? String(Math.max(...r.data)) : "");
      })
      .catch(() => live && setTermOptions([]));
    return () => {
      live = false;
    };
  }, [session, data.product]);
  // NS-IL01-003: payer and proposer relationships come from the insurer's eligible list.
  const [relationships, setRelationships] = useState([]);
  useEffect(() => {
    let live = true;
    request(session, "/portfolio/application-relationships")
      .then((r) => live && setRelationships(r.data || []))
      .catch(() => live && setRelationships([]));
    return () => {
      live = false;
    };
  }, [session]);
  // Resuming: what the draft already captured, read back from its checklist.
  const [resumed, setResumed] = useState(draft ? null : {});
  const [resumeError, setResumeError] = useState("");
  useEffect(() => {
    if (!draft) return undefined;
    let live = true;
    request(session, "/portfolio/applications/" + draft.id + "/checklist")
      .then(({ data: c }) => {
        if (!live) return;
        setDetails({
          payerName: c.payerName || "",
          payerRelationship: c.payerRelationship || "",
          mandateMethod: c.mandateMethod || "",
          mandateInstitution: c.mandateInstitution || "",
          // The account comes back masked; left blank, the one on record is kept.
          mandateAccount: "",
          mandateDebitDay: c.mandateDebitDay || "",
          channel: c.channel || "DIRECT",
          intermediaryCode: c.intermediaryCode || "",
          disclosures: Object.fromEntries((c.disclosures || []).filter((d) => d.answer).map((d) => [d.code, d.answer])),
          occupation: c.occupation || "",
          proposerName: c.proposerRef ? "" : c.proposerName || "",
          proposerRelationship: c.proposerRelationship || "",
          proposerRef: c.proposerRef || "",
          payerRef: c.payerRef || "",
          beneficiaries: (c.beneficiaries || []).map((b) => ({
            fullName: b.fullName,
            relationship: b.relationship,
            nationalId: b.nationalId || "",
            mobile: b.mobile || "",
            primary: b.primary,
          })),
        });
        setConsent(Boolean(c.declaredAt));
        setResumed(c);
      })
      .catch((error) => live && setResumeError(error.message));
    return () => {
      live = false;
    };
  }, [session, draft]);
  useEffect(() => {
    let live = true;
    if (!data.product) return undefined;
    request(session, "/portfolio/application-questions?product=" + encodeURIComponent(data.product))
      .then((r) => live && setQuestions(r.data || []))
      .catch(() => live && setQuestions([]));
    return () => {
      live = false;
    };
  }, [session, data.product]);
  const priced = useLifeQuote(
    session,
    "/portfolio/quote",
    { customerRef: data.customerRef, product: data.product, tier: data.tier, lives: livesBody(completeLives(lives)) },
    Boolean(ratedTier && data.customerRef && !draft),
  );
  // Blank party references and an empty beneficiary list are left out, so nothing on record is overwritten by them.
  const partyFields = {
    proposerRef: details.proposerRef || undefined,
    proposerName: details.proposerRef ? undefined : details.proposerName,
    payerRef: details.payerRef || undefined,
    payerName: details.payerRef ? undefined : details.payerName,
    beneficiaries: details.beneficiaries.filter((b) => b.fullName.trim()),
  };
  const save = (status) =>
    draft
      ? onSave({
          status,
          ...details,
          ...partyFields,
          // Bank details left blank on a debit order keep the ones on record.
          ...(details.mandateMethod === "DEBIT_ORDER" && !details.mandateAccount.trim() ? { mandateAccount: undefined } : {}),
          ...(details.mandateMethod === "DEBIT_ORDER" && !details.mandateInstitution.trim()
            ? { mandateInstitution: undefined }
            : {}),
          mandateDebitDay: details.mandateDebitDay || undefined,
          declarationAccepted: consent,
        })
      : onSave({
      ...data,
      status,
      ...details,
      ...partyFields,
      ...(termOptions.length && termYears ? { termYears: Number(termYears) } : {}),
      mandateDebitDay: details.mandateDebitDay || undefined,
      declarationAccepted: consent,
      ...(ratedTier ? { lives: livesBody(lives) } : {}),
    });
  return (
    <>
      <div className="stepper">
        {["Customer", "Protection", "Details", "Review"].map((s, i) => (
          <span
            className={
              "step " + (i === step ? "active" : i < step ? "complete" : "")
            }
            key={s}
          >
            <b>{i < step ? "✓" : i + 1}</b>
            {s}
          </span>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 3) setStep(step + 1);
          else save("Under review");
        }}
      >
        {draft && (
          <div className="notice">
            <Icon name="Info" />
            <p>
              <strong>Continuing draft {draft.id}.</strong> The customer and cover were priced on quote{" "}
              {draft.quoteRef || "for this application"} and stay as saved. Complete the details and the declaration,
              then submit.
              {resumeError && " The saved details could not be loaded: " + resumeError}
            </p>
          </div>
        )}
        {step === 0 && draft ? (
          <div className="detail-grid">
            {[
              ["Customer", data.name],
              ["Customer reference", data.customerRef || "Not linked"],
            ].map(([k, v]) => (
              <div className="detail-item" key={k}>
                <small>{k}</small>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
        ) : step === 1 && draft ? (
          <>
            <div className="detail-grid">
              {[
                ["Product", data.product],
                ...(data.tier ? [["Tier", data.tier]] : []),
                ["Cover", money(data.amount)],
                ["Monthly premium", money(data.premium)],
              ].map(([k, v]) => (
                <div className="detail-item" key={k}>
                  <small>{k}</small>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
            {draft.lives?.length > 0 && <LifeCoverList lives={draft.lives} />}
          </>
        ) : step === 0 ? (
          <>
            <h3>Who are we looking after?</h3>
            <p className="subtitle">
              Choose an existing customer to get started.
            </p>
            <Field label="Customer">
              <Select
                className="select"
                value={data.customerRef}
                onChange={(e) =>
                  setData({
                    ...data,
                    customerRef: e.target.value,
                    name: customers.find((c) => c.id === e.target.value)?.name || "",
                  })
                }
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.id}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="notice">
              <Icon name="UserRoundCheck" />
              <p>
                Customer details are linked from your directory.
              </p>
            </div>
          </>
        ) : step === 1 ? (
          <>
            <h3>A little protection goes a long way.</h3>
            <div className="field-grid">
              <Field label="Product">
                <Select
                  className="select"
                  value={data.product}
                  onChange={(e) => {
                    const p = products.find((p) => p.name === e.target.value);
                    const tier = defaultTier(p);
                    setLives([]);
                    setData({
                      ...data,
                      product: p.name,
                      tier: tier?.name || "",
                      premium: tier ? tier.premium : amountOf(p.premium),
                      amount: tier ? tier.cover : amountOf(p.cover),
                    });
                  }}
                >
                  {products.map((p) => (
                    <option key={p.name}>{p.name}</option>
                  ))}
                </Select>
              </Field>
              {tiers.length > 0 && (
                <Field label="Tier">
                  <Select
                    className="select"
                    value={data.tier}
                    onChange={(e) => {
                      const tier = tiers.find((t) => t.name === e.target.value);
                      if (!tier.priceIsFrom) setLives([]);
                      setData({ ...data, tier: tier.name, amount: tier.cover, premium: tier.premium });
                    }}
                  >
                    {tiers.map((tier) => (
                      <option key={tier.name} value={tier.name}>
                        {tierOptionLabel(tier, chosen)}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field
                label={
                  chosen?.coverUnit
                    ? "Benefit per " + chosen.coverUnit + " (BWP)"
                    : "Cover amount (BWP)"
                }
              >
                <input
                  type="number"
                  className="input"
                  min="1"
                  required
                  readOnly={Boolean(data.tier)}
                  title={data.tier ? "Set by the " + data.tier + " tier" : undefined}
                  value={data.amount}
                  onChange={(e) =>
                    setData({ ...data, amount: Number(e.target.value) })
                  }
                />
              </Field>
            </div>
            {ratedTier ? (
              <CoveredLives
                tier={ratedTier}
                mainName={data.name}
                lives={lives}
                onChange={setLives}
                {...priced}
              />
            ) : (
              <div className="quote-summary">
                <span>Monthly premium</span>
                <strong>
                  BWP {data.premium}
                  <small> / month</small>
                </strong>
                <p>
                  {data.tier
                    ? "Cover and premium are set by the " + data.tier + " tier."
                    : "Fixed premium. Changing cover does not calculate a real quote."}
                </p>
              </div>
            )}
          </>
        ) : step === 2 ? (
          <>
            <h3>Who pays, and what has been disclosed?</h3>
            <p className="subtitle">
              Leave the payer blank when the policyholder pays. A debit order needs the bank, account and debit day; an
              agent or broker sale needs the intermediary's code.
            </p>
            <div className="form-grid">
              {termOptions.length > 0 && !draft && (
                <label className="form-label">
                  <span>Policy term</span>
                  <select className="input" value={termYears} onChange={(e) => setTermYears(e.target.value)}>
                    {termOptions.map((t) => (
                      <option key={t} value={String(t)}>
                        {t} years (or to age 70 if earlier)
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="form-label">
                <span>Occupation of the life insured</span>
                <input
                  className="input"
                  value={details.occupation}
                  placeholder="e.g. Teacher"
                  maxLength={100}
                  onChange={(e) => setDetails({ ...details, occupation: e.target.value })}
                />
              </label>
              <label className="form-label">
                <span>Payer is an existing customer</span>
                <select
                  className="input"
                  value={details.payerRef}
                  onChange={(e) => setDetails({ ...details, payerRef: e.target.value })}
                >
                  <option value="">No: type the payer's name</option>
                  {customers
                    .filter((c) => c.id !== data.customerRef)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.id})
                      </option>
                    ))}
                </select>
              </label>
              {!details.payerRef && (
                <label className="form-label">
                  <span>Payer (if not the policyholder)</span>
                  <input
                    className="input"
                    value={details.payerName}
                    onChange={(e) => setDetails({ ...details, payerName: e.target.value })}
                  />
                </label>
              )}
              <label className="form-label">
                <span>Payer's relationship</span>
                <select
                  className="input"
                  value={details.payerRelationship}
                  onChange={(e) => setDetails({ ...details, payerRelationship: e.target.value })}
                >
                  <option value="">{details.payerName || details.payerRef ? "Choose" : "Not needed"}</option>
                  {relationships.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-label">
                <span>Proposer (if not the life insured)</span>
                <select
                  className="input"
                  value={details.proposerRef}
                  onChange={(e) => setDetails({ ...details, proposerRef: e.target.value })}
                >
                  <option value="">Not a customer, or the life insured</option>
                  {customers
                    .filter((c) => c.id !== data.customerRef)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.id})
                      </option>
                    ))}
                </select>
              </label>
              {!details.proposerRef && (
                <label className="form-label">
                  <span>Proposer's name</span>
                  <input
                    className="input"
                    value={details.proposerName}
                    onChange={(e) => setDetails({ ...details, proposerName: e.target.value })}
                  />
                </label>
              )}
              {(details.proposerRef || details.proposerName) && (
                <label className="form-label">
                  <span>Proposer's relationship</span>
                  <select
                    className="input"
                    value={details.proposerRelationship}
                    onChange={(e) => setDetails({ ...details, proposerRelationship: e.target.value })}
                  >
                    <option value="">Choose</option>
                    {relationships.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="form-label">
                <span>Payment mandate</span>
                <select
                  className="input"
                  value={details.mandateMethod}
                  onChange={(e) => setDetails({ ...details, mandateMethod: e.target.value })}
                >
                  <option value="">Not decided yet</option>
                  <option value="DEBIT_ORDER">Debit order</option>
                  <option value="MOBILE_WALLET">Mobile wallet</option>
                  <option value="CARD">Card</option>
                  <option value="BANK_EFT">Bank transfer</option>
                </select>
              </label>
              {details.mandateMethod === "DEBIT_ORDER" && (
                <>
                  <label className="form-label">
                    <span>Bank</span>
                    <input
                      className="input"
                      value={details.mandateInstitution}
                      onChange={(e) => setDetails({ ...details, mandateInstitution: e.target.value })}
                    />
                  </label>
                  <label className="form-label">
                    <span>Account number</span>
                    <input
                      className="input"
                      placeholder={
                        draft && resumed?.mandateAccount ? "On record " + resumed.mandateAccount + ": blank keeps it" : undefined
                      }
                      value={details.mandateAccount}
                      onChange={(e) => setDetails({ ...details, mandateAccount: e.target.value })}
                    />
                  </label>
                  <label className="form-label">
                    <span>Debit day</span>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      max="28"
                      value={details.mandateDebitDay}
                      onChange={(e) => setDetails({ ...details, mandateDebitDay: e.target.value })}
                    />
                  </label>
                </>
              )}
              <label className="form-label">
                <span>Channel</span>
                <select
                  className="input"
                  value={details.channel}
                  onChange={(e) => setDetails({ ...details, channel: e.target.value })}
                >
                  <option value="DIRECT">Direct</option>
                  <option value="BRANCH">Branch</option>
                  <option value="AGENT">Agent</option>
                  <option value="BROKER">Broker</option>
                  <option value="CALL_CENTRE">Call centre</option>
                </select>
              </label>
              {["AGENT", "BROKER"].includes(details.channel) && (
                <label className="form-label">
                  <span>Intermediary code</span>
                  <input
                    className="input"
                    value={details.intermediaryCode}
                    onChange={(e) => setDetails({ ...details, intermediaryCode: e.target.value })}
                  />
                </label>
              )}
            </div>
            <h3>Beneficiaries</h3>
            <p className="subtitle">Who is paid on a death claim. They are added to the policy when it is issued.</p>
            {details.beneficiaries.map((b, i) => (
              <div className="form-grid" key={i}>
                <label className="form-label">
                  <span>Full name</span>
                  <input
                    className="input"
                    value={b.fullName}
                    onChange={(e) =>
                      setDetails({
                        ...details,
                        beneficiaries: details.beneficiaries.map((x, j) => (j === i ? { ...x, fullName: e.target.value } : x)),
                      })
                    }
                  />
                </label>
                <label className="form-label">
                  <span>Relationship</span>
                  <select
                    className="input"
                    value={b.relationship}
                    onChange={(e) =>
                      setDetails({
                        ...details,
                        beneficiaries: details.beneficiaries.map((x, j) =>
                          j === i ? { ...x, relationship: e.target.value } : x,
                        ),
                      })
                    }
                  >
                    <option value="">Choose</option>
                    {relationships.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-label">
                  <span>Mobile</span>
                  <input
                    className="input"
                    value={b.mobile}
                    onChange={(e) =>
                      setDetails({
                        ...details,
                        beneficiaries: details.beneficiaries.map((x, j) => (j === i ? { ...x, mobile: e.target.value } : x)),
                      })
                    }
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    type="radio"
                    name="primary-beneficiary"
                    checked={Boolean(b.primary)}
                    onChange={() =>
                      setDetails({
                        ...details,
                        beneficiaries: details.beneficiaries.map((x, j) => ({ ...x, primary: j === i })),
                      })
                    }
                  />
                  Primary
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setDetails({ ...details, beneficiaries: details.beneficiaries.filter((_, j) => j !== i) })
                    }
                  >
                    Remove
                  </Button>
                </label>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              icon="Plus"
              onClick={() =>
                setDetails({
                  ...details,
                  beneficiaries: [
                    ...details.beneficiaries,
                    { fullName: "", relationship: "", nationalId: "", mobile: "", primary: !details.beneficiaries.length },
                  ],
                })
              }
            >
              Add beneficiary
            </Button>
            <h3>Disclosures</h3>
            {questions.map((q) => (
              <label className="form-label full" key={q.code}>
                <span>
                  {q.question}
                  {q.mandatory ? " *" : ""}
                </span>
                {q.answerType === "YES_NO" ? (
                  <select
                    className="input"
                    required={q.mandatory}
                    value={details.disclosures[q.code] || ""}
                    onChange={(e) =>
                      setDetails({ ...details, disclosures: { ...details.disclosures, [q.code]: e.target.value } })
                    }
                  >
                    <option value="">Choose</option>
                    <option value="NO">No</option>
                    <option value="YES">Yes</option>
                  </select>
                ) : (
                  <input
                    className="input"
                    maxLength={500}
                    required={q.mandatory}
                    value={details.disclosures[q.code] || ""}
                    onChange={(e) =>
                      setDetails({ ...details, disclosures: { ...details.disclosures, [q.code]: e.target.value } })
                    }
                  />
                )}
              </label>
            ))}
          </>
        ) : (
          <>
            <h3>Looking good. Let’s review.</h3>
            <div className="detail-grid">
              {[
                ["Customer", data.name],
                ["Product", data.product],
                ...(data.tier ? [["Tier", data.tier]] : []),
                ["Cover", money(data.amount)],
                [
                  "Monthly premium",
                  ratedTier && !draft
                    ? priced.quote
                      ? money(priced.quote.premium)
                      : "Set when you submit"
                    : money(data.premium),
                ],
              ].map(([k, v]) => (
                <div className="detail-item" key={k}>
                  <small>{k}</small>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
            {ratedTier && !draft && priced.error && (
              <p className="covered-lives-error" role="alert">
                {priced.error}
              </p>
            )}
            {ratedTier && !draft && priced.quote?.effectiveDate && (
              <p className="muted small">
                {/* NS-SH03-001: the explicit inputs the price was calculated on. */}
                Priced on {priced.quote.effectiveDate} in {priced.quote.currency} · rate version{" "}
                {priced.quote.rateTableVersion || "flat"} · product terms v{priced.quote.productVersion ?? "—"} · age basis{" "}
                {String(priced.quote.ageBasis || "").toLowerCase().replaceAll("_", " ")}
              </p>
            )}
            {ratedTier && <LifeCoverList lives={draft ? draft.lives : priced.quote?.lives} />}
            <label className="checkbox-label">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              The applicant has made the declaration: the answers above are true and complete, and this submission
              creates no cover until a policy is issued.
            </label>
          </>
        )}
        <div className="modal-footer">
          <Button
            type="button"
            variant="secondary"
            onClick={() => (step > 0 ? setStep(step - 1) : onCancel())}
          >
            {step > 0 ? "Back" : "Cancel"}
          </Button>
          {step < 3 && (
            <Button
              type="button"
              variant="secondary"
              disabled={Boolean(draft) && !resumed}
              onClick={() => save("Draft")}
            >
              Save draft
            </Button>
          )}
          {/* A resumed draft waits for its saved details, so nothing on record is overwritten with blanks. */}
          <Button type="submit" icon={step === 3 ? "Check" : "ArrowRight"} disabled={Boolean(draft) && !resumed}>
            {step === 3 ? "Submit application" : "Continue"}
          </Button>
        </div>
      </form>
    </>
  );
}
// Overview donut: share of policies per product, top three plus "Other products".
const mixColors = [
  ["green", "#789769"],
  ["purple", "#b5a3c8"],
  ["amber", "#dfcd9c"],
  ["blue", "#b2cbd9"],
];
function portfolioMix(policies) {
  const counts = new Map();
  for (const policy of policies) {
    const name = policy.product || "Unspecified";
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const slices = ranked.slice(0, 3).map(([name, count]) => ({ name, count }));
  const rest = ranked.slice(3).reduce((sum, [, count]) => sum + count, 0);
  if (rest) slices.push({ name: "Other products", count: rest });
  // Largest remainder, so the legend always adds up to 100%.
  const total = policies.length;
  const exact = slices.map((s) => (s.count * 100) / (total || 1));
  const percents = exact.map(Math.floor);
  let left = total ? 100 - percents.reduce((a, b) => a + b, 0) : 0;
  exact
    .map((value, i) => [value - percents[i], i])
    .sort((a, b) => b[0] - a[0])
    .forEach(([, i]) => left-- > 0 && percents[i]++);
  return slices.map((s, i) => ({
    ...s,
    percent: percents[i],
    color: mixColors[i][0],
    hex: mixColors[i][1],
  }));
}
function donutGradient(mix) {
  const total = mix.reduce((sum, s) => sum + s.count, 0);
  if (!total) return "light-dark(#eef0e8, #2a302b)";
  let at = 0;
  const stops = mix.map((s) => {
    const from = at;
    at += (s.count * 100) / total;
    // A thin white gap after each slice, as in the original design.
    const end = mix.length > 1 ? Math.max(from, at - 0.8) : at;
    return `${s.hex} ${from}% ${end}%, #fff ${end}% ${at}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}
function productTiers(product) {
  return product?.tiers || [];
}
// The product with the most live policies; the first in catalogue order on a tie.
function popularProduct(products) {
  return products.reduce((best, p) => (!best || p.count > best.count ? p : best), null);
}
// Headline figures are display strings ("from BWP 230"); this reads the number back out
// for a product that has no tiers.
function amountOf(text) {
  return Number(String(text ?? "").replace(/[^0-9]/g, "")) || 0;
}
function defaultTier(product) {
  const tiers = productTiers(product);
  return tiers.find((tier) => tier.popular) || tiers[0] || null;
}
function tierOptionLabel(tier, product) {
  const unit = product?.coverUnit ? " / " + product.coverUnit : "";
  const price = (tier.priceIsFrom ? "from BWP " : "BWP ") + tier.premium + "/mo";
  return tier.name + " · " + money(tier.cover) + unit + " · " + price;
}
function formatDob(value) {
  if (!value) return "-";
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
// Today's date in the insurer's business timezone (GET /public/config), e.g. "17 November 2026".
function todayLabel(timeZone) {
  const options = { day: "numeric", month: "long", year: "numeric" };
  try {
    return new Date().toLocaleDateString("en-GB", timeZone ? { ...options, timeZone } : options);
  } catch {
    // An unknown timezone name: fall back to the browser's own.
    return new Date().toLocaleDateString("en-GB", options);
  }
}
// A scheme's status as a label: its record's own, e.g. ACTIVE → Active.
function schemeStatus(s) {
  const status = s.status || "ACTIVE";
  return status.charAt(0) + status.slice(1).toLowerCase();
}
function kycLabel(c) {
  if (c.kycStatus === "VERIFIED") return "Verified";
  if (c.kycStatus === "FAILED") return "Failed";
  return "Pending";
}
// Why an EDD review cannot be recorded for this customer (spec BR-36: only PEP customers have one), or null.
function eddBlockedReason(c) {
  if (c.kycStatus !== "VERIFIED") return "KYC must be verified first";
  if (!c.eddStatus) return "EDD applies only to PEP customers";
  return null;
}
function eddLabel(c) {
  if (c.eddStatus === "VERIFIED") return "Verified";
  if (c.eddStatus === "PENDING") return "Pending";
  if (c.eddStatus === "FAILED") return "Failed";
  return null;
}
function CustomerDirectory({
  customers,
  search,
  setSearch,
  canReviewKyc,
  canReviewEdd,
  onEdd,
  onAddCustomer,
  onAddPolicy,
  onView,
  onKyc,
  onExport,
  session,
  profile,
  notify,
  onReload,
}) {
  const [selected, setSelected] = useState(() => new Set());
  // SH01 duplicate-review queue: possible duplicates and merges waiting for a data steward.
  const [reviewing, setReviewing] = useState(false);
  const [hidden, setHidden] = useState(() => new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const term = search.trim().toLowerCase();
  const rows = customers.filter(
    (c) =>
      !term ||
      [c.name, c.id, c.poiNumber, c.phone, c.email]
        .join(" ")
        .toLowerCase()
        .includes(term),
  );
  const picked = customers.filter((c) => selected.has(c.id));
  const single = picked.length === 1 ? picked[0] : null;
  const pendingKyc = picked.filter((c) => c.kycStatus !== "VERIFIED");
  // EDD applies only to customers flagged for it (politically exposed), and is recorded after KYC.
  const eddReady = picked.filter((c) => c.kycStatus === "VERIFIED" && ["PENDING", "FAILED"].includes(c.eddStatus));
  // A rejection always says why; the customer sees the reason.
  const askReason = (what) => {
    const reason = window.prompt("Why is " + what + " rejected? The customer is told this reason.");
    return reason && reason.trim() ? reason.trim() : null;
  };
  const allChecked = rows.length > 0 && rows.every((c) => selected.has(c.id));

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const toggle = (set, id) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };
  const run = (fn) => {
    setMenuOpen(false);
    fn();
  };
  const actions = [
    onAddCustomer && { label: "Add customer", icon: "UserPlus", onClick: onAddCustomer },
    onAddPolicy && {
      label: "New application",
      icon: "ShieldCheck",
      disabled: !single || single.kycStatus !== "VERIFIED",
      hint: !single
        ? "Select one customer"
        : single.kycStatus !== "VERIFIED"
          ? "KYC must be verified first"
          : null,
      onClick: () => onAddPolicy(single),
    },
    canReviewKyc && {
      label: "Mark KYC successful",
      icon: "BadgeCheck",
      disabled: !pendingKyc.length,
      hint: pendingKyc.length
        ? null
        : single?.kycStatus === "VERIFIED"
          ? "KYC is already verified"
          : "Select customers with pending KYC",
      onClick: async () => {
        for (const c of pendingKyc) await onKyc(c, "VERIFIED");
      },
    },
    canReviewKyc && {
      label: "Reject KYC",
      icon: "ShieldAlert",
      disabled: !single || single.kycStatus === "FAILED",
      hint: !single ? "Select one customer" : null,
      onClick: () => {
        const reason = askReason(single.name + "'s KYC");
        if (reason) onKyc(single, "FAILED", reason);
      },
    },
    canReviewEdd && {
      label: "Verify EDD review",
      icon: "ShieldCheck",
      disabled: !eddReady.length,
      hint: eddReady.length
        ? null
        : !single
          ? "Select PEP customers awaiting EDD"
          : eddBlockedReason(single) || "EDD is already verified",
      onClick: async () => {
        for (const c of eddReady) await onEdd(c, "VERIFIED");
      },
    },
    canReviewEdd && {
      label: "Reject EDD review",
      icon: "ShieldAlert",
      disabled: !single || single.kycStatus !== "VERIFIED" || !single.eddStatus || single.eddStatus === "FAILED",
      hint: !single
        ? "Select one customer"
        : eddBlockedReason(single) || (single.eddStatus === "FAILED" ? "EDD is already rejected" : null),
      onClick: () => {
        const reason = askReason(single.name + "'s EDD review");
        if (reason) onEdd(single, "FAILED", reason);
      },
    },
    {
      label: "View profile",
      icon: "ArrowUpRight",
      disabled: !single,
      hint: !single ? "Select one customer" : null,
      onClick: () => onView(single),
    },
    {
      label: picked.length ? `Export selected (${picked.length})` : "Export all",
      icon: "Download",
      onClick: () => onExport(picked.length ? picked : rows),
    },
  ].filter(Boolean);

  return (
    <div className="customer-directory">
      <div className="cd-heading">
        <h1>Customers</h1>
        <p>All registered policy customers</p>
      </div>
      <div className="cd-toolbar">
        <label className="cd-search">
          <Icon name="Search" small />
          <input
            aria-label="Search records"
            placeholder="Search by name, Proof of Identity (POI), or mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {session && (
          <button type="button" className="cd-action-btn" onClick={() => setReviewing(true)}>
            <Icon name="Users" small /> Duplicate review
          </button>
        )}
        <div className="cd-action" ref={menuRef}>
          <button
            type="button"
            className="cd-action-btn"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            Action <Icon name="ChevronDown" small />
          </button>
          {menuOpen && (
            <div className="cd-menu" role="menu">
              {!picked.length && (
                <div className="cd-menu-note">Tick a customer in the list to unlock the actions below.</div>
              )}
              {actions.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  role="menuitem"
                  className="cd-menu-item"
                  disabled={a.disabled}
                  title={a.hint || undefined}
                  onClick={() => run(a.onClick)}
                >
                  <Icon name={a.icon} small />
                  <span className="cd-menu-text">
                    <span>{a.label}</span>
                    {/* A greyed-out action says why, so it does not look broken. */}
                    {a.disabled && a.hint && <small className="cd-menu-hint">{a.hint}</small>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="cd-card">
        <div className="cd-scroll">
          <table className="cd-table">
            <thead>
              <tr>
                <th className="cd-check">
                  <input
                    type="checkbox"
                    aria-label="Select all customers"
                    checked={allChecked}
                    onChange={() =>
                      setSelected(
                        allChecked ? new Set() : new Set(rows.map((c) => c.id)),
                      )
                    }
                  />
                </th>
                <th>Customer ID</th>
                <th>Full name</th>
                <th>Proof of identity (POI)</th>
                <th>Date of birth</th>
                <th>Mobile</th>
                <th>Email</th>
                <th>KYC</th>
                <th>EDD review</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const masked = hidden.has(c.id);
                const kyc = kycLabel(c);
                const edd = eddLabel(c);
                return (
                  <tr key={c.id} className={selected.has(c.id) ? "selected" : ""}>
                    <td className="cd-check">
                      <input
                        type="checkbox"
                        aria-label={"Select " + c.name}
                        checked={selected.has(c.id)}
                        onChange={() => setSelected((s) => toggle(s, c.id))}
                      />
                    </td>
                    <td className="cd-strong">{c.id}</td>
                    <td>
                      <button
                        type="button"
                        className="cd-name"
                        onClick={() => onView(c)}
                      >
                        {c.name}
                      </button>
                    </td>
                    <td>
                      {c.poiNumber ? (
                        <span className="cd-poi">
                          <span className="cd-poi-number">
                            {masked
                              ? "•".repeat(Math.max(c.poiNumber.length - 3, 3)) +
                                c.poiNumber.slice(-3)
                              : c.poiNumber}
                          </span>
                          {c.poiType && <span className="cd-chip">{c.poiType}</span>}
                          <button
                            type="button"
                            className="cd-eye"
                            aria-label={(masked ? "Show " : "Hide ") + c.name + " POI number"}
                            onClick={() => setHidden((s) => toggle(s, c.id))}
                          >
                            <Icon name={masked ? "Eye" : "EyeOff"} small />
                          </button>
                        </span>
                      ) : (
                        <span className="cd-muted">-</span>
                      )}
                    </td>
                    <td>{formatDob(c.dateOfBirth)}</td>
                    <td className="cd-nowrap">{c.phone || "-"}</td>
                    <td className="cd-email" title={c.email || undefined}>
                      {c.email || "-"}
                    </td>
                    <td>
                      <span className={"cd-pill " + kyc.toLowerCase()}>{kyc}</span>
                    </td>
                    <td>
                      {edd ? (
                        <span className={"cd-pill " + edd.toLowerCase()}>{edd}</span>
                      ) : (
                        <span className="cd-muted">N/A</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && <Empty />}
        </div>
        <div className="cd-footer">
          <span>
            Showing {rows.length} of {customers.length} customers
          </span>
          {picked.length > 0 && (
            <button type="button" className="cd-clear" onClick={() => setSelected(new Set())}>
              {picked.length} selected · Clear
            </button>
          )}
        </div>
      </div>
      {reviewing && (
        <Drawer
          title="Duplicate review"
          description="Possible duplicate customers and merges waiting for a data steward."
          onClose={() => setReviewing(false)}
        >
          <DuplicateReview session={session} profile={profile} notify={notify} onMerged={onReload} />
        </Drawer>
      )}
    </div>
  );
}
/** Botswana's flag drawn inline: Windows shows flag emoji as plain letters. */
function BotswanaFlag() {
  return (
    <svg className="flag" viewBox="0 0 36 24" aria-hidden="true">
      <rect width="36" height="24" fill="#75AADB" />
      <rect y="9" width="36" height="6" fill="#fff" />
      <rect y="10" width="36" height="4" fill="#000" />
    </svg>
  );
}

const BW_DIAL_CODE = "+267";

/**
 * Phone number with the Botswana country code fixed in front. The customer types only the local number; the form
 * posts "+267 <number>" as phone, the same shape staff records already use.
 */
function BotswanaPhoneInput({ defaultValue = "", autoComplete }) {
  const [local, setLocal] = useState(() =>
    String(defaultValue || "").replace(/^\s*\+?267/, "").replace(/\D/g, ""),
  );
  return (
    <div className="phone-field">
      <span className="phone-prefix" title="Botswana">
        <BotswanaFlag />
        {BW_DIAL_CODE}
      </span>
      <input
        className="input"
        type="tel"
        inputMode="numeric"
        placeholder="71 234 567"
        required
        pattern="\d{7,8}"
        title="7 or 8 digits, without the +267 country code"
        aria-label="Phone number without country code"
        value={local}
        onChange={(e) => setLocal(e.target.value.replace(/\D/g, "").slice(0, 8))}
        autoComplete={autoComplete}
      />
      <input type="hidden" name="phone" value={local ? `${BW_DIAL_CODE} ${local}` : ""} />
    </div>
  );
}

// Identity number formats by document type (NS-SH01-001). The server checks the same rule (spaces are ignored); an
// Omang is taken as 9 digits until the insurer confirms its rule.
const POI_FORMATS = {
  Omang: { pattern: "\\s*(\\d\\s*){9}", title: "An Omang number is 9 digits", placeholder: "9 digits", inputMode: "numeric" },
  Passport: {
    pattern: "\\s*([A-Za-z0-9]\\s*){6,20}",
    title: "A passport number is 6 to 20 letters and digits",
    placeholder: "e.g. BW0123456",
    inputMode: "text",
  },
};

/** The customer details staff enter on Add customer; customer self sign-up asks for exactly the same. */
function CustomerFields({ values = {}, self = false }) {
  const [poiType, setPoiType] = useState(values.poiType || "Omang");
  const poiFormat = POI_FORMATS[poiType] || POI_FORMATS.Omang;
  return (
    <div className="field-grid">
      <Field label="Full name" full>
        <input
          name="name"
          className="input"
          placeholder="e.g. Dineo Motsumi"
          required
          minLength={2}
          defaultValue={values.name}
          autoComplete={self ? "name" : "off"}
        />
      </Field>
      <Field label="Email address">
        <input
          name="email"
          className="input"
          type="email"
          placeholder="dineo@example.com"
          required
          defaultValue={values.email}
          autoComplete={self ? "email" : "off"}
        />
      </Field>
      <Field label="Phone number">
        <BotswanaPhoneInput defaultValue={values.phone} autoComplete={self ? "tel-national" : "off"} />
      </Field>
      <Field label="Proof of identity type">
        <select
          name="poiType"
          className="input"
          value={poiType}
          onChange={(e) => setPoiType(e.target.value)}
          required
        >
          <option value="Omang">Omang</option>
          <option value="Passport">Passport</option>
        </select>
      </Field>
      <Field label="Proof of identity number">
        <input
          name="poiNumber"
          className="input"
          placeholder={poiFormat.placeholder}
          required
          pattern={poiFormat.pattern}
          title={poiFormat.title}
          inputMode={poiFormat.inputMode}
          maxLength={40}
          defaultValue={values.poiNumber}
        />
      </Field>
      <Field label="Date of birth">
        <input
          name="dateOfBirth"
          className="input"
          type="date"
          max={new Date().toISOString().slice(0, 10)}
          required
          defaultValue={values.dateOfBirth}
        />
      </Field>
      <Field label={self ? "Choose a username" : "Sign-in username"}>
        <input
          name="username"
          className="input"
          placeholder="e.g. dineo"
          required
          minLength={3}
          pattern="[A-Za-z0-9._\-]{3,100}"
          title="3–100 letters, numbers, dots, or hyphens"
          defaultValue={values.username}
          autoComplete={self ? "username" : "off"}
        />
      </Field>
      <Field label={self ? "Choose a password" : "Sign-in password"}>
        <input
          name="password"
          className="input"
          type="password"
          placeholder="At least 8 characters"
          required
          minLength={8}
          defaultValue={values.password}
          autoComplete="new-password"
        />
      </Field>
      <label className="form-label full">
        <span>
          <input type="checkbox" name="pep" defaultChecked={Boolean(values.pep)} />{" "}
          {self
            ? "I am a politically exposed person (PEP): my account needs an enhanced due diligence review before I choose cover"
            : "Politically exposed person (PEP): needs an enhanced due diligence review before choosing cover"}
        </span>
      </label>
    </div>
  );
}

function CustomerSignup({ onLogin }) {
  const [step, setStep] = useState("details");
  const [details, setDetails] = useState({});
  const [sentTo, setSentTo] = useState(null);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const sendCode = async (next) => {
    setError("");
    setBusy(true);
    try {
      const sent = await request(null, "/public/signup/otp", { method: "POST", body: next });
      setSentTo(sent.data);
      setOtp("");
      setStep("otp");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError("");
    setBusy(true);
    try {
      // The code answers this request's challenge, for the phone it was sent to.
      const created = await request(null, "/public/signup", {
        method: "POST",
        body: { ...details, challenge: sentTo?.challenge, otp },
      });
      const session = await openSession(created.data.loginUsername, details.password);
      await request(session, "/me");
      sessionStorage.setItem("nsure-session", JSON.stringify(session));
      onLogin(session);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand">
          <img className="brand-logo" src="/brand/nsure-life-logo-light.svg" alt="Nsure Life" />
        </div>
        <div className="login-story-content">
          <span className="demo-pill">Customer sign-up</span>
          <h1>
            Create your account,
            <br />
            and <em>request your cover.</em>
          </h1>
          <p>Tell us who you are, confirm your phone with a one-time code, and you are in.</p>
          <img className="login-photo" src="/products/term-life.jpg" alt="A family together at home" />
        </div>
        <p className="login-note">Nsure © 2026</p>
      </section>
      <section className="login-card">
        <div className="login-form signup-form">
          <a className="login-home-link" href="#/login/customer">← Back to sign-in</a>
          <ol className="signup-steps" aria-label="Sign-up steps">
            <li className={step === "details" ? "active" : "done"}>Your details</li>
            <li className={step === "otp" ? "active" : ""}>Verify</li>
          </ol>
          {step === "details" ? (
            <>
              <h2>Create your account</h2>
              <p className="subtitle">
                The same details our team takes when they add a customer. You sign in later with the username
                and password you choose here.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = Object.fromEntries(new FormData(e.currentTarget));
                  const next = { ...f, username: f.username.trim().toLowerCase(), pep: f.pep === "on" };
                  setDetails(next);
                  sendCode(next);
                }}
              >
                <CustomerFields values={details} self />
                {error && <p className="form-error">{error}</p>}
                <div className="login-hint">
                  <Icon name="Info" small /> New accounts start with pending verification (KYC).
                </div>
                <Button type="submit" icon="ArrowRight" disabled={busy}>
                  {busy ? "Sending code…" : "Send verification code"}
                </Button>
              </form>
            </>
          ) : (
            <>
              <h2>Enter your code</h2>
              <p className="subtitle">
                {sentTo?.demoCode
                  ? `Demo installation: no SMS is sent to ${sentTo?.sentTo || "your phone"}.`
                  : `We sent a 6-digit code to your phone ${sentTo?.sentTo || ""}.`}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  verify();
                }}
              >
                <Field label="Verification code">
                  <input
                    className="input otp-input"
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d{6}"
                    maxLength={6}
                    title="6 digits"
                    placeholder="••••••"
                    value={otp}
                    autoFocus
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </Field>
                {error && <p className="form-error">{error}</p>}
                <div className="login-hint">
                  <Icon name="Info" small />
                  {sentTo?.demoCode ? (
                    <span>
                      Demo installation: use the code <strong>{sentTo.demoCode}</strong>.
                    </span>
                  ) : (
                    "Enter the code sent to your phone. It works once, for a few minutes."
                  )}
                </div>
                <Button type="submit" icon="ArrowRight" disabled={busy || otp.length !== 6}>
                  {busy ? "Creating account…" : "Verify and create account"}
                </Button>
              </form>
              <div className="signup-otp-actions">
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setError("");
                    setStep("details");
                  }}
                >
                  ← Change details
                </button>
                <button type="button" className="link-button" disabled={busy} onClick={() => sendCode(details)}>
                  Resend code
                </button>
              </div>
            </>
          )}
          <p className="login-note">
            Already have an account? <a href="#/login/customer">Sign in</a>
          </p>
        </div>
      </section>
    </div>
  );
}

function CustomerForm({ onSave, onCancel }) {
  // A 409 means another customer already holds this identity number (NS-SH01-002). Staff either open that record
  // or say why this is a different person; the new record is then created referred for duplicate review.
  const [duplicate, setDuplicate] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (data) => {
    setBusy(true);
    try {
      await onSave(data);
    } catch (error) {
      if (error.status === 409) {
        setDuplicate({ data, message: error.message });
        setReason("");
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (duplicate) {
          save({ ...duplicate.data, duplicateReason: reason.trim() });
          return;
        }
        const f = Object.fromEntries(new FormData(e.currentTarget));
        save({ ...f, pep: f.pep === "on" });
      }}
    >
      <p className="subtitle">
        The username and password are what this customer uses on the Customer sign-in.
      </p>
      <div hidden={Boolean(duplicate)}>
        <CustomerFields />
      </div>
      {duplicate ? (
        <>
          <div className="notice" role="alert">
            <Icon name="ShieldAlert" />
            <p>
              <strong>Possible duplicate.</strong> {duplicate.message}
            </p>
          </div>
          <Field label="Why is this a different person?" full>
            <textarea
              className="input"
              required
              minLength={10}
              maxLength={400}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Omang card checked at the branch: the other record has a mistyped number"
            />
          </Field>
          <p className="muted small">
            The new record is created referred for duplicate review. A data steward reviews it in Data &amp;
            assistants → Duplicate parties, and merges the two records if they are the same person.
          </p>
        </>
      ) : (
        <div className="notice">
          <Icon name="Info" />
          <p>
            New profiles start with pending verification.
          </p>
        </div>
      )}
      <div className="modal-footer">
        <Button
          type="button"
          variant="secondary"
          onClick={() => (duplicate ? setDuplicate(null) : onCancel())}
        >
          {duplicate ? "Back to the details" : "Cancel"}
        </Button>
        <Button type="submit" icon="UserPlus" disabled={busy}>
          {duplicate ? "Create and refer for review" : "Add customer"}
        </Button>
      </div>
    </form>
  );
}
function Detail({
  entity,
  record: r,
  customers = [],
  policies,
  claims,
  onGo,
  onIssue,
  notify,
  session,
  profile,
  onPolicyUpdated,
  onApplicationUpdated,
  onClaimUpdated,
  canReviewKyc,
  onKyc,
  onAddPolicy,
  canReviewEdd,
  onEdd,
  onResume,
  onCustomerUpdated,
}) {
  const [tab, setTab] = useState("Overview");
  // Policies, claims, applications and customer reviews have a real workflow log; the rest show only their own dates.
  const historyType =
    entity === "policy"
      ? "policy"
      : entity === "claim"
        ? "claim"
        : entity === "application"
          ? "application"
          : entity === "customer"
            ? ["kyc", "edd"]
            : null;
  const workflowRecord = entity === "policy" || entity === "claim";
  // Records belong to a customer by reference, never by name: two customers can share a name (AT-SH11-01).
  const linkedPolicies = entity === "customer" ? policies.filter((p) => p.customerRef && p.customerRef === r.id) : [];
  const linkedClaims = linkedPolicies.length
    ? (claims || []).filter((c) => linkedPolicies.some((p) => p.id === c.policy))
    : [];
  // Interactions and complaints (NS-SH01-006): the customer's service cases, by reference, for those who read cases.
  const [cases, setCases] = useState([]);
  useEffect(() => {
    if (entity !== "customer" || !can(profile, "READ_SERVICE_CASE")) return undefined;
    let live = true;
    request(session, "/service/cases")
      .then((res) => live && setCases((res.data || []).filter((c) => c.customerRef === r.id)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [entity, session, profile, r.id]);
  // An application's identity check is its customer's KYC; a policy can only be issued once it is verified.
  const applicant =
    entity === "application" && r.customerRef ? customers.find((c) => c.id === r.customerRef) : null;
  const identityStatus = applicant ? kycLabel(applicant) : "Verified";
  // The server refuses cover while a PEP customer's enhanced due diligence is open or rejected (BR-25), so issue
  // waits for it here too: the reason is shown, and a reviewer can clear it without leaving the application.
  const eddBlocking = Boolean(applicant && ["PENDING", "FAILED"].includes(applicant.eddStatus));
  // Extra policy fields the insurer's active configuration requires for this product, filled in before issue.
  const issuing = entity === "application" && r.status === "Ready to issue";
  const { form: issueForm, error: issueFormError } = usePolicyForm(session, issuing ? r.product : null);
  const [issueValues, setIssueValues] = useState({});
  const missingRequired = (issueForm?.fields || []).filter(
    (f) => f.required && [undefined, null, ""].includes(issueValues[f.key]),
  );
  return (
    <>
      <div className="detail-title">
        <span className="avatar large">{initials(r.name)}</span>
        <div>
          <span className="person-sub">
            {r.id} ·{" "}
            {entity === "scheme"
              ? "Group scheme"
              : entity === "customer"
                ? "Customer profile"
                : r.product}
          </span>
          <div>
            <Badge>{r.status || "Active"}</Badge>
          </div>
        </div>
      </div>
      <div className="tabs">
        {/* Documents only where the record has real documents; an application's evidence is on its overview. */}
        {[
          "Overview",
          // SH01 customer workspace: KYC checklist, contacts with independent approval, relationship editor.
          ...(entity === "customer" ? ["Identity & KYC", "Contacts", "Relationships"] : []),
          ...(["customer", "policy", "claim"].includes(entity) ? ["Documents"] : []),
          "Activity",
        ].map((t) => (
          <button
            key={t}
            className={"filter-tab " + (tab === t ? "active" : "")}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Overview" ? (
        <>
          {entity === "customer" ? (
            <>
              <div className="detail-grid">
                {[
                  ["Email", r.email],
                  ["Phone", r.phone],
                  ["Verification", r.kycStatus === "VERIFIED" ? "KYC success" : r.status],
                  ["EDD review", eddLabel(r) || "Not required"],
                  ...(r.kycRejectionReason ? [["KYC rejected because", r.kycRejectionReason]] : []),
                  ...(r.eddRejectionReason ? [["EDD rejected because", r.eddRejectionReason]] : []),
                  ["Sign-in", r.loginUsername || "No login yet"],
                  ["Linked policies", linkedPolicies.length],
                  [
                    "Premium in force",
                    money(
                      linkedPolicies
                        .filter((p) => IN_COVER_STATES.includes(p.status))
                        .reduce((sum, p) => sum + Number(p.premium || 0), 0),
                    ) + " / month",
                  ],
                  ...(r.duplicateReview ? [["Referred for duplicate review", r.duplicateReview]] : []),
                ].map(([k, v]) => (
                  <div className="detail-item" key={k}>
                    <small>{k}</small>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
              <h3 className="section-title">Their protection</h3>
              {linkedPolicies
                .map((p) => (
                  <div className="linked-record" key={p.id}>
                    <Icon name="ShieldCheck" />
                    <div>
                      <strong>
                        {p.product}
                        {p.tier ? " · " + p.tier : ""}
                      </strong>
                      <small>
                        {p.id} · {money(p.amount)}
                      </small>
                    </div>
                    <Badge>{p.status}</Badge>
                  </div>
                ))}
              {linkedPolicies.length === 0 && (
                <Empty
                  text="A fresh start"
                  detail="This customer has no policies yet."
                />
              )}
              {cases.length > 0 && (
                <>
                  <h3 className="section-title">Service requests and complaints</h3>
                  {cases.map((c) => (
                    <div className="linked-record" key={c.ref}>
                      <Icon name="Headset" />
                      <div>
                        <strong>{c.subject || c.category}</strong>
                        <small>
                          {c.ref} · {String(c.caseType || "").toLowerCase()} · opened{" "}
                          {String(c.openedAt || "").slice(0, 10)}
                        </small>
                      </div>
                      <Badge>{c.status}</Badge>
                    </div>
                  ))}
                </>
              )}
              <CustomerView360 session={session} customer={r} key={"view-" + r.id + (r.version ?? "")} />
              {linkedClaims.length > 0 && (
                <>
                  <h3 className="section-title">Their claims</h3>
                  {linkedClaims.map((c) => (
                    <div className="linked-record" key={c.id}>
                      <Icon name="HeartHandshake" />
                      <div>
                        <strong>{c.type || c.product}</strong>
                        <small>
                          {c.id} · {c.policy} · {money(c.amount)}
                        </small>
                      </div>
                      <Badge>{c.status}</Badge>
                    </div>
                  ))}
                </>
              )}
              <div className="detail-actions">
                {canReviewKyc && r.kycStatus !== "VERIFIED" && (
                  <Button icon="BadgeCheck" onClick={() => onKyc(r, "VERIFIED")}>
                    KYC success
                  </Button>
                )}
                {canReviewKyc && r.kycStatus !== "FAILED" && (
                  <ReasonAction label="Reject KYC" onConfirm={(reason) => onKyc(r, "FAILED", reason)} />
                )}
                {canReviewEdd && r.kycStatus === "VERIFIED" && ["PENDING", "FAILED"].includes(r.eddStatus) && (
                  <Button icon="ShieldCheck" onClick={() => onEdd(r, "VERIFIED")}>
                    Verify EDD
                  </Button>
                )}
                {canReviewEdd && r.kycStatus === "VERIFIED" && r.eddStatus === "PENDING" && (
                  <ReasonAction label="Reject EDD" onConfirm={(reason) => onEdd(r, "FAILED", reason)} />
                )}
                {onAddPolicy && (
                  <Button
                    icon="ShieldCheck"
                    disabled={r.kycStatus !== "VERIFIED"}
                    onClick={() => onAddPolicy(r)}
                  >
                    New application
                  </Button>
                )}
              </div>
            </>
          ) : entity === "scheme" ? (
            <>
              <div className="detail-grid">
                {[
                  ["Members", r.members],
                  ["Monthly premium", money(r.premium)],
                  ["Renewal", r.renewal],
                  ["Sector", r.sector || "Not recorded"],
                ].map(([k, v]) => (
                  <div className="detail-item" key={k}>
                    <small>{k}</small>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
              <p className="muted">
                Members are listed in group scheme administration, for those who hold the scheme permission.
              </p>
            </>
          ) : (
            <>
              <div className="detail-grid">
                {[
                  ["Product", r.product],
                  [
                    entity === "collection" ? "Amount due" : "Cover / benefit",
                    money(r.amount),
                  ],
                  ["Reference date", r.date],
                  [
                    "Monthly premium",
                    r.premium ? money(r.premium) : "Not applicable",
                  ],
                ].map(([k, v]) => (
                  <div className="detail-item" key={k}>
                    <small>{k}</small>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
              {r.lives?.length > 0 && (
                <>
                  <h3 className="section-title">Covered lives · {r.rateTableVersion}</h3>
                  <LifeCoverList lives={r.lives} />
                </>
              )}
              {entity === "application" && (
                <ApplicationChecklist
                  session={session}
                  application={r}
                  profile={profile}
                  notify={notify}
                  onChanged={onApplicationUpdated}
                />
              )}
              {(entity === "application" || entity === "policy") && r.quoteRef && (
                <QuotePanel session={session} quoteRef={r.quoteRef} profile={profile} notify={notify} />
              )}
              {entity === "policy" && (
                <PolicyAttributesPanel
                  session={session}
                  policyRef={r.id}
                  canEdit={can(profile, "UPDATE_POLICY")}
                  notify={notify}
                />
              )}
              {entity === "policy" && (
                <PolicyWorkflowPanel
                  session={session}
                  policy={r}
                  canManage={can(profile, "UPDATE_POLICY")}
                  profile={profile}
                  onUpdated={onPolicyUpdated}
                  notify={notify}
                />
              )}
              {entity === "claim" && (
                <ClaimWorkflowPanel
                  session={session}
                  claim={r}
                  profile={profile}
                  onUpdated={onClaimUpdated}
                  notify={notify}
                />
              )}
              {issuing && (
                <>
                  <CustomFieldInputs form={issueForm} values={issueValues} onChange={setIssueValues} />
                  {issueFormError && (
                    <p className="subtitle">Extra policy fields could not be loaded: {issueFormError}</p>
                  )}
                  {missingRequired.length > 0 && (
                    <p className="subtitle">
                      Fill in {missingRequired.map((f) => f.label).join(", ")} to issue this policy.
                    </p>
                  )}
                  {eddBlocking && (
                    <p className="subtitle">
                      {applicant.name}'s enhanced due diligence review{" "}
                      {applicant.eddStatus === "FAILED" ? "was rejected" : "is still pending"}. It must be verified
                      before this policy can be issued.
                    </p>
                  )}
                </>
              )}
              <div className="detail-actions">
                {issuing && eddBlocking && canReviewEdd && onEdd && applicant.kycStatus === "VERIFIED" && (
                  <Button variant="secondary" icon="BadgeCheck" onClick={() => onEdd(applicant, "VERIFIED")}>
                    Verify EDD
                  </Button>
                )}
                {issuing && onIssue && (
                  <Button
                    icon="ShieldCheck"
                    disabled={identityStatus !== "Verified" || eddBlocking || missingRequired.length > 0}
                    onClick={() =>
                      onIssue(
                        r,
                        issueForm?.formVersionId
                          ? { formVersionId: issueForm.formVersionId, customAttributes: cleanValues(issueValues) }
                          : {},
                      )
                    }
                  >
                    Issue policy
                  </Button>
                )}
                {entity === "application" && r.status === "Draft" && onResume && (
                  <Button icon="FilePlus2" onClick={() => onResume(r)}>
                    Continue application
                  </Button>
                )}
                {entity === "application" && r.status !== "Draft" && can(profile, "READ_UNDERWRITING") && (
                  <Button variant="secondary" icon="FileSearch" onClick={() => onGo("underwriting")}>
                    Open underwriting
                  </Button>
                )}
                {entity === "policy" && (
                  <Button
                    variant="secondary"
                    icon="Download"
                    onClick={() => {
                      downloadCSV(r.id + "-summary.csv", [
                        ["Policy", "Customer", "Product", "Cover", "Status"],
                        [r.id, r.name, r.product, r.amount, r.status],
                      ]);
                      notify("Policy summary exported.");
                    }}
                  >
                    Export summary
                  </Button>
                )}
              </div>
              {!workflowRecord && (
                <p className="muted small">
                  Open the record's own workspace to act on it.
                </p>
              )}
            </>
          )}
        </>
      ) : tab === "Identity & KYC" && entity === "customer" ? (
        <PartyKyc session={session} profile={profile} notify={notify} customer={r} onChanged={onCustomerUpdated} />
      ) : tab === "Contacts" && entity === "customer" ? (
        <PartyContacts session={session} profile={profile} notify={notify} customer={r} onChanged={onCustomerUpdated} />
      ) : tab === "Relationships" && entity === "customer" ? (
        <PartyRelationships session={session} profile={profile} notify={notify} customer={r} />
      ) : tab === "Documents" && entity === "claim" ? (
        <ClaimDocuments
          session={session}
          claim={r}
          basePath={"/portfolio/claims/" + r.id + "/documents"}
          canUpload={["UPDATE_CLAIM", "CREATE_CLAIM", "ASSESS_CLAIM"].some((code) => can(profile, code))}
          canGenerate={["UPDATE_CLAIM", "CREATE_CLAIM", "ASSESS_CLAIM"].some((code) => can(profile, code))}
          onUploaded={(documents) => onClaimUpdated({ ...r, documents })}
          notify={notify}
        />
      ) : tab === "Documents" && entity === "policy" ? (
        <PolicyDocuments
          session={session}
          policy={r}
          basePath={"/portfolio/policies/" + r.id + "/documents"}
          canGenerate={can(profile, "CREATE_POLICY") || can(profile, "UPDATE_POLICY")}
          onUploaded={(documents) => onPolicyUpdated({ ...r, documents })}
          notify={notify}
        />
      ) : tab === "Documents" && entity === "customer" ? (
        <CustomerDocuments
          session={session}
          customer={r}
          policies={linkedPolicies}
          notify={notify}
          canUpload={can(profile, "UPDATE_CUSTOMER")}
        />
      ) : historyType ? (
        <WorkflowTimeline session={session} type={historyType} refId={r.id} version={JSON.stringify(r)} />
      ) : (
        <div className="timeline">
          {/* Only what the record itself holds: when it was created and where it stands now. */}
          {[
            ["Record created", r.date || "Date not recorded", "Record entered into the workspace."],
            ["Current state", r.status || "Active", "Latest position."],
          ].map(([t, d, s]) => (
            <div className="timeline-item" key={t}>
              <span />
              <div>
                <strong>{t}</strong>
                <small>{d}</small>
                <p>{s}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
// Customer 360 documents (NS-SH01-006): the identity evidence the customer sent for KYC, and the documents filed on
// this customer's own policies, found by reference.
function CustomerDocuments({ session, customer, policies, notify, canUpload = false }) {
  const [uploadType, setUploadType] = useState("Omang");
  const rows = policies.flatMap((p) =>
    (p.documents || []).map((d) => ({ ...d, policyRef: p.id, product: p.product })),
  );
  const [identity, setIdentity] = useState([]);
  useEffect(() => {
    let live = true;
    request(session, "/portfolio/customers/" + customer.id + "/identity-documents")
      .then((r) => live && setIdentity(r.data || []))
      .catch(() => live && setIdentity([]));
    return () => {
      live = false;
    };
  }, [session, customer.id]);
  const open = async (d) => {
    try {
      const url = URL.createObjectURL(
        await fetchFile(session, "/portfolio/customers/" + customer.id + "/identity-documents/" + d.id),
      );
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      notify?.(error.message, "error");
    }
  };
  return (
    <>
      <h3 className="section-title">Identity evidence</h3>
      {identity.length ? (
        identity.map((d) => (
          <div className="linked-record" key={"id-" + d.id}>
            <span className="stat-icon green">
              <Icon name="BadgeCheck" />
            </span>
            <div>
              <strong>{d.documentType}</strong>
              <small>
                {d.fileName} · sent {String(d.uploadedAt || "").slice(0, 10)} by {d.uploadedBy}
              </small>
            </div>
            {d.id ? (
              <Button variant="secondary" icon="Eye" onClick={() => open(d)}>
                Open
              </Button>
            ) : (
              <Badge>{d.state === "QUARANTINED" ? "Being checked" : "Not accepted"}</Badge>
            )}
          </div>
        ))
      ) : (
        <p className="muted small">The customer has not sent identity evidence yet.</p>
      )}
      {identity.some((d) => !d.id) && (
        <p className="muted small">
          Uploads wait in quarantine (Operations &gt; Documents) until someone other than the uploader releases them.
        </p>
      )}
      {canUpload && (
        <label className="party-upload">
          <span>Upload identity evidence the customer handed in</span>
          <select value={uploadType} onChange={(e) => setUploadType(e.target.value)} aria-label="Document type">
            <option>Omang</option>
            <option>Passport</option>
            <option>Proof of address</option>
          </select>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                const r = await uploadFile(session, "/portfolio/customers/" + customer.id + "/identity-documents", file, {
                  type: uploadType,
                });
                setIdentity(r.data || []);
                notify?.("Received. It waits in quarantine until someone else releases it.");
              } catch (error) {
                notify?.(error.message, "error");
              }
            }}
          />
        </label>
      )}
      <h3 className="section-title">Policy documents</h3>
      <p className="subtitle">
        Documents filed on {customer.name}'s policies. The KYC review (now {kycLabel(customer).toLowerCase()}) and
        each upload are on the Activity tab.
      </p>
      {rows.length ? (
        rows.map((d) => (
          <div className="linked-record" key={d.policyRef + "-" + d.id}>
            <span className="stat-icon blue">
              <Icon name="FileText" />
            </span>
            <div>
              <strong>{String(d.type || "Document").replaceAll("_", " ").toLowerCase()}</strong>
              <small>
                {d.policyRef} · {d.fileName}
                {d.uploadedAt ? " · " + String(d.uploadedAt).slice(0, 10) : ""}
              </small>
            </div>
            <Badge>{d.status || "Filed"}</Badge>
          </div>
        ))
      ) : (
        <Empty text="No documents yet" detail="Documents appear here once they are filed on this customer's policies." />
      )}
      {rows.length > 0 && <p className="muted small">Open the policy to view or download a document.</p>}
    </>
  );
}
