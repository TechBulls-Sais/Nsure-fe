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
} from "lucide-react";
const Icons = {
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
import { request } from "./api";
import AssistantStudio from "./AssistantStudio";
import AccessAdmin from "./AccessAdmin";
import CustomerPortal from "./CustomerPortal";
import {
  CLAIM_STATES,
  ClaimLodgeForm,
  ClaimWorkflowPanel,
  POLICY_STATES,
  PolicyWorkflowPanel,
  ReasonAction,
  WorkflowTimeline,
} from "./Workflow";
import LandingPage from "./LandingPage";
import {
  AnimatedWorkspace,
  AnimatedMetric,
  ShimmerText,
  IntelligenceOrb,
  BorderBeam,
  ActionSearch,
  MotionToggle,
} from "./ui/animated";


const navItems = [
  ["overview", "Overview", "LayoutDashboard"],
  ["customers", "Customers", "Users"],
  ["applications", "Applications", "FilePlus2"],
  ["policies", "Policies", "ShieldCheck"],
  ["claims", "Claims", "HeartHandshake"],
  ["schemes", "Group schemes", "Building2"],
  ["products", "Products", "Layers3"],
  ["product-config", "Product studio", "Settings2"],
  ["rate-tables", "Rate tables", "Table2"],
  ["collections", "Collections", "Wallet"],
  ["assistant", "AI assistant", "Sparkles"],
];
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
  const color = /force|verified|ready|settled|approved|active|paid|issued/.test(
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
  const ref = useRef();
  useEffect(() => {
    const prev = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const initialInput = ref.current?.querySelector(
      'input:not([aria-hidden="true"]),[role="combobox"],textarea',
    );
    (initialInput || ref.current)?.focus();
    const onKey = (e) => {
      // A portaled select owns keyboard focus until it closes.
      if (
        e.defaultPrevented ||
        document.querySelector("[data-nsure-select-popup]")
      )
        return;
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const els = ref.current.querySelectorAll(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        );
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      prev?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        tabIndex={-1}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">Nsure</span>
            <h2>{title}</h2>
          </div>
          <button
            className="icon-btn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <Icon name="X" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </section>
    </div>
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
      <div className="stat-trend">
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
  const customerLogin = audience === "customer";
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
        <p className="login-note">Nsure © 2026 · Frontend showcase</p>
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
                setError("");
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
                setError("");
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
              const next = { username: email.trim().toLowerCase(), password };
              try {
                const me = await request(next, "/me");
                if (customerLogin && !me.data.customerPortal) {
                  setError("This form is for customers. Use the username and password saved on the customer.");
                  return;
                }
                // Customer accounts sign in on the customer portal only, never the operations workspace.
                if (!customerLogin && me.data.customerPortal) {
                  setError("This is a customer account. Choose Customer above to sign in to the customer portal.");
                  return;
                }
                sessionStorage.setItem("nsure-session", JSON.stringify(next));
                onLogin(next);
              } catch (err) {
                setError(err.status === 401 ? "Username or password is incorrect." : err.message);
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
                placeholder={customerLogin ? "customer" : "admin"}
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
                ? "Use the username and password set when the customer was added. The sample login is customer / password."
                : "Staff username is admin or onboarding. Password is password."}
            </div>
            <Button type="submit" icon="ArrowRight" disabled={busy}>
              {busy ? "Signing in…" : customerLogin ? "Sign in" : "Enter workspace"}
            </Button>
          </form>
          <div className="notice">
            <Icon name="ShieldCheck" />
            <p>
              <strong>A safe space to explore.</strong>
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

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("nsure-session") || "null");
    } catch {
      return null;
    }
  });
  const loggedIn = Boolean(session);
  const [page, setPage] = useState(() => location.hash.slice(2) || "overview");
  const [profile, setProfile] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState("");
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
  const [shop, setShop] = useState(null);
  const [notifications, setNotifications] = useState(true);
  const [compact, setCompact] = useState(false);
  const [period, setPeriod] = useState("Last 6 months");
  const notify = (msg) => setToast(msg);
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
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);
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
    sessionStorage.removeItem("nsure-session");
    setSession(null);
    setProfile(null);
    setShop(null);
    setModal(null);
    go("home");
  };
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
            "/portfolio/customers",
            "/portfolio/applications",
            "/portfolio/policies",
            "/portfolio/claims",
            "/portfolio/products",
            "/portfolio/schemes",
            "/portfolio/receipts",
            "/portfolio/product-configs",
          ].map((path) =>
            // Each list needs its own read permission; a role without it sees an empty list.
            request(session, path).catch((error) => {
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
        else setToast(error.message);
      }
    })();
    return () => {
      active = false;
    };
  }, [session]);
  const menuItems = profile?.superAdmin
    ? [...navItems, ["access", "Access", "ShieldCheck"]]
    : navItems;
  const activeName =
    menuItems.find((n) => n[0] === page)?.[1] ||
    (page === "settings" ? "Settings" : "Overview");
  const visible = (rows) =>
    rows.filter(
      (r) =>
        (filter === "All" || r.status === filter) &&
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
      });
      setCustomers((rows) => rows.map((row) => (row.id === customer.id ? updated.data : row)));
      notify(
        customer.name + " " + review.toUpperCase() +
          (decision === "VERIFIED" ? " review is verified." : " review is rejected."),
      );
      return updated.data;
    } catch (error) {
      notify(error.message);
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
      request(session, "/portfolio/customers").then((r) => setCustomers(r.data)).catch(() => {});
      request(session, "/portfolio/receipts").then((r) => setReceipts(r.data)).catch(() => {});
    }
  };
  const claimUpdated = (record) => {
    setClaims((rows) => rows.map((row) => (row.id === record.id ? record : row)));
    setModal({ type: "detail", entity: "claim", record });
  };
  const pendingPolicies = policies.filter((p) => p.status === "Pending Payment");
  const issue = async (record) => {
    let created;
    try {
      created = await request(session, "/portfolio/policies", {
        method: "POST",
        body: {
          name: record.name,
          product: record.product,
          tier: record.tier || undefined,
          amount: record.amount,
          premium: record.premium || 0,
          status: "Active",
          // The application's other lives carry over and are re-priced at issue (R-18).
          ...(record.lives?.length ? { lives: otherLives(record) } : {}),
        },
      });
      await request(session, "/portfolio/applications/" + record.id, {
        method: "PUT",
        body: { status: "Issued" },
      });
    } catch (error) {
      // The backend refuses a policy until the customer's KYC is verified; say so instead of failing silently.
      notify(error.message);
      return;
    }
    setPolicies((p) => [created.data, ...p]);
    setApplications((a) =>
      a.map((x) => (x.id === record.id ? { ...x, status: "Issued" } : x)),
    );
    setCustomers((c) =>
      c.map((x) => (x.name === record.name ? { ...x, policies: x.policies + 1 } : x)),
    );
    setModal({ type: "detail", entity: "policy", record: created.data });
    notify("Policy issued and saved.");
  };
  if (!loggedIn) {
    const publicPages = ["overview", "home", "cover", "how-it-works", "questions"];
    if (publicPages.includes(page)) return <LandingPage section={page} />;
    return <Login
      key={page}
      initialAudience={page === "login/customer" ? "customer" : "staff"}
      onAudienceChange={(audience) => go("login/" + audience)}
      onLogin={(next) => { setSession(next); go("overview"); }}
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
  function RecordsTable({ rows, type = "application", short = false }) {
    return (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{type === "claim" ? "Claimant" : "Customer"}</th>
              <th>Product</th>
              {type === "policy" && <th>Tier</th>}
              {!short && (
                <th>
                  {type === "collection" ? "Amount due" : "Cover / benefit"}
                </th>
              )}
              <th>Status</th>
              {!short && <th>{type === "policy" ? "Inception" : "Created"}</th>}
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Person name={r.name} sub={r.id} />
                </td>
                <td>{r.product}</td>
                {type === "policy" && (
                  <td>
                    {r.tier ? (
                      <span className={"tier-pill " + r.tier.toLowerCase()}>{r.tier}</span>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                )}
                {!short && <td className="amount">{money(r.amount)}</td>}
                <td>
                  <Badge>{r.status}</Badge>
                </td>
                {!short && <td className="muted">{r.date}</td>}
                <td>
                  <button
                    className="icon-btn"
                    aria-label={"View " + r.id}
                    onClick={() => detail(type, r)}
                  >
                    <Icon name="ArrowUpRight" small />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty />}
      </div>
    );
  }
  function Overview() {
    const heights =
      period === "Last 6 months"
        ? [43, 59, 51, 76, 67, 89]
        : [32, 49, 61, 56, 81, 94];
    const productMix = portfolioMix(policies);
    return (
      <>
        <Heading
          title="A good day to make a difference. 👋"
          subtitle="Here’s what’s happening across your business today."
        >
          <span className="date-chip">
            <Icon name="CalendarDays" small /> 29 September 2026
          </span>
          <Button icon="Plus" onClick={() => setModal({ type: "application" })}>
            New application
          </Button>
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
            <Button
              variant="secondary"
              icon="ArrowRight"
              onClick={() => go("policies")}
            >
              Explore your portfolio
            </Button>
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
            <button onClick={() => go("applications")}>
              Review applications <Icon name="ArrowUpRight" small />
            </button>
            <button onClick={() => go("product-config")}>
              Design a product <Icon name="ArrowUpRight" small />
            </button>
            <button onClick={() => go("assistant")}>
              Ask your copilot <Icon name="Sparkles" small />
            </button>
          </div>
        </section>
        <div className="stat-grid">
          <Stat
            label="Active policies"
            value={policies.filter((policy) => policy.status === "Active").length}
            change="8.2%"
            icon="ShieldCheck"
          />
          <Stat
            label="Premium collected"
            value="BWP 2.84m"
            change="12.6%"
            icon="Wallet"
            color="purple"
          />
          <Stat
            label="New applications"
            value={applications.length}
            change="16.4%"
            icon="FilePlus2"
            color="blue"
          />
          <Stat
            label="Claims settled"
            value="94.2%"
            change="3.1%"
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
        <section className="quick-actions">
          {[
            [
              "New application",
              "Start a new chapter",
              "FilePlus2",
              "application",
              "green",
            ],
            [
              "Register a claim",
              "Be there when it matters",
              "HeartHandshake",
              "claim",
              "purple",
            ],
            [
              "Add a customer",
              "Welcome someone new",
              "UserPlus",
              "customer",
              "blue",
            ],
            [
              "Ask Nsure AI",
              "A little help goes a long way",
              "Sparkles",
              "assistant",
              "amber",
            ],
          ].map(([title, sub, icon, action, color]) => (
            <button
              key={title}
              className="quick-action"
              onClick={() =>
                action === "assistant"
                  ? go("assistant")
                  : setModal({ type: action })
              }
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
        <div className="bottom-grid">
          <Panel
            title="On your radar"
            subtitle="Recent applications that need a little attention"
            action={
              <button className="text-link" onClick={() => go("applications")}>
                View all <Icon name="ArrowRight" small />
              </button>
            }
          >
            <RecordsTable rows={applications.slice(0, 4)} short />
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
        canReviewKyc={Boolean(profile?.canReviewKyc)}
        canReviewEdd={Boolean(profile?.canReviewEdd)}
        onEdd={reviewEdd}
        onAddCustomer={() => setModal({ type: "customer" })}
        onAddPolicy={(c) => setModal({ type: "policy", customer: c.name })}
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
        action: "New application",
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
        action: "Add policy",
        statuses: ["All", ...POLICY_STATES],
      },
      claims: {
        title: "Here for the moments that matter.",
        sub: "Thoughtful claims handling, from notification to resolution.",
        rows: claims,
        type: "claim",
        action: "Register claim",
        statuses: ["All", ...CLAIM_STATES],
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
    return (
      <>
        <Heading title={config.title} subtitle={config.sub}>
          <Button
            variant="secondary"
            icon="Download"
            onClick={() => exportRows(kind, visible(config.rows))}
          >
            Export CSV
          </Button>
          {config.action && (
            <Button
              icon="Plus"
              onClick={() =>
                setModal({
                  type:
                    kind === "claims"
                      ? "claim"
                      : kind === "policies"
                        ? "policy"
                        : "application",
                })
              }
            >
              {config.action}
            </Button>
          )}
        </Heading>
        {kind === "collections" && (
          <div className="stat-grid three">
            <Stat
              label="Collected this month"
              value="BWP 2.84m"
              change="12.6%"
              icon="Wallet"
            />
            <Stat
              label="Collection rate"
              value="96.8%"
              change="2.4%"
              icon="CircleCheck"
              color="blue"
            />
            <Stat
              label="Needs attention"
              value="BWP 48,250"
              change="18 invoices"
              note="across the portfolio"
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
          <RecordsTable rows={visible(config.rows)} type={config.type} />
          <div className="table-footer">
            Showing {visible(config.rows).length} of {config.rows.length}{" "}
            records<span>BWP</span>
          </div>
        </Panel>
        {kind === "applications" && (
          <div className="notice">
            <Icon name="Lightbulb" />
            <p>
              <strong>Try the whole journey.</strong> Create an application,
              review it, and simulate policy issuance. Your new policy will
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
          <Button icon="Settings2" onClick={() => go("product-config")}>
            Configure products
          </Button>
        </Heading>
        <div className="catalog-toolbar">
          <div className="catalog-label">
            <h2>Explore products</h2>
            <span>{products.length} available</span>
          </div>
          <p>
            <Icon name="Info" small /> Illustrative benefits and premiums only
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
                    <dt>Illustrative cover</dt>
                    <dd>{p.cover}</dd>
                  </div>
                  <div>
                    <dt>Monthly premium</dt>
                    <dd>{p.premium}</dd>
                  </div>
                </dl>
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
    return (
      <>
        <Heading
          title="Stronger, together."
          subtitle="One connected home for employers, schemes, and their people."
        >
          <Button icon="Upload" onClick={() => setModal({ type: "census" })}>
            Census import
          </Button>
        </Heading>
        <div className="stat-grid three">
          <Stat
            label="Active schemes"
            value="3"
            change="Growing"
            note="together"
            icon="Building2"
          />
          <Stat
            label="Covered members"
            value="758"
            change="12 new"
            note="this week"
            icon="Users"
            color="purple"
          />
          <Stat
            label="Monthly scheme premium"
            value="BWP 263,400"
            change="6.8%"
            icon="Wallet"
            color="blue"
          />
        </div>
        <div className="scheme-grid">
          {schemes.map((s) => (
            <article className="scheme-card panel" key={s.id}>
              <div className="scheme-card-top">
                <span className={"avatar " + s.color}>{s.initials}</span>
                <Badge>Active</Badge>
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
          <Icon name="Lightbulb" />
          <p>
            <strong>A quick walkthrough:</strong> open a scheme to view its
            members, then try the sample census import to explore row
            validation.
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
                <strong>Nsure showcase</strong>
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
                <strong>Notifications</strong>
                <p>Show the activity notification indicator.</p>
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
            title="Start fresh"
            subtitle="Reloading restores the original sample records."
          >
            <Button
              variant="secondary"
              icon="RotateCcw"
              onClick={() => setModal({ type: "reset" })}
            >
              Reset data
            </Button>
          </Panel>
        </div>
      </>
    );
  }

  return (
    <div className={"app-shell " + (compact ? "compact" : "")}>
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}
      <aside className={"sidebar " + (mobileOpen ? "open" : "")}>
        <a href="#/overview" className="brand" onClick={() => go("overview")}>
          <img
            className="brand-logo"
            src="/brand/nsure-life-logo-light.svg"
            alt="Nsure Life"
          />
        </a>
        <div className="workspace-label">
          <span className="workspace-icon">N</span>
          <div>
            <strong>Nsure workspace</strong>
            <small>Operations team</small>
          </div>
          <Icon name="ChevronsUpDown" small />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {menuItems.map(([key, label, icon]) => (
            <a
              key={key}
              href={"#/" + key}
              onClick={(e) => {
                e.preventDefault();
                go(key);
              }}
              className={"nav-item " + (page === key ? "active" : "")}
              aria-current={page === key ? "page" : undefined}
            >
              <Icon name={icon} />
              <span>{label}</span>
              {key === "applications" && (
                <span className="nav-count">
                  {applications.filter((a) => a.status !== "Issued").length}
                </span>
              )}
              {key === "policies" && profile?.canManagePolicies && pendingPolicies.length > 0 && (
                <span className="nav-count" title="Customer purchases awaiting payment">
                  {pendingPolicies.length}
                </span>
              )}
              {key === "assistant" && <span className="ai-nav-badge">NEW</span>}
            </a>
          ))}
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
            className={"nav-item " + (page === "settings" ? "active" : "")}
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
            Workspace <Icon name="ChevronRight" small />
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
            <MotionToggle />
            <button
              className="icon-btn notification"
              aria-label="View notifications"
              onClick={() => setModal({ type: "notifications" })}
            >
              <Icon name="Bell" />
              {notifications && <i />}
            </button>
            <button
              className="avatar profile-button"
              aria-label="Your profile"
              onClick={() => go("settings")}
            >
              {(profile?.username || "IN").slice(0, 2).toUpperCase()}
            </button>
          </div>
        </header>
        <AnimatedWorkspace page={page} key={page}>
          {page === "overview" ? (
            Overview()
          ) : page === "customers" ? (
            Customers()
          ) : ["applications", "policies", "claims", "collections"].includes(
              page,
            ) ? (
            RecordsPage({ kind: page })
          ) : page === "products" ? (
            Products()
          ) : page === "rate-tables" ? (
            <RateTables session={session} notify={notify} />
          ) : page === "product-config" ? (
            <ProductConfig
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
          ) : page === "schemes" ? (
            Schemes()
          ) : page === "assistant" ? (
            <AssistantStudio />
          ) : page === "access" ? (
            profile?.superAdmin ? (
              <AccessAdmin session={session} notify={notify} />
            ) : (
              <Panel title="Access is limited">
                <p>Only a super admin can manage roles, permissions, and users.</p>
              </Panel>
            )
          ) : page === "settings" ? (
            Settings()
          ) : (
            Overview()
          )}
          <footer className="page-footer">
            <span>
              Thoughtfully connected. <strong>Nsure.</strong>
            </span>
          </footer>
        </AnimatedWorkspace>
      </main>
      {toast && (
        <div className="toast" role="status">
          <Icon name="CircleCheck" />
          {toast}
          <button
            className="icon-btn"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <Icon name="X" small />
          </button>
        </div>
      )}
      {modal && (
        <Modal
          title={
            modal.type === "application"
              ? "Start a new application"
              : modal.type === "policy"
                ? "Add a policy"
              : modal.type === "customer"
                ? "Welcome a new customer"
                : modal.type === "claim"
                  ? "Register a claim"
                  : modal.type === "detail"
                    ? modal.record.name
                    : modal.type === "census"
                      ? "Explore a census import"
                      : modal.type === "notifications"
                        ? "Your latest updates"
                        : modal.type === "reset"
                          ? "Reset this workspace?"
                          : modal.type === "command"
                            ? "Your workspace, one shortcut away."
                            : "Nsure"
          }
          onClose={close}
          wide={modal.type === "census"}
        >
          {modal.type === "command" && (
            <ActionSearch
              actions={[
                {
                  id: "new-application",
                  label: "New application",
                  description: "Start an application wizard",
                },
                {
                  id: "new-claim",
                  label: "Register a claim",
                  description: "Open sample claim intake",
                },
                ...navItems.map(([id, label]) => ({
                  id,
                  label,
                  description:
                    id === "product-config"
                      ? "Create a product with your copilot"
                      : "Open the " + label.toLowerCase() + " workspace",
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
          {modal.type === "application" && (
            <ApplicationForm
              session={session}
              defaultProduct={modal.product}
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
                  notify(error.message);
                }
              }}
            />
          )}
          {modal.type === "policy" && (
            <PolicyForm
              session={session}
              customers={customers}
              products={products}
              defaultCustomer={modal.customer}
              onCancel={close}
              onSave={async (data) => {
                try {
                  const created = await request(session, "/portfolio/policies", {
                    method: "POST",
                    body: data,
                  });
                  setPolicies((rows) => [created.data, ...rows]);
                  setCustomers((rows) =>
                    rows.map((row) =>
                      row.name === data.name
                        ? { ...row, policies: row.policies + 1, product: data.product }
                        : row,
                    ),
                  );
                  close();
                  go("policies");
                  notify("Policy added.");
                } catch (error) {
                  notify(error.message);
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
                    "Customer saved. Sign in as " +
                      created.data.loginUsername +
                      " after KYC is successful.",
                  );
                } catch (error) {
                  notify(error.message);
                }
              }}
            />
          )}
          {modal.type === "claim" && (
            <ClaimLodgeForm
              policies={policies.filter((p) => ["Active", "Lapsed"].includes(p.status))}
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
                  notify(error.message);
                }
              }}
            />
          )}
          {modal.type === "census" && (
            <Census
              onDone={() => {
                close();
                notify(
                  "Preview completed: 3 accepted rows, 1 rejected. Live membership is unchanged.",
                );
              }}
            />
          )}
          {modal.type === "notifications" && (
            <div className="activity-list">
              {[
                ...(profile?.canManagePolicies && pendingPolicies.length
                  ? [
                      [
                        pendingPolicies.length === 1
                          ? "A policy is awaiting its first premium"
                          : pendingPolicies.length + " policies are awaiting their first premium",
                        "Record the payment, or cancel a purchase the customer no longer wants.",
                        "policies",
                      ],
                    ]
                  : []),
                [
                  "Underwriting needs a look",
                  "Two applications are waiting for a review.",
                  "applications",
                ],
                [
                  "A claim needs evidence",
                  "Naledi’s hospital claim is awaiting documents.",
                  "claims",
                ],
                [
                  "Your next team opportunity",
                  "Explore the latest group scheme activity.",
                  "schemes",
                ],
              ].map(([t, d, p]) => (
                <button
                  className="notification-item"
                  key={t}
                  onClick={() => go(p)}
                >
                  <span className="stat-icon green">
                    <Icon name="Bell" />
                  </span>
                  <span>
                    <strong>{t}</strong>
                    <p>{d}</p>
                  </span>
                  <Icon name="ChevronRight" />
                </button>
              ))}
            </div>
          )}
          {modal.type === "reset" && (
            <>
              <p>
                This restores all original sample records and clears your
                session changes. Your dummy login stays active.
              </p>
              <div className="modal-footer">
                <Button variant="secondary" onClick={close}>
                  Keep exploring
                </Button>
                <Button icon="RotateCcw" onClick={() => location.reload()}>
                  Reset
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
              onIssue={issue}
              onApprove={async (record) => {
                const updated = await request(session, "/portfolio/applications/" + record.id, {
                  method: "PUT",
                  body: { status: "Ready to issue" },
                });
                setApplications((a) => a.map((x) => (x.id === record.id ? updated.data : x)));
                setModal({
                  type: "detail",
                  entity: "application",
                  record: updated.data,
                });
                notify("Underwriting accepted and saved.");
              }}
              session={session}
              profile={profile}
              onPolicyUpdated={policyUpdated}
              onClaimUpdated={claimUpdated}
              canReviewKyc={Boolean(profile?.canReviewKyc)}
              canReviewEdd={Boolean(profile?.canReviewEdd)}
              onEdd={async (record, decision, reason) => {
                const updated = await reviewEdd(record, decision, reason);
                if (updated) setModal({ type: "detail", entity: "customer", record: updated });
                return Boolean(updated);
              }}
              onKyc={async (record, decision, reason) => {
                const updated = await reviewKyc(record, decision, reason);
                if (updated) setModal({ type: "detail", entity: "customer", record: updated });
                return Boolean(updated);
              }}
              onAddPolicy={(record) =>
                setModal({ type: "policy", customer: record.name })
              }
              onReceipt={async (r) => {
                const updated = await request(session, "/portfolio/receipts/" + r.id, {
                  method: "PUT",
                  body: { status: "Paid" },
                });
                setReceipts((a) => a.map((x) => (x.id === r.id ? updated.data : x)));
                setModal({
                  type: "detail",
                  entity: "collection",
                  record: updated.data,
                });
                notify("Receipt saved.");
              }}
              notify={notify}
            />
          )}
        </Modal>
      )}
    </div>
  );
}

function ApplicationForm({ session, defaultProduct, customers, products = [], onSave, onCancel }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState(() => {
    const p = products.find((item) => item.name === defaultProduct) ||
      popularProduct(products) || { name: "", cover: "0", premium: "0" };
    const tier = defaultTier(p);
    return {
      name: customers[0]?.name || "",
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
  const priced = useLifeQuote(
    session,
    "/portfolio/quote",
    { name: data.name, product: data.product, tier: data.tier, lives: livesBody(completeLives(lives)) },
    Boolean(ratedTier && data.name),
  );
  const save = (status) =>
    onSave({ ...data, status, ...(ratedTier ? { lives: livesBody(lives) } : {}) });
  return (
    <>
      <div className="stepper">
        {["Customer", "Protection", "Review"].map((s, i) => (
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
          if (step < 2) setStep(step + 1);
          else save("Under review");
        }}
      >
        {step === 0 ? (
          <>
            <h3>Who are we looking after?</h3>
            <p className="subtitle">
              Choose an existing customer to get started.
            </p>
            <Field label="Customer">
              <Select
                className="select"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
              >
                {customers.map((c) => (
                  <option key={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <div className="notice">
              <Icon name="UserRoundCheck" />
              <p>
                Customer details are linked from your directory. This is a
                simulated application.
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
                <span>Illustrative monthly premium</span>
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
        ) : (
          <>
            <h3>Looking good. Let’s review.</h3>
            <div className="detail-grid">
              {[
                ["Customer", data.name],
                ["Product", data.product],
                ...(data.tier ? [["Tier", data.tier]] : []),
                ["Illustrative cover", money(data.amount)],
                [
                  "Monthly premium",
                  ratedTier
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
            {ratedTier && priced.error && (
              <p className="covered-lives-error" role="alert">
                {priced.error}
              </p>
            )}
            {ratedTier && <LifeCoverList lives={priced.quote?.lives} />}
            <label className="checkbox-label">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              I understand this submission does not create insurance cover
              until a policy is issued.
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
          {step < 2 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => save("Draft")}
            >
              Save draft
            </Button>
          )}
          <Button type="submit" icon={step === 2 ? "Check" : "ArrowRight"}>
            {step === 2 ? "Submit application" : "Continue"}
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
  if (!total) return "#eef0e8";
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
}) {
  const [selected, setSelected] = useState(() => new Set());
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
    { label: "Add customer", icon: "UserPlus", onClick: onAddCustomer },
    {
      label: "Add policy",
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
    </div>
  );
}
function CustomerForm({ onSave, onCancel }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget));
        onSave({ ...f, pep: f.pep === "on" });
      }}
    >
      <p className="subtitle">
        The username and password are what this customer uses on the Customer sign-in.
      </p>
      <div className="field-grid">
        <Field label="Full name" full>
          <input
            name="name"
            className="input"
            placeholder="e.g. Dineo Motsumi"
            required
            minLength={2}
          />
        </Field>
        <Field label="Email address">
          <input
            name="email"
            className="input"
            type="email"
            placeholder="dineo@example.com"
            required
          />
        </Field>
        <Field label="Phone number">
          <input
            name="phone"
            className="input"
            type="tel"
            placeholder="+267 71 234 567"
            required
          />
        </Field>
        <Field label="Proof of identity type">
          <select name="poiType" className="input" defaultValue="Omang" required>
            <option value="Omang">Omang</option>
            <option value="Passport">Passport</option>
          </select>
        </Field>
        <Field label="Proof of identity number">
          <input
            name="poiNumber"
            className="input"
            placeholder="e.g. 880618404"
            required
            minLength={5}
            maxLength={40}
          />
        </Field>
        <Field label="Date of birth">
          <input
            name="dateOfBirth"
            className="input"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            required
          />
        </Field>
        <Field label="Sign-in username">
          <input
            name="username"
            className="input"
            placeholder="e.g. dineo"
            required
            minLength={3}
            autoComplete="off"
          />
        </Field>
        <Field label="Sign-in password">
          <input
            name="password"
            className="input"
            type="password"
            placeholder="At least 8 characters"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
        <label className="form-label full">
          <span>
            <input type="checkbox" name="pep" /> Politically exposed person (PEP): needs an enhanced due diligence
            review before choosing cover
          </span>
        </label>
      </div>
      <div className="notice">
        <Icon name="Info" />
        <p>
          New profiles start with pending verification.
        </p>
      </div>
      <div className="modal-footer">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" icon="UserPlus">
          Add customer
        </Button>
      </div>
    </form>
  );
}
function PolicyForm({ session, customers, products = [], defaultCustomer, onSave, onCancel }) {
  const ready = customers.filter((customer) => customer.kycStatus === "VERIFIED");
  const first = ready.find((customer) => customer.name === defaultCustomer) || ready[0];
  const initialProduct = products[0] || { name: "", cover: "0", premium: "0" };
  const [customerName, setCustomerName] = useState(first?.name || "");
  const [productName, setProductName] = useState(initialProduct.name);
  const product = products.find((item) => item.name === productName) || initialProduct;
  const tiers = productTiers(product);
  const [tierName, setTierName] = useState(defaultTier(initialProduct)?.name || "");
  const tier = tiers.find((item) => item.name === tierName) || null;
  const rated = tier?.priceIsFrom ? tier : null;
  const [lives, setLives] = useState([]);
  const priced = useLifeQuote(
    session,
    "/portfolio/quote",
    { name: customerName, product: product.name, tier: tierName, lives: livesBody(completeLives(lives)) },
    Boolean(rated && customerName),
  );
  if (!ready.length) {
    return (
      <>
        <p className="subtitle">
          Mark KYC successful on a customer before a policy can be added.
        </p>
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Close
          </Button>
        </div>
      </>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          name: customerName,
          product: product.name,
          tier: tier?.name,
          amount: tier ? tier.cover : amountOf(product.cover),
          premium: tier ? tier.premium : amountOf(product.premium),
          status: "Active",
          ...(rated ? { lives: livesBody(lives) } : {}),
        });
      }}
    >
      <p className="subtitle">
        Only customers with successful KYC can receive a policy.
      </p>
      <div className="field-grid">
        <Field label="Customer">
          <Select
            className="select"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
          >
            {ready.map((customer) => (
              <option key={customer.id} value={customer.name}>
                {customer.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Product">
          <Select
            className="select"
            value={productName}
            onChange={(event) => {
              const next = products.find((item) => item.name === event.target.value);
              setProductName(event.target.value);
              setTierName(defaultTier(next)?.name || "");
              setLives([]);
            }}
          >
            {products.map((item) => (
              <option key={item.name}>{item.name}</option>
            ))}
          </Select>
        </Field>
        {tiers.length > 0 && (
          <Field label="Tier">
            <Select
              className="select"
              value={tierName}
              onChange={(event) => {
                setTierName(event.target.value);
                if (!tiers.find((item) => item.name === event.target.value)?.priceIsFrom) setLives([]);
              }}
            >
              {tiers.map((item) => (
                <option key={item.name} value={item.name}>
                  {tierOptionLabel(item, product)}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <div className="quote-summary">
        <span>{tier ? tier.name + " cover" : "Cover"}</span>
        <strong>
          {tier
            ? money(tier.cover) + (product.coverUnit ? " / " + product.coverUnit : "")
            : product.cover}
        </strong>
        <p>
          {rated
            ? "Priced per covered life by age from rate table " + rated.rateTable
            : "Monthly premium " + (tier ? money(tier.premium) : product.premium)}
        </p>
      </div>
      {rated && (
        <CoveredLives tier={rated} mainName={customerName} lives={lives} onChange={setLives} {...priced} />
      )}
      <div className="modal-footer">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" icon="ShieldCheck">
          Add policy
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
  onApprove,
  onReceipt,
  notify,
  session,
  profile,
  onPolicyUpdated,
  onClaimUpdated,
  canReviewKyc,
  onKyc,
  onAddPolicy,
  canReviewEdd,
  onEdd,
}) {
  const [tab, setTab] = useState("Overview");
  const [evidence, setEvidence] = useState(false);
  // Policies, claims and customer reviews have a real workflow log; the other records keep the sample timeline.
  const historyType =
    entity === "policy" ? "policy" : entity === "claim" ? "claim" : entity === "customer" ? ["kyc", "edd"] : null;
  const workflowRecord = entity === "policy" || entity === "claim";
  // An application's identity check is its customer's KYC; a policy can only be issued once it is verified.
  const applicant = entity === "application" ? customers.find((c) => c.name === r.name) : null;
  const identityStatus = applicant ? kycLabel(applicant) : "Verified";
  const [summary, setSummary] = useState(false);
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
        {["Overview", "Documents", "Activity"].map((t) => (
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
                  [
                    "Linked policies",
                    policies.filter((p) => p.name === r.name).length,
                  ],
                ].map(([k, v]) => (
                  <div className="detail-item" key={k}>
                    <small>{k}</small>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
              <h3 className="section-title">Their protection</h3>
              {policies
                .filter((p) => p.name === r.name)
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
              {!policies.some((p) => p.name === r.name) && (
                <Empty
                  text="A fresh start"
                  detail="This customer has no policies yet."
                />
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
                <Button
                  icon="ShieldCheck"
                  disabled={r.kycStatus !== "VERIFIED"}
                  onClick={() => onAddPolicy(r)}
                >
                  Add policy
                </Button>
              </div>
            </>
          ) : entity === "scheme" ? (
            <>
              <div className="detail-grid">
                {[
                  ["Members", r.members],
                  ["Monthly premium", money(r.premium)],
                  ["Renewal", r.renewal],
                  ["Benefit", "Group Life Assurance"],
                ].map(([k, v]) => (
                  <div className="detail-item" key={k}>
                    <small>{k}</small>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
              <h3 className="section-title">Member preview</h3>
              {customers.slice(0, 3).map((c, i) => (
                <div className="linked-record" key={c.id}>
                  <Person name={c.name} sub={"MEM-00" + (i + 1)} />
                  <Badge>{i === 2 ? "Under review" : "Active"}</Badge>
                </div>
              ))}
              <p className="muted">
                Showing 3 illustrative members of {r.members}.
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
              {entity === "policy" && (
                <PolicyWorkflowPanel
                  session={session}
                  policy={r}
                  canManage={Boolean(profile?.canManagePolicies)}
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
              {!workflowRecord && <h3 className="section-title">Evidence checklist</h3>}
              {!workflowRecord && [
                "Identity verification",
                "Application / claim declaration",
                "Supporting documentation",
              ].map((t, i) => {
                const state =
                  i === 0
                    ? identityStatus
                    : i === 2 && !evidence && r.status === "Evidence needed"
                      ? "Pending"
                      : "Verified";
                return (
                  <div className="checklist-item" key={t}>
                    <Icon name={state === "Verified" ? "CircleCheck" : "Clock3"} />
                    <span>{t}</span>
                    <Badge>{state}</Badge>
                  </div>
                );
              })}
              <div className="detail-actions">
                {entity === "application" && r.status === "Ready to issue" && (
                  <Button
                    icon="ShieldCheck"
                    disabled={identityStatus !== "Verified"}
                    onClick={() => onIssue(r)}
                  >
                    Simulate policy issue
                  </Button>
                )}
                {entity === "application" &&
                  ["Under review", "Evidence needed", "Draft"].includes(
                    r.status,
                  ) && (
                    <Button
                      icon="Check"
                      disabled={r.status === "Evidence needed" && !evidence}
                      onClick={() => onApprove(r)}
                    >
                      Simulate underwriting acceptance
                    </Button>
                  )}
                {entity === "collection" && r.status !== "Paid" && (
                  <Button icon="Wallet" onClick={() => onReceipt(r)}>
                    Record receipt
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
                  Actions are simulated. No cover, financial transaction, or real
                  approval is created.
                </p>
              )}
            </>
          )}
          <div className="ai-summary">
            <button className="text-link" onClick={() => setSummary(!summary)}>
              <Icon name="Sparkles" /> {summary ? "Hide" : "Show"} sample AI
              summary
            </button>
            {summary && (
              <p>
                <strong>Simulated assistant:</strong> {r.name} is linked to{" "}
                {r.product || "this account"}. Current status:{" "}
                {r.status || "Active"}.{" "}
                {r.status === "Evidence needed"
                  ? "Supporting documentation needs review before the case can proceed."
                  : "Review the record and its evidence before taking the next action."}{" "}
                This is a scripted summary of the displayed record.
              </p>
            )}
          </div>
        </>
      ) : tab === "Documents" ? (
        <>
          <p className="subtitle">
            Illustrative evidence checklist. No files are uploaded or stored.
          </p>
          {[
            "Identity document",
            "Signed declaration",
            "Supporting evidence",
          ].map((d, i) => (
            <div className="linked-record" key={d}>
              <span className="stat-icon blue">
                <Icon name="FileText" />
              </span>
              <div>
                <strong>{d}</strong>
                <small>Sample document · PDF</small>
              </div>
              <Badge>{i === 2 && !evidence ? "Pending" : "Available"}</Badge>
            </div>
          ))}
          <Button
            variant="secondary"
            icon="Upload"
            onClick={() => {
              setEvidence(true);
              notify("Supporting evidence marked received.");
            }}
          >
            Simulate evidence received
          </Button>
        </>
      ) : historyType ? (
        <WorkflowTimeline session={session} type={historyType} refId={r.id} version={JSON.stringify(r)} />
      ) : (
        <div className="timeline">
          {[
            [
              "Record created",
              r.date || "24 Sep 2026",
              "Record entered into the workspace.",
            ],
            [
              "Information reviewed",
              "28 Sep 2026",
              "Customer and product information checked.",
            ],
            [
              "Current state",
              r.status || "Active",
              "This timeline is illustrative.",
            ],
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
function Census({ onDone }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <p className="subtitle">
        Walk through a sample member import for Okavango Holdings.
      </p>
      {!loaded ? (
        <button className="file-drop" onClick={() => setLoaded(true)}>
          <span className="stat-icon green">
            <Icon name="Upload" />
          </span>
          <h3>Try a sample census file</h3>
          <p>4 sample members · no upload needed</p>
          <span className="btn primary">
            Load sample data <Icon name="ArrowRight" small />
          </span>
        </button>
      ) : (
        <>
          <div className="notice">
            <Icon name="CircleCheck" />
            <p>
              <strong>Validation complete.</strong> 3 rows accepted · 1 row
              needs correction. This is a preview only.
            </p>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Member</th>
                  <th>Category</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["1", "Dineo Motsumi", "Staff", "Accepted"],
                  ["2", "Tshepo Dube", "Management", "Accepted"],
                  ["3", "Boitumelo Sechele", "Staff", "Accepted"],
                  ["4", "Onalenna Tlhagale", "Unknown", "Invalid category"],
                ].map((row) => (
                  <tr key={row[0]}>
                    {row.map((v, i) => (
                      <td key={i}>
                        {i === 3 ? (
                          <Badge>
                            {v === "Accepted" ? "Verified" : "Rejected"}
                          </Badge>
                        ) : (
                          v
                        )}
                        {i === 3 && v !== "Accepted" && (
                          <div className="person-sub">Unknown category</div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="modal-footer">
            <Button
              variant="secondary"
              icon="Download"
              onClick={() =>
                downloadCSV("census-results.csv", [
                  ["Row", "Name", "Result", "Reason"],
                  ["1", "Dineo Motsumi", "Accepted", ""],
                  ["2", "Tshepo Dube", "Accepted", ""],
                  ["3", "Boitumelo Sechele", "Accepted", ""],
                  ["4", "Onalenna Tlhagale", "Rejected", "Unknown category"],
                ])
              }
            >
              Download results
            </Button>
            <Button icon="Check" onClick={onDone}>
              Finish preview
            </Button>
          </div>
        </>
      )}
    </>
  );
}
