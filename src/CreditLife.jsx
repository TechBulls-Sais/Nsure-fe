import React, { useState } from "react";
import { Pencil, Plus, Upload } from "lucide-react";
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

// IL05 individual credit life: loans registered for a lender, each with its own credit life policy. Cover needs both
// the disbursement and the first premium; balances come from the lender; claims and early settlements close the loan.

const STATUS = {
  QUOTED: ["Quoted", undefined],
  AWAITING_PREMIUM: ["Awaiting first premium", "amber"],
  AWAITING_DISBURSEMENT: ["Awaiting disbursement", "amber"],
  COVER_ACTIVE: ["Cover active", "green"],
  COVER_OFF: ["Cover off", "red"],
  SETTLED: ["Settled", "blue"],
  CLAIMED: ["Claimed", "blue"],
  CANCELLED: ["Cancelled", undefined],
};
const statusBadge = (s) => {
  const [label, tone] = STATUS[s] || [s];
  return <Badge tone={tone}>{label}</Badge>;
};
const today = () => new Date().toISOString().slice(0, 10);

export default function CreditLife({ session, notify, profile }) {
  const [tab, setTab] = useState("loans");
  const [open, setOpen] = useState(null);
  const summary = useResource(session, "/credit/summary", null);
  const loans = useResource(session, "/credit/loans", []);
  const s = summary.data || {};
  const loading = summary.loading && !summary.data;
  const reload = () => {
    summary.reload();
    loans.reload();
  };
  return (
    <>
      <Heading
        eyebrow="CREDIT LIFE"
        title="Credit life"
        subtitle="Loans covered for each lender: the cover that starts on disbursement and first premium, the lender's balances, credit claims, early settlements and premium refunds."
      />
      <div className="stat-grid">
        <Stat label="Loans with active cover" value={s.coverActive ?? 0} note={(s.loans ?? 0) + " loans in total"} loading={loading} />
        <Stat label="Outstanding balance covered" value={pula(s.outstandingBalance ?? 0)} tone="blue" loading={loading} />
        <Stat label="Awaiting disbursement or premium" value={s.awaiting ?? 0} tone="amber" loading={loading} />
        <Stat
          label="Balance exceptions"
          value={s.exceptions ?? 0}
          note={(s.refundsDue ?? 0) + " refund(s) to pay"}
          tone="amber"
          loading={loading}
        />
      </div>
      <Tabs
        value={tab}
        onChange={(next) => {
          setTab(next);
          reload();
        }}
        tabs={[
          ["loans", "Loans"],
          ["lenders", "Lenders"],
          ["refunds", "Refunds"],
          ["rule", "Product rule"],
        ]}
      />
      {tab === "loans" && <Loans session={session} notify={notify} profile={profile} resource={loans} onOpen={setOpen} onChange={reload} />}
      {tab === "lenders" && <Lenders session={session} notify={notify} profile={profile} onChange={reload} />}
      {tab === "refunds" && <Refunds session={session} notify={notify} profile={profile} onChange={reload} />}
      {tab === "rule" && <Rule session={session} notify={notify} profile={profile} />}
      {open && (
        <LoanDrawer
          session={session}
          notify={notify}
          profile={profile}
          loanRef={open}
          onOpen={setOpen}
          onClose={() => {
            setOpen(null);
            reload();
          }}
        />
      )}
    </>
  );
}

// ── loans ───────────────────────────────────────────────────────────────────────────────────────

