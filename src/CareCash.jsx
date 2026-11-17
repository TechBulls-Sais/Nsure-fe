import React, { useState } from "react";
import { Plus } from "lucide-react";
import { request } from "./api";
import { money } from "./data";
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
  useAction,
  useResource,
  when,
} from "./ui/workspace";

// Care Cash hospital benefits: each event is worked out benefit by benefit against the policy's day limits.

const TYPE = { ADMISSION: "Hospital admission", DAY_CASE: "Day case", MATERNITY: "Maternity", ACCIDENTAL_DEATH: "Accidental death" };
// A payment is in flight between Payment sent and Paid (the provider confirmed it settled); a failed or returned one
// is sent again with corrected details, as for claim payouts (NS-SH05-007).
const STATUS = {
  ASSESSED: ["Awaiting approval", "amber"],
  APPROVED: ["Approved", "blue"],
  PAYMENT_SENT: ["Payment sent", "amber"],
  PAYMENT_FAILED: ["Payment failed", "red"],
  PAID: ["Paid", "green"],
  DECLINED: ["Declined", undefined],
};
const PAYOUT_METHODS = ["Bank Account", "Mobile Wallet"];
const badge = (s) => {
  const [label, tone] = STATUS[s] || [s];
  return <Badge tone={tone}>{label}</Badge>;
};
const today = () => new Date().toISOString().slice(0, 10);

