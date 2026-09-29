import Select from "./ui/Select";
import React, { useState, useId } from "react";
import {
  Plus,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Layers3,
  SlidersHorizontal,
  ShieldCheck,
  Users,
  Wallet,
  Eye,
  Copy,
  FileText,
  Save,
  Sparkles,
  Search,
  ChevronRight,
  Info,
} from "lucide-react";
import "./product-config.css";
import { ProductDraftPrompt, StepReveal, BorderBeam } from "./ui/animated";

const base = {
  name: "",
  code: "",
  domain: "Individual Life",
  currency: "BWP",
  description: "",
  effective: "2026-10-01",
  minAge: 18,
  maxAge: 65,
  waiting: 3,
  cover: 500000,
  premium: 420,
  frequency: "Monthly",
  grace: 30,
  underwriting: "Manual review",
  benefits: ["Death benefit"],
  channels: ["Broker portal"],
  wording: "Standard life wording · v1.0",
  approvals: false,
};
export const initialProductConfigs = [
  {
    ...base,
    id: "CFG-001",
    name: "Term Life Essential",
    code: "TL-ESS",
    description: "Simple, dependable protection for a fixed term.",
    benefits: ["Death benefit", "Accidental death"],
    status: "Demo active",
    version: 1,
  },
  {
    ...base,
    id: "CFG-002",
    name: "Family Funeral Plus",
    code: "FF-PLUS",
    description: "A little support for the people who matter most.",
    cover: 50000,
    premium: 185,
    waiting: 6,
    benefits: ["Funeral benefit", "Accidental death"],
    status: "In review",
    version: 1,
  },
  {
    ...base,
    id: "CFG-003",
    name: "Care Cash Flex",
    code: "CC-FLEX",
    description: "Everyday support when life needs a little extra care.",
    cover: 1000,
    premium: 265,
    benefits: ["Hospital cash"],
    status: "Draft",
    version: 1,
  },
];
const steps = [
  ["The essentials", "Name, identity & launch date", Layers3],
  ["Benefits & eligibility", "What’s covered, and for whom", ShieldCheck],
  ["Pricing & operations", "Premiums, channels & servicing", Wallet],
  ["Review & publish", "Bring it all together", Eye],
];
const benefitChoices = [
  ["Death benefit", "Lump-sum protection for nominated beneficiaries.", "🛡️"],
  ["Accidental death", "Additional protection for an accidental event.", "✦"],
  ["Funeral benefit", "Support for funeral expenses and family needs.", "🌿"],
  ["Hospital cash", "An illustrative cash benefit for a hospital stay.", "💚"],
];
function Field({ label, children, hint }) {
  const id = useId();
  return (
    <label className="form-label">
      <span id={id}>{label}</span>
      {React.cloneElement(children, { "aria-labelledby": id })}
      {hint && <small className="config-field-hint">{hint}</small>}
    </label>
  );
}
function Status({ value }) {
  return (
    <span
      className={
        "badge " +
        (value === "Demo active"
          ? "green"
          : value === "In review"
            ? "amber"
            : "gray")
      }
    >
      {value}
    </span>
  );
}
const amount = (v, c = "BWP") => c + " " + Number(v).toLocaleString("en-GB");

