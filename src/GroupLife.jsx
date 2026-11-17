import React, { useState } from "react";
import { Plus, Upload } from "lucide-react";
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
  useResource,
  when,
} from "./ui/workspace";
import "./group-admin.css";

// Group lifecycle: scheme quotations through approval to activation, each scheme's benefits and certificates,
// renewal, suspension and closure with their impact, and lender loan bordereaux.

const BENEFIT = {
  GLA: "Group life assurance",
  LUMP_SUM_DISABILITY: "Lump-sum disability",
  CRITICAL_ILLNESS: "Critical illness",
  FAMILY: "Family benefits",
  INCOME_PROTECTION: "Income protection",
  CREDIT: "Group credit",
};
const BASIS = {
  SALARY_MULTIPLE: "Multiple of salary",
  FIXED: "Fixed amount",
  MONTHLY_INCOME_PERCENT: "Percent of monthly income",
  LOAN_BALANCE: "Loan balance",
};
const Q_STATUS = {
  DRAFT: ["Draft", undefined],
  SUBMITTED: ["Awaiting approval", "amber"],
  APPROVED: ["Approved", "blue"],
  ACCEPTED: ["Accepted by sponsor", "blue"],
  ACTIVATED: ["Scheme active", "green"],
  DECLINED: ["Declined", "red"],
  SUPERSEDED: ["Superseded", undefined],
};
const EVENT = { RENEWAL: "Renewal", SUSPENSION: "Suspension", CLOSURE: "Closure", TRANSFER: "Transfer", REACTIVATION: "Reactivation" };
const badge = (map, key) => {
  const [label, tone] = map[key] || [key];
  return <Badge tone={tone}>{label}</Badge>;
};
const today = () => new Date().toISOString().slice(0, 10);
// D-41: a failed write is shown once, next to the action that failed (in the open drawer, or above the table for a
// row button), so errors are not also raised as toasts that stack over the drawer's submit button.
const inlineErrors = (notify) => (message, tone) => {
  if (tone !== "error") notify?.(message, tone);
};

export default function GroupLife({ session, notify, profile }) {
  const [tab, setTab] = useState("quotes");
  const quotes = useResource(session, "/group-life/quotes", []);
  const events = useResource(session, "/group-life/events", []);
  const schemes = useResource(session, "/group/schemes", []);
  const q = quotes.data || [];
  const reload = () => {
    quotes.reload();
    events.reload();
    schemes.reload();
  };
  return (
    <>
      <Heading
        eyebrow="GROUP BUSINESS"
        title="Scheme lifecycle"
        subtitle="Quotations and their versions, approval and activation of the master policy, each scheme's benefits and certificates, renewals and closures, and lender loan bordereaux."
      />
      <div className="stat-grid">
        <Stat label="Quotations awaiting approval" value={q.filter((x) => x.status === "SUBMITTED").length} tone="amber" loading={quotes.loading} />
        <Stat label="Accepted, to activate" value={q.filter((x) => x.status === "ACCEPTED").length} tone="blue" loading={quotes.loading} />
        <Stat label="Schemes" value={(schemes.data || []).length} loading={schemes.loading} />
        <Stat
          label="Renewals and closures to decide"
          value={(events.data || []).filter((e) => e.status === "PENDING").length}
          tone="amber"
          loading={events.loading}
        />
      </div>
      <Tabs
        value={tab}
        onChange={(next) => {
          setTab(next);
          reload();
        }}
        tabs={[
          ["quotes", "Quotations"],
          ["schemes", "Benefits, certificates & loans"],
          ["events", "Renewals & closures"],
        ]}
      />
      {tab === "quotes" && <Quotes session={session} notify={notify} profile={profile} resource={quotes} onChange={reload} />}
      {tab === "schemes" && <SchemeDetail session={session} notify={notify} profile={profile} schemes={schemes.data || []} />}
      {tab === "events" && (
        <SchemeEvents session={session} notify={notify} profile={profile} resource={events} schemes={schemes.data || []} onChange={reload} />
      )}
    </>
  );
}

// ── quotations ──────────────────────────────────────────────────────────────────────────────────

const blankQuote = () => ({
  sponsorName: "",
  sector: "",
  lives: "",
  salaryRoll: "",
  benefits: ["GLA"],
  ratingBasis: "SALARY",
  salaryMultiple: 2,
  ratePerMille: "",
  freeCoverLimit: "",
  notes: "",
});

