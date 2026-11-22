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
import { ActivationWizard } from "./GroupLife";

// Group administration (GL01-GL05): schemes and benefit categories, members as cover episodes with underwriting of
// cover above the free-cover limit, staged census batches with an explicit commit, and monthly scheme billing.

const CENSUS_HEADER = "memberKey,firstName,lastName,dateOfBirth,category,salary,action,effectiveDate";
// Optional trailing columns: the actively-at-work declaration (Y/N) and the date the member became eligible.
const CENSUS_OPTIONAL = "activelyAtWork,eligibleDate,rowKey";

const MEMBER_TONES = {
  ACTIVE: "green",
  UNDERWRITING_PENDING: "amber",
  PARTIALLY_ACCEPTED: "blue",
  DECLINED: "red",
  CEASED: "gray",
  SUSPENDED: "amber",
  COVER_DEFERRED: "amber",
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
// Every write on these screens shows its error next to the form or button that failed, so the error is not raised
// a second time as a toast over the drawer's actions (D-41).
const inlineErrors = (notify) => (message, tone) => {
  if (tone !== "error") notify?.(message, tone);
};
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

const csvCell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  // Quote cells with separators, and neutralise spreadsheet formulas in values that came from the uploaded file.
  const safe = /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** The batch's results file (NS-UX-002): every row of the file with its outcome, error and resulting member. */
function batchResultsCsv(batch) {
  const head = [
    "batch", "externalBatchId", "lineNo", "rowKey", "memberKey", "firstName", "lastName", "dateOfBirth", "category",
    "salary", "action", "effectiveDate", "outcome", "errors", "memberId", "changeId",
  ];
  const lines = batch.rows.map((r) =>
    [batch.ref, batch.externalBatchId, r.lineNo, r.rowKey, r.memberKey, r.firstName, r.lastName, r.dateOfBirth,
      r.category, r.salary, r.action, r.effectiveDate, r.status, r.error, r.memberId, r.changeId].map(csvCell).join(","),
  );
  return [head.join(","), ...lines].join("\n") + "\n";
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
  const queue = useResource(session, "/group/underwriting-queue", []);
  const arrears = useResource(session, "/group/arrears", []);
  const [deciding, setDeciding] = useState(null);

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
            New scheme (set-up)
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
                <Badge tone={s.status === "SETUP" ? "amber" : undefined}>{s.status === "SETUP" ? "In set-up" : label(s.status)}</Badge>
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

      <Panel
        title="Member underwriting queue"
        subtitle="Cover pending underwriting across all schemes, oldest first: requested against the free-cover limit, the actively-at-work declaration, why it was referred, evidence outstanding and decisions waiting for authority or the member."
        action={can(profile, "UNDERWRITE_MEMBER") ? <ExpiryRun session={session} notify={notify} onDone={queue.reload} /> : null}
      >
        <ErrorNote error={queue.error} />
        <DataTable
          rows={queue.data}
          loading={queue.loading}
          rowKey={(m) => m.memberId}
          empty="Nothing waiting for underwriting"
          searchPlaceholder="Search scheme, member…"
          columns={[
            { key: "schemeRef", label: "Scheme", render: (m) => `${m.schemeRef} · ${m.schemeName}` },
            { key: "memberKey", label: "Member", render: (m) => (
              <div className="ga-person">
                <strong>{m.name}</strong>
                <span className="ws-mono">{m.memberKey}</span>
              </div>
            ) },
            { key: "requestedCover", label: "Requested", align: "right", render: (m) => pula(m.requestedCover) },
            { key: "freeCoverLimit", label: "Free cover limit", align: "right", render: (m) => pula(m.freeCoverLimit) },
            { key: "pendingCover", label: "Pending", align: "right", render: (m) => <strong className="ga-pending">{pula(m.pendingCover)}</strong> },
            { key: "activelyAtWork", label: "At work", render: (m) => (m.activelyAtWork == null ? "Not declared" : m.activelyAtWork ? "Yes" : "No") },
            { key: "referredBecause", label: "Referred because", render: (m) => m.referredBecause || "—" },
            { key: "evidenceOutstanding", label: "Evidence", render: (m) => (m.evidenceOutstanding > 0 ? <Badge tone="amber">{m.evidenceOutstanding} outstanding</Badge> : <span className="ga-muted">Complete</span>) },
            { key: "decisionStatus", label: "Decision", render: (m) => (m.decisionStatus ? <Badge tone="blue">{m.decisionStatus === "OFFERED" ? "Offer with member" : "Awaiting authority"}</Badge> : "—") },
            { key: "schemeCoverPending", label: "Scheme pending / in force", align: "right", render: (m) => `${pula(m.schemeCoverPending)} / ${pula(m.schemeCoverInForce)}` },
            { key: "waitingSince", label: "Waiting since", render: (m) => when(m.waitingSince) },
            ...(can(profile, "UNDERWRITE_MEMBER")
              ? [{
                  key: "act",
                  label: "",
                  render: (m) =>
                    m.schemeStatus === "ACTIVE" ? (
                      <Button icon={ShieldCheck} onClick={() => setDeciding({ ...m, id: m.memberId, salary: null })}>
                        Decide
                      </Button>
                    ) : (
                      <span className="ga-muted">Scheme {label(m.schemeStatus)}</span>
                    ),
                }]
              : []),
          ]}
        />
      </Panel>
      {deciding && (
        <UnderwritingPanel
          session={session}
          notify={notify}
          member={deciding}
          onClose={() => setDeciding(null)}
          onDone={() => {
            setDeciding(null);
            queue.reload();
            schemes.reload();
          }}
        />
      )}

      <Panel title="Arrears" subtitle="Scheme invoices still owed after their billing month ended, oldest first.">
        <ErrorNote error={arrears.error} />
        <DataTable
          rows={arrears.data}
          loading={arrears.loading}
          rowKey={(i) => i.invoiceRef}
          empty="No scheme is in arrears"
          searchPlaceholder="Search scheme, invoice…"
          columns={[
            { key: "invoiceRef", label: "Invoice", render: (i) => <span className="ws-mono">{i.invoiceRef}</span> },
            { key: "schemeRef", label: "Scheme", render: (i) => `${i.schemeRef} · ${i.schemeName}` },
            { key: "period", label: "Period" },
            { key: "policyYear", label: "Year", align: "right", render: (i) => i.policyYear ?? "—" },
            { key: "outstanding", label: "Outstanding", align: "right", render: (i) => <strong className="ga-bad">{pula(i.outstanding)}</strong> },
            { key: "disputedAmount", label: "Disputed", align: "right", render: (i) => (Number(i.disputedAmount) > 0 ? pula(i.disputedAmount) : "—") },
            { key: "daysOverdue", label: "Days overdue", align: "right" },
            { key: "status", label: "Status", render: (i) => <Badge tone={INVOICE_TONES[i.status]}>{label(i.status)}</Badge> },
          ]}
        />
      </Panel>
    </div>
  );
}

