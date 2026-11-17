import React, { useState } from "react";
import { Pencil, Search } from "lucide-react";
import { request } from "./api";
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
          can(profile, "READ_POLICY") && ["documents", "Documents"],
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
            { key: "steps", label: "Steps" },
            { key: "versionNo", label: "Version", align: "right" },
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
              </>
            )}
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

function Documents({ session, notify, profile }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const docs = useResource(session, "/ops/documents" + (term ? "?q=" + encodeURIComponent(term) : ""), null);
  const [hold, setHold] = useState(null);
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
      <Panel
        title="Document register"
        subtitle={
          "Every stored document has passed the upload scan. Retention: " +
          Object.entries(retention)
            .map(([k, v]) => k.toLowerCase() + " " + v + " years")
            .join(", ") +
          ". A document on legal hold is never eligible for disposal."
        }
        action={
          <form
            className="ws-row-actions"
            onSubmit={(e) => {
              e.preventDefault();
              setTerm(q);
            }}
          >
            <input aria-label="Search documents" value={q} onChange={(e) => setQ(e.target.value)} placeholder="File, type, policy, customer…" />
            <Button type="submit" variant="secondary" icon={Search}>
              Search
            </Button>
          </form>
        }
      >
        <ErrorNote error={docs.error || action.error} />
        <DataTable
          rows={docs.data?.documents}
          loading={docs.loading}
          rowKey={(r) => r.docKey}
          searchFrom={999}
          empty="No documents found"
          columns={[
            { key: "fileName", label: "Document" },
            { key: "documentClass", label: "Class" },
            { key: "ownerRef", label: "Belongs to", render: (r) => r.ownerRef + " · " + r.customerName },
            { key: "uploadedAt", label: "Stored", render: (r) => when(r.uploadedAt) },
            { key: "scanStatus", label: "Scan", render: (r) => <Badge tone="green">{r.scanStatus}</Badge> },
            { key: "retainUntil", label: "Keep until" },
            {
              key: "legalHold",
              label: "Hold",
              render: (r) => (r.legalHold ? <Badge tone="red">On hold</Badge> : r.disposalEligible ? <Badge tone="amber">Due for disposal</Badge> : "—"),
            },
            {
              key: "act",
              label: "",
              render: (r) =>
                can(profile, "UPDATE_POLICY") &&
                (r.legalHold ? (
                  <Button variant="secondary" busy={action.busy} onClick={() => save(r, false)}>
                    Lift hold
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => setHold({ doc: r, reason: "" })}>
                    Legal hold
                  </Button>
                )),
            },
          ]}
        />
      </Panel>
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
