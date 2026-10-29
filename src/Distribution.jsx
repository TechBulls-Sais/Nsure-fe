import React, { useMemo, useState } from "react";
import { BadgeCheck, Banknote, FileText, Link2, Plus, UserPlus } from "lucide-react";
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

// SH06 distribution and commissions: appointments, commission rules, policy assignments, the commission ledger
// (accrued from premium events, clawed back on cancellation) and commission statements.

const today = () => new Date().toISOString().slice(0, 10);
const inYears = (n) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + n);
  return d.toISOString().slice(0, 10);
};
const pct = (v) => (v === null || v === undefined ? "—" : Number(v).toFixed(2) + "%");
const blankAssignment = () => ({ policyRef: "", intermediaryRef: "", effectiveFrom: "" });

export default function Distribution({ session, notify, profile }) {
  const [tab, setTab] = useState("intermediaries");
  const intermediaries = useResource(session, "/distribution/intermediaries", []);
  const statements = useResource(session, "/distribution/statements", []);
  const list = intermediaries.data || [];
  const loading = intermediaries.loading && !list.length;
  const active = list.filter((i) => i.canTakeBusiness).length;
  const openAssignments = list.reduce((s, i) => s + (i.openAssignments || 0), 0);
  const unstatemented = list.reduce((s, i) => s + Number(i.unstatementedBalance || 0), 0);
  const awaiting = (statements.data || []).filter((s) => s.status === "ISSUED");

  return (
    <>
      <Heading
        eyebrow="DISTRIBUTION & COMMISSIONS"
        title="Distribution"
        subtitle="Agents and brokers, the policies they service and the commission they earn — accrued on every premium, clawed back on cancellation."
      />
      <div className="stat-grid">
        <Stat
          label="Intermediaries taking business"
          value={active}
          note={list.length + " appointed"}
          loading={loading}
        />
        <Stat label="Policies assigned" value={openAssignments} tone="blue" loading={loading} />
        <Stat label="Commission not yet statemented" value={pula(unstatemented)} tone="amber" loading={loading} />
        <Stat
          label="Statements awaiting payment"
          value={awaiting.length}
          note={pula(awaiting.reduce((s, x) => s + Number(x.netAmount || 0), 0))}
          tone={awaiting.length ? "amber" : "green"}
          loading={statements.loading && !statements.data?.length}
        />
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ["intermediaries", "Intermediaries"],
          ["rules", "Commission rules"],
          ["assignments", "Assignments"],
          ["commissions", "Commission ledger"],
          ["statements", "Statements"],
        ]}
      />
      {tab === "intermediaries" && (
        <Intermediaries session={session} notify={notify} profile={profile} resource={intermediaries} />
      )}
      {tab === "rules" && <Rules session={session} notify={notify} profile={profile} />}
      {tab === "assignments" && (
        <Assignments
          session={session}
          notify={notify}
          profile={profile}
          intermediaries={list}
          onChange={intermediaries.reload}
        />
      )}
      {tab === "commissions" && <Commissions session={session} intermediaries={list} />}
      {tab === "statements" && (
        <Statements
          session={session}
          notify={notify}
          profile={profile}
          intermediaries={list}
          resource={statements}
          onChange={intermediaries.reload}
        />
      )}
    </>
  );
}

// ── intermediaries ──────────────────────────────────────────────────────────────────────────────

const blankAppointment = () => ({
  name: "",
  type: "AGENT",
  licenceNumber: "",
  appointmentExpiry: inYears(1),
  parentRef: "",
  email: "",
  mobile: "",
});

const STATUS_CHANGE = {
  SUSPENDED: "Suspend",
  LAPSED: "Lapse",
  ACTIVE: "Reinstate",
};

