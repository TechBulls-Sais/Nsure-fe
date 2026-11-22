import React, { useState } from "react";
import { Check, FileUp, HandCoins, Landmark, Pencil, ShieldCheck } from "lucide-react";
import { request } from "./api";
import { Badge, Button, DataTable, Drawer, ErrorNote, Field, FormGrid, Panel, can, pula, useAction, useResource, when } from "./ui/workspace";

// Group credit life (GL06): the lender agreement, loan bordereaux with referral decisions, each loan's certificate,
// cover history and premium schedule, lender remittance statements, interface update files with retained exceptions,
// settlement refunds with approval and payout, and credit claims. Everything goes through /group-life/**.

const label = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
const day = (value) =>
  value ? new Date(value + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const inlineErrors = (notify) => (message, tone) => {
  if (tone !== "error") notify?.(message, tone);
};
const LOAN_TONES = { ACTIVE: "green", REFERRED: "amber", DECLINED: "red", SETTLED: "gray", CANCELLED: "gray", CLAIMED: "purple" };
const BORDEREAU_HEADER = "lenderLoanId,borrowerName,borrowerIdNumber,dateOfBirth,loanClass,loanAmount,termMonths,disbursementDate,benefits";
const UPDATE_HEADER = "lenderLoanId,type,balance,amountPaid,arrearsMonths,effectiveDate";
const csvRows = (text, header) => {
  const keys = header.split(",");
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith(keys[0]))
    .map((l) => {
      const cells = l.split(",").map((c) => c.trim());
      return Object.fromEntries(keys.map((k, i) => [k, cells[i] ?? ""]).filter(([, v]) => v !== ""));
    });
};
const sum = (rows, key) => rows.reduce((t, r) => t + (Number(r[key]) || 0), 0);