function Loans({ session, notify, profile, resource, onOpen, onChange }) {
  const lenders = useResource(session, "/credit/lenders", []);
  const customers = useResource(session, can(profile, "READ_CUSTOMER") ? "/portfolio/customers" : null, []);
  const rule = useResource(session, "/credit/rule", null);
  const [form, setForm] = useState(null);
  const save = useAction(notify);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const submit = async () => {
    const done = await save.run(() => request(session, "/credit/loans", { method: "POST", body: form }), "Loan registered");
    if (done) {
      setForm(null);
      onChange();
      onOpen(done.data.ref);
    }
  };
  const r = rule.data;
  const premium = form && r && form.principal ? (Number(form.principal) / 1000) * Number(r.ratePerMille) : null;
  return (
    <>
      <Panel
        title="Loans"
        subtitle="Each loan has its own credit life policy. Cover is active only once the lender has confirmed disbursement and the first premium has been received."
        action={
          can(profile, "MANAGE_CREDIT") && (
            <Button
              icon={Plus}
              onClick={() =>
                setForm({
                  lenderRef: (lenders.data || [])[0]?.ref || "",
                  lenderLoanId: "",
                  customerRef: "",
                  principal: "",
                  termMonths: 36,
                  premiumBasis: "REGULAR",
                  secured: false,
                  pensioner: false,
                  temporaryDisability: false,
                  criticalIllness: false,
                  permanentDisability: false,
                })
              }
            >
              Register loan
            </Button>
          )
        }
      >
        <ErrorNote error={resource.error} />
        <DataTable
          rows={resource.data}
          loading={resource.loading}
          rowKey={(x) => x.ref}
          onRowClick={(x) => onOpen(x.ref)}
          empty="No loans registered"
          emptyDetail="Register a loan for a lender to open its credit life policy."
          searchPlaceholder="Search loans, borrowers, lenders…"
          columns={[
            { key: "ref", label: "Loan" },
            { key: "lenderName", label: "Lender" },
            { key: "lenderLoanId", label: "Lender's loan id" },
            { key: "borrowerName", label: "Borrower" },
            { key: "principal", label: "Principal", align: "right", sortValue: (x) => Number(x.principal), render: (x) => pula(x.principal) },
            {
              key: "balance",
              label: "Balance",
              align: "right",
              sortValue: (x) => Number(x.balance),
              render: (x) => (x.disbursementDate ? pula(x.balance) + (x.balanceAsOf ? " · " + x.balanceAsOf : "") : "—"),
            },
            { key: "policyRef", label: "Policy" },
            { key: "status", label: "Cover", render: (x) => statusBadge(x.status) },
            {
              key: "flags",
              label: "",
              render: (x) =>
                x.balanceException ? <Badge tone="red">Balance exception</Badge> : x.balanceStale ? <Badge tone="amber">Balance stale</Badge> : null,
            },
          ]}
        />
      </Panel>
      {form && (
        <Drawer
          title="Register a loan"
          description="Opens the loan's credit life policy as an offer. The same lender loan id sent again returns the first result."
          onClose={() => setForm(null)}
        >
          <FormGrid submitLabel="Register loan" busy={save.busy} error={save.error} onSubmit={submit}>
            <Field label="Lender">
              <select value={form.lenderRef} onChange={set("lenderRef")} required>
                {(lenders.data || []).map((l) => (
                  <option key={l.ref} value={l.ref}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Lender's loan id">
              <input value={form.lenderLoanId} onChange={set("lenderLoanId")} required />
            </Field>
            <Field label="Borrower" full>
              <select value={form.customerRef} onChange={set("customerRef")} required>
                <option value="">Choose a verified customer</option>
                {(customers.data || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Principal (BWP)">
              <input type="number" min="1" step="0.01" value={form.principal} onChange={set("principal")} required />
            </Field>
            <Field label="Term (months)" hint={r ? r.minTermMonths + "–" + r.maxTermMonths + " months" : undefined}>
              <input type="number" min="1" value={form.termMonths} onChange={set("termMonths")} required />
            </Field>
            <Field
              label="Premium"
              full
              hint={
                premium != null
                  ? form.premiumBasis === "SINGLE"
                    ? "Single premium " + pula(premium * Number(form.termMonths || 0))
                    : pula(premium) + " a month"
                  : undefined
              }
            >
              <select value={form.premiumBasis} onChange={set("premiumBasis")}>
                <option value="REGULAR">Monthly premium</option>
                <option value="SINGLE">Single premium for the whole term</option>
              </select>
            </Field>
            <Field label="Loan" full>
              <label className="ri-product">
                <input type="checkbox" checked={form.secured} onChange={set("secured")} />
                <span>Secured loan</span>
              </label>
              <label className="ri-product">
                <input type="checkbox" checked={form.pensioner} onChange={set("pensioner")} />
                <span>Borrower is a pensioner</span>
              </label>
            </Field>
            <Field label="Benefits beyond death cover" full>
              {r?.permanentDisability === "OPTIONAL" && (
                <label className="ri-product">
                  <input type="checkbox" checked={form.permanentDisability} onChange={set("permanentDisability")} />
                  <span>Permanent disability</span>
                </label>
              )}
              {r?.temporaryDisabilityOffered && (
                <label className="ri-product">
                  <input type="checkbox" checked={form.temporaryDisability} onChange={set("temporaryDisability")} />
                  <span>Temporary disability</span>
                </label>
              )}
              {r?.criticalIllnessOffered && (
                <label className="ri-product">
                  <input type="checkbox" checked={form.criticalIllness} onChange={set("criticalIllness")} />
                  <span>Critical illness</span>
                </label>
              )}
              {r?.permanentDisability === "STANDARD" && <small className="ws-hint">Permanent disability is part of every policy.</small>}
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

function LoanDrawer({ session, notify, profile, loanRef, onClose, onOpen }) {
  const base = "/credit/loans/" + encodeURIComponent(loanRef);
  const detail = useResource(session, base, null);
  const action = useAction(notify);
  const [form, setForm] = useState(null);
  const d = detail.data;
  const l = d?.loan;
  const manage = can(profile, "MANAGE_CREDIT");
  const open = l && !["SETTLED", "CLAIMED", "CANCELLED"].includes(l.status);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const submit = async () => {
    const { kind, ...body } = form;
    const paths = {
      disbursement: ["/disbursement", "Disbursement recorded"],
      balance: ["/balances", "Balance recorded"],
      resolve: ["/balance-exception/resolve", "Exception resolved"],
      claim: ["/claim", "Claim allocation recorded"],
      settle: ["/settlement", "Loan settled"],
      refinance: ["/refinance", "Loan refinanced"],
    };
    const [suffix, message] = paths[kind];
    const done = await action.run(() => request(session, base + suffix, { method: "POST", body }), message);
    if (done) {
      setForm(null);
      if (kind === "refinance") {
        onOpen(done.data.ref);
      } else {
        detail.reload();
      }
    } else if (kind === "claim") {
      // A claim without a current balance is routed for manual resolution: show the flag it left.
      detail.reload();
    }
  };

  return (
    <Drawer
      size="lg"
      title={l ? l.ref + " · " + l.borrowerName : loanRef}
      description={l ? l.lenderName + " loan " + l.lenderLoanId + " · policy " + l.policyRef : "Loading…"}
      onClose={onClose}
    >
      <ErrorNote error={detail.error} />
      {l && (
        <>
          <div className="ws-kv">
            <div>
              <small>Cover</small>
              {statusBadge(l.status)}
            </div>
            <div>
              <small>Policy</small>
              <strong>
                {l.policyRef} · {l.policyStatus}
              </strong>
            </div>
            <div>
              <small>Principal</small>
              <strong>{pula(l.principal)}</strong>
            </div>
            <div>
              <small>Term</small>
              <strong>{l.termMonths} months</strong>
            </div>
            <div>
              <small>Premium</small>
              <strong>{l.premiumBasis === "SINGLE" ? pula(l.singlePremium) + " single" : pula(l.monthlyPremium) + " a month"}</strong>
            </div>
            <div>
              <small>Disbursed</small>
              <strong>{l.disbursementDate || "Not yet"}</strong>
            </div>
            <div>
              <small>Cover period</small>
              <strong>{l.coverStart ? l.coverStart + " → " + l.coverEnd : "Not started"}</strong>
            </div>
            <div>
              <small>Outstanding balance</small>
              <strong>{l.disbursementDate ? pula(l.balance) + (l.balanceAsOf ? " as of " + l.balanceAsOf : "") : "—"}</strong>
            </div>
            <div>
              <small>Benefits</small>
              <strong>
                {["Death", l.permanentDisability && "Permanent disability", l.temporaryDisability && "Temporary disability", l.criticalIllness && "Critical illness"]
                  .filter(Boolean)
                  .join(", ")}
              </strong>
            </div>
            <div>
              <small>Waiting period</small>
              <strong>{l.waitingMonths} months</strong>
            </div>
            {l.refinancedFrom && (
              <div>
                <small>Refinanced from</small>
                <strong>{l.refinancedFrom}</strong>
              </div>
            )}
            {l.settledOn && (
              <div>
                <small>Settled</small>
                <strong>
                  {l.settledOn} · {l.settlementReference}
                </strong>
              </div>
            )}
          </div>
          {l.status === "AWAITING_PREMIUM" && (
            <p className="ws-hint">The loan is disbursed, but cover does not start until the first premium on {l.policyRef} is received.</p>
          )}
          {l.status === "QUOTED" && (
            <p className="ws-hint">Cover starts once the lender confirms disbursement and the first premium on {l.policyRef} is received.</p>
          )}
          {l.balanceException && (
            <p className="ws-hint">
              <Badge tone="red">Balance exception</Badge> {l.balanceException}
            </p>
          )}
          {l.status === "CLAIMED" && (
            <Panel title="Claim allocation">
              <div className="ws-kv">
                <div>
                  <small>Claim</small>
                  <strong>{l.claimRef || "—"}</strong>
                </div>
                <div>
                  <small>Paid to the lender</small>
                  <strong>{pula(l.lenderAmount)}</strong>
                </div>
                <div>
                  <small>Paid to the estate or beneficiary</small>
                  <strong>{pula(l.estateAmount)}</strong>
                </div>
              </div>
            </Panel>
          )}
          {open && d.claimToday && l.disbursementDate && (
            <Panel title="If a claim arose today" subtitle="The lender is paid the balance at the event date; any surplus goes to the estate or beneficiary.">
              {d.claimToday.manualResolution ? (
                <p className="ws-hint">
                  <Badge tone="amber">Manual resolution</Badge> {d.claimToday.notes.join(" ")}
                </p>
              ) : (
                <div className="ws-kv">
                  <div>
                    <small>Sum assured</small>
                    <strong>{pula(d.claimToday.sumAssured)}</strong>
                  </div>
                  <div>
                    <small>To the lender</small>
                    <strong>{pula(d.claimToday.lenderAmount)}</strong>
                  </div>
                  <div>
                    <small>To the estate</small>
                    <strong>{pula(d.claimToday.estateAmount)}</strong>
                  </div>
                  <div>
                    <small>Balance used</small>
                    <strong>
                      {pula(d.claimToday.balance)} · {d.claimToday.balanceAsOf}
                    </strong>
                  </div>
                </div>
              )}
            </Panel>
          )}
          {open && d.settlementToday && l.disbursementDate && (
            <Panel title="If the loan were settled today">
              <div className="ws-kv">
                <div>
                  <small>Months of cover used</small>
                  <strong>
                    {d.settlementToday.monthsElapsed} of {l.termMonths}
                  </strong>
                </div>
                <div>
                  <small>Premium refund</small>
                  <strong>{pula(d.settlementToday.refund)}</strong>
                </div>
              </div>
              <p className="ws-hint">{d.settlementToday.blocked ? "Blocked: " + d.settlementToday.blockedBecause : d.settlementToday.formula}</p>
            </Panel>
          )}
          {d.refund && (
            <Panel title="Premium refund">
              <div className="ws-kv">
                <div>
                  <small>Refund</small>
                  <strong>
                    {d.refund.ref} · {pula(d.refund.amount)}
                  </strong>
                </div>
                <div>
                  <small>Status</small>
                  <Badge tone={d.refund.status === "PAID" ? "green" : "amber"}>{d.refund.status === "PAID" ? "Paid" : "To pay"}</Badge>
                </div>
              </div>
              <p className="ws-hint">{d.refund.formula}</p>
            </Panel>
          )}
          <Panel title="Balances from the lender" subtitle="A message sent twice is recorded once. A stale or conflicting one is kept and flagged, and never becomes the balance.">
            <DataTable
              rows={d.balances}
              rowKey={(x) => x.id}
              searchFrom={99}
              empty="No balances yet"
              columns={[
                { key: "sourceReference", label: "Reference" },
                { key: "effectiveDate", label: "Dated" },
                { key: "balance", label: "Balance", align: "right", render: (x) => pula(x.balance) },
                { key: "status", label: "Result", render: (x) => <Badge tone={x.status === "APPLIED" ? "green" : "red"}>{x.status === "APPLIED" ? "Applied" : "Held"}</Badge> },
                { key: "note", label: "Note", render: (x) => x.note || "—" },
                { key: "receivedBy", label: "Received", render: (x) => x.receivedBy + " · " + when(x.receivedAt) },
              ]}
            />
          </Panel>
          {manage && open && (
            <div className="ws-form-actions">
              {!l.disbursementDate && (
                <Button onClick={() => setForm({ kind: "disbursement", disbursementDate: today(), reference: "" })}>Record disbursement</Button>
              )}
              {l.disbursementDate && (
                <>
                  <Button variant="secondary" onClick={() => setForm({ kind: "balance", sourceReference: "", effectiveDate: today(), balance: "" })}>
                    Record balance
                  </Button>
                  {l.balanceException && (
                    <Button variant="secondary" onClick={() => setForm({ kind: "resolve", note: "" })}>
                      Resolve exception
                    </Button>
                  )}
                  <Button variant="secondary" onClick={() => setForm({ kind: "claim", eventDate: today(), claimRef: "", payeeVerified: false })}>
                    Record claim
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setForm({ kind: "refinance", newLenderLoanId: "", principal: "", termMonths: l.termMonths, settlementReference: "" })}
                  >
                    Refinance
                  </Button>
                  <Button onClick={() => setForm({ kind: "settle", settlementReference: "", settlementDate: today() })}>Settle early</Button>
                </>
              )}
            </div>
          )}
        </>
      )}
      {form && (
        <Drawer
          title={
            {
              disbursement: "Record disbursement",
              balance: "Record a balance",
              resolve: "Resolve the balance exception",
              claim: "Record a claim on this loan",
              settle: "Settle the loan early",
              refinance: "Refinance the loan",
            }[form.kind]
          }
          onClose={() => setForm(null)}
        >
          <FormGrid submitLabel="Save" busy={action.busy} error={action.error} onSubmit={submit}>
            {form.kind === "disbursement" && (
              <>
                <Field label="Disbursement date">
                  <input type="date" max={today()} value={form.disbursementDate} onChange={set("disbursementDate")} required />
                </Field>
                <Field label="Lender's reference">
                  <input value={form.reference} onChange={set("reference")} required />
                </Field>
              </>
            )}
            {form.kind === "balance" && (
              <>
                <Field label="Lender's reference" full>
                  <input value={form.sourceReference} onChange={set("sourceReference")} placeholder="e.g. statement or file id" required />
                </Field>
                <Field label="Balance dated">
                  <input type="date" max={today()} value={form.effectiveDate} onChange={set("effectiveDate")} required />
                </Field>
                <Field label="Outstanding balance (BWP)">
                  <input type="number" min="0" step="0.01" value={form.balance} onChange={set("balance")} required />
                </Field>
              </>
            )}
            {form.kind === "resolve" && (
              <Field label="How the right balance was confirmed" full>
                <textarea value={form.note} onChange={set("note")} rows={3} required />
              </Field>
            )}
            {form.kind === "claim" && (
              <>
                <Field label="Date of the event">
                  <input type="date" max={today()} value={form.eventDate} onChange={set("eventDate")} required />
                </Field>
                <Field label="Claim reference">
                  <input value={form.claimRef} onChange={set("claimRef")} placeholder="e.g. CLM-10021" />
                </Field>
                <Field label="Payee" full>
                  <label className="ri-product">
                    <input type="checkbox" checked={form.payeeVerified} onChange={set("payeeVerified")} />
                    <span>The lender's payment details have been verified</span>
                  </label>
                </Field>
              </>
            )}
            {form.kind === "settle" && (
              <>
                <Field label="Lender's settlement reference">
                  <input value={form.settlementReference} onChange={set("settlementReference")} required />
                </Field>
                <Field label="Settlement date">
                  <input type="date" max={today()} value={form.settlementDate} onChange={set("settlementDate")} required />
                </Field>
              </>
            )}
            {form.kind === "refinance" && (
              <>
                <Field label="New loan id at the lender">
                  <input value={form.newLenderLoanId} onChange={set("newLenderLoanId")} required />
                </Field>
                <Field label="Settlement reference for this loan">
                  <input value={form.settlementReference} onChange={set("settlementReference")} required />
                </Field>
                <Field label="New principal (BWP)">
                  <input type="number" min="1" step="0.01" value={form.principal} onChange={set("principal")} required />
                </Field>
                <Field label="New term (months)">
                  <input type="number" min="1" value={form.termMonths} onChange={set("termMonths")} required />
                </Field>
              </>
            )}
          </FormGrid>
        </Drawer>
      )}
    </Drawer>
  );
}

// ── lenders ─────────────────────────────────────────────────────────────────────────────────────

function Lenders({ session, notify, profile, onChange }) {
  const lenders = useResource(session, "/credit/lenders", []);
  const [form, setForm] = useState(null);
  const [result, setResult] = useState(null);
  const save = useAction(notify);
  const manage = can(profile, "MANAGE_CREDIT");
  const submit = async () => {
    if (form.kind === "lender") {
      const done = await save.run(
        () => request(session, "/credit/lenders", { method: "POST", body: { name: form.name, contactEmail: form.contactEmail } }),
        "Lender registered",
      );
      if (done) {
        setForm(null);
        lenders.reload();
      }
      return;
    }
    const rows = form.rows
      .split("\n")
      .map((line) => line.split(",").map((x) => x.trim()))
      .filter((cells) => cells.length >= 3 && cells[0])
      .map(([lenderLoanId, effectiveDate, balance]) => ({ lenderLoanId, effectiveDate, balance }));
    const done = await save.run(() =>
      request(session, "/credit/lenders/" + form.lenderRef + "/balances", {
        method: "POST",
        body: { batchReference: form.batchReference, rows },
      }),
    );
    if (done) {
      setResult(done.data);
      setForm(null);
      onChange();
    }
  };
  return (
    <>
      <Panel
        title="Lenders"
        subtitle="A lender's balance file is answered row by row: applied, already received, held as a conflict, or unknown loan."
        action={
          manage && (
            <Button icon={Plus} onClick={() => setForm({ kind: "lender", name: "", contactEmail: "" })}>
              Add lender
            </Button>
          )
        }
      >
        <ErrorNote error={lenders.error} />
        <DataTable
          rows={lenders.data}
          loading={lenders.loading}
          rowKey={(r) => r.ref}
          searchFrom={99}
          empty="No lenders"
          columns={[
            { key: "ref", label: "Lender" },
            { key: "name", label: "Name" },
            { key: "contactEmail", label: "Contact", render: (r) => r.contactEmail || "—" },
            { key: "loans", label: "Loans", align: "right" },
            {
              key: "act",
              label: "",
              render: (r) =>
                manage && (
                  <Button
                    variant="secondary"
                    icon={Upload}
                    onClick={() => setForm({ kind: "file", lenderRef: r.ref, lenderName: r.name, batchReference: "", rows: "" })}
                  >
                    Balance file
                  </Button>
                ),
            },
          ]}
        />
      </Panel>
      {result && (
        <Panel
          title={"Balance file " + result.batchReference}
          subtitle={result.applied + " applied · " + result.duplicates + " already received · " + result.conflicts + " held · " + result.unknown + " unknown"}
        >
          <DataTable
            rows={result.results}
            rowKey={(r, i) => i}
            searchFrom={99}
            columns={[
              { key: "lenderLoanId", label: "Lender's loan id" },
              {
                key: "outcome",
                label: "Result",
                render: (r) => <Badge tone={r.outcome === "APPLIED" ? "green" : r.outcome === "DUPLICATE" ? undefined : "red"}>{r.outcome.replace("_", " ").toLowerCase()}</Badge>,
              },
              { key: "note", label: "Note", render: (r) => r.note || "—" },
            ]}
          />
        </Panel>
      )}
      {form && (
        <Drawer
          title={form.kind === "lender" ? "Add a lender" : "Balance file from " + form.lenderName}
          description={form.kind === "file" ? "One loan per line: lender's loan id, balance date (YYYY-MM-DD), outstanding balance." : undefined}
          onClose={() => setForm(null)}
        >
          <FormGrid submitLabel={form.kind === "lender" ? "Add lender" : "Process file"} busy={save.busy} error={save.error} onSubmit={submit}>
            {form.kind === "lender" ? (
              <>
                <Field label="Name" full>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </Field>
                <Field label="Contact email" full>
                  <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
                </Field>
              </>
            ) : (
              <>
                <Field label="File reference" full>
                  <input value={form.batchReference} onChange={(e) => setForm({ ...form, batchReference: e.target.value })} placeholder="e.g. BAL-2026-11" required />
                </Field>
                <Field label="Rows" full>
                  <textarea
                    className="ws-textarea"
                    value={form.rows}
                    onChange={(e) => setForm({ ...form, rows: e.target.value })}
                    placeholder={"LSH-1001, " + today() + ", 98500.00"}
                    required
                  />
                </Field>
              </>
            )}
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

// ── refunds ─────────────────────────────────────────────────────────────────────────────────────

function Refunds({ session, notify, profile, onChange }) {
  const refunds = useResource(session, "/credit/refunds", []);
  const [paying, setPaying] = useState(null);
  const pay = useAction(notify);
  const submit = async () => {
    const done = await pay.run(
      () => request(session, "/credit/refunds/" + paying.ref + "/payment", { method: "POST", body: { paymentReference: paying.reference } }),
      "Refund paid",
    );
    if (done) {
      setPaying(null);
      refunds.reload();
      onChange();
    }
  };
  return (
    <>
      <Panel title="Premium refunds" subtitle="The unearned premium on an early settlement. A loan has at most one refund, however often its settlement is sent.">
        <ErrorNote error={refunds.error} />
        <DataTable
          rows={refunds.data}
          loading={refunds.loading}
          rowKey={(r) => r.ref}
          empty="No refunds"
          columns={[
            { key: "ref", label: "Refund" },
            { key: "loanRef", label: "Loan" },
            { key: "borrowerName", label: "Borrower" },
            { key: "amount", label: "Amount", align: "right", sortValue: (r) => Number(r.amount), render: (r) => pula(r.amount) },
            { key: "formula", label: "How it was worked out" },
            { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "PAID" ? "green" : "amber"}>{r.status === "PAID" ? "Paid" : "To pay"}</Badge> },
            {
              key: "act",
              label: "",
              render: (r) =>
                r.status === "DUE" &&
                can(profile, "PAY_CREDIT_REFUND") && (
                  <Button variant="secondary" onClick={() => setPaying({ ref: r.ref, amount: r.amount, reference: "" })}>
                    Record payment
                  </Button>
                ),
            },
          ]}
        />
      </Panel>
      {paying && (
        <Drawer title={"Pay " + paying.ref} description={pula(paying.amount)} onClose={() => setPaying(null)}>
          <FormGrid submitLabel="Record payment" busy={pay.busy} error={pay.error} onSubmit={submit}>
            <Field label="Payment reference" full>
              <input value={paying.reference} onChange={(e) => setPaying({ ...paying, reference: e.target.value })} required />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

// ── product rule ────────────────────────────────────────────────────────────────────────────────

function Rule({ session, notify, profile }) {
  const rule = useResource(session, "/credit/rule", null);
  const [form, setForm] = useState(null);
  const save = useAction(notify);
  const r = rule.data;
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const submit = async () => {
    const done = await save.run(() => request(session, "/credit/rule", { method: "PUT", body: form }), "Rule saved");
    if (done) {
      rule.setData(done.data);
      setForm(null);
    }
  };
  return (
    <>
      <Panel
        title="Individual Credit rule"
        subtitle="Who may be covered and for how long, the premium rate, the waiting period, how current a balance must be, and how a refund is worked out."
        action={
          r &&
          can(profile, "MANAGE_CREDIT_RULE") && (
            <Button icon={Pencil} onClick={() => setForm({ ...r })}>
              Change
            </Button>
          )
        }
      >
        <ErrorNote error={rule.error} />
        {r && (
          <div className="ws-kv">
            <div>
              <small>Entry age</small>
              <strong>
                {r.minEntryAge}–{r.maxExitAge}
              </strong>
            </div>
            <div>
              <small>Cover ceases at</small>
              <strong>
                {r.maxExitAge} ({r.exceptionExitAge} for secured and pensioner loans)
              </strong>
            </div>
            <div>
              <small>Loan term</small>
              <strong>
                {r.minTermMonths}–{r.maxTermMonths} months
              </strong>
            </div>
            <div>
              <small>Premium rate</small>
              <strong>{Number(r.ratePerMille)} per 1,000 a month</strong>
            </div>
            <div>
              <small>Waiting period</small>
              <strong>{r.waitingMonths} months</strong>
            </div>
            <div>
              <small>Permanent disability</small>
              <strong>{r.permanentDisability === "STANDARD" ? "Part of every policy" : "Optional"}</strong>
            </div>
            <div>
              <small>Optional benefits</small>
              <strong>
                {[r.temporaryDisabilityOffered && "Temporary disability", r.criticalIllnessOffered && "Critical illness"].filter(Boolean).join(", ") || "None"}
              </strong>
            </div>
            <div>
              <small>Benefit</small>
              <strong>{r.coverBasis === "ORIGINAL_PRINCIPAL" ? "Original principal: surplus to the estate" : "Outstanding balance to the lender"}</strong>
            </div>
            <div>
              <small>Balance is stale after</small>
              <strong>{r.staleBalanceDays} days</strong>
            </div>
            <div>
              <small>Refund deduction</small>
              <strong>{Number(r.refundDeductionPercent)}% of the unearned premium</strong>
            </div>
          </div>
        )}
      </Panel>
      {form && (
        <Drawer title="Change the Individual Credit rule" description="Loans already registered keep the premium and benefits they were given." onClose={() => setForm(null)}>
          <FormGrid submitLabel="Save" busy={save.busy} error={save.error} onSubmit={submit}>
            <Field label="Minimum entry age">
              <input type="number" value={form.minEntryAge} onChange={set("minEntryAge")} required />
            </Field>
            <Field label="Cover ceases at age">
              <input type="number" value={form.maxExitAge} onChange={set("maxExitAge")} required />
            </Field>
            <Field label="Secured / pensioner cessation age">
              <input type="number" value={form.exceptionExitAge} onChange={set("exceptionExitAge")} required />
            </Field>
            <Field label="Waiting period (months)">
              <input type="number" min="0" value={form.waitingMonths} onChange={set("waitingMonths")} required />
            </Field>
            <Field label="Minimum term (months)">
              <input type="number" min="1" value={form.minTermMonths} onChange={set("minTermMonths")} required />
            </Field>
            <Field label="Maximum term (months)">
              <input type="number" min="1" value={form.maxTermMonths} onChange={set("maxTermMonths")} required />
            </Field>
            <Field label="Rate per 1,000 a month">
              <input type="number" min="0.0001" step="0.0001" value={form.ratePerMille} onChange={set("ratePerMille")} required />
            </Field>
            <Field label="Refund deduction (%)">
              <input type="number" min="0" max="100" step="0.01" value={form.refundDeductionPercent} onChange={set("refundDeductionPercent")} required />
            </Field>
            <Field label="Balance is stale after (days)">
              <input type="number" min="1" value={form.staleBalanceDays} onChange={set("staleBalanceDays")} required />
            </Field>
            <Field label="Permanent disability">
              <select value={form.permanentDisability} onChange={set("permanentDisability")}>
                <option value="STANDARD">Part of every policy</option>
                <option value="OPTIONAL">Optional</option>
              </select>
            </Field>
            <Field label="Benefit" full>
              <select value={form.coverBasis} onChange={set("coverBasis")}>
                <option value="ORIGINAL_PRINCIPAL">Original principal: balance to the lender, surplus to the estate</option>
                <option value="OUTSTANDING_BALANCE">Outstanding balance to the lender only</option>
              </select>
            </Field>
            <Field label="Optional benefits offered" full>
              <label className="ri-product">
                <input type="checkbox" checked={form.temporaryDisabilityOffered} onChange={set("temporaryDisabilityOffered")} />
                <span>Temporary disability</span>
              </label>
              <label className="ri-product">
                <input type="checkbox" checked={form.criticalIllnessOffered} onChange={set("criticalIllnessOffered")} />
                <span>Critical illness</span>
              </label>
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}
