import React, { useState } from "react";
import { CheckCircle2, Pencil, Play, Plus } from "lucide-react";
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

// IL03 policy administration and IL04 family administration: previewed endorsements, dated insured lives,
// contractual benefits the product defines, reinstatements and reasoned terminations.

const TYPE_LABEL = {
  PAYER: "Change the payer",
  OWNERSHIP: "Transfer ownership",
  SUM_ASSURED: "Change the sum assured",
  FREQUENCY: "Change premium frequency",
  ADD_LIFE: "Add an insured life",
  REMOVE_LIFE: "Remove an insured life",
  REPLACE_LIFE: "Replace an insured life",
};
const ROUTE = {
  APPLY: ["Applies immediately", "green"],
  APPROVAL: ["Needs a second person's approval", "amber"],
  UNDERWRITING: ["Goes to underwriting", "amber"],
  IMPACT_REVIEW: ["Held for impact review", "red"],
};
const END_STATUS = {
  APPLIED: ["Applied", "green"],
  PENDING_APPROVAL: ["Awaiting approval", "amber"],
  REFERRED_UNDERWRITING: ["With underwriting", "amber"],
  IMPACT_REVIEW: ["Impact review", "red"],
  REJECTED: ["Rejected", undefined],
};
const BEN_STATUS = { DUE: ["Due", "amber"], APPROVED: ["Approved", "blue"], PAID: ["Paid", "green"], DECLINED: ["Declined", undefined] };
const BENEFIT = {
  CASHBACK: "Cashback",
  RETURN_OF_PREMIUM: "Return of premium",
  MATURITY: "Maturity",
  SURRENDER: "Surrender",
  PAID_UP: "Paid-up",
};
// Why a contract ended (IL03: death, cancellation, expiry and other approved causes).
const END_CAUSE = {
  DEATH: "Death",
  CANCELLATION: "Cancellation",
  EXPIRY: "Expiry",
  LAPSE: "Lapse",
  OTHER: "Other",
  LOAN_SETTLED: "Loan settled",
};
const FREQ = { MONTHLY: "Monthly", QUARTERLY: "Quarterly", SEMI_ANNUAL: "Half-yearly", ANNUAL: "Annually", PAID_UP: "Paid-up" };
const badge = (map, key) => {
  const [label, tone] = map[key] || [key];
  return <Badge tone={tone}>{label}</Badge>;
};
const today = () => new Date().toISOString().slice(0, 10);
const signed = (v) => (Number(v) > 0 ? "+" : "") + pula(v);

export default function PolicyServicing({ session, notify, profile }) {
  const [tab, setTab] = useState("policies");
  const [open, setOpen] = useState(null);
  const summary = useResource(session, "/servicing/summary", null);
  const s = summary.data || {};
  const loading = summary.loading && !summary.data;
  return (
    <>
      <Heading
        eyebrow="POLICY ADMINISTRATION"
        title="Policy servicing"
        subtitle="Endorsements with their effect previewed before anything changes, the lives each policy covers, the contractual benefits each product defines, reinstatements and terminations."
      />
      <div className="stat-grid">
        <Stat label="Endorsements held for review" value={s.endorsementsHeld ?? 0} tone="amber" loading={loading} />
        <Stat label="Reinstatements awaiting approval" value={s.reinstatementsPending ?? 0} tone="amber" loading={loading} />
        <Stat
          label="Benefits due"
          value={s.benefitsDue ?? 0}
          note={(s.benefitsApproved ?? 0) + " approved, awaiting payment"}
          tone="blue"
          loading={loading}
        />
        <Stat label="Life reviews open" value={s.reviewsOpen ?? 0} loading={loading} />
      </div>
      <Tabs
        value={tab}
        onChange={(next) => {
          setTab(next);
          summary.reload();
        }}
        tabs={[
          ["policies", "Policies"],
          ["endorsements", "Endorsements"],
          ["benefits", "Benefits & reinstatements"],
          ["reviews", "Life reviews"],
          ["rules", "Product rules"],
        ]}
      />
      {tab === "policies" && <Policies session={session} onOpen={setOpen} />}
      {tab === "endorsements" && (
        <Endorsements session={session} notify={notify} profile={profile} onOpen={setOpen} onChange={summary.reload} />
      )}
      {tab === "benefits" && <Benefits session={session} notify={notify} profile={profile} onChange={summary.reload} />}
      {tab === "reviews" && <Reviews session={session} notify={notify} profile={profile} onChange={summary.reload} />}
      {tab === "rules" && <Rules session={session} notify={notify} profile={profile} />}
      {open && (
        <PolicyDrawer
          session={session}
          notify={notify}
          profile={profile}
          policyRef={open}
          onClose={() => {
            setOpen(null);
            summary.reload();
          }}
        />
      )}
    </>
  );
}

// ── policies ────────────────────────────────────────────────────────────────────────────────────

function Policies({ session, onOpen }) {
  const policies = useResource(session, "/portfolio/policies", []);
  return (
    <Panel title="Policies" subtitle="Open a policy to endorse it, manage its insured lives or see its contractual benefits.">
      <ErrorNote error={policies.error} />
      <DataTable
        rows={policies.data}
        loading={policies.loading}
        rowKey={(r) => r.id}
        onRowClick={(r) => onOpen(r.id)}
        searchPlaceholder="Search policies, customers, products…"
        empty="No policies"
        columns={[
          { key: "id", label: "Policy" },
          { key: "name", label: "Policyholder" },
          { key: "product", label: "Product" },
          { key: "tier", label: "Plan", render: (r) => r.tier || "—" },
          { key: "amount", label: "Sum assured", align: "right", sortValue: (r) => Number(r.amount), render: (r) => pula(r.amount) },
          { key: "premium", label: "Premium", align: "right", sortValue: (r) => Number(r.premium), render: (r) => pula(r.premium) },
          { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "Active" ? "green" : undefined}>{r.status}</Badge> },
        ]}
      />
    </Panel>
  );
}

// ── one policy ──────────────────────────────────────────────────────────────────────────────────

