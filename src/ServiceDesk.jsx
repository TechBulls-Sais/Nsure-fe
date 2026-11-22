import React, { useEffect, useState } from "react";
import { AlertTriangle, Check, Clock3, LifeBuoy, Paperclip, Pause, Play, Plus, RotateCcw, UserCheck } from "lucide-react";
import { fetchFile, request, uploadFile } from "./api";
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
  Skeleton,
  Stat,
  Tabs,
  can,
  useAction,
  useConfirm,
  useResource,
  when,
} from "./ui/workspace";
import "./service-desk.css";

// SH10 service desk: service requests and complaints with SLA deadlines (complaints have their own), atomic
// assignment, a pausable SLA clock, resolve / reopen / close with history. CustomerCases (below) is the portal side.

export const CATEGORIES = {
  SERVICE_REQUEST: ["Policy change", "Beneficiary change", "Payment query", "Document request", "Claim query", "Contact details", "Other"],
  COMPLAINT: ["Service", "Claim handling", "Premium and billing", "Sales and advice", "Other"],
};

const TYPE_LABEL = { SERVICE_REQUEST: "Service request", COMPLAINT: "Complaint" };
const label = (value) => String(value || "").replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
const active = (c) => !["RESOLVED", "CLOSED"].includes(c.status);
const PRIORITY_RANK = { LOW: 0, NORMAL: 1, HIGH: 2 };

