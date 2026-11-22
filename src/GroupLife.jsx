import React, { useState } from "react";
import { Plus, Upload } from "lucide-react";
import { fetchFile, request } from "./api";
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
/** Opens a generated PDF (scheme schedule, member certificate) in a new tab; the API needs the session header. */
const openPdf = async (session, path, notify) => {
  try {
    const blob = await fetchFile(session, path);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    notify?.(e.message, "error");
  }
};
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
          ["rates", "Rate tables & sponsors"],
        ]}
      />
      {tab === "quotes" && <Quotes session={session} notify={notify} profile={profile} resource={quotes} onChange={reload} />}
      {tab === "schemes" && <SchemeDetail session={session} notify={notify} profile={profile} schemes={schemes.data || []} />}
      {tab === "rates" && <RatesAndSponsors session={session} notify={notify} profile={profile} />}
      {tab === "events" && (
        <SchemeEvents session={session} notify={notify} profile={profile} resource={events} schemes={schemes.data || []} onChange={reload} />
      )}
    </>
  );
}

// ── quotations ──────────────────────────────────────────────────────────────────────────────────

const blankQuote = () => ({
  sponsorRef: "",
  sponsorName: "",
  sector: "",
  lives: "",
  salaryRoll: "",
  benefits: ["GLA"],
  ratingBasis: "SUM_ASSURED",
  rateSource: "TABLE",
  salaryMultiple: 2,
  ratePerMille: "",
  adjustmentPercent: "",
  expensePercent: "",
  commissionPercent: "",
  profitPercent: "",
  validityDays: "",
  freeCoverLimit: "",
  census: "",
  categories: [],
  notes: "",
});
const RATE_UNIT = {
  SALARY: "per 1,000 of salary a year",
  SUM_ASSURED: "per 1,000 of sum assured a year",
  PER_MEMBER: "per member a year",
  LOAN_BALANCE: "per 1,000 of loan balance a year",
};
const CENSUS_TEMPLATE = "memberKey,dateOfBirth,category,salary,loanBalance";
/** The quote form as the API wants it: empty optional fields left out, loadings grouped as assumptions. */
const quoteBody = (form) => {
  const { revising, expensePercent, commissionPercent, profitPercent, ...rest } = form;
  const body = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== "" && v !== null && !(Array.isArray(v) && !v.length)));
  if (body.rateSource === "TABLE") delete body.ratePerMille;
  const assumptions = Object.fromEntries(Object.entries({ expensePercent, commissionPercent, profitPercent }).filter(([, v]) => v !== "" && v != null));
  if (Object.keys(assumptions).length) body.assumptions = assumptions;
  if (body.categories) body.categories = body.categories.map((c) => ({ ...c, salaryMultiple: c.benefitBasis === "SALARY_MULTIPLE" ? c.salaryMultiple : undefined, fixedCover: c.benefitBasis === "FIXED" ? c.fixedCover : undefined }));
  return body;
};

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
  const sponsors = useResource(session, "/group-life/sponsors", []);
  const [viewing, setViewing] = useState(null); // the quote version whose terms are open
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const toggle = (b) => setForm({ ...form, benefits: form.benefits.includes(b) ? form.benefits.filter((x) => x !== b) : [...form.benefits, b] });
  const setCategory = (i, key, value) => setForm({ ...form, categories: form.categories.map((c, j) => (j === i ? { ...c, [key]: value } : c)) });
  const readCensus = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, census: String(reader.result || "") });
    reader.readAsText(file);
  };
  const save = async () => {
    const { revising } = form;
    const body = quoteBody(form);
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
          onRowClick={setViewing}
          empty="No quotations"
          searchPlaceholder="Search quotations, sponsors…"
          columns={[
            { key: "ref", label: "Quote", render: (r) => r.ref + " v" + r.version },
            { key: "sponsorName", label: "Sponsor" },
            { key: "lives", label: "Lives", align: "right" },
            { key: "benefits", label: "Benefits", render: (r) => r.benefits.map((b) => BENEFIT[b] || b).join(", ") },
            { key: "ratePerMille", label: "Rate", align: "right", render: (r) => <span title={r.rateUnit}>{Number(r.ratePerMille)}</span> },
            {
              key: "pricingStatus",
              label: "Pricing",
              render: (r) =>
                r.pricingStatus === "INDICATIVE" ? (
                  <Badge tone="amber">Indicative</Badge>
                ) : (
                  <span className="ws-hint">{r.rateSource === "NEGOTIATED" ? "Negotiated" : r.rateTables || "Rated"}{r.census ? " · census v" + r.census.version : ""}</span>
                ),
            },
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
                      <Button onClick={() => setStep({ quote: r, kind: "activate" })}>Set up and activate</Button>
                    )}
                    {manage && !["ACTIVATED"].includes(r.status) && (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setForm({
                            ...blankQuote(),
                            revising: r.ref,
                            sponsorRef: r.sponsorRef || "",
                            sponsorName: r.sponsorName,
                            sector: r.sector,
                            lives: r.lives,
                            salaryRoll: r.salaryRoll,
                            benefits: r.benefits,
                            ratingBasis: r.ratingBasis,
                            rateSource: r.rateSource || "TABLE",
                            salaryMultiple: r.salaryMultiple,
                            ratePerMille: r.rateSource === "NEGOTIATED" ? r.ratePerMille : "",
                            adjustmentPercent: r.adjustmentPercent ?? "",
                            expensePercent: r.assumptions?.expensePercent ?? "",
                            commissionPercent: r.assumptions?.commissionPercent ?? "",
                            profitPercent: r.assumptions?.profitPercent ?? "",
                            validityDays: r.validityDays ?? "",
                            freeCoverLimit: r.freeCoverLimit ?? "",
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
          size="lg"
          title={form.revising ? "Revise " + form.revising : "New scheme quotation"}
          description="Rated on a validated census: by the stated basis with the approved rate tables plus loadings, or on a negotiated rate. Without a valid census the price is indicative and cannot be submitted."
          onClose={() => setForm(null)}
        >
          <FormGrid submitLabel={form.revising ? "Save new version" : "Create quotation"} busy={action.busy} error={action.error} onSubmit={save}>
            <Field label="Prospect sponsor" hint="A registered sponsor, or type a new prospect's name below.">
              <select
                value={form.sponsorRef}
                onChange={(e) => {
                  const sp = (sponsors.data || []).find((x) => x.ref === e.target.value);
                  setForm({ ...form, sponsorRef: e.target.value, sponsorName: sp ? sp.legalName : form.sponsorName, sector: sp ? sp.sector : form.sector });
                }}
              >
                <option value="">New prospect</option>
                {(sponsors.data || []).map((sp) => (
                  <option key={sp.ref} value={sp.ref}>
                    {sp.ref} · {sp.legalName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sponsor (employer)">
              <input value={form.sponsorName} onChange={set("sponsorName")} required disabled={Boolean(form.sponsorRef)} />
            </Field>
            <Field label="Sector">
              <input value={form.sector} onChange={set("sector")} required />
            </Field>
            <Field label="Rating basis" hint={RATE_UNIT[form.ratingBasis]}>
              <select value={form.ratingBasis} onChange={set("ratingBasis")}>
                <option value="SUM_ASSURED">Sum assured</option>
                <option value="SALARY">Salary</option>
                <option value="PER_MEMBER">Per member</option>
                <option value="LOAN_BALANCE">Loan balance</option>
              </select>
            </Field>
            <Field label="Rates from" hint={form.rateSource === "TABLE" ? "The approved rate table version for each benefit (demo tables until the insurer's are approved)." : "A rate agreed in negotiation, recorded as such."}>
              <select value={form.rateSource} onChange={set("rateSource")}>
                <option value="TABLE">Approved rate tables</option>
                <option value="NEGOTIATED">Negotiated rate</option>
              </select>
            </Field>
            {form.rateSource === "NEGOTIATED" ? (
              <Field label={"Negotiated rate " + RATE_UNIT[form.ratingBasis]}>
                <input type="number" min="0.0001" step="0.0001" value={form.ratePerMille} onChange={set("ratePerMille")} required />
              </Field>
            ) : (
              <Field label="Adjustment (%)" hint="Negotiated loading (+) or discount (−) on the table premium.">
                <input type="number" min="-50" max="100" step="0.01" value={form.adjustmentPercent} onChange={set("adjustmentPercent")} />
              </Field>
            )}
            <Field label="Salary multiple" hint="Sum assured per member when no category design is given.">
              <input type="number" min="0.01" step="0.01" value={form.salaryMultiple} onChange={set("salaryMultiple")} required />
            </Field>
            <Field label="Free-cover limit (BWP)" hint="Needed before activation">
              <input type="number" min="0" step="0.01" value={form.freeCoverLimit} onChange={set("freeCoverLimit")} />
            </Field>
            {form.rateSource === "TABLE" && (
              <>
                <Field label="Expense loading (%)" hint="Blank: the demo default (10%).">
                  <input type="number" min="0" max="50" step="0.01" value={form.expensePercent} onChange={set("expensePercent")} />
                </Field>
                <Field label="Commission (%)" hint="Blank: the demo default (5%).">
                  <input type="number" min="0" max="50" step="0.01" value={form.commissionPercent} onChange={set("commissionPercent")} />
                </Field>
                <Field label="Profit margin (%)" hint="Blank: the demo default (5%).">
                  <input type="number" min="0" max="50" step="0.01" value={form.profitPercent} onChange={set("profitPercent")} />
                </Field>
              </>
            )}
            <Field label="Valid for (days)" hint="Blank: 30 days (demo default).">
              <input type="number" min="1" max="180" value={form.validityDays} onChange={set("validityDays")} />
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
            <div className="form-label full" role="group" aria-label="Benefit design by category">
              <span>Benefit design by category {form.revising && !form.categories.length ? "(kept from the previous version)" : "(optional)"}</span>
              {form.categories.map((c, i) => (
                <div key={i} className="field-grid gl-category-row">
                  <Field label="Code"><input value={c.code} onChange={(e) => setCategory(i, "code", e.target.value.toUpperCase())} maxLength={20} required /></Field>
                  <Field label="Name"><input value={c.name} onChange={(e) => setCategory(i, "name", e.target.value)} maxLength={100} required /></Field>
                  <Field label="Cover">
                    <select value={c.benefitBasis} onChange={(e) => setCategory(i, "benefitBasis", e.target.value)}>
                      <option value="SALARY_MULTIPLE">Salary multiple</option>
                      <option value="FIXED">Fixed amount</option>
                    </select>
                  </Field>
                  {c.benefitBasis === "FIXED" ? (
                    <Field label="Fixed cover (BWP)"><input type="number" min="1" step="0.01" value={c.fixedCover} onChange={(e) => setCategory(i, "fixedCover", e.target.value)} required /></Field>
                  ) : (
                    <Field label="Multiple"><input type="number" min="0.01" step="0.01" value={c.salaryMultiple} onChange={(e) => setCategory(i, "salaryMultiple", e.target.value)} required /></Field>
                  )}
                  <Button variant="secondary" onClick={() => setForm({ ...form, categories: form.categories.filter((_, j) => j !== i) })}>
                    Remove
                  </Button>
                </div>
              ))}
              <div>
                <Button variant="secondary" icon={Plus} onClick={() => setForm({ ...form, categories: [...form.categories, { code: "", name: "", benefitBasis: "SALARY_MULTIPLE", salaryMultiple: form.salaryMultiple, fixedCover: "" }] })}>
                  Add a category
                </Button>
              </div>
            </div>
            <Field label="Census (CSV)" full hint={"Header row: " + CENSUS_TEMPLATE + " (category where the design has categories, loanBalance for the loan-balance basis). Rated only once every row is valid." + (form.revising ? " Blank keeps the previous version's census." : "")}>
              <textarea className="ws-textarea" value={form.census} onChange={set("census")} rows={5} placeholder={CENSUS_TEMPLATE + "\nE001,1985-04-12,STAFF,240000,"} />
            </Field>
            <label className="ga-file">
              <Button variant="secondary" icon={Upload} type="button">
                Load census file
              </Button>
              <input type="file" accept=".csv,text/csv,text/plain" onChange={readCensus} aria-label="Load census file" />
            </label>
            {!form.census && !form.revising && (
              <>
                <Field label="Lives (indicative only)">
                  <input type="number" min="0" value={form.lives} onChange={set("lives")} />
                </Field>
                <Field label="Annual salary roll (indicative only)">
                  <input type="number" min="0" step="0.01" value={form.salaryRoll} onChange={set("salaryRoll")} />
                </Field>
              </>
            )}
            <Field label="Notes" full>
              <textarea value={form.notes} onChange={set("notes")} rows={2} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      {viewing && (
        <QuoteTermsDrawer
          session={session}
          notify={notify}
          quote={viewing}
          manage={manage && viewing.status === "DRAFT" && latest[viewing.ref] === viewing.version}
          onClose={() => setViewing(null)}
          onChange={() => {
            setViewing(null);
            onChange();
          }}
        />
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
        <ActivationWizard
          session={session}
          notify={notify}
          quote={step.quote}
          onClose={() => setStep(null)}
          onDone={() => {
            setStep(null);
            onChange();
          }}
        />
      )}
    </>
  );
}

/** One quotation version's terms: census validation summary, pricing breakdown, assumptions and approval history. */
function QuoteTermsDrawer({ session, notify, quote, manage, onClose, onChange }) {
  const census = useResource(session, quote.census ? "/group-life/quotes/" + quote.ref + "/census/" + quote.census.version : null, null);
  const history = useResource(session, "/group-life/quotes/" + quote.ref + "/history", []);
  const [csv, setCsv] = useState("");
  const [errorsOnly, setErrorsOnly] = useState(true);
  const action = useAction(inlineErrors(notify));
  const upload = async () => {
    const done = await action.run(() => request(session, "/group-life/quotes/" + quote.ref + "/census", { method: "POST", body: { csv } }), "Census checked and the quotation priced again");
    if (done) onChange();
  };
  const c = quote.census;
  const rows = (census.data?.rows || []).filter((r) => !errorsOnly || r.status !== "VALID");
  return (
    <Drawer size="lg" title={quote.ref + " v" + quote.version + " · " + quote.sponsorName} description={(Q_STATUS[quote.status]?.[0] || quote.status) + " · valid until " + quote.validUntil} onClose={onClose}>
      <div className="ga-drawer-section">
        <h3>Pricing</h3>
        <div className="ws-kv">
          <div><small>Annual premium</small><strong>{pula(quote.annualPremium)}</strong></div>
          <div><small>Status</small><strong>{quote.pricingStatus === "INDICATIVE" ? "Indicative (not submittable)" : "Rated on the census"}</strong></div>
          <div><small>Rates from</small><strong>{quote.rateSource === "NEGOTIATED" ? "Negotiated rate " + Number(quote.ratePerMille) + " " + quote.rateUnit : quote.rateTables || "—"}</strong></div>
          <div><small>Office rate</small><strong>{Number(quote.ratePerMille)} {quote.rateUnit}</strong></div>
          {quote.rateSource !== "NEGOTIATED" && <div><small>Risk premium (tables)</small><strong>{pula(quote.technicalPremium)}</strong></div>}
          {quote.rateSource !== "NEGOTIATED" && (
            <div>
              <small>Loadings</small>
              <strong>
                expense {Number(quote.assumptions?.expensePercent || 0)}% · commission {Number(quote.assumptions?.commissionPercent || 0)}% · profit {Number(quote.assumptions?.profitPercent || 0)}%
              </strong>
            </div>
          )}
          <div><small>Adjustment</small><strong>{Number(quote.adjustmentPercent || 0)}%</strong></div>
          <div><small>Sponsor record</small><strong>{quote.sponsorRef || "New prospect (created on activation)"}</strong></div>
        </div>
        {quote.pricing?.indicativeReason && <p className="ga-status-note">{quote.pricing.indicativeReason}</p>}
        {(quote.pricing?.benefits || []).length > 0 && (
          <DataTable
            rows={quote.pricing.benefits}
            rowKey={(b) => b.benefit || "negotiated"}
            searchFrom={50}
            columns={[
              { key: "benefit", label: "Benefit", render: (b) => (b.benefit ? BENEFIT[b.benefit] || b.benefit : (b.benefits || []).map((x) => BENEFIT[x] || x).join(", ")) },
              { key: "basis", label: "Basis", render: (b) => RATE_UNIT[b.basis] || b.basis },
              { key: "source", label: "Rate source" },
              { key: "premium", label: "Risk premium", align: "right", render: (b) => pula(b.premium) },
            ]}
          />
        )}
        {(quote.pricing?.categories || []).length > 0 && (
          <DataTable
            rows={quote.pricing.categories}
            rowKey={(x) => x.category}
            searchFrom={50}
            columns={[
              { key: "category", label: "Category" },
              { key: "lives", label: "Lives", align: "right" },
              { key: "sumAssured", label: "Sum assured", align: "right", render: (x) => pula(x.sumAssured) },
              { key: "annualPremium", label: "Premium a year", align: "right", render: (x) => pula(x.annualPremium) },
              { key: "monthlyRatePerMille", label: "Monthly rate ‰", align: "right", render: (x) => (x.monthlyRatePerMille != null ? Number(x.monthlyRatePerMille) : "—") },
            ]}
          />
        )}
      </div>
      <div className="ga-drawer-section">
        <h3>Census validation summary</h3>
        {c ? (
          <>
            <div className="ws-kv">
              <div><small>Census</small><strong>v{c.version} · {c.status === "VALID" ? "valid" : "has errors"}</strong></div>
              <div><small>Rows</small><strong>{c.totalRows} · {c.validRows} valid · {c.invalidRows} invalid</strong></div>
              <div><small>Lives rated</small><strong>{c.lives}</strong></div>
              <div><small>Salary roll</small><strong>{pula(c.salaryRoll)}</strong></div>
              <div><small>Average age</small><strong>{c.averageAge ?? "—"}</strong></div>
              <div><small>Received</small><strong>{c.submittedBy} · {when(c.submittedAt)}</strong></div>
            </div>
            {(c.warnings || []).length > 0 && (
              <ul className="uw-list">
                {c.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            <label className="ga-check">
              <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} /> Rows with errors only
            </label>
            <DataTable
              rows={rows}
              loading={census.loading}
              rowKey={(r) => r.lineNo}
              searchFrom={30}
              empty={errorsOnly ? "No row has an error" : "No rows"}
              columns={[
                { key: "lineNo", label: "Line", align: "right" },
                { key: "memberKey", label: "Member" },
                { key: "dateOfBirth", label: "Born" },
                { key: "category", label: "Category", render: (r) => r.category || "—" },
                { key: "salary", label: "Salary", align: "right", render: (r) => r.salary || "—" },
                { key: "status", label: "Outcome", render: (r) => <Badge tone={r.status === "VALID" ? "green" : "red"}>{r.status === "VALID" ? "Valid" : "Invalid"}</Badge> },
                { key: "error", label: "Error", render: (r) => (r.error ? <span className="ga-row-error">{r.error}</span> : "—") },
              ]}
            />
          </>
        ) : (
          <p className="ws-hint">No census yet: the price is indicative, from the lives and salary roll entered.</p>
        )}
        {manage && (
          <FormGrid submitLabel="Check census and price again" busy={action.busy} error={action.error} onSubmit={upload}>
            <Field label={"New census (CSV) for v" + quote.version} full hint={"Header row: " + CENSUS_TEMPLATE}>
              <textarea className="ws-textarea" value={csv} onChange={(e) => setCsv(e.target.value)} rows={4} required />
            </Field>
          </FormGrid>
        )}
      </div>
      <div className="ga-drawer-section">
        <h3>Approval history</h3>
        <DataTable
          rows={history.data}
          loading={history.loading}
          rowKey={(h) => h.at + h.action}
          searchFrom={50}
          empty="No history"
          columns={[
            { key: "at", label: "When", render: (h) => when(h.at) },
            { key: "action", label: "Step" },
            { key: "detail", label: "Detail", render: (h) => h.detail || "—" },
            { key: "actor", label: "By" },
          ]}
        />
      </div>
    </Drawer>
  );
}

/**
 * Versioned group rate tables (section 08 pricing: a draft version is approved by a second person and only new
 * quotations use it) and the sponsor register (prospects and clients).
 */
function RatesAndSponsors({ session, notify, profile }) {
  const tables = useResource(session, "/group-life/rate-tables", []);
  const sponsors = useResource(session, "/group-life/sponsors", []);
  const [form, setForm] = useState(null);
  const [open, setOpen] = useState(null);
  const action = useAction(inlineErrors(notify));
  const me = session?.username;
  const draft = (t) => {
    action.setError("");
    setForm({ kind: "table", tableCode: t?.tableCode || "", label: t?.label || "", benefitType: t?.benefitType || "GLA", ratingBasis: t?.ratingBasis || "SUM_ASSURED", note: "", bands: (t?.bands || [{ ageFrom: 16, ageTo: 70, rate: "" }]).map((b) => ({ ...b })) });
  };
  const setBand = (i, key, value) => setForm({ ...form, bands: form.bands.map((b, j) => (j === i ? { ...b, [key]: value } : b)) });
  const submit = async () => {
    const { kind, ...body } = form;
    const done = await action.run(
      () => request(session, kind === "table" ? "/group-life/rate-tables" : "/group-life/sponsors", { method: "POST", body }),
      kind === "table" ? "Draft rate table saved for approval" : "Sponsor registered",
    );
    if (done) {
      setForm(null);
      tables.reload();
      sponsors.reload();
    }
  };
  const approve = async (t) => {
    const done = await action.run(() => request(session, "/group-life/rate-tables/" + t.tableCode + "/versions/" + t.version + "/approval", { method: "POST" }), t.tableCode + " v" + t.version + " approved");
    if (done) tables.reload();
  };
  return (
    <>
      <Panel
        title="Group rate tables"
        subtitle="Risk rates by age band for each benefit and basis. The seeded tables are demo tables, not the insurer's tariff. A new version takes effect for new quotations once a second person approves it."
        action={
          can(profile, "CREATE_RATE_TABLE") && (
            <Button icon={Plus} onClick={() => draft(null)}>
              New rate table
            </Button>
          )
        }
      >
        <ErrorNote error={tables.error || (!form ? action.error : "")} />
        <DataTable
          rows={tables.data}
          loading={tables.loading}
          rowKey={(t) => t.tableCode + "-" + t.version}
          onRowClick={setOpen}
          empty="No group rate tables"
          columns={[
            { key: "tableCode", label: "Table", render: (t) => t.tableCode + " v" + t.version },
            { key: "label", label: "Label" },
            { key: "benefitType", label: "Benefit", render: (t) => BENEFIT[t.benefitType] || t.benefitType },
            { key: "unit", label: "Rate" },
            { key: "bands", label: "Bands", align: "right", render: (t) => t.bands.length },
            { key: "status", label: "Status", render: (t) => <Badge tone={t.status === "APPROVED" ? "green" : t.status === "DRAFT" ? "amber" : undefined}>{t.status.charAt(0) + t.status.slice(1).toLowerCase()}</Badge> },
            {
              key: "act",
              label: "",
              render: (t) => (
                <div className="ws-row-actions">
                  {t.status === "DRAFT" && can(profile, "PUBLISH_RATE_TABLE") && (t.createdBy === me ? <small className="ws-hint">Needs another approver</small> : (
                    <Button variant="secondary" busy={action.busy} onClick={() => approve(t)}>
                      Approve
                    </Button>
                  ))}
                  {t.status === "APPROVED" && can(profile, "CREATE_RATE_TABLE") && (
                    <Button variant="secondary" onClick={() => draft(t)}>
                      New version
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Panel>
      <Panel
        title="Sponsors"
        subtitle="Employers and other sponsors: prospects while quoted, clients once a master policy is activated for them."
        action={
          can(profile, "MANAGE_SCHEME") && (
            <Button icon={Plus} onClick={() => { action.setError(""); setForm({ kind: "sponsor", legalName: "", registrationNo: "", sector: "", contactName: "", contactEmail: "" }); }}>
              New prospect
            </Button>
          )
        }
      >
        <ErrorNote error={sponsors.error} />
        <DataTable
          rows={sponsors.data}
          loading={sponsors.loading}
          rowKey={(x) => x.ref}
          empty="No sponsors yet"
          columns={[
            { key: "ref", label: "Sponsor" },
            { key: "legalName", label: "Legal name" },
            { key: "registrationNo", label: "Registration", render: (x) => x.registrationNo || "—" },
            { key: "sector", label: "Sector" },
            { key: "contactName", label: "Contact", render: (x) => [x.contactName, x.contactEmail].filter(Boolean).join(" · ") || "—" },
            { key: "status", label: "Status", render: (x) => <Badge tone={x.status === "CLIENT" ? "green" : "blue"}>{x.status === "CLIENT" ? "Client" : "Prospect"}</Badge> },
          ]}
        />
      </Panel>
      {open && (
        <Drawer title={open.tableCode + " v" + open.version} description={open.label + " · " + open.unit} onClose={() => setOpen(null)}>
          <p className="ws-hint">{open.note || ""} {open.approvedBy ? "Approved by " + open.approvedBy + "." : ""}</p>
          <DataTable
            rows={open.bands}
            rowKey={(b) => b.ageFrom}
            searchFrom={50}
            columns={[
              { key: "ageFrom", label: "Ages", render: (b) => b.ageFrom + "–" + b.ageTo },
              { key: "rate", label: "Rate", align: "right", render: (b) => Number(b.rate) },
            ]}
          />
        </Drawer>
      )}
      {form?.kind === "table" && (
        <Drawer size="lg" title={form.tableCode ? "New version of " + form.tableCode : "New rate table"} description="Saved as a draft; a second person approves it before new quotations use it." onClose={() => setForm(null)}>
          <FormGrid submitLabel="Save draft" busy={action.busy} error={action.error} onSubmit={submit}>
            <Field label="Table code"><input value={form.tableCode} onChange={(e) => setForm({ ...form, tableCode: e.target.value.toUpperCase() })} maxLength={30} required /></Field>
            <Field label="Label"><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} maxLength={150} required /></Field>
            <Field label="Benefit">
              <select value={form.benefitType} onChange={(e) => setForm({ ...form, benefitType: e.target.value })}>
                {Object.entries(BENEFIT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="Basis">
              <select value={form.ratingBasis} onChange={(e) => setForm({ ...form, ratingBasis: e.target.value })}>
                {Object.entries(RATE_UNIT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            {form.bands.map((b, i) => (
              <div key={i} className="field-grid gl-category-row">
                <Field label="From age"><input type="number" min="0" max="120" value={b.ageFrom} onChange={(e) => setBand(i, "ageFrom", e.target.value)} required /></Field>
                <Field label="To age"><input type="number" min="0" max="120" value={b.ageTo} onChange={(e) => setBand(i, "ageTo", e.target.value)} required /></Field>
                <Field label="Rate"><input type="number" min="0.0001" step="0.0001" value={b.rate} onChange={(e) => setBand(i, "rate", e.target.value)} required /></Field>
                {form.bands.length > 1 && <Button variant="secondary" onClick={() => setForm({ ...form, bands: form.bands.filter((_, j) => j !== i) })}>Remove</Button>}
              </div>
            ))}
            <div className="form-label full">
              <Button variant="secondary" icon={Plus} onClick={() => setForm({ ...form, bands: [...form.bands, { ageFrom: "", ageTo: "", rate: "" }] })}>Add a band</Button>
            </div>
            <Field label="Note" full><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} /></Field>
          </FormGrid>
        </Drawer>
      )}
      {form?.kind === "sponsor" && (
        <Drawer title="New prospect sponsor" onClose={() => setForm(null)}>
          <FormGrid submitLabel="Register sponsor" busy={action.busy} error={action.error} onSubmit={submit}>
            <Field label="Legal name"><input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} maxLength={150} required /></Field>
            <Field label="Registration number"><input value={form.registrationNo} onChange={(e) => setForm({ ...form, registrationNo: e.target.value })} maxLength={40} /></Field>
            <Field label="Sector"><input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} maxLength={80} required /></Field>
            <Field label="Contact name"><input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} maxLength={100} /></Field>
            <Field label="Contact e-mail"><input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} maxLength={150} /></Field>
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
  const terms = useResource(session, base && base + "/benefit-terms", []);
  const rules = useResource(session, "/group-life/product-rules", []);
  const detail = useResource(session, current ? "/group/schemes/" + current : null, null);
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
  const pendingTerms = (terms.data || []).filter((t) => t.approvalStatus === "PENDING");
  const pendingPlan = [...(benefits.data || []).filter((b) => b.approvalStatus === "PENDING"), ...pendingTerms];
  // One approval for every plan change waiting: definitions and versioned benefit terms (GL02 version approval).
  const approvePlan = async () => {
    const done = await action.run(
      () => request(session, base + "/plan-approval", { method: "POST", body: { note: form.note } }),
      "Plan approved",
    );
    if (done) {
      setForm(null);
      benefits.reload();
      terms.reload();
    }
  };
  const saveTerms = async () => {
    const { kind, parameters, ...rest } = form;
    const body = { ...rest, parameters: Object.fromEntries(Object.entries(parameters).filter(([, v]) => v !== "")) };
    if (!body.categoryCode) delete body.categoryCode;
    if (!body.effectiveFrom) delete body.effectiveFrom;
    if (!body.reason) delete body.reason;
    const done = await action.run(() => request(session, base + "/benefit-terms", { method: "PUT", body }), "Benefit terms saved for approval");
    if (done) {
      setForm(null);
      terms.reload();
    }
  };
  const rulesFor = (type) => (rules.data || []).filter((r) => r.benefitType === type);
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
            {manage && (benefits.data || []).length > 0 && (
              <Button
                variant="secondary"
                onClick={() => {
                  action.setError("");
                  setForm({ kind: "terms", benefitType: benefits.data[0].benefitType, categoryCode: "", included: true, parameters: {}, effectiveFrom: "", reason: "" });
                }}
              >
                Set benefit terms
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
        {(terms.data || []).length > 0 && (
          <details className="gl-impact-list" open={pendingTerms.length > 0}>
            <summary>Benefit terms versions ({terms.data.length})</summary>
            <DataTable
              rows={terms.data}
              rowKey={(t) => t.id}
              searchFrom={30}
              columns={[
                { key: "benefitType", label: "Benefit", render: (t) => BENEFIT[t.benefitType] || t.benefitType },
                { key: "categoryCode", label: "Scope", render: (t) => (t.categoryCode ? "Category " + t.categoryCode : "Scheme") },
                { key: "version", label: "Version", align: "right" },
                { key: "included", label: "Included", render: (t) => (t.included ? "Yes" : "Left out") },
                { key: "parameters", label: "Terms", render: (t) => (t.parameters ? Object.entries(t.parameters).map(([k, v]) => k.toLowerCase().replaceAll("_", " ") + " " + v).join(" · ") : "—") },
                { key: "effectiveFrom", label: "From" },
                { key: "approvalStatus", label: "Approval", render: (t) => (t.approvalStatus === "PENDING" ? <Badge tone="amber">Awaiting approval</Badge> : <span className="ws-hint">Approved by {t.approvedBy}</span>) },
                { key: "impact", label: "Impact", render: (t) => (t.impact ? t.impact.membersInScope + " member(s)" + (t.impact.backdated ? " · backdated" : "") : "—") },
              ]}
            />
          </details>
        )}
        {pendingPlan.length > 0 && (
          <p className="ws-hint">
            {pendingPlan.length} benefit change(s) wait for a second person to approve the plan
            {pendingPlan.some((b) => b.updatedBy === session?.username) ? "; you made them, so someone else approves." : "."}
          </p>
        )}
      </Panel>
      <Panel
        title="Member certificates"
        subtitle="Only accepted cover is certified; pending cover is shown as not in force. Each certificate lists its category's benefits and the accepted terms and wording it was generated from."
        action={
          <Button variant="secondary" onClick={() => openPdf(session, base + "/schedule", notify)}>
            Scheme schedule (PDF)
          </Button>
        }
      >
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
            <div>
              <small>Generated from</small>
              <strong>
                {[certificate.acceptedTerms, certificate.wording && "wording " + certificate.wording, certificate.categoryCode && "category " + certificate.categoryCode + " v" + certificate.categoryVersion].filter(Boolean).join(" · ") || "—"}
              </strong>
            </div>
            {(certificate.loadingPercent || certificate.exclusions) && (
              <div>
                <small>Underwriting terms</small>
                <strong>{[certificate.loadingPercent && Number(certificate.loadingPercent) + "% loading", certificate.exclusions].filter(Boolean).join(" · ")}</strong>
              </div>
            )}
          </div>
          <div className="ws-form-actions">
            <Button variant="secondary" onClick={() => openPdf(session, base + "/certificates/" + encodeURIComponent(certificate.memberKey) + "/document", notify)}>
              Open certificate (PDF)
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
      {form?.kind === "terms" && (
        <Drawer size="lg" title="Benefit terms" description="Scheme terms override the product defaults; a category's terms override the scheme's. Parameters the product fixes cannot be changed. Saved for a second person's approval." onClose={() => setForm(null)}>
          <FormGrid submitLabel="Save for approval" busy={action.busy} error={action.error} onSubmit={saveTerms}>
            <Field label="Benefit">
              <select value={form.benefitType} onChange={(e) => setForm({ ...form, benefitType: e.target.value, parameters: {} })}>
                {(benefits.data || []).map((b) => (
                  <option key={b.benefitType} value={b.benefitType}>
                    {BENEFIT[b.benefitType] || b.benefitType}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Applies to">
              <select value={form.categoryCode} onChange={(e) => setForm({ ...form, categoryCode: e.target.value })}>
                <option value="">The whole scheme</option>
                {(detail.data?.categories || []).map((c) => (
                  <option key={c.code} value={c.code}>
                    Category {c.code} · {c.name}
                  </option>
                ))}
              </select>
            </Field>
            {form.categoryCode && (
              <Field label="Benefit for this category" full>
                <select value={form.included ? "yes" : "no"} onChange={(e) => setForm({ ...form, included: e.target.value === "yes" })}>
                  <option value="yes">Included</option>
                  <option value="no">Left out for this category (not on its certificates or claimable)</option>
                </select>
              </Field>
            )}
            {rulesFor(form.benefitType).map((r) => (
              <Field
                key={r.parameter}
                label={r.label}
                hint={(r.overridable ? "Product default " + (r.defaultValue ?? "none") + (r.maxValue != null ? " · maximum " + r.maxValue : "") + (r.minValue != null ? " · minimum " + r.minValue : "") : "Fixed by the product: " + r.defaultValue) + " · " + r.source}
              >
                {r.valueType === "CHOICE" ? (
                  <select value={form.parameters[r.parameter] ?? ""} disabled={!r.overridable} onChange={(e) => setForm({ ...form, parameters: { ...form.parameters, [r.parameter]: e.target.value } })}>
                    <option value="">Default ({r.defaultValue})</option>
                    {(r.allowedValues || []).map((v) => (
                      <option key={v} value={v}>
                        {v.toLowerCase().replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={r.valueType === "TEXT" ? "text" : "number"}
                    step="any"
                    value={form.parameters[r.parameter] ?? ""}
                    placeholder={r.defaultValue ?? ""}
                    disabled={!r.overridable}
                    onChange={(e) => setForm({ ...form, parameters: { ...form.parameters, [r.parameter]: e.target.value } })}
                  />
                )}
              </Field>
            ))}
            <Field label="Effective from" hint="Blank: today. An earlier date needs underwriting authority and a reason.">
              <input type="date" value={form.effectiveFrom} max={today()} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
            </Field>
            <Field label="Reason" hint="Required for a backdated change.">
              <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={500} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      {form && !["approval", "terms"].includes(form.kind) && (
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

// ── contract set-up wizard (NS-GL01-003/004, AT-GL01-01) ───────────────────────────────────────

const CONDITION_LABEL = {
  SIGNED_PROPOSAL: "Signed proposal form received from the sponsor",
  SIGNED_CENSUS: "Signed census received (the version the terms were rated on)",
  FIRST_PREMIUM_OR_DEFERRAL: "First premium received, or a deferral agreed in writing",
};
const blankCategory = (quote) => ({
  code: "ALL",
  name: "All eligible employees",
  benefitBasis: "SALARY_MULTIPLE",
  salaryMultiple: quote?.salaryMultiple ?? 2,
  fixedCover: "",
  freeCoverLimit: quote?.freeCoverLimit ?? "",
  ratePerMille: "",
  minEntryAge: 18,
  maxEntryAge: 64,
});

/**
 * Puts a master policy in force from accepted terms, in steps: the accepted quotation, the legal sponsor and billing
 * arrangement, member rules and categories, the approved wording and inception conditions, and a review the server
 * checks before anything changes. Opened from a quotation (creates the scheme) or from a scheme in set-up.
 */
export function ActivationWizard({ session, notify, quote: given, scheme, onClose, onDone }) {
  const quotes = useResource(session, given ? null : "/group-life/quotes", []);
  const wordings = useResource(session, "/group-life/wordings", []);
  const sponsors = useResource(session, "/group-life/sponsors", []);
  const [page, setPage] = useState(0);
  const [quoteRef, setQuoteRef] = useState(given?.ref || "");
  const accepted = (quotes.data || []).filter((q) => q.status === "ACCEPTED" && !q.schemeRef);
  const quote = given || accepted.find((q) => q.ref === quoteRef);
  const hasCategories = (scheme?.categories || []).length > 0;
  const [form, setForm] = useState(() => ({
    inceptionDate: today(),
    sponsorRef: given?.sponsorRef || "",
    registrationNo: "",
    payerName: "",
    brokerRef: "",
    billingMethod: "EFT",
    billingDueDay: 1,
    aawRule: "REFER",
    partialCoverAllowed: true,
    wordingRef: "",
    conditions: [],
    categories: [],
  }));
  const [check, setCheck] = useState(null);
  const action = useAction(inlineErrors(notify));
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const categories = form.categories.length ? form.categories : quote && !hasCategories ? [blankCategory(quote)] : [];
  const setCategory = (i, key, value) => setForm({ ...form, categories: categories.map((c, j) => (j === i ? { ...c, [key]: value } : c)) });
  const required = check?.requiredConditions || Object.keys(CONDITION_LABEL);
  const steps = ["Accepted terms", "Sponsor and billing", "Members and categories", "Wording and conditions", "Review"];
  const body = () => {
    const out = { ...form, categories: hasCategories ? undefined : categories.map((c) => ({ ...c, salaryMultiple: c.benefitBasis === "SALARY_MULTIPLE" ? c.salaryMultiple : null, fixedCover: c.benefitBasis === "FIXED" ? c.fixedCover : null, ratePerMille: c.ratePerMille === "" ? undefined : c.ratePerMille })) };
    if (!out.sponsorRef) delete out.sponsorRef;
    if (!out.brokerRef) delete out.brokerRef;
    if (!out.payerName) delete out.payerName;
    if (!out.registrationNo) delete out.registrationNo;
    if (scheme) out.quoteRef = quoteRef;
    return out;
  };
  const review = async () => {
    const params = new URLSearchParams();
    if (scheme) params.set("schemeRef", scheme.scheme.ref);
    if (form.wordingRef) params.set("wordingRef", form.wordingRef);
    form.conditions.forEach((c) => params.append("conditions", c));
    const done = await action.run(() => request(session, "/group-life/quotes/" + quote.ref + "/activation-check?" + params));
    if (done) setCheck(done.data);
    setPage(4);
  };
  const submit = async () => {
    const path = scheme ? "/group/schemes/" + scheme.scheme.ref + "/activation" : "/group-life/quotes/" + quote.ref + "/activation";
    const done = await action.run(() => request(session, path, { method: "POST", body: body() }), "Master policy activated");
    if (done) onDone(done.data);
  };
  const next = () => (page === 3 ? review() : setPage(page + 1));
  const blocked = (page === 0 && !quote) || (page === 3 && !form.wordingRef);
  // Missing rates are taken from the quotation's pricing on the server; every category needs its free cover.
  const categoryProblem = !hasCategories && categories.some((c) => c.freeCoverLimit === "" || !c.code || !c.name);
  return (
    <Drawer size="lg" title={scheme ? "Activate " + scheme.scheme.name : "Set up " + (given?.sponsorName || "the master policy")} description={"Step " + (page + 1) + " of 5: " + steps[page]} onClose={onClose}>
      <ol className="gl-steps" aria-label="Set-up steps">
        {steps.map((label, i) => (
          <li key={label} className={i === page ? "current" : i < page ? "done" : ""}>
            {label}
          </li>
        ))}
      </ol>
      {page === 0 && (
        <div className="ga-drawer-section">
          {!given && (
            <Field label="Accepted quotation" full hint="Only quotations the sponsor accepted, not yet activated.">
              <select value={quoteRef} onChange={(e) => setQuoteRef(e.target.value)}>
                <option value="">Choose a quotation</option>
                {accepted.map((q) => (
                  <option key={q.ref} value={q.ref}>
                    {q.ref} v{q.version} · {q.sponsorName} · {pula(q.annualPremium)} a year
                  </option>
                ))}
              </select>
            </Field>
          )}
          {!given && !quotes.loading && accepted.length === 0 && <p className="ws-hint">No accepted quotation is waiting. Take one through approval and acceptance on Scheme lifecycle → Quotations first.</p>}
          {quote && (
            <div className="ws-kv">
              <div><small>Quotation</small><strong>{quote.ref} v{quote.version}</strong></div>
              <div><small>Sponsor</small><strong>{quote.sponsorName}</strong></div>
              <div><small>Approved by</small><strong>{quote.decidedBy || "—"}</strong></div>
              <div><small>Annual premium</small><strong>{pula(quote.annualPremium)}</strong></div>
              <div><small>Free-cover limit</small><strong>{quote.freeCoverLimit == null ? "Not set (revise the quote)" : pula(quote.freeCoverLimit)}</strong></div>
              <div><small>Benefits</small><strong>{quote.benefits.map((b) => BENEFIT[b] || b).join(", ")}</strong></div>
            </div>
          )}
          {!scheme && (
            <Field label="Inception date" full hint="The scheme year runs one year from here.">
              <input type="date" value={form.inceptionDate} onChange={set("inceptionDate")} required />
            </Field>
          )}
        </div>
      )}
      {page === 1 && (
        <div className="field-grid">
          <Field label="Legal sponsor" hint="A registered sponsor, or one created from the quotation's sponsor name.">
            <select value={form.sponsorRef} onChange={set("sponsorRef")}>
              <option value="">{quote?.sponsorName} (from the quotation)</option>
              {(sponsors.data || []).map((s) => (
                <option key={s.ref} value={s.ref}>
                  {s.ref} · {s.legalName} ({s.status.toLowerCase()})
                </option>
              ))}
            </select>
          </Field>
          {!form.sponsorRef && (
            <Field label="Company registration number">
              <input value={form.registrationNo} onChange={set("registrationNo")} maxLength={40} />
            </Field>
          )}
          <Field label="Payer" hint="Leave blank when the sponsor pays.">
            <input value={form.payerName} onChange={set("payerName")} maxLength={150} />
          </Field>
          <Field label="Broker (intermediary code)" hint="Optional, e.g. INT-00001.">
            <input value={form.brokerRef} onChange={set("brokerRef")} maxLength={30} />
          </Field>
          <Field label="Billing method">
            <select value={form.billingMethod} onChange={set("billingMethod")}>
              <option value="EFT">EFT by the sponsor</option>
              <option value="DEBIT_ORDER">Debit order</option>
              <option value="STOP_ORDER">Payroll stop order</option>
            </select>
          </Field>
          <Field label="Premium due day" hint="Monthly billing; day of the month 1-28.">
            <input type="number" min="1" max="28" value={form.billingDueDay} onChange={set("billingDueDay")} required />
          </Field>
        </div>
      )}
      {page === 2 && (
        <>
          <div className="field-grid">
            <Field label="Member not actively at work" hint="What a 'not at work' declaration on entry or increase does.">
              <select value={form.aawRule} onChange={set("aawRule")}>
                <option value="REFER">Refer all cover to underwriting</option>
                <option value="DEFER">Defer cover until back at work</option>
              </select>
            </Field>
            <Field label="Partial cover" hint="Whether cover up to the free-cover limit is admitted while the excess is underwritten.">
              <select value={form.partialCoverAllowed ? "yes" : "no"} onChange={(e) => setForm({ ...form, partialCoverAllowed: e.target.value === "yes" })}>
                <option value="yes">Allowed: free cover in force, excess pending</option>
                <option value="no">Not allowed: all cover waits for underwriting</option>
              </select>
            </Field>
          </div>
          {hasCategories ? (
            <p className="ws-hint">The scheme's categories ({scheme.categories.map((c) => c.code).join(", ")}) are used; each free-cover limit must be within the accepted terms.</p>
          ) : (
            <div className="ga-drawer-section">
              <h3>Benefit categories</h3>
              <p className="subtitle">From the quotation's design. Free cover may not exceed the accepted limit; leave the rate blank to use the quotation's.</p>
              {categories.map((c, i) => (
                <div key={i} className="field-grid gl-category-row">
                  <Field label="Code"><input value={c.code} onChange={(e) => setCategory(i, "code", e.target.value.toUpperCase())} maxLength={20} required /></Field>
                  <Field label="Name"><input value={c.name} onChange={(e) => setCategory(i, "name", e.target.value)} maxLength={100} required /></Field>
                  <Field label="Basis">
                    <select value={c.benefitBasis} onChange={(e) => setCategory(i, "benefitBasis", e.target.value)}>
                      <option value="SALARY_MULTIPLE">Salary multiple</option>
                      <option value="FIXED">Fixed cover</option>
                    </select>
                  </Field>
                  {c.benefitBasis === "SALARY_MULTIPLE" ? (
                    <Field label="Multiple"><input type="number" min="0.01" step="0.01" value={c.salaryMultiple} onChange={(e) => setCategory(i, "salaryMultiple", e.target.value)} required /></Field>
                  ) : (
                    <Field label="Fixed cover (BWP)"><input type="number" min="1" step="0.01" value={c.fixedCover} onChange={(e) => setCategory(i, "fixedCover", e.target.value)} required /></Field>
                  )}
                  <Field label="Free cover (BWP)"><input type="number" min="0" step="0.01" value={c.freeCoverLimit} onChange={(e) => setCategory(i, "freeCoverLimit", e.target.value)} required /></Field>
                  <Field label="Rate ‰ / month"><input type="number" min="0.0001" step="0.0001" value={c.ratePerMille} onChange={(e) => setCategory(i, "ratePerMille", e.target.value)} placeholder="From the quote" /></Field>
                  <Field label="Entry ages"><span className="gl-ages"><input type="number" min="0" max="100" value={c.minEntryAge} onChange={(e) => setCategory(i, "minEntryAge", e.target.value)} /> – <input type="number" min="0" max="100" value={c.maxEntryAge} onChange={(e) => setCategory(i, "maxEntryAge", e.target.value)} /></span></Field>
                  {categories.length > 1 && (
                    <Button variant="secondary" onClick={() => setForm({ ...form, categories: categories.filter((_, j) => j !== i) })}>
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="secondary" icon={Plus} onClick={() => setForm({ ...form, categories: [...categories, { ...blankCategory(quote), code: "", name: "" }] })}>
                Add a category
              </Button>
            </div>
          )}
        </>
      )}
      {page === 3 && (
        <div className="ga-drawer-section">
          <Field label="Approved scheme wording" full hint="From the wording library; only approved group wording versions can be used.">
            <select value={form.wordingRef} onChange={set("wordingRef")} required>
              <option value="">Choose the wording</option>
              {(wordings.data || []).map((w) => (
                <option key={w.ref + "-" + w.version} value={w.ref}>
                  {w.ref} v{w.version} · {w.title}
                </option>
              ))}
            </select>
          </Field>
          {!wordings.loading && !(wordings.data || []).length && <p className="ws-hint">No approved group wording is in the library yet; a scheme cannot be activated without one.</p>}
          <div className="form-label full" role="group" aria-label="Inception conditions">
            <span>Inception conditions met</span>
            {required.map((c) => (
              <label key={c} className="ri-product">
                <input
                  type="checkbox"
                  checked={form.conditions.includes(c)}
                  onChange={() => setForm({ ...form, conditions: form.conditions.includes(c) ? form.conditions.filter((x) => x !== c) : [...form.conditions, c] })}
                />
                <span>{CONDITION_LABEL[c] || c}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {page === 4 && (
        <div className="ga-drawer-section">
          {check?.ready ? (
            <p className="ga-paid">Everything activation needs is in place.</p>
          ) : (
            <>
              <h3>Not ready yet</h3>
              <ul className="uw-list">
                {(check?.problems || []).map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </>
          )}
          {categoryProblem && <ErrorNote error="Every category needs a code, a name and a free-cover limit." />}
          <div className="ws-kv">
            <div><small>Quotation</small><strong>{quote?.ref}</strong></div>
            <div><small>Wording</small><strong>{form.wordingRef || "—"}</strong></div>
            <div><small>Categories</small><strong>{hasCategories ? scheme.categories.map((c) => c.code).join(", ") : categories.map((c) => c.code).join(", ")}</strong></div>
            <div><small>Not at work</small><strong>{form.aawRule === "DEFER" ? "Defer cover" : "Refer to underwriting"}</strong></div>
            <div><small>Billing</small><strong>{form.billingMethod.replace("_", " ").toLowerCase()} · day {form.billingDueDay}</strong></div>
          </div>
        </div>
      )}
      <ErrorNote error={action.error} />
      <div className="ws-form-actions">
        {page > 0 && (
          <Button variant="secondary" onClick={() => setPage(page - 1)}>
            Back
          </Button>
        )}
        {page < 4 ? (
          <Button onClick={next} disabled={blocked} busy={action.busy}>
            {page === 3 ? "Check and review" : "Next"}
          </Button>
        ) : (
          <Button onClick={submit} busy={action.busy} disabled={categoryProblem}>
            Activate master policy
          </Button>
        )}
      </div>
    </Drawer>
  );
}
