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
    .filter((r) => r.status === "EXPECTED")
    .reduce((s, r) => s + Number(r.recoveryAmount || 0), 0);

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
        onChange={setTab}
        tabs={[
          ["treaties", "Treaties"],
          ["cessions", "Cessions"],
          ["recoveries", "Recoveries"],
          ["bordereaux", "Bordereaux"],
        ]}
      />
      {tab === "treaties" && <Treaties session={session} notify={notify} profile={profile} resource={treaties} />}
      {tab === "cessions" && <Cessions session={session} treaties={list} />}
      {tab === "recoveries" && <Recoveries resource={recoveries} />}
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
        subtitle="Only an approved treaty in force cedes. The user who drafts a treaty cannot approve it, except Super user and Super admin. Approved treaties may not overlap for a product."
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
                (r.createdBy === me && !profile?.superAdmin ? (
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

function Recoveries({ resource }) {
  return (
    <Panel
      title="Claim recoveries"
      subtitle="The reinsurer's share of each paid claim on a ceded policy. Recorded separately; the customer's payout never waits for it."
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
          { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
        ]}
      />
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
