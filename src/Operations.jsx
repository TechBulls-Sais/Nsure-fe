import React, { useState } from "react";
import { Ban, CheckCheck, Eye, Pencil, Search } from "lucide-react";
import { fetchFile, request } from "./api";
import { Badge, Button, DataTable, Drawer, ErrorNote, Field, FormGrid, Heading, Panel, Stat, Tabs, can, pula, useAction, useResource, when } from "./ui/workspace";

// One work queue across the modules with ownership and SLA, the workflow definitions and business calendar behind
// it, the document register with retention and legal holds, and the partner portal requests and accounts.

const label = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replaceAll("_", " ") : "—");

export default function Operations({ session, notify, profile, go }) {
  const [tab, setTab] = useState("queue");
  const queue = useResource(session, "/ops/queue", []);
  const items = queue.data || [];
  const me = profile?.username;
  return (
    <>
      <Heading
        eyebrow="OPERATIONS"
        title="Work queue"
        subtitle="The open work across the modules that you may act on, with its priority, owner, next action and SLA, the workflow definitions and calendar behind it, the document register, and partner requests."
      />
      <div className="stat-grid">
        <Stat label="Open work" value={items.length} loading={queue.loading} />
        <Stat label="Past SLA" value={items.filter((i) => i.breached).length} tone="amber" loading={queue.loading} />
        <Stat label="Unowned" value={items.filter((i) => !i.owner).length} tone="blue" loading={queue.loading} />
        <Stat label="Mine" value={items.filter((i) => i.owner === me).length} loading={queue.loading} />
      </div>
      <Tabs
        value={tab}
        onChange={(next) => {
          setTab(next);
          queue.reload();
        }}
        tabs={[
          ["queue", "Queue"],
          ["workflow", "Workflows & calendar"],
          (can(profile, "READ_POLICY") || can(profile, "READ_CLAIM")) && ["documents", "Documents"],
          ["partners", "Partner requests"],
        ].filter(Boolean)}
      />
      {tab === "queue" && <Queue session={session} notify={notify} resource={queue} go={go} me={me} profile={profile} />}
      {tab === "workflow" && <Workflow session={session} notify={notify} profile={profile} />}
      {tab === "documents" && <Documents session={session} notify={notify} profile={profile} />}
      {tab === "partners" && <Partners session={session} notify={notify} profile={profile} onChange={queue.reload} />}
    </>
  );
}

// A detail that is a status-like code (ACCIDENTAL_DEATH) reads as words; free text is shown as it is.
const detailText = (value) => (value && /^[A-Z0-9_]+$/.test(value) ? label(value) : value || "—");

const PRIORITY_TONE = { HIGH: "red", NORMAL: "blue", LOW: "gray" };

/**
 * The work this user may act on (a supervisor sees every team's), most urgent first: past SLA, then priority, then
 * due time (NS-SH10-002). Taking is exclusive and the modules respect the owner; a supervisor assigns work.
 */