function Quotes({ session, notify, profile, resource, onChange }) {
  const [form, setFormState] = useState(null);
  const [step, setStepState] = useState(null); // {quote, kind: "decide" | "activate"}
  const action = useAction(inlineErrors(notify));
  // A drawer opens without the error of an earlier attempt; edits inside it keep the current one.
  const setForm = (next) => {
    if (!form || !next) action.setError("");
    setFormState(next);
  };
  const setStep = (next) => {
    if (!step || !next) action.setError("");
    setStepState(next);
  };
  const me = session?.username;
  const manage = can(profile, "MANAGE_SCHEME");
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const toggle = (b) => setForm({ ...form, benefits: form.benefits.includes(b) ? form.benefits.filter((x) => x !== b) : [...form.benefits, b] });
  const save = async () => {
    const { revising, ...body } = form;
    const done = await action.run(
      () => request(session, revising ? "/group-life/quotes/" + revising + "/revision" : "/group-life/quotes", { method: "POST", body }),
      revising ? "New version saved" : "Quotation created",
    );
    if (done) {
      setForm(null);
      onChange();
    }
  };
  const progress = async (quote, act, note) => {
    const done = await action.run(
      () => request(session, "/group-life/quotes/" + quote.ref + "/progress", { method: "POST", body: { action: act, note } }),
      "Quotation updated",
    );
    if (done) {
      setStep(null);
      onChange();
    }
  };
  const activate = async () => {
    const done = await action.run(
      () =>
        request(session, "/group-life/quotes/" + step.quote.ref + "/activation", {
          method: "POST",
          body: { inceptionDate: step.inceptionDate, wordingConfirmed: step.wordingConfirmed },
        }),
      "Master policy activated",
    );
    if (done) {
      setStep(null);
      onChange();
    }
  };
  const latest = {};
  (resource.data || []).forEach((x) => {
    if (!latest[x.ref] || latest[x.ref] < x.version) latest[x.ref] = x.version;
  });
  return (
    <>
      <Panel
        title="Scheme quotations"
        subtitle="A revision is a new version beside the earlier ones. An underwriter other than the preparer approves; the sponsor accepts; then the master policy is activated."
        action={
          manage && (
            <Button icon={Plus} onClick={() => setForm(blankQuote())}>
              New quotation
            </Button>
          )
        }
      >
        <ErrorNote error={resource.error || (!form && !step ? action.error : "")} />
        <DataTable
          rows={resource.data}
          loading={resource.loading}
          rowKey={(r) => r.ref + "-" + r.version}
          empty="No quotations"
          searchPlaceholder="Search quotations, sponsors…"
          columns={[
            { key: "ref", label: "Quote", render: (r) => r.ref + " v" + r.version },
            { key: "sponsorName", label: "Sponsor" },
            { key: "lives", label: "Lives", align: "right" },
            { key: "benefits", label: "Benefits", render: (r) => r.benefits.map((b) => BENEFIT[b] || b).join(", ") },
            { key: "ratePerMille", label: "Rate ‰", align: "right", render: (r) => Number(r.ratePerMille) },
            { key: "annualPremium", label: "Annual premium", align: "right", sortValue: (r) => Number(r.annualPremium), render: (r) => pula(r.annualPremium) },
            { key: "freeCoverLimit", label: "Free cover", align: "right", render: (r) => (r.freeCoverLimit == null ? "Not set" : pula(r.freeCoverLimit)) },
            { key: "status", label: "Status", render: (r) => badge(Q_STATUS, r.status) },
            {
              key: "act",
              label: "",
              render: (r) =>
                latest[r.ref] === r.version && (
                  <div className="ws-row-actions">
                    {manage && r.status === "DRAFT" && (
                      <Button variant="secondary" busy={action.busy} onClick={() => progress(r, "SUBMIT")}>
                        Submit
                      </Button>
                    )}
                    {can(profile, "UNDERWRITE_MEMBER") && r.status === "SUBMITTED" && r.createdBy !== me && (
                      <Button variant="secondary" onClick={() => setStep({ quote: r, kind: "decide", note: "", approve: true })}>
                        Decide
                      </Button>
                    )}
                    {r.status === "SUBMITTED" && r.createdBy === me && <small className="ws-hint">Needs another approver</small>}
                    {manage && r.status === "APPROVED" && (
                      <Button variant="secondary" busy={action.busy} onClick={() => progress(r, "ACCEPT")}>
                        Sponsor accepted
                      </Button>
                    )}
                    {manage && r.status === "ACCEPTED" && (
                      <Button onClick={() => setStep({ quote: r, kind: "activate", inceptionDate: today(), wordingConfirmed: false })}>Activate</Button>
                    )}
                    {manage && !["ACTIVATED"].includes(r.status) && (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setForm({
                            revising: r.ref,
                            sponsorName: r.sponsorName,
                            sector: r.sector,
                            lives: r.lives,
                            salaryRoll: r.salaryRoll,
                            benefits: r.benefits,
                            ratingBasis: r.ratingBasis,
                            salaryMultiple: r.salaryMultiple,
                            ratePerMille: r.ratePerMille,
                            freeCoverLimit: r.freeCoverLimit ?? "",
                            notes: "",
                          })
                        }
                      >
                        Revise
                      </Button>
                    )}
                    {r.status === "ACTIVATED" && <small className="ws-hint">{r.schemeRef}</small>}
                  </div>
                ),
            },
          ]}
        />
      </Panel>
      {form && (
        <Drawer
          title={form.revising ? "Revise " + form.revising : "New scheme quotation"}
          description="The premium is the sum assured (salary roll × multiple) at the rate per 1,000."
          onClose={() => setForm(null)}
        >
          <FormGrid submitLabel={form.revising ? "Save new version" : "Create quotation"} busy={action.busy} error={action.error} onSubmit={save}>
            <Field label="Sponsor (employer)">
              <input value={form.sponsorName} onChange={set("sponsorName")} required />
            </Field>
            <Field label="Sector">
              <input value={form.sector} onChange={set("sector")} required />
            </Field>
            <Field label="Lives in the census">
              <input type="number" min="1" value={form.lives} onChange={set("lives")} required />
            </Field>
            <Field label="Annual salary roll (BWP)">
              <input type="number" min="1" step="0.01" value={form.salaryRoll} onChange={set("salaryRoll")} required />
            </Field>
            <Field label="Rating basis">
              <select value={form.ratingBasis} onChange={set("ratingBasis")}>
                <option value="SALARY">Salary</option>
                <option value="SUM_ASSURED">Sum assured</option>
                <option value="PER_MEMBER">Per member</option>
                <option value="LOAN_BALANCE">Loan balance</option>
              </select>
            </Field>
            <Field label="Salary multiple">
              <input type="number" min="0.01" step="0.01" value={form.salaryMultiple} onChange={set("salaryMultiple")} required />
            </Field>
            <Field
              label="Rate per 1,000"
              hint={
                form.salaryRoll && form.ratePerMille
                  ? "Annual premium " + pula((Number(form.salaryRoll) * Number(form.salaryMultiple || 1) * Number(form.ratePerMille)) / 1000)
                  : undefined
              }
            >
              <input type="number" min="0.0001" step="0.0001" value={form.ratePerMille} onChange={set("ratePerMille")} required />
            </Field>
            <Field label="Free-cover limit (BWP)" hint="Needed before activation">
              <input type="number" min="0" step="0.01" value={form.freeCoverLimit} onChange={set("freeCoverLimit")} />
            </Field>
            <div className="form-label full" role="group" aria-label="Benefits">
              <span>Benefits</span>
              <div className="ri-products">
                {Object.entries(BENEFIT).map(([k, label]) => (
                  <label key={k} className="ri-product">
                    <input type="checkbox" checked={form.benefits.includes(k)} onChange={() => toggle(k)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <Field label="Notes" full>
              <textarea value={form.notes} onChange={set("notes")} rows={2} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      {step?.kind === "decide" && (
        <Drawer title={"Decide " + step.quote.ref + " v" + step.quote.version} description={step.quote.sponsorName + " · " + pula(step.quote.annualPremium) + " a year"} onClose={() => setStep(null)}>
          <FormGrid submitLabel="Save decision" busy={action.busy} error={action.error} onSubmit={() => progress(step.quote, step.approve ? "APPROVE" : "DECLINE", step.note)}>
            <Field label="Decision" full>
              <select value={step.approve ? "yes" : "no"} onChange={(e) => setStep({ ...step, approve: e.target.value === "yes" })}>
                <option value="yes">Approve the terms</option>
                <option value="no">Decline</option>
              </select>
            </Field>
            <Field label="Note" full>
              <textarea value={step.note} onChange={(e) => setStep({ ...step, note: e.target.value })} rows={3} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      {step?.kind === "activate" && (
        <Drawer title={"Activate " + step.quote.sponsorName} description="Creates the master policy from the accepted quotation." onClose={() => setStep(null)}>
          <FormGrid submitLabel="Activate master policy" busy={action.busy} error={action.error} onSubmit={activate}>
            <Field label="Inception date" full>
              <input type="date" value={step.inceptionDate} onChange={(e) => setStep({ ...step, inceptionDate: e.target.value })} required />
            </Field>
            <Field label="Wording" full>
              <label className="ri-product">
                <input type="checkbox" checked={step.wordingConfirmed} onChange={(e) => setStep({ ...step, wordingConfirmed: e.target.checked })} />
                <span>The approved scheme wording has been issued to the sponsor</span>
              </label>
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

// ── benefits, certificates, credit loans ────────────────────────────────────────────────────────

function SchemeDetail({ session, notify, profile, schemes }) {
  const [ref, setRef] = useState(schemes[0]?.ref || "");
  const current = ref || schemes[0]?.ref || "";
  const base = current ? "/group-life/schemes/" + current : null;
  const benefits = useResource(session, base && base + "/benefits", []);
  const certificates = useResource(session, base && base + "/certificates", []);
  const loans = useResource(session, base && base + "/credit-loans", []);
  const bordereaux = useResource(session, base && base + "/bordereaux", []);
  const [loan, setLoan] = useState(null);
  const [form, setForm] = useState(null);
  const [certificate, setCertificate] = useState(null);
  const [result, setResult] = useState(null);
  const action = useAction(inlineErrors(notify));
  const settling = useAction(inlineErrors(notify));
  const manage = can(profile, "MANAGE_SCHEME");
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const submit = async () => {
    if (form.kind === "benefit") {
      const { kind, ...body } = form;
      const done = await action.run(() => request(session, base + "/benefits", { method: "PUT", body }), "Benefit saved");
      if (done) {
        setForm(null);
        benefits.reload();
      }
      return;
    }
    const rows = form.rows
      .split("\n")
      .map((line) => line.split(",").map((x) => x.trim()))
      .filter((c) => c.length >= 4 && c[0])
      .map(([lenderLoanId, borrowerName, loanAmount, termMonths]) => ({ lenderLoanId, borrowerName, loanAmount, termMonths }));
    const done = await action.run(() => request(session, base + "/credit-loans", { method: "POST", body: { batchReference: form.batchReference, rows } }));
    if (done) {
      setResult(done.data);
      setForm(null);
      loans.reload();
      bordereaux.reload();
    }
  };
  const [settlement, setSettlement] = useState(null); // the early-settlement preview being confirmed
  const previewSettlement = async (loan, date = today()) => {
    const done = await settling.run(() => request(session, "/group-life/credit-loans/" + loan.id + "/settlement?settlementDate=" + date));
    if (done) setSettlement({ ...done.data, settlementDate: date });
  };
  const settle = async () => {
    const done = await settling.run(
      () => request(session, "/group-life/credit-loans/" + settlement.id + "/settlement", { method: "POST", body: { settlementDate: settlement.settlementDate } }),
      "Loan settled",
    );
    if (done) {
      setSettlement(null);
      loans.reload();
    }
  };
  const pendingPlan = (benefits.data || []).filter((b) => b.approvalStatus === "PENDING");
  const approvePlan = async () => {
    const done = await action.run(
      () => request(session, base + "/benefits/approval", { method: "POST", body: { note: form.note } }),
      "Plan approved",
    );
    if (done) {
      setForm(null);
      benefits.reload();
    }
  };
  if (!schemes.length) {
    return <Panel title="No schemes yet" subtitle="Activate a quotation to create the first scheme." />;
  }
  const hasCredit = (benefits.data || []).some((b) => b.benefitType === "CREDIT");
  return (
    <>
      <Panel
        title="Scheme benefits"
        subtitle="Each benefit has its own definition. A scheme cannot go above the product's maximum for a benefit."
        action={
          <div className="ws-row-actions">
            <select aria-label="Scheme" value={current} onChange={(e) => setRef(e.target.value)}>
              {schemes.map((s) => (
                <option key={s.ref} value={s.ref}>
                  {s.ref} · {s.name}
                </option>
              ))}
            </select>
            {pendingPlan.length > 0 && can(profile, "UNDERWRITE_MEMBER") && !pendingPlan.some((b) => b.updatedBy === session?.username) && (
              <Button variant="secondary" onClick={() => { action.setError(""); setForm({ kind: "approval", note: "" }); }}>
                Approve plan changes
              </Button>
            )}
            {manage && (
              <Button icon={Plus} onClick={() => { action.setError(""); setForm({ kind: "benefit", benefitType: "GLA", basis: "SALARY_MULTIPLE", multiple: "", fixedAmount: "", waitingMonths: "", terms: "" }); }}>
                Add or change a benefit
              </Button>
            )}
          </div>
        }
      >
        <ErrorNote error={benefits.error} />
        <DataTable
          rows={benefits.data}
          loading={benefits.loading}
          rowKey={(r) => r.benefitType}
          searchFrom={99}
          empty="No benefits defined for this scheme"
          columns={[
            { key: "benefitType", label: "Benefit", render: (r) => BENEFIT[r.benefitType] || r.benefitType },
            { key: "basis", label: "Basis", render: (r) => BASIS[r.basis] || r.basis },
            {
              key: "amount",
              label: "Amount",
              render: (r) =>
                r.basis === "FIXED" ? pula(r.fixedAmount) : r.multiple != null ? Number(r.multiple) + (r.basis === "MONTHLY_INCOME_PERCENT" ? "%" : " ×") : "—",
            },
            { key: "productMaximum", label: "Product maximum", render: (r) => (r.productMaximum ? pula(r.productMaximum) : "—") },
            { key: "terms", label: "Terms" },
            {
              key: "approvalStatus",
              label: "Approval",
              render: (r) =>
                r.approvalStatus === "PENDING" ? (
                  <Badge tone="amber">Awaiting approval</Badge>
                ) : (
                  <span className="ws-hint">Approved{r.approvedBy ? " by " + r.approvedBy : ""}</span>
                ),
            },
          ]}
        />
        {pendingPlan.length > 0 && (
          <p className="ws-hint">
            {pendingPlan.length} benefit change(s) wait for a second person to approve the plan
            {pendingPlan.some((b) => b.updatedBy === session?.username) ? "; you made them, so someone else approves." : "."}
          </p>
        )}
      </Panel>
      <Panel title="Member certificates" subtitle="Only accepted cover is certified. Cover awaiting underwriting is shown as pending and is not yet in force.">
        <DataTable
          rows={certificates.data}
          loading={certificates.loading}
          rowKey={(r) => r.certificateNo}
          onRowClick={setCertificate}
          empty="No covered members yet"
          emptyDetail="Certificates appear once members have been added through a census."
          columns={[
            { key: "certificateNo", label: "Certificate" },
            { key: "member", label: "Member" },
            { key: "category", label: "Category", render: (r) => r.category || "—" },
            { key: "acceptedCover", label: "Cover in force", align: "right", render: (r) => pula(r.acceptedCover) },
            { key: "pendingCover", label: "Pending underwriting", align: "right", render: (r) => (Number(r.pendingCover) > 0 ? pula(r.pendingCover) : "—") },
            { key: "coverTo", label: "To" },
          ]}
        />
      </Panel>
      <Panel
        title="Group credit loans"
        subtitle="A lender's loan bordereau: each loan gets a certificate once; a loan above the scheme's cap is referred with the limit shown."
        action={
          can(profile, "PROCESS_CENSUS") &&
          hasCredit && (
            <Button icon={Upload} onClick={() => { action.setError(""); setForm({ kind: "bordereau", batchReference: "", rows: "" }); }}>
              Loan bordereau
            </Button>
          )
        }
      >
        {!hasCredit && <p className="ws-hint">This scheme has no Group credit benefit.</p>}
        <ErrorNote error={loans.error || (!settlement ? settling.error : "")} />
        {result && (
          <p className="ws-hint">
            {result.batchReference}: {result.accepted} accepted · {result.referred} referred · {result.duplicates} already on the scheme · {result.rejected} rejected
            · premium {pula(result.premiumTotal)}
          </p>
        )}
        {(bordereaux.data || []).length > 0 && (
          <details className="gl-impact-list">
            <summary>Bordereau history ({bordereaux.data.length} file(s))</summary>
            <DataTable
              rows={bordereaux.data}
              rowKey={(b) => b.batchReference}
              searchFrom={20}
              columns={[
                { key: "batchReference", label: "File" },
                { key: "receivedAt", label: "Received", render: (b) => when(b.receivedAt) },
                { key: "loans", label: "Loans", align: "right" },
                { key: "active", label: "Covered", align: "right" },
                { key: "referred", label: "Referred", align: "right" },
                { key: "settled", label: "Settled", align: "right" },
                { key: "coverAmount", label: "Cover", align: "right", render: (b) => pula(b.coverAmount) },
                { key: "premium", label: "Premium", align: "right", render: (b) => pula(b.premium) },
              ]}
            />
          </details>
        )}
        <DataTable
          rows={loans.data}
          loading={loans.loading}
          rowKey={(r) => r.id}
          onRowClick={setLoan}
          empty="No loans"
          columns={[
            { key: "certificateNo", label: "Certificate" },
            { key: "borrowerName", label: "Borrower" },
            { key: "loanAmount", label: "Loan", align: "right", render: (r) => pula(r.loanAmount) },
            { key: "coverAmount", label: "Cover", align: "right", render: (r) => pula(r.coverAmount) },
            { key: "termMonths", label: "Term", align: "right" },
            { key: "premium", label: "Premium", align: "right", render: (r) => pula(r.premium) },
            {
              key: "status",
              label: "Status",
              render: (r) => <Badge tone={r.status === "ACTIVE" ? "green" : r.status === "REFERRED" ? "amber" : undefined}>{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</Badge>,
            },
            { key: "note", label: "Note", render: (r) => (r.status === "SETTLED" ? "Refund " + pula(r.refund) : r.note || "—") },
            {
              key: "act",
              label: "",
              render: (r) =>
                r.status === "ACTIVE" &&
                can(profile, "BILL_SCHEME") && (
                  <Button variant="secondary" busy={settling.busy} onClick={() => previewSettlement(r)}>
                    Settle early
                  </Button>
                ),
            },
          ]}
        />
      </Panel>
      {certificate && (
        <Drawer title={"Certificate " + certificate.certificateNo} description={certificate.scheme + " · policy year " + certificate.policyYear} onClose={() => setCertificate(null)}>
          <div className="ws-kv">
            <div>
              <small>Member</small>
              <strong>{certificate.member}</strong>
            </div>
            <div>
              <small>Category</small>
              <strong>{certificate.category || "—"}</strong>
            </div>
            <div>
              <small>Cover in force</small>
              <strong>{pula(certificate.acceptedCover)}</strong>
            </div>
            <div>
              <small>Pending underwriting</small>
              <strong>{Number(certificate.pendingCover) > 0 ? pula(certificate.pendingCover) + " (not in force)" : "None"}</strong>
            </div>
            <div>
              <small>Cover period</small>
              <strong>
                {certificate.coverFrom} → {certificate.coverTo}
              </strong>
            </div>
            <div>
              <small>Benefits</small>
              <strong>{certificate.benefits.map((b) => BENEFIT[b] || b).join(", ")}</strong>
            </div>
          </div>
          <div className="ws-form-actions">
            <Button variant="secondary" onClick={() => window.print()}>
              Print certificate
            </Button>
          </div>
        </Drawer>
      )}
      {loan && (
        <Drawer title={"Certificate " + loan.certificateNo} description={"Borrower cover under " + current + " · lender loan " + loan.lenderLoanId} onClose={() => setLoan(null)}>
          <div className="ws-kv">
            <div>
              <small>Borrower</small>
              <strong>{loan.borrowerName}</strong>
            </div>
            <div>
              <small>Loan / cover</small>
              <strong>
                {pula(loan.loanAmount)} / {pula(loan.coverAmount)}
              </strong>
            </div>
            <div>
              <small>Term</small>
              <strong>{loan.termMonths} months from {loan.startDate}</strong>
            </div>
            <div>
              <small>Single premium</small>
              <strong>{pula(loan.premium)}</strong>
            </div>
            <div>
              <small>Status</small>
              <strong>{loan.status.charAt(0) + loan.status.slice(1).toLowerCase()}</strong>
            </div>
            <div>
              <small>Bordereau</small>
              <strong>{loan.batchRef}</strong>
            </div>
            {loan.settledOn && (
              <div>
                <small>Settled</small>
                <strong>
                  {loan.settledOn} · refund {pula(loan.refund)}
                </strong>
              </div>
            )}
          </div>
          {loan.note && <p className="ws-hint">{loan.note}</p>}
          <div className="ws-form-actions">
            <Button variant="secondary" onClick={() => window.print()}>
              Print certificate
            </Button>
          </div>
        </Drawer>
      )}
      {settlement && (
        <Drawer title={"Settle " + settlement.certificateNo + " early"} description={settlement.borrowerName + " · loan " + pula(settlement.loanAmount)} onClose={() => setSettlement(null)}>
          <div className="ws-kv">
            <div>
              <small>Single premium</small>
              <strong>{pula(settlement.premium)}</strong>
            </div>
            <div>
              <small>Months used / unearned</small>
              <strong>
                {settlement.monthsUsed} / {settlement.monthsUnearned} of {settlement.termMonths}
              </strong>
            </div>
            <div>
              <small>Refund of unearned premium</small>
              <strong>{pula(settlement.refundPreview)}</strong>
            </div>
          </div>
          <p className="ws-hint">Unearned months pro rata, less 10%. Cover on this certificate ends on the settlement date.</p>
          <FormGrid submitLabel={"Settle and refund " + pula(settlement.refundPreview)} busy={settling.busy} error={settling.error} onSubmit={settle}>
            <Field label="Settlement date" full>
              <input type="date" value={settlement.settlementDate} onChange={(e) => previewSettlement(settlement, e.target.value)} required />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      {form?.kind === "approval" && (
        <Drawer title="Approve plan changes" description={pendingPlan.map((b) => BENEFIT[b.benefitType] || b.benefitType).join(", ")} onClose={() => setForm(null)}>
          <FormGrid submitLabel="Approve the plan" busy={action.busy} error={action.error} onSubmit={approvePlan}>
            <Field label="Approval note" full>
              <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} required />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      {form && form.kind !== "approval" && (
        <Drawer
          title={form.kind === "benefit" ? "Scheme benefit" : "Loan bordereau"}
          description={form.kind === "bordereau" ? "One loan per line: lender's loan id, borrower, loan amount, term in months." : undefined}
          onClose={() => setForm(null)}
        >
          <FormGrid submitLabel={form.kind === "benefit" ? "Save benefit" : "Process bordereau"} busy={action.busy} error={action.error} onSubmit={submit}>
            {form.kind === "benefit" ? (
              <>
                <Field label="Benefit">
                  <select value={form.benefitType} onChange={set("benefitType")}>
                    {Object.entries(BENEFIT).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Basis">
                  <select value={form.basis} onChange={set("basis")}>
                    {Object.entries(BASIS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                {form.basis === "FIXED" ? (
                  <Field label="Amount (BWP)">
                    <input type="number" min="1" step="0.01" value={form.fixedAmount} onChange={set("fixedAmount")} required />
                  </Field>
                ) : (
                  <Field label={form.basis === "MONTHLY_INCOME_PERCENT" ? "Percent of income" : "Multiple"}>
                    <input type="number" min="0.01" step="0.01" value={form.multiple} onChange={set("multiple")} />
                  </Field>
                )}
                <Field label="Waiting / deferred period (months)">
                  <input type="number" min="0" value={form.waitingMonths} onChange={set("waitingMonths")} />
                </Field>
                <Field label="Terms" hint="Leave blank for the product's standard terms" full>
                  <textarea value={form.terms} onChange={set("terms")} rows={3} />
                </Field>
              </>
            ) : (
              <>
                <Field label="Bordereau reference" full>
                  <input value={form.batchReference} onChange={set("batchReference")} required />
                </Field>
                <Field label="Rows" full>
                  <textarea className="ws-textarea" value={form.rows} onChange={set("rows")} placeholder="LN-001, Thabo Molefe, 200000, 24" required />
                </Field>
              </>
            )}
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

// ── renewals, suspensions, closures and transfers ──────────────────────────────────────────────

const memberStatus = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replaceAll("_", " ") : "—");

/** What a lifecycle request touches, shown before it is raised and again to the person who decides it (AT-GL01-03). */
function ImpactSummary({ impact }) {
  if (!impact) return null;
  const ends = ["SUSPENSION", "CLOSURE", "TRANSFER"].includes(impact.eventType);
  return (
    <div className="form-label full gl-impact">
      <span>What this affects</span>
      <div className="ws-kv">
        <div>
          <small>Members affected</small>
          <strong>{impact.affectedMembers ?? impact.activeMembers}</strong>
        </div>
        <div>
          <small>Pending underwriting</small>
          <strong>{impact.pendingUnderwriting}</strong>
        </div>
        <div>
          <small>Unpaid invoices</small>
          <strong>
            {impact.unpaidInvoices} · {pula(impact.outstandingAmount)}
          </strong>
        </div>
        {ends && (
          <div>
            <small>Invoiced past {impact.effectiveDate}</small>
            <strong>{pula(impact.premiumInvoicedAfterEffective)}</strong>
          </div>
        )}
        <div>
          <small>Pending claims</small>
          <strong>{impact.pendingClaims ?? 0}</strong>
        </div>
        <div>
          <small>Income benefits in payment</small>
          <strong>{impact.claimsInPayment ?? 0}</strong>
        </div>
        <div>
          <small>Borrower certificates in force</small>
          <strong>{impact.activeCreditLoans}</strong>
        </div>
        <div>
          <small>Policy year</small>
          <strong>
            {impact.policyYear} (to {impact.renewalDate})
          </strong>
        </div>
      </div>
      {(impact.blockers || []).length > 0 && <ErrorNote error={impact.blockers.join(" ")} />}
      <ul className="uw-list">
        {impact.notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
      {(impact.comparison || []).length > 0 && (
        <details className="gl-impact-list" open>
          <summary>Renewal comparison: expiring and proposed terms ({Number(impact.rateChangePercent || 0)}% rate change)</summary>
          <DataTable
            rows={impact.comparison}
            rowKey={(r) => r.category}
            searchFrom={20}
            columns={[
              { key: "category", label: "Category", render: (r) => r.category + " · " + r.name },
              { key: "members", label: "Members", align: "right" },
              { key: "coverInForce", label: "Cover in force", align: "right", render: (r) => pula(r.coverInForce) },
              { key: "ratePerMille", label: "Rate ‰ now", align: "right", render: (r) => Number(r.ratePerMille) },
              { key: "proposedRatePerMille", label: "Proposed ‰", align: "right", render: (r) => Number(r.proposedRatePerMille) },
              { key: "monthlyPremium", label: "Premium / month now", align: "right", render: (r) => pula(r.monthlyPremium) },
              { key: "proposedMonthlyPremium", label: "Proposed / month", align: "right", render: (r) => pula(r.proposedMonthlyPremium) },
            ]}
          />
        </details>
      )}
      {(impact.members || []).length > 0 && (
        <details className="gl-impact-list">
          <summary>Members affected ({impact.members.length})</summary>
          <DataTable
            rows={impact.members}
            rowKey={(r) => r.memberKey}
            searchFrom={20}
            columns={[
              { key: "memberKey", label: "Member", render: (r) => r.memberKey + " · " + r.name },
              { key: "category", label: "Category" },
              { key: "status", label: "Status", render: (r) => memberStatus(r.status) },
              { key: "acceptedCover", label: "Cover in force", align: "right", render: (r) => pula(r.acceptedCover) },
              { key: "pendingCover", label: "Pending", align: "right", render: (r) => (Number(r.pendingCover) > 0 ? pula(r.pendingCover) : "—") },
            ]}
          />
        </details>
      )}
      {(impact.invoices || []).length > 0 && (
        <details className="gl-impact-list">
          <summary>Unpaid invoices ({impact.invoices.length})</summary>
          <DataTable
            rows={impact.invoices}
            rowKey={(r) => r.ref}
            searchFrom={20}
            columns={[
              { key: "ref", label: "Invoice" },
              { key: "period", label: "Period" },
              { key: "amount", label: "Amount", align: "right", render: (r) => pula(r.amount) },
              { key: "outstanding", label: "Outstanding", align: "right", render: (r) => pula(r.outstanding) },
            ]}
          />
        </details>
      )}
      {[...(impact.claims || []), ...(impact.incomeClaims || [])].length > 0 && (
        <details className="gl-impact-list" open>
          <summary>Claims pending or in payment ({(impact.claims || []).length + (impact.incomeClaims || []).length})</summary>
          <DataTable
            rows={[...(impact.claims || []), ...(impact.incomeClaims || [])]}
            rowKey={(r) => r.ref}
            searchFrom={20}
            columns={[
              { key: "ref", label: "Claim" },
              { key: "member", label: "Member", render: (r) => r.memberKey + " · " + r.member },
              { key: "benefitType", label: "Benefit", render: (r) => BENEFIT[r.benefitType] || r.benefitType },
              { key: "eventDate", label: "Event" },
              { key: "status", label: "Status", render: (r) => memberStatus(r.status) },
              { key: "amount", label: "Amount", align: "right", render: (r) => pula(r.amount) },
            ]}
          />
        </details>
      )}
    </div>
  );
}

function SchemeEvents({ session, notify, profile, resource, schemes, onChange }) {
  const [form, setForm] = useState(null);
  const [impact, setImpact] = useState(null);
  const [deciding, setDeciding] = useState(null);
  const action = useAction(inlineErrors(notify));
  const me = session?.username;
  const preview = async (next) => {
    setForm(next);
    setImpact(null);
    if (!next.schemeRef || (next.eventType === "TRANSFER" && !next.targetSchemeRef)) return;
    const params = new URLSearchParams({ eventType: next.eventType });
    if (next.eventType !== "RENEWAL" && next.effectiveDate) params.set("effectiveDate", next.effectiveDate);
    if (next.eventType === "TRANSFER") params.set("targetSchemeRef", next.targetSchemeRef);
    if (next.eventType === "RENEWAL" && next.rateChangePercent !== "") params.set("rateChangePercent", next.rateChangePercent);
    const done = await action.run(() => request(session, "/group-life/schemes/" + next.schemeRef + "/impact?" + params));
    if (done) setImpact(done.data);
  };
  const submit = async () => {
    const { schemeRef, ...body } = form;
    if (body.eventType !== "TRANSFER") delete body.targetSchemeRef;
    const done = await action.run(() => request(session, "/group-life/schemes/" + schemeRef + "/events", { method: "POST", body }), "Request raised for approval");
    if (done) {
      setForm(null);
      onChange();
    }
  };
  const decide = async () => {
    const done = await action.run(
      () => request(session, "/group-life/events/" + deciding.ref + "/decision", { method: "POST", body: { approve: deciding.approve, note: deciding.note } }),
      "Decision saved",
    );
    if (done) {
      setDeciding(null);
      onChange();
    }
  };
  const nameOf = (ref) => schemes.find((s) => s.ref === ref)?.name || "";
  const targets = form ? schemes.filter((s) => s.ref !== form.schemeRef && s.status === "ACTIVE") : [];
  return (
    <>
      <Panel
        title="Renewals, suspensions, closures and transfers"
        subtitle="Each request shows what it affects before approval and is decided by a second person. Members keep their cover history; a scheme is closed, never deleted once it has activity."
        action={
          can(profile, "MANAGE_SCHEME") &&
          schemes.length > 0 && (
            <Button icon={Plus} onClick={() => preview({ schemeRef: schemes[0].ref, eventType: "RENEWAL", effectiveDate: today(), rateChangePercent: "", targetSchemeRef: "", reason: "" })}>
              New request
            </Button>
          )
        }
      >
        <ErrorNote error={resource.error} />
        <DataTable
          rows={resource.data}
          loading={resource.loading}
          rowKey={(r) => r.ref}
          empty="No requests"
          columns={[
            { key: "ref", label: "Request" },
            { key: "schemeRef", label: "Scheme", render: (r) => r.schemeRef + " · " + nameOf(r.schemeRef) },
            { key: "eventType", label: "Type", render: (r) => (EVENT[r.eventType] || r.eventType) + (r.targetSchemeRef ? " to " + r.targetSchemeRef : "") },
            { key: "effectiveDate", label: "Effective" },
            { key: "impact", label: "Impact", render: (r) => r.impact[0] },
            {
              key: "status",
              label: "Status",
              render: (r) => <Badge tone={r.status === "PENDING" ? "amber" : r.status === "APPROVED" ? "green" : undefined}>{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</Badge>,
            },
            { key: "requestedBy", label: "Requested", render: (r) => r.requestedBy + " · " + when(r.requestedAt) },
            {
              key: "act",
              label: "",
              render: (r) =>
                r.status === "PENDING" &&
                can(profile, "UNDERWRITE_MEMBER") &&
                (r.requestedBy === me ? (
                  <small className="ws-hint">Needs another person</small>
                ) : (
                  <Button variant="secondary" onClick={() => { action.setError(""); setDeciding({ ...r, approve: true, note: "" }); }}>
                    Decide
                  </Button>
                )),
            },
          ]}
        />
      </Panel>
      {form && (
        <Drawer size="lg" title="Renewal, suspension, closure or transfer" onClose={() => setForm(null)}>
          <FormGrid submitLabel="Raise for approval" busy={action.busy} error={action.error} onSubmit={submit}>
            <Field label="Scheme">
              <select value={form.schemeRef} onChange={(e) => preview({ ...form, schemeRef: e.target.value, targetSchemeRef: "" })}>
                {schemes.map((s) => (
                  <option key={s.ref} value={s.ref}>
                    {s.ref} · {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Request">
              <select value={form.eventType} onChange={(e) => preview({ ...form, eventType: e.target.value })}>
                {Object.entries(EVENT).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            {form.eventType === "RENEWAL" ? (
              <Field label="Rate change (%)">
                <input type="number" step="0.01" value={form.rateChangePercent} onChange={(e) => setForm({ ...form, rateChangePercent: e.target.value })} onBlur={() => preview(form)} />
              </Field>
            ) : (
              <Field label="Effective date" hint={form.eventType === "REACTIVATION" ? "First day back on cover" : "First day without cover on this scheme"}>
                <input type="date" value={form.effectiveDate} onChange={(e) => preview({ ...form, effectiveDate: e.target.value })} required />
              </Field>
            )}
            {form.eventType === "TRANSFER" && (
              <Field label="Transfer members to" hint="An active scheme with the same category codes">
                <select value={form.targetSchemeRef} onChange={(e) => preview({ ...form, targetSchemeRef: e.target.value })} required>
                  <option value="">Choose a scheme</option>
                  {targets.map((s) => (
                    <option key={s.ref} value={s.ref}>
                      {s.ref} · {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Reason" full>
              <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2} required />
            </Field>
            <ImpactSummary impact={impact} />
          </FormGrid>
        </Drawer>
      )}
      {deciding && (
        <Drawer
          size="lg"
          title={"Decide " + deciding.ref}
          description={(EVENT[deciding.eventType] || deciding.eventType) + " of " + deciding.schemeRef + (deciding.targetSchemeRef ? " to " + deciding.targetSchemeRef : "") + " from " + deciding.effectiveDate + " · requested by " + deciding.requestedBy + ": " + deciding.reason}
          onClose={() => setDeciding(null)}
        >
          {deciding.impactDetail ? (
            <ImpactSummary impact={deciding.impactDetail} />
          ) : (
            <ul className="uw-list">
              {deciding.impact.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
          <FormGrid submitLabel="Save decision" busy={action.busy} error={action.error} onSubmit={decide}>
            <Field label="Decision" full>
              <select value={deciding.approve ? "yes" : "no"} onChange={(e) => setDeciding({ ...deciding, approve: e.target.value === "yes" })}>
                <option value="yes">Approve</option>
                <option value="no">Reject</option>
              </select>
            </Field>
            <Field label="Note" full>
              <textarea value={deciding.note} onChange={(e) => setDeciding({ ...deciding, note: e.target.value })} rows={3} required />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}