export default function CareCash({ session, notify, profile }) {
  const [tab, setTab] = useState("policies");
  const [open, setOpen] = useState(null);
  const policies = useResource(session, "/care-cash/policies", []);
  const events = useResource(session, "/care-cash/events", []);
  const all = events.data || [];
  const reload = () => {
    policies.reload();
    events.reload();
  };
  return (
    <>
      <Heading
        eyebrow="CARE CASH"
        title="Hospital cash benefits"
        subtitle="Admissions, day cases, ICU, surgery, long-stay, maternity, premium waiver and accidental death, each worked out against the per-event, per-life and per-policy day limits."
      />
      <div className="stat-grid">
        <Stat label="Care Cash policies" value={(policies.data || []).length} loading={policies.loading} />
        <Stat label="Events awaiting approval" value={all.filter((e) => e.status === "ASSESSED").length} tone="amber" loading={events.loading} />
        <Stat
          label="Approved, to pay"
          value={all.filter((e) => e.status === "APPROVED" || e.status === "PAYMENT_FAILED").length}
          tone="blue"
          loading={events.loading}
        />
        <Stat label="Payments in flight" value={all.filter((e) => e.status === "PAYMENT_SENT").length} tone="amber" loading={events.loading} />
        <Stat
          label="Paid"
          value={money(all.filter((e) => e.status === "PAID").reduce((s, e) => s + Number(e.amount), 0))}
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
          ["policies", "Policies"],
          ["events", "Events"],
        ]}
      />
      {tab === "policies" && (
        <Panel title="Care Cash policies" subtitle="Open a policy to see its day limits and record a hospital event.">
          <ErrorNote error={policies.error} />
          <DataTable
            rows={policies.data}
            loading={policies.loading}
            rowKey={(r) => r.policyRef}
            onRowClick={(r) => setOpen(r.policyRef)}
            empty="No Care Cash policies"
            columns={[
              { key: "policyRef", label: "Policy" },
              { key: "customerName", label: "Policyholder" },
              { key: "dailyBenefit", label: "Daily benefit", align: "right", render: (r) => money(r.dailyBenefit) },
              { key: "coverStartDate", label: "Cover from", render: (r) => r.coverStartDate || "—" },
              { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "Active" ? "green" : undefined}>{r.status}</Badge> },
            ]}
          />
        </Panel>
      )}
      {tab === "events" && <Events session={session} notify={notify} profile={profile} resource={events} />}
      {open && (
        <PolicyDrawer
          session={session}
          notify={notify}
          profile={profile}
          policyRef={open}
          onClose={() => {
            setOpen(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function Trace({ lines }) {
  return (
    <ul className="uw-list">
      {lines.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  );
}

function PolicyDrawer({ session, notify, profile, policyRef, onClose }) {
  const base = "/care-cash/policies/" + encodeURIComponent(policyRef);
  const view = useResource(session, base, null);
  const action = useAction(notify);
  const [form, setForm] = useState(null);
  const [preview, setPreview] = useState(null);
  const v = view.data;
  const set = (key) => (e) => {
    setPreview(null);
    setForm({ ...form, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  };
  const assess = async () => {
    const done = await action.run(() => request(session, base + "/assessment", { method: "POST", body: form }));
    if (done) setPreview(done.data);
  };
  const submit = async () => {
    const done = await action.run(() => request(session, base + "/events", { method: "POST", body: form }), "Event recorded");
    if (done) {
      setForm(null);
      setPreview(null);
      view.reload();
    }
  };
  return (
    <Drawer size="lg" title={v ? v.policyRef + " · " + v.customerName : policyRef} description="Care Cash" onClose={onClose}>
      <ErrorNote error={view.error} />
      {v && (
        <>
          <div className="ws-kv">
            <div>
              <small>Daily benefit</small>
              <strong>{money(v.dailyBenefit)}</strong>
            </div>
            <div>
              <small>Cover from</small>
              <strong>{v.coverStartDate || "—"}</strong>
            </div>
            <div>
              <small>Policy days used</small>
              <strong>
                {v.policyDaysUsed} of {v.policyDaysLimit}
              </strong>
            </div>
            <div>
              <small>Limits</small>
              <strong>
                {v.rules.eventDayLimit} a event · {v.rules.yearDayLimit} a year · {v.rules.lifetimeDayLimit} a life
              </strong>
            </div>
            <div>
              <small>Waiting periods</small>
              <strong>
                Illness {v.rules.illnessWaitMonths} months · maternity {v.rules.maternityWaitMonths} · accident none
              </strong>
            </div>
          </div>
          {v.lives.length > 0 && (
            <Panel title="Days used by life">
              <DataTable
                rows={v.lives}
                rowKey={(r) => r.lifeName}
                searchFrom={99}
                columns={[
                  { key: "lifeName", label: "Life" },
                  { key: "usedThisYear", label: "This policy year", align: "right", render: (r) => r.usedThisYear + " of " + v.rules.yearDayLimit },
                  { key: "usedLifetime", label: "Lifetime", align: "right", render: (r) => r.usedLifetime + " of " + v.rules.lifetimeDayLimit },
                  { key: "maternityClaims", label: "Maternity claims", align: "right", render: (r) => r.maternityClaims + " of " + v.rules.maternityMaxClaims },
                ]}
              />
            </Panel>
          )}
          <Panel
            title="Hospital events"
            action={
              can(profile, "CREATE_CLAIM") && (
                <Button
                  icon={Plus}
                  onClick={() => {
                    setPreview(null);
                    setForm({
                      lifeName: v.customerName,
                      eventType: "ADMISSION",
                      cause: "ILLNESS",
                      admitDate: today(),
                      dischargeDate: today(),
                      icuDays: 0,
                      surgery: false,
                    });
                  }}
                >
                  Record event
                </Button>
              )
            }
          >
            <DataTable
              rows={v.events}
              rowKey={(r) => r.ref}
              searchFrom={99}
              empty="No events recorded"
              columns={[
                { key: "ref", label: "Event" },
                { key: "lifeName", label: "Life" },
                { key: "eventType", label: "Type", render: (r) => TYPE[r.eventType] || r.eventType },
                { key: "admitDate", label: "Admitted" },
                { key: "paidDays", label: "Days paid", align: "right" },
                { key: "amount", label: "Benefit", align: "right", render: (r) => money(r.amount) },
                { key: "status", label: "Status", render: (r) => badge(r.status) },
              ]}
            />
          </Panel>
        </>
      )}
      {form && (
        <Drawer
          title="Record a hospital event"
          description="Work the benefit out first, then record it for approval."
          onClose={() => {
            setForm(null);
            setPreview(null);
          }}
        >
          <FormGrid
            submitLabel="Record for approval"
            busy={action.busy}
            error={action.error}
            onSubmit={submit}
            extra={
              <Button type="button" variant="secondary" busy={action.busy} onClick={assess}>
                Work out benefit
              </Button>
            }
          >
            <Field label="Life" full>
              <input value={form.lifeName} onChange={set("lifeName")} required />
            </Field>
            <Field label="Event">
              <select value={form.eventType} onChange={set("eventType")}>
                {Object.entries(TYPE).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cause">
              <select value={form.cause} onChange={set("cause")}>
                <option value="ILLNESS">Illness</option>
                <option value="ACCIDENT">Accident</option>
              </select>
            </Field>
            <Field label={form.eventType === "ADMISSION" ? "Admitted" : "Date"}>
              <input type="date" max={today()} value={form.admitDate} onChange={set("admitDate")} required />
            </Field>
            {form.eventType === "ADMISSION" && (
              <>
                <Field label="Discharged">
                  <input type="date" max={today()} value={form.dischargeDate} onChange={set("dischargeDate")} required />
                </Field>
                <Field label="Days in ICU">
                  <input type="number" min="0" value={form.icuDays} onChange={set("icuDays")} />
                </Field>
              </>
            )}
            {["ADMISSION", "DAY_CASE"].includes(form.eventType) && (
              <Field label="Surgery">
                <label className="ri-product">
                  <input type="checkbox" checked={form.surgery} onChange={set("surgery")} />
                  <span>A qualifying surgery was performed</span>
                </label>
              </Field>
            )}
            {preview && (
              <div className="form-label full">
                <span>
                  Benefit {money(preview.amount)}
                  {preview.waiverMonths > 0 ? " · " + preview.waiverMonths + "-month premium waiver" : ""}
                </span>
                <Trace lines={preview.trace} />
              </div>
            )}
          </FormGrid>
        </Drawer>
      )}
    </Drawer>
  );
}

function Events({ session, notify, profile, resource }) {
  const action = useAction(notify);
  const [open, setOpen] = useState(null);
  const [note, setNote] = useState("");
  const [payee, setPayee] = useState(null);
  const me = session?.username;
  const post = async (suffix, body, message) => {
    const done = await action.run(() => request(session, "/care-cash/events/" + open.ref + suffix, { method: "POST", body }), message);
    if (done) {
      setOpen(null);
      setNote("");
      resource.reload();
    }
  };
  const show = (r) => {
    setNote("");
    setPayee({ payeeName: r.payment?.payeeName || r.customerName || "", payoutMethod: r.payment?.payoutMethod || PAYOUT_METHODS[0], accountRef: "" });
    setOpen(r);
  };
  const settle = can(profile, "SETTLE_CLAIM");
  const payment = open?.payment;
  return (
    <>
      <Panel title="Hospital events" subtitle="An event is approved by someone other than the person who recorded it, then paid: the payment is in flight until the provider confirms it settled.">
        <ErrorNote error={resource.error} />
        <DataTable
          rows={resource.data}
          loading={resource.loading}
          rowKey={(r) => r.ref}
          onRowClick={show}
          empty="No events recorded"
          searchPlaceholder="Search events, policies, lives…"
          columns={[
            { key: "ref", label: "Event" },
            { key: "policyRef", label: "Policy" },
            { key: "lifeName", label: "Life" },
            { key: "eventType", label: "Type", render: (r) => TYPE[r.eventType] || r.eventType },
            { key: "admitDate", label: "Admitted" },
            { key: "paidDays", label: "Days paid", align: "right" },
            { key: "amount", label: "Benefit", align: "right", sortValue: (r) => Number(r.amount), render: (r) => money(r.amount) },
            { key: "status", label: "Status", render: (r) => badge(r.status) },
            { key: "createdBy", label: "Recorded by" },
          ]}
        />
      </Panel>
      {open && (
        <Drawer
          title={open.ref + " · " + (TYPE[open.eventType] || open.eventType)}
          description={open.lifeName + " on " + open.policyRef + " · " + money(open.amount)}
          onClose={() => setOpen(null)}
        >
          <Trace lines={open.trace} />
          {payment && (
            <div className="ws-kv">
              <div>
                <small>Payment instruction</small>
                <strong>{open.paymentReference || "—"}</strong>
              </div>
              <div>
                <small>Payee</small>
                <strong>
                  {payment.payeeName} · {payment.payoutMethod} {payment.accountRef}
                </strong>
              </div>
              <div>
                <small>Sent</small>
                <strong>{payment.sentAt ? when(payment.sentAt) + " by " + payment.sentBy : "—"}</strong>
              </div>
              <div>
                <small>Settled</small>
                <strong>{payment.settledAt ? when(payment.settledAt) : open.status === "PAYMENT_SENT" ? "In flight: awaiting the provider" : "—"}</strong>
              </div>
              {open.status === "PAYMENT_FAILED" && payment.failureReason && (
                <div>
                  <small>Failed</small>
                  <strong>{payment.failureReason}</strong>
                </div>
              )}
            </div>
          )}
          <ErrorNote error={action.error} />
          {open.status === "ASSESSED" && can(profile, "APPROVE_CLAIM") && open.createdBy !== me && (
            <FormGrid
              submitLabel="Approve"
              busy={action.busy}
              onSubmit={() => post("/decision", { approve: true, note }, "Event approved")}
              extra={
                <Button type="button" variant="secondary" busy={action.busy} onClick={() => post("/decision", { approve: false, note }, "Event declined")}>
                  Decline
                </Button>
              }
            >
              <Field label="Note" full>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} required />
              </Field>
            </FormGrid>
          )}
          {open.status === "ASSESSED" && open.createdBy === me && <p className="ws-hint">You recorded this event, so someone else must approve it.</p>}
          {(open.status === "APPROVED" || open.status === "PAYMENT_FAILED") && settle && Number(open.amount) > 0 && (
            <>
              <p className="ws-hint">
                {open.status === "PAYMENT_FAILED"
                  ? "The last payment failed or was returned. Correct the payout details, then send it again under a new instruction."
                  : "Sends a payment instruction for " + money(open.amount) + ". It counts as paid only once the provider confirms settlement."}
              </p>
              <FormGrid
                submitLabel={open.status === "PAYMENT_FAILED" ? "Send payment again" : "Send payment"}
                busy={action.busy}
                onSubmit={() => post("/payment", payee, "Payment sent. Waiting for the provider to confirm settlement.")}
              >
                <Field label="Payee" full>
                  <input value={payee.payeeName} onChange={(e) => setPayee({ ...payee, payeeName: e.target.value })} required />
                </Field>
                <Field label="Payout method">
                  <select value={payee.payoutMethod} onChange={(e) => setPayee({ ...payee, payoutMethod: e.target.value })}>
                    {PAYOUT_METHODS.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Account / wallet number">
                  <input value={payee.accountRef} onChange={(e) => setPayee({ ...payee, accountRef: e.target.value })} required />
                </Field>
              </FormGrid>
            </>
          )}
          {open.status === "PAYMENT_SENT" && settle && (
            <FormGrid
              submitLabel="Confirm settlement"
              busy={action.busy}
              onSubmit={() => post("/payment/confirm", { providerReference: open.paymentReference }, open.ref + " is paid.")}
              extra={
                <Button
                  type="button"
                  variant="secondary"
                  busy={action.busy}
                  disabled={!note.trim()}
                  title={note.trim() ? undefined : "Enter what the provider or bank said first"}
                  onClick={() => post("/payment/failed", { reason: note }, "Payment recorded as failed. Correct the details before sending again.")}
                >
                  Payment failed
                </Button>
              }
            >
              <Field label="If it failed or came back: the provider's reason" full hint="Confirm settlement only when the provider or bank statement shows the money arrived.">
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Returned: account closed" />
              </Field>
            </FormGrid>
          )}
        </Drawer>
      )}
    </>
  );
}