/** Lapses underwriting offers past their expiry now (the daily run, on demand): MemberDecisionExpired. */
function ExpiryRun({ session, notify, onDone }) {
  const action = useAction(notify);
  const run = async () => {
    const r = await action.run(() => request(session, "/group/underwriting/expiry-run", { method: "POST" }));
    if (r) {
      notify?.(r.data.expired ? `${r.data.expired} expired offer(s) lapsed` : "No offer has expired", "success");
      onDone();
    }
  };
  return (
    <Button variant="secondary" busy={action.busy} onClick={run}>
      Lapse expired offers
    </Button>
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
  const action = useAction(inlineErrors(notify));
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
      description="Creates the master record in set-up: categories can be prepared, but there is no cover, census or billing until it is activated from an accepted quotation on the approved wording."
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
  const [activating, setActivating] = useState(false);
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
            ? `Policy year ${scheme.policyYear ?? 1} to ${day(scheme.renewalDate)} · in force from ${day(scheme.inceptionDate)} · ${label(scheme.billingFrequency)} billing` +
              (scheme.quoteRef ? ` · accepted terms ${scheme.quoteRef}` : "")
            : undefined
        }
      >
        {scheme && <Badge tone={scheme.status === "ACTIVE" ? "green" : ["SUSPENDED", "SETUP"].includes(scheme.status) ? "amber" : undefined}>{scheme.status === "SETUP" ? "In set-up" : label(scheme.status)}</Badge>}
        {scheme?.status === "SETUP" && can(profile, "MANAGE_SCHEME") && (
          <Button icon={ShieldCheck} onClick={() => setActivating(true)}>
            Activate master policy
          </Button>
        )}
        {d && can(profile, "MANAGE_SCHEME") && !d.members.length && !d.censusBatches.length && !d.invoices.length && (
          <DeleteScheme session={session} notify={notify} scheme={scheme} onDeleted={onBack} />
        )}
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
              ["claims", "Claims"],
              ["timeline", "Timeline & rules"],
            ]}
          />
          {activating && (
            <ActivationWizard
              session={session}
              notify={notify}
              scheme={d}
              onClose={() => setActivating(false)}
              onDone={() => {
                setActivating(false);
                detail.reload();
              }}
            />
          )}
          {scheme.status !== "ACTIVE" && (
            <p className="ga-status-note" role="status">
              {scheme.status === "SETUP"
                ? "This scheme is in set-up: prepare its categories, then activate it from an accepted quotation on the approved wording. Until then it takes no census, underwriting or billing."
                : scheme.status === "SUSPENDED"
                ? "This scheme is suspended: cover is suspended for its members, and census changes and underwriting decisions wait until it is reactivated."
                : "This scheme is closed: members' cover has ended and is kept as history. Invoices, receipts and claims for earlier cover can still be recorded."}
            </p>
          )}
          {tab === "categories" && <CategoriesTab {...shared} />}
          {tab === "members" && <MembersTab {...shared} />}
          {tab === "census" && <CensusTab {...shared} />}
          {tab === "billing" && <BillingTab {...shared} />}
          {tab === "claims" && <ClaimsTab {...shared} />}
          {tab === "timeline" && <TimelineTab {...shared} />}
        </>
      )}
    </div>
  );
}

