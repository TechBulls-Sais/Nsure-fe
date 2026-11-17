import React, { useMemo, useState } from "react";
import { CheckCircle2, Plus, XCircle } from "lucide-react";
import { request } from "../api";
import { Badge, Button, DataTable, ErrorNote, Field, FormGrid, Panel, can, useAction, useResource, when } from "../ui/workspace";

// SH02 records and workspace: the approval log of versioned product terms (propose, a second person approves or
// rejects) and a side-by-side comparison of saved product configuration versions.

const TERMS_STATUS = {
  APPROVED: ["Approved", "green"],
  PENDING_APPROVAL: ["Awaiting approval", "amber"],
  REJECTED: ["Rejected", undefined],
};
const today = () => new Date().toISOString().slice(0, 10);

/** Product terms versions for one product: who proposed what, who approved or rejected it, and from when. */
export function ProductTermsLog({ session, notify, profile, products = [] }) {
  const [product, setProduct] = useState(products[0]?.name || "");
  const path = product ? "/portfolio/products/" + encodeURIComponent(product) + "/versions" : null;
  const versions = useResource(session, path, []);
  const action = useAction(notify);
  const [proposal, setProposal] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const me = (profile?.username || "").toLowerCase();
  const list = versions.data || [];
  const latest = list[0];
  const pending = list.find((v) => v.approvalStatus === "PENDING_APPROVAL");

  const propose = async () => {
    const body = { reason: proposal.reason, effectiveFrom: proposal.effectiveFrom, baseVersion: latest?.version };
    for (const key of ["waitingPeriodDays", "gracePeriodDays", "maxBeneficiaries"]) {
      if (proposal[key] !== "" && proposal[key] != null) body[key] = Number(proposal[key]);
    }
    if (proposal.wordingRef) body.wordingRef = proposal.wordingRef;
    const done = await action.run(() => request(session, path, { method: "POST", body }), "Change proposed for approval");
    if (done) {
      setProposal(null);
      versions.reload();
    }
  };
  const decide = async (version, verb, body) => {
    const done = await action.run(
      () => request(session, path + "/" + version + "/" + verb, { method: "POST", body: body || {} }),
      product + " v" + version + (verb === "approve" ? " approved" : " rejected"),
    );
    if (done) {
      setRejecting(null);
      versions.reload();
    }
  };

  return (
    <Panel
      title="Product terms approval log"
      subtitle="Each change to a product's terms is proposed with a reason and approved by someone else. It reaches new business only from its start date; issued policies keep the terms they were sold under."
      action={
        <select aria-label="Product" value={product} onChange={(e) => setProduct(e.target.value)}>
          {products.map((p) => (
            <option key={p.name}>{p.name}</option>
          ))}
        </select>
      }
    >
      <ErrorNote error={versions.error} />
      <DataTable
        rows={list}
        rowKey={(v) => v.id}
        searchFrom={99}
        loading={versions.loading && !list.length}
        empty="No terms versions for this product"
        columns={[
          { key: "version", label: "Version", render: (v) => "v" + v.version + (v.inForce ? " · in force" : "") },
          {
            key: "approvalStatus",
            label: "Status",
            render: (v) => {
              const [label, tone] = TERMS_STATUS[v.approvalStatus] || [v.approvalStatus];
              return <Badge tone={tone}>{label}</Badge>;
            },
          },
          { key: "effectiveFrom", label: "New business", render: (v) => v.effectiveFrom + " → " + (v.effectiveTo || "open") },
          {
            key: "terms",
            label: "Terms",
            render: (v) =>
              v.waitingPeriodDays + " days waiting · " + v.gracePeriodDays + " days grace · up to " + v.maxBeneficiaries + " beneficiaries · " + v.wordingRef,
          },
          { key: "proposedBy", label: "Proposed", render: (v) => (v.proposedBy || "—") + " · " + when(v.recordedAt) },
          {
            key: "approvedBy",
            label: "Decided",
            render: (v) =>
              v.approvedBy
                ? v.approvedBy + " · " + when(v.approvedAt) + (v.rejectionReason ? " · rejected: " + v.rejectionReason : "")
                : "—",
          },
          { key: "changeReason", label: "Reason", render: (v) => v.changeReason || "—" },
          { key: "policies", label: "Policies", align: "right" },
        ]}
      />
      <ErrorNote error={action.error} />
      {pending && can(profile, "ACTIVATE_PRODUCT") && (
        <div className="ws-form-actions">
          {(pending.proposedBy || "").toLowerCase() === me ? (
            <small className="ws-hint">You proposed v{pending.version}; another user approves or rejects it.</small>
          ) : rejecting ? (
            <>
              <input
                aria-label="Rejection reason"
                placeholder="Why it is rejected"
                value={rejecting.reason}
                onChange={(e) => setRejecting({ ...rejecting, reason: e.target.value })}
              />
              <Button variant="secondary" onClick={() => setRejecting(null)}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                icon={XCircle}
                busy={action.busy}
                disabled={!rejecting.reason.trim()}
                onClick={() => decide(pending.version, "reject", { reason: rejecting.reason })}
              >
                Reject v{pending.version}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" icon={XCircle} onClick={() => setRejecting({ reason: "" })}>
                Reject v{pending.version}
              </Button>
              <Button icon={CheckCircle2} busy={action.busy} onClick={() => decide(pending.version, "approve")}>
                Approve v{pending.version}
              </Button>
            </>
          )}
        </div>
      )}
      {!pending && latest && can(profile, "UPDATE_PRODUCT") && !proposal && (
        <div className="ws-form-actions">
          <Button
            variant="secondary"
            icon={Plus}
            onClick={() =>
              setProposal({
                effectiveFrom: today(),
                waitingPeriodDays: latest.waitingPeriodDays,
                gracePeriodDays: latest.gracePeriodDays,
                maxBeneficiaries: latest.maxBeneficiaries,
                wordingRef: latest.wordingRef,
                reason: "",
              })
            }
          >
            Propose a change
          </Button>
        </div>
      )}
      {proposal && (
        <FormGrid
          submitLabel="Propose for approval"
          busy={action.busy}
          error={action.error}
          onSubmit={propose}
          extra={
            <Button type="button" variant="secondary" onClick={() => setProposal(null)}>
              Cancel
            </Button>
          }
        >
          <Field label="For new business from">
            <input type="date" min={today()} value={proposal.effectiveFrom} onChange={(e) => setProposal({ ...proposal, effectiveFrom: e.target.value })} required />
          </Field>
          <Field label="Waiting period (days)">
            <input type="number" min="0" max="3650" value={proposal.waitingPeriodDays} onChange={(e) => setProposal({ ...proposal, waitingPeriodDays: e.target.value })} />
          </Field>
          <Field label="Grace period (days)">
            <input type="number" min="0" max="365" value={proposal.gracePeriodDays} onChange={(e) => setProposal({ ...proposal, gracePeriodDays: e.target.value })} />
          </Field>
          <Field label="Most beneficiaries">
            <input type="number" min="1" max="20" value={proposal.maxBeneficiaries} onChange={(e) => setProposal({ ...proposal, maxBeneficiaries: e.target.value })} />
          </Field>
          <Field label="Wording" full>
            <input value={proposal.wordingRef} onChange={(e) => setProposal({ ...proposal, wordingRef: e.target.value })} />
          </Field>
          <Field label="Why it changes" full>
            <textarea rows={2} value={proposal.reason} onChange={(e) => setProposal({ ...proposal, reason: e.target.value })} required />
          </Field>
        </FormGrid>
      )}
    </Panel>
  );
}

