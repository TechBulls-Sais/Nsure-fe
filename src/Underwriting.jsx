import React, { useState } from "react";
import { CheckCircle2, FilePlus2, Pencil, RotateCcw } from "lucide-react";
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

// IL02 individual underwriting: every submitted application has a case. The rules accept a case inside every limit;
// the rest are referred here for evidence and a decision within the underwriter's authority.

const STATUS = {
  REFERRED: ["Referred", "amber"],
  EVIDENCE_PENDING: ["Evidence pending", "amber"],
  OFFERED: ["Offer sent", "blue"],
  ACCEPTED: ["Accepted", "green"],
  POSTPONED: ["Postponed", undefined],
  DECLINED: ["Declined", "red"],
};
const DECISION = {
  ACCEPT_STANDARD: "Accept on standard terms",
  ACCEPT_WITH_TERMS: "Accept with loading / exclusion",
  POSTPONE: "Postpone",
  DECLINE: "Decline",
};
const statusBadge = (s) => {
  const [label, tone] = STATUS[s] || [s];
  return <Badge tone={tone}>{label}</Badge>;
};
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export default function Underwriting({ session, notify, profile }) {
  const [tab, setTab] = useState("queue");
  const [open, setOpen] = useState(null);
  const cases = useResource(session, "/underwriting/cases", []);
  const summary = useResource(session, "/underwriting/summary", null);
  const s = summary.data || {};
  const loading = summary.loading && !summary.data;
  const reload = () => {
    cases.reload();
    summary.reload();
  };

  return (
    <>
      <Heading
        eyebrow="NEW BUSINESS"
        title="Underwriting"
        subtitle="Applications assessed against each product's underwriting rules, the evidence asked of each life, and the decisions and offers made on referred cases."
      />
      <div className="stat-grid">
        <Stat label="Awaiting decision" value={s.referred ?? 0} tone="amber" loading={loading} />
        <Stat label="Evidence pending" value={s.evidencePending ?? 0} tone="amber" loading={loading} />
        <Stat label="Offers awaiting applicant" value={s.offersPending ?? 0} tone="blue" loading={loading} />
        <Stat
          label="Accepted by rules"
          value={s.decidedByRules ?? 0}
          note={(s.total ?? 0) + " cases in total"}
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
          ["queue", "Cases"],
          ["rules", "Rules"],
          ["authority", "Authority limits"],
        ]}
      />
      {tab === "queue" && <Queue resource={cases} onOpen={setOpen} />}
      {tab === "rules" && <Rules session={session} notify={notify} profile={profile} />}
      {tab === "authority" && <Authorities session={session} notify={notify} profile={profile} />}
      {open && (
        <CaseDrawer
          session={session}
          notify={notify}
          profile={profile}
          caseRef={open}
          onClose={() => {
            setOpen(null);
            reload();
          }}
        />
      )}
    </>
  );
}

// ── queue ───────────────────────────────────────────────────────────────────────────────────────

