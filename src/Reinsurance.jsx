import React, { useState } from "react";
import { CheckCircle2, FileSpreadsheet, Plus } from "lucide-react";
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
import "./reinsurance.css";

// SH07 reinsurance: treaties (drafted, then approved by someone else), automatic cessions on premium received under
// an approved treaty, claim recoveries kept apart from the customer payout, and monthly bordereaux.

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const endOfYear = () => new Date().getFullYear() + "-12-31";
const share = (v) => (v === null || v === undefined ? "—" : (Number(v) * 100).toFixed(2) + "%");
const typeLabel = (t) => (t === "SURPLUS" ? "Surplus" : t === "FACULTATIVE" ? "Facultative" : "Quota share");

export default function Reinsurance({ session, notify, profile }) {
  const [tab, setTab] = useState("treaties");
  const treaties = useResource(session, "/reinsurance/treaties", []);
  const recoveries = useResource(session, "/reinsurance/recoveries", []);
  const list = treaties.data || [];
  const loading = treaties.loading && !list.length;
  const ceding = list.filter((t) => t.ceding).length;
  const drafts = list.filter((t) => t.status === "DRAFT").length;
  const cessions = list.reduce((s, t) => s + (t.cessionCount || 0), 0);
  const cededPremium = list.reduce((s, t) => s + Number(t.totalCededPremium || 0), 0);
  const expected = (recoveries.data || [])
    .filter((r) => r.status === "EXPECTED")
    .reduce((s, r) => s + Number(r.recoveryAmount || 0), 0);
  const facultative = useResource(session, "/reinsurance/facultative", []);
  const referred = (facultative.data || []).filter((f) => f.status === "REFERRED" || f.status === "OFFERED").length;

  return (
    <>
      <Heading
        eyebrow="REINSURANCE"
        title="Reinsurance"
        subtitle="Treaties, the risk ceded under them on every premium, recoveries on paid claims and the bordereaux sent to reinsurers."
      />
      <div className="stat-grid">
        <Stat label="Treaties ceding today" value={ceding} note={drafts + " awaiting approval"} loading={loading} />
        <Stat label="Cessions" value={cessions} tone="blue" loading={loading} note={referred + " facultative referral(s) open"} />
        <Stat label="Premium ceded" value={pula(cededPremium)} tone="blue" loading={loading} />
        <Stat
          label="Recoveries expected"
          value={pula(expected)}
          tone="amber"
          loading={recoveries.loading && !recoveries.data?.length}
        />
      </div>
      <Tabs
        value={tab}
        onChange={(next) => {
          // A treaty is approved by someone else and cessions arrive from premium events, so re-read on every tab change.
          setTab(next);
          treaties.reload();
          recoveries.reload();
          facultative.reload();
        }}
        tabs={[
          ["treaties", "Treaties"],
          ["exposures", "Exposures"],
          ["facultative", "Facultative"],
          ["cessions", "Cessions"],
          ["recoveries", "Recoveries"],
          ["bordereaux", "Bordereaux"],
        ]}
      />
      {tab === "exposures" && <Exposures session={session} />}
      {tab === "facultative" && <FacultativeQueue session={session} notify={notify} profile={profile} resource={facultative} onChange={treaties.reload} />}
      {tab === "treaties" && <Treaties session={session} notify={notify} profile={profile} resource={treaties} />}
      {tab === "cessions" && <Cessions session={session} treaties={list} />}
      {tab === "recoveries" && <Recoveries session={session} notify={notify} profile={profile} resource={recoveries} />}
      {tab === "bordereaux" && (
        <Bordereaux session={session} notify={notify} profile={profile} treaties={list} onChange={treaties.reload} />
      )}
    </>
  );
}

// ── treaties ────────────────────────────────────────────────────────────────────────────────────

const blankTreaty = () => ({
  name: "",
  reinsurer: "",
  treatyType: "QUOTA_SHARE",
  products: [],
  cededPercent: "",
  retention: "",
  capacity: "",
  effectiveFrom: today(),
  effectiveTo: endOfYear(),
});