/** 95 → "1h 35m", 3000 → "2d 2h". */
export function minutes(total) {
  const m = Math.abs(Math.round(total || 0));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m % 60}m`;
  return `${m % 60}m`;
}

function SlaBadge({ c }) {
  if (!active(c)) return <span className="svc-muted">Done</span>;
  if (c.breached) return <Badge tone="red">Breached {minutes(c.minutesToDue)} ago</Badge>;
  if (c.status === "PAUSED") return <Badge tone="blue">Clock paused</Badge>;
  return <Badge tone={c.minutesToDue < 720 ? "amber" : "green"}>Due in {minutes(c.minutesToDue)}</Badge>;
}

export default function ServiceDesk({ session, notify, profile }) {
  const [tab, setTab] = useState("open");
  const [openRef, setOpenRef] = useState(null);
  const [logging, setLogging] = useState(false);
  const cases = useResource(session, "/service/cases", []);
  const rows = cases.data || [];
  const me = profile?.username;
  const canManage = can(profile, "MANAGE_SERVICE_CASE");
  const filters = {
    mine: (c) => c.owner === me && active(c),
    open: (c) => ["OPEN", "IN_PROGRESS"].includes(c.status),
    paused: (c) => c.status === "PAUSED",
    breached: (c) => c.breached,
    // The complaint register: every complaint, open or done, apart from service requests (NS-SH10-004).
    complaints: (c) => c.caseType === "COMPLAINT",
    all: () => true,
  };
  const count = (key) => rows.filter(filters[key]).length;
  const loading = cases.loading && !rows.length;
  return (
    <>
      <Heading
        eyebrow="SERVICE & COMPLAINTS"
        title="Service desk"
        subtitle="Requests and complaints from the portal, phone, email and branch, each with an SLA clock that stops only while paused with a reason."
      >
        {can(profile, "ASSIGN_WORK") && (
          <Button
            variant="secondary"
            icon={AlertTriangle}
            onClick={async () => {
              try {
                const r = await request(session, "/service/escalations/run", { method: "POST" });
                notify(`Escalation check done: ${r.data.changed} case(s) escalated or flagged as unowned.`);
                cases.reload();
              } catch (e) {
                notify(e.message, "error");
              }
            }}
          >
            Run escalation check
          </Button>
        )}
        {canManage && (
          <Button icon={Plus} onClick={() => setLogging(true)}>
            Log a case
          </Button>
        )}
      </Heading>
      <div className="stat-grid">
        <Stat
          label="Open"
          value={count("open")}
          tone="amber"
          note={`${rows.filter((c) => active(c) && !c.owner).length} unassigned`}
          loading={loading}
        />
        <Stat label="Mine" value={count("mine")} tone="blue" loading={loading} />
        <Stat label="Paused" value={count("paused")} tone="blue" note="SLA clock stopped" loading={loading} />
        <Stat
          label="Breached"
          value={count("breached")}
          tone={count("breached") ? "red" : "green"}
          note="Past due, not resolved"
          loading={loading}
        />
      </div>
      <ErrorNote error={cases.error} />
      {logging && canManage && (
        <NewCase
          session={session}
          notify={notify}
          onClose={() => setLogging(false)}
          onCreated={(detail) => {
            setLogging(false);
            cases.reload();
            setOpenRef(detail.case.ref);
          }}
        />
      )}
      <Panel title="Queue" subtitle="Newest first. Open a case to work it.">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            ["mine", `Mine (${count("mine")})`],
            ["open", `Open (${count("open")})`],
            ["paused", `Paused (${count("paused")})`],
            ["breached", `Breached (${count("breached")})`],
            ["complaints", `Complaint register (${count("complaints")})`],
            ["all", `All (${rows.length})`],
          ]}
        />
        <DataTable
          rows={rows.filter(filters[tab])}
          rowKey={(c) => c.ref}
          loading={cases.loading}
          empty={tab === "mine" ? "Nothing assigned to you" : "No cases here"}
          emptyDetail={
            tab === "mine"
              ? "Open a case from the queue and assign it to yourself to work it."
              : "Cases logged here or lodged in the customer portal appear in this queue."
          }
          searchPlaceholder="Search case, customer, subject, owner…"
          onRowClick={(c) => setOpenRef(c.ref)}
          columns={[
            { key: "ref", label: "Case", render: (c) => <span className="ws-mono">{c.ref}</span> },
            {
              key: "caseType",
              label: "Type",
              render: (c) => <Badge tone={c.caseType === "COMPLAINT" ? "amber" : "blue"}>{TYPE_LABEL[c.caseType]}</Badge>,
            },
            {
              key: "customer",
              label: "Customer",
              sortValue: (c) => c.customerName,
              render: (c) => (
                <>
                  {c.customerName}
                  <small className="svc-sub">{c.customerRef}</small>
                </>
              ),
            },
            {
              key: "subject",
              label: "Subject",
              render: (c) => (
                <>
                  {c.subject}
                  <small className="svc-sub">
                    {c.category}
                    {c.linkedRef ? " · " + c.linkedRef : ""}
                  </small>
                </>
              ),
            },
            {
              key: "priority",
              label: "Priority",
              sortValue: (c) => PRIORITY_RANK[c.priority],
              render: (c) => label(c.priority),
            },
            {
              key: "status",
              label: "Status",
              render: (c) => (
                <>
                  <Badge>{label(c.status)}</Badge>
                  {c.escalationLevel > 0 && <small className="svc-sub">Escalated · level {c.escalationLevel}</small>}
                  {c.pausePending && <small className="svc-sub">Pause awaiting approval</small>}
                </>
              ),
            },
            { key: "owner", label: "Owner", render: (c) => c.owner || <span className="svc-muted">Unassigned</span> },
            {
              key: "sla",
              label: "SLA",
              sortValue: (c) => (active(c) ? c.minutesToDue : Number.MAX_SAFE_INTEGER),
              render: (c) => <SlaBadge c={c} />,
            },
            {
              key: "age",
              label: "Age",
              align: "right",
              sortValue: (c) => c.adjustedMinutes,
              render: (c) =>
                c.elapsedMinutes === c.adjustedMinutes
                  ? minutes(c.elapsedMinutes)
                  : `${minutes(c.adjustedMinutes)} of ${minutes(c.elapsedMinutes)}`,
            },
          ]}
        />
      </Panel>
      {openRef && (
        <CaseDrawer
          session={session}
          notify={notify}
          profile={profile}
          caseRef={openRef}
          onClose={() => setOpenRef(null)}
          onChange={cases.reload}
        />
      )}
    </>
  );
}

function NewCase({ session, notify, onClose, onCreated }) {
  const empty = {
    customerRef: "",
    caseType: "SERVICE_REQUEST",
    category: CATEGORIES.SERVICE_REQUEST[0],
    subject: "",
    description: "",
    linkedRef: "",
    channel: "PHONE",
    priority: "NORMAL",
    requestedRemedy: "",
  };
  const [form, setForm] = useState(empty);
  const action = useAction(notify);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async () => {
    const r = await action.run(() => request(session, "/service/cases", { method: "POST", body: form }));
    if (r) {
      notify(`${r.data.case.ref} logged for ${r.data.case.customerName}. The customer is sent the reference.`);
      setForm(empty);
      onCreated(r.data);
    }
  };
  return (
    <Drawer
      title="Log a case"
      description="Due in working hours of the business calendar (service requests 72, complaints 120 by default), unless paused for an approved reason."
      onClose={onClose}
    >
      <FormGrid submitLabel="Log case" busy={action.busy} error={action.error} onSubmit={submit}>
        <Field label="Customer reference">
          <input value={form.customerRef} onChange={set("customerRef")} placeholder="CUS-1006" required />
        </Field>
        <Field label="Type">
          <select
            value={form.caseType}
            onChange={(e) => setForm({ ...form, caseType: e.target.value, category: CATEGORIES[e.target.value][0] })}
          >
            <option value="SERVICE_REQUEST">Service request</option>
            <option value="COMPLAINT">Complaint</option>
          </select>
        </Field>
        <Field label="Category">
          <select value={form.category} onChange={set("category")}>
            {CATEGORIES[form.caseType].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Policy or claim (optional)">
          <input value={form.linkedRef} onChange={set("linkedRef")} placeholder="POL-00001 or CLM-0001" />
        </Field>
        <Field label="Received via">
          <select value={form.channel} onChange={set("channel")}>
            <option value="PHONE">Phone</option>
            <option value="EMAIL">Email</option>
            <option value="WALK_IN">Walk-in</option>
            <option value="PORTAL">Portal</option>
          </select>
        </Field>
        <Field label="Priority">
          <select value={form.priority} onChange={set("priority")}>
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
          </select>
        </Field>
        <Field label="Subject" full>
          <input value={form.subject} onChange={set("subject")} maxLength={200} required />
        </Field>
        <Field label="Description" full hint={`${form.description.length} / 1000`}>
          <textarea rows={3} value={form.description} onChange={set("description")} maxLength={1000} />
        </Field>
        <Field label={form.caseType === "COMPLAINT" ? "Remedy the customer asks for" : "Outcome wanted (optional)"} full>
          <input value={form.requestedRemedy} onChange={set("requestedRemedy")} maxLength={300} required={form.caseType === "COMPLAINT"} />
        </Field>
      </FormGrid>
    </Drawer>
  );
}

const PROMPTS = {
  pause: { field: "reason", label: "Note (optional)", button: "Pause clock" },
  resolve: { field: "resolution", label: "Resolution given to the customer", button: "Resolve" },
  reopen: { field: "reason", label: "Why is the case reopened?", button: "Reopen" },
  escalate: { field: "reason", label: "Why is the case escalated?", button: "Escalate" },
  "decline-pause": { field: "reason", label: "Why is the pause declined?", button: "Decline pause" },
};

function CaseDrawer({ session, notify, profile, caseRef, onClose, onChange }) {
  const detail = useResource(session, "/service/cases/" + encodeURIComponent(caseRef));
  const action = useAction(notify);
  const confirm = useConfirm();
  const [prompt, setPrompt] = useState(null);
  const [text, setText] = useState("");
  // NS-SH10-004/005: approved pause reasons, resolution codes and outcomes come from the server's reference data.
  const reference = useResource(session, "/service/reference", null);
  const [extra, setExtra] = useState({});
  const c = detail.data?.case;
  const history = detail.data?.history || [];
  const me = profile?.username;
  const canManage = can(profile, "MANAGE_SERVICE_CASE");
  const supervisor = can(profile, "ASSIGN_WORK");
  // Work someone else owns is worked by them: the server refuses pause, resume and resolve until it is taken over.
  const mayWork = c && (!c.owner || c.owner === me);
  const [assignTo, setAssignTo] = useState("");
  const assignees = useResource(
    session,
    supervisor && c && active(c) ? "/ops/queue/assignees?key=" + encodeURIComponent(c.caseType + ":" + c.ref) : null,
    [],
  );

  const act = async (name, extra = {}, done) => {
    const r = await action.run(
      () =>
        request(session, `/service/cases/${encodeURIComponent(c.ref)}/${name}`, {
          method: "POST",
          body: { expectedVersion: c.version, ...extra },
        }),
      done,
    );
    if (r) {
      detail.setData(r.data);
      setPrompt(null);
      setText("");
      onChange();
    }
  };
  const takeOver = async () => {
    const ok = await confirm({
      title: `Take over ${c.ref}?`,
      message: (
        <>
          {c.ref} is owned by <strong>{c.owner}</strong>. Taking it over moves it to your queue and leaves theirs.
        </>
      ),
      confirmLabel: "Take over",
      tone: "danger",
    });
    if (ok) act("assign", { force: true }, `${c.ref} is now yours`);
  };
  const closeCase = async () => {
    const ok = await confirm({
      title: `Close ${c.ref}?`,
      message: (
        <>
          {c.ref} for <strong>{c.customerName}</strong> is resolved. Once closed it can no longer be reopened from the
          desk.
        </>
      ),
      confirmLabel: "Close case",
      tone: "danger",
    });
    if (ok) act("close", {}, `${c.ref} closed`);
  };
  const submitPrompt = async () => {
    if (prompt === "resolve") {
      const ok = await confirm({
        title: `Resolve ${c.ref}?`,
        message: (
          <>
            <strong>{c.customerName}</strong> is given this resolution and the SLA clock stops:
            <p className="svc-description">{text}</p>
          </>
        ),
        confirmLabel: "Resolve",
      });
      if (!ok) return;
    }
    const body = { [PROMPTS[prompt].field]: text || undefined, ...extra };
    act(prompt, body, `${c.ref}: ${PROMPTS[prompt].button.toLowerCase()} done`);
  };
  const openPrompt = (name, defaults = {}) => {
    setPrompt(name);
    setText("");
    setExtra(defaults);
  };
  const ref = reference.data;
  const resolutionCodes = (ref?.resolutionCodes || []).filter((r) => r.case_type === "ALL" || r.case_type === c?.caseType);
  const stale = /refresh and retry/i.test(action.error);

  return (
    <Drawer
      eyebrow={c ? TYPE_LABEL[c.caseType] : "Case"}
      title={caseRef}
      onClose={onClose}
      closeLabel="Close"
      size="lg"
    >
      <ErrorNote error={detail.error} />
      {detail.loading && !c && (
        <div className="svc-loading" aria-busy="true">
          <Skeleton width="60%" height={18} />
          <Skeleton width="40%" />
          <Skeleton height={60} />
        </div>
      )}
      {c && (
        <>
          <h3 className="svc-subject">{c.subject}</h3>
          <div className="svc-badges">
            <Badge>{label(c.status)}</Badge>
            <SlaBadge c={c} />
            <Badge tone="blue">{label(c.priority)} priority</Badge>
          </div>
          {c.description && <p className="svc-description">{c.description}</p>}
          <div className="ws-kv">
            <div>
              <small>Customer</small>
              <strong>
                {c.customerName} · {c.customerRef}
              </strong>
            </div>
            <div>
              <small>Category</small>
              <strong>{c.category}</strong>
            </div>
            <div>
              <small>Linked to</small>
              <strong>{c.linkedRef || "—"}</strong>
            </div>
            <div>
              <small>Received via</small>
              <strong>
                {label(c.channel)} · {c.openedBy}
              </strong>
            </div>
            <div>
              <small>Owner</small>
              <strong>{c.owner || "Unassigned"}</strong>
            </div>
            <div>
              <small>Opened</small>
              <strong>{when(c.openedAt)}</strong>
            </div>
          </div>
          <div className="svc-sla">
            <div>
              <small>SLA due</small>
              <strong>{when(c.effectiveDueAt)}</strong>
            </div>
            <div>
              <small>Elapsed age</small>
              <strong>{minutes(c.elapsedMinutes)}</strong>
            </div>
            <div>
              <small>Adjusted age</small>
              <strong>{minutes(c.adjustedMinutes)}</strong>
            </div>
            <div>
              <small>Paused in total</small>
              <strong>{minutes(Math.max(c.pausedMinutes, c.elapsedMinutes - c.adjustedMinutes))}</strong>
            </div>
            <div>
              <small>Working time used</small>
              <strong>
                {minutes(c.workingMinutes)}
                {c.slaHours ? ` of ${c.slaHours}h` : ""}
              </strong>
            </div>
            <div>
              <small>SLA basis</small>
              <strong>
                {c.slaBasis === "WORKING_HOURS" ? "Working hours" : "Elapsed hours"}
                {c.workflowVersion ? ` · workflow v${c.workflowVersion}` : ""}
              </strong>
            </div>
          </div>
          {c.requestedRemedy && (
            <p className="svc-note">
              <strong>Remedy asked for:</strong> {c.requestedRemedy}
            </p>
          )}
          {c.escalationLevel > 0 && (
            <p className="svc-note is-warn">
              <AlertTriangle size={14} aria-hidden="true" /> Escalated to level {c.escalationLevel}
              {c.escalatedAt ? " on " + when(c.escalatedAt) : ""}
              {c.externalReference ? ` · external referral ${c.externalReference}` : ""}
            </p>
          )}
          {c.status === "PAUSED" && (
            <p className="svc-note">
              <Pause size={14} aria-hidden="true" /> Paused {when(c.pausedAt)}: {c.pauseReason}
              {c.pauseEvidence ? ` · evidence: ${c.pauseEvidence}` : ""}
              {c.pauseExpectedResume ? ` · resume by ${c.pauseExpectedResume}` : ""}
              {c.pauseApprovedBy ? ` · approved by ${c.pauseApprovedBy}` : ""}
            </p>
          )}
          {c.pausePending && (
            <div className="svc-note is-warn">
              <Pause size={14} aria-hidden="true" /> {c.pauseRequestedBy} asked to pause ({label(c.pauseCode)}: {c.pauseEvidence},
              resume by {c.pauseExpectedResume}). It needs a supervisor's approval; the clock keeps running.
              {supervisor && c.pauseRequestedBy !== me && (
                <div className="svc-actions">
                  <Button busy={action.busy} onClick={() => act("approve-pause", {}, "Pause approved")}>
                    Approve pause
                  </Button>
                  <Button variant="secondary" onClick={() => openPrompt("decline-pause")}>
                    Decline
                  </Button>
                </div>
              )}
            </div>
          )}
          {c.resolution && (
            <p className="svc-note is-resolved">
              <Check size={14} aria-hidden="true" /> {c.resolutionCode ? label(c.resolutionCode) + " · " : ""}
              {c.outcome ? label(c.outcome) + " · " : ""}
              {c.resolution}
            </p>
          )}

          {canManage && c.status !== "CLOSED" && (
            <div className="svc-actions">
              {active(c) && !c.owner && (
                <Button icon={UserCheck} busy={action.busy} onClick={() => act("assign", {}, `${c.ref} assigned to you`)}>
                  Assign to me
                </Button>
              )}
              {active(c) && c.owner && c.owner !== me && (
                <Button variant="secondary" icon={UserCheck} busy={action.busy} onClick={takeOver}>
                  Take over
                </Button>
              )}
              {["OPEN", "IN_PROGRESS"].includes(c.status) && mayWork && (
                <>
                  {!c.pausePending && (
                    <Button
                      variant="secondary"
                      icon={Pause}
                      onClick={() => openPrompt("pause", { code: ref?.pauseReasons?.[0]?.code || "", evidence: "", expectedResume: "" })}
                    >
                      Pause
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    icon={Check}
                    onClick={() =>
                      openPrompt("resolve", {
                        resolutionCode: resolutionCodes[0]?.code || "",
                        ...(c.caseType === "COMPLAINT" ? { outcome: "UPHELD" } : {}),
                      })
                    }
                  >
                    Resolve
                  </Button>
                </>
              )}
              {active(c) && (
                <Button variant="secondary" icon={AlertTriangle} onClick={() => openPrompt("escalate", { external: false })}>
                  Escalate
                </Button>
              )}
              {c.status === "PAUSED" && mayWork && (
                <Button variant="secondary" icon={Play} busy={action.busy} onClick={() => act("resume", {}, "SLA clock restarted")}>
                  Resume
                </Button>
              )}
              {c.status === "RESOLVED" && (
                <>
                  <Button variant="secondary" icon={RotateCcw} onClick={() => setPrompt("reopen")}>
                    Reopen
                  </Button>
                  <Button busy={action.busy} onClick={closeCase}>
                    Close case
                  </Button>
                </>
              )}
            </div>
          )}
          {canManage && active(c) && !mayWork && (
            <p className="svc-note">
              <UserCheck size={14} aria-hidden="true" /> {c.owner} owns this case. Take it over, or ask a supervisor to
              assign it, before working it.
            </p>
          )}
          {supervisor && active(c) && (
            <form
              className="svc-prompt"
              onSubmit={(e) => {
                e.preventDefault();
                act("assign", { to: assignTo }, `${c.ref} assigned to ${assignTo}`);
              }}
            >
              <Field label="Assign to (supervisor)" hint="People who work service cases." full>
                <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} required>
                  <option value="">{assignees.loading ? "Loading…" : "Choose a person…"}</option>
                  {(assignees.data || [])
                    .filter((name) => name !== c.owner)
                    .map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                </select>
              </Field>
              <Button type="submit" variant="secondary" icon={UserCheck} busy={action.busy}>
                Assign
              </Button>
            </form>
          )}
          {prompt && (
            <form
              className="svc-prompt"
              onSubmit={(e) => {
                e.preventDefault();
                submitPrompt();
              }}
            >
              {prompt === "pause" && (
                <>
                  <Field label="Approved reason">
                    <select value={extra.code} onChange={(e) => setExtra({ ...extra, code: e.target.value })} required>
                      {(ref?.pauseReasons || []).map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.label} (up to {r.max_days} days{r.requires_approval === "Y" ? ", needs approval" : ""})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Expected resume date">
                    <input type="date" value={extra.expectedResume} required onChange={(e) => setExtra({ ...extra, expectedResume: e.target.value })} />
                  </Field>
                  <Field label="Evidence" full hint="What was requested, from whom and when">
                    <input value={extra.evidence} maxLength={300} onChange={(e) => setExtra({ ...extra, evidence: e.target.value })} />
                  </Field>
                </>
              )}
              {prompt === "resolve" && (
                <>
                  <Field label="Resolution reason">
                    <select value={extra.resolutionCode} required onChange={(e) => setExtra({ ...extra, resolutionCode: e.target.value })}>
                      {resolutionCodes.map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {c.caseType === "COMPLAINT" && (
                    <Field label="Complaint outcome">
                      <select value={extra.outcome} onChange={(e) => setExtra({ ...extra, outcome: e.target.value })}>
                        {(ref?.outcomes || []).map((o) => (
                          <option key={o} value={o}>
                            {label(o)}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                </>
              )}
              {prompt === "escalate" && c.caseType === "COMPLAINT" && (
                <>
                  <Field label="Referred to an external body (ombudsman)">
                    <select value={extra.external ? "Y" : "N"} onChange={(e) => setExtra({ ...extra, external: e.target.value === "Y" })}>
                      <option value="N">No, escalate internally</option>
                      <option value="Y">Yes</option>
                    </select>
                  </Field>
                  {extra.external && (
                    <Field label="External reference">
                      <input value={extra.externalReference || ""} required onChange={(e) => setExtra({ ...extra, externalReference: e.target.value })} />
                    </Field>
                  )}
                </>
              )}
              <Field label={PROMPTS[prompt].label} full>
                <textarea
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  required={prompt !== "pause"}
                  maxLength={prompt === "resolve" ? 1000 : 500}
                />
              </Field>
              <div className="ws-form-actions">
                <Button type="button" variant="secondary" onClick={() => setPrompt(null)}>
                  Cancel
                </Button>
                <Button type="submit" busy={action.busy}>
                  {PROMPTS[prompt].button}
                </Button>
              </div>
            </form>
          )}
          <ErrorNote error={action.error} />
          {stale && (
            <Button
              variant="secondary"
              icon={RotateCcw}
              onClick={() => {
                action.setError("");
                detail.reload();
                onChange();
              }}
            >
              Refresh case
            </Button>
          )}

          <CaseEvidence session={session} notify={notify} caseRef={c.ref} canUpload={canManage && active(c)} key={c.version} />

          <h4 className="svc-history-title">History</h4>
          <div className="timeline">
            {history.map((row, i) => (
              <div className="timeline-item" key={i}>
                <span />
                <div>
                  <strong>
                    {row.action}
                    {row.newState && row.previousState !== row.newState
                      ? " · " + (row.previousState ? label(row.previousState) + " → " : "") + label(row.newState)
                      : ""}
                  </strong>
                  <small>
                    {when(row.performedAt)} · {row.performedBy}
                  </small>
                  {row.details && <p>{row.details}</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Drawer>
  );
}

/** NS-SH10-004 / NS-SH09A-004: evidence on the case; uploads wait in quarantine until someone else releases them. */
function CaseEvidence({ session, notify, caseRef, canUpload, portal = false }) {
  const base = (portal ? "/portfolio/shop/cases/" : "/service/cases/") + encodeURIComponent(caseRef) + "/documents";
  const docs = useResource(session, base, null);
  const [busy, setBusy] = useState(false);
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const r = await uploadFile(session, base, file, { type: "Supporting evidence" });
      docs.setData(r.data);
      notify?.("Received. It is checked before it can be opened.");
    } catch (err) {
      notify?.(err.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const open = async (d) => {
    try {
      const url = URL.createObjectURL(await fetchFile(session, base + "/" + d.id));
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      notify?.(err.message, "error");
    }
  };
  const d = docs.data;
  return (
    <div className="svc-evidence">
      <h4 className="svc-history-title">Evidence</h4>
      <ErrorNote error={docs.error} />
      {d && d.documents.length === 0 && d.held.length === 0 && <p className="svc-muted">No evidence on this case.</p>}
      {d &&
        d.held.map((h) => (
          <p className="svc-note" key={"h" + h.uploadId}>
            <Paperclip size={14} aria-hidden="true" /> {h.fileName} · {h.state === "QUARANTINED" ? "being checked" : "not accepted"} ·{" "}
            {h.note}
          </p>
        ))}
      {d &&
        d.documents.map((doc) => (
          <p className="svc-note" key={doc.id}>
            <Paperclip size={14} aria-hidden="true" /> {doc.documentType}: {doc.fileName} · {when(doc.uploadedAt)} ·{" "}
            {doc.uploadedBy}
            {!portal && (
              <Button variant="secondary" onClick={() => open(doc)}>
                Open
              </Button>
            )}
          </p>
        ))}
      {canUpload && (
        <label className="svc-upload">
          <span>{busy ? "Uploading…" : "Attach evidence (PDF, JPG or PNG, up to 10 MB)"}</span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={upload} disabled={busy} />
        </label>
      )}
    </div>
  );
}

// ── customer portal ────────────────────────────────────────────────────────────────────────────────

/**
 * "Help & complaints" in the customer portal: lodge a service request or complaint and follow your own cases.
 * Uses the portal's own section styles (customer-requests) so it sits with the claims and payments lists.
 */
export function CustomerCases({ session, notify, policies = [], claims = [] }) {
  const [cases, setCases] = useState(null);
  const [error, setError] = useState("");
  const [lodging, setLodging] = useState(false);
  const [busy, setBusy] = useState(false);
  const empty = {
    caseType: "SERVICE_REQUEST",
    category: CATEGORIES.SERVICE_REQUEST[0],
    subject: "",
    description: "",
    linkedRef: "",
    requestedRemedy: "",
  };
  const [evidenceFor, setEvidenceFor] = useState(null);
  const [form, setForm] = useState(empty);

  const load = async () => {
    try {
      const r = await request(session, "/portfolio/shop/cases");
      setCases(r.data || []);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await request(session, "/portfolio/shop/cases", {
        method: "POST",
        body: { ...form, linkedRef: form.linkedRef || undefined, requestedRemedy: form.requestedRemedy || undefined },
      });
      notify?.(`Thank you. Your reference is ${r.data.ref}.`);
      setForm(empty);
      setLodging(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const list = cases || [];
  const openCount = list.filter((c) => !["RESOLVED", "CLOSED"].includes(c.status)).length;

  return (
    <section className="customer-requests customer-cases" id="your-help" aria-labelledby="customer-help-heading">
      <div className="customer-requests-head">
        <h2 id="customer-help-heading">
          Help &amp; complaints <span>{openCount}</span>
        </h2>
        <p>
          Ask us for a change or a document, or tell us when something went wrong. You get a reference straight away;
          we answer requests within 3 days and complaints within 5.
        </p>
        {!lodging && (
          <button className="btn primary" type="button" onClick={() => setLodging(true)}>
            <LifeBuoy size={15} aria-hidden="true" /> Get help
          </button>
        )}
      </div>
      {lodging && (
        <form className="customer-case-form" onSubmit={submit}>
          <div className="customer-case-types" role="radiogroup" aria-label="What do you need?">
            {[
              ["SERVICE_REQUEST", "A request", "A change, a document or a question"],
              ["COMPLAINT", "A complaint", "Something went wrong and you want it put right"],
            ].map(([value, title, note]) => (
              <label key={value} className={form.caseType === value ? "active" : ""}>
                <input
                  type="radio"
                  name="caseType"
                  value={value}
                  checked={form.caseType === value}
                  onChange={() => setForm({ ...form, caseType: value, category: CATEGORIES[value][0] })}
                />
                <strong>{title}</strong>
                <small>{note}</small>
              </label>
            ))}
          </div>
          <div className="customer-case-grid">
            <label>
              <span>Topic</span>
              <select value={form.category} onChange={set("category")}>
                {CATEGORIES[form.caseType].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              <span>About (optional)</span>
              <select value={form.linkedRef} onChange={set("linkedRef")}>
                <option value="">Not about a specific policy or claim</option>
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    Policy {p.id} · {p.product}
                  </option>
                ))}
                {claims.map((c) => (
                  <option key={c.id} value={c.id}>
                    Claim {c.id} · {c.product}
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              <span>Subject</span>
              <input value={form.subject} onChange={set("subject")} maxLength={200} required />
            </label>
            <label className="full">
              <span>Tell us more</span>
              <textarea rows={3} value={form.description} onChange={set("description")} maxLength={1000} />
            </label>
            {form.caseType === "COMPLAINT" && (
              <label className="full">
                <span>What would put it right?</span>
                <input value={form.requestedRemedy} onChange={set("requestedRemedy")} maxLength={300} required />
              </label>
            )}
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="customer-case-actions">
            <button className="btn secondary" type="button" onClick={() => setLodging(false)} disabled={busy}>
              Cancel
            </button>
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      )}
      {!lodging && error && <p className="form-error">{error}</p>}
      {list.length > 0 ? (
        <ul>
          {list.map((c) => {
            const done = ["RESOLVED", "CLOSED"].includes(c.status);
            return (
              <li key={c.ref} className={done ? "is-done" : "is-pending"}>
                <span className="customer-request-icon" aria-hidden="true">
                  {done ? <Check size={15} /> : <Clock3 size={15} />}
                </span>
                <div>
                  <strong>
                    {c.ref} · {c.subject}
                  </strong>
                  <small>
                    {TYPE_LABEL[c.caseType]} · {c.category}
                    {c.linkedRef ? " · " + c.linkedRef : ""} · opened {when(c.openedAt)}
                  </small>
                  {!done && <p>We aim to answer by {when(c.dueAt)}.</p>}
                  {c.requestedRemedy && <p>You asked for: {c.requestedRemedy}</p>}
                  {c.resolution && (
                    <p>
                      Our answer{c.outcome ? ` (complaint ${label(c.outcome).toLowerCase()})` : ""}: {c.resolution}
                    </p>
                  )}
                  {!done && (
                    <button className="btn secondary" type="button" onClick={() => setEvidenceFor(evidenceFor === c.ref ? null : c.ref)}>
                      <Paperclip size={14} aria-hidden="true" /> {evidenceFor === c.ref ? "Hide documents" : "Documents"}
                    </button>
                  )}
                  {evidenceFor === c.ref && (
                    <CaseEvidence session={session} notify={notify} caseRef={c.ref} canUpload portal />
                  )}
                </div>
                <span className="customer-request-status">{label(c.status)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        cases && !lodging && <p className="subtitle">You have no open requests or complaints.</p>
      )}
    </section>
  );
}

/**
 * Customer portal: "Your choices and contact details" (spec 04 customer workspace). The customer chooses channels and
 * marketing (recorded with the portal as consent evidence), asks to change their email or mobile (a code goes to the
 * new contact, then the insurer approves), and sees the policies they may view for someone else while a delegation
 * lasts (AT-SH01-03).
 */
export function CustomerChoices({ session, notify }) {
  const [prefs, setPrefs] = useState(null);
  const [delegated, setDelegated] = useState([]);
  const [error, setError] = useState("");
  const [change, setChange] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      const [p, d] = await Promise.all([
        request(session, "/portfolio/shop/preferences"),
        request(session, "/portfolio/shop/delegated"),
      ]);
      setPrefs(p.data);
      setDelegated(d.data || []);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);
  const run = async (fn, done) => {
    setBusy(true);
    setError("");
    try {
      const r = await fn();
      if (done) notify?.(done);
      return r;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const setChannel = async (channel, status) => {
    const r = await run(() => request(session, "/portfolio/shop/preferences", { method: "PUT", body: { channel, status } }), "Saved");
    if (r) setPrefs(r.data);
  };
  const setMarketing = async (status) => {
    const r = await run(
      () => request(session, "/portfolio/shop/preferences/purposes", { method: "PUT", body: { purpose: "MARKETING", channel: "ALL", status } }),
      status === "OPTED_IN" ? "Thank you. You can withdraw this at any time." : "You will not receive marketing.",
    );
    if (r) setPrefs(r.data);
  };
  const submitChange = async (e) => {
    e.preventDefault();
    if (!change.ref) {
      const r = await run(() => request(session, "/portfolio/shop/contact-changes", { method: "POST", body: { field: change.field, value: change.value } }));
      if (r) setChange({ ...change, ref: r.data.recordRef, challenge: r.data.challenge, demoCode: r.data.demoCode, code: "" });
    } else {
      const r = await run(
        () => request(session, `/portfolio/shop/contact-changes/${change.ref}/verify`, { method: "POST", body: { challenge: change.challenge, code: change.code } }),
        "Confirmed. We check the change and update your details.",
      );
      if (r) setChange(null);
    }
  };
  const marketing = (prefs?.purposes || []).find((p) => p.purpose === "MARKETING");
  return (
    <section className="customer-requests customer-cases" aria-labelledby="customer-choices-heading">
      <div className="customer-requests-head">
        <h2 id="customer-choices-heading">Your choices and contact details</h2>
        <p>How we contact you about your cover. Service messages about your policies and claims always reach you on a channel you allow.</p>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {prefs && (
        <ul>
          {prefs.channels.map((c) => (
            <li key={c.channel} className={c.deliverable ? "is-done" : "is-pending"}>
              <span className="customer-request-icon" aria-hidden="true">
                {c.deliverable ? <Check size={15} /> : <Clock3 size={15} />}
              </span>
              <div>
                <strong>{c.channel === "WHATSAPP" ? "WhatsApp" : c.channel === "SMS" ? "SMS" : "Email"}</strong>
                <small>{c.contact || "No contact on file"} · {c.deliverable ? "On" : c.note}</small>
              </div>
              <button className="btn secondary" type="button" disabled={busy} onClick={() => setChannel(c.channel, c.status === "OPTED_IN" && c.deliverable ? "OPTED_OUT" : "OPTED_IN")}>
                {c.status === "OPTED_IN" && c.deliverable ? "Turn off" : "Turn on"}
              </button>
            </li>
          ))}
          <li className={marketing?.status === "OPTED_IN" ? "is-done" : "is-pending"}>
            <span className="customer-request-icon" aria-hidden="true">
              {marketing?.status === "OPTED_IN" ? <Check size={15} /> : <Clock3 size={15} />}
            </span>
            <div>
              <strong>News and offers</strong>
              <small>{marketing?.status === "OPTED_IN" ? "You agreed to receive offers" : "Off: we never send offers without your agreement"}</small>
            </div>
            <button className="btn secondary" type="button" disabled={busy} onClick={() => setMarketing(marketing?.status === "OPTED_IN" ? "OPTED_OUT" : "OPTED_IN")}>
              {marketing?.status === "OPTED_IN" ? "Withdraw" : "I agree"}
            </button>
          </li>
        </ul>
      )}
      {!change ? (
        <button className="btn secondary" type="button" onClick={() => setChange({ field: "EMAIL", value: "" })}>
          Change my email or mobile
        </button>
      ) : (
        <form className="customer-case-form" onSubmit={submitChange}>
          {!change.ref ? (
            <div className="customer-case-grid">
              <label>
                <span>What</span>
                <select value={change.field} onChange={(e) => setChange({ ...change, field: e.target.value })}>
                  <option value="EMAIL">Email</option>
                  <option value="PHONE">Mobile number</option>
                </select>
              </label>
              <label>
                <span>New {change.field === "EMAIL" ? "email" : "mobile number"}</span>
                <input value={change.value} required onChange={(e) => setChange({ ...change, value: e.target.value })} />
              </label>
            </div>
          ) : (
            <label>
              <span>The code we sent to your new {change.field === "EMAIL" ? "email" : "mobile"}{change.demoCode ? ` (demo: ${change.demoCode})` : ""}</span>
              <input value={change.code} inputMode="numeric" required autoComplete="one-time-code" onChange={(e) => setChange({ ...change, code: e.target.value })} />
            </label>
          )}
          <div className="customer-case-actions">
            <button className="btn secondary" type="button" onClick={() => setChange(null)} disabled={busy}>
              Cancel
            </button>
            <button className="btn primary" type="submit" disabled={busy}>
              {change.ref ? "Confirm" : "Send a code"}
            </button>
          </div>
        </form>
      )}
      {delegated.length > 0 && (
        <>
          <h3>Policies you look after for someone else</h3>
          <ul>
            {delegated.map((p) => (
              <li key={p.recordRef} className="is-done">
                <span className="customer-request-icon" aria-hidden="true">
                  <Check size={15} />
                </span>
                <div>
                  <strong>
                    {p.recordRef} · {p.product}
                  </strong>
                  <small>
                    {p.customerName} · {label(p.status)} · {label(p.authority)} access until {p.validTo}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