function PolicyDrawer({ session, notify, profile, policyRef, onClose }) {
  const base = "/servicing/policies/" + encodeURIComponent(policyRef);
  const view = useResource(session, base, null);
  const relationships = useResource(session, "/reference/relationships", []);
  const customers = useResource(session, can(profile, "READ_CUSTOMER") ? "/portfolio/customers" : null, []);
  const action = useAction(notify);
  const [form, setForm] = useState(null);
  const [preview, setPreview] = useState(null);
  const v = view.data;
  const p = v?.policy;
  // IL04 roster: each life's limit, use, claims, underwriting outcome and warnings, keyed by life id.
  const standing = Object.fromEntries((v?.roster?.lives || []).map((s) => [s.lifeId, s]));
  // NS-IL04-006: each life's latest consent decision (the list is newest first).
  const consentOf = {};
  (v?.consents || []).forEach((c) => {
    if (!consentOf[c.lifeId]) consentOf[c.lifeId] = c;
  });
  const isAdult = (life) => life.ageNow != null && life.ageNow >= 18;
  // Relationship history: a person who was covered more than once (removed and added again, or replaced).
  const episodes = Object.values(
    (v?.lives || []).reduce((byPerson, life) => {
      const key = (life.fullName || "").toLowerCase() + "|" + (life.dateOfBirth || "");
      (byPerson[key] = byPerson[key] || []).push(life);
      return byPerson;
    }, {}),
  ).filter((list) => list.length > 1);
  // IL03 cover history: sum assured and premium over time, from issue through each applied endorsement.
  const applied = (v?.endorsements || [])
    .filter((e) => e.status === "APPLIED")
    .slice()
    .sort((a, b) => String(a.effectiveDate).localeCompare(String(b.effectiveDate)) || String(a.ref).localeCompare(String(b.ref)));
  const coverHistory = p
    ? [
        {
          key: "issue",
          from: p.coverStartDate || "—",
          change: "Issued",
          sumAssured: applied[0]?.oldSumAssured ?? p.sumAssured,
          premium: applied[0]?.oldPremium ?? p.premium,
        },
        ...applied.map((e) => ({
          key: e.ref,
          from: e.effectiveDate,
          change: (TYPE_LABEL[e.type] || e.type) + " · " + e.ref,
          sumAssured: e.newSumAssured ?? e.oldSumAssured,
          premium: e.newPremium ?? e.oldPremium,
        })),
      ]
    : [];
  const manage = can(profile, "MANAGE_SERVICING");
  const approve = can(profile, "APPROVE_ENDORSEMENT");
  const inForce = p && ["Active", "Active - No Cover", "Reinstatement Pending"].includes(p.contractStatus);

  const startEndorsement = (type, extra = {}) => {
    setPreview(null);
    setForm({ kind: "endorsement", type, effectiveDate: today(), reason: "", ...extra });
  };
  const endorsementBody = () => {
    const { kind, ...body } = form;
    return body;
  };
  const runPreview = async () => {
    const done = await action.run(() => request(session, base + "/endorsements/preview", { method: "POST", body: endorsementBody() }));
    if (done) setPreview(done.data);
  };
  const submit = async () => {
    let done;
    if (form.kind === "endorsement") {
      done = await action.run(
        () => request(session, base + "/endorsements", { method: "POST", body: endorsementBody() }),
        "Endorsement recorded",
      );
    } else if (form.kind === "surrender") {
      done = await action.run(
        () => request(session, base + "/surrender", { method: "POST", body: { reason: form.reason } }),
        "Surrender raised for approval",
      );
    } else if (form.kind === "consent") {
      done = await action.run(
        () =>
          request(session, base + "/lives/" + form.lifeId + "/consent", {
            method: "POST",
            body: { status: form.status, evidence: form.reason },
          }),
        "Consent recorded",
      );
    } else if (form.kind === "paidup") {
      done = await action.run(
        () => request(session, base + "/paid-up", { method: "POST", body: { reason: form.reason } }),
        "Policy made paid-up",
      );
    } else {
      done = await action.run(
        () => request(session, base + "/termination", { method: "POST", body: { reason: form.cause, note: form.reason } }),
        form.cause === "CANCELLATION" ? "Policy cancelled" : "Policy terminated",
      );
    }
    if (done) {
      setForm(null);
      setPreview(null);
      view.reload();
    }
  };
  const set = (key) => (e) => {
    setPreview(null);
    setForm({ ...form, [key]: e.target.value });
  };
  const relNames = (relationships.data || []).map((r) => r.name || r.relationshipName).filter((n) => n && n !== "Main Insured");

  return (
    <Drawer
      size="lg"
      title={p ? p.ref + " · " + p.customerName : policyRef}
      description={p ? p.product + (p.tier ? " " + p.tier : "") : "Loading…"}
      onClose={onClose}
    >
      <ErrorNote error={view.error} />
      {p && (
        <>
          <div className="ws-kv">
            <div>
              <small>Contract</small>
              <Badge tone={p.contractStatus === "Active" ? "green" : undefined}>{p.contractStatus}</Badge>
            </div>
            <div>
              <small>Cover</small>
              <Badge tone={p.coverStatus === "In cover" ? "green" : p.coverStatus === "No cover" ? "red" : undefined}>
                {p.coverStatus}
              </Badge>
            </div>
            <div>
              <small>Premiums</small>
              <Badge tone={p.paymentStatus === "Up to date" ? "green" : p.paymentStatus === "Overdue" ? "red" : "amber"}>
                {p.paymentStatus}
              </Badge>
            </div>
            <div>
              <small>Sum assured</small>
              <strong>{pula(p.sumAssured)}</strong>
            </div>
            <div>
              <small>Premium</small>
              <strong>
                {pula(p.modalPremium)} {(FREQ[p.premiumFrequency] || p.premiumFrequency).toLowerCase()}
              </strong>
            </div>
            <div>
              <small>Cover from</small>
              <strong>{p.coverStartDate || "—"}</strong>
            </div>
            <div>
              <small>Next premium due</small>
              <strong>{p.nextPremiumDue || (p.coverStatus === "Ended" ? "None: the policy has ended" : "—")}</strong>
            </div>
            <div>
              <small>Payer</small>
              <strong>{p.payerName ? p.payerName + " (" + p.payerRelationship + ")" : "Policyholder"}</strong>
            </div>
            <div>
              <small>Premiums received</small>
              <strong>
                {p.premiumsPaid} · {pula(p.premiumsPaidAmount)}
              </strong>
            </div>
            {p.terminationReason && (
              <div>
                <small>Ended</small>
                <strong>
                  {END_CAUSE[p.terminationReason] ||
                    BENEFIT[p.terminationReason] ||
                    p.terminationReason.charAt(0) + p.terminationReason.slice(1).toLowerCase()}{" "}
                  ·{" "}
                  {p.terminatedOn}
                </strong>
              </div>
            )}
          </div>
          {p.underwritingTerms && (
            <p className="ws-hint">
              <strong>Underwriting terms:</strong> {p.underwritingTerms}
            </p>
          )}

          <Panel
            title="Insured lives"
            subtitle="A removed life stays on the record. A life added again keeps its original waiting-period start. Limits show what claims have used, per life and for the whole policy."
            action={
              manage &&
              inForce && (
                <Button
                  variant="secondary"
                  icon={Plus}
                  onClick={() => startEndorsement("ADD_LIFE", { fullName: "", relationship: relNames[0] || "Spouse", dateOfBirth: "" })}
                >
                  Add a life
                </Button>
              )
            }
          >
            {v.roster && (
              <div className="ws-kv">
                <div>
                  <small>Policy limit (all lives)</small>
                  <strong>{pula(v.roster.policyLimit)}</strong>
                </div>
                <div>
                  <small>Used by claims</small>
                  <strong>{pula(v.roster.policyUsed)}</strong>
                </div>
                <div>
                  <small>Remaining</small>
                  <strong>{pula(v.roster.policyRemaining)}</strong>
                </div>
              </div>
            )}
            {(v.roster?.warnings || []).map((w) => (
              <p className="ws-hint" key={w}>
                <Badge tone="amber">Eligibility</Badge> {w}
              </p>
            ))}
            <DataTable
              rows={v.lives}
              rowKey={(r) => r.id}
              searchFrom={99}
              empty="This policy covers the policyholder only"
              columns={[
                {
                  key: "fullName",
                  label: "Life",
                  render: (r) => (
                    <>
                      {r.fullName}
                      {(standing[r.id]?.warnings || []).map((w) => (
                        <div key={w}>
                          <Badge tone="amber">{w}</Badge>
                        </div>
                      ))}
                    </>
                  ),
                },
                { key: "relationship", label: "Relationship" },
                { key: "ageNow", label: "Age", align: "right", render: (r) => r.ageNow ?? "—" },
                { key: "coverAmount", label: "Cover", align: "right", render: (r) => pula(r.coverAmount) },
                {
                  key: "limit",
                  label: "Limit used / left",
                  align: "right",
                  render: (r) =>
                    standing[r.id] ? pula(standing[r.id].used) + " / " + pula(standing[r.id].remaining) : "—",
                },
                { key: "claims", label: "Claims", align: "right", render: (r) => standing[r.id]?.claims ?? "—" },
                { key: "underwriting", label: "Underwriting", render: (r) => standing[r.id]?.underwriting || "—" },
                { key: "monthlyPremium", label: "Premium", align: "right", render: (r) => pula(r.monthlyPremium) },
                {
                  key: "status",
                  label: "Status",
                  render: (r) =>
                    r.status === "ACTIVE" ? (
                      <Badge tone="green">Covered</Badge>
                    ) : (
                      <Badge>Ceased {r.effectiveTo}</Badge>
                    ),
                },
                {
                  key: "waitingPeriodStart",
                  label: "Waiting period from",
                  render: (r) =>
                    (r.waitingPeriodStart || p.coverStartDate || "—") +
                    (r.continuityOf ? " · continues cover from #" + r.continuityOf : ""),
                },
                {
                  key: "consent",
                  label: "Medical evidence to policyholder",
                  render: (r) =>
                    r.mainInsured ? (
                      "Own life"
                    ) : !isAdult(r) ? (
                      "Minor: shared"
                    ) : (
                      <span className="ws-row-actions">
                        <Badge tone={consentOf[r.id]?.status === "GRANTED" ? "green" : "amber"}>
                          {consentOf[r.id]?.status === "GRANTED" ? "Consented" : "Withheld (no consent)"}
                        </Badge>
                        {manage && (
                          <Button
                            variant="secondary"
                            onClick={() =>
                              setForm({
                                kind: "consent",
                                lifeId: r.id,
                                lifeName: r.fullName,
                                status: consentOf[r.id]?.status === "GRANTED" ? "WITHDRAWN" : "GRANTED",
                                reason: "",
                              })
                            }
                          >
                            {consentOf[r.id]?.status === "GRANTED" ? "Withdraw" : "Record consent"}
                          </Button>
                        )}
                      </span>
                    ),
                },
                {
                  key: "act",
                  label: "",
                  render: (r) =>
                    manage &&
                    inForce &&
                    r.status === "ACTIVE" &&
                    !r.mainInsured && (
                      <div className="ws-row-actions">
                        <Button variant="secondary" onClick={() => startEndorsement("REMOVE_LIFE", { lifeId: r.id, lifeName: r.fullName })}>
                          Remove
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            startEndorsement("REPLACE_LIFE", {
                              lifeId: r.id,
                              lifeName: r.fullName,
                              fullName: "",
                              relationship: r.relationship,
                              dateOfBirth: "",
                            })
                          }
                        >
                          Replace
                        </Button>
                      </div>
                    ),
                },
              ]}
            />
            {episodes.length > 0 && (
              <>
                <h3 className="section-title">Relationship history</h3>
                {episodes.map((list) => (
                  <p className="ws-hint" key={list[0].id}>
                    <strong>{list[0].fullName}</strong>:{" "}
                    {list
                      .map(
                        (e) =>
                          e.relationship +
                          " from " +
                          (e.effectiveFrom || p.coverStartDate || "issue") +
                          (e.effectiveTo ? " to " + e.effectiveTo : " (covered)") +
                          (e.ceaseReason ? " · " + e.ceaseReason : ""),
                      )
                      .join(" → ")}
                  </p>
                ))}
              </>
            )}
          </Panel>

          <Panel title="Cover history" subtitle="Sum assured and premium over time: at issue, then after each applied change.">
            <DataTable
              rows={coverHistory}
              rowKey={(r) => r.key}
              searchFrom={99}
              columns={[
                { key: "from", label: "From" },
                { key: "change", label: "Change" },
                { key: "sumAssured", label: "Sum assured", align: "right", render: (r) => (r.sumAssured == null ? "—" : pula(r.sumAssured)) },
                { key: "premium", label: "Premium", align: "right", render: (r) => (r.premium == null ? "—" : pula(r.premium)) },
              ]}
            />
          </Panel>

          <Panel title="Beneficiary history" subtitle="Every designation the policy has had, current and removed.">
            <DataTable
              rows={v.beneficiaryHistory || []}
              rowKey={(r, i) => r.fullName + i}
              searchFrom={99}
              empty="No beneficiaries designated"
              columns={[
                { key: "fullName", label: "Beneficiary", render: (r) => r.fullName + (r.primary ? " (primary)" : "") },
                { key: "relationship", label: "Relationship" },
                { key: "effectiveFrom", label: "From", render: (r) => r.effectiveFrom || "—" },
                {
                  key: "removedFrom",
                  label: "Status",
                  render: (r) =>
                    r.removedFrom ? <Badge>Removed {r.removedFrom + (r.removedBy ? " by " + r.removedBy : "")}</Badge> : <Badge tone="green">Current</Badge>,
                },
              ]}
            />
          </Panel>

          <Panel
            title="Endorsements"
            subtitle="Every change is previewed first: old and new cover, the premium adjustment and the commission and reinsurance effect."
            action={
              manage &&
              inForce && (
                <Button icon={Pencil} onClick={() => startEndorsement("PAYER", { payerName: "", payerRelationship: "" })}>
                  New endorsement
                </Button>
              )
            }
          >
            <DataTable
              rows={v.endorsements}
              rowKey={(r) => r.ref}
              searchFrom={99}
              empty="No endorsements"
              columns={[
                { key: "ref", label: "Endorsement" },
                { key: "type", label: "Change", render: (r) => TYPE_LABEL[r.type] || r.type },
                { key: "effectiveDate", label: "Effective", render: (r) => r.effectiveDate + (r.backdated ? " (backdated)" : "") },
                { key: "after", label: "Result" },
                {
                  key: "newPremium",
                  label: "Premium",
                  align: "right",
                  render: (r) => (Number(r.newPremium) === Number(r.oldPremium) ? "—" : pula(r.oldPremium) + " → " + pula(r.newPremium)),
                },
                { key: "status", label: "Status", render: (r) => badge(END_STATUS, r.status) },
                { key: "requestedBy", label: "By", render: (r) => r.requestedBy + (r.decidedBy ? " / " + r.decidedBy : "") },
              ]}
            />
          </Panel>

          <Panel
            title="Contractual benefits"
            subtitle={
              v.benefitsOffered.length
                ? "This product defines: " + v.benefitsOffered.map((b) => BENEFIT[b] || b).join(", ") + "."
                : "This product defines no cashback, maturity, surrender or paid-up benefit."
            }
            action={
              <div className="ws-row-actions">
                {manage && inForce && v.surrenderOffered && (
                  <Button variant="secondary" onClick={() => setForm({ kind: "surrender", reason: "" })}>
                    Surrender
                  </Button>
                )}
                {approve && inForce && v.paidUpOffered && (
                  <Button variant="secondary" onClick={() => setForm({ kind: "paidup", reason: "" })}>
                    Make paid-up
                  </Button>
                )}
              </div>
            }
          >
            {v.schedule.length > 0 && (
              <DataTable
                rows={v.schedule}
                rowKey={(r, i) => i}
                searchFrom={99}
                columns={[
                  { key: "benefitType", label: "Scheduled benefit", render: (r) => BENEFIT[r.benefitType] || r.benefitType },
                  { key: "dueDate", label: "Next due" },
                  { key: "amount", label: "Amount", align: "right", render: (r) => pula(r.amount) },
                  { key: "basis", label: "Basis" },
                ]}
              />
            )}
            {v.benefitEvents.length > 0 && (
              <DataTable
                rows={v.benefitEvents}
                rowKey={(r) => r.ref}
                searchFrom={99}
                columns={[
                  { key: "ref", label: "Benefit" },
                  { key: "benefitType", label: "Type", render: (r) => BENEFIT[r.benefitType] || r.benefitType },
                  { key: "dueDate", label: "Due" },
                  { key: "amount", label: "Amount", align: "right", render: (r) => pula(r.amount) },
                  { key: "status", label: "Status", render: (r) => badge(BEN_STATUS, r.status) },
                ]}
              />
            )}
          </Panel>

          {v.reviews.length > 0 && (
            <Panel title="Age reviews">
              <DataTable
                rows={v.reviews}
                rowKey={(r) => r.id}
                searchFrom={99}
                columns={[
                  { key: "lifeName", label: "Life" },
                  { key: "reviewType", label: "Review", render: (r) => (r.reviewType === "CHILD_AGE_LIMIT" ? "Child age limit" : "Cover cessation age") },
                  { key: "dueDate", label: "Due" },
                  { key: "status", label: "Status" },
                  { key: "note", label: "Note" },
                ]}
              />
            </Panel>
          )}

          {approve && inForce && (
            <div className="ws-form-actions">
              <Button variant="secondary" onClick={() => setForm({ kind: "terminate", cause: "OTHER", reason: "" })}>
                Terminate policy
              </Button>
            </div>
          )}
        </>
      )}

      {form && (
        <Drawer
          title={
            form.kind === "endorsement"
              ? "Endorse " + policyRef
              : form.kind === "surrender"
                ? "Surrender " + policyRef
                : form.kind === "paidup"
                  ? "Make " + policyRef + " paid-up"
                  : form.kind === "consent"
                    ? "Consent of " + form.lifeName
                    : "Terminate " + policyRef
          }
          description={
            form.kind === "endorsement" ? "Preview the effect, then confirm. Nothing changes until you confirm." : undefined
          }
          onClose={() => {
            setForm(null);
            setPreview(null);
          }}
        >
          <FormGrid
            submitLabel={form.kind === "endorsement" ? "Confirm endorsement" : "Confirm"}
            busy={action.busy}
            error={action.error}
            onSubmit={submit}
            extra={
              form.kind === "endorsement" && (
                <Button type="button" variant="secondary" busy={action.busy} onClick={runPreview}>
                  Preview
                </Button>
              )
            }
          >
            {form.kind === "endorsement" && (
              <>
                <Field label="Change" full>
                  <select
                    value={form.type}
                    onChange={(e) => {
                      setPreview(null);
                      setForm({ kind: "endorsement", type: e.target.value, effectiveDate: form.effectiveDate, reason: form.reason });
                    }}
                    disabled={Boolean(form.lifeId) && form.type !== "ADD_LIFE"}
                  >
                    {v.endorsementTypes
                      .filter((t) => (form.lifeId ? t === form.type : !["REMOVE_LIFE", "REPLACE_LIFE"].includes(t)))
                      .map((t) => (
                        <option key={t} value={t}>
                          {TYPE_LABEL[t] || t}
                        </option>
                      ))}
                  </select>
                </Field>
                {form.type === "PAYER" && (
                  <>
                    <Field label="Payer's name">
                      <input value={form.payerName || ""} onChange={set("payerName")} required />
                    </Field>
                    <Field label="Relationship to policyholder">
                      <input value={form.payerRelationship || ""} onChange={set("payerRelationship")} required />
                    </Field>
                  </>
                )}
                {form.type === "OWNERSHIP" && (
                  <Field label="New owner" full>
                    <select value={form.newCustomerRef || ""} onChange={set("newCustomerRef")} required>
                      <option value="">Choose a verified customer</option>
                      {(customers.data || [])
                        .filter((c) => c.id !== p.customerRef)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} · {c.id}
                          </option>
                        ))}
                    </select>
                  </Field>
                )}
                {form.type === "SUM_ASSURED" &&
                  (p.tier ? (
                    <Field label="New plan" full>
                      <select value={form.tier || ""} onChange={set("tier")} required>
                        <option value="">Choose a plan</option>
                        {["Bronze", "Silver", "Gold"]
                          .filter((t) => t !== p.tier)
                          .map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                      </select>
                    </Field>
                  ) : (
                    <Field label="New sum assured (BWP)" full>
                      <input type="number" min="1" step="0.01" value={form.amount || ""} onChange={set("amount")} required />
                    </Field>
                  ))}
                {form.type === "FREQUENCY" && (
                  <Field label="Premium paid" full>
                    <select value={form.frequency || ""} onChange={set("frequency")} required>
                      <option value="">Choose a frequency</option>
                      {["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]
                        .filter((f) => f !== p.premiumFrequency)
                        .map((f) => (
                          <option key={f} value={f}>
                            {FREQ[f]}
                          </option>
                        ))}
                    </select>
                  </Field>
                )}
                {form.type === "REMOVE_LIFE" && (
                  <Field label="Life" full>
                    <input value={form.lifeName || ""} disabled />
                  </Field>
                )}
                {(form.type === "ADD_LIFE" || form.type === "REPLACE_LIFE") && (
                  <>
                    {form.type === "REPLACE_LIFE" && (
                      <Field label="Replacing" full>
                        <input value={form.lifeName || ""} disabled />
                      </Field>
                    )}
                    <Field label="Full name">
                      <input value={form.fullName || ""} onChange={set("fullName")} required />
                    </Field>
                    <Field label="Relationship">
                      <select value={form.relationship || ""} onChange={set("relationship")} required>
                        {relNames.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Date of birth">
                      <input type="date" value={form.dateOfBirth || ""} onChange={set("dateOfBirth")} required />
                    </Field>
                    <Field label="Date of birth evidence" hint="e.g. Birth certificate number or Omang">
                      <input value={form.dobEvidence || ""} maxLength={150} onChange={set("dobEvidence")} />
                    </Field>
                  </>
                )}
                <Field label="Effective date">
                  <input type="date" value={form.effectiveDate} onChange={set("effectiveDate")} required />
                </Field>
                <Field label="Reason" full>
                  <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2} required />
                </Field>
                {preview && (
                  <div className="form-label full">
                    <span>Preview</span>
                    <div className="ws-kv">
                      <div>
                        <small>Before</small>
                        <strong>{preview.before}</strong>
                      </div>
                      <div>
                        <small>After</small>
                        <strong>{preview.after}</strong>
                      </div>
                      <div>
                        <small>Monthly premium</small>
                        <strong>
                          {pula(preview.oldPremium)} → {pula(preview.newPremium)}
                        </strong>
                      </div>
                      <div>
                        <small>Adjustment this period</small>
                        <strong>{signed(preview.premiumAdjustment)}</strong>
                      </div>
                      <div>
                        <small>Commission effect (monthly)</small>
                        <strong>{signed(preview.commissionEffect)}</strong>
                      </div>
                      <div>
                        <small>Sum assured ceded</small>
                        <strong>{signed(preview.reinsuranceEffect)}</strong>
                      </div>
                      <div>
                        <small>Documents</small>
                        <strong>{preview.documents.join(", ")}</strong>
                      </div>
                      <div>
                        <small>What happens</small>
                        {badge(ROUTE, preview.route)}
                      </div>
                    </div>
                    {preview.holdReason && <small className="ws-hint">{preview.holdReason}</small>}
                  </div>
                )}
              </>
            )}
            {form.kind === "terminate" && (
              <Field label="Cause" full>
                <select value={form.cause} onChange={(e) => setForm({ ...form, cause: e.target.value })}>
                  <option value="OTHER">Other</option>
                  <option value="DEATH">Death of the life insured</option>
                  <option value="CANCELLATION">Cancellation</option>
                  <option value="EXPIRY">Expiry (the contract term ended)</option>
                  <option value="MATURITY">Maturity</option>
                </select>
                {form.cause === "CANCELLATION" && (
                  <small className="ws-hint">
                    Runs the cancellation process: cover continues to the end of today, and within the cooling-off period the
                    premiums are flagged as refundable.
                  </small>
                )}
              </Field>
            )}
            {form.kind === "consent" && (
              <Field label="Decision" full>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="GRANTED">{form.lifeName} agrees the policyholder may see their medical evidence</option>
                  <option value="WITHDRAWN">{form.lifeName} does not agree (or withdraws consent)</option>
                </select>
                <small className="ws-hint">
                  An adult insured life's medical evidence on a claim is theirs: the policyholder can open it in the portal
                  only with this consent. Record the life's own decision, not the policyholder's.
                </small>
              </Field>
            )}
            {form.kind !== "endorsement" && (
              <Field
                label={form.kind === "terminate" ? "Note" : form.kind === "consent" ? "How it was given" : "Reason"}
                full
              >
                <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} required />
              </Field>
            )}
          </FormGrid>
        </Drawer>
      )}
    </Drawer>
  );
}