export default function GroupCreditTab({ session, notify, profile, detail }) {
  const scheme = detail.scheme;
  const base = `/group-life/schemes/${encodeURIComponent(scheme.ref)}`;
  const agreement = useResource(session, base + "/lender-agreement");
  const loans = useResource(session, base + "/credit-loans", []);
  const remittances = useResource(session, base + "/credit-remittances", []);
  const exceptions = useResource(session, base + "/credit-exceptions", []);
  const refunds = useResource(session, base + "/credit-refunds", []);
  const claims = useResource(session, base + "/credit-claims", []);
  const action = useAction(inlineErrors(notify));
  const [form, setForm] = useState(null);
  const [result, setResult] = useState(null);
  const [loan, setLoan] = useState(null);
  const a = agreement.data;
  const reloadAll = () => [agreement, loans, remittances, exceptions, refunds, claims].forEach((r) => r.reload());
  const today = new Date().toISOString().slice(0, 10);

  const submit = async () => {
    let call;
    let done = "Saved";
    if (form.kind === "agreement") {
      const { kind, classesText, ...body } = form;
      body.classes = classesText
        .split("\n")
        .map((l) => l.split(",").map((x) => x.trim()))
        .filter((c) => c[0])
        .map(([code, name, maxTerm, maxAmount, benefits]) => ({ code, name, maxTerm, maxAmount, benefits: (benefits || "DEATH").split("|") }));
      call = () => request(session, base + "/lender-agreement", { method: "PUT", body });
      done = "Lender agreement saved";
    } else if (form.kind === "bordereau") {
      const rows = csvRows(form.rows, BORDEREAU_HEADER).map((r) => ({ ...r, benefits: (r.benefits || "").replace(/\|/g, ",") }));
      call = () =>
        request(session, base + "/credit-loans", {
          method: "POST",
          body: { batchReference: form.reference, schemaVersion: "2.0", controlTotals: { rowCount: Number(form.rowCount), totalLoanAmount: form.total }, rows },
        });
      done = null;
    } else if (form.kind === "updates") {
      const rows = csvRows(form.rows, UPDATE_HEADER);
      call = () =>
        request(session, base + "/credit-files", {
          method: "POST",
          body: { fileReference: form.reference, schemaVersion: "2.0", controlTotals: { rowCount: Number(form.rowCount), totalBalance: form.total }, rows },
        });
      done = null;
    } else if (form.kind === "remit") {
      call = () => request(session, base + "/credit-remittances", { method: "POST", body: { period: form.period } });
      done = "Remittance statement issued";
    } else if (form.kind === "receipt") {
      const rows = form.rows.trim() ? form.rows.split("\n").map((l) => l.split(",").map((x) => x.trim())).filter((c) => c[0]).map(([lenderLoanId, amount]) => ({ lenderLoanId, amount })) : undefined;
      call = () => request(session, `/group-life/credit-remittances/${form.ref}/receipts`, { method: "POST", body: { reference: form.reference, amount: form.amount, rows } });
      done = "Lender remittance recorded";
    }
    const r = await action.run(call, done);
    if (r) {
      if (form.kind === "bordereau" || form.kind === "updates") {
        setResult(r.data);
        notify?.(r.data.status === "REJECTED" ? `File rejected: ${r.data.reason}` : `File ${r.data.batchReference || r.data.fileReference} processed`);
      }
      setForm(null);
      reloadAll();
    }
  };
  const decideRefund = async (refund, approve) => {
    const note = window.prompt(`${approve ? "Approve" : "Reject"} refund ${refund.ref} — note:`);
    if (!note) return;
    const r = await action.run(() => request(session, `/group-life/credit-refunds/${refund.ref}/decision`, { method: "POST", body: { approve, note } }), approve ? "Refund approved" : "Refund rejected");
    if (r) reloadAll();
  };
  const payRefund = async (refund) => {
    const r = await action.run(() => request(session, `/group-life/credit-refunds/${refund.ref}/payment`, { method: "POST", body: { paymentReference: `SIM-${refund.ref}` } }), "Refund paid (simulated payout)");
    if (r) reloadAll();
  };
  const resolveException = async (e) => {
    const note = window.prompt(`Resolve ${label(e.type).toLowerCase()} — note:`);
    if (!note) return;
    const r = await action.run(() => request(session, `/group-life/credit-exceptions/${e.id}/resolution`, { method: "POST", body: { note } }), "Exception resolved");
    if (r) exceptions.reload();
  };
  const claimAction = async (c, act) => {
    const body = { action: act };
    if (act === "DECLINE") body.note = window.prompt("Decline reason:") || "";
    if (act === "PAY") body.paymentReference = `SIM-${c.ref}`;
    if (act === "RECOVER") {
      const v = window.prompt("Balance the lender confirms at the event date:");
      if (!v) return;
      body.confirmedBalance = v;
    }
    const r = await action.run(() => request(session, `/group-life/credit-claims/${c.ref}/decision`, { method: "POST", body }), `Claim ${label(act).toLowerCase()} recorded`);
    if (r) reloadAll();
  };

  const bordereauExample = () => {
    const cls = a?.classes?.[0]?.code || "PERSONAL";
    const d = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10);
    return [
      BORDEREAU_HEADER,
      `KM-${Date.now() % 100000}-1,Neo Molefe,123456789,1986-04-02,${cls},85000,24,${d},DEATH|DISABILITY|CRITICAL_ILLNESS|TEMPORARY_DISABILITY`,
      `KM-${Date.now() % 100000}-2,Kefilwe Dube,234567891,1979-08-19,${cls},600000,36,${d},DEATH|DISABILITY`,
    ].join("\n");
  };
  const fillTotals = (f, header, key) => {
    const rows = csvRows(f.rows, header);
    return { ...f, rowCount: String(rows.length), total: String(sum(rows, key)) };
  };

  return (
    <>
      <ErrorNote error={action.error} />
      <Panel
        title="Lender agreement"
        subtitle={a?.configured ? `${a.agreementNo} with ${a.lenderName || a.lenderRef || "the lender"} from ${day(a.effectiveFrom)}` : "No agreement saved: the demo defaults below apply until one is saved."}
        action={
          can(profile, "MANAGE_SCHEME") &&
          a && (
            <Button
              variant="secondary"
              icon={Pencil}
              onClick={() =>
                setForm({
                  kind: "agreement",
                  lenderRef: a.lenderRef || "",
                  agreementNo: a.agreementNo,
                  effectiveFrom: a.effectiveFrom,
                  premiumBasis: a.premiumBasis,
                  ratePerMille: a.ratePerMille,
                  balanceBasis: a.balanceBasis,
                  premiumTiming: a.premiumTiming,
                  overCapRule: a.overCapRule,
                  deathCap: a.deathCap,
                  ciCap: a.ciCap,
                  tdMonthlyCap: a.tdMonthlyCap,
                  refundMethod: a.refundMethod,
                  refundDeductionPercent: a.refundDeductionPercent,
                  commissionPercent: a.commissionPercent,
                  cededPercent: a.cededPercent,
                  classesText: (a.classes || []).map((c) => [c.code, c.name, c.maxTerm, c.maxAmount, c.benefits.join("|")].join(",")).join("\n"),
                })
              }
            >
              Edit agreement
            </Button>
          )
        }
      >
        <ErrorNote error={agreement.error} />
        {a && (
          <div className="ws-kv">
            <div><small>Premium</small><strong>{label(a.premiumBasis)} · {Number(a.ratePerMille)} ‰ / month · {label(a.balanceBasis)} balance · {label(a.premiumTiming)}</strong></div>
            <div><small>Caps</small><strong>Death/disability {pula(a.deathCap)} · CI {pula(a.ciCap)} · TD {pula(a.tdMonthlyCap)}/month × {a.tdMaxMonths}</strong></div>
            <div><small>Above the cap</small><strong>{a.overCapRule === "FAIL" ? "Refused" : "Referred to underwriting"}</strong></div>
            <div><small>Eligibility</small><strong>Ages {a.minAge}–{a.maxAge} (≤ {a.maxAgeAtEnd} at end) · term ≤ {a.maxTerm} months · notify within {a.notificationDays} days</strong></div>
            <div><small>Refund</small><strong>{label(a.refundMethod)} less {Number(a.refundDeductionPercent)}% · commission {Number(a.commissionPercent)}% · ceded {Number(a.cededPercent)}%</strong></div>
            <div><small>Remittance</small><strong>Monthly, due day {a.remittanceDay} · interface {a.interfaceVersions?.join(", ")}</strong></div>
          </div>
        )}
        {a?.classes?.length > 0 && (
          <DataTable
            rows={a.classes}
            rowKey={(c) => c.code}
            searchFrom={20}
            columns={[
              { key: "code", label: "Loan class", render: (c) => `${c.code} · ${c.name}` },
              { key: "maxTerm", label: "Max term", align: "right" },
              { key: "maxAmount", label: "Max amount", align: "right", render: (c) => pula(c.maxAmount) },
              { key: "benefits", label: "Benefits", render: (c) => c.benefits.map(label).join(", ") },
            ]}
          />
        )}
      </Panel>

      {form && (
        <Panel title={{ agreement: "Edit lender agreement", bordereau: "New-loan bordereau (interface 2.0)", updates: "Lender update file (interface 2.0)", remit: "Issue remittance statement", receipt: `Record lender remittance against ${form.ref}` }[form.kind]}>
          <FormGrid onSubmit={submit} busy={action.busy} error={action.error} submitLabel="Submit" extra={<Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancel</Button>}>
            {form.kind === "agreement" && (
              <>
                {[["lenderRef", "Lender party ref"], ["agreementNo", "Agreement number"], ["effectiveFrom", "Effective from"], ["ratePerMille", "Rate per mille (monthly)"], ["deathCap", "Death/disability cap"], ["ciCap", "Critical-illness cap"], ["tdMonthlyCap", "Temporary-disability cap / month"], ["refundDeductionPercent", "Refund deduction %"], ["commissionPercent", "Commission %"], ["cededPercent", "Ceded %"]].map(([k, l]) => (
                  <Field key={k} label={l}>
                    <input className="input" value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                  </Field>
                ))}
                {[["premiumBasis", ["SINGLE", "ANNUAL", "MONTHLY"]], ["balanceBasis", ["ORIGINAL", "OUTSTANDING"]], ["premiumTiming", ["IN_ADVANCE", "IN_ARREARS"]], ["overCapRule", ["REFER", "FAIL"]], ["refundMethod", ["PRO_RATA", "RULE_OF_78"]]].map(([k, opts]) => (
                  <Field key={k} label={label(k.replace(/([A-Z])/g, "_$1"))}>
                    <select className="select" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })}>
                      {opts.map((o) => (
                        <option key={o} value={o}>{label(o)}</option>
                      ))}
                    </select>
                  </Field>
                ))}
                <Field label="Loan classes: code, name, max term, max amount, benefits (| separated)" full>
                  <textarea className="textarea ws-mono" rows={3} value={form.classesText} onChange={(e) => setForm({ ...form, classesText: e.target.value })} />
                </Field>
              </>
            )}
            {(form.kind === "bordereau" || form.kind === "updates") && (
              <>
                <Field label="File reference" hint="The same reference again is idempotent.">
                  <input className="input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} required />
                </Field>
                <Field label="Control totals: rows / total" hint={form.kind === "bordereau" ? "Total loan amount, as the lender declares it" : "Total balance, as the lender declares it"}>
                  <div className="ws-row-actions">
                    <input className="input" value={form.rowCount} onChange={(e) => setForm({ ...form, rowCount: e.target.value })} aria-label="Row count" />
                    <input className="input" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} aria-label="Control total" />
                    <Button type="button" variant="secondary" onClick={() => setForm(fillTotals(form, form.kind === "bordereau" ? BORDEREAU_HEADER : UPDATE_HEADER, form.kind === "bordereau" ? "loanAmount" : "balance"))}>
                      From rows
                    </Button>
                  </div>
                </Field>
                <Field label={form.kind === "bordereau" ? BORDEREAU_HEADER : `${UPDATE_HEADER} — type BALANCE, REPAYMENT, ARREARS, SETTLEMENT or CANCELLATION`} full>
                  <textarea className="textarea ws-mono" rows={5} value={form.rows} onChange={(e) => setForm({ ...form, rows: e.target.value })} required />
                </Field>
              </>
            )}
            {form.kind === "remit" && (
              <Field label="Remittance month" hint="Every instalment due by the month's end is billed once.">
                <input className="input" type="month" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} required />
              </Field>
            )}
            {form.kind === "receipt" && (
              <>
                <Field label="Lender reference">
                  <input className="input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} required />
                </Field>
                <Field label="Amount remitted">
                  <input className="input" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                </Field>
                <Field label="Lender's remittance rows (optional): lenderLoanId, amount" full>
                  <textarea className="textarea ws-mono" rows={3} value={form.rows} onChange={(e) => setForm({ ...form, rows: e.target.value })} />
                </Field>
              </>
            )}
          </FormGrid>
        </Panel>
      )}

      <Panel
        title="Loans and certificates"
        subtitle="Each borrower's loan under the master contract. Referred rows are not on cover until an underwriter accepts them."
        action={
          <div className="ws-row-actions">
            {can(profile, "PROCESS_CENSUS") && (
              <Button icon={FileUp} onClick={() => setForm({ kind: "bordereau", reference: `BDX-${today}`, rows: bordereauExample(), rowCount: "", total: "" })}>
                New-loan bordereau
              </Button>
            )}
            {can(profile, "PROCESS_CENSUS") && (
              <Button variant="secondary" icon={FileUp} onClick={() => setForm({ kind: "updates", reference: `UPD-${today}`, rows: UPDATE_HEADER + "\n", rowCount: "", total: "" })}>
                Lender update file
              </Button>
            )}
          </div>
        }
      >
        <ErrorNote error={loans.error} />
        {result && (
          <div className="ga-status-note" role="status">
            {result.status === "REJECTED" ? (
              <>File {result.batchReference || result.fileReference} rejected: {result.reason}</>
            ) : (
              <>
                File {result.batchReference || result.fileReference}
                {result.repeated ? " (repeated)" : ""}: {result.accepted ?? result.applied ?? 0} applied, {result.referred ?? 0} referred, {result.duplicates ?? 0} duplicate(s), {result.rejected ?? result.exceptions ?? 0} rejected/exceptions.{" "}
                {(result.results || []).filter((r) => r.note).map((r) => `${r.lenderLoanId}: ${r.outcome} — ${r.note}`).join(" · ")}
              </>
            )}{" "}
            <Button variant="secondary" onClick={() => setResult(null)}>Dismiss</Button>
          </div>
        )}
        <DataTable
          rows={loans.data}
          loading={loans.loading}
          rowKey={(l) => l.id}
          empty="No loans on this scheme yet"
          emptyDetail="Submit the lender's new-loan bordereau to register loans."
          onRowClick={(l) => setLoan(l.id)}
          columns={[
            { key: "certificateNo", label: "Certificate", render: (l) => <span className="ws-mono">{l.certificateNo}</span> },
            { key: "borrowerName", label: "Borrower" },
            { key: "loanClass", label: "Class", render: (l) => l.loanClass || "—" },
            { key: "loanAmount", label: "Loan", align: "right", render: (l) => pula(l.loanAmount) },
            { key: "coverAmount", label: "Cover", align: "right", render: (l) => pula(l.coverAmount) },
            { key: "balance", label: "Balance", align: "right", render: (l) => (l.balance != null ? pula(l.balance) : "—") },
            { key: "premium", label: "Premium", align: "right", render: (l) => `${pula(l.premium)} ${label(l.premiumBasis).toLowerCase()}` },
            { key: "status", label: "Status", render: (l) => <span title={l.note || ""}><Badge tone={LOAN_TONES[l.status]}>{label(l.status)}</Badge></span> },
            { key: "refundStatus", label: "Refund", render: (l) => (l.refundRef ? `${l.refundRef} ${label(l.refundStatus).toLowerCase()}` : "—") },
          ]}
        />
      </Panel>

      <Panel
        title="Premium remittance"
        subtitle="The lender's premium statements: the premium receivable, kept apart from the loan balances the lender reports."
        action={can(profile, "BILL_SCHEME") && <Button icon={Landmark} onClick={() => setForm({ kind: "remit", period: today.slice(0, 7) })}>Issue statement</Button>}
      >
        <DataTable
          rows={remittances.data}
          loading={remittances.loading}
          rowKey={(r) => r.ref}
          searchFrom={20}
          empty="No remittance statements yet"
          columns={[
            { key: "ref", label: "Statement", render: (r) => <span className="ws-mono">{r.ref}</span> },
            { key: "period", label: "Period" },
            { key: "installments", label: "Instalments", align: "right" },
            { key: "amount", label: "Premium", align: "right", render: (r) => pula(r.amount) },
            { key: "commission", label: "Commission", align: "right", render: (r) => pula(r.commission) },
            { key: "ceded", label: "Ceded", align: "right", render: (r) => pula(r.ceded) },
            { key: "outstanding", label: "Outstanding", align: "right", render: (r) => pula(r.outstanding) },
            { key: "status", label: "Status", render: (r) => <span title={r.reconciliation || ""}><Badge tone={r.status === "PAID" ? "green" : "amber"}>{label(r.status)}</Badge></span> },
            ...(can(profile, "BILL_SCHEME") ? [{ key: "act", label: "", render: (r) => (Number(r.outstanding) > 0 ? <Button variant="secondary" icon={HandCoins} onClick={() => setForm({ kind: "receipt", ref: r.ref, reference: "", amount: String(r.outstanding), rows: "" })}>Record remittance</Button> : r.reconciliation || null) }] : []),
          ]}
        />
      </Panel>

      <Panel title="Refunds" subtitle="Early-settlement and cancellation refunds: one per loan, approved by a second person, then paid.">
        <DataTable
          rows={refunds.data}
          loading={refunds.loading}
          rowKey={(r) => r.ref}
          searchFrom={20}
          empty="No refunds"
          columns={[
            { key: "ref", label: "Refund", render: (r) => <span className="ws-mono">{r.ref}</span> },
            { key: "reason", label: "Reason", render: (r) => label(r.reason) },
            { key: "effectiveDate", label: "Effective", render: (r) => day(r.effectiveDate) },
            { key: "formula", label: "Formula" },
            { key: "refundAmount", label: "Refund", align: "right", render: (r) => pula(r.refundAmount) },
            { key: "reversals", label: "Commission / RI reversed", align: "right", render: (r) => `${pula(r.commissionReversal)} / ${pula(r.reinsuranceReversal)}` },
            { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "PAID" ? "green" : r.status === "REJECTED" ? "red" : "amber"}>{label(r.status)}</Badge> },
            ...(can(profile, "BILL_SCHEME")
              ? [{ key: "act", label: "", render: (r) =>
                  r.status === "PENDING" && r.requestedBy !== session?.username ? (
                    <div className="ws-row-actions">
                      <Button icon={Check} onClick={() => decideRefund(r, true)}>Approve</Button>
                      <Button variant="secondary" onClick={() => decideRefund(r, false)}>Reject</Button>
                    </div>
                  ) : r.status === "PENDING" ? <span className="ga-muted">Another person approves</span>
                  : r.status === "APPROVED" ? <Button variant="secondary" onClick={() => payRefund(r)}>Pay (simulated)</Button> : r.paymentReference || null }]
              : []),
          ]}
        />
      </Panel>

      <Panel title="Claims" subtitle="Benefits under the scheme caps, paid to the lender up to the balance; any excess to the borrower or estate.">
        <DataTable
          rows={claims.data}
          loading={claims.loading}
          rowKey={(c) => c.ref}
          searchFrom={20}
          empty="No credit claims"
          columns={[
            { key: "ref", label: "Claim", render: (c) => <span className="ws-mono">{c.ref}</span> },
            { key: "benefit", label: "Benefit", render: (c) => label(c.benefit) },
            { key: "eventDate", label: "Event", render: (c) => day(c.eventDate) },
            { key: "calculation", label: "Calculation" },
            { key: "benefitAmount", label: "Benefit", align: "right", render: (c) => pula(c.benefitAmount) },
            { key: "split", label: "Lender / borrower", align: "right", render: (c) => `${pula(c.lenderAmount)} / ${pula(c.borrowerAmount)}` },
            { key: "status", label: "Status", render: (c) => <span title={c.note || ""}><Badge tone={c.status === "PAID" ? "green" : c.status === "DECLINED" ? "red" : "amber"}>{label(c.status)}</Badge>{c.recoveryStatus ? ` · recovery ${pula(c.recoveryAmount)} ${label(c.recoveryStatus).toLowerCase()}` : ""}</span> },
            { key: "act", label: "", render: (c) => (
              <div className="ws-row-actions">
                {c.status === "NOTIFIED" && can(profile, "APPROVE_CLAIM") && c.notifiedBy !== session?.username && <Button icon={ShieldCheck} onClick={() => claimAction(c, "APPROVE")}>Approve</Button>}
                {c.status === "NOTIFIED" && can(profile, "ASSESS_CLAIM") && <Button variant="secondary" onClick={() => claimAction(c, "DECLINE")}>Decline</Button>}
                {c.status === "APPROVED" && can(profile, "SETTLE_CLAIM") && <Button onClick={() => claimAction(c, "PAY")}>Pay (simulated)</Button>}
                {c.status === "PAID" && !c.recoveryStatus && can(profile, "SETTLE_CLAIM") && <Button variant="secondary" onClick={() => claimAction(c, "RECOVER")}>Check recovery</Button>}
              </div>
            ) },
          ]}
        />
      </Panel>

      <Panel title="Lender data exceptions" subtitle="Unknown loans, arrears, balance anomalies, remittance mismatches and stale or missing balances; kept until resolved.">
        <DataTable
          rows={exceptions.data}
          loading={exceptions.loading}
          rowKey={(e) => e.id}
          searchFrom={20}
          empty="No exceptions"
          columns={[
            { key: "type", label: "Type", render: (e) => label(e.type) },
            { key: "lenderLoanId", label: "Loan", render: (e) => e.lenderLoanId || "—" },
            { key: "detail", label: "Detail" },
            { key: "fileReference", label: "File", render: (e) => e.fileReference || "—" },
            { key: "status", label: "Status", render: (e) => <Badge tone={e.status === "OPEN" ? "amber" : "green"}>{label(e.status)}</Badge> },
            { key: "raisedAt", label: "Raised", render: (e) => when(e.raisedAt) },
            ...(can(profile, "PROCESS_CENSUS") ? [{ key: "act", label: "", render: (e) => (e.status === "OPEN" ? <Button variant="secondary" onClick={() => resolveException(e)}>Resolve</Button> : e.resolutionNote || null) }] : []),
          ]}
        />
      </Panel>

      {loan && <LoanDrawer session={session} notify={notify} profile={profile} loanId={loan} onClose={() => setLoan(null)} onChange={reloadAll} />}
    </>
  );
}