/** Only a scheme with no contractual or financial activity can be deleted; the server checks and explains. */
function DeleteScheme({ session, notify, scheme, onDeleted }) {
  const confirm = useConfirm();
  const action = useAction(notify);
  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${scheme.ref}?`,
      message: (
        <>
          <strong>{scheme.name}</strong> has no members, census, invoices or claims, so it can be removed as set up by
          mistake. A scheme with any activity is closed instead and keeps its history.
        </>
      ),
      confirmLabel: "Delete scheme",
      tone: "danger",
    });
    if (!ok) return;
    const r = await action.run(() => request(session, `/group/schemes/${encodeURIComponent(scheme.ref)}`, { method: "DELETE" }), `Scheme ${scheme.ref} deleted`);
    if (r) onDeleted();
  };
  return (
    <Button variant="secondary" busy={action.busy} onClick={remove}>
      Delete scheme
    </Button>
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
  lateEntryDays: "",
  employmentClass: "",
  occupationClass: "",
  salaryBasis: "",
  exitAge: "",
  waitingDays: "",
  maxCover: "",
  eligibilityRule: "",
  effectiveFrom: "",
  reason: "",
};
const optional = (v) => (v === "" || v === undefined ? null : v);

function CategoriesTab({ session, notify, profile, detail, loading, reload }) {
  const manage = can(profile, "MANAGE_SCHEME");
  const [editing, setEditing] = useState(null); // null: closed, "": new, code: edit
  const [form, setForm] = useState(EMPTY_CATEGORY);
  const [impact, setImpact] = useState(null);
  const [versionsOf, setVersionsOf] = useState(null);
  const versions = useResource(session, versionsOf ? `/group/schemes/${detail.scheme.ref}/categories/${encodeURIComponent(versionsOf)}/versions` : null, []);
  const action = useAction(inlineErrors(notify));
  const scheme = detail.scheme;

  const open = (category) => {
    action.setError("");
    setImpact(null);
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
      lateEntryDays: category.lateEntryDays != null ? String(category.lateEntryDays) : "",
      employmentClass: category.employmentClass || "",
      occupationClass: category.occupationClass || "",
      salaryBasis: category.salaryBasis || "",
      exitAge: category.exitAge != null ? String(category.exitAge) : "",
      waitingDays: category.waitingDays != null ? String(category.waitingDays) : "",
      maxCover: category.maxCover != null ? String(Number(category.maxCover)) : "",
      eligibilityRule: category.eligibilityRule || "",
      effectiveFrom: "",
      reason: "",
    });
    setEditing(category.code);
  };
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const categoryBody = () => ({
    ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, optional(v)])),
    code: form.code,
    name: form.name,
    salaryMultiple: form.benefitBasis === "SALARY_MULTIPLE" ? form.salaryMultiple : null,
    fixedCover: form.benefitBasis === "FIXED" ? form.fixedCover : null,
  });
  // NS-GL02-006: what the amendment does to members, premium, evidence and certificates, before it is saved.
  const preview = async () => {
    const r = await action.run(() => request(session, `/group/schemes/${scheme.ref}/categories/${encodeURIComponent(editing)}/impact`, { method: "POST", body: categoryBody() }));
    if (r) setImpact(r.data);
  };
  const submit = async () => {
    const body = categoryBody();
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
    { key: "lateEntryDays", label: "Late entry", render: (c) => (c.lateEntryDays != null ? `${c.lateEntryDays} days` : "—") },
    { key: "factors", label: "Defined by", render: (c) => [c.employmentClass, c.occupationClass && label(c.occupationClass), c.salaryBasis && label(c.salaryBasis) + " salary"].filter(Boolean).join(" · ") || "—" },
    { key: "exitAge", label: "Cover to", render: (c) => (c.exitAge != null ? `age ${c.exitAge}` : "—") },
    { key: "maxCover", label: "Cap", align: "right", render: (c) => (c.maxCover != null ? pula(c.maxCover) : "—") },
    { key: "activeMembers", label: "Members", align: "right" },
    { key: "version", label: "Version", render: (c) => (
      <button type="button" className="ga-link" onClick={() => setVersionsOf(c.code)}>
        v{c.version ?? 1}
      </button>
    ) },
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
            <Field label="Late-entry window (days)" hint="Optional. A joiner more than this many days after their eligibleDate gets no free cover; blank: no late-entry rule.">
              <input className="input" type="number" min="0" max="3650" value={form.lateEntryDays} onChange={set("lateEntryDays")} />
            </Field>
            <Field label="Employment class" hint="The approved factor the category is defined by.">
              <input className="input" value={form.employmentClass} onChange={set("employmentClass")} maxLength={60} placeholder="e.g. Permanent staff" />
            </Field>
            <Field label="Occupation class">
              <select className="select" value={form.occupationClass} onChange={set("occupationClass")}>
                <option value="">Not set</option>
                <option value="CLASS_1">Class 1 (office)</option>
                <option value="CLASS_2">Class 2 (light manual)</option>
                <option value="CLASS_3">Class 3 (manual)</option>
                <option value="CLASS_4">Class 4 (heavy manual)</option>
              </select>
            </Field>
            <Field label="Salary basis">
              <select className="select" value={form.salaryBasis} onChange={set("salaryBasis")}>
                <option value="">Not set</option>
                <option value="BASIC">Basic salary</option>
                <option value="PENSIONABLE">Pensionable salary</option>
                <option value="TOTAL_EARNINGS">Total earnings</option>
              </select>
            </Field>
            <Field label="Cover ceases at age" hint="Benefit cessation, separate from the scheme's renewal. Blank: the GLA product cessation age.">
              <input className="input" type="number" min="1" max="80" value={form.exitAge} onChange={set("exitAge")} />
            </Field>
            <Field label="Waiting period (days)" hint="Claims (other than accidents) within this period of entry are not admitted.">
              <input className="input" type="number" min="0" max="730" value={form.waitingDays} onChange={set("waitingDays")} />
            </Field>
            <Field label="Maximum cover (BWP)" hint="Caps the formula's cover. Blank: no cap.">
              <input className="input" type="number" min="1" step="0.01" value={form.maxCover} onChange={set("maxCover")} />
            </Field>
            <Field label="Eligibility rule" full>
              <input className="input" value={form.eligibilityRule} onChange={set("eligibilityRule")} maxLength={300} placeholder="e.g. Permanent employees after three months' service" />
            </Field>
            {editing && (
              <>
                <Field label="Effective from" hint="Blank: today. Joins and salary changes dated earlier keep the terms then in force. An earlier date needs underwriting authority and a reason.">
                  <input className="input" type="date" max={today()} value={form.effectiveFrom} onChange={set("effectiveFrom")} />
                </Field>
                <Field label="Reason" hint="Required for a backdated amendment.">
                  <input className="input" value={form.reason} onChange={set("reason")} maxLength={500} />
                </Field>
                <div className="form-label full">
                  <Button variant="secondary" busy={action.busy} onClick={preview}>
                    Preview the impact
                  </Button>
                  {impact && (
                    <div className="ga-drawer-section">
                      <div className="ws-kv">
                        <div><small>Members on cover</small><strong>{impact.membersOnCover}</strong></div>
                        <div><small>Cover in force / on new formula</small><strong>{pula(impact.coverInForce)} / {pula(impact.coverOnNewFormula)}</strong></div>
                        <div><small>Monthly premium now / proposed</small><strong>{pula(impact.monthlyPremiumNow)} / {pula(impact.monthlyPremiumProposed)}</strong></div>
                        <div><small>Would need evidence</small><strong>{impact.membersNeedingEvidence}</strong></div>
                        <div><small>Certificates to reissue</small><strong>{impact.certificatesToReissue}</strong></div>
                      </div>
                      <ul className="uw-list">
                        {impact.notes.map((n, i) => (
                          <li key={i}>{n}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            )}
          </FormGrid>
        </Drawer>
      )}
      {versionsOf && (
        <Drawer title={`Category ${versionsOf} versions`} description="Each version applies to joins and salary changes dated from its effective date." onClose={() => setVersionsOf(null)}>
          <ErrorNote error={versions.error} />
          <DataTable
            rows={versions.data}
            loading={versions.loading}
            rowKey={(v) => v.version}
            searchFrom={50}
            empty="No versions recorded"
            columns={[
              { key: "version", label: "Version", render: (v) => `v${v.version}` },
              { key: "effectiveFrom", label: "From", render: (v) => day(v.effectiveFrom) },
              { key: "cover", label: "Cover", render: (v) => (v.benefitBasis === "SALARY_MULTIPLE" ? `${number(v.salaryMultiple)} × salary` : pula(v.fixedCover)) + (v.maxCover != null ? `, cap ${pula(v.maxCover)}` : "") },
              { key: "freeCoverLimit", label: "Free cover", align: "right", render: (v) => pula(v.freeCoverLimit) },
              { key: "ratePerMille", label: "Rate ‰", align: "right", render: (v) => number(v.ratePerMille, 2) },
              { key: "reason", label: "Reason / impact", render: (v) => [v.reason, v.impact].filter(Boolean).join(" — ") || "—" },
              { key: "changedBy", label: "By", render: (v) => `${v.changedBy} · ${when(v.changedAt)}` },
            ]}
          />
        </Drawer>
      )}
    </>
  );
}

// ── members and underwriting ────────────────────────────────────────────────────────────────────

/** Members due for benefit cessation (category exit age or the GLA cessation age), ceased on their own dates. */
function CessationPanel({ session, notify, profile, scheme, reload }) {
  const due = useResource(session, `/group/schemes/${encodeURIComponent(scheme.ref)}/cessations`, []);
  const action = useAction(inlineErrors(notify));
  const confirm = useConfirm();
  if (!due.loading && !(due.data || []).length) return null;
  const run = async () => {
    const ok = await confirm({
      title: `Cease cover for ${due.data.length} member(s)?`,
      message: "Each member's cover ends the day before the birthday on which they reach the cessation age. Their cover history is kept.",
      confirmLabel: "Cease cover",
      tone: "danger",
    });
    if (!ok) return;
    const r = await action.run(() => request(session, `/group/schemes/${encodeURIComponent(scheme.ref)}/cessations`, { method: "POST", body: {} }), "Cover ceased at the cessation age");
    if (r) {
      due.reload();
      reload();
    }
  };
  return (
    <Panel
      title="Due for benefit cessation"
      subtitle="Members who have reached their category's exit age (or the GLA cessation age). Cessation is separate from the scheme's renewal."
      action={can(profile, "MANAGE_SCHEME") && scheme.status === "ACTIVE" ? <Button variant="secondary" busy={action.busy} onClick={run}>Cease cover</Button> : null}
    >
      <ErrorNote error={due.error || action.error} />
      <DataTable
        rows={due.data}
        loading={due.loading}
        rowKey={(m) => m.memberId}
        searchFrom={30}
        columns={[
          { key: "memberKey", label: "Member", render: (m) => `${m.name} · ${m.memberKey}` },
          { key: "category", label: "Category" },
          { key: "dateOfBirth", label: "Born", render: (m) => day(m.dateOfBirth) },
          { key: "cessationAge", label: "Age", align: "right" },
          { key: "ceasesOn", label: "Cover ends", render: (m) => day(m.ceasesOn) },
          { key: "rule", label: "Rule" },
          { key: "acceptedCover", label: "Cover", align: "right", render: (m) => pula(m.acceptedCover) },
        ]}
      />
    </Panel>
  );
}

function MembersTab({ session, notify, profile, detail, loading, reload }) {
  const underwrite = can(profile, "UNDERWRITE_MEMBER");
  const manage = can(profile, "MANAGE_SCHEME") && detail.scheme.status === "ACTIVE";
  const [status, setStatus] = useState("ON_COVER");
  const [search, setSearch] = useState("");
  const [deciding, setDeciding] = useState(null);
  const [acting, setActing] = useState(null); // {member, kind: "work" | "transfer"}

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
    { key: "status", label: "Status", render: (m) => (
      <>
        <Badge tone={MEMBER_TONES[m.status]}>{label(m.status)}</Badge>
        {m.activelyAtWork === false && <span className="ga-muted"> · not at work when declared</span>}
      </>
    ) },
    { key: "joinDate", label: "Cover dates", render: (m) => (
      <span className="ga-nowrap">{day(m.joinDate)}{m.exitDate ? ` – ${day(m.exitDate)}` : ""}</span>
    ) },
    { key: "acceptedCover", label: "Accepted cover", align: "right", render: (m) => pula(m.acceptedCover) },
    { key: "pendingCover", label: "Pending", align: "right", render: (m) =>
      Number(m.pendingCover) > 0 ? <strong className="ga-pending">{pula(m.pendingCover)}</strong> : "—" },
    { key: "monthlyPremium", label: "Premium / month", align: "right", render: (m) => pula(m.monthlyPremium) },
  ];
  if (underwrite || manage) {
    columns.push({
      key: "actions",
      label: "",
      render: (m) => (
        <div className="ws-row-actions">
          {underwrite && m.status === "UNDERWRITING_PENDING" && (
            <Button icon={ShieldCheck} onClick={() => setDeciding(m)}>
              Decide
            </Button>
          )}
          {underwrite && m.status !== "UNDERWRITING_PENDING" && m.underwritingDecision && (
            <button type="button" className="ga-link" title={m.underwritingReason || ""} onClick={() => setDeciding(m)}>
              {m.underwritingDecision === "ACCEPT" ? "Accepted" : "Declined"} by {m.underwrittenBy}
              {m.loadingPercent ? ` · +${Number(m.loadingPercent)}%` : ""}
            </button>
          )}
          {manage && m.status === "COVER_DEFERRED" && (
            <Button variant="secondary" onClick={() => setActing({ member: m, kind: "work" })}>
              Back at work
            </Button>
          )}
          {manage && ["ACTIVE", "PARTIALLY_ACCEPTED"].includes(m.status) && detail.categories.length > 1 && (
            <Button variant="secondary" onClick={() => setActing({ member: m, kind: "transfer" })}>
              Move category
            </Button>
          )}
        </div>
      ),
    });
  }

  return (
    <>
      {deciding && (
        <UnderwritingPanel
          session={session}
          notify={notify}
          member={deciding}
          onClose={() => {
            setDeciding(null);
            reload();
          }}
          onDone={() => {
            setDeciding(null);
            reload();
          }}
        />
      )}
      {acting && (
        <MemberActionDrawer
          session={session}
          notify={notify}
          member={acting.member}
          kind={acting.kind}
          categories={detail.categories}
          onClose={() => setActing(null)}
          onDone={() => {
            setActing(null);
            reload();
          }}
        />
      )}
      <CessationPanel session={session} notify={notify} profile={profile} scheme={detail.scheme} reload={reload} />
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
              <option value="SUSPENDED">Suspended</option>
              <option value="COVER_DEFERRED">Cover deferred (not at work)</option>
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

const EVIDENCE_LABEL = {
  MEDICAL_QUESTIONNAIRE: "Medical questionnaire",
  MEDICAL_EXAMINATION: "Medical examination",
  BLOOD_PROFILE: "Blood profile",
  FINANCIAL_EVIDENCE: "Financial evidence",
  AAW_CONFIRMATION: "Employer's actively-at-work confirmation",
  HEALTH_DECLARATION: "Health declaration",
};

/**
 * The member's underwriting file and decision (GL03): evidence requirements (received, waived or added for a risk
 * exception), the decision per benefit with loading, exclusions and effective date, a second underwriter's authority,
 * the member's answer to an offer on modified terms, decision history, episodes and aggregate exposure.
 */
function UnderwritingPanel({ session, notify, member, onClose, onDone }) {
  const file = useResource(session, `/group/members/${member.id}/underwriting-file`, null);
  const [decision, setDecision] = useState("ACCEPT");
  const [amount, setAmount] = useState(String(Number(member.requestedCover)));
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [benefitDecisions, setBenefitDecisions] = useState({});
  const [note, setNote] = useState("");
  const [addRequirement, setAddRequirement] = useState("");
  const action = useAction(inlineErrors(notify));
  const confirm = useConfirm();
  const f = file.data;
  const m = f?.member || member;
  const open = (f?.decisions || []).filter((d) => ["AWAITING_AUTHORITY", "OFFERED"].includes(d.status));
  const awaiting = open.find((d) => d.status === "AWAITING_AUTHORITY");
  const offered = open.find((d) => d.status === "OFFERED");
  const me = session?.username;
  const reload = () => file.reload();

  const evidence = async (e, status) => {
    const r = await action.run(
      () => request(session, `/group/member-evidence/${e.id}`, { method: "POST", body: { status, note: note || undefined } }),
      `${EVIDENCE_LABEL[e.requirement] || e.requirement} ${status === "RECEIVED" ? "received" : "waived"}`,
    );
    if (r) {
      setNote("");
      reload();
    }
  };
  const add = async () => {
    const r = await action.run(() => request(session, `/group/members/${member.id}/evidence`, { method: "POST", body: { requirement: addRequirement, note: note || undefined } }), "Requirement added");
    if (r) {
      setAddRequirement("");
      setNote("");
      reload();
    }
  };
  const submit = async () => {
    const accept = decision === "ACCEPT";
    const ok = await confirm({
      title: accept ? `Accept cover for ${m.name}?` : `Decline pending cover for ${m.name}?`,
      message: accept ? (
        <>
          <strong>{m.name}</strong> ({m.memberKey}): <strong>{pula(amount)}</strong> of the {pula(m.requestedCover)} requested
          {loading ? `, with a ${loading}% loading` : ""}
          {exclusions ? ` and exclusions (${exclusions})` : ""}. Above the authority limit a second underwriter confirms; modified terms
          are offered to the member before they apply.
        </>
      ) : (
        <>
          The pending <strong>{pula(m.pendingCover)}</strong> is declined; only the free cover of {pula(m.acceptedCover)} stays in force.
        </>
      ),
      confirmLabel: accept ? "Record decision" : "Decline pending cover",
      tone: accept ? undefined : "danger",
    });
    if (!ok) return;
    const body = { decision, reason: reason || null };
    if (accept) {
      body.acceptedAmount = amount;
      if (loading) body.loadingPercent = loading;
      if (exclusions) body.exclusions = exclusions;
    }
    if (effectiveDate) body.effectiveDate = effectiveDate;
    const benefits = Object.entries(benefitDecisions)
      .filter(([, v]) => v.decision)
      .map(([benefitType, v]) => ({ benefitType, ...v, loadingPercent: v.loadingPercent || undefined, exclusions: v.exclusions || undefined }));
    if (benefits.length) body.benefits = benefits;
    const r = await action.run(() => request(session, `/group/members/${member.id}/underwriting`, { method: "POST", body }), "Decision recorded");
    if (r) {
      if (r.data.status === "UNDERWRITING_PENDING") reload();
      else onDone();
    }
  };
  const authority = async (approve) => {
    const r = await action.run(() => request(session, `/group/members/${member.id}/underwriting/authority`, { method: "POST", body: { approve, note } }), approve ? "Decision authorised" : "Decision rejected");
    if (r) {
      setNote("");
      reload();
      if (r.data.member.status !== "UNDERWRITING_PENDING") onDone();
    }
  };
  const respond = async (accepted) => {
    const r = await action.run(() => request(session, `/group/members/${member.id}/underwriting/offer-response`, { method: "POST", body: { accepted, note: note || undefined } }), accepted ? "Member accepted the offer" : "Member declined the offer");
    if (r) onDone();
  };
  const otherBenefits = (f?.benefits || []).filter((b) => b !== "GLA");

  return (
    <Drawer size="lg" title={`Underwriting · ${m.name}`} description={`${m.memberKey} · category ${m.category} · ${label(m.status)}`} onClose={onClose}>
      <ErrorNote error={file.error} />
      <div className="ws-kv">
        <div><small>Requested cover</small><strong>{pula(m.requestedCover)}</strong></div>
        <div><small>In force (free cover or accepted)</small><strong>{pula(m.acceptedCover)}</strong></div>
        <div><small>Pending underwriting</small><strong className="ga-pending">{pula(m.pendingCover)}</strong></div>
        <div><small>Free-cover limit</small><strong>{f ? pula(f.freeCoverLimit) : "—"}</strong></div>
        <div><small>Actively at work</small><strong>{m.activelyAtWork == null ? "Not declared" : m.activelyAtWork ? "Yes" : "No"}</strong></div>
        <div><small>Aggregate exposure</small><strong>{f ? pula(f.aggregateExposure) : "—"}{f?.otherGroupCover?.length ? ` (incl. ${f.otherGroupCover.map((o) => o.schemeRef).join(", ")})` : ""}</strong></div>
        <div><small>Authority limit</small><strong>{f ? pula(f.authorityLimit) : "—"}</strong></div>
        <div><small>Scheme rules</small><strong>{f ? `${f.partialCoverAllowed ? "Partial cover allowed" : "No partial cover"} · not at work: ${f.aawRule === "DEFER" ? "defer" : "refer"}` : "—"}</strong></div>
      </div>

      <div className="ga-drawer-section">
        <h3>Evidence</h3>
        <p className="subtitle">Medical evidence is restricted to underwriters; the employer sees only that cover is pending. Received evidence stays valid for 12 months (demo rule) and can be reused.</p>
        <DataTable
          rows={f?.evidence || []}
          loading={file.loading}
          rowKey={(e) => e.id}
          searchFrom={50}
          empty="No evidence required"
          columns={[
            { key: "requirement", label: "Requirement", render: (e) => EVIDENCE_LABEL[e.requirement] || e.requirement },
            { key: "reason", label: "Why", render: (e) => label(e.reason) },
            { key: "restricted", label: "Access", render: (e) => (e.restricted ? "Underwriters only" : "Administrators") },
            { key: "status", label: "Status", render: (e) => <Badge tone={e.status === "REQUESTED" ? "amber" : "green"}>{label(e.status)}</Badge> },
            { key: "validUntil", label: "Valid until", render: (e) => (e.validUntil ? day(e.validUntil) : "—") },
            { key: "note", label: "Note", render: (e) => e.note || "—" },
            {
              key: "act",
              label: "",
              render: (e) =>
                e.status === "REQUESTED" && (
                  <div className="ws-row-actions">
                    <Button variant="secondary" busy={action.busy} onClick={() => evidence(e, "RECEIVED")}>Received</Button>
                    <Button variant="secondary" busy={action.busy} onClick={() => evidence(e, "WAIVED")} disabled={!note}>Waive</Button>
                  </div>
                ),
            },
          ]}
        />
        <div className="field-grid">
          <Field label="Note for the evidence action" hint="Required to waive a requirement. No medical detail.">
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </Field>
          <Field label="Add a requirement (risk exception)">
            <span className="gl-ages">
              <select className="select" value={addRequirement} onChange={(e) => setAddRequirement(e.target.value)}>
                <option value="">Choose</option>
                {Object.entries(EVIDENCE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <Button variant="secondary" disabled={!addRequirement} busy={action.busy} onClick={add}>Add</Button>
            </span>
          </Field>
        </div>
      </div>

      {awaiting && (
        <div className="ga-drawer-section">
          <h3>Waiting for a second underwriter</h3>
          <p className="subtitle">
            {pula(awaiting.acceptedAmount)} accepted by {awaiting.decidedBy}
            {awaiting.loadingPercent ? ` with a ${Number(awaiting.loadingPercent)}% loading` : ""}: above the authority limit.
          </p>
          {awaiting.decidedBy === me ? (
            <p className="ws-hint">You made this decision, so another underwriter confirms it.</p>
          ) : (
            <div className="ws-form-actions">
              <Button variant="secondary" busy={action.busy} disabled={!note} onClick={() => authority(false)}>Reject</Button>
              <Button busy={action.busy} disabled={!note} onClick={() => authority(true)}>Authorise</Button>
            </div>
          )}
          {awaiting.decidedBy !== me && !note && <small className="ws-hint">Enter a note above to authorise or reject.</small>}
        </div>
      )}
      {offered && (
        <div className="ga-drawer-section">
          <h3>Offer on modified terms</h3>
          <p className="subtitle">
            {pula(offered.acceptedAmount)}
            {offered.loadingPercent ? ` with a ${Number(offered.loadingPercent)}% loading` : ""}
            {offered.exclusions ? `, excluding ${offered.exclusions}` : ""}: open until {day(offered.offerExpiresOn)}. Record the member's signed answer.
          </p>
          <div className="ws-form-actions">
            <Button variant="secondary" busy={action.busy} onClick={() => respond(false)}>Member declined</Button>
            <Button busy={action.busy} onClick={() => respond(true)}>Member accepted</Button>
          </div>
        </div>
      )}
      {m.status === "UNDERWRITING_PENDING" && !open.length && (
        <FormGrid onSubmit={submit} busy={action.busy} error={action.error} submitLabel={decision === "ACCEPT" ? "Record decision" : "Decline pending cover"}>
          {(f?.outstanding || []).length > 0 && decision === "ACCEPT" && (
            <p className="ga-status-note full">Evidence outstanding: {f.outstanding.join(", ")}. Cover is accepted only once it is received or waived.</p>
          )}
          <Field label="Decision (life cover)">
            <select className="select" value={decision} onChange={(e) => setDecision(e.target.value)}>
              <option value="ACCEPT">Accept (in full or in part)</option>
              <option value="DECLINE">Decline the pending amount</option>
            </select>
          </Field>
          {decision === "ACCEPT" ? (
            <Field label="Accepted cover (BWP)" hint={`Between ${pula(m.acceptedCover)} and ${pula(m.requestedCover)}.`}>
              <input className="input" type="number" step="0.01" min={Number(m.acceptedCover)} max={Number(m.requestedCover)} value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </Field>
          ) : (
            <Field label="Cover kept" hint="The free-cover portion stays in force.">
              <input className="input" value={pula(m.acceptedCover)} disabled />
            </Field>
          )}
          {decision === "ACCEPT" && (
            <>
              <Field label="Loading (%)" hint="Added to the member's premium rate. A loading or exclusion makes this an offer the member must accept.">
                <input className="input" type="number" min="0" max="300" step="0.01" value={loading} onChange={(e) => setLoading(e.target.value)} />
              </Field>
              <Field label="Exclusions">
                <input className="input" value={exclusions} onChange={(e) => setExclusions(e.target.value)} maxLength={500} />
              </Field>
            </>
          )}
          <Field label="Effective date" hint="Blank: today. Not before the member's entry.">
            <input className="input" type="date" max={today()} value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </Field>
          {otherBenefits.map((b) => (
            <Field key={b} label={`${label(b)} decision`} hint="Optional per-benefit decision.">
              <span className="gl-ages">
                <select className="select" value={benefitDecisions[b]?.decision || ""} onChange={(e) => setBenefitDecisions({ ...benefitDecisions, [b]: { ...benefitDecisions[b], decision: e.target.value } })}>
                  <option value="">No separate decision</option>
                  <option value="ACCEPT">Accept</option>
                  <option value="DECLINE">Decline</option>
                </select>
                {benefitDecisions[b]?.decision === "ACCEPT" && (
                  <input className="input" placeholder="Exclusions" value={benefitDecisions[b]?.exclusions || ""} onChange={(e) => setBenefitDecisions({ ...benefitDecisions, [b]: { ...benefitDecisions[b], exclusions: e.target.value } })} />
                )}
              </span>
            </Field>
          ))}
          <Field label={decision === "DECLINE" ? "Reason (required)" : "Reason or evidence note"} full>
            <textarea className="textarea" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} required={decision === "DECLINE"} />
          </Field>
        </FormGrid>
      )}
      {open.length > 0 && <ErrorNote error={action.error} />}

      <div className="ga-drawer-section">
        <h3>Decision history</h3>
        <DataTable
          rows={f?.decisions || []}
          rowKey={(d) => d.id}
          searchFrom={50}
          empty="No decisions yet"
          columns={[
            { key: "decidedAt", label: "When", render: (d) => when(d.decidedAt) },
            { key: "benefitType", label: "Benefit", render: (d) => label(d.benefitType) },
            { key: "decision", label: "Decision", render: (d) => label(d.decision) },
            { key: "acceptedAmount", label: "Accepted", align: "right", render: (d) => pula(d.acceptedAmount) },
            { key: "terms", label: "Terms", render: (d) => [d.loadingPercent ? `${Number(d.loadingPercent)}% loading` : null, d.exclusions].filter(Boolean).join(" · ") || "Standard" },
            { key: "effectiveDate", label: "Effective", render: (d) => day(d.effectiveDate) },
            { key: "status", label: "Status", render: (d) => label(d.status) + (d.memberResponse ? ` · member ${d.memberResponse.toLowerCase()}` : "") },
            { key: "decidedBy", label: "By", render: (d) => d.decidedBy + (d.authorisedBy ? ` · authorised ${d.authorisedBy}` : "") },
          ]}
        />
      </div>
      {(f?.episodes || []).length > 1 && (
        <div className="ga-drawer-section">
          <h3>Cover episodes and category history</h3>
          <DataTable
            rows={f.episodes}
            rowKey={(e) => e.memberId}
            searchFrom={50}
            columns={[
              { key: "category", label: "Category" },
              { key: "from", label: "From", render: (e) => day(e.from) },
              { key: "to", label: "To", render: (e) => (e.to ? day(e.to) : "—") },
              { key: "status", label: "Status", render: (e) => label(e.status) },
              { key: "acceptedCover", label: "Cover", align: "right", render: (e) => pula(e.acceptedCover) },
            ]}
          />
        </div>
      )}
    </Drawer>
  );
}

/** Return to work for deferred cover (AT-GL03-02) and moving a member to another category (NS-GL03-005). */
function MemberActionDrawer({ session, notify, member, categories, kind, onClose, onDone }) {
  const [form, setForm] = useState({ effectiveDate: today(), note: "", categoryCode: categories.find((c) => c.code !== member.category)?.code || "", reason: "" });
  const action = useAction(inlineErrors(notify));
  const submit = async () => {
    const path = kind === "work" ? `/group/members/${member.id}/actively-at-work` : `/group/members/${member.id}/category-transfer`;
    const body = kind === "work" ? { effectiveDate: form.effectiveDate, note: form.note || undefined } : { categoryCode: form.categoryCode, effectiveDate: form.effectiveDate, reason: form.reason || undefined };
    const r = await action.run(() => request(session, path, { method: "POST", body }), kind === "work" ? `${member.name} is on cover` : `${member.name} moved to ${form.categoryCode}`);
    if (r) onDone();
  };
  return (
    <Drawer
      title={kind === "work" ? `Back at work · ${member.name}` : `Move category · ${member.name}`}
      description={kind === "work" ? "The employer confirms the member is actively at work: cover starts with the free-cover treatment; anything above it is referred." : "The current episode ends the day before; a new one starts in the new category. Cover already accepted continues; anything above it is referred."}
      onClose={onClose}
    >
      <FormGrid onSubmit={submit} busy={action.busy} error={action.error} submitLabel={kind === "work" ? "Confirm back at work" : "Move member"}>
        {kind === "transfer" && (
          <Field label="New category">
            <select className="select" value={form.categoryCode} onChange={(e) => setForm({ ...form, categoryCode: e.target.value })} required>
              {categories.filter((c) => c.code !== member.category).map((c) => (
                <option key={c.code} value={c.code}>{c.code} · {c.name}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Effective date">
          <input className="input" type="date" max={today()} value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} required />
        </Field>
        <Field label={kind === "work" ? "Note" : "Reason"} full>
          <input className="input" value={kind === "work" ? form.note : form.reason} onChange={(e) => setForm({ ...form, [kind === "work" ? "note" : "reason"]: e.target.value })} maxLength={500} />
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
  const upload = useAction(inlineErrors(notify));
  const commit = useAction(inlineErrors(notify));
  const [recon, setRecon] = useState(null);
  useEffect(() => {
    setRecon(null);
    if (!batch || batch.status !== "COMMITTED") return;
    let live = true;
    request(session, `/group/census-batches/${encodeURIComponent(batch.ref)}/reconciliation`)
      .then((r) => live && setRecon(r.data))
      .catch(() => live && setRecon(null));
    return () => {
      live = false;
    };
  }, [session, batch]);

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
      `${CENSUS_HEADER},${CENSUS_OPTIONAL}`,
      `EMP-1001,Kagiso,Sebina,1988-04-12,${first},180000,JOIN,${today()},Y,${today()},HR-1`,
      `EMP-1002,Naledi,Kgosi,1992-09-03,${codes[1] || first},240000,JOIN,${today()},Y,,HR-2`,
      `EMP-0999,,,,,,LEAVE,${today()},,,HR-3`,
      `EMP-0998,,,,,210000,SALARY,${today()},Y,,HR-4`,
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
            <Field label="CSV file" full hint={fileName ? `Loaded ${fileName}` : `Header: ${CENSUS_HEADER}, optionally followed by ${CENSUS_OPTIONAL}. A joiner declared not actively at work (N) has all cover referred to underwriting; a rowKey already applied is never applied again.`}>
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
              {recon && (
                <section className="ga-drawer-section">
                  <h3>Reconciliation</h3>
                  <p className="subtitle">
                    {recon.appliedRows} applied row(s) · {recon.rowsTracedToChanges} traced to a member change · {recon.certificates}{" "}
                    with a certificate in force · {recon.invoiceLines} invoice line(s) billed since ·{" "}
                    {recon.reconciled ? <Badge tone="green">Reconciled</Badge> : <Badge tone="red">Does not reconcile</Badge>}
                  </p>
                  <DataTable
                    rows={recon.rows}
                    rowKey={(r) => r.lineNo}
                    searchFrom={20}
                    empty="No applied rows"
                    columns={[
                      { key: "lineNo", label: "Line", align: "right" },
                      { key: "memberKey", label: "Member key", render: (r) => <span className="ws-mono">{r.memberKey}</span> },
                      { key: "changeType", label: "Change", render: (r) => (r.changeType ? `${label(r.changeType)} #${r.changeId}` : "—") },
                      { key: "coverAfter", label: "Cover after", align: "right", render: (r) => (r.coverAfter != null ? pula(r.coverAfter) : "—") },
                      { key: "certificateNo", label: "Certificate", render: (r) => r.certificateNo || "—" },
                      { key: "invoices", label: "Invoices", render: (r) => (r.invoices?.length ? r.invoices.join(", ") : "—") },
                    ]}
                  />
                </section>
              )}
              {atomicBlocked && (
                <ErrorNote error="This ATOMIC batch has invalid rows, so it cannot be committed. Correct the file and submit it under a new batch id." />
              )}
              <ErrorNote error={commit.error} />
              <div className="ga-batch-tools">
                <label className="ga-check">
                  <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} />
                  Show only rows with errors
                </label>
                <Button
                  variant="secondary"
                  icon={Download}
                  onClick={() => saveTextFile(`census-results-${batch.ref}.csv`, batchResultsCsv(batch))}
                >
                  Download results
                </Button>
              </div>
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
  const issue = useAction(inlineErrors(notify));
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
            { key: "policyYear", label: "Year", align: "right", render: (i) => i.policyYear ?? "—" },
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
  const action = useAction(inlineErrors(notify));
  const disputes = useAction(inlineErrors(notify));
  const [dispute, setDispute] = useState(null); // { memberKey, action, note }
  const saveDispute = async () => {
    const r = await disputes.run(
      () => request(session, `/group/invoices/${invoice.ref}/disputes`, { method: "POST", body: dispute }),
      dispute.action === "RAISE" ? `Dispute recorded for ${dispute.memberKey}` : `Dispute resolved for ${dispute.memberKey}`,
    );
    if (r) {
      setDispute(null);
      reload();
    }
  };

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
            { key: "dispute", label: "Sponsor dispute", render: (l) =>
              l.disputeStatus === "OPEN" ? (
                <span title={l.disputeNote || ""}>
                  <Badge tone="amber">Disputed</Badge>
                  {bill && (
                    <Button variant="secondary" onClick={() => setDispute({ memberKey: l.memberKey, action: "RESOLVE", note: "" })}>
                      Resolve
                    </Button>
                  )}
                </span>
              ) : (
                <span title={l.disputeNote || ""}>
                  {l.disputeStatus === "RESOLVED" && <span className="ga-muted">Resolved </span>}
                  {bill && (
                    <Button variant="secondary" onClick={() => setDispute({ memberKey: l.memberKey, action: "RAISE", note: "" })}>
                      Dispute
                    </Button>
                  )}
                </span>
              ) },
          ]}
        />
        {Number(invoice.disputedAmount) > 0 && (
          <p className="subtitle">{pula(invoice.disputedAmount)} of this invoice is disputed by the sponsor; members' cover does not change until a census does.</p>
        )}
        {dispute && (
          <FormGrid
            onSubmit={saveDispute}
            busy={disputes.busy}
            error={disputes.error}
            submitLabel={dispute.action === "RAISE" ? `Record dispute for ${dispute.memberKey}` : `Resolve dispute for ${dispute.memberKey}`}
            extra={
              <Button type="button" variant="secondary" onClick={() => setDispute(null)}>
                Cancel
              </Button>
            }
          >
            <Field label={dispute.action === "RAISE" ? "What the sponsor disputes" : "How it was resolved"} full>
              <textarea className="textarea" rows={2} maxLength={300} value={dispute.note} onChange={(e) => setDispute({ ...dispute, note: e.target.value })} required />
            </Field>
          </FormGrid>
        )}
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