const CONFIG_FIELDS = [
  ["name", "Name"],
  ["code", "Code"],
  ["domain", "Business line"],
  ["currency", "Currency"],
  ["description", "Description"],
  ["effective", "Effective"],
  ["minAge", "Minimum entry age"],
  ["maxAge", "Maximum entry age"],
  ["waitingMonths", "Waiting period (months)"],
  ["cover", "Benefit limit"],
  ["premium", "Premium"],
  ["frequency", "Frequency"],
  ["graceDays", "Grace period (days)"],
  ["underwriting", "Underwriting"],
  ["benefits", "Benefits"],
  ["channels", "Channels"],
  ["wording", "Wording"],
  ["status", "Status"],
];
const show = (value) => (value === null || value === undefined || value === "" ? "—" : String(value));

/** Two saved versions of a product configuration side by side, with the fields that changed marked. */
export function ConfigVersionCompare({ session }) {
  const configs = useResource(session, "/portfolio/product-configs", []);
  const [ref, setRef] = useState("");
  const chosen = ref || configs.data?.[0]?.id || "";
  const versions = useResource(session, chosen ? "/portfolio/product-configs/" + encodeURIComponent(chosen) + "/versions" : null, []);
  const list = versions.data || [];
  const [pair, setPair] = useState({});
  const newer = pair.ref === chosen && pair.b != null ? pair.b : list[0]?.version;
  const older = pair.ref === chosen && pair.a != null ? pair.a : (list[1] || list[0])?.version;
  const a = list.find((v) => v.version === Number(older));
  const b = list.find((v) => v.version === Number(newer));
  const rows = useMemo(
    () =>
      a && b
        ? CONFIG_FIELDS.map(([key, label]) => {
            const before = key === "status" ? a.status : a.snapshot?.[key];
            const after = key === "status" ? b.status : b.snapshot?.[key];
            return { key, label, before: show(before), after: show(after), changed: show(before) !== show(after) };
          })
        : [],
    [a, b],
  );
  const changed = rows.filter((r) => r.changed).length;
  return (
    <Panel
      title="Product configuration versions"
      subtitle="Every save keeps an immutable version. Compare any two to see exactly what changed, and who saved each."
      action={
        <select aria-label="Configuration" value={chosen} onChange={(e) => setRef(e.target.value)}>
          {(configs.data || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.id} · {c.name}
            </option>
          ))}
        </select>
      }
    >
      <ErrorNote error={configs.error || versions.error} />
      {list.length > 0 && (
        <div className="field-grid">
          <Field label="Compare version">
            <select value={older} onChange={(e) => setPair({ ref: chosen, a: Number(e.target.value), b: newer })}>
              {list.map((v) => (
                <option key={v.version} value={v.version}>
                  v{v.version} · {v.status} · {v.savedBy}
                </option>
              ))}
            </select>
          </Field>
          <Field label="With version">
            <select value={newer} onChange={(e) => setPair({ ref: chosen, a: older, b: Number(e.target.value) })}>
              {list.map((v) => (
                <option key={v.version} value={v.version}>
                  v{v.version} · {v.status} · {v.savedBy}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      {a && b && (
        <p className="ws-hint">
          v{a.version} saved by {a.savedBy} · {when(a.savedAt)} → v{b.version} saved by {b.savedBy} · {when(b.savedAt)}:{" "}
          {changed ? changed + (changed === 1 ? " field differs." : " fields differ.") : "no differences."}
        </p>
      )}
      <DataTable
        rows={rows}
        rowKey={(r) => r.key}
        searchFrom={99}
        pageSize={30}
        loading={versions.loading && !list.length}
        empty={chosen ? "No saved versions yet: versions are kept from the first save in the product studio." : "No configurations"}
        columns={[
          { key: "label", label: "Field", render: (r) => (r.changed ? <strong>{r.label}</strong> : r.label) },
          { key: "before", label: a ? "v" + a.version : "Before" },
          { key: "after", label: b ? "v" + b.version : "After", render: (r) => (r.changed ? <Badge tone="amber">{r.after}</Badge> : r.after) },
        ]}
      />
    </Panel>
  );
}

/**
 * The release checklist (SH02): what a configuration release has passed on its way to new business. Each step is
 * enforced by the server; the list shows where the release stands.
 */
export function ReleaseChecklist({ release }) {
  const forms = release.forms || [];
  const reviewer = release.approvedBy;
  const checks = [
    ["At least one product form", forms.length > 0],
    ["Every form defines its fields", forms.length > 0 && forms.every((f) => (f.fields || []).length > 0)],
    ["Submitted for review, content fixed by checksum", Boolean(release.checksum && release.submittedBy)],
    [
      "Reviewed by someone other than its maker",
      Boolean(reviewer && reviewer !== release.createdBy && reviewer !== release.submittedBy),
    ],
    ["Activated for new business", Boolean(release.activatedBy)],
  ];
  const done = checks.filter(([, ok]) => ok).length;
  return (
    <div className="ws-checklist" aria-label="Release checklist">
      <h3 className="section-title">
        Release checklist <Badge tone={done === checks.length ? "green" : "amber"}>{done + " of " + checks.length}</Badge>
      </h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
        {checks.map(([label, ok]) => (
          <li key={label} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {ok ? <CheckCircle2 size={16} color="var(--green, #16a34a)" /> : <XCircle size={16} color="var(--muted, #94a3b8)" />}
            <span>{label}</span>
          </li>
        ))}
      </ul>
      {release.status === "REJECTED" && <small className="ws-hint">Rejected releases stay as history and are never activated.</small>}
    </div>
  );
}
