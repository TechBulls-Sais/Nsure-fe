import React, { useState } from "react";
import { Check, HandCoins, ShieldAlert } from "lucide-react";
import { request } from "./api";
import { Badge, Button, DataTable, Drawer, ErrorNote, Field, FormGrid, Panel, can, pula, useAction, useResource, when } from "./ui/workspace";

// Group billing and membership pieces (GL04/GL05): held census rows and their review, member cover history,
// supplementary adjustments on an invoice, the sponsor account (lump-sum payments, held money, exceptions, arrears
// and lapse) and the cross-scheme billing exceptions queue. Everything reads and writes through /group/**.

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
const STAGE_TONES = { DUE: "blue", IN_GRACE: "amber", GRACE_EXPIRED: "red", UP_TO_DATE: "green" };
const PAYMENT_TONES = { ALLOCATED: "green", PARTLY_ALLOCATED: "amber", UNALLOCATED: "red" };

/** The census template file built from the server's published template (NS-GL04-001). */
export async function downloadCensusTemplate(session, schemeRef, categories, save) {
  const { data } = await request(session, "/group/census-template");
  const codes = categories.map((c) => c.code);
  const first = codes[0] || "STAFF";
  const other = codes[1] || first;
  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    data.header,
    `EMP-1001,Kagiso,Sebina,1988-04-12,${first},180000,JOIN,${today},Y,${today},HR-1,123456789,MEMBER,`,
    `EMP-1002,Naledi,Kgosi,1992-09-03,${other},240000,JOIN,${today},Y,,HR-2,,MEMBER,`,
    `EMP-0999,,,,,,LEAVE,${today},,,HR-3,,,`,
    `EMP-0998,,,,,210000,SALARY,${today},Y,,HR-4,,,`,
    `EMP-0997,,,,${other},,CATEGORY,${today},Y,,HR-5,,,`,
  ];
  save(`census-template-v${data.version}-${schemeRef}.csv`, lines.join("\n") + "\n");
}

/** The authorised review of a held census row (AT-GL04-03): apply or reject, with a note. */
export function HeldRowReview({ session, notify, batch, row, onDone, onCancel }) {
  const [form, setForm] = useState({ decision: "APPLY", note: "" });
  const action = useAction(inlineErrors(notify));
  const submit = async () => {
    const r = await action.run(
      () => request(session, `/group/census-batches/${batch.ref}/rows/${row.lineNo}/review`, { method: "POST", body: form }),
      form.decision === "APPLY" ? `Line ${row.lineNo} released` : `Line ${row.lineNo} rejected`,
    );
    if (r) onDone(r.data);
  };
  return (
    <section className="ga-drawer-section ga-review">
      <h3>Review line {row.lineNo} · {row.memberKey}</h3>
      <p className="subtitle">{row.holdReason}</p>
      <FormGrid
        onSubmit={submit}
        busy={action.busy}
        error={action.error}
        submitLabel={form.decision === "APPLY" ? (batch.status === "COMMITTED" ? "Apply the row now" : "Release for commit") : "Reject the row"}
        extra={
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        }
      >
        <Field label="Decision">
          <select className="select" value={form.decision} onChange={(e) => setForm({ ...form, decision: e.target.value })}>
            <option value="APPLY">Apply — the change stands</option>
            <option value="REJECT">Reject — do not apply</option>
          </select>
        </Field>
        <Field label="Review note" full hint="Recorded with the row; you cannot review a batch you submitted.">
          <textarea className="textarea" rows={2} maxLength={300} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} required />
        </Field>
      </FormGrid>
    </section>
  );
}

/** A member's effective-dated cover periods (NS-GL04-004). */
export function CoverHistoryDrawer({ session, member, onClose }) {
  const history = useResource(session, `/group/members/${member.id}/cover-history`, []);
  return (
    <Drawer size="lg" title={`Cover history · ${member.name}`} description={`${member.memberKey} · each change closes the period before it; earlier terms are never overwritten.`} onClose={onClose}>
      <ErrorNote error={history.error} />
      <DataTable
        rows={history.data}
        loading={history.loading}
        rowKey={(p, i) => `${p.validFrom}-${p.changeId}-${i}`}
        searchFrom={50}
        empty="No cover periods"
        columns={[
          { key: "validFrom", label: "From", render: (p) => day(p.validFrom) },
          { key: "validTo", label: "To", render: (p) => (p.validTo ? day(p.validTo) : "Open") },
          { key: "changeType", label: "Change", render: (p) => label(p.changeType) },
          { key: "category", label: "Category" },
          { key: "salary", label: "Salary", align: "right", render: (p) => (p.salary != null ? pula(p.salary) : "—") },
          { key: "acceptedCover", label: "Accepted", align: "right", render: (p) => pula(p.acceptedCover) },
          { key: "pendingCover", label: "Pending", align: "right", render: (p) => (Number(p.pendingCover) > 0 ? pula(p.pendingCover) : "—") },
          { key: "status", label: "Status", render: (p) => (p.superseded ? <Badge>Superseded</Badge> : <Badge tone="green">{label(p.status)}</Badge>) },
        ]}
      />
    </Drawer>
  );
}