function Treaties({ session, notify, profile, resource }) {
  const products = useResource(session, "/public/products", []);
  const [form, setForm] = useState(null);
  const draft = useAction(notify);
  const approve = useAction(notify);
  const confirm = useConfirm();
  const names = (products.data || []).map((p) => p.name);
  const me = session?.username;

  const toggleProduct = (name) =>
    setForm({
      ...form,
      products: form.products.includes(name) ? form.products.filter((p) => p !== name) : [...form.products, name],
    });

  const save = async () => {
    const body = { ...form };
    if (body.treatyType === "QUOTA_SHARE") delete body.retention;
    else delete body.cededPercent;
    if (!body.capacity) delete body.capacity;
    const done = await draft.run(
      () => request(session, "/reinsurance/treaties", { method: "POST", body }),
      "Treaty drafted. Another user must approve it before it cedes.",
    );
    if (done) {
      setForm(null);
      resource.reload();
    }
  };

  const approveTreaty = async (treaty) => {
    const ok = await confirm({
      title: "Approve " + treaty.ref + "?",
      message: (
        <>
          <strong>{treaty.name}</strong> with {treaty.reinsurer} starts ceding{" "}
          {treaty.treatyType === "SURPLUS"
            ? "the sum assured above " + pula(treaty.retention)
            : Number(treaty.cededPercent).toFixed(2) + "% of every policy"}{" "}
          on {(treaty.products || []).join(", ")} from {treaty.effectiveFrom}. An approved treaty cannot be edited.
        </>
      ),
      confirmLabel: "Approve treaty",
    });
    if (!ok) return;
    const done = await approve.run(
      () => request(session, `/reinsurance/treaties/${encodeURIComponent(treaty.ref)}/approve`, { method: "POST" }),
      "Treaty " + treaty.ref + " approved",
    );
    if (done) resource.reload();
  };

  return (
    <>
      {form && (
        <Drawer
          title="Draft a treaty"
          description="A draft cedes nothing. Quota share cedes a fixed share of every policy; surplus cedes the part of the sum assured above the retention."
          onClose={() => setForm(null)}
        >
          <FormGrid submitLabel="Save draft" busy={draft.busy} error={draft.error} onSubmit={save}>
            <Field label="Treaty name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Reinsurer">
              <input value={form.reinsurer} onChange={(e) => setForm({ ...form, reinsurer: e.target.value })} required />
            </Field>
            <Field label="Type">
              <select value={form.treatyType} onChange={(e) => setForm({ ...form, treatyType: e.target.value })}>
                <option value="QUOTA_SHARE">Quota share</option>
                <option value="SURPLUS">Surplus</option>
              </select>
            </Field>
            {form.treatyType === "QUOTA_SHARE" ? (
              <Field label="Ceded share (%)">
                <input
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={form.cededPercent}
                  onChange={(e) => setForm({ ...form, cededPercent: e.target.value })}
                  required
                />
              </Field>
            ) : (
              <Field label="Retention (BWP sum assured)">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.retention}
                  onChange={(e) => setForm({ ...form, retention: e.target.value })}
                  required
                />
              </Field>
            )}
            <Field label="Capacity per life (BWP ceded, optional)" hint="Above it the excess is referred for facultative placement">
              <input type="number" min="0.01" step="0.01" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </Field>
            <Field label="Effective from">
              <input
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                required
              />
            </Field>
            <Field label="Effective to">
              <input
                type="date"
                value={form.effectiveTo}
                onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })}
                required
              />
            </Field>
            <div className="form-label full" role="group" aria-label="Products covered">
              <span>Products covered</span>
              <div className="ri-products">
                {names.map((n) => (
                  <label key={n} className="ri-product">
                    <input type="checkbox" checked={form.products.includes(n)} onChange={() => toggleProduct(n)} />
                    <span>{n}</span>
                  </label>
                ))}
              </div>
              <small className="ws-hint">Choose at least one</small>
            </div>
          </FormGrid>
        </Drawer>
      )}
      <Panel
        title="Treaties"
        subtitle="Only an approved treaty in force cedes. The user who drafts a treaty cannot approve it, whatever their role. Approved treaties may not overlap for a product."
        action={
          can(profile, "MANAGE_REINSURANCE") && (
            <Button icon={Plus} onClick={() => setForm(blankTreaty())}>
              Draft treaty
            </Button>
          )
        }
      >
        <ErrorNote error={resource.error || approve.error} />
        <DataTable
          rows={resource.data}
          loading={resource.loading}
          rowKey={(r) => r.ref}
          empty="No treaties"
          emptyDetail="Draft a quota share or surplus treaty to start ceding risk."
          searchPlaceholder="Search treaties, reinsurers, products…"
          columns={[
            { key: "ref", label: "Treaty" },
            { key: "name", label: "Name" },
            { key: "reinsurer", label: "Reinsurer" },
            { key: "treatyType", label: "Type", render: (r) => typeLabel(r.treatyType) },
            {
              key: "terms",
              label: "Terms",
              sortValue: (r) => (r.treatyType === "SURPLUS" ? Number(r.retention) : Number(r.cededPercent)),
              render: (r) =>
                (r.treatyType === "SURPLUS" ? "Retention " + pula(r.retention) : Number(r.cededPercent).toFixed(2) + "% ceded") +
                (r.capacity ? " · capacity " + pula(r.capacity) + " per life" : "") +
                (r.policyRef ? " · policy " + r.policyRef : ""),
            },
            { key: "products", label: "Products", render: (r) => (r.products || []).join(", ") },
            {
              key: "period",
              label: "Period",
              sortValue: (r) => r.effectiveFrom,
              render: (r) => r.effectiveFrom + " → " + r.effectiveTo,
            },
            {
              key: "status",
              label: "Status",
              render: (r) =>
                r.status === "APPROVED" ? (
                  <Badge tone={r.ceding ? "green" : "blue"}>{r.ceding ? "Approved · ceding" : "Approved"}</Badge>
                ) : (
                  <Badge>{r.status}</Badge>
                ),
            },
            {
              key: "approvedBy",
              label: "Drafted / approved",
              render: (r) => r.createdBy + (r.approvedBy ? " / " + r.approvedBy : ""),
            },
            { key: "cessionCount", label: "Cessions", align: "right" },
            {
              key: "act",
              label: "",
              render: (r) =>
                r.status === "DRAFT" &&
                can(profile, "APPROVE_TREATY") &&
                (r.createdBy === me ? (
                  <small className="ws-hint">Needs another approver</small>
                ) : (
                  <Button variant="secondary" icon={CheckCircle2} busy={approve.busy} onClick={() => approveTreaty(r)}>
                    Approve
                  </Button>
                )),
            },
          ]}
        />
      </Panel>
    </>
  );
}

