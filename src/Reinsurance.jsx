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
const typeLabel = (t) => (t === "SURPLUS" ? "Surplus" : "Quota share");

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
    .filter((r) => ["EXPECTED", "DISPUTED", "WRITE_OFF_PENDING"].includes(r.status))
    .reduce((s, r) => s + Number(r.outstanding ?? r.recoveryAmount ?? 0), 0);

  return (
    <>
      <Heading
        eyebrow="REINSURANCE"
        title="Reinsurance"
        subtitle="Treaties, the risk ceded under them on every premium, recoveries on paid claims and the bordereaux sent to reinsurers."
      />
      <div className="stat-grid">
        <Stat label="Treaties ceding today" value={ceding} note={drafts + " awaiting approval"} loading={loading} />
        <Stat label="Cessions" value={cessions} tone="blue" loading={loading} />
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
        }}
        tabs={[
          ["treaties", "Treaties"],
          ["cessions", "Cessions"],
          ["recoveries", "Recoveries"],
          ["bordereaux", "Bordereaux"],
        ]}
      />
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
                r.treatyType === "SURPLUS" ? "Retention " + pula(r.retention) : Number(r.cededPercent).toFixed(2) + "% ceded",
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
      subtitle="One per premium received on a policy covered by an approved treaty."
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
          { key: "bordereauRef", label: "Bordereau", render: (r) => r.bordereauRef || <Badge tone="amber">Unreported</Badge> },
        ]}
      />
    </Panel>
  );
}

// ── recoveries ──────────────────────────────────────────────────────────────────────────────────

const RECOVERY_STATUS = {
  EXPECTED: ["Receivable", "amber"],
  DISPUTED: ["Disputed", "red"],
  WRITE_OFF_PENDING: ["Write-off to approve", "amber"],
  RECEIVED: ["Received", "green"],
  WRITTEN_OFF: ["Written off", undefined],
};

// What each recovery step asks for: [title, description, fields, submit label].
const RECOVERY_STEPS = {
  receive: [
    "Record cash from the reinsurer",
    "Part or all of what is outstanding. Posted to cash against the recovery receivable.",
    [
      ["amount", "Amount received (BWP)", "number"],
      ["receivedOn", "Received on", "date"],
      ["reference", "Reinsurer's payment reference", "text"],
    ],
    "Record receipt",
  ],
  dispute: ["Record a dispute", "The recovery stays receivable while the dispute is open.", [["reason", "What the reinsurer disputes", "area"]], "Record dispute"],
  resolve: ["Resolve the dispute", "The recovery returns to receivable.", [["note", "How it was resolved", "area"]], "Resolve"],
  "write-off": [
    "Propose a write-off",
    "Someone other than you approves it before anything is written off.",
    [["reason", "Why it cannot be collected", "area"]],
    "Propose write-off",
  ],
  "approve-write-off": ["Approve the write-off", "What is outstanding is written off and posted.", [["note", "Note", "area"]], "Approve write-off"],
  "reject-write-off": ["Reject the write-off", "The recovery returns to receivable.", [["note", "Why it is rejected", "area"]], "Reject write-off"],
};

const RECOVERY_DONE = {
  receive: "Receipt recorded",
  dispute: "Dispute recorded",
  resolve: "Dispute resolved",
  "write-off": "Write-off proposed",
  "approve-write-off": "Write-off approved",
  "reject-write-off": "Write-off rejected",
};

