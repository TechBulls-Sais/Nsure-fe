import Select from "./ui/Select";
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
  FlaskConical,
  Heart,
  HeartHandshake,
  HeartPulse,
  Info,
  Layers3,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  MessageSquareText,
  Plus,
  RotateCcw,
  ScanText,
  Search,
  SearchX,
  Settings2,
  ShieldCheck,
  Sparkles,
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
  FlaskConical,
  Heart,
  HeartHandshake,
  HeartPulse,
  Info,
  Layers3,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  MessageSquareText,
  Plus,
  RotateCcw,
  ScanText,
  Search,
  SearchX,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  UserPlus,
  UserRoundCheck,
  Users,
  Wallet,
  X,
};
import {
  customers as seedCustomers,
  initialApplications,
  initialPolicies,
  initialClaims,
  products,
  schemes,
  money,
  initials,
} from "./data";
import ProductConfig, { initialProductConfigs } from "./ProductConfig";
import AssistantStudio from "./AssistantStudio";
import {
  AnimatedWorkspace,
  AnimatedMetric,
  ShimmerText,
  SpotlightCard,
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
    : /pending|evidence|grace|review|assessment/.test(s)
      ? "amber"
      : /lapsed|failed|rejected/.test(s)
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
            <span className="eyebrow">NSURE LIFE · DEMO</span>
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

function Login({ onLogin }) {
  const [email, setEmail] = useState("demo@nsure.life");
  const [password, setPassword] = useState("nsure2026");
  const [show, setShow] = useState(false);
  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="ShieldCheck" />
          </span>
          <span>
            nsure<span className="brand-light"> life</span>
            <small>INSURANCE, CONNECTED.</small>
          </span>
        </div>
        <div className="login-story-content">
          <span className="demo-pill">
            A little clarity. A lot of confidence.
          </span>
          <h1>
            Behind every policy,
            <br />
            there’s a <em>person.</em>
          </h1>
          <p>
            Bring your people, policies, and possibilities together in one
            thoughtful workspace.
          </p>
          <div className="login-decoration">
            <IntelligenceOrb />
            <span className="hero-tag tag-one">🌱 Built around people</span>
            <span className="hero-tag tag-two">
              <Icon name="Heart" small /> Peace of mind, connected
            </span>
          </div>
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
        <p className="login-note">Nsure Life © 2026 · Frontend showcase</p>
      </section>
      <section className="login-card">
        <div className="login-form">
          <span className="badge green">
            <Icon name="FlaskConical" small /> INTERACTIVE DEMO
          </span>
          <h2>
            Welcome to your
            <br />
            next chapter.
          </h2>
          <p className="subtitle">Sign in and make yourself at home. 👋</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onLogin();
            }}
          >
            <Field label="Work email">
              <input
                className="input"
                type="email"
                required
                value={email}
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
            <div className="login-hint">
              <Icon name="Info" small /> Demo credentials are already filled in.
            </div>
            <Button type="submit" icon="ArrowRight">
              Enter workspace
            </Button>
          </form>
          <div className="notice">
            <Icon name="ShieldCheck" />
            <p>
              <strong>A safe space to explore.</strong>
              <br />
              All records are fictional. Sign-in is simulated and no credentials
              are sent to a server.
            </p>
          </div>
          <p className="login-note">Made for people who care for people.</p>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(
    () => sessionStorage.getItem("nsure-demo-login") === "true",
  );
  const [page, setPage] = useState(() => location.hash.slice(2) || "overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [customers, setCustomers] = useState(seedCustomers);
  const [applications, setApplications] = useState(initialApplications);
  const [policies, setPolicies] = useState(initialPolicies);
  const [claims, setClaims] = useState(initialClaims);
  const [productConfigs, setProductConfigs] = useState(initialProductConfigs);
  const [receipts, setReceipts] = useState([
    {
      id: "INV-0091",
      name: "Amara Dube",
      product: "Term Life",
      amount: 420,
      status: "Paid",
      date: "28 Sep 2026",
    },
    {
      id: "INV-0092",
      name: "Thabo Molefe",
      product: "Family Funeral",
      amount: 185,
      status: "Paid",
      date: "28 Sep 2026",
    },
    {
      id: "INV-0093",
      name: "Lerato Ndlovu",
      product: "Term Life",
      amount: 315,
      status: "Overdue",
      date: "25 Sep 2026",
    },
    {
      id: "INV-0094",
      name: "Kabelo Mokoena",
      product: "Whole of Life",
      amount: 680,
      status: "Pending",
      date: "30 Sep 2026",
    },
  ]);
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
    sessionStorage.removeItem("nsure-demo-login");
    setLoggedIn(false);
    setModal(null);
  };
  const activeName =
    navItems.find((n) => n[0] === page)?.[1] ||
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
    downloadCSV(name + ".csv", [
      ["Reference", "Name", "Product", "Amount", "Status"],
      ...rows.map((r) => [r.id, r.name, r.product, r.amount || "", r.status]),
    ]);
    notify("Your demo export is ready.");
  };
  const issue = (record) => {
    const newPolicy = {
      ...record,
      id: "POL-" + (10843 + policies.length - initialPolicies.length),
      status: "In force",
      date: "29 Sep 2026",
    };
    setPolicies((p) => [newPolicy, ...p]);
    setApplications((a) =>
      a.map((x) => (x.id === record.id ? { ...x, status: "Issued" } : x)),
    );
    setModal({ type: "detail", entity: "policy", record: newPolicy });
    notify("Demo policy issued. You can find it in Policies.");
  };
  const updateClaim = (record) => {
    const status = record.status === "Approved" ? "Settled" : "Approved";
    const next = { ...record, status };
    setClaims((c) => c.map((x) => (x.id === record.id ? next : x)));
    setModal({ type: "detail", entity: "claim", record: next });
    notify(
      status === "Settled"
        ? "Demo settlement recorded. No money was transferred."
        : "Claim approval simulated.",
    );
  };
  if (!loggedIn)
    return (
      <Login
        onLogin={() => {
          sessionStorage.setItem("nsure-demo-login", "true");
          setLoggedIn(true);
        }}
      />
    );

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
              <Icon name="Sparkles" small /> NSURE INTELLIGENCE · DEMO
            </span>
            <h2>
              A little intelligence.
              <br />
              <ShimmerText>A world of possibility.</ShimmerText>
            </h2>
            <p>
              Your team is helping <strong>13,480 lives</strong> feel a little
              more secure.
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
            <p>Explore intelligent workflows using sample records.</p>
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
            value="13,480"
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
            value={128 + applications.length - initialApplications.length}
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
              <div className="donut">
                <div className="donut-center">
                  <strong>13,480</strong>
                  <span>protected lives</span>
                </div>
              </div>
            </div>
            <div className="legend-list">
              {[
                ["Term Life", "36%", "green"],
                ["Whole of Life", "23%", "purple"],
                ["Family Funeral", "22%", "amber"],
                ["Other products", "19%", "blue"],
              ].map(([n, v, c]) => (
                <div className="legend-row" key={n}>
                  <span>
                    <i className={"legend-dot " + c} />
                    {n}
                  </span>
                  <strong>{v}</strong>
                </div>
              ))}
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
      <>
        <Heading
          title="People, not just policy numbers."
          subtitle="A clear picture of everyone you care for."
        >
          <Button
            icon="UserPlus"
            onClick={() => setModal({ type: "customer" })}
          >
            Add customer
          </Button>
        </Heading>
        <div className="stat-grid three">
          <Stat
            label="Customers in this demo"
            value={customers.length}
            change="2 new"
            note="this week"
            icon="Users"
          />
          <Stat
            label="Identity verified"
            value={customers.filter((c) => c.status === "Verified").length}
            change="Up to date"
            note="verified profiles"
            icon="BadgeCheck"
            color="blue"
          />
          <Stat
            label="Awaiting verification"
            value={customers.filter((c) => c.status === "Pending KYC").length}
            change="Action needed"
            note="evidence review"
            icon="ClipboardList"
            color="amber"
          />
        </div>
        <Panel
          title="Your customer directory"
          subtitle="Select a customer to explore their profile."
        >
          {Filters({
            statuses: ["All", "Verified", "Pending KYC"],
            count: customers.length,
          })}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Policies</th>
                  <th>Verification</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible(customers).map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Person name={c.name} sub={c.id} />
                    </td>
                    <td>
                      {c.email}
                      <div className="person-sub">{c.phone}</div>
                    </td>
                    <td>
                      {c.policies} {c.policies === 1 ? "policy" : "policies"}
                    </td>
                    <td>
                      <Badge>{c.status}</Badge>
                    </td>
                    <td>
                      <button
                        className="icon-btn"
                        aria-label={"View " + c.name}
                        onClick={() => detail("customer", c)}
                      >
                        <Icon name="ArrowUpRight" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible(customers).length && <Empty />}
          </div>
        </Panel>
      </>
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
        action: "New application",
        statuses: ["All", "In force", "Grace period", "Lapsed"],
      },
      claims: {
        title: "Here for the moments that matter.",
        sub: "Thoughtful claims handling, from notification to resolution.",
        rows: claims,
        type: "claim",
        action: "Register claim",
        statuses: [
          "All",
          "Assessment",
          "Evidence needed",
          "Approved",
          "Settled",
        ],
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
                setModal({ type: kind === "claims" ? "claim" : "application" })
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
          subtitle={`${config.rows.length} sample records · changes stay in this session`}
        >
          {Filters({ statuses: config.statuses, count: config.rows.length })}
          <RecordsTable rows={visible(config.rows)} type={config.type} />
          <div className="table-footer">
            Showing {visible(config.rows).length} of {config.rows.length}{" "}
            records<span>Demo data · BWP</span>
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
      <>
        <Heading
          title="Different lives. Thoughtful protection."
          subtitle="Explore the product experiences in your showcase."
        >
          <Button icon="Settings2" onClick={() => go("product-config")}>
            Configure products
          </Button>
        </Heading>
        <div className="notice">
          <Icon name="Info" />
          <p>
            All benefits and premiums below are illustrative demo figures, not
            approved insurance quotations.
          </p>
        </div>
        <div className="product-grid">
          {products.map((p) => (
            <SpotlightCard className={"product-card " + p.color} key={p.name}>
              <div className="product-card-top">
                <span className={"product-icon " + p.color}>
                  <Icon name={p.icon} />
                </span>
                <Badge>Demo product</Badge>
              </div>
              <h2>{p.name}</h2>
              <p>{p.description}</p>
              <div className="product-cover">
                <small>ILLUSTRATIVE COVER</small>
                <strong>{p.cover}</strong>
              </div>
              <div className="product-footer">
                <div>
                  <strong>BWP {p.premium}</strong>
                  <small> / month · sample</small>
                </div>
                <button
                  className="icon-btn"
                  aria-label={"Quote " + p.name}
                  onClick={() =>
                    setModal({ type: "application", product: p.name })
                  }
                >
                  <Icon name="ArrowRight" />
                </button>
              </div>
            </SpotlightCard>
          ))}
        </div>
      </>
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
            Demo census import
          </Button>
        </Heading>
        <div className="stat-grid three">
          <Stat
            label="Active demo schemes"
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
          subtitle="A few preferences for your demo workspace."
        />
        <div className="settings-grid">
          <Panel title="Your profile" subtitle="Demo identity">
            <Person
              name="Sarah Williams"
              sub="Operations manager · demo@nsure.life"
            />
            <div className="detail-grid">
              <div className="detail-item">
                <small>Workspace</small>
                <strong>Nsure Life showcase</strong>
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
                <strong>Demo notifications</strong>
                <p>Show the activity notification indicator.</p>
              </div>
              <button
                role="switch"
                aria-checked={notifications}
                aria-label="Demo notifications"
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
              Reset demo data
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
          <span className="brand-mark">
            <Icon name="ShieldCheck" />
          </span>
          <span>
            nsure<span className="brand-light"> life</span>
            <small>INSURANCE, CONNECTED.</small>
          </span>
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
          {navItems.map(([key, label, icon]) => (
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
              {key === "assistant" && <span className="ai-nav-badge">NEW</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span>🌿 A space to explore</span>
            <p>
              Big possibilities.
              <br />
              Zero real-world transactions.
            </p>
            <span className="demo-pill">
              <span className="live-dot" /> Demo mode
            </span>
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
          <div className="user-profile">
            <span className="avatar">SW</span>
            <div className="user-info">
              <strong>Sarah Williams</strong>
              <small>Operations manager</small>
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
            <span className="topbar-demo">
              <span className="live-dot" /> AI showcase · Simulated
            </span>
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
              SW
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
          ) : page === "product-config" ? (
            <ProductConfig
              records={productConfigs}
              setRecords={setProductConfigs}
              notify={notify}
            />
          ) : page === "schemes" ? (
            Schemes()
          ) : page === "assistant" ? (
            <AssistantStudio />
          ) : page === "settings" ? (
            Settings()
          ) : (
            Overview()
          )}
          <footer className="page-footer">
            <span>
              Thoughtfully connected. <strong>Nsure Life.</strong>
            </span>
            <span>Fictional data · No live transactions</span>
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
                          ? "Reset this demo?"
                          : modal.type === "command"
                            ? "Your workspace, one shortcut away."
                            : "Demo"
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
                      ? "Create a product with your demo copilot"
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
              defaultProduct={modal.product}
              customers={customers}
              onCancel={close}
              onSave={(data) => {
                setApplications((a) => [
                  {
                    ...data,
                    id: "APP-" + (2049 + a.length - initialApplications.length),
                    date: "29 Sep 2026",
                  },
                  ...a,
                ]);
                close();
                go("applications");
                notify("Application saved to your demo workbench.");
              }}
            />
          )}
          {modal.type === "customer" && (
            <CustomerForm
              onCancel={close}
              onSave={(data) => {
                setCustomers((c) => [
                  {
                    ...data,
                    id: "CUS-" + (1001 + c.length),
                    policies: 0,
                    status: "Pending KYC",
                    product: "",
                    initials: initials(data.name),
                  },
                  ...c,
                ]);
                close();
                go("customers");
                notify("Customer added. Verification is pending.");
              }}
            />
          )}
          {modal.type === "claim" && (
            <ClaimForm
              customers={customers}
              onCancel={close}
              onSave={(data) => {
                setClaims((c) => [
                  {
                    ...data,
                    id: "CLM-" + (843 + c.length - initialClaims.length),
                    date: "29 Sep 2026",
                    status: "Evidence needed",
                  },
                  ...c,
                ]);
                close();
                go("claims");
                notify(
                  "Demo claim registered. Evidence can be reviewed in the claim details.",
                );
              }}
            />
          )}
          {modal.type === "census" && (
            <Census
              onDone={() => {
                close();
                notify(
                  "Demo preview completed: 3 accepted rows, 1 rejected. Live membership is unchanged.",
                );
              }}
            />
          )}
          {modal.type === "notifications" && (
            <div className="activity-list">
              {[
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
                  Reset demo
                </Button>
              </div>
            </>
          )}
          {modal.type === "detail" && (
            <Detail
              entity={modal.entity}
              record={modal.record}
              policies={policies}
              claims={claims}
              onGo={go}
              onIssue={issue}
              onApprove={(record) => {
                const next = { ...record, status: "Ready to issue" };
                setApplications((a) =>
                  a.map((x) => (x.id === record.id ? next : x)),
                );
                setModal({
                  type: "detail",
                  entity: "application",
                  record: next,
                });
                notify(
                  "Demo underwriting accepted. Ready for simulated issuance.",
                );
              }}
              onClaim={updateClaim}
              onReceipt={(r) => {
                const next = { ...r, status: "Paid" };
                setReceipts((a) => a.map((x) => (x.id === r.id ? next : x)));
                setModal({
                  type: "detail",
                  entity: "collection",
                  record: next,
                });
                notify("Demo receipt recorded. No real payment collected.");
              }}
              notify={notify}
            />
          )}
        </Modal>
      )}
    </div>
  );
}

