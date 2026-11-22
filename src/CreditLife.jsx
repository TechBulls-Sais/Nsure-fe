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
  EXPIRED: ["Term ended", undefined],
};
// Benefits a credit claim can be for; the loan must carry the one claimed.
const CLAIM_CAUSES = [
  ["DEATH", "Death", () => true],
  ["PERMANENT_DISABILITY", "Permanent disability", (l) => l.permanentDisability],
  ["TEMPORARY_DISABILITY", "Temporary disability", (l) => l.temporaryDisability],
  ["CRITICAL_ILLNESS", "Critical illness", (l) => l.criticalIllness],
];
const addMonths = (iso, months) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
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
          ["queue", "Lender submissions"],
          ["lenders", "Lenders"],
          ["refunds", "Refunds"],
          ["rule", "Product rule"],
        ]}
      />
      {tab === "loans" && <Loans session={session} notify={notify} profile={profile} resource={loans} onOpen={setOpen} onChange={reload} />}
      {tab === "queue" && <SubmissionsQueue loans={loans} onOpen={setOpen} />}
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

// ── lender submissions queue (IL05 workspace) ───────────────────────────────────────────────────

// What a lender has sent that still needs an answer: registrations waiting for the disbursement notice or the first
// premium, messages held as balance exceptions (or claims waiting for a confirmed balance), and stale balances.
function submissionsFor(l) {
  const items = [];
  if (l.status === "QUOTED") items.push(["Loan registration", "Awaiting the lender's disbursement notice and the first premium."]);
  if (l.status === "AWAITING_DISBURSEMENT") items.push(["Loan registration", "First premium received; awaiting the lender's disbursement notice."]);
  if (l.status === "AWAITING_PREMIUM") items.push(["Disbursement notice", "Disbursed on " + l.disbursementDate + "; cover waits for the first premium."]);
  if (l.balanceException)
    items.push([
      l.balanceException.startsWith("Claim for") ? "Claim needs a confirmed balance" : "Held balance message",
      l.balanceException,
    ]);
  else if (l.balanceStale && ["COVER_ACTIVE", "COVER_OFF"].includes(l.status))
    items.push(["Stale balance", "Last balance from the lender is dated " + l.balanceAsOf + ": ask for a current statement."]);
  return items;
}