// ── cessions ────────────────────────────────────────────────────────────────────────────────────

function Cessions({ session, treaties }) {
  const [treaty, setTreaty] = useState("");
  const cessions = useResource(
    session,
    "/reinsurance/cessions" + (treaty ? "?treatyRef=" + encodeURIComponent(treaty) : ""),
    [],
  );
  return (
    <Panel
      title="Cessions"
      subtitle="One per premium received, at the share of the policy's exposure in force; returned premiums and refunds add a negative adjustment linked to the cession it adjusts."
      action={
        <select aria-label="Treaty" value={treaty} onChange={(e) => setTreaty(e.target.value)}>
          <option value="">All treaties</option>
          {treaties.map((t) => (
            <option key={t.ref} value={t.ref}>
              {t.ref} · {t.name}
            </option>
          ))}
        </select>
      }
    >
      <ErrorNote error={cessions.error} />
      <DataTable
        rows={cessions.data}
        loading={cessions.loading}
        rowKey={(r) => r.ref}
        empty="Nothing ceded yet"
        emptyDetail="A cession is recorded when a premium is received on a policy an approved treaty covers."
        searchPlaceholder="Search policy, treaty, product…"
        columns={[
          { key: "ref", label: "Cession" },
          { key: "createdAt", label: "Date", render: (r) => when(r.createdAt) },
          { key: "treatyRef", label: "Treaty" },
          { key: "policyRef", label: "Policy" },
          { key: "product", label: "Product" },
          { key: "cededShare", label: "Share", align: "right", render: (r) => share(r.cededShare) },
          { key: "sumAssured", label: "Sum assured", align: "right", render: (r) => pula(r.sumAssured) },
          { key: "cededSum", label: "Ceded sum", align: "right", render: (r) => pula(r.cededSum) },
          { key: "premium", label: "Premium", align: "right", render: (r) => pula(r.premium) },
          { key: "cededPremium", label: "Ceded premium", align: "right", render: (r) => pula(r.cededPremium) },
          { key: "receiptRef", label: "Receipt", render: (r) => r.receiptRef || "—" },
          {
            key: "adjustsRef",
            label: "Adjusts / exposure",
            render: (r) =>
              r.adjustsRef
                ? r.adjustsRef + " (" + (r.reason === "PaymentReturned" ? "returned premium" : r.reason === "REFUND" ? "refund" : r.reason) + ")"
                : r.exposureRef || "—",
          },
          { key: "bordereauRef", label: "Bordereau", render: (r) => r.bordereauRef || <Badge tone="amber">Unreported</Badge> },
        ]}
      />
    </Panel>
  );
}