function Queue({ session, notify, resource, go, me, profile }) {
  const [team, setTeam] = useState("");
  const [view, setView] = useState("all");
  const [assigning, setAssigning] = useState(null);
  const action = useAction(notify);
  const supervisor = can(profile, "ASSIGN_WORK");
  const all = resource.data || [];
  const rows = all.filter(
    (i) =>
      (!team || i.team === team) &&
      (view === "all" ||
        (view === "mine" && i.owner === me) ||
        (view === "unowned" && !i.owner) ||
        (view === "approvals" && i.approval) ||
        (view === "breached" && i.breached)),
  );
  const teams = [...new Set(all.map((i) => i.team))];
  const take = async (item, release) => {
    await action.run(
      () => request(session, "/ops/queue/claim?key=" + encodeURIComponent(item.key), { method: release ? "DELETE" : "POST" }),
      release ? "Released" : "You own this work",
    );
    resource.reload();
  };
  return (
    <>
      <Panel
        title="Open work"
        subtitle="Work you may act on. Taking it is exclusive: a second person is told who already has it, and the module refuses their action until it is released or assigned. SLA time is counted in working hours."
        action={
          <div className="ws-row-actions">
            <select aria-label="Show" value={view} onChange={(e) => setView(e.target.value)}>
              <option value="all">All work</option>
              <option value="mine">Mine</option>
              <option value="unowned">Unowned</option>
              <option value="approvals">Approvals (all modules)</option>
              <option value="breached">Past SLA</option>
            </select>
            <select aria-label="Team" value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">All teams</option>
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <ErrorNote error={resource.error || action.error} />
        <DataTable
          rows={rows}
          loading={resource.loading}
          rowKey={(r) => r.key}
          empty="Nothing waiting for you"
          searchPlaceholder="Search work…"
          columns={[
            { key: "workflowName", label: "Work" },
            { key: "ref", label: "Reference" },
            { key: "subject", label: "About", render: (r) => r.subject || "—" },
            { key: "contractRef", label: "Contract", render: (r) => r.contractRef || "—" },
            { key: "detail", label: "Detail", render: (r) => detailText(r.detail) },
            {
              key: "priority",
              label: "Priority",
              render: (r) => <Badge tone={PRIORITY_TONE[r.priority] || "blue"}>{label(r.priority)}</Badge>,
            },
            { key: "nextAction", label: "Next action" },
            { key: "team", label: "Team" },
            {
              key: "opened",
              label: "Opened",
              render: (r) => (r.opened ? when(r.opened) + (r.ageHours != null ? " · " + ageText(r.ageHours) : "") : "—"),
            },
            {
              key: "dueAt",
              label: "Due",
              render: (r) =>
                r.dueAt ? (
                  <Badge tone={r.breached ? "red" : "green"}>{(r.breached ? "Past SLA · " : "") + when(r.dueAt)}</Badge>
                ) : (
                  "—"
                ),
            },
            {
              key: "owner",
              label: "Owner",
              render: (r) => (r.owner ? r.owner + (r.assignedBy && r.assignedBy !== r.owner ? " (assigned)" : "") : "Unowned"),
            },
            {
              key: "act",
              label: "",
              render: (r) => (
                <div className="ws-row-actions">
                  {!r.owner && r.canAct && (
                    <Button variant="secondary" busy={action.busy} onClick={() => take(r, false)}>
                      Take
                    </Button>
                  )}
                  {r.owner && r.page !== "service-desk" && (r.owner === me || supervisor) && (
                    <Button variant="secondary" busy={action.busy} onClick={() => take(r, true)}>
                      Release
                    </Button>
                  )}
                  {supervisor && (
                    <Button variant="secondary" onClick={() => setAssigning(r)}>
                      Assign
                    </Button>
                  )}
                  {r.page !== "work-queue" && (
                    <Button variant="secondary" onClick={() => go(r.page)}>
                      Open
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Panel>
      <SlaByTeam items={all} loading={resource.loading} />
      {assigning && (
        <Assign
          session={session}
          notify={notify}
          item={assigning}
          onClose={() => setAssigning(null)}
          onDone={() => {
            setAssigning(null);
            resource.reload();
          }}
        />
      )}
    </>
  );
}

const ageText = (hours) => (hours < 48 ? hours + " h" : Math.floor(hours / 24) + " days");

/** SLA position per team over the work this user sees: open, past SLA, unowned and the oldest item. */
function SlaByTeam({ items, loading }) {
  const teams = new Map();
  for (const i of items) {
    const t = teams.get(i.team) || { team: i.team, open: 0, breached: 0, unowned: 0, high: 0, oldest: 0 };
    t.open += 1;
    if (i.breached) t.breached += 1;
    if (!i.owner) t.unowned += 1;
    if (i.priority === "HIGH") t.high += 1;
    t.oldest = Math.max(t.oldest, i.ageHours || 0);
    teams.set(i.team, t);
  }
  return (
    <Panel title="SLA by team" subtitle="Open work, how much is past its due time or unowned, and how old the oldest item is.">
      <DataTable
        rows={[...teams.values()].sort((a, b) => b.breached - a.breached || b.open - a.open)}
        loading={loading}
        rowKey={(r) => r.team}
        searchFrom={99}
        empty="No open work"
        columns={[
          { key: "team", label: "Team" },
          { key: "open", label: "Open", align: "right" },
          { key: "breached", label: "Past SLA", align: "right", render: (r) => (r.breached ? <Badge tone="red">{r.breached}</Badge> : 0) },
          { key: "unowned", label: "Unowned", align: "right" },
          { key: "high", label: "High priority", align: "right" },
          { key: "oldest", label: "Oldest", align: "right", render: (r) => ageText(r.oldest) },
        ]}
      />
    </Panel>
  );
}

/** A supervisor (ASSIGN_WORK) gives an item to someone who may act on it. */
function Assign({ session, notify, item, onClose, onDone }) {
  const people = useResource(session, "/ops/queue/assignees?key=" + encodeURIComponent(item.key), []);
  const [to, setTo] = useState("");
  const action = useAction(notify);
  const submit = async () => {
    const done = await action.run(
      () =>
        request(session, "/ops/queue/assign?key=" + encodeURIComponent(item.key) + "&to=" + encodeURIComponent(to), {
          method: "POST",
        }),
      item.ref + " assigned to " + to,
    );
    if (done) onDone();
  };
  return (
    <Drawer title={"Assign " + item.workflowName + " " + item.ref} onClose={onClose}>
      <FormGrid submitLabel="Assign" busy={action.busy} error={action.error || people.error} onSubmit={submit}>
        <Field label="Give it to" hint="Only people who may act on this work are listed." full>
          <select value={to} onChange={(e) => setTo(e.target.value)} required>
            <option value="">{people.loading ? "Loading…" : "Choose a person…"}</option>
            {(people.data || []).map((name) => (
              <option key={name} value={name}>
                {name}
                {name === item.owner ? " (owner now)" : ""}
              </option>
            ))}
          </select>
        </Field>
      </FormGrid>
    </Drawer>
  );
}

function Workflow({ session, notify, profile }) {
  const wf = useResource(session, "/ops/workflow", null);
  const [form, setForm] = useState(null);
  const action = useAction(notify);
  const manage = can(profile, "MANAGE_CONFIG");
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const submit = async () => {
    const { kind, ...body } = form;
    const done = await action.run(
      () => request(session, kind === "calendar" ? "/ops/workflow/calendar" : "/ops/workflow/definitions/" + form.code, { method: "PUT", body }),
      "Saved",
    );
    if (done) {
      wf.setData(done.data);
      setForm(null);
    }
  };
  const c = wf.data?.calendar;
  return (
    <>
      <Panel title="Workflow definitions" subtitle="Each kind of work has a team, its steps and an SLA. Changing a definition moves its version on.">
        <ErrorNote error={wf.error} />
        <DataTable
          rows={wf.data?.definitions}
          loading={wf.loading}
          rowKey={(r) => r.code}
          searchFrom={99}
          columns={[
            { key: "name", label: "Work" },
            { key: "team", label: "Team" },
            { key: "slaHours", label: "SLA (working hours)", align: "right" },
            { key: "priority", label: "Priority", render: (r) => label(r.priority) },
            {
              key: "steps",
              label: "Steps",
              render: (r) => (
                <>
                  {r.steps}
                  {(r.entryCriteria || r.roles || r.requiredEvidence || r.authorityLimit != null) && (
                    <small className="ws-hint">
                      {r.entryCriteria ? " · Entry: " + r.entryCriteria : ""}
                      {r.roles ? " · Worked by: " + r.roles : ""}
                      {r.authorityLimit != null ? " · Authority limit: " + r.authorityLimit : ""}
                      {r.requiredEvidence ? " · Evidence: " + r.requiredEvidence : ""}
                    </small>
                  )}
                </>
              ),
            },
            {
              key: "versionNo",
              label: "Version",
              align: "right",
              render: (r) => {
                const earlier = (wf.data?.versions || []).filter((v) => v.code === r.code && v.versionNo !== r.versionNo);
                return (
                  <span title={earlier.map((v) => `v${v.versionNo}: ${v.slaHours}h by ${v.changedBy || "system"}`).join("\n")}>
                    v{r.versionNo}
                    {earlier.length > 0 && <small className="ws-hint"> ({earlier.length} earlier kept)</small>}
                  </span>
                );
              },
            },
            {
              key: "act",
              label: "",
              render: (r) =>
                manage && (
                  <Button variant="secondary" icon={Pencil} onClick={() => setForm({ kind: "definition", ...r })}>
                    Change
                  </Button>
                ),
            },
          ]}
        />
      </Panel>
      <Panel
        title="Business calendar"
        subtitle="SLA due times skip nights, non-working days and holidays."
        action={
          manage &&
          c && (
            <Button icon={Pencil} onClick={() => setForm({ kind: "calendar", ...c })}>
              Change
            </Button>
          )
        }
      >
        {c && (
          <div className="ws-kv">
            <div>
              <small>Working hours</small>
              <strong>
                {String(c.workStartHour).padStart(2, "0")}:00 – {String(c.workEndHour).padStart(2, "0")}:00
              </strong>
            </div>
            <div>
              <small>Working days</small>
              <strong>{c.workingDays.split(",").map(label).join(", ")}</strong>
            </div>
            <div>
              <small>Holidays</small>
              <strong>{c.holidays || "None"}</strong>
            </div>
          </div>
        )}
      </Panel>
      {form && (
        <Drawer title={form.kind === "calendar" ? "Business calendar" : form.name} onClose={() => setForm(null)}>
          <FormGrid submitLabel="Save" busy={action.busy} error={action.error} onSubmit={submit}>
            {form.kind === "calendar" ? (
              <>
                <Field label="Day starts (hour)">
                  <input type="number" min="0" max="23" value={form.workStartHour} onChange={set("workStartHour")} required />
                </Field>
                <Field label="Day ends (hour)">
                  <input type="number" min="1" max="24" value={form.workEndHour} onChange={set("workEndHour")} required />
                </Field>
                <Field label="Working days" hint="MON,TUE,WED,THU,FRI,SAT,SUN" full>
                  <input value={form.workingDays} onChange={set("workingDays")} required />
                </Field>
                <Field label="Holidays" hint="Dates as YYYY-MM-DD, separated by commas" full>
                  <textarea value={form.holidays || ""} onChange={set("holidays")} rows={2} />
                </Field>
              </>
            ) : (
              <>
                <Field label="Team">
                  <input value={form.team} onChange={set("team")} required />
                </Field>
                <Field label="SLA (working hours)">
                  <input type="number" min="1" value={form.slaHours} onChange={set("slaHours")} required />
                </Field>
                <Field label="Priority" hint="Work of this kind is listed by priority after anything past its SLA">
                  <select value={form.priority || "NORMAL"} onChange={set("priority")}>
                    <option value="HIGH">High</option>
                    <option value="NORMAL">Normal</option>
                    <option value="LOW">Low</option>
                  </select>
                </Field>
                <Field label="Steps" hint="Separate steps with >" full>
                  <textarea value={form.steps} onChange={set("steps")} rows={3} required />
                </Field>
                <Field label="Entry criteria" full>
                  <input value={form.entryCriteria || ""} onChange={set("entryCriteria")} maxLength={500} />
                </Field>
                <Field label="Worked by (permission codes)" hint="e.g. MANAGE_SERVICE_CASE">
                  <input value={form.roles || ""} onChange={set("roles")} maxLength={300} />
                </Field>
                <Field label="Authority limit (optional)">
                  <input type="number" min="0" value={form.authorityLimit ?? ""} onChange={set("authorityLimit")} />
                </Field>
                <Field label="Required evidence" full>
                  <input value={form.requiredEvidence || ""} onChange={set("requiredEvidence")} maxLength={500} />
                </Field>
                <p className="ws-hint">
                  Saving keeps this version and starts the next. Service cases already open keep the version and SLA they
                  were opened under.
                </p>
              </>
            )}
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

const FILTER_FIELD = { flex: "1 1 160px", minWidth: 0 };
const NO_FILTER = { q: "", customerRef: "", ownerRef: "", documentClass: "", from: "", to: "" };

/**
 * The document register (NS-SH09A-005): policy documents for policy readers, claim evidence for claim readers. Search
 * covers the details and the text of generated and released PDFs; every search is logged as sensitive access.
 */
function Documents({ session, notify, profile }) {
  const [form, setForm] = useState(NO_FILTER);
  const [filter, setFilter] = useState(NO_FILTER);
  const query = new URLSearchParams(Object.entries(filter).filter(([, v]) => v.trim())).toString();
  const docs = useResource(session, "/ops/documents" + (query ? "?" + query : ""), null);
  const [hold, setHold] = useState(null);
  const [access, setAccess] = useState(null);
  const action = useAction(notify);
  const save = async (doc, on, reason) => {
    const done = await action.run(
      () => request(session, "/ops/documents/hold?docKey=" + encodeURIComponent(doc.docKey), { method: "PUT", body: { hold: on, reason } }),
      on ? "Legal hold placed" : "Legal hold lifted",
    );
    if (done) {
      setHold(null);
      docs.reload();
    }
  };
  const retention = docs.data?.retention || {};
  return (
    <>
      {can(profile, "READ_CLAIM") && <Quarantine session={session} notify={notify} profile={profile} onChange={docs.reload} />}
      <Panel
        title="Document register"
        subtitle={
          "No malware scanner is connected: an upload is held in quarantine until a reviewer releases it, and is never shown as scanned. Retention: " +
          Object.entries(retention)
            .map(([k, v]) => k.toLowerCase() + " " + v + " years")
            .join(", ") +
          ". A document on legal hold is never eligible for disposal."
        }
      >
        <form
          style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            setFilter(form);
          }}
        >
          <input
            className="input"
            style={FILTER_FIELD}
            aria-label="Search documents"
            value={form.q}
            onChange={(e) => setForm({ ...form, q: e.target.value })}
            placeholder="File, type, record, customer or words in the document…"
          />
          <input
            className="input"
            style={FILTER_FIELD}
            aria-label="Customer reference"
            value={form.customerRef}
            onChange={(e) => setForm({ ...form, customerRef: e.target.value })}
            placeholder="Customer, e.g. CUS-1001"
          />
          <input
            className="input"
            style={FILTER_FIELD}
            aria-label="Policy or claim"
            value={form.ownerRef}
            onChange={(e) => setForm({ ...form, ownerRef: e.target.value })}
            placeholder="Policy or claim number"
          />
          <select
            className="input"
            style={FILTER_FIELD}
            aria-label="Document class"
            value={form.documentClass}
            onChange={(e) => setForm({ ...form, documentClass: e.target.value })}
          >
            <option value="">Every class</option>
            {(docs.data?.classes || []).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input className="input" style={FILTER_FIELD} aria-label="Stored from" type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
          <input className="input" style={FILTER_FIELD} aria-label="Stored to" type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
          <Button type="submit" variant="secondary" icon={Search}>
            Search
          </Button>
          {query && (
            <Button
              variant="secondary"
              onClick={() => {
                setForm(NO_FILTER);
                setFilter(NO_FILTER);
              }}
            >
              Clear
            </Button>
          )}
        </form>
        <p className="ws-hint">Searches are recorded in the audit trail as access to customer records.</p>
        <ErrorNote error={docs.error || action.error} />
        <DataTable
          rows={docs.data?.documents}
          loading={docs.loading}
          rowKey={(r) => r.docKey}
          searchFrom={999}
          empty="No documents found"
          columns={[
            {
              key: "fileName",
              label: "Document",
              render: (r) => (
                <>
                  {r.fileName}
                  <small className="ws-hint">
                    {" "}
                    · {r.documentType}
                    {r.contentMatch && " · matched in the document text"}
                  </small>
                </>
              ),
            },
            {
              key: "documentClass",
              label: "Class",
              render: (r) => (
                <>
                  {r.documentClass}
                  <small className="ws-hint"> · {r.classification}</small>
                </>
              ),
            },
            {
              key: "ownerRef",
              label: "Belongs to",
              render: (r) => r.ownerRef + " · " + (r.customerName || "—") + (r.customerRef ? " (" + r.customerRef + ")" : ""),
            },
            { key: "uploadedAt", label: "Stored", render: (r) => when(r.uploadedAt) },
            {
              key: "scanStatus",
              label: "Scan",
              render: (r) => <Badge tone={SCAN_TONE[r.scanStatus] || "blue"}>{r.scanLabel || r.scanStatus}</Badge>,
            },
            { key: "retainUntil", label: "Keep until" },
            {
              key: "legalHold",
              label: "Hold",
              render: (r) => (r.legalHold ? <Badge tone="red">On hold</Badge> : r.disposalEligible ? <Badge tone="amber">Due for disposal</Badge> : "—"),
            },
            {
              key: "act",
              label: "",
              render: (r) => (
                <span className="ws-row-actions">
                  {can(profile, "READ_AUDIT") && !r.docKey.startsWith("U:") && (
                    <Button variant="secondary" onClick={() => setAccess(r)}>
                      Access log
                    </Button>
                  )}
                  {can(profile, "UPDATE_POLICY") &&
                    (r.legalHold ? (
                      <Button variant="secondary" busy={action.busy} onClick={() => save(r, false)}>
                        Lift hold
                      </Button>
                    ) : (
                      <Button variant="secondary" onClick={() => setHold({ doc: r, reason: "" })}>
                        Legal hold
                      </Button>
                    ))}
                </span>
              ),
            },
          ]}
        />
      </Panel>
      {access && <AccessLog session={session} doc={access} onClose={() => setAccess(null)} />}
      {hold && (
        <Drawer title={"Legal hold on " + hold.doc.fileName} description="The document cannot be disposed of while the hold stands." onClose={() => setHold(null)}>
          <FormGrid submitLabel="Place hold" busy={action.busy} error={action.error} onSubmit={() => save(hold.doc, true, hold.reason)}>
            <Field label="Reason" full>
              <textarea value={hold.reason} onChange={(e) => setHold({ ...hold, reason: e.target.value })} rows={3} required />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

/** Who opened a document, through which channel and when (SH09A: document access log; READ_AUDIT). */
function AccessLog({ session, doc, onClose }) {
  const owner = doc.ownerKind === "POLICY" ? "policies" : "claims";
  const log = useResource(session, `/portfolio/${owner}/${encodeURIComponent(doc.ownerRef)}/document-access`, []);
  const id = Number(doc.docKey.slice(2));
  const rows = (log.data || []).filter((a) => a.documentId === id && a.kind === (doc.ownerKind === "POLICY" ? "POLICY" : "CLAIM"));
  return (
    <Drawer title={"Access log · " + doc.fileName} description={doc.ownerRef + " · every opening and download is recorded."} onClose={onClose}>
      <ErrorNote error={log.error} />
      <DataTable
        rows={rows}
        loading={log.loading}
        rowKey={(a) => a.accessedAt + a.username}
        empty="Nobody has opened this document"
        columns={[
          { key: "accessedAt", label: "When", render: (a) => when(a.accessedAt) },
          { key: "username", label: "Who" },
          { key: "channel", label: "Channel", render: (a) => (a.channel === "PORTAL" ? "Customer portal" : "Workspace") },
        ]}
      />
    </Drawer>
  );
}

const SCAN_TONE = { GENERATED: "blue", CLEAN: "green", RELEASED_UNSCANNED: "amber", NOT_SCANNED: "amber", QUARANTINED: "amber", REJECTED: "red" };

/**
 * The upload quarantine (AT-SH09A-02). No malware scanner is connected, so every upload waits here: it cannot be opened
 * from the claim or count as evidence until a reviewer (RELEASE_DOCUMENT, not the uploader) releases it with a note,
 * recorded as not scanned, or rejects it with a reason the uploader sees.
 */
function Quarantine({ session, notify, profile, onChange }) {
  const [status, setStatus] = useState("PENDING");
  const list = useResource(session, "/portfolio/document-quarantine?status=" + status, []);
  const action = useAction(notify);
  const [deciding, setDeciding] = useState(null);
  const reviewer = can(profile, "RELEASE_DOCUMENT");
  const me = profile?.username;
  const inspect = async (u) => {
    const tab = window.open("", "_blank");
    try {
      const url = URL.createObjectURL(await fetchFile(session, "/portfolio/document-quarantine/" + u.id + "/file"));
      if (tab) tab.location.href = url;
      else window.location.assign(url);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      tab?.close();
      notify(error.message, "error");
    }
  };
  const decide = async () => {
    const release = deciding.verdict === "release";
    const done = await action.run(
      () =>
        request(session, "/portfolio/document-quarantine/" + deciding.upload.id + "/" + deciding.verdict, {
          method: "POST",
          body: release ? { note: deciding.text.trim() } : { reason: deciding.text.trim() },
        }),
      release ? deciding.upload.fileName + " released to " + deciding.upload.ownerRef : deciding.upload.fileName + " rejected",
    );
    if (done) {
      setDeciding(null);
      list.reload();
      onChange?.();
    }
  };
  return (
    <>
      <Panel
        title="Upload quarantine"
        subtitle="Uploaded files wait here before they can be opened or count as evidence. No malware scanner is connected, so a release is recorded as not scanned."
        action={
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Quarantine filter">
            <option value="PENDING">Waiting for release</option>
            <option value="RELEASED">Released</option>
            <option value="REJECTED">Rejected</option>
            <option value="ALL">All</option>
          </select>
        }
      >
        <ErrorNote error={list.error || (!deciding && action.error)} />
        <DataTable
          rows={list.data}
          loading={list.loading}
          rowKey={(u) => u.id}
          empty={status === "PENDING" ? "Nothing waiting for release" : "No uploads"}
          emptyDetail="Claim, identity (KYC) and service case evidence uploaded by staff or in the customer portal appears here first."
          searchPlaceholder="Search file, record, customer…"
          columns={[
            {
              key: "fileName",
              label: "Upload",
              render: (u) => (
                <>
                  {u.fileName}
                  <small className="ws-hint"> · {u.documentType} · {u.classification}</small>
                </>
              ),
            },
            {
              key: "ownerRef",
              label: "Record",
              render: (u) => (
                <>
                  {u.ownerRef + (u.customerName ? " · " + u.customerName : "")}
                  <small className="ws-hint">
                    {" "}
                    · {u.ownerKind === "IDENTITY" ? "Identity evidence (KYC)" : u.ownerKind === "SERVICE_CASE" ? "Service case" : "Claim"}
                  </small>
                </>
              ),
            },
            {
              key: "uploadedBy",
              label: "From",
              render: (u) => u.uploadedBy + (u.channel === "PORTAL" ? " (customer portal)" : " (staff)"),
            },
            { key: "uploadedAt", label: "Received", render: (u) => when(u.uploadedAt) },
            {
              key: "scanResult",
              label: "Scan",
              render: (u) => (
                <span title={u.scanDetail}>
                  <Badge tone={u.scanResult === "CLEAN" ? "green" : u.scanResult === "INFECTED" ? "red" : "amber"}>
                    {u.scanResult === "NOT_SCANNED" ? "Not scanned" : label(u.scanResult)}
                  </Badge>
                </span>
              ),
            },
            {
              key: "status",
              label: "Decision",
              render: (u) =>
                u.status === "PENDING" ? (
                  <Badge tone="amber">Waiting</Badge>
                ) : (
                  <>
                    <Badge tone={u.status === "RELEASED" ? "green" : "red"}>{label(u.status)}</Badge>
                    <small className="ws-hint">
                      {" "}
                      {u.decidedBy} · {u.decisionReason}
                    </small>
                  </>
                ),
            },
            {
              key: "act",
              label: "",
              render: (u) =>
                reviewer && (
                  <span className="ws-row-actions">
                    <Button variant="secondary" icon={Eye} onClick={() => inspect(u)}>
                      Inspect
                    </Button>
                    {u.status === "PENDING" &&
                      (u.uploadedBy === me ? (
                        <small className="ws-hint">You uploaded this; another reviewer decides</small>
                      ) : (
                        <>
                          <Button icon={CheckCheck} onClick={() => setDeciding({ upload: u, verdict: "release", text: "" })}>
                            Release
                          </Button>
                          <Button variant="secondary" icon={Ban} onClick={() => setDeciding({ upload: u, verdict: "reject", text: "" })}>
                            Reject
                          </Button>
                        </>
                      ))}
                  </span>
                ),
            },
          ]}
        />
      </Panel>
      {deciding && (
        <Drawer
          title={(deciding.verdict === "release" ? "Release " : "Reject ") + deciding.upload.fileName}
          description={
            deciding.verdict === "release"
              ? "The file joins " + deciding.upload.ownerRef + " as " + deciding.upload.documentType + " and counts as evidence. It has not been scanned for malware: inspect it first."
              : "The file stays out of " + deciding.upload.ownerRef + ". The uploader sees this reason."
          }
          onClose={() => setDeciding(null)}
        >
          <FormGrid
            submitLabel={deciding.verdict === "release" ? "Release without a scan" : "Reject upload"}
            busy={action.busy}
            error={action.error}
            onSubmit={decide}
          >
            <Field label={deciding.verdict === "release" ? "What you checked" : "Reason"} full hint="5 to 500 characters">
              <textarea
                rows={3}
                required
                minLength={5}
                maxLength={500}
                value={deciding.text}
                placeholder={deciding.verdict === "release" ? "e.g. Opened it: an original death certificate" : "e.g. The page is unreadable; please upload a clear copy"}
                onChange={(e) => setDeciding({ ...deciding, text: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

function Partners({ session, notify, profile, onChange }) {
  const requests = useResource(session, "/ops/portal-requests", []);
  const accounts = useResource(session, can(profile, "READ_USER") ? "/ops/portal-accounts" : null, []);
  const [closing, setClosing] = useState(null);
  const [account, setAccount] = useState(null);
  const action = useAction(notify);
  const close = async () => {
    const done = await action.run(
      () => request(session, "/ops/portal-requests/" + closing.recordRef + "/close", { method: "POST", body: { note: closing.note } }),
      "Request completed",
    );
    if (done) {
      setClosing(null);
      requests.reload();
      onChange();
    }
  };
  const saveAccount = async () => {
    const done = await action.run(() => request(session, "/ops/portal-accounts", { method: "PUT", body: account }), "Portal access saved");
    if (done) {
      accounts.setData(done.data);
      setAccount(null);
    }
  };
  return (
    <>
      <Panel title="Requests from partners" subtitle="Sent by agents, employers and lenders from their portal. Action each in its own module, then answer it here.">
        <ErrorNote error={requests.error} />
        <DataTable
          rows={requests.data}
          loading={requests.loading}
          rowKey={(r) => r.recordRef}
          empty="No requests"
          columns={[
            { key: "recordRef", label: "Reference" },
            { key: "portalType", label: "From", render: (r) => label(r.portalType) + " · " + (r.scopeRef || "") },
            { key: "requestType", label: "Request", render: (r) => label(r.requestType) },
            { key: "detail", label: "Detail" },
            { key: "createdAt", label: "Received", render: (r) => r.createdBy + " · " + when(r.createdAt) },
            { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "DONE" ? "green" : "amber"}>{r.status === "DONE" ? "Completed" : "Open"}</Badge> },
            {
              key: "act",
              label: "",
              render: (r) =>
                r.status === "OPEN" && (
                  <Button variant="secondary" onClick={() => setClosing({ ...r, note: "" })}>
                    Answer
                  </Button>
                ),
            },
          ]}
        />
      </Panel>
      {can(profile, "READ_USER") && (
        <Panel
          title="Portal access"
          subtitle="Each partner login is tied to one intermediary, scheme or lender, and sees nothing else."
          action={
            can(profile, "UPDATE_USER") && (
              <Button onClick={() => setAccount({ username: "", portalType: "AGENT", scopeRef: "" })}>Link a login</Button>
            )
          }
        >
          <DataTable
            rows={accounts.data}
            loading={accounts.loading}
            rowKey={(r) => r.username}
            searchFrom={99}
            columns={[
              { key: "username", label: "Login" },
              { key: "portalType", label: "Portal", render: (r) => label(r.portalType) },
              { key: "scopeRef", label: "Sees only", render: (r) => r.scopeRef || "Not linked" },
              {
                key: "act",
                label: "",
                render: (r) =>
                  can(profile, "UPDATE_USER") && (
                    <Button variant="secondary" onClick={() => setAccount({ ...r, scopeRef: r.scopeRef || "" })}>
                      Change
                    </Button>
                  ),
              },
            ]}
          />
        </Panel>
      )}
      {closing && (
        <Drawer title={"Answer " + closing.recordRef} description={closing.detail} onClose={() => setClosing(null)}>
          <FormGrid submitLabel="Complete request" busy={action.busy} error={action.error} onSubmit={close}>
            <Field label="Answer to the partner" full>
              <textarea value={closing.note} onChange={(e) => setClosing({ ...closing, note: e.target.value })} rows={3} required />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      {account && (
        <Drawer title="Portal access" onClose={() => setAccount(null)}>
          <FormGrid submitLabel="Save" busy={action.busy} error={action.error} onSubmit={saveAccount}>
            <Field label="Login (username)" full>
              <input value={account.username} onChange={(e) => setAccount({ ...account, username: e.target.value })} required />
            </Field>
            <Field label="Portal">
              <select value={account.portalType} onChange={(e) => setAccount({ ...account, portalType: e.target.value })}>
                <option value="AGENT">Agent / broker</option>
                <option value="EMPLOYER">Employer</option>
                <option value="LENDER">Lender</option>
              </select>
            </Field>
            <Field label="Sees only" hint="Intermediary, scheme or lender reference">
              <input value={account.scopeRef} onChange={(e) => setAccount({ ...account, scopeRef: e.target.value })} required />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

/** Hospital cash, credit claim and contractual benefit payouts, shown under the claims register. */
export function ClaimPayouts({ session, go }) {
  const payouts = useResource(session, "/ops/payouts", []);
  return (
    <Panel title="Other benefit payouts" subtitle="Hospital cash events, credit life claim allocations and contractual benefits, beside the claims above.">
      <ErrorNote error={payouts.error} />
      <DataTable
        rows={payouts.data}
        loading={payouts.loading}
        rowKey={(r) => r.kind + r.ref}
        empty="No other payouts"
        columns={[
          { key: "kind", label: "Type" },
          { key: "ref", label: "Reference" },
          { key: "policyRef", label: "Policy" },
          { key: "payee", label: "For" },
          { key: "detail", label: "Detail", render: (r) => label(String(r.detail || "")) },
          { key: "amount", label: "Amount", align: "right", sortValue: (r) => Number(r.amount), render: (r) => pula(r.amount) },
          { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "PAID" ? "green" : undefined}>{label(r.status)}</Badge> },
          {
            key: "act",
            label: "",
            render: (r) => (
              <Button variant="secondary" onClick={() => go(r.page)}>
                Open
              </Button>
            ),
          },
        ]}
      />
    </Panel>
  );
}