function Recoveries({ session, notify, profile, resource }) {
  const [step, setStep] = useState(null);
  const action = useAction(notify);
  const manage = can(profile, "MANAGE_REINSURANCE");
  const approver = can(profile, "APPROVE_TREATY");
  const me = profile?.username;
  const submit = async () => {
    const { recovery, kind, ...body } = step;
    const done = await action.run(
      () => request(session, "/reinsurance/recoveries/" + recovery.ref + "/" + kind, { method: "POST", body }),
      RECOVERY_DONE[kind] + " · " + recovery.ref,
    );
    if (done) {
      setStep(null);
      resource.reload();
    }
  };
  const open = (recovery, kind) =>
    setStep({ recovery, kind, ...(kind === "receive" ? { amount: recovery.outstanding, receivedOn: today() } : {}) });
  return (
    <Panel
      title="Claim recoveries"
      subtitle="The reinsurer's share of each paid claim on a ceded policy, followed to the cash. Recorded separately; the customer's payout never waits for it."
    >
      <ErrorNote error={resource.error} />
      <DataTable
        rows={resource.data}
        loading={resource.loading}
        rowKey={(r) => r.ref}
        empty="No recoveries"
        emptyDetail="A recovery is recognised when a claim is paid on a ceded policy."
        columns={[
          { key: "ref", label: "Recovery" },
          { key: "createdAt", label: "Recognised", render: (r) => when(r.createdAt) },
          { key: "claimRef", label: "Claim" },
          { key: "policyRef", label: "Policy" },
          { key: "treatyRef", label: "Treaty", render: (r) => r.treatyRef + " · " + r.reinsurer },
          { key: "claimAmount", label: "Claim paid", align: "right", render: (r) => pula(r.claimAmount) },
          { key: "cededShare", label: "Share", align: "right", render: (r) => share(r.cededShare) },
          { key: "recoveryAmount", label: "Recovery", align: "right", render: (r) => pula(r.recoveryAmount) },
          { key: "receivedAmount", label: "Received", align: "right", render: (r) => pula(r.receivedAmount || 0) },
          {
            key: "status",
            label: "Status",
            render: (r) => {
              const [text, tone] = RECOVERY_STATUS[r.status] || [r.status];
              return (
                <span title={r.statusNote || ""}>
                  <Badge tone={tone}>{text}</Badge>
                  {r.statusNote && <small className="ws-hint"> {r.statusNote}</small>}
                </span>
              );
            },
          },
          {
            key: "act",
            label: "",
            render: (r) => (
              <div className="ws-row-actions">
                {manage && ["EXPECTED", "DISPUTED"].includes(r.status) && (
                  <Button variant="secondary" onClick={() => open(r, "receive")}>
                    Record receipt
                  </Button>
                )}
                {manage && r.status === "EXPECTED" && (
                  <Button variant="secondary" onClick={() => open(r, "dispute")}>
                    Dispute
                  </Button>
                )}
                {manage && r.status === "DISPUTED" && (
                  <Button variant="secondary" onClick={() => open(r, "resolve")}>
                    Resolve
                  </Button>
                )}
                {manage && ["EXPECTED", "DISPUTED"].includes(r.status) && (
                  <Button variant="secondary" onClick={() => open(r, "write-off")}>
                    Write off
                  </Button>
                )}
                {r.status === "WRITE_OFF_PENDING" &&
                  (approver && r.proposedBy !== me ? (
                    <>
                      <Button variant="secondary" onClick={() => open(r, "approve-write-off")}>
                        Approve write-off
                      </Button>
                      <Button variant="secondary" onClick={() => open(r, "reject-write-off")}>
                        Reject
                      </Button>
                    </>
                  ) : (
                    <small className="ws-hint">Needs another approver</small>
                  ))}
              </div>
            ),
          },
        ]}
      />
      {step && (
        <Drawer
          title={RECOVERY_STEPS[step.kind][0] + " · " + step.recovery.ref}
          description={RECOVERY_STEPS[step.kind][1] + " Outstanding: " + pula(step.recovery.outstanding) + "."}
          onClose={() => setStep(null)}
        >
          <FormGrid submitLabel={RECOVERY_STEPS[step.kind][3]} busy={action.busy} error={action.error} onSubmit={submit}>
            {RECOVERY_STEPS[step.kind][2].map(([key, label, type]) => (
              <Field key={key} label={label} full={type === "area"}>
                {type === "area" ? (
                  <textarea rows={3} required value={step[key] || ""} onChange={(e) => setStep({ ...step, [key]: e.target.value })} />
                ) : (
                  <input
                    type={type}
                    required
                    step={type === "number" ? "0.01" : undefined}
                    min={type === "number" ? "0.01" : undefined}
                    max={type === "number" ? step.recovery.outstanding : type === "date" ? today() : undefined}
                    value={step[key] ?? ""}
                    onChange={(e) => setStep({ ...step, [key]: e.target.value })}
                  />
                )}
              </Field>
            ))}
          </FormGrid>
        </Drawer>
      )}
    </Panel>
  );
}