// ── recoveries ──────────────────────────────────────────────────────────────────────────────────

function Recoveries({ session, notify, profile, resource }) {
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState({ amount: "", reference: "", note: "" });
  const action = useAction(notify);
  const manage = can(profile, "MANAGE_REINSURANCE");
  const show = (r) => {
    setForm({ amount: String(r.recoveryAmount ?? ""), reference: "", note: "" });
    setOpen(r);
  };
  const receive = async () => {
    const done = await action.run(
      () =>
        request(session, "/reinsurance/recoveries/" + encodeURIComponent(open.ref) + "/receipt", {
          method: "POST",
          body: { amount: form.amount, reference: form.reference, ...(form.note.trim() ? { note: form.note } : {}) },
        }),
      "Recovery receipt recorded",
    );
    if (done) {
      setOpen(null);
      resource.reload();
    }
  };
  const differs = open && form.amount !== "" && Number(form.amount) !== Number(open.recoveryAmount);
  return (
    <Panel
      title="Claim recoveries"
      subtitle="The reinsurer's share of each approved claim on a ceded policy, at the cover in force on the event date. Recorded separately; the customer's payout never waits for it. Open one to record a payment, a dispute or a write-off (approved by a second person)."
    >
      <ErrorNote error={resource.error} />
      <DataTable
        rows={resource.data}
        loading={resource.loading}
        rowKey={(r) => r.ref}
        onRowClick={show}
        empty="No recoveries"
        emptyDetail="A recovery is expected when a claim on a ceded policy is approved."
        columns={[
          { key: "ref", label: "Recovery" },
          { key: "createdAt", label: "Recognised", render: (r) => when(r.createdAt) },
          { key: "claimRef", label: "Claim" },
          { key: "policyRef", label: "Policy" },
          { key: "treatyRef", label: "Treaty", render: (r) => r.treatyRef + " · " + r.reinsurer },
          { key: "claimAmount", label: "Claim", align: "right", render: (r) => pula(r.claimAmount) },
          { key: "cededShare", label: "Share", align: "right", render: (r) => share(r.cededShare) },
          { key: "recoveryAmount", label: "Recovery", align: "right", render: (r) => pula(r.recoveryAmount) },
          {
            key: "receivedAmount",
            label: "Received",
            align: "right",
            render: (r) => (r.receivedAmount == null ? "—" : pula(r.receivedAmount)),
          },
          { key: "status", label: "Status", render: (r) => <Badge>{r.stage && r.stage !== "NONE" ? r.stage.replace(/_/g, " ") : r.status}</Badge> },
          { key: "ageDays", label: "Age", align: "right", render: (r) => (r.status === "EXPECTED" ? r.ageDays + " d" : "—") },
        ]}
      />
      {open && (
        <RecoveryDrawer
          session={session}
          profile={profile}
          open={open}
          form={form}
          setForm={setForm}
          receive={receive}
          action={action}
          manage={manage}
          differs={differs}
          onDone={() => {
            setOpen(null);
            resource.reload();
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </Panel>
  );
}

// NS-SH07-005 recovery ledger: receipt, dispute, and write-off approved by a second person.
function RecoveryDrawer({ session, profile, open, form, setForm, receive, action, manage, differs, onDone, onClose }) {
  const [step, setStep] = useState(null);
  const me = profile?.username;
  const run = async (path, body, message) => {
    const done = await action.run(
      () => request(session, "/reinsurance/recoveries/" + encodeURIComponent(open.ref) + path, { method: "POST", body: body || {} }),
      message,
    );
    if (done) onDone();
  };
  const expected = open.status === "EXPECTED";
  return (
    <Drawer
      title={open.ref + " · " + open.claimRef}
      description={open.reinsurer + " owes " + pula(open.recoveryAmount) + " on claim " + open.claimRef + (open.eventDate ? " (event " + open.eventDate + ")" : "")}
      onClose={onClose}
    >
      <div className="ws-kv">
        <div>
          <small>Status</small>
          <strong>
            <Badge>{open.stage && open.stage !== "NONE" ? open.stage.replace(/_/g, " ") : open.status}</Badge>
          </strong>
        </div>
        <div>
          <small>Claim approved / paid</small>
          <strong>
            {pula(open.claimAmount)}
            {open.claimPaidAmount != null ? " · paid " + pula(open.claimPaidAmount) : " · not yet paid"}
          </strong>
        </div>
        {open.originalAmount != null && (
          <div>
            <small>First expected</small>
            <strong>{pula(open.originalAmount)}</strong>
          </div>
        )}
        {expected && (
          <div>
            <small>Age</small>
            <strong>{open.ageDays} days</strong>
          </div>
        )}
        {open.disputeReason && (
          <div>
            <small>Dispute</small>
            <strong>{open.disputeReason}</strong>
          </div>
        )}
        {open.writeOffReason && (
          <div>
            <small>Write-off</small>
            <strong>
              {pula(open.writeOffAmount)} · {open.writeOffReason} · asked by {open.writeOffRequestedBy}
              {open.writeOffDecidedBy ? " · decided by " + open.writeOffDecidedBy : ""}
            </strong>
          </div>
        )}
        {open.status === "RECEIVED" && (
          <>
            <div>
              <small>Received</small>
              <strong>
                {pula(open.receivedAmount)} · {open.receivedReference}
              </strong>
            </div>
            <div>
              <small>Recorded</small>
              <strong>{when(open.receivedAt) + " by " + open.receivedBy}</strong>
            </div>
            {open.receivedNote && (
              <div>
                <small>Note</small>
                <strong>{open.receivedNote}</strong>
              </div>
            )}
          </>
        )}
      </div>
      <ErrorNote error={!step && action.error} />
      {expected && manage && open.stage === "NONE" && (
        <span className="ws-row-actions">
          <Button variant="secondary" onClick={() => setStep({ kind: "dispute", reason: "" })}>
            Record dispute
          </Button>
          <Button variant="secondary" onClick={() => setStep({ kind: "writeoff", reason: "", amount: String(open.recoveryAmount) })}>
            Request write-off
          </Button>
        </span>
      )}
      {expected && manage && open.stage === "DISPUTED" && (
        <Button variant="secondary" onClick={() => setStep({ kind: "resolve", note: "", agreedAmount: String(open.recoveryAmount) })}>
          Resolve dispute
        </Button>
      )}
      {expected &&
        open.stage === "WRITE_OFF_PENDING" &&
        (can(profile, "APPROVE_TREATY") && open.writeOffRequestedBy !== me ? (
          <span className="ws-row-actions">
            <Button busy={action.busy} onClick={() => run("/write-off/approve", null, "Recovery written off")}>
              Approve write-off
            </Button>
            <Button variant="secondary" busy={action.busy} onClick={() => run("/write-off/reject", null, "Write-off rejected")}>
              Reject
            </Button>
          </span>
        ) : (
          <p className="ws-hint">Write-off waiting for another approver.</p>
        ))}
      {step?.kind === "dispute" && (
        <FormGrid submitLabel="Record dispute" busy={action.busy} error={action.error} onSubmit={() => run("/dispute", { reason: step.reason }, "Dispute recorded")}>
          <Field label="What the reinsurer disputes" full>
            <input required maxLength={500} value={step.reason} onChange={(e) => setStep({ ...step, reason: e.target.value })} />
          </Field>
        </FormGrid>
      )}
      {step?.kind === "resolve" && (
        <FormGrid
          submitLabel="Resolve dispute"
          busy={action.busy}
          error={action.error}
          onSubmit={() => run("/resolve-dispute", { note: step.note, agreedAmount: step.agreedAmount }, "Dispute resolved")}
        >
          <Field label="Agreed recovery (BWP)">
            <input type="number" min="0" step="0.01" value={step.agreedAmount} onChange={(e) => setStep({ ...step, agreedAmount: e.target.value })} />
          </Field>
          <Field label="How it was settled" full>
            <input required maxLength={300} value={step.note} onChange={(e) => setStep({ ...step, note: e.target.value })} />
          </Field>
        </FormGrid>
      )}
      {step?.kind === "writeoff" && (
        <FormGrid
          submitLabel="Ask for approval"
          busy={action.busy}
          error={action.error}
          onSubmit={() => run("/write-off", { amount: step.amount, reason: step.reason }, "Write-off sent for approval")}
        >
          <Field label="Amount to write off (BWP)">
            <input type="number" min="0.01" step="0.01" value={step.amount} onChange={(e) => setStep({ ...step, amount: e.target.value })} />
          </Field>
          <Field label="Why it will not be recovered" full>
            <input required maxLength={500} value={step.reason} onChange={(e) => setStep({ ...step, reason: e.target.value })} />
          </Field>
        </FormGrid>
      )}
      {expected && open.stage === "NONE" && !step && manage && (
        <FormGrid submitLabel="Record receipt" busy={action.busy} error={action.error} onSubmit={receive}>
          <Field label="Amount received (BWP)">
            <input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </Field>
          <Field label="Reinsurer's payment reference">
            <input value={form.reference} maxLength={60} onChange={(e) => setForm({ ...form, reference: e.target.value })} required />
          </Field>
          <Field label={differs ? "Why it differs from " + pula(open.recoveryAmount) : "Note (optional)"} full>
            <textarea rows={2} maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} required={differs} />
          </Field>
        </FormGrid>
      )}
      {expected && !manage && <p className="ws-hint">Expected from the reinsurer; recording its payment needs reinsurance management access.</p>}
    </Drawer>
  );
}

// ── exposures (NS-SH07-002/003) ─────────────────────────────────────────────────────────────────

function Exposures({ session }) {
  const [policy, setPolicy] = useState("");
  const exposures = useResource(session, "/reinsurance/exposures" + (policy.trim() ? "?policyRef=" + encodeURIComponent(policy.trim()) : ""), []);
  return (
    <Panel
      title="Exposures"
      subtitle="The risk each policy cedes, worked out per life at issue and on every benefit change under the treaty in force on that date. A change adds a version; earlier versions keep their treaty and share."
      action={<input aria-label="Policy" placeholder="Filter by policy POL-…" value={policy} onChange={(e) => setPolicy(e.target.value)} />}
    >
      <ErrorNote error={exposures.error} />
      <DataTable
        rows={exposures.data}
        loading={exposures.loading}
        rowKey={(r) => r.ref}
        empty="No exposures yet"
        emptyDetail="An exposure is recorded when a policy is issued."
        searchPlaceholder="Search policy, life, treaty…"
        columns={[
          { key: "ref", label: "Exposure" },
          { key: "policyRef", label: "Policy", render: (r) => r.policyRef + " v" + r.version },
          { key: "customerRef", label: "Life" },
          { key: "product", label: "Product" },
          { key: "sumAssured", label: "Sum assured", align: "right", render: (r) => pula(r.sumAssured) },
          { key: "aggregateSum", label: "Life total", align: "right", render: (r) => pula(r.aggregateSum) },
          { key: "retainedSum", label: "Retained", align: "right", render: (r) => pula(r.retainedSum) },
          { key: "cededSum", label: "Ceded", align: "right", render: (r) => pula(r.cededSum) + " (" + share(r.cededShare) + ")" },
          { key: "treatyRef", label: "Treaty", render: (r) => r.treatyRef || "—" },
          {
            key: "facultativeRef",
            label: "Facultative",
            render: (r) => (r.facultativeRef ? r.facultativeRef + " · " + r.facultativeStatus.toLowerCase() : "—"),
          },
          { key: "effectiveFrom", label: "In force", render: (r) => r.effectiveFrom + (r.endedOn ? " → " + r.endedOn : "") },
          { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "NO_TREATY" ? "red" : undefined}>{r.status.replace("_", " ")}</Badge> },
          { key: "reason", label: "Why" },
        ]}
      />
    </Panel>
  );
}

// ── facultative queue (NS-SH07-002) ─────────────────────────────────────────────────────────────

function FacultativeQueue({ session, notify, profile, resource, onChange }) {
  const action = useAction(notify);
  const [offer, setOffer] = useState(null);
  const [decision, setDecision] = useState(null);
  const me = profile?.username;
  const send = async () => {
    const done = await action.run(
      () =>
        request(session, "/reinsurance/facultative/" + offer.ref + "/offer", {
          method: "POST",
          body: { reinsurer: offer.reinsurer, offeredSum: offer.offeredSum },
        }),
      "Offered to " + offer.reinsurer,
    );
    if (done) {
      setOffer(null);
      resource.reload();
    }
  };
  const decide = async () => {
    const done = await action.run(
      () => request(session, "/reinsurance/facultative/" + decision.ref + "/decision", { method: "POST", body: decision }),
      decision.outcome === "ACCEPTED" ? "Acceptance captured; the facultative share cedes from now on" : "Decline recorded; the excess is retained",
    );
    if (done) {
      setDecision(null);
      resource.reload();
      onChange?.();
    }
  };
  return (
    <Panel
      title="Facultative queue"
      subtitle="Risks above a treaty's capacity per life, referred automatically. Offer each to a reinsurer; someone other than the person who offered it captures the reinsurer's answer."
    >
      <ErrorNote error={resource.error || (!offer && !decision && action.error)} />
      <DataTable
        rows={resource.data}
        loading={resource.loading}
        rowKey={(r) => r.ref}
        empty="Nothing referred"
        emptyDetail="A referral appears when a life's ceded sum would exceed a treaty's capacity."
        columns={[
          { key: "ref", label: "Referral" },
          { key: "policyRef", label: "Policy" },
          { key: "customerRef", label: "Life" },
          { key: "product", label: "Product" },
          { key: "aggregateSum", label: "Life total", align: "right", render: (r) => pula(r.aggregateSum) },
          { key: "excessSum", label: "To place", align: "right", render: (r) => pula(r.excessSum) },
          { key: "treatyRef", label: "Over treaty", render: (r) => r.treatyRef || "—" },
          { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
          {
            key: "reinsurer",
            label: "Placement",
            render: (r) =>
              r.reinsurer
                ? r.reinsurer +
                  " · offered " +
                  pula(r.offeredSum) +
                  (r.acceptedSum != null ? " · accepted " + pula(r.acceptedSum) + " (" + r.acceptanceRef + ", " + r.facTreatyRef + ")" : "")
                : "—",
          },
          {
            key: "act",
            label: "",
            render: (r) =>
              r.status === "REFERRED" && can(profile, "MANAGE_REINSURANCE") ? (
                <Button variant="secondary" onClick={() => setOffer({ ref: r.ref, reinsurer: "", offeredSum: String(r.excessSum) })}>
                  Offer
                </Button>
              ) : r.status === "OFFERED" ? (
                can(profile, "APPROVE_TREATY") && r.offeredBy !== me ? (
                  <Button
                    variant="secondary"
                    onClick={() => setDecision({ ref: r.ref, outcome: "ACCEPTED", acceptedSum: String(r.offeredSum), acceptanceRef: "", note: "" })}
                  >
                    Record answer
                  </Button>
                ) : (
                  <small className="ws-hint">Answer captured by another person</small>
                )
              ) : (
                r.decisionNote && <small className="ws-hint">{r.decidedBy + ": " + r.decisionNote}</small>
              ),
          },
        ]}
      />
      {offer && (
        <Drawer title={"Offer " + offer.ref} description="Send the excess to a reinsurer for facultative acceptance." onClose={() => setOffer(null)}>
          <FormGrid submitLabel="Record offer" busy={action.busy} error={action.error} onSubmit={send}>
            <Field label="Reinsurer">
              <input required maxLength={150} value={offer.reinsurer} onChange={(e) => setOffer({ ...offer, reinsurer: e.target.value })} />
            </Field>
            <Field label="Sum offered (BWP)">
              <input type="number" min="0.01" step="0.01" required value={offer.offeredSum} onChange={(e) => setOffer({ ...offer, offeredSum: e.target.value })} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      {decision && (
        <Drawer
          title={"Reinsurer's answer on " + decision.ref}
          description="An acceptance becomes a facultative arrangement for this policy and cedes on every later premium and claim."
          onClose={() => setDecision(null)}
        >
          <FormGrid submitLabel="Record answer" busy={action.busy} error={action.error} onSubmit={decide}>
            <Field label="Answer">
              <select value={decision.outcome} onChange={(e) => setDecision({ ...decision, outcome: e.target.value })}>
                <option value="ACCEPTED">Accepted</option>
                <option value="DECLINED">Declined (retained)</option>
              </select>
            </Field>
            {decision.outcome === "ACCEPTED" && (
              <>
                <Field label="Accepted sum (BWP)">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={decision.acceptedSum}
                    onChange={(e) => setDecision({ ...decision, acceptedSum: e.target.value })}
                  />
                </Field>
                <Field label="Reinsurer's acceptance reference">
                  <input required maxLength={60} value={decision.acceptanceRef} onChange={(e) => setDecision({ ...decision, acceptanceRef: e.target.value })} />
                </Field>
              </>
            )}
            <Field label="Note" full>
              <input required maxLength={500} value={decision.note} onChange={(e) => setDecision({ ...decision, note: e.target.value })} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </Panel>
  );
}

// ── bordereaux ──────────────────────────────────────────────────────────────────────────────────

function Bordereaux({ session, notify, profile, treaties, onChange }) {
  const bordereaux = useResource(session, "/reinsurance/bordereaux", []);
  const approved = treaties.filter((t) => t.status === "APPROVED");
  const [form, setForm] = useState(null);
  const action = useAction(notify);

  const generate = async () => {
    const done = await action.run(
      () => request(session, "/reinsurance/bordereaux", { method: "POST", body: form }),
      "Bordereau ready",
    );
    if (done) {
      setForm(null);
      bordereaux.reload();
      onChange?.();
    }
  };

  return (
    <>
      {form && (
        <Drawer
          title="Produce a bordereau"
          description="Reports the treaty's cessions in the month that are not yet on a bordereau. Asking again for the same month returns the same bordereau."
          onClose={() => setForm(null)}
        >
          <FormGrid submitLabel="Produce bordereau" busy={action.busy} error={action.error} onSubmit={generate}>
            <Field label="Treaty">
              <select value={form.treatyRef} onChange={(e) => setForm({ ...form, treatyRef: e.target.value })} required>
                <option value="">Choose an approved treaty</option>
                {approved.map((t) => (
                  <option key={t.ref} value={t.ref}>
                    {t.ref} · {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Month">
              <input
                type="month"
                max={thisMonth()}
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
                required
              />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      <Panel
        title="Bordereaux"
        subtitle="Record counts and control totals as submitted to the reinsurer."
        action={
          can(profile, "MANAGE_REINSURANCE") && (
            <Button icon={FileSpreadsheet} onClick={() => setForm({ treatyRef: approved[0]?.ref || "", period: thisMonth() })}>
              Produce bordereau
            </Button>
          )
        }
      >
        <ErrorNote error={bordereaux.error} />
        <DataTable
          rows={bordereaux.data}
          loading={bordereaux.loading}
          rowKey={(r) => r.ref}
          empty="No bordereaux produced"
          emptyDetail="Produce one per treaty each month to report its cessions."
          columns={[
            {
              key: "ref",
              label: "Bordereau",
              render: (r) => (
                <>
                  <FileSpreadsheet className="icon icon-sm" aria-hidden="true" /> {r.ref}
                </>
              ),
            },
            { key: "treatyRef", label: "Treaty", render: (r) => r.treatyRef + " · " + r.treatyName },
            { key: "reinsurer", label: "Reinsurer" },
            { key: "period", label: "Month" },
            { key: "recordCount", label: "Records", align: "right" },
            { key: "totalCededPremium", label: "Ceded premium", align: "right", render: (r) => pula(r.totalCededPremium) },
            { key: "totalCededSum", label: "Ceded sum", align: "right", render: (r) => pula(r.totalCededSum) },
            { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
            { key: "createdAt", label: "Produced", render: (r) => when(r.createdAt) + " · " + r.createdBy },
          ]}
        />
      </Panel>
    </>
  );
}
