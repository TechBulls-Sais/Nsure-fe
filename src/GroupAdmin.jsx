import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import { request } from "./api";
import {
  Badge,
  Button,
  DataTable,
  Drawer,
  ErrorNote,
  Field,
  FormGrid,
  Heading,
  Panel,
  Stat,
  Tabs,
  can,
  pula,
  useAction,
  useConfirm,
  useResource,
  when,
} from "./ui/workspace";
import "./group-admin.css";

// Group administration (GL01-GL05): schemes and benefit categories, members as cover episodes with underwriting of
// cover above the free-cover limit, staged census batches with an explicit commit, and monthly scheme billing.

const CENSUS_HEADER = "memberKey,firstName,lastName,dateOfBirth,category,salary,action,effectiveDate";

const MEMBER_TONES = {
  ACTIVE: "green",
  UNDERWRITING_PENDING: "amber",
  PARTIALLY_ACCEPTED: "blue",
  DECLINED: "red",
  CEASED: "gray",
};
const ROW_TONES = { VALID: "green", APPLIED: "green", INVALID: "red", REJECTED: "red" };
const INVOICE_TONES = { ISSUED: "blue", PARTIALLY_PAID: "amber", PAID: "green" };

const label = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());

const day = (value) =>
  value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const number = (value, digits = 0) =>
  value === null || value === undefined || value === ""
    ? "—"
    : Number(value).toLocaleString("en-GB", {
        minimumFractionDigits: digits,
        maximumFractionDigits: Math.max(digits, 4),
      });

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const plusYear = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${Number(y) + 1}-${m}-${d}`;
};

function basisText(category) {
  return category.benefitBasis === "SALARY_MULTIPLE"
    ? `${number(category.salaryMultiple)} × salary`
    : `Fixed ${pula(category.fixedCover)}`;
}

function saveTextFile(name, text, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── scheme list ─────────────────────────────────────────────────────────────────────────────────

export default function GroupAdmin({ session, notify, profile }) {
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const schemes = useResource(session, "/group/schemes", []);

  if (selected) {
    return (
      <SchemeDetail
        session={session}
        notify={notify}
        profile={profile}
        schemeRef={selected}
        onBack={() => {
          setSelected(null);
          schemes.reload();
        }}
      />
    );
  }

  const rows = schemes.data || [];
  const totals = rows.reduce(
    (acc, s) => ({
      members: acc.members + s.activeMembers,
      pending: acc.pending + s.pendingUnderwriting,
      premium: acc.premium + Number(s.monthlyPremium || 0),
      outstanding: acc.outstanding + Number(s.outstandingBalance || 0),
    }),
    { members: 0, pending: 0, premium: 0, outstanding: 0 },
  );
  const loading = schemes.loading && !rows.length;

  return (
    <div className="group-admin">
      <Heading
        eyebrow="GROUP LIFE"
        title="Group administration"
        subtitle="Schemes, benefit categories, census, member underwriting and sponsor billing."
      >
        {can(profile, "MANAGE_SCHEME") && (
          <Button icon={Plus} onClick={() => setCreating(true)}>
            New scheme
          </Button>
        )}
      </Heading>

      <div className="stat-grid ga-stats">
        <Stat label="Schemes" value={rows.length} note="Under administration" loading={loading} />
        <Stat
          label="Members on cover"
          value={totals.members.toLocaleString("en-GB")}
          note={`${totals.pending} pending underwriting`}
          tone="blue"
          loading={loading}
        />
        <Stat label="Monthly premium" value={pula(totals.premium)} note="Accepted cover only" tone="purple" loading={loading} />
        <Stat label="Outstanding" value={pula(totals.outstanding)} note="Unpaid scheme invoices" tone="amber" loading={loading} />
      </div>

      {creating && (
        <NewSchemeForm
          session={session}
          notify={notify}
          onCancel={() => setCreating(false)}
          onCreated={(ref) => {
            setCreating(false);
            schemes.reload();
            setSelected(ref);
          }}
        />
      )}

      <ErrorNote error={schemes.error} />
      {loading ? (
        <p className="ga-muted">Loading schemes…</p>
      ) : (
        <div className="scheme-grid ga-scheme-grid">
          {rows.map((s) => (
            <article className="scheme-card panel" key={s.ref}>
              <div className="scheme-card-top">
                <span className={"avatar " + (s.color || "green")}>{s.initials}</span>
                <div>
                  <h2>{s.name}</h2>
                  <p className="subtitle">
                    {s.ref} · {s.sector}
                  </p>
                </div>
                <Badge>{label(s.status)}</Badge>
              </div>
              <div className="scheme-meta">
                <div>
                  <small>Members on cover</small>
                  <strong>{s.activeMembers}</strong>
                </div>
                <div>
                  <small>Monthly premium</small>
                  <strong>{pula(s.monthlyPremium)}</strong>
                </div>
              </div>
              <div className="ga-card-flags">
                <span>{s.categories} categor{s.categories === 1 ? "y" : "ies"}</span>
                {s.pendingUnderwriting > 0 && <Badge tone="amber">{s.pendingUnderwriting} pending underwriting</Badge>}
                {Number(s.outstandingBalance) > 0 && <Badge tone="red">{pula(s.outstandingBalance)} outstanding</Badge>}
              </div>
              <div className="scheme-renewal">
                <CalendarDays className="icon icon-sm" aria-hidden="true" /> Renews {day(s.renewalDate)}
              </div>
              <Button variant="secondary" icon={ArrowRight} onClick={() => setSelected(s.ref)}>
                Open scheme
              </Button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function NewSchemeForm({ session, notify, onCancel, onCreated }) {
  const [form, setForm] = useState({
    name: "",
    sector: "",
    inceptionDate: today(),
    renewalDate: plusYear(today()),
    billingFrequency: "MONTHLY",
  });
  const action = useAction(notify);
  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({
      ...f,
      [key]: value,
      ...(key === "inceptionDate" && f.renewalDate === plusYear(f.inceptionDate) ? { renewalDate: plusYear(value) } : {}),
    }));
  };
  const submit = async () => {
    const r = await action.run(
      () => request(session, "/group/schemes", { method: "POST", body: form }),
      "Scheme created",
    );
    if (r) onCreated(r.data.scheme.ref);
  };
  return (
    <Drawer
      title="New scheme"
      description="The sponsor's scheme year and billing arrangement. Add benefit categories next."
      onClose={onCancel}
    >
      <FormGrid onSubmit={submit} busy={action.busy} error={action.error} submitLabel="Create scheme">
        <Field label="Scheme name">
          <input className="input" value={form.name} onChange={set("name")} maxLength={100} required />
        </Field>
        <Field label="Sector">
          <input className="input" value={form.sector} onChange={set("sector")} maxLength={80} required />
        </Field>
        <Field label="Inception date">
          <input className="input" type="date" value={form.inceptionDate} onChange={set("inceptionDate")} required />
        </Field>
        <Field label="Renewal date">
          <input className="input" type="date" value={form.renewalDate} onChange={set("renewalDate")} required />
        </Field>
        <Field label="Billing frequency" hint="Monthly billing in arrears of the period start.">
          <select className="select" value={form.billingFrequency} onChange={set("billingFrequency")}>
            <option value="MONTHLY">Monthly</option>
          </select>
        </Field>
      </FormGrid>
    </Drawer>
  );
}

// ── scheme detail ───────────────────────────────────────────────────────────────────────────────

function SchemeDetail({ session, notify, profile, schemeRef, onBack }) {
  const [tab, setTab] = useState("categories");
  const detail = useResource(session, `/group/schemes/${encodeURIComponent(schemeRef)}`);
  const d = detail.data;
  const scheme = d?.scheme;
  const shared = { session, notify, profile, detail: d, loading: detail.loading, reload: detail.reload };

  return (
    <div className="group-admin">
      <Heading
        eyebrow={scheme ? `${scheme.ref} · ${scheme.sector}` : schemeRef}
        title={scheme?.name || "Scheme"}
        subtitle={
          scheme
            ? `Scheme year ${day(scheme.inceptionDate)} – ${day(scheme.renewalDate)} · ${label(scheme.billingFrequency)} billing`
            : undefined
        }
      >
        <Button variant="secondary" icon={ArrowLeft} onClick={onBack}>
          All schemes
        </Button>
      </Heading>
      <ErrorNote error={detail.error} />
      {!d ? (
        <p className="ga-muted">{detail.loading ? "Loading scheme…" : ""}</p>
      ) : (
        <>
          <div className="stat-grid ga-stats">
            <Stat label="Members on cover" value={scheme.activeMembers} note={`${d.categories.length} benefit categories`} />
            <Stat
              label="Pending underwriting"
              value={scheme.pendingUnderwriting}
              note="Cover above the free-cover limit"
              tone={scheme.pendingUnderwriting ? "amber" : "green"}
            />
            <Stat label="Monthly premium" value={pula(scheme.monthlyPremium)} note="On accepted cover" tone="purple" />
            <Stat
              label="Outstanding"
              value={pula(scheme.outstandingBalance)}
              note={`${d.invoices.length} invoice(s)`}
              tone={Number(scheme.outstandingBalance) > 0 ? "red" : "green"}
            />
          </div>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              ["categories", `Categories (${d.categories.length})`],
              ["members", `Members (${d.members.length})`],
              ["census", `Census (${d.censusBatches.length})`],
              ["billing", `Billing (${d.invoices.length})`],
            ]}
          />
          {tab === "categories" && <CategoriesTab {...shared} />}
          {tab === "members" && <MembersTab {...shared} />}
          {tab === "census" && <CensusTab {...shared} />}
          {tab === "billing" && <BillingTab {...shared} />}
        </>
      )}
    </div>
  );
}

// ── categories ──────────────────────────────────────────────────────────────────────────────────

const EMPTY_CATEGORY = {
  code: "",
  name: "",
  benefitBasis: "SALARY_MULTIPLE",
  salaryMultiple: "3",
  fixedCover: "",
  freeCoverLimit: "500000",
  ratePerMille: "0.45",
  minEntryAge: "18",
  maxEntryAge: "64",
};

function CategoriesTab({ session, notify, profile, detail, loading, reload }) {
  const manage = can(profile, "MANAGE_SCHEME");
  const [editing, setEditing] = useState(null); // null: closed, "": new, code: edit
  const [form, setForm] = useState(EMPTY_CATEGORY);
  const action = useAction(notify);
  const scheme = detail.scheme;

  const open = (category) => {
    action.setError("");
    if (!category) {
      setForm(EMPTY_CATEGORY);
      setEditing("");
      return;
    }
    setForm({
      code: category.code,
      name: category.name,
      benefitBasis: category.benefitBasis,
      salaryMultiple: category.salaryMultiple != null ? String(Number(category.salaryMultiple)) : "",
      fixedCover: category.fixedCover != null ? String(Number(category.fixedCover)) : "",
      freeCoverLimit: String(Number(category.freeCoverLimit)),
      ratePerMille: String(Number(category.ratePerMille)),
      minEntryAge: String(category.minEntryAge),
      maxEntryAge: String(category.maxEntryAge),
    });
    setEditing(category.code);
  };
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    const body = {
      ...form,
      salaryMultiple: form.benefitBasis === "SALARY_MULTIPLE" ? form.salaryMultiple : null,
      fixedCover: form.benefitBasis === "FIXED" ? form.fixedCover : null,
    };
    const path = `/group/schemes/${scheme.ref}/categories` + (editing ? `/${encodeURIComponent(editing)}` : "");
    const r = await action.run(
      () => request(session, path, { method: editing ? "PUT" : "POST", body }),
      editing ? `Category ${editing} updated` : "Category added",
    );
    if (r) {
      setEditing(null);
      reload();
    }
  };

  const columns = [
    { key: "code", label: "Code", render: (c) => <span className="ws-mono">{c.code}</span> },
    { key: "name", label: "Category" },
    { key: "basis", label: "Benefit", render: basisText, sortValue: basisText },
    { key: "freeCoverLimit", label: "Free cover limit", align: "right", render: (c) => pula(c.freeCoverLimit) },
    { key: "ratePerMille", label: "Rate ‰ / month", align: "right", render: (c) => number(c.ratePerMille, 2) },
    { key: "ages", label: "Entry ages", render: (c) => `${c.minEntryAge}–${c.maxEntryAge}`, sortValue: (c) => c.minEntryAge },
    { key: "activeMembers", label: "Members", align: "right" },
  ];
  if (manage) {
    columns.push({
      key: "actions",
      label: "",
      render: (c) => (
        <div className="ws-row-actions">
          <Button variant="secondary" icon={Pencil} onClick={() => open(c)}>
            Edit
          </Button>
        </div>
      ),
    });
  }

  return (
    <>
      <Panel
        title="Benefit categories"
        subtitle="Cover is a salary multiple or a fixed amount; above the free-cover limit it needs underwriting."
        action={
          manage ? (
            <Button icon={Plus} onClick={() => open(null)}>
              Add category
            </Button>
          ) : null
        }
      >
        <DataTable
          columns={columns}
          rows={detail.categories}
          loading={loading}
          rowKey={(c) => c.code}
          empty="No benefit categories yet"
          emptyDetail="Add a category for each class of employee; census rows and members refer to it by its code."
          searchPlaceholder="Search code or category name…"
        />
      </Panel>
      {manage && editing !== null && (
        <Drawer
          title={editing ? `Edit category ${editing}` : "New benefit category"}
          description={
            editing
              ? "Changes apply prospectively: members already on cover keep the cover recorded on their episode."
              : "Cover is a salary multiple or a fixed amount; above the free-cover limit it needs underwriting."
          }
          onClose={() => setEditing(null)}
        >
          <FormGrid
            onSubmit={submit}
            busy={action.busy}
            error={action.error}
            submitLabel={editing ? "Save category" : "Add category"}
          >
            <Field label="Code" hint="Letters, digits, - and _; used in the census file.">
              <input
                className="input"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                disabled={Boolean(editing)}
                maxLength={20}
                required
              />
            </Field>
            <Field label="Name">
              <input className="input" value={form.name} onChange={set("name")} maxLength={100} required />
            </Field>
            <Field label="Benefit basis">
              <select className="select" value={form.benefitBasis} onChange={set("benefitBasis")}>
                <option value="SALARY_MULTIPLE">Salary multiple</option>
                <option value="FIXED">Fixed cover</option>
              </select>
            </Field>
            {form.benefitBasis === "SALARY_MULTIPLE" ? (
              <Field label="Salary multiple" hint="Cover = annual salary × multiple.">
                <input className="input" type="number" min="0" step="0.0001" value={form.salaryMultiple} onChange={set("salaryMultiple")} required />
              </Field>
            ) : (
              <Field label="Fixed cover (BWP)">
                <input className="input" type="number" min="0" step="0.01" value={form.fixedCover} onChange={set("fixedCover")} required />
              </Field>
            )}
            <Field label="Free cover limit (BWP)" hint="Cover above this is pending underwriting.">
              <input className="input" type="number" min="0" step="0.01" value={form.freeCoverLimit} onChange={set("freeCoverLimit")} required />
            </Field>
            <Field label="Rate per mille (monthly)" hint="Monthly premium per BWP 1 000 of accepted cover.">
              <input className="input" type="number" min="0" step="0.0001" value={form.ratePerMille} onChange={set("ratePerMille")} required />
            </Field>
            <Field label="Minimum entry age">
              <input className="input" type="number" min="0" max="100" value={form.minEntryAge} onChange={set("minEntryAge")} required />
            </Field>
            <Field label="Maximum entry age">
              <input className="input" type="number" min="0" max="100" value={form.maxEntryAge} onChange={set("maxEntryAge")} required />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

// ── members and underwriting ────────────────────────────────────────────────────────────────────

function MembersTab({ session, notify, profile, detail, loading, reload }) {
  const underwrite = can(profile, "UNDERWRITE_MEMBER");
  const [status, setStatus] = useState("ON_COVER");
  const [search, setSearch] = useState("");
  const [deciding, setDeciding] = useState(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return detail.members.filter((m) => {
      if (status === "ON_COVER" && ["CEASED", "DECLINED"].includes(m.status)) return false;
      if (status !== "ON_COVER" && status !== "ALL" && m.status !== status) return false;
      return !q || m.memberKey.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
    });
  }, [detail.members, status, search]);

  const columns = [
    { key: "memberKey", label: "Member", sortValue: (m) => m.name, render: (m) => (
      <div className="ga-person">
        <strong>{m.name}</strong>
        <span className="ws-mono">{m.memberKey}</span>
      </div>
    ) },
    { key: "category", label: "Category", render: (m) => <span title={m.categoryName}>{m.category}</span> },
    { key: "salary", label: "Salary", align: "right", render: (m) => (m.salary != null ? pula(m.salary) : "—") },
    { key: "status", label: "Status", render: (m) => <Badge tone={MEMBER_TONES[m.status]}>{label(m.status)}</Badge> },
    { key: "joinDate", label: "Cover dates", render: (m) => (
      <span className="ga-nowrap">{day(m.joinDate)}{m.exitDate ? ` – ${day(m.exitDate)}` : ""}</span>
    ) },
    { key: "acceptedCover", label: "Accepted cover", align: "right", render: (m) => pula(m.acceptedCover) },
    { key: "pendingCover", label: "Pending", align: "right", render: (m) =>
      Number(m.pendingCover) > 0 ? <strong className="ga-pending">{pula(m.pendingCover)}</strong> : "—" },
    { key: "monthlyPremium", label: "Premium / month", align: "right", render: (m) => pula(m.monthlyPremium) },
  ];
  if (underwrite) {
    columns.push({
      key: "actions",
      label: "",
      render: (m) =>
        m.status === "UNDERWRITING_PENDING" ? (
          <div className="ws-row-actions">
            <Button icon={ShieldCheck} onClick={() => setDeciding(m)}>
              Decide
            </Button>
          </div>
        ) : m.underwritingDecision ? (
          <span className="ga-muted" title={m.underwritingReason || ""}>
            {m.underwritingDecision === "ACCEPT" ? "Accepted" : "Declined"} by {m.underwrittenBy}
          </span>
        ) : null,
    });
  }

  return (
    <>
      {deciding && (
        <UnderwritingPanel
          session={session}
          notify={notify}
          member={deciding}
          onClose={() => setDeciding(null)}
          onDone={() => {
            setDeciding(null);
            reload();
          }}
        />
      )}
      <Panel
        title="Members"
        subtitle="Each row is a cover episode. Pending cover is never billed or certified until it is accepted."
        action={
          <div className="ga-filters">
            <input
              className="input"
              placeholder="Search name or key"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search members"
            />
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
              <option value="ON_COVER">On cover</option>
              <option value="UNDERWRITING_PENDING">Underwriting pending</option>
              <option value="PARTIALLY_ACCEPTED">Partially accepted</option>
              <option value="ACTIVE">Active</option>
              <option value="CEASED">Ceased</option>
              <option value="DECLINED">Declined</option>
              <option value="ALL">All</option>
            </select>
          </div>
        }
      >
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          rowKey={(m) => m.id}
          empty="No members match"
          emptyDetail={
            detail.members.length
              ? "Try another status or clear the search."
              : "Members join through a committed census batch on the Census tab."
          }
          searchFrom={Infinity}
        />
      </Panel>
    </>
  );
}

function UnderwritingPanel({ session, notify, member, onClose, onDone }) {
  const [decision, setDecision] = useState("ACCEPT");
  const [amount, setAmount] = useState(String(Number(member.requestedCover)));
  const [reason, setReason] = useState("");
  const action = useAction(notify);
  const confirm = useConfirm();

  const submit = async () => {
    const accept = decision === "ACCEPT";
    const ok = await confirm({
      title: accept ? `Accept cover for ${member.name}?` : `Decline pending cover for ${member.name}?`,
      message: accept ? (
        <>
          <strong>{member.name}</strong> ({member.memberKey}) goes on cover for <strong>{pula(amount)}</strong> of the{" "}
          {pula(member.requestedCover)} requested. Accepted cover is billed and certified from now on, and the decision is
          recorded against your name.
        </>
      ) : (
        <>
          The pending <strong>{pula(member.pendingCover)}</strong> for <strong>{member.name}</strong> ({member.memberKey})
          is declined; only the free cover of {pula(member.acceptedCover)} stays in force. The decision is recorded against
          your name.
        </>
      ),
      confirmLabel: accept ? "Accept cover" : "Decline pending cover",
      tone: accept ? undefined : "danger",
    });
    if (!ok) return;
    const body = { decision, reason: reason || null };
    if (decision === "ACCEPT") body.acceptedAmount = amount;
    const r = await action.run(
      () => request(session, `/group/members/${member.id}/underwriting`, { method: "POST", body }),
      decision === "ACCEPT" ? `Cover accepted for ${member.name}` : `Pending cover declined for ${member.name}`,
    );
    if (r) onDone();
  };

  return (
    <Drawer
      title={`Underwriting decision · ${member.name}`}
      description={`${member.memberKey} · ${member.category}`}
      onClose={onClose}
    >
      <div className="ws-kv">
        <div>
          <small>Requested cover</small>
          <strong>{pula(member.requestedCover)}</strong>
        </div>
        <div>
          <small>Free cover in force</small>
          <strong>{pula(member.acceptedCover)}</strong>
        </div>
        <div>
          <small>Pending underwriting</small>
          <strong className="ga-pending">{pula(member.pendingCover)}</strong>
        </div>
        <div>
          <small>Salary</small>
          <strong>{member.salary != null ? pula(member.salary) : "—"}</strong>
        </div>
      </div>
      <FormGrid
        onSubmit={submit}
        busy={action.busy}
        error={action.error}
        submitLabel={decision === "ACCEPT" ? "Accept cover" : "Decline pending cover"}
      >
        <Field label="Decision">
          <select className="select" value={decision} onChange={(e) => setDecision(e.target.value)}>
            <option value="ACCEPT">Accept (in full or in part)</option>
            <option value="DECLINE">Decline the pending amount</option>
          </select>
        </Field>
        {decision === "ACCEPT" ? (
          <Field
            label="Accepted cover (BWP)"
            hint={`Between ${pula(member.acceptedCover)} and ${pula(member.requestedCover)}.`}
          >
            <input
              className="input"
              type="number"
              step="0.01"
              min={Number(member.acceptedCover)}
              max={Number(member.requestedCover)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Field>
        ) : (
          <Field label="Cover kept" hint="The free-cover portion stays in force.">
            <input className="input" value={pula(member.acceptedCover)} disabled />
          </Field>
        )}
        <Field label={decision === "DECLINE" ? "Reason (required)" : "Reason or evidence note"} full>
          <textarea
            className="textarea"
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required={decision === "DECLINE"}
          />
        </Field>
      </FormGrid>
    </Drawer>
  );
}

// ── census ──────────────────────────────────────────────────────────────────────────────────────

function CensusTab({ session, notify, profile, detail, loading, reload }) {
  const canProcess = can(profile, "PROCESS_CENSUS");
  const scheme = detail.scheme;
  const confirm = useConfirm();
  const [batchRef, setBatchRef] = useState(null);
  const [batch, setBatch] = useState(null);
  const [batchError, setBatchError] = useState("");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [form, setForm] = useState(() => ({
    externalBatchId: `${scheme.ref}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`,
    mode: "PARTIAL",
    csv: "",
  }));
  const [fileName, setFileName] = useState("");
  const upload = useAction(notify);
  const commit = useAction(notify);

  useEffect(() => {
    if (!batchRef) {
      setBatch(null);
      return;
    }
    let live = true;
    request(session, `/group/census-batches/${encodeURIComponent(batchRef)}`)
      .then((r) => live && (setBatch(r.data), setBatchError("")))
      .catch((e) => live && setBatchError(e.message));
    return () => {
      live = false;
    };
  }, [session, batchRef]);

  const template = () => {
    const codes = detail.categories.map((c) => c.code);
    const first = codes[0] || "STAFF";
    const lines = [
      CENSUS_HEADER,
      `EMP-1001,Kagiso,Sebina,1988-04-12,${first},180000,JOIN,${today()}`,
      `EMP-1002,Naledi,Kgosi,1992-09-03,${codes[1] || first},240000,JOIN,${today()}`,
      `EMP-0999,,,,,,LEAVE,${today()}`,
      `EMP-0998,,,,,210000,SALARY,${today()}`,
    ];
    saveTextFile(`census-template-${scheme.ref}.csv`, lines.join("\n") + "\n");
  };

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      upload.setError("The census file must be smaller than 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, csv: String(reader.result || "") }));
      setFileName(file.name);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const submit = async () => {
    const r = await upload.run(
      () =>
        request(session, `/group/schemes/${scheme.ref}/census-batches`, {
          method: "POST",
          body: form,
        }),
      "Census staged for review — nothing is live until you commit",
    );
    if (r) {
      setBatch(r.data);
      setBatchRef(r.data.ref);
      setErrorsOnly(r.data.invalidRows > 0);
      reload();
    }
  };

  const doCommit = async () => {
    const ok = await confirm({
      title: `Commit batch ${batch.ref}?`,
      message:
        batch.mode === "ATOMIC" ? (
          <>
            All <strong>{batch.totalRows}</strong> row(s) of {batch.externalBatchId} are applied to the live membership of{" "}
            <strong>{scheme.name}</strong>: joiners go on cover, leavers cease and salary changes re-rate cover and premium
            from each row's effective date.
          </>
        ) : (
          <>
            <strong>{batch.validRows}</strong> valid row(s) of {batch.externalBatchId} are applied to the live membership of{" "}
            <strong>{scheme.name}</strong>
            {batch.invalidRows > 0 && (
              <>
                {" "}and <strong>{batch.invalidRows}</strong> invalid row(s) are rejected
              </>
            )}
            . Joiners go on cover, leavers cease and salary changes re-rate cover and premium from each row's effective
            date.
          </>
        ),
      confirmLabel: batch.mode === "ATOMIC" ? "Commit all rows" : `Commit ${batch.validRows} row(s)`,
    });
    if (!ok) return;
    const r = await commit.run(
      () => request(session, `/group/census-batches/${batch.ref}/commit`, { method: "POST" }),
      null,
    );
    if (r) {
      setBatch(r.data);
      notify?.(`Batch ${r.data.ref} committed: ${r.data.acceptedRows} accepted, ${r.data.rejectedRows} rejected`);
      reload();
    }
  };

  const rows = batch ? (errorsOnly ? batch.rows.filter((r) => r.error) : batch.rows) : [];
  const atomicBlocked = batch && batch.mode === "ATOMIC" && batch.invalidRows > 0;

  return (
    <>
      {canProcess && (
        <Panel
          title="Upload census"
          subtitle="Rows are validated and staged; live membership changes only when you commit the batch."
          action={
            <Button variant="secondary" icon={Download} onClick={template}>
              Template
            </Button>
          }
        >
          <FormGrid onSubmit={submit} busy={upload.busy} error={upload.error} submitLabel="Validate batch">
            <Field label="External batch id" hint="Resubmitting the same id and file returns the same batch.">
              <input
                className="input"
                value={form.externalBatchId}
                onChange={(e) => setForm((f) => ({ ...f, externalBatchId: e.target.value }))}
                maxLength={80}
                required
              />
            </Field>
            <Field
              label="Commit mode"
              hint={form.mode === "ATOMIC" ? "All rows must be valid or nothing is applied." : "Valid rows are applied; invalid rows are rejected."}
            >
              <select className="select" value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}>
                <option value="PARTIAL">Partial — apply valid rows</option>
                <option value="ATOMIC">Atomic — all or nothing</option>
              </select>
            </Field>
            <Field label="CSV file" full hint={fileName ? `Loaded ${fileName}` : `Header: ${CENSUS_HEADER}`}>
              <label className="btn secondary ga-file">
                <FileSpreadsheet className="icon icon-sm" aria-hidden="true" />
                Choose .csv file
                <input type="file" accept=".csv,text/csv" onChange={pickFile} />
              </label>
            </Field>
            <Field label="Or paste the CSV" full>
              <textarea
                className="textarea ws-textarea ws-mono"
                value={form.csv}
                placeholder={CENSUS_HEADER}
                onChange={(e) => {
                  setForm((f) => ({ ...f, csv: e.target.value }));
                  setFileName("");
                }}
                required
              />
            </Field>
          </FormGrid>
        </Panel>
      )}

      <Panel title="Census batches" subtitle="Select a batch to see every row's outcome.">
        <DataTable
          rows={detail.censusBatches}
          loading={loading}
          rowKey={(b) => b.ref}
          empty="No census batches yet"
          emptyDetail="Upload the sponsor's census file; each upload is staged here as a batch for review before commit."
          searchPlaceholder="Search batch, external id, status…"
          onRowClick={(b) => setBatchRef(b.ref)}
          columns={[
            { key: "ref", label: "Batch", render: (b) => (
              <span className={"ws-mono" + (b.ref === batchRef ? " ga-current" : "")}>{b.ref}</span>
            ) },
            { key: "externalBatchId", label: "External id" },
            { key: "mode", label: "Mode", render: (b) => label(b.mode) },
            { key: "status", label: "Status", render: (b) => <Badge>{label(b.status)}</Badge> },
            { key: "rows", label: "Rows (valid / invalid)", sortValue: (b) => b.totalRows, render: (b) =>
              `${b.totalRows} (${b.validRows} / ${b.invalidRows})` },
            { key: "outcome", label: "Accepted / rejected", sortValue: (b) => (b.status === "COMMITTED" ? b.acceptedRows : null),
              render: (b) => (b.status === "COMMITTED" ? `${b.acceptedRows} / ${b.rejectedRows}` : "—") },
            { key: "submittedAt", label: "Submitted", render: (b) => `${when(b.submittedAt)} · ${b.submittedBy}` },
          ]}
        />
      </Panel>

      {batchRef && (
        <Drawer
          size="lg"
          title={batch ? `Batch ${batch.ref} · ${batch.externalBatchId}` : `Batch ${batchRef}`}
          description={
            !batch
              ? undefined
              : batch.status === "COMMITTED"
                ? `Committed ${when(batch.committedAt)} by ${batch.committedBy}`
                : "Validation preview — nothing has been applied yet."
          }
          onClose={() => {
            setBatchRef(null);
            setBatchError("");
          }}
          footer={
            batch && canProcess && batch.status === "VALIDATED" ? (
              <Button icon={Check} busy={commit.busy} disabled={atomicBlocked || batch.validRows === 0} onClick={doCommit}>
                Commit {batch.mode === "ATOMIC" ? "all rows" : `${batch.validRows} valid row(s)`}
              </Button>
            ) : null
          }
        >
          <ErrorNote error={batchError} />
          {!batch ? (
            !batchError && <p className="ga-muted">Loading batch…</p>
          ) : (
            <>
              <div className="ws-kv">
                <div>
                  <small>Status</small>
                  <strong>
                    <Badge>{label(batch.status)}</Badge>
                  </strong>
                </div>
                <div>
                  <small>Mode</small>
                  <strong>{label(batch.mode)}</strong>
                </div>
                <div>
                  <small>Rows</small>
                  <strong>{batch.totalRows}</strong>
                </div>
                <div>
                  <small>Valid / invalid</small>
                  <strong>
                    {batch.validRows} / <span className={batch.invalidRows ? "ga-bad" : ""}>{batch.invalidRows}</span>
                  </strong>
                </div>
                {batch.status === "COMMITTED" && (
                  <div>
                    <small>Accepted / rejected</small>
                    <strong>
                      <span className="ga-good">{batch.acceptedRows}</span> / <span className="ga-bad">{batch.rejectedRows}</span>
                    </strong>
                  </div>
                )}
                <div>
                  <small>File hash (SHA-256)</small>
                  <strong className="ws-mono" title={batch.fileHash}>{batch.fileHash.slice(0, 16)}…</strong>
                </div>
              </div>
              {atomicBlocked && (
                <ErrorNote error="This ATOMIC batch has invalid rows, so it cannot be committed. Correct the file and submit it under a new batch id." />
              )}
              <ErrorNote error={commit.error} />
              <label className="ga-check">
                <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} />
                Show only rows with errors
              </label>
              <DataTable
                rows={rows}
                rowKey={(r) => r.lineNo}
                empty={errorsOnly ? "No row errors" : "No rows"}
                emptyDetail={errorsOnly ? "Every row in this batch passed validation." : "The file had no data rows under the header."}
                searchPlaceholder="Search member key, name, category, error…"
                columns={[
                  { key: "lineNo", label: "Line", align: "right" },
                  { key: "memberKey", label: "Member key", render: (r) => <span className="ws-mono">{r.memberKey || "—"}</span> },
                  { key: "name", label: "Name", sortValue: (r) => [r.firstName, r.lastName].filter(Boolean).join(" "), render: (r) =>
                    [r.firstName, r.lastName].filter(Boolean).join(" ") || "—" },
                  { key: "dateOfBirth", label: "Born" },
                  { key: "category", label: "Category" },
                  { key: "salary", label: "Salary", align: "right" },
                  { key: "action", label: "Action" },
                  { key: "effectiveDate", label: "Effective" },
                  { key: "status", label: "Outcome", render: (r) => <Badge tone={ROW_TONES[r.status]}>{label(r.status)}</Badge> },
                  { key: "error", label: "Errors", render: (r) => (r.error ? <span className="ga-row-error">{r.error}</span> : "—") },
                ]}
              />
            </>
          )}
        </Drawer>
      )}
    </>
  );
}

// ── billing ─────────────────────────────────────────────────────────────────────────────────────

function BillingTab({ session, notify, profile, detail, loading, reload }) {
  const bill = can(profile, "BILL_SCHEME");
  const scheme = detail.scheme;
  const [period, setPeriod] = useState(thisMonth());
  const [selected, setSelected] = useState(null);
  const issue = useAction(notify);
  const confirm = useConfirm();

  const invoice = detail.invoices.find((i) => i.ref === selected);

  const generate = async () => {
    const issued = detail.invoices.find((i) => i.period === period);
    const ok = await confirm({
      title: `Generate the ${period} invoice?`,
      message: issued ? (
        <>
          Invoice <strong>{issued.ref}</strong> already covers {period} for {scheme.name}; generating again returns that
          invoice rather than billing the sponsor twice.
        </>
      ) : (
        <>
          <strong>{scheme.name}</strong> is billed for {period} on the accepted cover of its{" "}
          {scheme.activeMembers} member(s) on cover, pro-rated by days covered for anyone joining or leaving mid-month. The
          invoice is issued straight away and adds to the scheme's outstanding balance.
        </>
      ),
      confirmLabel: "Generate invoice",
    });
    if (!ok) return;
    const r = await issue.run(
      () => request(session, `/group/schemes/${scheme.ref}/invoices`, { method: "POST", body: { period } }),
      null,
    );
    if (r) {
      const existed = detail.invoices.some((i) => i.ref === r.data.ref);
      notify?.(existed ? `Invoice ${r.data.ref} for ${period} already exists` : `Invoice ${r.data.ref} issued for ${pula(r.data.amount)}`);
      setSelected(r.data.ref);
      reload();
    }
  };

  return (
    <>
      {bill && (
        <Panel title="Issue invoice" subtitle="One invoice per month. Members joining or leaving mid-month are pro-rated by days covered.">
          <FormGrid onSubmit={generate} busy={issue.busy} error={issue.error} submitLabel="Generate invoice">
            <Field label="Billing month">
              <input className="input" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required />
            </Field>
          </FormGrid>
        </Panel>
      )}
      <Panel title="Invoices" subtitle="Select an invoice for its member lines and receipts.">
        <DataTable
          rows={detail.invoices}
          loading={loading}
          rowKey={(i) => i.ref}
          empty="No invoices issued yet"
          emptyDetail={bill ? "Generate an invoice for a billing month above to bill the sponsor." : "Invoices appear here once the scheme is billed for a month."}
          searchPlaceholder="Search invoice, period, status…"
          onRowClick={(i) => setSelected(i.ref)}
          columns={[
            { key: "ref", label: "Invoice", render: (i) => (
              <span className={"ws-mono" + (i.ref === selected ? " ga-current" : "")}>{i.ref}</span>
            ) },
            { key: "period", label: "Period" },
            { key: "memberCount", label: "Members", align: "right" },
            { key: "amount", label: "Amount", align: "right", render: (i) => pula(i.amount) },
            { key: "paidAmount", label: "Paid", align: "right", render: (i) => pula(i.paidAmount) },
            { key: "outstanding", label: "Outstanding", align: "right", render: (i) =>
              Number(i.outstanding) > 0 ? <strong className="ga-bad">{pula(i.outstanding)}</strong> : pula(0) },
            { key: "status", label: "Status", render: (i) => <Badge tone={INVOICE_TONES[i.status]}>{label(i.status)}</Badge> },
            { key: "issuedAt", label: "Issued", render: (i) => when(i.issuedAt) },
          ]}
        />
      </Panel>
      {invoice && (
        <InvoiceDetail
          key={invoice.ref}
          session={session}
          notify={notify}
          bill={bill}
          invoice={invoice}
          reload={reload}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function InvoiceDetail({ session, notify, bill, invoice, reload, onClose }) {
  const [form, setForm] = useState({ amount: String(Number(invoice.outstanding)), reference: "" });
  const action = useAction(notify);

  const submit = async () => {
    const r = await action.run(
      () =>
        request(session, `/group/invoices/${invoice.ref}/receipts`, {
          method: "POST",
          body: { amount: form.amount, reference: form.reference },
        }),
      null,
    );
    if (r) {
      const inv = r.data.invoice;
      notify?.(
        inv.status === "PAID"
          ? `Receipt ${r.data.receipt.ref} allocated — invoice paid`
          : `Receipt ${r.data.receipt.ref} allocated — ${pula(inv.outstanding)} still outstanding`,
      );
      setForm({ amount: String(Number(inv.outstanding)), reference: "" });
      reload();
    }
  };

  return (
    <Drawer
      size="lg"
      title={`Invoice ${invoice.ref} · ${invoice.period}`}
      description={`${day(invoice.periodStart)} – ${day(invoice.periodEnd)} · premium = accepted cover ÷ 1 000 × rate × days covered ÷ days in month`}
      onClose={onClose}
    >
      <section className="ga-drawer-section">
        <h3>Member lines</h3>
        <DataTable
          rows={invoice.lines}
          rowKey={(l) => l.memberId}
          empty="No lines"
          emptyDetail="No member had accepted cover during this billing month."
          searchPlaceholder="Search member name, key, category…"
          columns={[
            { key: "memberName", label: "Member", render: (l) => (
              <div className="ga-person">
                <strong>{l.memberName}</strong>
                <span className="ws-mono">{l.memberKey}</span>
              </div>
            ) },
            { key: "category", label: "Cat." },
            { key: "acceptedCover", label: "Cover", align: "right", render: (l) => number(l.acceptedCover, 2) },
            { key: "ratePerMille", label: "Rate ‰", align: "right", render: (l) => number(l.ratePerMille, 2) },
            { key: "days", label: "Days", align: "right", sortValue: (l) => l.daysCovered, render: (l) => (
              <span className={l.daysCovered < l.daysInPeriod ? "ga-prorata" : ""}>
                {l.daysCovered}/{l.daysInPeriod}
              </span>
            ) },
            { key: "premium", label: "Premium", align: "right", render: (l) => pula(l.premium) },
          ]}
        />
      </section>
      <section className="ga-drawer-section">
        <h3>Sponsor receipts</h3>
        <p className="subtitle">
          Paid {pula(invoice.paidAmount)} of {pula(invoice.amount)} · {pula(invoice.outstanding)} outstanding
        </p>
        <DataTable
          rows={invoice.receipts}
          rowKey={(r) => r.ref}
          empty="No receipts allocated"
          emptyDetail={bill ? "Allocate the sponsor's payment below when it arrives." : "Receipts appear here once the sponsor's payment is allocated."}
          searchPlaceholder="Search receipt or payer reference…"
          columns={[
            { key: "ref", label: "Receipt", render: (r) => <span className="ws-mono">{r.ref}</span> },
            { key: "reference", label: "Payer ref" },
            { key: "amount", label: "Amount", align: "right", render: (r) => pula(r.amount) },
            { key: "outstandingAfter", label: "Balance after", align: "right", render: (r) => pula(r.outstandingAfter) },
            { key: "receivedAt", label: "Received", render: (r) => when(r.receivedAt) },
          ]}
        />
        {Number(invoice.outstanding) <= 0 && (
          <p className="ga-paid">
            <Receipt className="icon icon-sm" aria-hidden="true" /> Paid in full
          </p>
        )}
      </section>
      {bill && Number(invoice.outstanding) > 0 && (
        <FormGrid onSubmit={submit} busy={action.busy} error={action.error} submitLabel="Allocate receipt">
          <Field label="Amount (BWP)" hint="A short payment leaves the balance outstanding.">
            <input
              className="input"
              type="number"
              min="0.01"
              step="0.01"
              max={Number(invoice.outstanding)}
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
          </Field>
          <Field label="Payment reference" hint="Re-sending the same reference does not allocate twice.">
            <input
              className="input"
              value={form.reference}
              maxLength={80}
              onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              required
            />
          </Field>
        </FormGrid>
      )}
    </Drawer>
  );
}