// ── endorsement queue ───────────────────────────────────────────────────────────────────────────

function DecisionDrawer({ title, description, busy, error, onSubmit, onClose, approveLabel = "Approve" }) {
  const [approve, setApprove] = useState(true);
  const [note, setNote] = useState("");
  return (
    <Drawer title={title} description={description} onClose={onClose}>
      <FormGrid submitLabel="Save decision" busy={busy} error={error} onSubmit={() => onSubmit(approve, note)}>
        <Field label="Decision" full>
          <select value={approve ? "yes" : "no"} onChange={(e) => setApprove(e.target.value === "yes")}>
            <option value="yes">{approveLabel}</option>
            <option value="no">Decline</option>
          </select>
        </Field>
        <Field label="Note" full>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} required />
        </Field>
      </FormGrid>
    </Drawer>
  );
}

function Endorsements({ session, notify, profile, onOpen, onChange }) {
  const [status, setStatus] = useState("HELD");
  const rows = useResource(session, "/servicing/endorsements" + (status ? "?status=" + status : ""), []);
  const [deciding, setDeciding] = useState(null);
  const action = useAction(notify);
  const me = session?.username;
  const mayDecide = (r) =>
    r.requestedBy !== me &&
    (r.status === "REFERRED_UNDERWRITING" ? can(profile, "UNDERWRITE_APPLICATION") : can(profile, "APPROVE_ENDORSEMENT"));
  const decide = async (approve, note) => {
    const done = await action.run(
      () =>
        request(session, "/servicing/endorsements/" + deciding.ref + "/decision", { method: "POST", body: { approve, note } }),
      approve ? "Endorsement approved and applied" : "Endorsement rejected",
    );
    if (done) {
      setDeciding(null);
      rows.reload();
      onChange();
    }
  };
  return (
    <>
      <Panel
        title="Endorsements"
        subtitle="A material increase in risk is decided by underwriting; backdated and ownership changes by a second person. Nobody decides their own request."
        action={
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="HELD">Held for review</option>
            <option value="">All</option>
            <option value="APPLIED">Applied</option>
            <option value="REJECTED">Rejected</option>
          </select>
        }
      >
        <ErrorNote error={rows.error} />
        <DataTable
          rows={rows.data}
          loading={rows.loading}
          rowKey={(r) => r.ref}
          empty="Nothing here"
          searchPlaceholder="Search endorsements…"
          columns={[
            { key: "ref", label: "Endorsement" },
            {
              key: "policyRef",
              label: "Policy",
              render: (r) => (
                <button type="button" className="link-button" onClick={() => onOpen(r.policyRef)}>
                  {r.policyRef}
                </button>
              ),
            },
            { key: "customerName", label: "Policyholder" },
            { key: "type", label: "Change", render: (r) => TYPE_LABEL[r.type] || r.type },
            { key: "effectiveDate", label: "Effective", render: (r) => r.effectiveDate + (r.backdated ? " (backdated)" : "") },
            { key: "after", label: "Result" },
            { key: "holdReason", label: "Held because", render: (r) => r.holdReason || "—" },
            { key: "status", label: "Status", render: (r) => badge(END_STATUS, r.status) },
            { key: "requestedBy", label: "Requested by", render: (r) => r.requestedBy + " · " + when(r.requestedAt) },
            {
              key: "act",
              label: "",
              render: (r) =>
                ["PENDING_APPROVAL", "REFERRED_UNDERWRITING", "IMPACT_REVIEW"].includes(r.status) &&
                (mayDecide(r) ? (
                  <Button variant="secondary" icon={CheckCircle2} onClick={() => setDeciding(r)}>
                    Decide
                  </Button>
                ) : (
                  r.requestedBy === me && <small className="ws-hint">Needs another person</small>
                )),
            },
          ]}
        />
      </Panel>
      {deciding && (
        <DecisionDrawer
          title={"Decide " + deciding.ref}
          description={(TYPE_LABEL[deciding.type] || deciding.type) + " on " + deciding.policyRef + ": " + deciding.after}
          approveLabel="Approve and apply"
          busy={action.busy}
          error={action.error}
          onSubmit={decide}
          onClose={() => setDeciding(null)}
        />
      )}
    </>
  );
}