export default function ProductConfig({ records, setRecords, notify }) {
  const [editing, setEditing] = useState(null);
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [errors, setErrors] = useState({});
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const start = (record, copy = false) => {
    setEditing(
      record
        ? {
            ...record,
            id: copy ? null : record.id,
            name: copy ? record.name + " copy" : record.name,
            code: copy ? record.code + "-COPY" : record.code,
            status: copy ? "Draft" : record.status,
            benefits: [...record.benefits],
            channels: [...record.channels],
            approvals: false,
          }
        : {
            ...base,
            benefits: [...base.benefits],
            channels: [...base.channels],
          },
    );
    setStep(0);
    setErrors({});
    setCancelConfirm(false);
    window.scrollTo(0, 0);
  };
  const update = (key, value) => {
    setEditing((p) => ({ ...p, [key]: value }));
    setErrors({});
  };
  const toggle = (key, value) =>
    update(
      key,
      editing[key].includes(value)
        ? editing[key].filter((x) => x !== value)
        : [...editing[key], value],
    );
  const validate = (part, all = false) => {
    const e = {};
    if (all || part === 0) {
      if (!editing.name.trim()) e.name = "Give your product a name.";
      if (!/^[A-Z0-9-]{2,20}$/.test(editing.code))
        e.code = "Use 2–20 uppercase letters, numbers, or hyphens.";
      if (records.some((p) => p.code === editing.code && p.id !== editing.id))
        e.code = "This code is already in use. Choose a unique code.";
      if (!editing.effective) e.effective = "Choose an effective date.";
    }
    if (all || part === 1) {
      if (!editing.benefits.length) e.benefits = "Select at least one benefit.";
      if (
        editing.minAge === "" ||
        editing.maxAge === "" ||
        Number(editing.minAge) < 0 ||
        Number(editing.maxAge) > 100 ||
        Number(editing.minAge) > Number(editing.maxAge)
      )
        e.age =
          "Entry ages must be between 0 and 100, with minimum no higher than maximum.";
      if (!(Number(editing.cover) > 0))
        e.cover = "Enter a cover amount greater than zero.";
      if (
        editing.waiting === "" ||
        Number(editing.waiting) < 0 ||
        Number(editing.waiting) > 36
      )
        e.waiting = "Waiting period must be 0–36 months.";
    }
    if (all || part === 2) {
      if (!(Number(editing.premium) > 0))
        e.premium = "Enter a sample premium greater than zero.";
      if (
        editing.grace === "" ||
        Number(editing.grace) < 0 ||
        Number(editing.grace) > 90
      )
        e.grace = "Grace period must be 0–90 days.";
      if (!editing.channels.length)
        e.channels = "Choose at least one distribution channel.";
    }
    if (part === 3 && !editing.approvals)
      e.approvals = "Confirm that these are illustrative settings.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const save = (status) => {
    if (status === "Draft") {
      if (!validate(0)) {
        setStep(0);
        return;
      }
    } else if (!validate(3, true)) return;
    const saved = {
      ...editing,
      name: editing.name.trim(),
      id: editing.id || "CFG-" + Date.now().toString(36).toUpperCase(),
      status,
      version: editing.id ? (editing.version || 1) + 1 : 1,
    };
    setRecords((list) =>
      editing.id
        ? list.map((p) => (p.id === editing.id ? saved : p))
        : [saved, ...list],
    );
    setEditing(null);
    notify(
      status === "Demo active"
        ? "Product activated in the configuration demo. No live sales enabled."
        : status === "In review"
          ? "Product configuration submitted to the demo review queue."
          : "Product draft saved. Continue editing whenever you’re ready.",
    );
  };
  const filtered = records.filter(
    (p) =>
      (filter === "All" || p.status === filter) &&
      (p.name + " " + p.code + " " + p.domain)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const errorList = Object.values(errors);

  if (!editing)
    return (
      <>
        <div className="page-heading">
          <div>
            <div className="eyebrow">DESIGN THE NEXT CHAPTER</div>
            <h1>A little configuration. A lot of possibility.</h1>
            <p className="subtitle">
              Shape your next insurance product, one thoughtful detail at a
              time.
            </p>
          </div>
          <button className="btn primary" onClick={() => start()}>
            <Plus className="icon icon-sm" />
            Create product
          </button>
        </div>
        <div className="config-banner">
          <div className="config-banner-icon">
            <SlidersHorizontal size={30} />
          </div>
          <div>
            <span className="eyebrow">PRODUCT STUDIO</span>
            <h2>From an idea to a ready-to-review product.</h2>
            <p>
              Configure benefits, eligibility and pricing in a guided workspace.
              No code needed.
            </p>
          </div>
          <span className="badge purple">
            <Sparkles size={13} /> Interactive prototype
          </span>
        </div>
        <ProductDraftPrompt
          onDraft={(draft) => {
            const suffix = records.filter((p) =>
              p.code.startsWith(draft.code),
            ).length;
            start({
              ...base,
              ...draft,
              code: draft.code + (suffix ? "-" + (suffix + 1) : ""),
              status: "Draft",
              version: 1,
            });
            notify(
              "Sample blueprint prepared. Review and edit the illustrative settings.",
            );
          }}
        />
        <div className="config-stats">
          {[
            ["All configurations", records.length, Layers3, "green"],
            [
              "Work in progress",
              records.filter((p) => p.status === "Draft").length,
              FileText,
              "purple",
            ],
            [
              "Awaiting review",
              records.filter((p) => p.status === "In review").length,
              Eye,
              "amber",
            ],
            [
              "Demo active",
              records.filter((p) => p.status === "Demo active").length,
              ShieldCheck,
              "blue",
            ],
          ].map(([label, value, Icon, color]) => (
            <div className="config-stat" key={label}>
              <span className={"stat-icon " + color}>
                <Icon size={19} />
              </span>
              <div>
                <strong>{value}</strong>
                <small>{label}</small>
              </div>
            </div>
          ))}
        </div>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Your product configurations</h2>
              <p className="subtitle">
                A home for ideas, drafts, and everything in between.
              </p>
            </div>
          </div>
          <div className="filters">
            <div className="filter-tabs">
              {["All", "Draft", "In review", "Demo active"].map((s) => (
                <button
                  className={"filter-tab " + (s === filter ? "active" : "")}
                  key={s}
                  onClick={() => setFilter(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            <label className="search-box">
              <Search size={16} />
              <input
                aria-label="Search configurations"
                placeholder="Search products or codes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Business line</th>
                  <th>Benefits</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="person-cell">
                        <span className="config-product-mark">
                          <Layers3 size={19} />
                        </span>
                        <div>
                          <strong className="person-name">{p.name}</strong>
                          <div className="person-sub">
                            {p.code} · {p.currency}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{p.domain}</td>
                    <td>{p.benefits.length} configured</td>
                    <td>v{p.version}.0</td>
                    <td>
                      <Status value={p.status} />
                    </td>
                    <td>
                      <div className="config-row-actions">
                        <button
                          className="text-link"
                          onClick={() => start(p)}
                          aria-label={"Configure " + p.name}
                        >
                          Configure <ChevronRight size={14} />
                        </button>
                        <button
                          className="icon-btn"
                          onClick={() => start(p, true)}
                          aria-label={"Duplicate " + p.name}
                        >
                          <Copy size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && (
              <div className="empty-state">
                <Search />
                <h3>No configurations found</h3>
                <p>Try another search, or create a new product.</p>
              </div>
            )}
          </div>
          <div className="table-footer">
            {filtered.length} configurations
            <span>Changes stay in this session</span>
          </div>
        </section>
        <div className="notice">
          <Info className="icon" />
          <p>
            <strong>A space to experiment.</strong> These settings are dummy
            configurations. They do not change the sales catalogue, calculate
            real premiums, or enable live insurance products.
          </p>
        </div>
      </>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <button
            className="text-link config-back"
            onClick={() => setCancelConfirm(true)}
          >
            <ArrowLeft size={15} /> All configurations
          </button>
          <h1>
            {editing.id
              ? "Make a good product even better."
              : "Let’s bring your next product to life."}
          </h1>
          <p className="subtitle">
            {editing.id
              ? editing.code + " · Editing configuration"
              : "A guided setup, from the essentials to the finishing touches."}
          </p>
        </div>
        <button className="btn secondary" onClick={() => save("Draft")}>
          <Save size={16} />
          Save draft
        </button>
      </div>
      {cancelConfirm && (
        <div className="config-confirm" role="alert">
          <div>
            <strong>Leave the editor?</strong>
            <p>
              Unsaved changes will be discarded. You can save a draft first.
            </p>
          </div>
          <button
            className="btn secondary"
            onClick={() => setCancelConfirm(false)}
          >
            Keep editing
          </button>
          <button className="btn primary" onClick={() => setEditing(null)}>
            Discard changes
          </button>
        </div>
      )}
      <div className="config-builder">
        <aside className="config-steps">
          <div className="eyebrow">YOUR PRODUCT BLUEPRINT</div>
          {steps.map(([title, sub, Icon], i) => (
            <button
              key={title}
              className={
                "config-step " +
                (i === step ? "current" : i < step ? "done" : "")
              }
              disabled={i > step}
              onClick={() => {
                setStep(i);
                setErrors({});
              }}
            >
              <span className="config-step-number">
                {i < step ? <Check size={16} /> : i + 1}
              </span>
              <span>
                <strong>{title}</strong>
                <small>{sub}</small>
              </span>
            </button>
          ))}
          <div className="config-help">
            <span>🌱</span>
            <strong>Room to grow.</strong>
            <p>
              Start simple. You can come back and refine your configuration any
              time.
            </p>
          </div>
        </aside>
        <form
          className="panel config-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (step < 3 && validate(step)) {
              setStep(step + 1);
              window.scrollTo(0, 0);
            } else if (step === 3) save("In review");
          }}
        >
          <div className="config-form-heading">
            <span className="config-step-pill">STEP {step + 1} OF 4</span>
            <h2>{steps[step][0]}</h2>
            <p>{steps[step][1]}. All settings are illustrative.</p>
          </div>
          {errorList.length > 0 && (
            <div className="config-errors" role="alert">
              <strong>Let’s check a few details.</strong>
              <ul>
                {errorList.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <StepReveal step={step}>
            {step === 0 && (
              <div className="config-form-body">
                <div className="field-grid">
                  <Field label="Product name">
                    <input
                      className="input"
                      value={editing.name}
                      placeholder="e.g. LifeCare Essential"
                      onChange={(e) => update("name", e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Product code"
                    hint="A unique internal reference, e.g. LC-ESS."
                  >
                    <input
                      className="input"
                      value={editing.code}
                      maxLength={20}
                      placeholder="LC-ESS"
                      onChange={(e) =>
                        update("code", e.target.value.toUpperCase())
                      }
                    />
                  </Field>
                  <Field label="Business line">
                    <Select
                      className="select"
                      value={editing.domain}
                      onChange={(e) => update("domain", e.target.value)}
                    >
                      <option>Individual Life</option>
                      <option>Group Life</option>
                    </Select>
                  </Field>
                  <Field label="Currency">
                    <Select
                      className="select"
                      value={editing.currency}
                      onChange={(e) => update("currency", e.target.value)}
                    >
                      <option>BWP</option>
                      <option>ZAR</option>
                      <option>USD</option>
                    </Select>
                  </Field>
                  <Field label="Effective date">
                    <input
                      className="input"
                      type="date"
                      value={editing.effective}
                      onChange={(e) => update("effective", e.target.value)}
                    />
                  </Field>
                  <Field label="Wording package">
                    <Select
                      className="select"
                      value={editing.wording}
                      onChange={(e) => update("wording", e.target.value)}
                    >
                      <option>Standard life wording · v1.0</option>
                      <option>Family protection wording · v1.0</option>
                      <option>Group life wording · v1.0</option>
                    </Select>
                  </Field>
                </div>
                <Field label="A short description">
                  <textarea
                    className="textarea"
                    rows={3}
                    value={editing.description}
                    placeholder="What makes this product right for your customers?"
                    onChange={(e) => update("description", e.target.value)}
                  />
                </Field>
              </div>
            )}
            {step === 1 && (
              <div className="config-form-body">
                <h3>Choose the protection you want to offer</h3>
                <p className="subtitle">Select one or more sample benefits.</p>
                <div className="config-benefits">
                  {benefitChoices.map(([name, desc, emoji]) => (
                    <label
                      className={
                        "config-benefit " +
                        (editing.benefits.includes(name) ? "selected" : "")
                      }
                      key={name}
                    >
                      <span className="config-benefit-emoji">{emoji}</span>
                      <span>
                        <strong>{name}</strong>
                        <small>{desc}</small>
                      </span>
                      <input
                        type="checkbox"
                        checked={editing.benefits.includes(name)}
                        onChange={() => toggle("benefits", name)}
                      />
                    </label>
                  ))}
                </div>
                <h3 className="section-title">Set a few ground rules</h3>
                <div className="field-grid">
                  <Field label="Minimum entry age">
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="100"
                      value={editing.minAge}
                      onChange={(e) => update("minAge", e.target.value)}
                    />
                  </Field>
                  <Field label="Maximum entry age">
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="100"
                      value={editing.maxAge}
                      onChange={(e) => update("maxAge", e.target.value)}
                    />
                  </Field>
                  <Field
                    label={
                      "Illustrative benefit limit (" + editing.currency + ")"
                    }
                    hint="A single sample limit for this configuration."
                  >
                    <input
                      className="input"
                      type="number"
                      min="1"
                      value={editing.cover}
                      onChange={(e) => update("cover", e.target.value)}
                    />
                  </Field>
                  <Field label="Waiting period (months)">
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="36"
                      value={editing.waiting}
                      onChange={(e) => update("waiting", e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="config-form-body">
                <div className="config-inline-note">
                  <Sparkles size={19} />
                  <p>
                    Keep it simple for the showcase. Set a fixed sample premium
                    to preview the experience.
                  </p>
                </div>
                <div className="field-grid">
                  <Field label={"Sample premium (" + editing.currency + ")"}>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      value={editing.premium}
                      onChange={(e) => update("premium", e.target.value)}
                    />
                  </Field>
                  <Field label="Premium frequency">
                    <Select
                      className="select"
                      value={editing.frequency}
                      onChange={(e) => update("frequency", e.target.value)}
                    >
                      <option>Monthly</option>
                      <option>Quarterly</option>
                      <option>Annually</option>
                    </Select>
                  </Field>
                  <Field label="Grace period (days)">
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="90"
                      value={editing.grace}
                      onChange={(e) => update("grace", e.target.value)}
                    />
                  </Field>
                  <Field label="Underwriting approach">
                    <Select
                      className="select"
                      value={editing.underwriting}
                      onChange={(e) => update("underwriting", e.target.value)}
                    >
                      <option>Manual review</option>
                      <option>Rules-based referral (demo)</option>
                      <option>Simplified acceptance (demo)</option>
                    </Select>
                  </Field>
                </div>
                <h3 className="section-title">Where will customers find it?</h3>
                <div className="config-channel-list">
                  {[
                    "Broker portal",
                    "Customer portal",
                    "Operations workspace",
                    "Employer portal",
                  ].map((channel) => (
                    <label className="config-channel" key={channel}>
                      <input
                        type="checkbox"
                        checked={editing.channels.includes(channel)}
                        onChange={() => toggle("channels", channel)}
                      />
                      <Users size={17} />
                      {channel}
                    </label>
                  ))}
                </div>
                <p className="config-field-hint">
                  Channel selections are descriptive and do not change portal
                  access.
                </p>
              </div>
            )}
            {step === 3 && (
              <div className="config-form-body">
                <div className="config-review-intro">
                  <span className="stat-icon green">
                    <CheckCircle2 size={22} />
                  </span>
                  <div>
                    <h3>Looking good. One last look?</h3>
                    <p className="subtitle">
                      Your product blueprint is ready for a simulated review.
                    </p>
                  </div>
                </div>
                <div className="config-review-grid">
                  {[
                    ["Product", editing.name],
                    [
                      "Code & version",
                      editing.code +
                        " · v" +
                        (editing.id ? (editing.version || 1) + 1 : 1) +
                        ".0",
                    ],
                    ["Business line", editing.domain],
                    ["Effective date", editing.effective],
                    [
                      "Entry ages",
                      editing.minAge + "–" + editing.maxAge + " years",
                    ],
                    ["Waiting period", editing.waiting + " months"],
                    ["Benefit limit", amount(editing.cover, editing.currency)],
                    [
                      "Sample premium",
                      amount(editing.premium, editing.currency) +
                        " · " +
                        editing.frequency,
                    ],
                    ["Grace period", editing.grace + " days"],
                    ["Underwriting", editing.underwriting],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <small>{k}</small>
                      <strong>{v}</strong>
                    </div>
                  ))}
                </div>
                <div className="config-review-section">
                  <small>INCLUDED BENEFITS</small>
                  <div className="config-tags">
                    {editing.benefits.map((b) => (
                      <span key={b}>
                        <Check size={13} />
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="config-review-section">
                  <small>DISTRIBUTION CHANNELS</small>
                  <p>{editing.channels.join(" · ")}</p>
                </div>
                <div className="config-review-section">
                  <small>WORDING PACKAGE</small>
                  <p>{editing.wording}</p>
                </div>
                <label className="checkbox-label config-ack">
                  <input
                    type="checkbox"
                    checked={editing.approvals}
                    onChange={(e) => update("approvals", e.target.checked)}
                  />
                  <span>
                    I understand this is a dummy configuration. Publishing only
                    changes its status in this demo; no real insurance product
                    is enabled.
                  </span>
                </label>
              </div>
            )}
          </StepReveal>
          <div className="config-form-footer">
            <button
              type="button"
              className="btn secondary"
              onClick={() =>
                step > 0 ? setStep(step - 1) : setCancelConfirm(true)
              }
            >
              <ArrowLeft size={15} />
              {step > 0 ? "Back" : "Cancel"}
            </button>
            <div>
              {step === 3 && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => save("Demo active")}
                >
                  <ShieldCheck size={15} />
                  Activate demo
                </button>
              )}
              <button type="submit" className="btn primary">
                {step === 3 ? "Submit for review" : "Continue"}
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </form>
        <aside className="config-preview">
          <span className="eyebrow">YOUR PRODUCT AT A GLANCE</span>
          <div className="config-preview-card" style={{ position: "relative" }}>
            <BorderBeam />
            <span className="config-preview-icon">
              <ShieldCheck size={30} />
            </span>
            <span className="badge green">{editing.domain}</span>
            <h2>{editing.name || "Your next great product"}</h2>
            <p>
              {editing.description ||
                "A little peace of mind, thoughtfully designed."}
            </p>
            <div className="config-preview-amount">
              <small>ILLUSTRATIVE BENEFIT LIMIT</small>
              <strong>{amount(editing.cover, editing.currency)}</strong>
            </div>
            <ul>
              {editing.benefits.map((b) => (
                <li key={b}>
                  <Check size={14} />
                  {b}
                </li>
              ))}
            </ul>
            <div className="config-preview-price">
              <strong>{amount(editing.premium, editing.currency)}</strong>
              <small>{editing.frequency.toLowerCase()} · sample premium</small>
            </div>
          </div>
          <p className="config-preview-note">
            <Eye size={14} />
            Preview updates as you configure.
          </p>
          <p className="config-preview-note">
            Not a quotation. Product rules and rates are illustrative.
          </p>
        </aside>
      </div>
    </>
  );
}