/** Supplementary adjustments on an invoice (NS-GL05-002), each line against the original invoice line. */
export function AdjustmentsSection({ invoice }) {
  if (!invoice.adjustments?.length) return null;
  return (
    <section className="ga-drawer-section">
      <h3>Supplementary adjustments</h3>
      <p className="subtitle">
        The issued invoice is never edited. Backdated changes are billed or credited here; net {pula(invoice.adjustmentAmount)} on the balance.
      </p>
      {invoice.adjustments.map((a) => (
        <div key={a.ref} className="ga-adjustment">
          <p>
            <span className="ws-mono">{a.ref}</span> <Badge tone={a.type === "DEBIT" ? "amber" : "green"}>{label(a.type)}</Badge> {pula(a.amount)} ·{" "}
            {a.reason} · {when(a.issuedAt)} by {a.issuedBy}
            {Number(a.heldAsCredit) > 0 && <> · {pula(a.heldAsCredit)} held as credit for the sponsor</>}
          </p>
          <DataTable
            rows={a.lines}
            rowKey={(l) => `${a.ref}-${l.memberId}`}
            searchFrom={30}
            empty="No lines"
            columns={[
              { key: "memberName", label: "Member", render: (l) => `${l.memberName} · ${l.memberKey}` },
              { key: "changeType", label: "Change", render: (l) => label(l.changeType) },
              { key: "originalLineId", label: "Original line", render: (l) => (l.originalLineId ? `#${l.originalLineId}` : "Not on invoice") },
              { key: "daysCovered", label: "Days", align: "right" },
              { key: "billedBefore", label: "Billed", align: "right", render: (l) => pula(l.billedBefore) },
              { key: "recalculated", label: "Now earned", align: "right", render: (l) => pula(l.recalculated) },
              { key: "amount", label: "Adjustment", align: "right", render: (l) => <strong className={Number(l.amount) < 0 ? "ga-good" : "ga-bad"}>{pula(l.amount)}</strong> },
            ]}
          />
        </div>
      ))}
    </section>
  );
}

const parsePairs = (text, key) =>
  text
    .split("\n")
    .map((line) => line.split(",").map((x) => x.trim()))
    .filter((c) => c.length >= 2 && c[0])
    .map(([ref, amount]) => ({ [key]: ref, amount }));