// ── benefits and reinstatements ─────────────────────────────────────────────────────────────────

function Benefits({ session, notify, profile, onChange }) {
  const events = useResource(session, "/servicing/benefit-events", []);
  const pending = useResource(session, "/servicing/reinstatements", []);
  const action = useAction(notify);
  const [deciding, setDeciding] = useState(null); // {kind: "benefit" | "reinstatement" | "pay", row}
  const [reference, setReference] = useState("");
  const reload = () => {
    events.reload();
    pending.reload();
    onChange();
  };
  const run = async () => {
    const done = await action.run(() => request(session, "/servicing/benefit-events/run", { method: "POST" }));
    if (done) {
      notify(done.data.created ? done.data.created + " benefit(s) raised" : "No new benefits have fallen due", "success");
      reload();
    }
  };
  const decide = async (approve, note) => {
    const path =
      deciding.kind === "benefit"
        ? "/servicing/benefit-events/" + deciding.row.ref + "/decision"
        : "/servicing/policies/" + deciding.row.ref + "/reinstatement";
    const done = await action.run(() => request(session, path, { method: "POST", body: { approve, note } }), "Decision saved");
    if (done) {
      setDeciding(null);
      reload();
    }
  };
  const pay = async () => {
    const done = await action.run(
      () =>
        request(session, "/servicing/benefit-events/" + deciding.row.ref + "/payment", {
          method: "POST",
          body: { paymentReference: reference },
        }),
      "Payment recorded",
    );
    if (done) {
      setDeciding(null);
      setReference("");
      reload();
    }
  };
  return (
    <>
      {(pending.data || []).length > 0 && (
        <Panel
          title="Reinstatements awaiting approval"
          subtitle="A premium was received while cover was off, on a product whose rules need the reinstatement approved."
        >
          <DataTable
            rows={pending.data}
            rowKey={(r) => r.ref}
            searchFrom={99}
            columns={[
              { key: "ref", label: "Policy" },
              { key: "customerName", label: "Policyholder" },
              { key: "product", label: "Product" },
              { key: "premium", label: "Premium", align: "right", render: (r) => pula(r.premium) },
              {
                key: "act",
                label: "",
                render: (r) =>
                  can(profile, "APPROVE_ENDORSEMENT") && (
                    <Button variant="secondary" onClick={() => setDeciding({ kind: "reinstatement", row: r })}>
                      Decide
                    </Button>
                  ),
              },
            ]}
          />
        </Panel>
      )}
      <Panel
        title="Contractual benefits"
        subtitle="Cashback, return of premium, maturity and surrender values raised from each product's rules. The run raises each benefit once when it falls due."
        action={
          can(profile, "MANAGE_SERVICING") && (
            <Button icon={Play} busy={action.busy} onClick={run}>
              Run benefit run
            </Button>
          )
        }
      >
        <ErrorNote error={events.error || action.error} />
        <DataTable
          rows={events.data}
          loading={events.loading}
          rowKey={(r) => r.ref}
          empty="No benefits have fallen due"
          searchPlaceholder="Search benefits, policies…"
          columns={[
            { key: "ref", label: "Benefit" },
            { key: "policyRef", label: "Policy" },
            { key: "customerName", label: "Policyholder" },
            { key: "benefitType", label: "Type", render: (r) => BENEFIT[r.benefitType] || r.benefitType },
            { key: "dueDate", label: "Due" },
            { key: "amount", label: "Amount", align: "right", sortValue: (r) => Number(r.amount), render: (r) => pula(r.amount) },
            { key: "basis", label: "Basis" },
            { key: "status", label: "Status", render: (r) => badge(BEN_STATUS, r.status) },
            {
              key: "act",
              label: "",
              render: (r) =>
                can(profile, "APPROVE_BENEFIT") &&
                (r.status === "DUE" ? (
                  <Button variant="secondary" onClick={() => setDeciding({ kind: "benefit", row: r })}>
                    Assess
                  </Button>
                ) : (
                  r.status === "APPROVED" && (
                    <Button variant="secondary" onClick={() => setDeciding({ kind: "pay", row: r })}>
                      Record payment
                    </Button>
                  )
                )),
            },
          ]}
        />
      </Panel>
      {deciding && deciding.kind !== "pay" && (
        <DecisionDrawer
          title={deciding.kind === "benefit" ? "Assess " + deciding.row.ref : "Reinstate " + deciding.row.ref}
          description={
            deciding.kind === "benefit"
              ? (BENEFIT[deciding.row.benefitType] || deciding.row.benefitType) + " of " + pula(deciding.row.amount) + ". " + deciding.row.basis
              : "Approving restores cover from today with no new waiting period."
          }
          busy={action.busy}
          error={action.error}
          onSubmit={decide}
          onClose={() => setDeciding(null)}
        />
      )}
      {deciding && deciding.kind === "pay" && (
        <Drawer
          title={"Pay " + deciding.row.ref}
          description={pula(deciding.row.amount) + " to " + deciding.row.customerName}
          onClose={() => setDeciding(null)}
        >
          <FormGrid submitLabel="Record payment" busy={action.busy} error={action.error} onSubmit={pay}>
            <Field label="Payment reference" full>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. EFT-2026-0412" required />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

// ── life reviews ────────────────────────────────────────────────────────────────────────────────

function Reviews({ session, notify, profile, onChange }) {
  const rows = useResource(session, "/servicing/life-reviews", []);
  const action = useAction(notify);
  const [closing, setClosing] = useState(null);
  const run = async () => {
    const done = await action.run(() => request(session, "/servicing/life-reviews/run", { method: "POST" }));
    if (done) {
      notify(done.data.created ? done.data.created + " review(s) raised" : "No lives are nearing an age limit", "success");
      rows.reload();
      onChange();
    }
  };
  const close = async () => {
    const done = await action.run(
      () =>
        request(session, "/servicing/life-reviews/" + closing.id + "/close", {
          method: "POST",
          body: { outcome: closing.outcome, note: closing.note },
        }),
      "Review closed",
    );
    if (done) {
      setClosing(null);
      rows.reload();
      onChange();
    }
  };
  return (
    <>
      <Panel
        title="Age reviews"
        subtitle="Raised 90 days before an insured life reaches the child review age or the cover cessation age."
        action={
          can(profile, "MANAGE_SERVICING") && (
            <Button icon={Play} busy={action.busy} onClick={run}>
              Check for lives nearing a limit
            </Button>
          )
        }
      >
        <ErrorNote error={rows.error || action.error} />
        <DataTable
          rows={rows.data}
          loading={rows.loading}
          rowKey={(r) => r.id}
          empty="No reviews"
          columns={[
            { key: "policyRef", label: "Policy" },
            { key: "lifeName", label: "Life" },
            { key: "reviewType", label: "Review", render: (r) => (r.reviewType === "CHILD_AGE_LIMIT" ? "Child age limit" : "Cover cessation age") },
            { key: "dueDate", label: "Due" },
            { key: "note", label: "Note" },
            {
              key: "status",
              label: "Status",
              render: (r) => <Badge tone={r.status === "OPEN" ? "amber" : undefined}>{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</Badge>,
            },
            {
              key: "act",
              label: "",
              render: (r) =>
                r.status === "OPEN" &&
                can(profile, "MANAGE_SERVICING") && (
                  <Button variant="secondary" onClick={() => setClosing({ id: r.id, lifeName: r.lifeName, outcome: "CONTINUE", note: "" })}>
                    Close
                  </Button>
                ),
            },
          ]}
        />
      </Panel>
      {closing && (
        <Drawer title={"Review of " + closing.lifeName} onClose={() => setClosing(null)}>
          <FormGrid submitLabel="Close review" busy={action.busy} error={action.error} onSubmit={close}>
            <Field label="Outcome" full>
              <select value={closing.outcome} onChange={(e) => setClosing({ ...closing, outcome: e.target.value })}>
                <option value="CONTINUE">Cover continues</option>
                <option value="CEASE">Cover ceases</option>
              </select>
            </Field>
            <Field label="Note" full>
              <textarea value={closing.note} onChange={(e) => setClosing({ ...closing, note: e.target.value })} rows={3} required />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

// ── rules ───────────────────────────────────────────────────────────────────────────────────────

function Rules({ session, notify, profile }) {
  const benefits = useResource(session, "/servicing/benefit-rules", []);
  const servicing = useResource(session, "/servicing/rules", []);
  const products = useResource(session, "/public/products", []);
  const [form, setForm] = useState(null);
  const save = useAction(notify);
  const manage = can(profile, "MANAGE_BENEFIT_RULE");
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const submit = async () => {
    const { kind, ...body } = form;
    const done = await save.run(
      () =>
        kind === "benefit"
          ? request(session, "/servicing/benefit-rules", { method: "PUT", body })
          : request(session, "/servicing/rules/" + form.id, { method: "PUT", body }),
      "Rule saved",
    );
    if (done) {
      setForm(null);
      benefits.reload();
      servicing.reload();
    }
  };
  const terms = (r) =>
    [
      r.intervalMonths && "every " + r.intervalMonths + " months",
      r.premiumMultiple != null && Number(r.premiumMultiple) + " × monthly premium",
      r.percent != null && Number(r.percent) + "%",
      r.minMonths && "after " + r.minMonths + " months",
      r.termYears && r.termYears + "-year term",
    ]
      .filter(Boolean)
      .join(" · ");
  return (
    <>
      <Panel
        title="Contractual benefit rules"
        subtitle="A product offers a benefit only when it has a rule here. A product with no surrender rule shows no surrender value or action."
        action={
          manage && (
            <Button
              icon={Plus}
              onClick={() =>
                setForm({
                  kind: "benefit",
                  product: (products.data || [])[0]?.name || "",
                  benefitType: "CASHBACK",
                  intervalMonths: "",
                  premiumMultiple: "",
                  percent: "",
                  minMonths: "",
                  termYears: "",
                  description: "",
                  active: true,
                })
              }
            >
              Add rule
            </Button>
          )
        }
      >
        <ErrorNote error={benefits.error} />
        <DataTable
          rows={benefits.data}
          loading={benefits.loading}
          rowKey={(r) => r.id}
          searchFrom={99}
          empty="No benefit rules"
          columns={[
            { key: "product", label: "Product" },
            { key: "benefitType", label: "Benefit", render: (r) => BENEFIT[r.benefitType] || r.benefitType },
            { key: "terms", label: "Terms", render: terms },
            { key: "description", label: "Description" },
            { key: "active", label: "Status", render: (r) => <Badge tone={r.active ? "green" : undefined}>{r.active ? "Offered" : "Off"}</Badge> },
            {
              key: "act",
              label: "",
              render: (r) =>
                manage && (
                  <Button
                    variant="secondary"
                    icon={Pencil}
                    onClick={() =>
                      setForm({
                        kind: "benefit",
                        ...r,
                        intervalMonths: r.intervalMonths ?? "",
                        premiumMultiple: r.premiumMultiple ?? "",
                        percent: r.percent ?? "",
                        minMonths: r.minMonths ?? "",
                        termYears: r.termYears ?? "",
                      })
                    }
                  >
                    Change
                  </Button>
                ),
            },
          ]}
        />
      </Panel>
      <Panel
        title="Servicing rules"
        subtitle="Each product's servicing rules: whether a late premium restores cover by itself, backdating, review and cessation ages, how a re-added life's waiting period is treated, when removing a life needs approval, the period without cover before lapse and the cooling-off period. Seeded values are demo defaults pending the insurer's approved rules."
      >
        <ErrorNote error={servicing.error} />
        <DataTable
          rows={servicing.data}
          loading={servicing.loading}
          rowKey={(r) => r.id}
          searchFrom={99}
          columns={[
            { key: "product", label: "Product" },
            {
              key: "reinstatementNeedsApproval",
              label: "Late premium",
              render: (r) => (r.reinstatementNeedsApproval ? "Reinstatement needs approval" : "Restores cover"),
            },
            { key: "maxBackdateDays", label: "Backdating", render: (r) => "up to " + r.maxBackdateDays + " days" },
            { key: "childReviewAge", label: "Child review age", align: "right" },
            { key: "maxCoverAge", label: "Cover ceases at", align: "right" },
            { key: "reviewLeadDays", label: "Reviews raised", render: (r) => r.reviewLeadDays + " days ahead" },
            {
              key: "lifeContinuity",
              label: "Re-added life",
              render: (r) => (r.lifeContinuity === "RESTART" ? "Waiting restarts" : "Keeps first waiting start"),
            },
            {
              key: "removalApproval",
              label: "Removing a life",
              render: (r) => (r.removalApproval === "ALWAYS" ? "Always approved" : "Approved if backdated"),
            },
            { key: "noCoverMonths", label: "Lapses after", render: (r) => r.noCoverMonths + " months without cover" },
            { key: "coolingOffDays", label: "Cooling-off", render: (r) => r.coolingOffDays + " days" },
            {
              key: "act",
              label: "",
              render: (r) =>
                manage && (
                  <Button variant="secondary" icon={Pencil} onClick={() => setForm({ kind: "servicing", ...r })}>
                    Change
                  </Button>
                ),
            },
          ]}
        />
      </Panel>
      {form && (
        <Drawer
          title={form.kind === "benefit" ? "Benefit rule" : "Servicing rules: " + form.product}
          onClose={() => setForm(null)}
        >
          <FormGrid submitLabel="Save" busy={save.busy} error={save.error} onSubmit={submit}>
            {form.kind === "benefit" ? (
              <>
                <Field label="Product">
                  <select value={form.product} onChange={set("product")} disabled={Boolean(form.id)}>
                    {(products.data || []).map((x) => (
                      <option key={x.name} value={x.name}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Benefit">
                  <select value={form.benefitType} onChange={set("benefitType")} disabled={Boolean(form.id)}>
                    {Object.entries(BENEFIT).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                {form.benefitType === "CASHBACK" && (
                  <>
                    <Field label="Every (months)">
                      <input type="number" min="1" value={form.intervalMonths} onChange={set("intervalMonths")} required />
                    </Field>
                    <Field label="Monthly premiums paid back">
                      <input type="number" min="0.01" step="0.01" value={form.premiumMultiple} onChange={set("premiumMultiple")} required />
                    </Field>
                  </>
                )}
                {["RETURN_OF_PREMIUM", "MATURITY", "PAID_UP"].includes(form.benefitType) && (
                  <Field label="Term (years)">
                    <input type="number" min="1" value={form.termYears} onChange={set("termYears")} required={form.benefitType !== "PAID_UP"} />
                  </Field>
                )}
                {["RETURN_OF_PREMIUM", "MATURITY", "SURRENDER"].includes(form.benefitType) && (
                  <Field label="Percent of premiums paid">
                    <input type="number" min="0.01" max="1000" step="0.01" value={form.percent} onChange={set("percent")} required />
                  </Field>
                )}
                {["SURRENDER", "PAID_UP"].includes(form.benefitType) && (
                  <Field label="Available after (months in force)">
                    <input type="number" min="0" value={form.minMonths} onChange={set("minMonths")} />
                  </Field>
                )}
                <Field label="Description" full>
                  <textarea value={form.description} onChange={set("description")} rows={2} required />
                </Field>
                <Field label="Offered" full>
                  <label className="ri-product">
                    <input type="checkbox" checked={form.active} onChange={set("active")} />
                    <span>Policies of this product get this benefit</span>
                  </label>
                </Field>
              </>
            ) : (
              <>
                <Field label="Late premium" full>
                  <label className="ri-product">
                    <input type="checkbox" checked={form.reinstatementNeedsApproval} onChange={set("reinstatementNeedsApproval")} />
                    <span>A premium paid while cover is off needs the reinstatement approved</span>
                  </label>
                </Field>
                <Field label="Backdating allowed (days)">
                  <input type="number" min="0" max="3650" value={form.maxBackdateDays} onChange={set("maxBackdateDays")} required />
                </Field>
                <Field label="Child review age">
                  <input type="number" min="1" max="120" value={form.childReviewAge} onChange={set("childReviewAge")} required />
                </Field>
                <Field label="Cover ceases at age">
                  <input type="number" min="1" max="120" value={form.maxCoverAge} onChange={set("maxCoverAge")} required />
                </Field>
                <Field label="Raise age reviews (days ahead)">
                  <input type="number" min="0" max="365" value={form.reviewLeadDays} onChange={set("reviewLeadDays")} required />
                </Field>
                <Field label="A life removed and added again">
                  <select value={form.lifeContinuity} onChange={set("lifeContinuity")}>
                    <option value="KEEP_EARLIEST">Keeps its first waiting-period start</option>
                    <option value="RESTART">Starts a new waiting period</option>
                  </select>
                </Field>
                <Field label="Removing a life needs a second person">
                  <select value={form.removalApproval} onChange={set("removalApproval")}>
                    <option value="BACKDATED">Only when backdated</option>
                    <option value="ALWAYS">Always</option>
                  </select>
                </Field>
                <Field label="Lapses after (months without cover)">
                  <input type="number" min="0" max="24" value={form.noCoverMonths} onChange={set("noCoverMonths")} required />
                </Field>
                <Field label="Cooling-off (days)">
                  <input type="number" min="0" max="90" value={form.coolingOffDays} onChange={set("coolingOffDays")} required />
                </Field>
              </>
            )}
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}