function Queue({ resource, onOpen }) {
  const [status, setStatus] = useState("OPEN");
  const all = resource.data || [];
  const rows = all.filter((c) =>
    status === "ALL"
      ? true
      : status === "OPEN"
        ? ["REFERRED", "EVIDENCE_PENDING", "OFFERED"].includes(c.status)
        : c.status === status,
  );
  return (
    <Panel
      title="Underwriting cases"
      subtitle="Open a case to see why it was referred, request or record evidence, and decide it."
      action={
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="OPEN">Open cases</option>
          <option value="ALL">All cases</option>
          {Object.entries(STATUS).map(([key, [label]]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      }
    >
      <ErrorNote error={resource.error} />
      <DataTable
        rows={rows}
        loading={resource.loading}
        rowKey={(r) => r.ref}
        onRowClick={(r) => onOpen(r.ref)}
        empty="No cases here"
        emptyDetail="A case opens when an application is submitted."
        searchPlaceholder="Search cases, applicants, products…"
        columns={[
          { key: "ref", label: "Case" },
          { key: "applicationRef", label: "Application" },
          { key: "customerName", label: "Applicant" },
          { key: "product", label: "Product" },
          {
            key: "sumAssured",
            label: "Sum assured",
            align: "right",
            sortValue: (r) => Number(r.sumAssured),
            render: (r) => pula(r.sumAssured),
          },
          { key: "status", label: "Status", render: (r) => statusBadge(r.status) },
          {
            key: "why",
            label: "Referred because",
            render: (r) =>
              r.referralReasons?.length
                ? r.referralReasons[0] + (r.referralReasons.length > 1 ? " (+" + (r.referralReasons.length - 1) + ")" : "")
                : "—",
          },
          {
            key: "evidenceOutstanding",
            label: "Evidence due",
            align: "right",
            render: (r) => r.evidenceOutstanding || "—",
          },
          {
            key: "decidedBy",
            label: "Decided by",
            render: (r) => (r.decidedBy === "rules" ? "Rules " + r.ruleSetVersion : r.decidedBy || "—"),
          },
          { key: "updatedAt", label: "Updated", render: (r) => when(r.updatedAt) },
        ]}
      />
    </Panel>
  );
}

// ── one case ────────────────────────────────────────────────────────────────────────────────────

function CaseDrawer({ session, notify, profile, caseRef, onClose }) {
  const path = "/underwriting/cases/" + encodeURIComponent(caseRef);
  const detail = useResource(session, path, null);
  const action = useAction(notify);
  const [form, setForm] = useState(null); // {kind: "evidence" | "resolve" | "decision" | "offer" | "reopen", ...}
  const d = detail.data;
  const c = d?.underwritingCase;
  const canDecide = can(profile, "UNDERWRITE_APPLICATION");
  const canAnswer = canDecide || can(profile, "UPDATE_APPLICATION");

  const post = async (suffix, body, message) => {
    const done = await action.run(() => request(session, path + suffix, { method: "POST", body }), message);
    if (done) {
      detail.setData(done.data);
      setForm(null);
    }
  };

  const submit = () => {
    if (form.kind === "evidence") {
      return post(
        "/evidence",
        { requirement: form.requirement, lifeName: form.lifeName, restricted: form.restricted, dueDate: form.dueDate },
        "Evidence requested",
      );
    }
    if (form.kind === "resolve") {
      return post("/evidence/" + form.id + "/resolve", { status: form.status, note: form.note }, "Evidence recorded");
    }
    if (form.kind === "decision") {
      return post(
        "/decision",
        {
          decision: form.decision,
          loadingPercent: form.loadingPercent,
          exclusion: form.exclusion,
          postponeUntil: form.postponeUntil,
          reason: form.reason,
        },
        "Decision recorded",
      );
    }
    if (form.kind === "offer") {
      return post(
        "/offer",
        { accept: form.accept, note: form.note },
        form.accept ? "Offer accepted" : "Offer refused",
      );
    }
    return post("/reopen", { reason: form.reason }, "Case reopened");
  };

  const open = c && ["REFERRED", "EVIDENCE_PENDING", "OFFERED", "ACCEPTED"].includes(c.status);

  const evidenceColumns = [
    { key: "requirement", label: "Requirement" },
    { key: "lifeName", label: "Life" },
    {
      key: "status",
      label: "Status",
      render: (r) =>
        r.status === "REQUESTED" ? (
          <Badge tone={r.overdue ? "red" : "amber"}>{r.overdue ? "Overdue" : "Requested"}</Badge>
        ) : (
          <Badge tone={r.status === "RECEIVED" ? "green" : undefined}>
            {r.status === "RECEIVED" ? "Received" : "Waived"}
          </Badge>
        ),
    },
    { key: "dueDate", label: "Due" },
    {
      key: "note",
      label: "Detail",
      render: (r) => r.note || (r.restricted && r.status !== "REQUESTED" ? "Restricted" : "—"),
    },
    {
      key: "act",
      label: "",
      render: (r) =>
        canDecide &&
        r.status === "REQUESTED" && (
          <Button
            variant="secondary"
            onClick={() => setForm({ kind: "resolve", id: r.id, status: "RECEIVED", note: "" })}
          >
            Record
          </Button>
        ),
    },
  ];

  return (
    <Drawer
      size="lg"
      title={c ? c.ref + " · " + c.customerName : caseRef}
      description={c ? c.product + " application " + c.applicationRef : "Loading…"}
      onClose={onClose}
    >
      <ErrorNote error={detail.error} />
      {c && (
        <>
          <div className="ws-kv">
            <div>
              <small>Status</small>
              {statusBadge(c.status)}
            </div>
            <div>
              <small>Sum assured</small>
              <strong>{pula(c.sumAssured)}</strong>
            </div>
            <div>
              <small>Premium applied for</small>
              <strong>{pula(c.appliedPremium)}</strong>
            </div>
            <div>
              <small>Total cover with this application</small>
              <strong>{pula(c.aggregateExposure)}</strong>
            </div>
            <div>
              <small>Entry age</small>
              <strong>{c.entryAge ?? "Not recorded"}</strong>
            </div>
            <div>
              <small>Rules applied</small>
              <strong>{c.ruleSetVersion}</strong>
            </div>
            <div>
              <small>Your authority</small>
              <strong>{c.myAuthority == null ? "Not limited" : pula(c.myAuthority)}</strong>
            </div>
          </div>

          {c.referralReasons.length > 0 && (
            <Panel title="Why it was referred">
              <ul className="uw-list">
                {c.referralReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </Panel>
          )}

          {c.decision && (
            <Panel title="Decision">
              <div className="ws-kv">
                <div>
                  <small>Decision</small>
                  <strong>{DECISION[c.decision] || c.decision}</strong>
                </div>
                <div>
                  <small>Decided by</small>
                  <strong>
                    {c.decidedBy === "rules" ? "Rules " + c.ruleSetVersion : c.decidedBy} · {when(c.decidedAt)}
                  </strong>
                </div>
                {c.loadingPercent != null && (
                  <div>
                    <small>Premium loading</small>
                    <strong>{Number(c.loadingPercent)}%</strong>
                  </div>
                )}
                {c.offerPremium != null && (
                  <div>
                    <small>Offer v{c.offerVersion} premium</small>
                    <strong>{pula(c.offerPremium)}</strong>
                  </div>
                )}
                {c.postponeUntil && (
                  <div>
                    <small>Postponed until</small>
                    <strong>{c.postponeUntil}</strong>
                  </div>
                )}
                {c.offerStatus !== "NONE" && (
                  <div>
                    <small>Applicant's answer</small>
                    <strong>
                      {c.offerStatus === "PENDING"
                        ? "Awaited"
                        : (c.offerStatus === "ACCEPTED" ? "Accepted" : "Refused") + " · " + when(c.offerAcceptedAt)}
                    </strong>
                  </div>
                )}
              </div>
              {c.exclusion && (
                <p className="ws-hint">
                  <strong>Exclusion:</strong> {c.exclusion}
                </p>
              )}
              <p className="ws-hint">{c.decisionReason}</p>
            </Panel>
          )}

          <Panel
            title="Evidence"
            subtitle="Documents and checks asked of each life. Clinical evidence is in the medical panel below."
            action={
              canDecide &&
              open &&
              c.status !== "ACCEPTED" && (
                <Button
                  variant="secondary"
                  icon={FilePlus2}
                  onClick={() =>
                    setForm({
                      kind: "evidence",
                      requirement: "",
                      lifeName: c.customerName,
                      restricted: false,
                      dueDate: inDays(14),
                    })
                  }
                >
                  Request evidence
                </Button>
              )
            }
          >
            <DataTable
              rows={d.evidence.filter((r) => !r.restricted)}
              rowKey={(r) => r.id}
              empty="No evidence requested"
              searchFrom={99}
              columns={evidenceColumns}
            />
          </Panel>

          {/* IL02 medical panel: restricted clinical evidence on its own; its detail only for underwriters. */}
          {d.evidence.some((r) => r.restricted) && (
            <Panel
              title="Medical evidence"
              subtitle="Restricted: the clinical detail is shown to underwriters only; others see that it exists."
            >
              <DataTable
                rows={d.evidence.filter((r) => r.restricted)}
                rowKey={(r) => r.id}
                searchFrom={99}
                columns={evidenceColumns}
              />
            </Panel>
          )}

          {d.lives.length > 0 && (
            <Panel title="Lives on the application">
              <DataTable
                rows={d.lives}
                rowKey={(r, i) => i}
                searchFrom={99}
                columns={[
                  { key: "fullName", label: "Life" },
                  { key: "relationship", label: "Relationship" },
                  { key: "ageAtEntry", label: "Age at entry", align: "right" },
                  { key: "coverAmount", label: "Cover", align: "right", render: (r) => pula(r.coverAmount) },
                ]}
              />
            </Panel>
          )}

          <Panel title="Other cover held" subtitle="In-force contracts counted in the aggregate exposure.">
            <DataTable
              rows={d.exposure}
              rowKey={(r) => r.policyRef}
              empty="No other cover in force"
              searchFrom={99}
              columns={[
                { key: "policyRef", label: "Policy" },
                { key: "product", label: "Product" },
                { key: "sumAssured", label: "Sum assured", align: "right", render: (r) => pula(r.sumAssured) },
                { key: "status", label: "Status" },
              ]}
            />
          </Panel>

          {d.decisions.length > 0 && (
            <Panel title="Decision history" subtitle="Every decision stays on the record; a later one never replaces it.">
              <DataTable
                rows={d.decisions}
                rowKey={(r) => r.sequenceNo}
                searchFrom={99}
                columns={[
                  { key: "sequenceNo", label: "#" },
                  { key: "decision", label: "Decision", render: (r) => DECISION[r.decision] || r.decision },
                  {
                    key: "terms",
                    label: "Terms",
                    render: (r) =>
                      [
                        r.loadingPercent != null && "Loading " + Number(r.loadingPercent) + "%",
                        r.exclusion && "Exclusion: " + r.exclusion,
                        r.postponeUntil && "Until " + r.postponeUntil,
                        r.offerPremium != null && "Offer v" + r.offerVersion + " " + pula(r.offerPremium),
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—",
                  },
                  { key: "reason", label: "Reason" },
                  {
                    key: "basis",
                    label: "Made on",
                    // IL02: the life, the benefit and the evidence the decision rested on (recorded from now on).
                    render: (r) =>
                      [r.lifeRef, r.benefit, r.sumAssured != null && pula(r.sumAssured), r.evidenceBasis]
                        .filter(Boolean)
                        .join(" · ") || "—",
                  },
                  {
                    key: "decidedBy",
                    label: "By",
                    render: (r) => (r.decidedBy === "rules" ? "Rules" : r.decidedBy) + " · " + when(r.decidedAt),
                  },
                ]}
              />
            </Panel>
          )}

          <ErrorNote error={action.error} />
          <div className="ws-form-actions">
            {canAnswer && c.status === "OFFERED" && (
              <Button icon={CheckCircle2} onClick={() => setForm({ kind: "offer", accept: true, note: "" })}>
                Record applicant's answer
              </Button>
            )}
            {canDecide && c.decision && c.status !== "OFFERED" && (
              <Button variant="secondary" icon={RotateCcw} onClick={() => setForm({ kind: "reopen", reason: "" })}>
                Reopen
              </Button>
            )}
            {canDecide && ["REFERRED", "EVIDENCE_PENDING", "OFFERED"].includes(c.status) && (
              <Button
                icon={Pencil}
                disabled={!c.withinMyAuthority}
                title={c.withinMyAuthority ? undefined : "Above your underwriting authority"}
                onClick={() =>
                  setForm({
                    kind: "decision",
                    decision: "ACCEPT_STANDARD",
                    loadingPercent: "",
                    exclusion: "",
                    postponeUntil: inDays(90),
                    reason: "",
                  })
                }
              >
                {c.status === "OFFERED" ? "Revise decision" : "Decide"}
              </Button>
            )}
          </div>
          {canDecide && !c.withinMyAuthority && open && c.status !== "ACCEPTED" && (
            <p className="ws-hint">
              The sum assured is above your authority of {pula(c.myAuthority)}. A senior underwriter must decide this
              case.
            </p>
          )}
        </>
      )}

      {form && (
        <Drawer
          title={
            {
              evidence: "Request evidence",
              resolve: "Record evidence",
              decision: "Underwriting decision",
              offer: "Applicant's answer to offer v" + c.offerVersion,
              reopen: "Reopen the case",
            }[form.kind]
          }
          onClose={() => setForm(null)}
        >
          <FormGrid submitLabel="Save" busy={action.busy} error={action.error} onSubmit={submit}>
            {form.kind === "evidence" && (
              <>
                <Field label="Requirement" full>
                  <input
                    value={form.requirement}
                    onChange={(e) => setForm({ ...form, requirement: e.target.value })}
                    placeholder="e.g. Medical examination report"
                    required
                  />
                </Field>
                <Field label="Life">
                  <input value={form.lifeName} onChange={(e) => setForm({ ...form, lifeName: e.target.value })} required />
                </Field>
                <Field label="Due by">
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Clinical (restricted)" full>
                  <label className="ri-product">
                    <input
                      type="checkbox"
                      checked={form.restricted}
                      onChange={(e) => setForm({ ...form, restricted: e.target.checked })}
                    />
                    <span>Only underwriters may see what is received</span>
                  </label>
                </Field>
              </>
            )}
            {form.kind === "resolve" && (
              <>
                <Field label="Outcome">
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="RECEIVED">Received and checked</option>
                    <option value="WAIVED">Waived</option>
                  </select>
                </Field>
                <Field label={form.status === "RECEIVED" ? "What was received and found" : "Why it is waived"} full>
                  <textarea
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    rows={4}
                    required
                  />
                </Field>
              </>
            )}
            {form.kind === "decision" && (
              <>
                <Field label="Decision" full>
                  <select value={form.decision} onChange={(e) => setForm({ ...form, decision: e.target.value })}>
                    {Object.entries(DECISION).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                {form.decision === "ACCEPT_WITH_TERMS" && (
                  <>
                    <Field
                      label="Premium loading (%)"
                      hint={
                        form.loadingPercent
                          ? "Offer premium " +
                            pula((Number(c.appliedPremium) * (100 + Number(form.loadingPercent))) / 100)
                          : undefined
                      }
                    >
                      <input
                        type="number"
                        min="0"
                        max="500"
                        step="0.01"
                        value={form.loadingPercent}
                        onChange={(e) => setForm({ ...form, loadingPercent: e.target.value })}
                      />
                    </Field>
                    <Field label="Exclusion" full>
                      <textarea
                        value={form.exclusion}
                        onChange={(e) => setForm({ ...form, exclusion: e.target.value })}
                        rows={2}
                        placeholder="What the cover will not pay for"
                      />
                    </Field>
                  </>
                )}
                {form.decision === "POSTPONE" && (
                  <Field label="Postpone until">
                    <input
                      type="date"
                      value={form.postponeUntil}
                      onChange={(e) => setForm({ ...form, postponeUntil: e.target.value })}
                      required
                    />
                  </Field>
                )}
                <Field label="Reason" full>
                  <textarea
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    rows={3}
                    required
                  />
                </Field>
              </>
            )}
            {form.kind === "offer" && (
              <>
                <Field label="Answer" full>
                  <select
                    value={form.accept ? "yes" : "no"}
                    onChange={(e) => setForm({ ...form, accept: e.target.value === "yes" })}
                  >
                    <option value="yes">Applicant accepts the offer ({pula(c.offerPremium)} premium)</option>
                    <option value="no">Applicant refuses the offer</option>
                  </select>
                </Field>
                <Field label="How the answer was given" full>
                  <textarea
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    rows={3}
                    placeholder="e.g. Signed offer letter received"
                    required
                  />
                </Field>
              </>
            )}
            {form.kind === "reopen" && (
              <Field label="Why the case is reopened" full>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  rows={3}
                  required
                />
              </Field>
            )}
          </FormGrid>
        </Drawer>
      )}
    </Drawer>
  );
}

// ── rules ───────────────────────────────────────────────────────────────────────────────────────

function Rules({ session, notify, profile }) {
  const rules = useResource(session, "/underwriting/rules", []);
  const [form, setForm] = useState(null);
  const save = useAction(notify);
  const submit = async () => {
    const done = await save.run(
      () => request(session, "/underwriting/rules/" + form.id, { method: "PUT", body: form }),
      "Rules updated",
    );
    if (done) {
      setForm(null);
      rules.reload();
    }
  };
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  return (
    <>
      <Panel
        title="Underwriting rules"
        subtitle="A case inside every limit is accepted by the rules. Changing a rule set gives it a new version, and each case keeps the version it was assessed under."
      >
        <ErrorNote error={rules.error} />
        <DataTable
          rows={rules.data}
          loading={rules.loading}
          rowKey={(r) => r.id}
          searchFrom={99}
          columns={[
            { key: "product", label: "Product", render: (r) => r.product || "All other products" },
            { key: "versionLabel", label: "Version" },
            { key: "ages", label: "Entry age", render: (r) => r.minEntryAge + "–" + r.maxEntryAge },
            {
              key: "autoMaxSumAssured",
              label: "Automatic acceptance up to",
              align: "right",
              render: (r) => pula(r.autoMaxSumAssured),
            },
            {
              key: "medicalEvidenceAbove",
              label: "Medical evidence above",
              align: "right",
              render: (r) => pula(r.medicalEvidenceAbove),
            },
            {
              key: "aggregateExposureLimit",
              label: "Aggregate exposure limit",
              align: "right",
              render: (r) => pula(r.aggregateExposureLimit),
            },
            {
              key: "refer",
              label: "Refer disclosures",
              render: (r) =>
                [r.referTobacco && "Tobacco", r.referTreatment && "Treatment"].filter(Boolean).join(", ") || "None",
            },
            {
              key: "act",
              label: "",
              render: (r) =>
                can(profile, "MANAGE_UNDERWRITING") && (
                  <Button variant="secondary" icon={Pencil} onClick={() => setForm({ ...r, versionLabel: "" })}>
                    Change
                  </Button>
                ),
            },
          ]}
        />
      </Panel>
      {form && (
        <Drawer
          title={"Change rules: " + (form.product || "All other products")}
          description="Cases already assessed keep the version they were assessed under."
          onClose={() => setForm(null)}
        >
          <FormGrid submitLabel="Save new version" busy={save.busy} error={save.error} onSubmit={submit}>
            <Field label="New version label" full>
              <input value={form.versionLabel} onChange={set("versionLabel")} placeholder="e.g. UW-2026.2" required />
            </Field>
            <Field label="Minimum entry age">
              <input type="number" min="0" max="120" value={form.minEntryAge} onChange={set("minEntryAge")} required />
            </Field>
            <Field label="Maximum entry age">
              <input type="number" min="0" max="120" value={form.maxEntryAge} onChange={set("maxEntryAge")} required />
            </Field>
            <Field label="Automatic acceptance up to (BWP)">
              <input type="number" min="1" step="0.01" value={form.autoMaxSumAssured} onChange={set("autoMaxSumAssured")} required />
            </Field>
            <Field label="Medical evidence above (BWP)">
              <input type="number" min="1" step="0.01" value={form.medicalEvidenceAbove} onChange={set("medicalEvidenceAbove")} required />
            </Field>
            <Field label="Aggregate exposure limit (BWP)" full>
              <input type="number" min="1" step="0.01" value={form.aggregateExposureLimit} onChange={set("aggregateExposureLimit")} required />
            </Field>
            <Field label="Refer when disclosed" full>
              <label className="ri-product">
                <input type="checkbox" checked={form.referTobacco} onChange={set("referTobacco")} />
                <span>Tobacco or nicotine use</span>
              </label>
              <label className="ri-product">
                <input type="checkbox" checked={form.referTreatment} onChange={set("referTreatment")} />
                <span>Current treatment for a serious illness</span>
              </label>
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

// ── authority ───────────────────────────────────────────────────────────────────────────────────

function Authorities({ session, notify, profile }) {
  const rows = useResource(session, "/underwriting/authorities", []);
  const [form, setForm] = useState(null);
  const save = useAction(notify);
  const submit = async () => {
    const done = await save.run(
      () =>
        request(session, "/underwriting/authorities/" + form.roleId, {
          method: "PUT",
          body: { maxSumAssured: form.maxSumAssured },
        }),
      "Authority limit saved",
    );
    if (done) {
      rows.setData(done.data);
      setForm(null);
    }
  };
  return (
    <>
      <Panel
        title="Underwriting authority"
        subtitle="The largest sum assured each underwriting role may decide. A case above a person's limit must be decided by someone with a higher one."
      >
        <ErrorNote error={rows.error} />
        <DataTable
          rows={rows.data}
          loading={rows.loading}
          rowKey={(r) => r.roleId}
          searchFrom={99}
          empty="No role can underwrite"
          columns={[
            { key: "role", label: "Role" },
            {
              key: "maxSumAssured",
              label: "May decide up to",
              align: "right",
              render: (r) => (r.maxSumAssured == null ? "Not limited" : pula(r.maxSumAssured)),
            },
            { key: "updatedBy", label: "Changed by", render: (r) => (r.updatedBy ? r.updatedBy + " · " + when(r.updatedAt) : "—") },
            {
              key: "act",
              label: "",
              render: (r) =>
                can(profile, "MANAGE_UNDERWRITING") && (
                  <Button
                    variant="secondary"
                    icon={Pencil}
                    onClick={() => setForm({ roleId: r.roleId, role: r.role, maxSumAssured: r.maxSumAssured ?? "" })}
                  >
                    Change
                  </Button>
                ),
            },
          ]}
        />
      </Panel>
      {form && (
        <Drawer title={"Authority of " + form.role} onClose={() => setForm(null)}>
          <FormGrid submitLabel="Save" busy={save.busy} error={save.error} onSubmit={submit}>
            <Field label="May decide up to (BWP sum assured)" hint="Leave blank for no limit" full>
              <input
                type="number"
                min="1"
                step="0.01"
                value={form.maxSumAssured}
                onChange={(e) => setForm({ ...form, maxSumAssured: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}