/** The sponsor account (GL05): arrears stage, lump-sum payments, held money, exceptions and lapse. */
export function SponsorAccountPanel({ session, notify, profile, scheme, onChange }) {
  const bill = can(profile, "BILL_SCHEME");
  const decide = can(profile, "UNDERWRITE_MEMBER");
  const account = useResource(session, `/group/schemes/${encodeURIComponent(scheme.ref)}/sponsor-account`);
  const [form, setForm] = useState(null);
  const [lapse, setLapse] = useState(null); // { kind: "propose" | "decide", ref?, note, approve }
  const [held, setHeld] = useState(null); // { payment, invoiceRef, amount }
  const action = useAction(inlineErrors(notify));
  const a = account.data;
  const refresh = () => {
    account.reload();
    onChange?.();
  };

  const pay = async () => {
    const body = { reference: form.reference, amount: form.amount, rule: form.rule, note: form.note || undefined };
    if (form.rule === "INVOICES") body.invoices = parsePairs(form.lines, "invoiceRef");
    if (form.rule === "MEMBERS") body.members = parsePairs(form.lines, "memberKey");
    const r = await action.run(() => request(session, `/group/schemes/${scheme.ref}/sponsor-payments`, { method: "POST", body }));
    if (r) {
      notify?.(
        Number(r.data.unallocated) > 0
          ? `Payment ${r.data.ref}: ${pula(r.data.allocated)} allocated, ${pula(r.data.unallocated)} held unallocated`
          : `Payment ${r.data.ref} allocated in full`,
      );
      setForm(null);
      refresh();
    }
  };
  const allocateHeld = async () => {
    const r = await action.run(
      () => request(session, `/group/sponsor-payments/${held.payment.ref}/allocations`, { method: "POST", body: { invoiceRef: held.invoiceRef, amount: held.amount || undefined } }),
      "Held money allocated",
    );
    if (r) {
      setHeld(null);
      refresh();
    }
  };
  const resolve = async (e) => {
    const note = window.prompt(`Resolve ${label(e.type).toLowerCase()} — note:`);
    if (!note) return;
    const r = await action.run(() => request(session, `/group/billing-exceptions/${e.id}/resolution`, { method: "POST", body: { note } }), "Exception resolved");
    if (r) refresh();
  };
  const submitLapse = async () => {
    if (lapse.kind === "propose") {
      const r = await action.run(() => request(session, `/group/schemes/${scheme.ref}/lapse`, { method: "POST", body: { note: lapse.note } }));
      if (r) {
        notify?.(r.data.outcome === "ESCALATED" ? "Escalated: resolve disputes and unallocated money before a lapse" : `Lapse ${r.data.lapse.ref} proposed for a second person`);
        setLapse(null);
        refresh();
      }
      return;
    }
    const r = await action.run(
      () => request(session, `/group/scheme-lapses/${lapse.ref}/decision`, { method: "POST", body: { approve: lapse.approve, note: lapse.note } }),
      lapse.approve ? "Lapse decided" : "Lapse rejected",
    );
    if (r) {
      setLapse(null);
      refresh();
    }
  };

  const pending = a?.lapses?.find((l) => l.status === "PROPOSED");
  return (
    <Panel
      title="Sponsor account"
      subtitle={`Lump-sum remittances, money held unallocated, billing exceptions and arrears. Grace period ${a?.graceDays ?? 30} days after the invoice month (demo rule).`}
      action={
        bill && (
          <div className="ws-row-actions">
            <Button icon={HandCoins} onClick={() => setForm({ reference: "", amount: "", rule: "OLDEST_FIRST", lines: "", note: "" })}>
              Record sponsor payment
            </Button>
            {a?.stage === "GRACE_EXPIRED" && !pending && scheme.status === "ACTIVE" && (
              <Button variant="secondary" icon={ShieldAlert} onClick={() => setLapse({ kind: "propose", note: "" })}>
                Propose lapse
              </Button>
            )}
          </div>
        )
      }
    >
      <ErrorNote error={account.error || action.error} />
      {a && (
        <div className="ws-kv">
          <div>
            <small>Arrears stage</small>
            <strong>
              <Badge tone={STAGE_TONES[a.stage]}>{label(a.stage)}</Badge>
            </strong>
          </div>
          <div>
            <small>Arrears</small>
            <strong className={Number(a.arrears) > 0 ? "ga-bad" : ""}>{pula(a.arrears)}</strong>
          </div>
          <div>
            <small>Paid to</small>
            <strong>{day(a.paidToDate)}</strong>
          </div>
          <div>
            <small>Before any lapse</small>
            <strong>{a.blockers.length ? a.blockers.join("; ") : "Nothing to resolve"}</strong>
          </div>
        </div>
      )}
      {form && (
        <FormGrid onSubmit={pay} busy={action.busy} error={action.error} submitLabel="Allocate payment" extra={<Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancel</Button>}>
          <Field label="Payer reference" hint="The same reference again returns the payment already taken.">
            <input className="input" value={form.reference} maxLength={80} onChange={(e) => setForm({ ...form, reference: e.target.value })} required />
          </Field>
          <Field label="Amount (BWP)">
            <input className="input" type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </Field>
          <Field label="Allocation rule" hint="Anything that cannot be allocated is held, never applied to cover.">
            <select className="select" value={form.rule} onChange={(e) => setForm({ ...form, rule: e.target.value })}>
              <option value="OLDEST_FIRST">Oldest invoice first (disputed lines left open)</option>
              <option value="INVOICES">Named invoices</option>
              <option value="MEMBERS">By member (sponsor's contribution schedule)</option>
            </select>
          </Field>
          {form.rule !== "OLDEST_FIRST" && (
            <Field label={form.rule === "INVOICES" ? "Invoice, amount — one per line" : "Member key, amount — one per line"} full>
              <textarea className="textarea ws-mono" rows={3} value={form.lines} placeholder={form.rule === "INVOICES" ? "GIN-00001,1200.00" : "OH-1001,135.00"} onChange={(e) => setForm({ ...form, lines: e.target.value })} required />
            </Field>
          )}
        </FormGrid>
      )}
      {held && (
        <FormGrid onSubmit={allocateHeld} busy={action.busy} error={action.error} submitLabel={`Allocate from ${held.payment.ref}`} extra={<Button type="button" variant="secondary" onClick={() => setHeld(null)}>Cancel</Button>}>
          <Field label="Invoice">
            <select className="select" value={held.invoiceRef} onChange={(e) => setHeld({ ...held, invoiceRef: e.target.value })} required>
              <option value="">Choose an open invoice</option>
              {(a?.openInvoices || []).map((i) => (
                <option key={i.invoiceRef} value={i.invoiceRef}>
                  {i.invoiceRef} · {i.period} · {pula(i.outstanding)} open
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount" hint={`Up to ${pula(held.payment.unallocated)} held`}>
            <input className="input" type="number" min="0.01" step="0.01" value={held.amount} onChange={(e) => setHeld({ ...held, amount: e.target.value })} />
          </Field>
        </FormGrid>
      )}
      {lapse && (
        <FormGrid onSubmit={submitLapse} busy={action.busy} error={action.error} submitLabel={lapse.kind === "propose" ? "Propose lapse" : lapse.approve ? "Approve lapse" : "Reject lapse"} extra={<Button type="button" variant="secondary" onClick={() => setLapse(null)}>Cancel</Button>}>
          {lapse.kind === "decide" && (
            <Field label="Decision">
              <select className="select" value={lapse.approve ? "yes" : "no"} onChange={(e) => setLapse({ ...lapse, approve: e.target.value === "yes" })}>
                <option value="yes">Approve — cover ends at the paid-to date</option>
                <option value="no">Reject — keep the scheme in force</option>
              </select>
            </Field>
          )}
          <Field label="Note" full>
            <textarea className="textarea" rows={2} maxLength={300} value={lapse.note} onChange={(e) => setLapse({ ...lapse, note: e.target.value })} required />
          </Field>
        </FormGrid>
      )}
      {pending && (
        <p className="ga-status-note" role="status">
          Lapse {pending.ref} proposed by {pending.proposedBy}: {pending.memberContinuity} Arrears {pula(pending.arrearsAmount)}.{" "}
          {decide && pending.proposedBy !== session?.username && (
            <Button variant="secondary" onClick={() => setLapse({ kind: "decide", ref: pending.ref, approve: true, note: "" })}>
              Decide
            </Button>
          )}
        </p>
      )}
      <h3 className="ga-subhead">Open invoices</h3>
      <DataTable
        rows={a?.openInvoices}
        loading={account.loading}
        rowKey={(i) => i.invoiceRef}
        searchFrom={20}
        empty="Nothing owed"
        columns={[
          { key: "invoiceRef", label: "Invoice", render: (i) => <span className="ws-mono">{i.invoiceRef}</span> },
          { key: "period", label: "Period" },
          { key: "outstanding", label: "Outstanding", align: "right", render: (i) => pula(i.outstanding) },
          { key: "disputed", label: "Disputed", align: "right", render: (i) => (Number(i.disputed) > 0 ? pula(i.disputed) : "—") },
          { key: "dueDate", label: "Due", render: (i) => day(i.dueDate) },
          { key: "graceEnds", label: "Grace ends", render: (i) => day(i.graceEnds) },
          { key: "stage", label: "Stage", render: (i) => <Badge tone={STAGE_TONES[i.stage]}>{label(i.stage)}</Badge> },
        ]}
      />
      <h3 className="ga-subhead">Sponsor payments and held credit</h3>
      <DataTable
        rows={a?.payments}
        loading={account.loading}
        rowKey={(p) => p.ref}
        searchFrom={20}
        empty="No sponsor payments recorded"
        columns={[
          { key: "ref", label: "Payment", render: (p) => <span className="ws-mono">{p.ref}</span> },
          { key: "reference", label: "Payer ref" },
          { key: "kind", label: "Kind", render: (p) => (p.kind === "CREDIT_NOTE" ? "Held credit" : label(p.rule)) },
          { key: "amount", label: "Amount", align: "right", render: (p) => pula(p.amount) },
          { key: "allocations", label: "Allocated to", render: (p) => (p.allocations.length ? p.allocations.map((x) => `${x.invoiceRef} ${pula(x.amount)}`).join(", ") : "—") },
          { key: "unallocated", label: "Held", align: "right", render: (p) => (Number(p.unallocated) > 0 ? <strong className="ga-bad">{pula(p.unallocated)}</strong> : "—") },
          { key: "status", label: "Status", render: (p) => <span title={p.unmatched || ""}><Badge tone={PAYMENT_TONES[p.status]}>{label(p.status)}</Badge></span> },
          ...(bill
            ? [{ key: "act", label: "", render: (p) => (Number(p.unallocated) > 0 ? <Button variant="secondary" onClick={() => setHeld({ payment: p, invoiceRef: "", amount: "" })}>Allocate held</Button> : null) }]
            : []),
        ]}
      />
      <h3 className="ga-subhead">Billing exceptions</h3>
      <ExceptionTable rows={a?.exceptions} loading={account.loading} bill={bill} onResolve={resolve} />
      {a?.lapses?.length > 0 && (
        <>
          <h3 className="ga-subhead">Lapses</h3>
          <DataTable
            rows={a.lapses}
            rowKey={(l) => l.ref}
            searchFrom={20}
            columns={[
              { key: "ref", label: "Lapse", render: (l) => <span className="ws-mono">{l.ref}</span> },
              { key: "status", label: "Status", render: (l) => <Badge tone={l.status === "APPROVED" ? "red" : l.status === "PROPOSED" ? "amber" : "green"}>{label(l.status)}</Badge> },
              { key: "paidToDate", label: "Paid to", render: (l) => day(l.paidToDate) },
              { key: "arrearsAmount", label: "Arrears", align: "right", render: (l) => pula(l.arrearsAmount) },
              { key: "continuationUntil", label: "Continuation until", render: (l) => day(l.continuationUntil) },
              { key: "decidedBy", label: "Decided", render: (l) => (l.decidedBy ? `${l.decidedBy} · ${l.decisionNote}` : "—") },
            ]}
          />
        </>
      )}
    </Panel>
  );
}

function ExceptionTable({ rows, loading, bill, onResolve, showScheme }) {
  return (
    <DataTable
      rows={rows}
      loading={loading}
      rowKey={(e) => e.id}
      searchFrom={showScheme ? 8 : 20}
      empty="No billing exceptions"
      columns={[
        ...(showScheme ? [{ key: "schemeRef", label: "Scheme", render: (e) => `${e.schemeRef} · ${e.schemeName}` }] : []),
        { key: "type", label: "Type", render: (e) => label(e.type) },
        { key: "ref", label: "Invoice / payment", render: (e) => e.invoiceRef || e.paymentRef || "—" },
        { key: "amount", label: "Amount", align: "right", render: (e) => (e.amount != null ? pula(e.amount) : "—") },
        { key: "detail", label: "Detail" },
        { key: "status", label: "Status", render: (e) => <Badge tone={e.status === "OPEN" ? "amber" : "green"}>{label(e.status)}</Badge> },
        { key: "raisedAt", label: "Raised", render: (e) => when(e.raisedAt) },
        ...(bill ? [{ key: "act", label: "", render: (e) => (e.status === "OPEN" ? <Button variant="secondary" icon={Check} onClick={() => onResolve(e)}>Resolve</Button> : e.resolutionNote || null) }] : []),
      ]}
    />
  );
}

/** Open billing exceptions across all schemes (AT-GL05-02): short payments, held money, disputes, escalations. */
export function BillingExceptionsPanel({ session, notify, profile }) {
  const list = useResource(session, "/group/billing-exceptions", []);
  const action = useAction(inlineErrors(notify));
  const resolve = async (e) => {
    const note = window.prompt(`Resolve ${label(e.type).toLowerCase()} on ${e.schemeRef} — note:`);
    if (!note) return;
    const r = await action.run(() => request(session, `/group/billing-exceptions/${e.id}/resolution`, { method: "POST", body: { note } }), "Exception resolved");
    if (r) list.reload();
  };
  return (
    <Panel title="Billing exceptions" subtitle="Open across all schemes: short payments, money held unallocated, disputed lines and lapses escalated before any cover action.">
      <ErrorNote error={list.error || action.error} />
      <ExceptionTable rows={list.data} loading={list.loading} bill={can(profile, "BILL_SCHEME")} onResolve={resolve} showScheme />
    </Panel>
  );
}

export const STAGE_BADGE = (stage) => (stage ? <Badge tone={STAGE_TONES[stage]}>{label(stage)}</Badge> : null);