function ApplicationForm({ defaultProduct, customers, onSave, onCancel }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState(() => {
    const p = products.find((p) => p.name === (defaultProduct || "Term Life"));
    return {
      name: customers[0].name,
      product: p.name,
      amount: Number(p.cover.replace(/[^0-9]/g, "")),
      premium: Number(p.premium),
    };
  });
  const [consent, setConsent] = useState(false);
  const chosen = products.find((p) => p.name === data.product);
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
          else onSave({ ...data, status: "Under review" });
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
                    setData({
                      ...data,
                      product: p.name,
                      premium: Number(p.premium),
                      amount: Number(p.cover.replace(/[^0-9]/g, "")),
                    });
                  }}
                >
                  {products.map((p) => (
                    <option key={p.name}>{p.name}</option>
                  ))}
                </Select>
              </Field>
              <Field
                label={
                  data.product === "Care Cash"
                    ? "Daily benefit (BWP)"
                    : "Cover amount (BWP)"
                }
              >
                <input
                  type="number"
                  className="input"
                  min="1"
                  required
                  value={data.amount}
                  onChange={(e) =>
                    setData({ ...data, amount: Number(e.target.value) })
                  }
                />
              </Field>
            </div>
            <div className="quote-summary">
              <span>Illustrative monthly premium</span>
              <strong>
                BWP {chosen.premium}
                <small> / month</small>
              </strong>
              <p>
                Fixed demo premium. Changing cover does not calculate a real
                quote.
              </p>
            </div>
          </>
        ) : (
          <>
            <h3>Looking good. Let’s review.</h3>
            <div className="detail-grid">
              {[
                ["Customer", data.name],
                ["Product", data.product],
                ["Illustrative cover", money(data.amount)],
                ["Monthly premium", money(data.premium)],
              ].map(([k, v]) => (
                <div className="detail-item" key={k}>
                  <small>{k}</small>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              I understand this is a demo submission and does not create
              insurance cover.
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
              onClick={() => onSave({ ...data, status: "Draft" })}
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
function CustomerForm({ onSave, onCancel }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave(Object.fromEntries(f));
      }}
    >
      <p className="subtitle">
        Add a fictional customer to explore the onboarding journey.
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
      </div>
      <div className="notice">
        <Icon name="Info" />
        <p>
          Use fictional information only. New profiles start with pending
          verification.
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
function ClaimForm({ customers, onSave, onCancel }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget));
        onSave({ ...f, amount: Number(f.amount) });
      }}
    >
      <p className="subtitle">
        Start with the essentials. Evidence can be gathered next.
      </p>
      <div className="field-grid">
        <Field label="Customer">
          <Select name="name" className="select">
            {customers.map((c) => (
              <option key={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Product">
          <Select name="product" className="select">
            {products.map((p) => (
              <option key={p.name}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Benefit type">
          <Select name="type" className="select">
            <option>Hospital admission</option>
            <option>Funeral benefit</option>
            <option>Death benefit</option>
            <option>Disability benefit</option>
          </Select>
        </Field>
        <Field label="Claimed amount (BWP)">
          <input
            name="amount"
            className="input"
            type="number"
            min="1"
            required
            placeholder="25000"
          />
        </Field>
        <Field label="Event date">
          <input
            name="eventDate"
            className="input"
            type="date"
            max="2026-09-29"
            required
          />
        </Field>
        <Field label="Brief description" full>
          <textarea
            name="description"
            className="textarea"
            required
            placeholder="Tell us a little about the event…"
            rows={3}
          />
        </Field>
      </div>
      <div className="modal-footer">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" icon="Check">
          Register demo claim
        </Button>
      </div>
    </form>
  );
}
function Detail({
  entity,
  record: r,
  policies,
  claims,
  onGo,
  onIssue,
  onApprove,
  onClaim,
  onReceipt,
  notify,
}) {
  const [tab, setTab] = useState("Overview");
  const [evidence, setEvidence] = useState(false);
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
                  ["Verification", r.status],
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
                      <strong>{p.product}</strong>
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
              <Button
                variant="secondary"
                icon="ArrowRight"
                onClick={() => onGo("applications")}
              >
                Open applications
              </Button>
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
              {seedCustomers.slice(0, 3).map((c, i) => (
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
              {entity === "claim" && (
                <div className="notice">
                  <Icon name="HeartHandshake" />
                  <p>
                    <strong>{r.type}</strong>
                    <br />
                    {r.description ||
                      "Review the supporting evidence and benefit details before making a decision."}
                  </p>
                </div>
              )}
              <h3 className="section-title">Evidence checklist</h3>
              {[
                "Identity verification",
                "Application / claim declaration",
                "Supporting documentation",
              ].map((t, i) => (
                <div className="checklist-item" key={t}>
                  <Icon
                    name={
                      i === 2 && !evidence && r.status === "Evidence needed"
                        ? "Clock3"
                        : "CircleCheck"
                    }
                  />
                  <span>{t}</span>
                  <Badge>
                    {i === 2 && !evidence && r.status === "Evidence needed"
                      ? "Pending"
                      : "Verified"}
                  </Badge>
                </div>
              ))}
              <div className="detail-actions">
                {entity === "application" && r.status === "Ready to issue" && (
                  <Button icon="ShieldCheck" onClick={() => onIssue(r)}>
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
                {entity === "claim" && !["Settled"].includes(r.status) && (
                  <Button
                    icon="Check"
                    disabled={r.status === "Evidence needed" && !evidence}
                    onClick={() => onClaim(r)}
                  >
                    {r.status === "Approved"
                      ? "Simulate settlement"
                      : "Simulate approval"}
                  </Button>
                )}
                {entity === "collection" && r.status !== "Paid" && (
                  <Button icon="Wallet" onClick={() => onReceipt(r)}>
                    Record demo receipt
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
              <p className="muted small">
                Actions are simulated. No cover, financial transaction, or real
                approval is created.
              </p>
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
                This is a scripted summary of the displayed demo record.
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
              notify("Supporting evidence marked received in this demo view.");
            }}
          >
            Simulate evidence received
          </Button>
        </>
      ) : (
        <div className="timeline">
          {[
            [
              "Record created",
              r.date || "24 Sep 2026",
              "Demo record entered into the workspace.",
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
          <p>4 fictional members · no upload needed</p>
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