function Intermediaries({ session, notify, profile, resource }) {
  const manage = can(profile, "MANAGE_DISTRIBUTION");
  const [form, setForm] = useState(null);
  const [selected, setSelected] = useState(null);
  const [change, setChange] = useState(null);
  const appoint = useAction(notify);
  const update = useAction(notify);
  const confirm = useConfirm();
  const brokers = (resource.data || []).filter((i) => i.type === "BROKER");

  const save = async () => {
    const body = { ...form };
    if (!body.parentRef) delete body.parentRef;
    const done = await appoint.run(
      () => request(session, "/distribution/intermediaries", { method: "POST", body }),
      "Intermediary appointed",
    );
    if (done) {
      setForm(null);
      resource.reload();
    }
  };

  const select = (row) => {
    if (selected?.ref === row.ref) {
      setSelected(null);
      return;
    }
    setSelected(row);
    setChange({ status: row.status, reason: "", appointmentExpiry: row.appointmentExpiry });
    update.setError("");
  };

  const saveChange = async () => {
    const body = { appointmentExpiry: change.appointmentExpiry };
    if (change.status !== selected.status || change.reason) {
      body.status = change.status;
      if (change.reason) body.reason = change.reason;
    }
    if (change.status !== selected.status) {
      const verb = STATUS_CHANGE[change.status] || "Change";
      const ok = await confirm({
        title: verb + " " + selected.name + "?",
        message:
          change.status === "ACTIVE" ? (
            <>
              <strong>{selected.name}</strong> ({selected.ref}) can take new policies again until{" "}
              {change.appointmentExpiry}.
            </>
          ) : (
            <>
              <strong>{selected.name}</strong> ({selected.ref}) takes no new policies while{" "}
              {change.status === "SUSPENDED" ? "suspended" : "lapsed"}.
              {change.reason && <> Reason: {change.reason}.</>}
            </>
          ),
        confirmLabel: verb + " appointment",
        tone: change.status === "ACTIVE" ? undefined : "danger",
      });
      if (!ok) return;
    }
    const done = await update.run(
      () =>
        request(session, "/distribution/intermediaries/" + encodeURIComponent(selected.ref), {
          method: "PUT",
          body,
        }),
      "Appointment updated",
    );
    if (done) {
      setSelected(done.data);
      setChange({ status: done.data.status, reason: "", appointmentExpiry: done.data.appointmentExpiry });
      resource.reload();
    }
  };

  return (
    <>
      {form && (
        <Drawer
          title="Appoint an intermediary"
          description="A new appointment is active until its expiry date."
          onClose={() => setForm(null)}
        >
          <FormGrid submitLabel="Appoint" busy={appoint.busy} error={appoint.error} onSubmit={save}>
            <Field label="Name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Type">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="AGENT">Agent</option>
                <option value="BROKER">Broker</option>
              </select>
            </Field>
            <Field label="Licence number">
              <input
                value={form.licenceNumber}
                onChange={(e) => setForm({ ...form, licenceNumber: e.target.value })}
                required
              />
            </Field>
            <Field label="Appointment expiry">
              <input
                type="date"
                min={today()}
                value={form.appointmentExpiry}
                onChange={(e) => setForm({ ...form, appointmentExpiry: e.target.value })}
                required
              />
            </Field>
            <Field label="Reports to (broker)" hint="Optional">
              <select value={form.parentRef} onChange={(e) => setForm({ ...form, parentRef: e.target.value })}>
                <option value="">None</option>
                {brokers.map((b) => (
                  <option key={b.ref} value={b.ref}>
                    {b.name} ({b.ref})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Mobile">
              <input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      <Panel
        title="Intermediaries"
        subtitle="Select a row to suspend, lapse, reinstate or renew an appointment. A suspended, lapsed or expired appointment takes no new policies."
        action={
          manage && (
            <Button icon={Plus} onClick={() => setForm(blankAppointment())}>
              Appoint intermediary
            </Button>
          )
        }
      >
        <ErrorNote error={resource.error} />
        <DataTable
          rows={resource.data}
          loading={resource.loading}
          rowKey={(r) => r.ref}
          onRowClick={select}
          empty="No intermediaries appointed"
          emptyDetail="Appoint an agent or broker to start assigning policies and earning commission."
          searchPlaceholder="Search name, ref, licence, broker…"
          columns={[
            { key: "ref", label: "Ref" },
            { key: "name", label: "Name" },
            { key: "type", label: "Type", render: (r) => (r.type === "BROKER" ? "Broker" : "Agent") },
            { key: "licenceNumber", label: "Licence" },
            {
              key: "status",
              label: "Status",
              sortValue: (r) => (r.status === "ACTIVE" && !r.canTakeBusiness ? "EXPIRED" : r.status),
              render: (r) => <Badge>{r.status === "ACTIVE" && !r.canTakeBusiness ? "EXPIRED" : r.status}</Badge>,
            },
            { key: "appointmentExpiry", label: "Expires" },
            { key: "parentName", label: "Reports to", render: (r) => r.parentName || "—" },
            { key: "openAssignments", label: "Policies", align: "right" },
            {
              key: "unstatementedBalance",
              label: "Unstatemented",
              align: "right",
              sortValue: (r) => Number(r.unstatementedBalance || 0),
              render: (r) => pula(r.unstatementedBalance),
            },
          ]}
        />
      </Panel>
      {selected && (
        <Drawer
          title={selected.name + " · " + selected.ref}
          description={selected.statusReason ? "Reason: " + selected.statusReason : undefined}
          onClose={() => setSelected(null)}
        >
          <div className="ws-kv">
            <div><small>Status</small><strong><Badge>{selected.status}</Badge></strong></div>
            <div><small>Licence</small><strong>{selected.licenceNumber}</strong></div>
            <div><small>Email</small><strong>{selected.email || "—"}</strong></div>
            <div><small>Mobile</small><strong>{selected.mobile || "—"}</strong></div>
            <div><small>Appointed by</small><strong>{selected.createdBy}</strong></div>
            <div><small>Last changed</small><strong>{when(selected.updatedAt)} · {selected.updatedBy}</strong></div>
          </div>
          {manage && change && (
            <FormGrid submitLabel="Save appointment" busy={update.busy} error={update.error} onSubmit={saveChange}>
              <Field label="Status">
                <select value={change.status} onChange={(e) => setChange({ ...change, status: e.target.value })}>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="LAPSED">Lapsed</option>
                </select>
              </Field>
              <Field label="Appointment expiry">
                <input
                  type="date"
                  value={change.appointmentExpiry || ""}
                  onChange={(e) => setChange({ ...change, appointmentExpiry: e.target.value })}
                  required
                />
              </Field>
              <Field
                label="Reason"
                full
                hint={change.status === "ACTIVE" ? "Optional" : "Required to suspend or lapse an appointment"}
              >
                <input
                  value={change.reason}
                  onChange={(e) => setChange({ ...change, reason: e.target.value })}
                  required={change.status !== "ACTIVE" && change.status !== selected.status}
                />
              </Field>
            </FormGrid>
          )}
        </Drawer>
      )}
    </>
  );
}

// ── commission rules ────────────────────────────────────────────────────────────────────────────

function Rules({ session, notify, profile }) {
  const rules = useResource(session, "/distribution/commission-rules", []);
  const products = useResource(session, "/public/products", []);
  const [form, setForm] = useState(null);
  const action = useAction(notify);
  const names = (products.data || []).map((p) => p.name);

  const save = async () => {
    const done = await action.run(
      () => request(session, "/distribution/commission-rules", { method: "POST", body: form }),
      "Commission rule added",
    );
    if (done) {
      setForm(null);
      rules.reload();
    }
  };

  const ruleState = (r) => (r.current ? "In force" : r.effectiveFrom > today() ? "Scheduled" : "Superseded");

  return (
    <>
      {form && (
        <Drawer
          title="New commission rule"
          description="Rules are never edited: a new rate takes over from its effective date."
          onClose={() => setForm(null)}
        >
          <FormGrid submitLabel="Add rule" busy={action.busy} error={action.error} onSubmit={save}>
            <Field label="Product">
              <select value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} required>
                <option value="">Choose a product</option>
                {names.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Intermediary type">
              <select
                value={form.intermediaryType}
                onChange={(e) => setForm({ ...form, intermediaryType: e.target.value })}
              >
                <option value="AGENT">Agent</option>
                <option value="BROKER">Broker</option>
              </select>
            </Field>
            <Field label="First-premium rate (%)">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.initialRatePercent}
                onChange={(e) => setForm({ ...form, initialRatePercent: e.target.value })}
                required
              />
            </Field>
            <Field label="Renewal rate (%)">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.renewalRatePercent}
                onChange={(e) => setForm({ ...form, renewalRatePercent: e.target.value })}
                required
              />
            </Field>
            <Field label="Effective from">
              <input
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                required
              />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      <Panel
        title="Commission rules"
        subtitle="The rule in force is the latest one effective on the premium date, per product and intermediary type."
        action={
          can(profile, "MANAGE_DISTRIBUTION") && (
            <Button
              icon={Plus}
              onClick={() =>
                setForm({
                  product: "",
                  intermediaryType: "AGENT",
                  initialRatePercent: "",
                  renewalRatePercent: "",
                  effectiveFrom: today(),
                })
              }
            >
              New rule
            </Button>
          )
        }
      >
        <ErrorNote error={rules.error} />
        <DataTable
          rows={rules.data}
          loading={rules.loading}
          rowKey={(r) => r.id}
          empty="No commission rules"
          emptyDetail="Add a rule per product and intermediary type; until then premiums accrue no commission."
          searchPlaceholder="Search product, type, added by…"
          columns={[
            { key: "product", label: "Product" },
            { key: "intermediaryType", label: "Type", render: (r) => (r.intermediaryType === "BROKER" ? "Broker" : "Agent") },
            {
              key: "initialRatePercent",
              label: "First premium",
              align: "right",
              sortValue: (r) => Number(r.initialRatePercent),
              render: (r) => pct(r.initialRatePercent),
            },
            {
              key: "renewalRatePercent",
              label: "Renewal",
              align: "right",
              sortValue: (r) => Number(r.renewalRatePercent),
              render: (r) => pct(r.renewalRatePercent),
            },
            { key: "effectiveFrom", label: "Effective from" },
            {
              key: "current",
              label: "State",
              sortValue: ruleState,
              render: (r) =>
                r.current ? <Badge tone="green">In force</Badge> : r.effectiveFrom > today() ? <Badge tone="blue">Scheduled</Badge> : <Badge tone="amber">Superseded</Badge>,
            },
            { key: "createdBy", label: "Added by" },
          ]}
        />
      </Panel>
    </>
  );
}

// ── assignments ─────────────────────────────────────────────────────────────────────────────────

function Assignments({ session, notify, profile, intermediaries, onChange }) {
  const [filter, setFilter] = useState("");
  const assignments = useResource(
    session,
    "/distribution/assignments" + (filter ? "?policyRef=" + encodeURIComponent(filter) : ""),
    [],
  );
  const [form, setForm] = useState(null);
  const action = useAction(notify);
  const confirm = useConfirm();
  const eligible = intermediaries.filter((i) => i.canTakeBusiness);

  const save = async () => {
    const body = { policyRef: form.policyRef.trim(), intermediaryRef: form.intermediaryRef };
    if (form.effectiveFrom) body.effectiveFrom = form.effectiveFrom;
    const current = (assignments.data || []).find(
      (a) => a.open && a.policyRef.toUpperCase() === body.policyRef.toUpperCase(),
    );
    const target = eligible.find((i) => i.ref === body.intermediaryRef);
    // The list may be filtered to another policy, so an existing assignment cannot be ruled out.
    const unknown = !current && filter && filter.toUpperCase() !== body.policyRef.toUpperCase();
    if (current || unknown) {
      const ok = await confirm({
        title: "Transfer " + body.policyRef + "?",
        message: current ? (
          <>
            <strong>{body.policyRef}</strong> is serviced by {current.intermediaryName} ({current.intermediaryRef}). That
            assignment ends and later premiums earn commission for {target?.name || body.intermediaryRef}.
          </>
        ) : (
          <>
            If <strong>{body.policyRef}</strong> already has an intermediary, that assignment ends and later premiums
            earn commission for {target?.name || body.intermediaryRef}.
          </>
        ),
        confirmLabel: "Assign policy",
      });
      if (!ok) return;
    }
    const done = await action.run(
      () => request(session, "/distribution/assignments", { method: "POST", body }),
      "Policy " + body.policyRef + " assigned",
    );
    if (done) {
      setForm(null);
      assignments.reload();
      onChange?.();
    }
  };

  return (
    <>
      {form && (
        <Drawer
          title="Assign a policy"
          description="Assigning a policy that already has an intermediary transfers it: the old assignment ends and later premiums earn commission for the new one."
          onClose={() => setForm(null)}
        >
          <FormGrid submitLabel="Assign" busy={action.busy} error={action.error} onSubmit={save}>
            <Field label="Policy number">
              <input
                value={form.policyRef}
                placeholder="POL-10841"
                onChange={(e) => setForm({ ...form, policyRef: e.target.value })}
                required
              />
            </Field>
            <Field label="Intermediary" hint="Only active, unexpired appointments are listed">
              <select
                value={form.intermediaryRef}
                onChange={(e) => setForm({ ...form, intermediaryRef: e.target.value })}
                required
              >
                <option value="">Choose an intermediary</option>
                {eligible.map((i) => (
                  <option key={i.ref} value={i.ref}>
                    {i.name} ({i.type === "BROKER" ? "Broker" : "Agent"}, {i.ref})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Effective from" hint="Defaults to today">
              <input
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      <Panel
        title="Policy assignments"
        subtitle="Ended assignments stay as history."
        action={
          <div className="ws-row-actions">
            <input
              aria-label="Filter by policy"
              placeholder="Filter by policy"
              value={filter}
              onChange={(e) => setFilter(e.target.value.trim())}
            />
            {can(profile, "MANAGE_DISTRIBUTION") && (
              <Button icon={UserPlus} onClick={() => setForm(blankAssignment())}>
                Assign a policy
              </Button>
            )}
          </div>
        }
      >
        <ErrorNote error={assignments.error} />
        <DataTable
          rows={assignments.data}
          loading={assignments.loading}
          rowKey={(r) => r.id}
          empty="No policies assigned"
          emptyDetail={
            filter
              ? "No assignment matches this policy number; clear the filter to see them all."
              : "Assign a policy to an intermediary so its premiums earn them commission."
          }
          searchPlaceholder="Search policy, customer, intermediary…"
          columns={[
            { key: "policyRef", label: "Policy" },
            { key: "customerName", label: "Customer", render: (r) => r.customerName || "—" },
            { key: "product", label: "Product", render: (r) => r.product || "—" },
            { key: "intermediaryName", label: "Intermediary", render: (r) => r.intermediaryName + " (" + r.intermediaryRef + ")" },
            { key: "effectiveFrom", label: "From" },
            { key: "endedOn", label: "Ended", render: (r) => r.endedOn || "—" },
            {
              key: "open",
              label: "State",
              sortValue: (r) => (r.open ? "Open" : "Transferred"),
              render: (r) => <Badge tone={r.open ? "green" : "blue"}>{r.open ? "Open" : "Transferred"}</Badge>,
            },
            { key: "assignedBy", label: "By" },
          ]}
        />
      </Panel>
    </>
  );
}

// ── commission ledger ───────────────────────────────────────────────────────────────────────────

function Commissions({ session, intermediaries }) {
  const [intermediary, setIntermediary] = useState("");
  const [status, setStatus] = useState("");
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (intermediary) p.set("intermediaryRef", intermediary);
    if (status) p.set("status", status);
    const s = p.toString();
    return "/distribution/commissions" + (s ? "?" + s : "");
  }, [intermediary, status]);
  const ledger = useResource(session, query, []);
  const net = (ledger.data || []).reduce((s, c) => s + Number(c.amount || 0), 0);

  return (
    <Panel
      title="Commission ledger"
      subtitle={"One line per premium or cancellation event · net " + pula(net)}
      action={
        <div className="ws-row-actions">
          <select aria-label="Intermediary" value={intermediary} onChange={(e) => setIntermediary(e.target.value)}>
            <option value="">All intermediaries</option>
            {intermediaries.map((i) => (
              <option key={i.ref} value={i.ref}>
                {i.name}
              </option>
            ))}
          </select>
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="ACCRUED">Accrued</option>
            <option value="STATEMENTED">On a statement</option>
            <option value="PAID">Paid</option>
          </select>
        </div>
      }
    >
      <ErrorNote error={ledger.error} />
      <DataTable
        rows={ledger.data}
        loading={ledger.loading}
        rowKey={(r) => r.ref}
        empty="No commission yet"
        emptyDetail="A line accrues when a premium is received on an assigned policy, and is clawed back if the policy is cancelled."
        searchPlaceholder="Search line, policy, intermediary, statement…"
        columns={[
          { key: "ref", label: "Line" },
          { key: "createdAt", label: "Date", render: (r) => when(r.createdAt) },
          { key: "intermediaryName", label: "Intermediary" },
          { key: "policyRef", label: "Policy" },
          { key: "product", label: "Product" },
          {
            key: "kind",
            label: "Kind",
            render: (r) =>
              r.kind === "CLAWBACK" ? <Badge tone="red">Clawback of {r.reversesRef}</Badge> : <Badge tone="blue">Accrual</Badge>,
          },
          {
            key: "basisAmount",
            label: "Premium",
            align: "right",
            sortValue: (r) => Number(r.basisAmount),
            render: (r) => pula(r.basisAmount),
          },
          {
            key: "ratePercent",
            label: "Rate",
            align: "right",
            sortValue: (r) => Number(r.ratePercent),
            render: (r) => pct(r.ratePercent),
          },
          {
            key: "amount",
            label: "Commission",
            align: "right",
            sortValue: (r) => Number(r.amount),
            render: (r) => pula(r.amount),
          },
          { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
          { key: "statementRef", label: "Statement", render: (r) => r.statementRef || "—" },
        ]}
      />
    </Panel>
  );
}

// ── statements ──────────────────────────────────────────────────────────────────────────────────

function Statements({ session, notify, profile, intermediaries, resource, onChange }) {
  const pay = can(profile, "PAY_COMMISSION");
  const [intermediaryRef, setIntermediaryRef] = useState(null);
  const [open, setOpen] = useState(null);
  const issue = useAction(notify);
  const settle = useAction(notify);
  const confirm = useConfirm();
  const due = intermediaries.filter((i) => Number(i.unstatementedBalance || 0) !== 0);

  const issueStatement = async () => {
    const who = due.find((i) => i.ref === intermediaryRef);
    const ok = await confirm({
      title: "Issue a statement for " + (who?.name || intermediaryRef) + "?",
      message: (
        <>
          Every accrued line for <strong>{who?.name || intermediaryRef}</strong>, clawbacks included, moves onto one
          statement netting {pula(who?.unstatementedBalance)}. Those lines can no longer go on another statement.
        </>
      ),
      confirmLabel: "Issue statement",
    });
    if (!ok) return;
    const done = await issue.run(
      () => request(session, "/distribution/statements", { method: "POST", body: { intermediaryRef } }),
      "Statement issued",
    );
    if (done) {
      setIntermediaryRef(null);
      setOpen(done.data);
      resource.reload();
      onChange?.();
    }
  };

  const payStatement = async (statement) => {
    const ok = await confirm({
      title: "Pay statement " + statement.ref + "?",
      message: (
        <>
          Records {pula(statement.netAmount)} as paid to <strong>{statement.intermediaryName}</strong> for{" "}
          {statement.lineCount} commission lines. A paid statement is never changed.
        </>
      ),
      confirmLabel: "Mark as paid",
    });
    if (!ok) return;
    const ref = statement.ref;
    const done = await settle.run(
      () => request(session, `/distribution/statements/${encodeURIComponent(ref)}/pay`, { method: "POST" }),
      "Statement " + ref + " paid",
    );
    if (done) {
      setOpen(done.data);
      resource.reload();
    }
  };

  return (
    <>
      {intermediaryRef !== null && (
        <Drawer
          title="Issue a statement"
          description="Collects every accrued line for the intermediary, clawbacks included, into one net statement."
          onClose={() => setIntermediaryRef(null)}
        >
          <FormGrid submitLabel="Issue statement" busy={issue.busy} error={issue.error} onSubmit={issueStatement}>
            <Field label="Intermediary">
              <select value={intermediaryRef} onChange={(e) => setIntermediaryRef(e.target.value)} required>
                <option value="">Choose an intermediary</option>
                {due.map((i) => (
                  <option key={i.ref} value={i.ref}>
                    {i.name} · {pula(i.unstatementedBalance)}
                  </option>
                ))}
              </select>
            </Field>
          </FormGrid>
        </Drawer>
      )}
      <Panel
        title="Commission statements"
        subtitle="A paid statement is never changed. A negative statement is recovered from the intermediary, not paid."
        action={
          pay && (
            <Button
              icon={FileText}
              onClick={() => {
                issue.setError("");
                setIntermediaryRef("");
              }}
            >
              Issue a statement
            </Button>
          )
        }
      >
        <ErrorNote error={resource.error || settle.error} />
        <DataTable
          rows={resource.data}
          loading={resource.loading}
          rowKey={(r) => r.ref}
          onRowClick={(r) => setOpen(open?.ref === r.ref ? null : r)}
          empty="No statements issued"
          emptyDetail="Issue a statement to gather an intermediary's accrued commission for payment."
          searchPlaceholder="Search statement, intermediary, status…"
          columns={[
            { key: "ref", label: "Statement" },
            { key: "intermediaryName", label: "Intermediary" },
            { key: "lineCount", label: "Lines", align: "right" },
            {
              key: "netAmount",
              label: "Net",
              align: "right",
              sortValue: (r) => Number(r.netAmount),
              render: (r) => pula(r.netAmount),
            },
            { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
            { key: "issuedAt", label: "Issued", render: (r) => when(r.issuedAt) + " · " + r.issuedBy },
            { key: "paidAt", label: "Paid", render: (r) => (r.paidAt ? when(r.paidAt) + " · " + r.paidBy : "—") },
            {
              key: "act",
              label: "",
              render: (r) =>
                pay &&
                r.status === "ISSUED" &&
                Number(r.netAmount) >= 0 && (
                  <Button
                    variant="secondary"
                    icon={Banknote}
                    busy={settle.busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      payStatement(r);
                    }}
                  >
                    Pay
                  </Button>
                ),
            },
          ]}
        />
      </Panel>
      {open && (
        <Drawer
          size="lg"
          title={
            <>
              <FileText className="icon icon-sm" aria-hidden="true" /> {open.ref} · {open.intermediaryName}
            </>
          }
          description={"Net " + pula(open.netAmount) + " over " + open.lineCount + " lines"}
          onClose={() => setOpen(null)}
        >
          <div className="ws-row-actions">
            {open.status === "PAID" ? <Badge tone="green"><BadgeCheck className="icon icon-sm" /> Paid</Badge> : <Badge>{open.status}</Badge>}
          </div>
          <DataTable
            rows={open.lines}
            rowKey={(l) => l.ref}
            empty="No lines on this statement"
            searchPlaceholder="Search line, policy, product…"
            columns={[
              { key: "ref", label: "Line" },
              { key: "policyRef", label: "Policy", render: (l) => <><Link2 className="icon icon-sm" aria-hidden="true" /> {l.policyRef}</> },
              { key: "product", label: "Product" },
              { key: "kind", label: "Kind", render: (l) => <Badge tone={l.kind === "CLAWBACK" ? "red" : "blue"}>{l.kind === "CLAWBACK" ? "Clawback" : "Accrual"}</Badge> },
              {
                key: "basisAmount",
                label: "Premium",
                align: "right",
                sortValue: (l) => Number(l.basisAmount),
                render: (l) => pula(l.basisAmount),
              },
              {
                key: "ratePercent",
                label: "Rate",
                align: "right",
                sortValue: (l) => Number(l.ratePercent),
                render: (l) => pct(l.ratePercent),
              },
              {
                key: "amount",
                label: "Commission",
                align: "right",
                sortValue: (l) => Number(l.amount),
                render: (l) => pula(l.amount),
              },
            ]}
          />
        </Drawer>
      )}
    </>
  );
}