/** A loan's certificate view: history, premium schedule, settlement preview, referral decision and claim notice. */
function LoanDrawer({ session, notify, profile, loanId, onClose, onChange }) {
  const loan = useResource(session, `/group-life/credit-loans/${loanId}`);
  const action = useAction(inlineErrors(notify));
  const [form, setForm] = useState(null);
  const [preview, setPreview] = useState(null);
  const l = loan.data;
  const today = new Date().toISOString().slice(0, 10);
  const refresh = () => {
    loan.reload();
    onChange();
  };
  const run = async () => {
    let call;
    if (form.kind === "uw") call = () => request(session, `/group-life/credit-loans/${loanId}/underwriting`, { method: "POST", body: { decision: form.decision, coverAmount: form.coverAmount, note: form.note } });
    if (form.kind === "settle") call = () => request(session, `/group-life/credit-loans/${loanId}/settlement`, { method: "POST", body: { settlementDate: form.date } });
    if (form.kind === "claim") call = () => request(session, `/group-life/credit-loans/${loanId}/claims`, { method: "POST", body: { benefit: form.benefit, eventDate: form.eventDate, balanceAtEvent: form.balanceAtEvent || undefined, monthlyInstalment: form.monthlyInstalment || undefined, months: form.months || undefined, note: form.note || undefined } });
    const r = await action.run(call, form.kind === "uw" ? "Decision recorded" : form.kind === "settle" ? "Cover closed; refund awaits approval" : "Claim notified");
    if (r) {
      setForm(null);
      setPreview(null);
      refresh();
    }
  };
  const showPreview = async (date) => {
    const r = await action.run(() => request(session, `/group-life/credit-loans/${loanId}/settlement?settlementDate=${date}`));
    if (r) setPreview(r.data);
  };
  return (
    <Drawer size="lg" title={l ? `${l.certificateNo} · ${l.borrowerName}` : "Loan"} description={l ? `${pula(l.loanAmount)} over ${l.termMonths} months from ${day(l.disbursementDate)} · ${l.benefits.map(label).join(", ")}` : undefined} onClose={onClose}>
      <ErrorNote error={loan.error || action.error} />
      {l && (
        <>
          <div className="ws-kv">
            <div><small>Status</small><strong><Badge tone={LOAN_TONES[l.status]}>{label(l.status)}</Badge></strong></div>
            <div><small>Cover</small><strong>{pula(l.coverAmount)} to {day(l.coverEndDate)}</strong></div>
            <div><small>Balance</small><strong>{l.balance != null ? `${pula(l.balance)} at ${day(l.balanceDate)}` : "—"}</strong></div>
            <div><small>Borrower</small><strong>{l.borrowerIdNumber || "—"} · born {day(l.dateOfBirth)}</strong></div>
          </div>
          {l.note && <p className="subtitle">{l.note}</p>}
          <div className="ws-row-actions">
            {l.status === "REFERRED" && can(profile, "UNDERWRITE_MEMBER") && <Button icon={ShieldCheck} onClick={() => setForm({ kind: "uw", decision: "ACCEPT", coverAmount: String(l.coverAmount), note: "" })}>Underwriting decision</Button>}
            {l.status === "ACTIVE" && can(profile, "BILL_SCHEME") && <Button variant="secondary" onClick={() => { setForm({ kind: "settle", date: today }); showPreview(today); }}>Settle early</Button>}
            {["ACTIVE", "SETTLED"].includes(l.status) && can(profile, "CREATE_CLAIM") && <Button variant="secondary" onClick={() => setForm({ kind: "claim", benefit: l.benefits[0], eventDate: today, balanceAtEvent: "", monthlyInstalment: "", months: "", note: "" })}>Notify claim</Button>}
          </div>
          {form && (
            <FormGrid onSubmit={run} busy={action.busy} error={action.error} submitLabel="Submit" extra={<Button type="button" variant="secondary" onClick={() => { setForm(null); setPreview(null); }}>Cancel</Button>}>
              {form.kind === "uw" && (
                <>
                  <Field label="Decision">
                    <select className="select" value={form.decision} onChange={(e) => setForm({ ...form, decision: e.target.value })}>
                      <option value="ACCEPT">Accept</option>
                      <option value="DECLINE">Decline</option>
                    </select>
                  </Field>
                  {form.decision === "ACCEPT" && (
                    <Field label="Accepted cover">
                      <input className="input" type="number" value={form.coverAmount} onChange={(e) => setForm({ ...form, coverAmount: e.target.value })} />
                    </Field>
                  )}
                  <Field label="Note" full>
                    <textarea className="textarea" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} required />
                  </Field>
                </>
              )}
              {form.kind === "settle" && (
                <Field label="Settlement date" hint={preview ? `Refund ${pula(preview.refundPreview)}: ${preview.formula || ""}` : "Previewing…"}>
                  <input className="input" type="date" value={form.date} onChange={(e) => { setForm({ ...form, date: e.target.value }); showPreview(e.target.value); }} required />
                </Field>
              )}
              {form.kind === "claim" && (
                <>
                  <Field label="Benefit">
                    <select className="select" value={form.benefit} onChange={(e) => setForm({ ...form, benefit: e.target.value })}>
                      {l.benefits.map((b) => (
                        <option key={b} value={b}>{label(b)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Event date">
                    <input className="input" type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} required />
                  </Field>
                  <Field label="Balance at the event (lender-confirmed)" hint="Empty uses the latest reported balance.">
                    <input className="input" type="number" value={form.balanceAtEvent} onChange={(e) => setForm({ ...form, balanceAtEvent: e.target.value })} />
                  </Field>
                  {form.benefit === "TEMPORARY_DISABILITY" && (
                    <>
                      <Field label="Monthly instalment">
                        <input className="input" type="number" value={form.monthlyInstalment} onChange={(e) => setForm({ ...form, monthlyInstalment: e.target.value })} />
                      </Field>
                      <Field label="Months off work">
                        <input className="input" type="number" value={form.months} onChange={(e) => setForm({ ...form, months: e.target.value })} />
                      </Field>
                    </>
                  )}
                </>
              )}
            </FormGrid>
          )}
          <h3 className="ga-subhead">Cover history</h3>
          <DataTable
            rows={l.history}
            rowKey={(e, i) => `${e.type}-${i}`}
            searchFrom={30}
            empty="No history"
            columns={[
              { key: "effectiveDate", label: "Date", render: (e) => day(e.effectiveDate) },
              { key: "type", label: "Event", render: (e) => label(e.type) },
              { key: "coverAmount", label: "Cover", align: "right", render: (e) => (e.coverAmount != null ? pula(e.coverAmount) : "—") },
              { key: "balance", label: "Balance", align: "right", render: (e) => (e.balance != null ? pula(e.balance) : "—") },
              { key: "detail", label: "Detail" },
              { key: "sourceRef", label: "Source", render: (e) => e.sourceRef || "—" },
            ]}
          />
          <h3 className="ga-subhead">Premium schedule</h3>
          <DataTable
            rows={l.premiums}
            rowKey={(p) => p.installmentNo}
            searchFrom={30}
            empty="No premium due (not on cover)"
            columns={[
              { key: "installmentNo", label: "#", align: "right" },
              { key: "dueDate", label: "Due", render: (p) => day(p.dueDate) },
              { key: "period", label: "Covers", render: (p) => `${day(p.periodFrom)} – ${day(p.periodTo)}` },
              { key: "basisAmount", label: "On", align: "right", render: (p) => pula(p.basisAmount) },
              { key: "amount", label: "Premium", align: "right", render: (p) => pula(p.amount) },
              { key: "status", label: "Status", render: (p) => `${label(p.status)}${p.remittanceRef ? ` · ${p.remittanceRef}` : ""}` },
            ]}
          />
        </>
      )}
    </Drawer>
  );
}