// ── claims ──────────────────────────────────────────────────────────────────────────────────────

const CLAIM_TONES = { NOTIFIED: "amber", APPROVED: "blue", IN_PAYMENT: "blue", PAID: "green", DECLINED: "red", CEASED: "gray" };
const CLAIM_BENEFITS = {
  GLA: "Group life assurance",
  LUMP_SUM_DISABILITY: "Lump-sum disability",
  CRITICAL_ILLNESS: "Critical illness",
  FAMILY: "Family benefits",
  INCOME_PROTECTION: "Income protection",
};

/** Claims on members' cover: notified against the episode on the event date, decided by a second person. */
function ClaimsTab({ session, notify, profile, detail }) {
  const scheme = detail.scheme;
  const claims = useResource(session, `/group/schemes/${encodeURIComponent(scheme.ref)}/claims`, []);
  const [form, setForm] = useState(null);
  const [deciding, setDeciding] = useState(null);
  const action = useAction(inlineErrors(notify));
  const me = session?.username;
  const keys = [...new Set(detail.members.map((m) => m.memberKey))].sort();

  const open = (next) => {
    action.setError("");
    setForm(next);
  };
  const notifyClaim = async () => {
    const r = await action.run(
      () => request(session, `/group/schemes/${encodeURIComponent(scheme.ref)}/claims`, { method: "POST", body: form }),
      "Claim notified",
    );
    if (r) {
      setForm(null);
      claims.reload();
    }
  };
  const decide = async () => {
    const { ref, ...body } = deciding;
    const r = await action.run(
      () => request(session, `/group/claims/${encodeURIComponent(ref)}/decision`, { method: "POST", body }),
      `Claim ${ref} updated`,
    );
    if (r) {
      setDeciding(null);
      claims.reload();
    }
  };
  const actionsFor = (c) => {
    if (c.status === "NOTIFIED") {
      return [
        ...(can(profile, "APPROVE_CLAIM") && c.notifiedBy !== me ? [["APPROVE", "Approve"]] : []),
        ...(can(profile, "ASSESS_CLAIM") ? [["DECLINE", "Decline"]] : []),
      ];
    }
    if (c.status === "APPROVED") return can(profile, "SETTLE_CLAIM") ? [["PAY", "Record payment"]] : [];
    if (c.status === "IN_PAYMENT") return can(profile, "ASSESS_CLAIM") ? [["REVIEW", "Review"], ["CEASE", "Cease"]] : [];
    return [];
  };

  return (
    <>
      <Panel
        title="Claims"
        subtitle="Each claim sits on the member's cover episode for the event date. Only accepted cover is claimable; income benefits are paid until review or cessation."
        action={
          can(profile, "CREATE_CLAIM") && keys.length > 0 ? (
            <Button icon={Plus} onClick={() => open({ memberKey: keys[0], benefitType: "GLA", eventDate: today(), amount: "", note: "" })}>
              Notify claim
            </Button>
          ) : null
        }
      >
        <ErrorNote error={claims.error} />
        <DataTable
          rows={claims.data}
          loading={claims.loading}
          rowKey={(c) => c.ref}
          empty="No claims on this scheme"
          emptyDetail="Claims notified against members' cover show here with their decision and payment."
          searchPlaceholder="Search claim, member, benefit…"
          columns={[
            { key: "ref", label: "Claim", render: (c) => <span className="ws-mono">{c.ref}</span> },
            { key: "member", label: "Member", render: (c) => (
              <div className="ga-person">
                <strong>{c.member}</strong>
                <span className="ws-mono">{c.memberKey}</span>
              </div>
            ) },
            { key: "benefitType", label: "Benefit", render: (c) => CLAIM_BENEFITS[c.benefitType] || c.benefitType },
            { key: "eventDate", label: "Event", render: (c) => day(c.eventDate) },
            { key: "claimedAmount", label: "Claimed", align: "right", render: (c) => pula(c.claimedAmount) },
            { key: "approvedAmount", label: "Approved", align: "right", render: (c) => (c.approvedAmount != null ? pula(c.approvedAmount) : "—") },
            { key: "status", label: "Status", render: (c) => <Badge tone={CLAIM_TONES[c.status]}>{label(c.status)}</Badge> },
            { key: "nextReviewDate", label: "Next review", render: (c) => (c.nextReviewDate ? day(c.nextReviewDate) : "—") },
            {
              key: "actions",
              label: "",
              render: (c) => {
                const acts = actionsFor(c);
                if (!acts.length) {
                  return c.status === "NOTIFIED" && c.notifiedBy === me ? <span className="ga-muted">Needs another approver</span> : null;
                }
                return (
                  <div className="ws-row-actions">
                    {acts.map(([act, text]) => (
                      <Button key={act} variant="secondary" onClick={() => { action.setError(""); setDeciding({ ref: c.ref, action: act, note: "", amount: "", paymentReference: "", nextReviewDate: "", claim: c }); }}>
                        {text}
                      </Button>
                    ))}
                  </div>
                );
              },
            },
          ]}
        />
      </Panel>
      {form && (
        <Drawer title="Notify a claim" description={`${scheme.name} · the member must have had cover on the event date`} onClose={() => setForm(null)}>
          <FormGrid onSubmit={notifyClaim} busy={action.busy} error={action.error} submitLabel="Notify claim">
            <Field label="Member">
              <select className="select" value={form.memberKey} onChange={(e) => setForm({ ...form, memberKey: e.target.value })}>
                {keys.map((k) => (
                  <option key={k} value={k}>
                    {k} · {detail.members.find((m) => m.memberKey === k)?.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Benefit">
              <select className="select" value={form.benefitType} onChange={(e) => setForm({ ...form, benefitType: e.target.value })}>
                {Object.entries(CLAIM_BENEFITS).map(([k, text]) => (
                  <option key={k} value={k}>
                    {text}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Event date">
              <input className="input" type="date" max={today()} value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} required />
            </Field>
            <Field label={form.benefitType === "INCOME_PROTECTION" ? "Monthly benefit (BWP)" : "Amount claimed (BWP)"} hint={form.benefitType === "INCOME_PROTECTION" ? undefined : "Up to the cover in force on the event date"}>
              <input className="input" type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </Field>
            <Field label="Note" full hint="No medical detail here: evidence stays with the claims assessor.">
              <textarea className="textarea" rows={2} maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      {deciding && (
        <Drawer
          title={`${label(deciding.action)} ${deciding.ref}`}
          description={`${deciding.claim.member} · ${CLAIM_BENEFITS[deciding.claim.benefitType] || deciding.claim.benefitType} · claimed ${pula(deciding.claim.claimedAmount)}`}
          onClose={() => setDeciding(null)}
        >
          <FormGrid onSubmit={decide} busy={action.busy} error={action.error} submitLabel={label(deciding.action)}>
            {deciding.action === "APPROVE" && (
              <Field label="Approved amount (BWP)" hint={`Leave blank to approve the ${pula(deciding.claim.claimedAmount)} claimed`}>
                <input className="input" type="number" min="0.01" step="0.01" value={deciding.amount} onChange={(e) => setDeciding({ ...deciding, amount: e.target.value })} />
              </Field>
            )}
            {deciding.action === "PAY" && (
              <Field label="Payment reference">
                <input className="input" maxLength={80} value={deciding.paymentReference} onChange={(e) => setDeciding({ ...deciding, paymentReference: e.target.value })} required />
              </Field>
            )}
            {(deciding.action === "REVIEW" || (deciding.action === "APPROVE" && deciding.claim.benefitType === "INCOME_PROTECTION")) && (
              <Field label="Next review" hint="Leave blank for 12 months on">
                <input className="input" type="date" value={deciding.nextReviewDate} onChange={(e) => setDeciding({ ...deciding, nextReviewDate: e.target.value })} />
              </Field>
            )}
            <Field label="Note" full>
              <textarea
                className="textarea"
                rows={3}
                maxLength={500}
                value={deciding.note}
                onChange={(e) => setDeciding({ ...deciding, note: e.target.value })}
                required={["DECLINE", "REVIEW", "CEASE"].includes(deciding.action)}
              />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

// ── master-policy timeline and resolved rules ───────────────────────────────────────────────────

/** The master policy in date order (GL01) and the rule set its categories and benefits resolve to (GL02). */
function TimelineTab({ session, detail }) {
  const ref = encodeURIComponent(detail.scheme.ref);
  const timeline = useResource(session, `/group-life/schemes/${ref}/timeline`, []);
  const rules = useResource(session, `/group-life/schemes/${ref}/resolved-rules`, null);
  const resolved = useResource(session, `/group-life/schemes/${ref}/resolved-benefits`, null);
  const [benefit, setBenefit] = useState("");
  const r = rules.data;
  const resolvedRows = resolved.data?.rows || [];
  const benefitTypes = [...new Set(resolvedRows.map((x) => x.benefitType))];
  const shown = benefit || benefitTypes[0] || "";
  const forBenefit = resolvedRows.filter((x) => x.benefitType === shown);
  const setup = detail.scheme.setup || {};
  return (
    <>
      <Panel title="Contract" subtitle="The master policy's set-up terms and what it was activated on (NS-GL01-003/004).">
        <div className="ws-kv">
          <div><small>Accepted terms</small><strong>{detail.scheme.quoteRef || "—"}</strong></div>
          <div><small>Wording</small><strong>{setup.wordingRef ? `${setup.wordingRef} v${setup.wordingVersion}` : "—"}</strong></div>
          <div><small>Legal sponsor</small><strong>{setup.sponsorRef || "—"}</strong></div>
          <div><small>Payer</small><strong>{setup.payerName || "—"}</strong></div>
          <div><small>Broker</small><strong>{setup.brokerRef || "Direct"}</strong></div>
          <div><small>Billing</small><strong>{setup.billingMethod ? `${label(detail.scheme.billingFrequency)} · ${label(setup.billingMethod)} · due day ${setup.billingDueDay}` : label(detail.scheme.billingFrequency)}</strong></div>
          <div><small>Not actively at work</small><strong>{setup.aawRule === "DEFER" ? "Cover deferred until back at work" : "Referred to underwriting"}</strong></div>
          <div><small>Partial cover</small><strong>{setup.partialCoverAllowed === false ? "Not allowed: all cover waits" : "Allowed: free cover in force"}</strong></div>
          <div><small>Inception conditions</small><strong>{setup.inceptionConditions ? setup.inceptionConditions.split(", ").map(label).join(", ") : "—"}</strong></div>
          <div><small>Activated</small><strong>{setup.activatedAt ? `${when(setup.activatedAt)} by ${setup.activatedBy}` : detail.scheme.status === "SETUP" ? "Not yet" : "Before set-up was recorded"}</strong></div>
        </div>
      </Panel>
      <Panel title="Master-policy timeline" subtitle="Quote versions and decisions, activation, plan approvals, renewals, suspensions, transfers and closure.">
        <ErrorNote error={timeline.error} />
        <DataTable
          rows={timeline.data}
          loading={timeline.loading}
          rowKey={(e) => `${e.at}-${e.title}`}
          empty="Nothing on the timeline yet"
          searchFrom={30}
          columns={[
            { key: "at", label: "When", render: (e) => when(e.at) },
            { key: "kind", label: "Kind", render: (e) => <Badge>{label(e.kind)}</Badge> },
            { key: "title", label: "Event" },
            { key: "detail", label: "Detail", render: (e) => e.detail || "—" },
            { key: "actor", label: "By", render: (e) => e.actor || "—" },
          ]}
        />
      </Panel>
      <Panel title="Resolved rules" subtitle={r?.acceptedTerms ? `From accepted terms ${r.acceptedTerms}; category terms override scheme and product defaults.` : "Category terms override scheme and product defaults."}>
        <ErrorNote error={rules.error} />
        <DataTable
          rows={r?.categories || []}
          loading={rules.loading}
          rowKey={(c) => c.category}
          empty="No categories"
          searchFrom={30}
          columns={[
            { key: "category", label: "Category", render: (c) => `${c.category} · ${c.name}` },
            { key: "cover", label: "Cover" },
            { key: "freeCoverLimit", label: "Free cover", align: "right", render: (c) => pula(c.freeCoverLimit) },
            { key: "ratePerMille", label: "Rate ‰", align: "right", render: (c) => number(c.ratePerMille, 2) },
            { key: "entryAges", label: "Entry ages" },
            { key: "lateEntryDays", label: "Late entry", render: (c) => (c.lateEntryDays != null ? `${c.lateEntryDays} days` : "Not configured") },
            { key: "members", label: "Members", align: "right" },
          ]}
        />
        <DataTable
          rows={r?.benefits || []}
          loading={rules.loading}
          rowKey={(b) => b.benefitType}
          empty="No scheme benefits defined (group life only)"
          searchFrom={30}
          columns={[
            { key: "benefitType", label: "Benefit", render: (b) => label(b.benefitType) },
            { key: "basis", label: "Basis", render: (b) => label(b.basis) },
            { key: "amount", label: "Amount", align: "right", render: (b) => (b.fixedAmount != null ? pula(b.fixedAmount) : b.multiple != null ? number(b.multiple, 2) : "—") },
            { key: "productMaximum", label: "Product maximum", align: "right", render: (b) => (b.productMaximum != null ? pula(b.productMaximum) : "—") },
            { key: "source", label: "Source" },
            { key: "approvalStatus", label: "Approval", render: (b) => <Badge tone={b.approvalStatus === "PENDING" ? "amber" : "green"}>{label(b.approvalStatus)}</Badge> },
          ]}
        />
      </Panel>
      <Panel
        title="Resolved benefit rules by category"
        subtitle={resolved.data?.precedence || "Category terms override scheme terms, which override the product default."}
        action={
          benefitTypes.length > 0 && (
            <select className="select" aria-label="Benefit" value={shown} onChange={(e) => setBenefit(e.target.value)}>
              {benefitTypes.map((b) => (
                <option key={b} value={b}>
                  {label(b)}
                </option>
              ))}
            </select>
          )
        }
      >
        <ErrorNote error={resolved.error} />
        {(resolved.data?.pending || []).length > 0 && (
          <p className="ga-status-note">{resolved.data.pending.length} benefit terms change(s) wait for approval and are not applied yet.</p>
        )}
        <DataTable
          rows={(forBenefit[0]?.parameters || []).map((p) => ({ ...p, byCategory: forBenefit.map((c) => ({ category: c.category, included: c.included, ...c.parameters.find((x) => x.parameter === p.parameter) })) }))}
          loading={resolved.loading}
          rowKey={(p) => p.parameter}
          searchFrom={50}
          empty="No benefit rules"
          columns={[
            { key: "label", label: "Rule", render: (p) => (
              <div className="ga-person">
                <strong>{p.label}</strong>
                <span className="ga-muted">{p.overridable ? `Default ${p.productDefault ?? "—"}${p.maximum ? ` · max ${p.maximum}` : ""}` : `Fixed by the product (${p.productDefault})`}</span>
              </div>
            ) },
            { key: "schemeValue", label: "Scheme", render: (p) => p.schemeValue ?? "—" },
            ...forBenefit.map((c) => ({
              key: "cat-" + c.category,
              label: c.category + (c.included ? "" : " (left out)"),
              render: (p) => {
                const v = p.byCategory.find((x) => x.category === c.category);
                if (!c.included) return <span className="ga-muted">Not covered</span>;
                return (
                  <span title={v?.source}>
                    {v?.resolved ?? "—"}
                    {v?.categoryValue != null && <span className="ga-muted"> · category</span>}
                  </span>
                );
              },
            })),
          ]}
        />
      </Panel>
    </>
  );
}