function SubmissionsQueue({ loans, onOpen }) {
  const rows = (loans.data || []).flatMap((l) =>
    submissionsFor(l).map(([kind, detail], i) => ({ key: l.ref + ":" + i, kind, detail, loan: l })),
  );
  return (
    <Panel
      title="Lender submissions awaiting action"
      subtitle="Loan registrations, disbursement notices and balance or settlement messages that cannot go further without an answer. Open a loan to act on it."
    >
      <ErrorNote error={loans.error} />
      <DataTable
        rows={rows}
        rowKey={(r) => r.key}
        loading={loans.loading && !loans.data?.length}
        empty="Nothing awaiting action"
        onRowClick={(r) => onOpen(r.loan.ref)}
        columns={[
          { key: "kind", label: "Submission", render: (r) => <Badge tone="amber">{r.kind}</Badge> },
          { key: "lender", label: "Lender", render: (r) => r.loan.lenderName + " · " + r.loan.lenderLoanId },
          { key: "borrower", label: "Borrower", render: (r) => r.loan.borrowerName },
          { key: "detail", label: "What it needs" },
          { key: "received", label: "Registered", render: (r) => when(r.loan.createdAt) },
        ]}
      />
    </Panel>
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

/** Repayment / closure preview for a chosen date (the server accepts any date; "today" is shown below). */
function ClosurePreview({ session, base, loan }) {
  const [date, setDate] = useState("");
  const preview = useResource(session, date ? base + "/settlement-preview?date=" + date : null, null);
  const p = date ? preview.data : null;
  return (
    <Panel title="Closure preview for a date" subtitle="What an early settlement on a chosen date would refund. Nothing changes until the lender's settlement is recorded.">
      <div className="field-grid">
        <Field label="Settlement date">
          <input type="date" min={loan.disbursementDate} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <ErrorNote error={date ? preview.error : ""} />
      {p && (
        <>
          <div className="ws-kv">
            <div>
              <small>Months of cover used</small>
              <strong>
                {p.monthsElapsed} of {loan.termMonths}
              </strong>
            </div>
            <div>
              <small>Premium refund</small>
              <strong>{pula(p.refund)}</strong>
            </div>
          </div>
          <p className="ws-hint">{p.blocked ? "Blocked: " + p.blockedBecause : p.formula}</p>
        </>
      )}
    </Panel>
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
      claim: ["/claim", "Claim allocation recorded: a second person verifies the payee"],
      verify: ["/claim/verification", "Payee verified"],
      pay: ["/claim/payment", "Claim payment recorded"],
      settle: ["/settlement", "Loan settled"],
      refinance: ["/refinance", "Loan refinanced"],
    };
    const [suffix, message] = paths[kind];
    // A balance message sent before, or one that is held, is not "recorded": say what happened (test C-44).
    const seen = kind === "balance" && (d?.balances || []).some((b) => b.sourceReference === body.sourceReference);
    const done = await action.run(
      () => request(session, base + suffix, { method: "POST", body }),
      kind === "balance" ? null : message,
    );
    if (done && kind === "balance") {
      const row = (done.data?.balances || []).find((b) => b.sourceReference === body.sourceReference);
      if (seen) notify("Already received: balance " + body.sourceReference + " was recorded before, so nothing changed.", "info");
      else if (row && row.status !== "APPLIED")
        notify("Balance held, not applied: " + (row.note || "it conflicts with the balance on record") + " It shows as an exception on the loan.", "error");
      else notify(message, "success");
    }
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
            <Panel title="Claim allocation" subtitle="Who the claim pays, and who verified the lender's payment details.">
              <div className="ws-kv">
                <div>
                  <small>Claim</small>
                  <strong>{l.claimRef || "—"}</strong>
                </div>
                <div>
                  <small>Benefit</small>
                  <strong>
                    {(CLAIM_CAUSES.find(([value]) => value === l.claimCause) || [null, l.claimCause || "Death"])[1]}
                    {l.claimEventDate ? " · event " + l.claimEventDate : ""}
                    {l.claimAccidental ? " · accidental" : ""}
                  </strong>
                </div>
                <div>
                  <small>Policy</small>
                  <strong>
                    {l.policyRef} · {l.policyStatus}
                  </strong>
                </div>
                <div>
                  <small>Balance valued at</small>
                  <strong>{l.valuationDate || l.claimEventDate || "—"}</strong>
                </div>
                <div>
                  <small>Payment</small>
                  <Badge tone={l.claimStatus === "PAID" ? "green" : l.claimStatus === "VERIFIED" ? "blue" : "amber"}>
                    {l.claimStatus === "PAID"
                      ? "Paid · " + l.claimPaidReference
                      : l.claimStatus === "VERIFIED"
                        ? "Payee verified, ready to pay"
                        : l.claimStatus === "PENDING_VERIFICATION"
                          ? "Payee awaiting verification"
                          : "Recorded"}
                  </Badge>
                </div>
              </div>
              {manage && l.claimStatus === "PENDING_VERIFICATION" && (
                <div className="ws-form-actions">
                  <Button onClick={() => setForm({ kind: "verify", note: "" })}>Verify payee</Button>
                </div>
              )}
              {manage && l.claimStatus === "VERIFIED" && (
                <div className="ws-form-actions">
                  <Button onClick={() => setForm({ kind: "pay", paymentReference: "" })}>Record payment</Button>
                </div>
              )}
              <DataTable
                rows={[
                  {
                    key: "lender",
                    payee: l.lenderName,
                    basis: "Lender · outstanding balance on loan " + l.lenderLoanId,
                    amount: l.lenderAmount,
                    verified:
                      (l.lenderAccount ? l.lenderAccount + " · " : "") +
                      (l.payeeVerifiedBy
                        ? "verified by " + l.payeeVerifiedBy + " · " + when(l.payeeVerifiedAt)
                        : "awaiting a second person's verification (recorded by " + (l.claimRecordedBy || "—") + ")"),
                  },
                  {
                    key: "estate",
                    payee: l.surplusPayeeName || "Estate or beneficiary of " + l.borrowerName,
                    basis:
                      "Any surplus of the sum assured over the balance" +
                      (l.surplusPayeeRelationship ? " · " + l.surplusPayeeRelationship : ""),
                    amount: l.estateAmount,
                    verified: l.payeeVerifiedBy ? "verified with the lender's payee" : "—",
                  },
                ]}
                rowKey={(r) => r.key}
                searchFrom={99}
                columns={[
                  { key: "payee", label: "Payee" },
                  { key: "basis", label: "Basis" },
                  { key: "amount", label: "Amount", align: "right", render: (r) => pula(r.amount) },
                  { key: "verified", label: "Verification" },
                ]}
              />
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
          {open && l.disbursementDate && <ClosurePreview session={session} base={base} loan={l} />}
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
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setForm({
                        kind: "claim",
                        eventDate: today(),
                        claimRef: "",
                        cause: "DEATH",
                        accidental: false,
                        lenderAccount: "",
                        surplusPayeeName: "",
                        surplusPayeeRelationship: "",
                      })
                    }
                  >
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
              verify: "Verify the claim's payee",
              pay: "Record the claim payment",
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
                <p className="ws-hint" style={{ gridColumn: "1 / -1" }}>
                  Recording the claim closes the loan's cover and terminates policy {l.policyRef}, so no further premium is due.
                </p>
                <Field label="Date of the event">
                  <input type="date" max={today()} value={form.eventDate} onChange={set("eventDate")} required />
                </Field>
                <Field label="Claim reference">
                  <input value={form.claimRef} onChange={set("claimRef")} placeholder="e.g. CLM-10021" />
                </Field>
                <Field label="Benefit claimed">
                  <select value={form.cause} onChange={set("cause")}>
                    {CLAIM_CAUSES.filter(([, , carried]) => carried(l)).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                {(() => {
                  // NS-IL05-003: each benefit has its own waiting period, set when the loan was sold.
                  const waiting =
                    {
                      PERMANENT_DISABILITY: l.pdWaitingMonths,
                      TEMPORARY_DISABILITY: l.tdWaitingMonths,
                      CRITICAL_ILLNESS: l.ciWaitingMonths,
                    }[form.cause] ?? l.waitingMonths;
                  return (
                    l.coverStart &&
                    form.eventDate &&
                    form.eventDate < addMonths(l.coverStart, waiting) && (
                      <Field label="Waiting period" full>
                        {form.cause === "CRITICAL_ILLNESS" ? (
                          <span className="ws-hint">
                            Within the {waiting}-month critical illness waiting period (to {addMonths(l.coverStart, waiting)}):
                            not covered, whatever the cause.
                          </span>
                        ) : (
                          <label className="ri-product">
                            <input type="checkbox" checked={form.accidental} onChange={set("accidental")} />
                            <span>
                              The event was accidental. It falls within the {waiting}-month waiting period (to{" "}
                              {addMonths(l.coverStart, waiting)}), when only accidental events are covered.
                            </span>
                          </label>
                        )}
                      </Field>
                    )
                  );
                })()}
                <Field label="Lender's account to pay" full>
                  <input
                    value={form.lenderAccount}
                    onChange={set("lenderAccount")}
                    placeholder="e.g. settlement account and reference"
                    required
                  />
                </Field>
                <Field label="Surplus payee (if any)" hint="Blank: the estate, unless the product names a beneficiary">
                  <input value={form.surplusPayeeName} onChange={set("surplusPayeeName")} />
                </Field>
                <Field label="Relationship to the borrower">
                  <input value={form.surplusPayeeRelationship} onChange={set("surplusPayeeRelationship")} />
                </Field>
                <p className="ws-hint" style={{ gridColumn: "1 / -1" }}>
                  A second person verifies the lender's account and the surplus payee before the claim is paid.
                </p>
              </>
            )}
            {form.kind === "verify" && (
              <Field label="How the payment details were verified" full>
                <textarea value={form.note} onChange={set("note")} rows={3} required />
              </Field>
            )}
            {form.kind === "pay" && (
              <Field label="Payment reference" full>
                <input value={form.paymentReference} onChange={set("paymentReference")} required />
              </Field>
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
    const cells = form.rows
      .split("\n")
      .map((line) => line.split(",").map((x) => x.trim()))
      .filter((c) => c.length >= 3 && c[0]);
    // AT-IL05-02: a settlement file closes each loan once; sending it again closes nothing more.
    const settlement = form.kind === "settlements";
    const rows = settlement
      ? cells.map(([lenderLoanId, settlementReference, settlementDate]) => ({ lenderLoanId, settlementReference, settlementDate }))
      : cells.map(([lenderLoanId, effectiveDate, balance]) => ({ lenderLoanId, effectiveDate, balance }));
    const done = await save.run(() =>
      request(session, "/credit/lenders/" + form.lenderRef + (settlement ? "/settlements" : "/balances"), {
        method: "POST",
        body: settlement ? { fileReference: form.batchReference, rows } : { batchReference: form.batchReference, rows },
      }),
    );
    if (done) {
      setResult({ ...done.data, kind: settlement ? "Settlement file " : "Balance file " });
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
                  <span className="ws-row-actions">
                    <Button
                      variant="secondary"
                      icon={Upload}
                      onClick={() => setForm({ kind: "file", lenderRef: r.ref, lenderName: r.name, batchReference: "", rows: "" })}
                    >
                      Balance file
                    </Button>
                    <Button
                      variant="secondary"
                      icon={Upload}
                      onClick={() =>
                        setForm({ kind: "settlements", lenderRef: r.ref, lenderName: r.name, batchReference: "", rows: "" })
                      }
                    >
                      Settlement file
                    </Button>
                  </span>
                ),
            },
          ]}
        />
      </Panel>
      {result && (
        <Panel
          title={(result.kind || "Balance file ") + result.batchReference}
          subtitle={
            result.applied +
            (result.kind === "Settlement file " ? " settled" : " applied") +
            " · " +
            result.duplicates +
            " already received · " +
            result.conflicts +
            " held or blocked · " +
            result.unknown +
            " unknown"
          }
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
                render: (r) => (
                  <Badge tone={["APPLIED", "SETTLED"].includes(r.outcome) ? "green" : r.outcome === "DUPLICATE" ? undefined : "red"}>
                    {r.outcome.replace("_", " ").toLowerCase()}
                  </Badge>
                ),
              },
              { key: "note", label: "Note", render: (r) => r.note || "—" },
            ]}
          />
        </Panel>
      )}
      {form && (
        <Drawer
          title={
            form.kind === "lender"
              ? "Add a lender"
              : (form.kind === "settlements" ? "Settlement file from " : "Balance file from ") + form.lenderName
          }
          description={
            form.kind === "file"
              ? "One loan per line: lender's loan id, balance date (YYYY-MM-DD), outstanding balance."
              : form.kind === "settlements"
                ? "One loan per line: lender's loan id, settlement reference, settlement date (YYYY-MM-DD). A loan already settled under the same reference is not closed again."
                : undefined
          }
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
                    placeholder={form.kind === "settlements" ? "LSH-1001, SET-1001, " + today() : "LSH-1001, " + today() + ", 98500.00"}
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
                {r.minEntryAge}–{r.maxEntryAge}
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
            <div>
              <small>Benefit waiting periods</small>
              <strong>
                Death {r.waitingMonths} · PD {r.pdWaitingMonths} · TD {r.tdWaitingMonths} · CI {r.ciWaitingMonths} months
              </strong>
            </div>
            <div>
              <small>Optional benefit loadings</small>
              <strong>
                TD +{Number(r.tdRatePerMille)} · CI +{Number(r.ciRatePerMille)} per 1,000
              </strong>
            </div>
            <div>
              <small>Optional benefit amounts</small>
              <strong>
                TD {r.tdBenefitMonths} instalments · CI {Number(r.ciBenefitPercent)}% of the balance
              </strong>
            </div>
            <div>
              <small>Claim balance valued at</small>
              <strong>{r.valuationBasis === "NOTIFICATION_DATE" ? "The date the claim is notified" : "The event date"}</strong>
            </div>
            <div>
              <small>Surplus paid to</small>
              <strong>{r.surplusPayee === "NOMINATED_BENEFICIARY" ? "The nominated beneficiary" : "The estate"}</strong>
            </div>
          </div>
        )}
        <p className="ws-hint">Seeded figures are demo defaults pending the insurer's approved credit terms.</p>
      </Panel>
      {form && (
        <Drawer title="Change the Individual Credit rule" description="Loans already registered keep the premium and benefits they were given." onClose={() => setForm(null)}>
          <FormGrid submitLabel="Save" busy={save.busy} error={save.error} onSubmit={submit}>
            <Field label="Maximum entry age">
              <input type="number" min="0" max="120" value={form.maxEntryAge} onChange={set("maxEntryAge")} required />
            </Field>
            <Field label="Permanent disability waiting (months)">
              <input type="number" min="0" value={form.pdWaitingMonths} onChange={set("pdWaitingMonths")} required />
            </Field>
            <Field label="Temporary disability waiting (months)">
              <input type="number" min="0" value={form.tdWaitingMonths} onChange={set("tdWaitingMonths")} required />
            </Field>
            <Field label="Critical illness waiting (months)">
              <input type="number" min="0" value={form.ciWaitingMonths} onChange={set("ciWaitingMonths")} required />
            </Field>
            <Field label="Temporary disability loading (per 1,000)">
              <input type="number" min="0" step="0.0001" value={form.tdRatePerMille} onChange={set("tdRatePerMille")} required />
            </Field>
            <Field label="Critical illness loading (per 1,000)">
              <input type="number" min="0" step="0.0001" value={form.ciRatePerMille} onChange={set("ciRatePerMille")} required />
            </Field>
            <Field label="Temporary disability pays (instalments)">
              <input type="number" min="1" value={form.tdBenefitMonths} onChange={set("tdBenefitMonths")} required />
            </Field>
            <Field label="Critical illness pays (% of balance)">
              <input type="number" min="1" max="100" step="0.01" value={form.ciBenefitPercent} onChange={set("ciBenefitPercent")} required />
            </Field>
            <Field label="Claim balance valued at">
              <select value={form.valuationBasis} onChange={set("valuationBasis")}>
                <option value="EVENT_DATE">The event date</option>
                <option value="NOTIFICATION_DATE">The date the claim is notified</option>
              </select>
            </Field>
            <Field label="Surplus paid to">
              <select value={form.surplusPayee} onChange={set("surplusPayee")}>
                <option value="ESTATE">The estate</option>
                <option value="NOMINATED_BENEFICIARY">The nominated beneficiary</option>
              </select>
            </Field>
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