const BORDEREAU_STATUS = {
  SUBMITTED: ["Submitted", "blue"],
  ACKNOWLEDGED: ["Acknowledged", "amber"],
  CORRECTION_REQUESTED: ["Correction requested", "red"],
  SETTLED: ["Settled", "green"],
};
const BORDEREAU_NEXT = { SUBMITTED: ["acknowledge", "correction"], ACKNOWLEDGED: ["settle", "correction"], CORRECTION_REQUESTED: ["resubmit"] };
// [title, description, [field, label], button]
const BORDEREAU_STEPS = {
  acknowledge: ["Reinsurer acknowledged", "The reinsurer has received and accepted the bordereau.", ["reinsurerRef", "Reinsurer's reference"], "Acknowledged"],
  correction: ["Correction requested", "The reinsurer asked for a correction; resubmit it once corrected.", ["note", "What must be corrected"], "Needs correction"],
  resubmit: ["Resubmit", "The corrected bordereau is sent again.", ["note", "What was corrected"], "Resubmit"],
  settle: ["Ceded premium paid", "The premium on this bordereau was paid to the reinsurer. Posted to cash.", ["settlementRef", "Payment reference"], "Settled"],
};

// ── bordereaux ──────────────────────────────────────────────────────────────────────────────────

function Bordereaux({ session, notify, profile, treaties, onChange }) {
  const bordereaux = useResource(session, "/reinsurance/bordereaux", []);
  const approved = treaties.filter((t) => t.status === "APPROVED");
  const [form, setForm] = useState(null);
  const action = useAction(notify);

  const [step, setStep] = useState(null);
  const move = async () => {
    const { bordereau, kind, ...body } = step;
    const done = await action.run(
      () => request(session, "/reinsurance/bordereaux/" + bordereau.ref + "/" + kind, { method: "POST", body }),
      BORDEREAU_STEPS[kind][3] + " · " + bordereau.ref,
    );
    if (done) {
      setStep(null);
      bordereaux.reload();
    }
  };
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
            {
              key: "status",
              label: "Status",
              render: (r) => {
                const [text, tone] = BORDEREAU_STATUS[r.status] || [r.status];
                return (
                  <span>
                    <Badge tone={tone}>{text}</Badge>
                    {(r.reinsurerRef || r.settlementRef || r.statusNote) && (
                      <small className="ws-hint">
                        {" "}
                        {[r.reinsurerRef && "ack " + r.reinsurerRef, r.settlementRef && "paid " + r.settlementRef, r.statusNote]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    )}
                  </span>
                );
              },
            },
            { key: "createdAt", label: "Produced", render: (r) => when(r.createdAt) + " · " + r.createdBy },
            {
              key: "act",
              label: "",
              render: (r) =>
                can(profile, "MANAGE_REINSURANCE") && (
                  <div className="ws-row-actions">
                    {(BORDEREAU_NEXT[r.status] || []).map((kind) => (
                      <Button key={kind} variant="secondary" onClick={() => setStep({ bordereau: r, kind })}>
                        {BORDEREAU_STEPS[kind][3]}
                      </Button>
                    ))}
                  </div>
                ),
            },
          ]}
        />
      </Panel>
      {step && (
        <Drawer title={BORDEREAU_STEPS[step.kind][0] + " · " + step.bordereau.ref} description={BORDEREAU_STEPS[step.kind][1]} onClose={() => setStep(null)}>
          <FormGrid submitLabel={BORDEREAU_STEPS[step.kind][3]} busy={action.busy} error={action.error} onSubmit={move}>
            <Field label={BORDEREAU_STEPS[step.kind][2][1]} full>
              <input required value={step[BORDEREAU_STEPS[step.kind][2][0]] || ""} onChange={(e) => setStep({ ...step, [BORDEREAU_STEPS[step.kind][2][0]]: e.target.value })} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}
