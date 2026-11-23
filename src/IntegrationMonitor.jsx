import React, { useState } from "react";
import { FastForward, Play, Plus, Power, RefreshCw, Send } from "lucide-react";
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

// SH12 integration workspace: outbox events and their per-consumer deliveries, the dead-letter queue with owner and
// reason, the interface catalogue with live health and the simulated availability switch, the batch monitor, the
// reconciliation dashboard, inbound payment confirmations and the operator action log. Everything reads the API.

const consumers = (r) => r.deliveries.map((x) => x.handler.split(".")[0]).join(", ");
const seconds = (s) => (s == null ? "—" : s < 120 ? s + " s" : Math.round(s / 60) + " min");
const CONNECTION = { SIMULATED: "Simulated", MANUAL: "Manual (staff)", NOT_CONNECTED: "Not connected", LIVE: "In process" };
const connectionTone = (c) => ({ SIMULATED: "blue", MANUAL: "amber", NOT_CONNECTED: undefined, LIVE: "green" })[c];

export default function IntegrationMonitor({ session, notify, profile }) {
  const [tab, setTab] = useState("events");
  const [refresh, setRefresh] = useState(0);
  const dashboard = useResource(session, "/integration/dashboard");
  const action = useAction(notify);
  const confirm = useConfirm();
  const d = dashboard.data;
  const loading = dashboard.loading && !d;
  const changed = () => {
    dashboard.reload();
    setRefresh((n) => n + 1);
  };
  const dispatch = async () => {
    const pending = d?.deliveriesByStatus?.PENDING || 0;
    const ok = await confirm({
      title: "Dispatch pending deliveries now?",
      message:
        pending +
        " pending " +
        (pending === 1 ? "delivery is" : "deliveries are") +
        " offered to their consumers now (waiting retries keep their backoff). Any that fail show in the dead-letter queue once their retries run out.",
      confirmLabel: "Dispatch now",
    });
    if (!ok) return;
    const r = await action.run(() => request(session, "/integration/outbox/dispatch", { method: "POST" }));
    if (r) {
      notify(`Dispatched: ${r.data.delivered} delivered, ${r.data.failed} failed`, r.data.failed ? "error" : "success");
      changed();
    }
  };
  return (
    <>
      <Heading
        eyebrow="INTEGRATION & OPERATIONS"
        title="Integration monitor"
        subtitle="Every business event and interface: who consumed it, how long it took, what failed and who owns it — replayable without editing the payload."
      >
        {can(profile, "MANAGE_INTEGRATION") && (
          <Button icon={Play} busy={action.busy} onClick={dispatch}>
            Dispatch now
          </Button>
        )}
      </Heading>
      {d?.interfacesDown?.length > 0 && (
        <ErrorNote
          error={
            "Unavailable (simulated outage): " +
            d.interfacesDown.join(", ") +
            ". Their deliveries queue and retry; restore them under Interfaces."
          }
        />
      )}
      {(d || loading) && (
        <div className="stat-grid">
          <Stat label="Business events" value={d?.events} loading={loading} />
          <Stat
            label="Pending deliveries"
            value={d?.deliveriesByStatus?.PENDING || 0}
            tone="amber"
            note={d && (d.oldestPending ? "Oldest " + when(d.oldestPending) + " · " + d.retrying + " retrying" : "Queue is clear")}
            loading={loading}
          />
          <Stat
            label="Delivered"
            value={d?.deliveriesByStatus?.DELIVERED || 0}
            tone="blue"
            note={d && "Average latency " + seconds(d.averageLatencySeconds)}
            loading={loading}
          />
          <Stat
            label="Dead-lettered"
            value={d?.failed}
            tone={d?.failed ? "red" : "green"}
            note="Replay from the dead-letter queue"
            loading={loading}
          />
        </div>
      )}
      <ErrorNote error={dashboard.error} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ["events", "Events"],
          ["dead", "Dead-letter queue"],
          ["interfaces", "Interfaces"],
          ["batches", "Batches"],
          ["reconciliation", "Reconciliation"],
          ["compensations", "Compensations"],
          ["inbound", "Inbound payments"],
          ["screening", "KYC/AML screening"],
          ["log", "Operator log"],
        ]}
      />
      {tab === "events" && (
        <Events key={refresh} session={session} notify={notify} profile={profile} onChange={changed} />
      )}
      {tab === "dead" && (
        <DeadLetters key={refresh} session={session} notify={notify} profile={profile} onChange={changed} />
      )}
      {tab === "interfaces" && (
        <Interfaces key={refresh} session={session} notify={notify} profile={profile} onChange={changed} />
      )}
      {tab === "batches" && (
        <>
          <BatchReceipts session={session} notify={notify} profile={profile} />
          <Batches session={session} />
        </>
      )}
      {tab === "reconciliation" && <Reconciliation key={refresh} session={session} />}
      {tab === "compensations" && <Compensations key={refresh} session={session} />}
      {tab === "inbound" && (
        <Inbound session={session} notify={notify} profile={profile} onChange={dashboard.reload} />
      )}
      {tab === "screening" && <Screening session={session} notify={notify} profile={profile} />}
      {tab === "log" && <OperatorLog key={refresh} session={session} />}
    </>
  );
}

/** Replay with a reason: the original payload goes back to the consumer, which applies its own checks again. */
function ReplayDrawer({ session, notify, target, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const action = useAction(notify);
  const submit = async () => {
    const r = await action.run(() =>
      request(session, `/integration/deliveries/${target.id}/replay`, { method: "POST", body: { reason } }),
    );
    if (r) {
      notify(`Replayed: ${r.data.delivered} delivered, ${r.data.failed} failed`, r.data.failed ? "error" : "success");
      onDone();
    }
  };
  return (
    <Drawer
      title={"Replay to " + target.handler}
      description={
        target.eventType +
        " for " +
        target.aggregateRef +
        " goes back to " +
        target.handler +
        " with its original payload. It cannot be edited, and the consumer checks it again. The reason is logged."
      }
      onClose={onClose}
    >
      <p className="subtitle">
        Failed {target.attempts} {target.attempts === 1 ? "time" : "times"}
        {target.reason ? ": " + target.reason : "."}
      </p>
      <FormGrid submitLabel="Replay delivery" busy={action.busy} error={action.error} onSubmit={submit}>
        <Field label="Why replay it now" full>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} required minLength={5} />
        </Field>
      </FormGrid>
    </Drawer>
  );
}

function Events({ session, notify, profile, onChange }) {
  const events = useResource(session, "/integration/events", []);
  const [open, setOpen] = useState(null);
  const [replaying, setReplaying] = useState(null);
  const action = useAction(notify);
  const retryNow = async (delivery) => {
    const r = await action.run(() =>
      request(session, `/integration/deliveries/${delivery.id}/retry-now`, { method: "POST", body: {} }),
    );
    if (r) {
      notify(`Retried: ${r.data.delivered} delivered, ${r.data.failed} failed`);
      events.reload();
      onChange();
      setOpen(null);
    }
  };
  return (
    <Panel title="Recent events" subtitle="The canonical envelope of each event and its delivery to every consumer, with latency.">
      <ErrorNote error={events.error || (!open && action.error)} />
      <DataTable
        rowKey={(r) => r.eventId}
        rows={events.data}
        loading={events.loading}
        empty="No events yet"
        emptyDetail="Events are published as policies, payments and claims change."
        searchPlaceholder="Search event type, reference, publisher…"
        onRowClick={(r) => setOpen(r)}
        columns={[
          { key: "occurredAt", label: "When", render: (r) => when(r.occurredAt) },
          { key: "eventType", label: "Event" },
          { key: "aggregateRef", label: "Reference" },
          { key: "publishedBy", label: "By" },
          {
            key: "handlers",
            label: "Consumers",
            sortValue: consumers,
            render: (r) => consumers(r) || "—",
          },
          { key: "status", label: "Status", render: (r) => <Badge>{r.status.replace("_", " ")}</Badge> },
        ]}
      />
      {open && (
        <Drawer
          title={open.eventType + " · " + open.aggregateRef}
          description={"Published " + when(open.occurredAt) + " by " + open.publishedBy}
          size="lg"
          onClose={() => setOpen(null)}
        >
          <ErrorNote error={action.error} />
          <div className="ws-kv">
            <div><small>Event id</small><strong className="ws-mono">{open.eventId}</strong></div>
            <div><small>Correlation</small><strong className="ws-mono">{open.correlationId}</strong></div>
            <div><small>Schema version</small><strong>{open.schemaVersion}</strong></div>
            <div><small>Aggregate version</small><strong>{open.aggregateVersion ?? "—"}</strong></div>
          </div>
          <pre className="ws-mono">{JSON.stringify(JSON.parse(open.payload), null, 2)}</pre>
          <DataTable
            rows={open.deliveries}
            empty="No consumer subscribes to this event"
            columns={[
              { key: "handler", label: "Consumer" },
              { key: "status", label: "Status", render: (x) => <Badge>{x.status}</Badge> },
              { key: "attempts", label: "Attempts", align: "right" },
              { key: "latencySeconds", label: "Latency", align: "right", render: (x) => seconds(x.latencySeconds) },
              { key: "owner", label: "Owner" },
              {
                key: "lastError",
                label: "Last error / next try",
                render: (x) =>
                  x.status === "PENDING" && x.attempts > 0
                    ? (x.lastError || "") + " · next try " + when(x.nextAttemptAt)
                    : x.lastError || "—",
              },
              {
                key: "act",
                label: "",
                render: (x) =>
                  can(profile, "MANAGE_INTEGRATION") &&
                  (x.status === "FAILED" ? (
                    <Button
                      variant="secondary"
                      icon={RefreshCw}
                      onClick={() =>
                        setReplaying({ ...x, eventType: open.eventType, aggregateRef: open.aggregateRef, reason: x.lastError })
                      }
                    >
                      Replay
                    </Button>
                  ) : x.status === "PENDING" && x.attempts > 0 ? (
                    <Button variant="secondary" icon={FastForward} busy={action.busy} onClick={() => retryNow(x)}>
                      Retry now
                    </Button>
                  ) : null),
              },
            ]}
          />
        </Drawer>
      )}
      {replaying && (
        <ReplayDrawer
          session={session}
          notify={notify}
          target={replaying}
          onClose={() => setReplaying(null)}
          onDone={() => {
            setReplaying(null);
            setOpen(null);
            events.reload();
            onChange();
          }}
        />
      )}
    </Panel>
  );
}

function DeadLetters({ session, notify, profile, onChange }) {
  const rows = useResource(session, "/integration/dead-letters", []);
  const [replaying, setReplaying] = useState(null);
  return (
    <Panel
      title="Dead-letter queue"
      subtitle="Deliveries whose retries ran out (transient) or that can never succeed as they stand (permanent), each with the team that owns the business exception and the reason."
    >
      <ErrorNote error={rows.error} />
      <DataTable
        rowKey={(r) => r.deliveryId}
        rows={rows.data}
        loading={rows.loading}
        empty="The dead-letter queue is empty"
        emptyDetail="A delivery lands here when its consumer keeps failing, for example while an interface is unavailable."
        searchPlaceholder="Search event, reference, consumer, owner…"
        columns={[
          { key: "deadLetteredAt", label: "Dead-lettered", render: (r) => when(r.deadLetteredAt) },
          { key: "eventType", label: "Event" },
          { key: "aggregateRef", label: "Reference" },
          { key: "interfaceName", label: "Interface", render: (r) => r.interfaceName + " · " + r.handler },
          { key: "owner", label: "Owner" },
          {
            key: "failureClass",
            label: "Class",
            render: (r) => <Badge tone={r.failureClass === "PERMANENT" ? "red" : "amber"}>{r.failureClass.toLowerCase()}</Badge>,
          },
          { key: "attempts", label: "Attempts", align: "right" },
          { key: "reason", label: "Reason" },
          {
            key: "act",
            label: "",
            render: (r) =>
              can(profile, "MANAGE_INTEGRATION") && (
                <Button
                  variant="secondary"
                  icon={RefreshCw}
                  onClick={() => setReplaying({ id: r.deliveryId, handler: r.handler, eventType: r.eventType, aggregateRef: r.aggregateRef, attempts: r.attempts, reason: r.reason })}
                >
                  Replay
                </Button>
              ),
          },
        ]}
      />
      {replaying && (
        <ReplayDrawer
          session={session}
          notify={notify}
          target={replaying}
          onClose={() => setReplaying(null)}
          onDone={() => {
            setReplaying(null);
            rows.reload();
            onChange();
          }}
        />
      )}
    </Panel>
  );
}

function Interfaces({ session, notify, profile, onChange }) {
  const catalogue = useResource(session, "/integration/interfaces");
  const [open, setOpen] = useState(null);
  const [reason, setReason] = useState("");
  const action = useAction(notify);
  const rows = catalogue.data?.interfaces || [];
  const toggle = async () => {
    const r = await action.run(() =>
      request(session, `/integration/interfaces/${open.code}/availability`, {
        method: "PUT",
        body: { available: !open.available, reason },
      }),
    );
    if (r) {
      notify(open.name + ": " + r.data.outcome, "success");
      setOpen(null);
      setReason("");
      catalogue.reload();
      onChange();
    }
  };
  const kv = (label, value) => (
    <div key={label}>
      <small>{label}</small>
      <strong>{value || "—"}</strong>
    </div>
  );
  return (
    <Panel
      title="Interface catalogue"
      subtitle="Each interface with its owner, authentication, contract, frequency, SLA, reconciliation, retention and recovery runbook, and its live health. Register values marked (demo default) await the insurer's decisions D10/D12/D14."
    >
      <ErrorNote error={catalogue.error} />
      <DataTable
        rowKey={(r) => r.code}
        rows={rows}
        loading={catalogue.loading}
        pageSize={20}
        onRowClick={(r) => {
          setOpen(r);
          setReason("");
        }}
        searchPlaceholder="Search interface, owner, counterpart…"
        columns={[
          { key: "name", label: "Interface" },
          { key: "kind", label: "Kind", render: (r) => (r.kind === "EXTERNAL" ? "External" : "Internal consumer") },
          { key: "direction", label: "Direction" },
          {
            key: "connection",
            label: "Connection",
            render: (r) => <Badge tone={connectionTone(r.connection)}>{CONNECTION[r.connection] || r.connection}</Badge>,
          },
          {
            key: "available",
            label: "Status",
            sortValue: (r) => (r.available ? 1 : 0),
            render: (r) =>
              r.connection === "NOT_CONNECTED" ? "—" : <Badge tone={r.available ? "green" : "red"}>{r.available ? "Available" : "Unavailable"}</Badge>,
          },
          { key: "backlog", label: "Backlog", align: "right", sortValue: (r) => r.health.backlog, render: (r) => r.health.backlog },
          {
            key: "dead",
            label: "Dead letters",
            align: "right",
            sortValue: (r) => r.health.deadLetters,
            render: (r) => r.health.deadLetters,
          },
          {
            key: "latency",
            label: "Avg latency",
            align: "right",
            sortValue: (r) => r.health.averageLatencySeconds ?? -1,
            render: (r) => seconds(r.health.averageLatencySeconds),
          },
          {
            key: "success",
            label: "Success",
            align: "right",
            sortValue: (r) => r.health.successRate ?? -1,
            render: (r) => (r.health.successRate == null ? "—" : r.health.successRate + "%"),
          },
          { key: "exceptionOwner", label: "Exception owner" },
        ]}
      />
      {catalogue.data?.unregisteredConsumers?.length > 0 && (
        <p className="subtitle">Consumers not yet in the catalogue: {catalogue.data.unregisteredConsumers.join(", ")}</p>
      )}
      {open && (
        <Drawer title={open.name} description={open.counterpart + " · " + open.direction} size="lg" onClose={() => setOpen(null)}>
          <div className="ws-kv">
            {kv("Pattern", open.pattern)}
            {kv("Authentication", open.authentication)}
            {kv("Data contract", open.dataContract)}
            {kv("Frequency", open.frequency)}
            {kv("SLA", open.sla)}
            {kv("Reconciliation", open.reconciliation)}
            {kv("Retention", open.retention)}
            {kv("System owner", open.systemOwner)}
            {kv("Business exception owner", open.exceptionOwner)}
            {kv("Consumers", open.handlers.join(", "))}
            {kv("Connection", CONNECTION[open.connection] || open.connection)}
            {kv(
              "Availability",
              open.available
                ? "Available"
                : "Unavailable since " + when(open.availabilityChangedAt) + " (" + open.availabilityChangedBy + "): " + open.availabilityNote,
            )}
          </div>
          <h3 className="subtitle">Recovery runbook</h3>
          <p>{open.runbook}</p>
          <div className="stat-grid">
            <Stat label="Delivered" value={open.health.deliveries.DELIVERED} tone="blue" note={"Last " + when(open.health.lastDelivered)} />
            <Stat
              label="Backlog"
              value={open.health.backlog}
              tone="amber"
              note={open.health.oldestPending ? "Oldest " + when(open.health.oldestPending) : "Clear"}
            />
            <Stat label="Dead letters" value={open.health.deadLetters} tone={open.health.deadLetters ? "red" : "green"} />
            <Stat
              label="Latency (avg / p95)"
              value={seconds(open.health.averageLatencySeconds)}
              note={"p95 " + seconds(open.health.p95LatencySeconds)}
            />
          </div>
          {open.simulatable && can(profile, "MANAGE_INTEGRATION") && (
            <FormGrid
              submitLabel={open.available ? "Simulate outage" : "Restore and resume"}
              busy={action.busy}
              error={action.error}
              onSubmit={toggle}
            >
              <Field
                label={open.available ? "Why it is unavailable (simulated outage)" : "Why it is available again"}
                full
                hint={
                  open.available
                    ? "Provider simulator only: deliveries to this interface fail as transient, retry with backoff and are dead-lettered after the last attempt."
                    : "Its transient dead letters and waiting retries resume at once; nothing committed is lost or sent twice."
                }
              >
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} required minLength={5} />
              </Field>
            </FormGrid>
          )}
          {!open.simulatable && (
            <p className="subtitle">
              <Power className="icon icon-sm" aria-hidden="true" />{" "}
              {open.connection === "NOT_CONNECTED"
                ? "Not connected in this build."
                : open.connection === "MANUAL"
                  ? "Operated by staff: there is no automated connection to switch."
                  : "Availability comes from the real interface."}
            </p>
          )}
        </Drawer>
      )}
    </Panel>
  );
}

const CENSUS_HEADER = "memberKey,firstName,lastName,dateOfBirth,category,salary,action,effectiveDate";

const sha256 = async (text) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

/** §11 batch contract: a census batch arrives with a manifest that is checked before any row is staged. */
function BatchReceipts({ session, notify, profile }) {
  const receipts = useResource(session, "/integration/batch-receipts", []);
  const [form, setForm] = useState(null);
  const [ack, setAck] = useState(null);
  const action = useAction(notify);
  const norm = (csv) => csv.replaceAll("\r\n", "\n").trim();
  const rows = (csv) => Math.max(0, norm(csv).split("\n").filter((l) => l.trim()).length - 1);
  const total = (csv) =>
    norm(csv)
      .split("\n")
      .slice(1)
      .reduce((sum, l) => sum + (Number(l.split(",")[5]) || 0), 0)
      .toFixed(2);
  const fill = async () => {
    setForm({ ...form, recordCount: rows(form.csv), controlTotal: total(form.csv), checksum: await sha256(norm(form.csv)) });
  };
  const submit = async () => {
    const r = await action.run(() =>
      request(session, "/integration/batches/census", {
        method: "POST",
        body: {
          schemeRef: form.schemeRef,
          mode: "PARTIAL",
          csv: form.csv,
          correctsRef: form.correctsRef || undefined,
          manifest: {
            schemaVersion: form.schemaVersion,
            source: form.source,
            externalBatchId: form.externalBatchId,
            createdOn: new Date().toISOString().slice(0, 10),
            asOf: form.asOf,
            recordCount: Number(form.recordCount),
            currency: "BWP",
            controlTotal: form.controlTotal,
            checksum: form.checksum,
          },
        },
      }),
    );
    if (r) {
      notify(r.data.receiptRef + ": " + (r.data.status === "STAGED" ? "manifest checked, rows staged as " + r.data.stagedRef : "rejected before staging"), r.data.status === "STAGED" ? "success" : "error");
      setForm(null);
      receipts.reload();
      const detail = await action.run(() => request(session, "/integration/batch-receipts/" + r.data.receiptRef + "/acknowledgement"));
      if (detail) setAck(detail.data);
    }
  };
  const open = async (row) => {
    const r = await action.run(() => request(session, "/integration/batch-receipts/" + row.receiptRef + "/acknowledgement"));
    if (r) setAck(r.data);
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <Panel
      title="Partner batches with a manifest"
      subtitle="Each census batch declares its schema version, source, external id, dates, record count, currency, salary control total and SHA-256 checksum. The manifest is checked against the file before any row is staged; the acknowledgement gives accepted, rejected and pending rows, row errors and created members."
      action={
        can(profile, "PROCESS_CENSUS") && (
          <Button
            icon={Plus}
            onClick={() =>
              setForm({ schemeRef: "", externalBatchId: "HR-" + Date.now().toString().slice(-6), schemaVersion: "census-1", source: "Employer HR system", asOf: new Date().toISOString().slice(0, 10), csv: CENSUS_HEADER + "\n", recordCount: "", controlTotal: "", checksum: "", correctsRef: "" })
            }
          >
            Receive census batch
          </Button>
        )
      }
    >
      <ErrorNote error={receipts.error || (!form && action.error)} />
      <DataTable
        rowKey={(r) => r.receiptRef}
        rows={receipts.data}
        loading={receipts.loading}
        empty="No partner batches received"
        onRowClick={open}
        columns={[
          { key: "receivedAt", label: "Received", render: (r) => when(r.receivedAt) },
          { key: "receiptRef", label: "Receipt" },
          { key: "targetRef", label: "Scheme" },
          { key: "external", label: "External id", render: (r) => r.manifest.externalBatchId || "—" },
          { key: "status", label: "Manifest", render: (r) => <Badge tone={r.status === "STAGED" ? "green" : "red"}>{r.status.toLowerCase()}</Badge> },
          { key: "count", label: "Records", align: "right", render: (r) => r.manifest.actualCount + " (declared " + (r.manifest.declaredCount ?? "—") + ")" },
          { key: "accepted", label: "Accepted", align: "right" },
          { key: "rejected", label: "Rejected", align: "right" },
          { key: "pending", label: "Pending", align: "right" },
          { key: "correctsRef", label: "Corrects", render: (r) => r.correctsRef || "—" },
        ]}
      />
      {form && (
        <Drawer title="Receive a census batch" description="Paste the file and its manifest. 'Fill from the file' computes the count, salary total and checksum; change any of them to see the batch refused before staging." size="lg" onClose={() => setForm(null)}>
          <FormGrid
            submitLabel="Check manifest and stage"
            busy={action.busy}
            error={action.error}
            onSubmit={submit}
            extra={
              <Button type="button" variant="secondary" onClick={fill}>
                Fill from the file
              </Button>
            }
          >
            <Field label="Scheme reference">
              <input value={form.schemeRef} onChange={set("schemeRef")} required placeholder="SCH-001" />
            </Field>
            <Field label="External batch id">
              <input value={form.externalBatchId} onChange={set("externalBatchId")} required />
            </Field>
            <Field label="Schema version">
              <input value={form.schemaVersion} onChange={set("schemaVersion")} required />
            </Field>
            <Field label="Source">
              <input value={form.source} onChange={set("source")} required />
            </Field>
            <Field label="As of">
              <input type="date" value={form.asOf} onChange={set("asOf")} />
            </Field>
            <Field label="Corrects receipt (optional)">
              <input value={form.correctsRef} onChange={set("correctsRef")} placeholder="BR-00001" />
            </Field>
            <Field label="Census file (CSV)" full>
              <textarea rows={6} className="ws-mono" value={form.csv} onChange={set("csv")} required />
            </Field>
            <Field label="Declared record count">
              <input type="number" value={form.recordCount} onChange={set("recordCount")} required />
            </Field>
            <Field label="Declared salary total (BWP)">
              <input value={form.controlTotal} onChange={set("controlTotal")} required />
            </Field>
            <Field label="Declared SHA-256 checksum" full>
              <input className="ws-mono" value={form.checksum} onChange={set("checksum")} required />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      {ack && (
        <Drawer title={"Acknowledgement " + ack.receiptRef} description={ack.status === "STAGED" ? "Manifest matched; rows staged as " + ack.stagedRef + " (" + (ack.batchStatus || "") + ")" : "Rejected before staging: nothing was staged."} size="lg" onClose={() => setAck(null)}>
          {ack.problems.length > 0 && <ErrorNote error={ack.problems.join(". ")} />}
          <div className="stat-grid">
            <Stat label="Accepted" value={ack.accepted} tone="green" />
            <Stat label="Rejected" value={ack.rejected} tone={ack.rejected ? "red" : "green"} />
            <Stat label="Pending commit" value={ack.pending} tone="amber" />
            <Stat label="Records" value={ack.manifest.actualCount} note={"Declared " + (ack.manifest.declaredCount ?? "—")} />
          </div>
          {ack.rowErrors?.length > 0 && (
            <DataTable
              rowKey={(e) => e.line}
              rows={ack.rowErrors}
              columns={[
                { key: "line", label: "Line" },
                { key: "memberKey", label: "Member" },
                { key: "error", label: "Error" },
              ]}
            />
          )}
          {ack.createdRefs?.length > 0 && <p className="subtitle">Members created or changed: {ack.createdRefs.join(", ")}</p>}
          <pre className="ws-mono">{JSON.stringify(ack.manifest, null, 2)}</pre>
        </Drawer>
      )}
    </Panel>
  );
}

function Batches({ session }) {
  const rows = useResource(session, "/integration/batches", []);
  return (
    <Panel
      title="Batch monitor"
      subtitle="Census, bank statement, GL journal, reinsurance bordereau and extract batches in one place, with record counts, accepted and rejected rows and control totals."
    >
      <ErrorNote error={rows.error} />
      <DataTable
        rowKey={(r) => r.type + r.ref}
        rows={rows.data}
        loading={rows.loading}
        empty="No batches yet"
        searchPlaceholder="Search batch, type, status…"
        columns={[
          { key: "at", label: "When", render: (r) => when(r.at) },
          { key: "type", label: "Type" },
          { key: "ref", label: "Batch" },
          { key: "external", label: "Source / period", render: (r) => r.external || "—" },
          { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
          { key: "records", label: "Records", align: "right" },
          { key: "accepted", label: "Accepted", align: "right", render: (r) => r.accepted ?? "—" },
          { key: "rejected", label: "Rejected", align: "right", render: (r) => r.rejected ?? "—" },
          { key: "controlTotal", label: "Control total", align: "right", render: (r) => (r.controlTotal == null ? "—" : pula(r.controlTotal)) },
          { key: "by", label: "By" },
        ]}
      />
    </Panel>
  );
}

function Reconciliation({ session }) {
  const rows = useResource(session, "/integration/reconciliation", []);
  return (
    <>
      <ErrorNote error={rows.error} />
      {(rows.data || []).map((r) => (
        <Panel
          key={r.code}
          title={r.name}
          subtitle={
            <>
              <Badge tone={r.breaks ? "red" : "green"}>{r.breaks ? r.breaks + " break(s)" : "Reconciled"}</Badge> Exception owner:{" "}
              {r.exceptionOwner}
            </>
          }
        >
          <DataTable
            rowKey={(l) => l.measure}
            rows={r.lines}
            searchFrom={99}
            columns={[
              { key: "measure", label: "Measure" },
              { key: "left", label: "Sent / received", align: "right", render: (l) => l.leftLabel + ": " + (l.unit === "BWP" ? pula(l.left) : l.left) },
              { key: "right", label: "Confirmed", align: "right", render: (l) => l.rightLabel + ": " + (l.unit === "BWP" ? pula(l.right) : l.right) },
              { key: "difference", label: "Difference", align: "right", render: (l) => (l.unit === "BWP" ? pula(l.difference) : l.difference) },
              { key: "status", label: "", render: (l) => <Badge tone={l.status === "BREAK" ? "red" : "green"}>{l.status === "BREAK" ? "Break" : "Reconciled"}</Badge> },
              { key: "note", label: "Note", render: (l) => l.note || "—" },
            ]}
          />
        </Panel>
      ))}
    </>
  );
}

/** §11 Identity/KYC/AML through the simulated screening provider, with Compliance's referral decisions. */
function Screening({ session, notify, profile }) {
  const checks = useResource(session, "/integration/screening", []);
  const customers = useResource(session, can(profile, "READ_CUSTOMER") ? "/portfolio/customers" : null, []);
  const [customer, setCustomer] = useState("");
  const [deciding, setDeciding] = useState(null);
  const action = useAction(notify);
  const me = session?.username;
  const requestCheck = async () => {
    const r = await action.run(() => request(session, "/integration/screening", { method: "POST", body: { customerRef: customer } }));
    if (r) {
      notify(r.data.ref + ": " + r.data.status.toLowerCase() + (r.data.detail ? " · " + r.data.detail : ""), "success");
      setCustomer("");
      checks.reload();
    }
  };
  const retry = async () => {
    const r = await action.run(() => request(session, "/integration/screening/retry", { method: "POST" }));
    if (r) {
      notify(r.data.answered + " pending check(s) answered", "success");
      checks.reload();
    }
  };
  const decide = async () => {
    const { ref, ...body } = deciding;
    const r = await action.run(() => request(session, `/integration/screening/${ref}/disposition`, { method: "POST", body }), "Referral decided");
    if (r) {
      setDeciding(null);
      checks.reload();
    }
  };
  return (
    <Panel
      title="KYC/AML screening"
      subtitle="Simulated screening provider (no provider is selected yet): names containing a demo watch-list entry ('sanctioned', 'watchlist', 'politically exposed') come back as possible matches. Each request is matched to one outcome with an evidence reference and expiry; while the provider is unavailable a check stays pending and is re-sent. Compliance decides referrals; the result informs, but never changes, the customer's KYC decision."
      action={
        can(profile, "KYC_CUSTOMER") && (
          <Button variant="secondary" icon={RefreshCw} busy={action.busy} onClick={retry}>
            Re-send pending
          </Button>
        )
      }
    >
      <ErrorNote error={checks.error || (!deciding && action.error)} />
      {can(profile, "KYC_CUSTOMER") && (
        <FormGrid submitLabel="Request screening" busy={action.busy} onSubmit={requestCheck}>
          <Field label="Customer" full>
            <select value={customer} onChange={(e) => setCustomer(e.target.value)} required>
              <option value="">Choose…</option>
              {(customers.data || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} · {c.name}
                </option>
              ))}
            </select>
          </Field>
        </FormGrid>
      )}
      <DataTable
        rowKey={(r) => r.ref}
        rows={checks.data}
        loading={checks.loading}
        empty="No screening checks yet"
        searchPlaceholder="Search check, customer, status…"
        columns={[
          { key: "requestedAt", label: "Requested", render: (r) => when(r.requestedAt) },
          { key: "ref", label: "Check" },
          { key: "customerName", label: "Customer", render: (r) => r.customerName + " · " + r.customerRef },
          { key: "status", label: "Outcome", render: (r) => <Badge tone={r.status === "CLEAR" ? "green" : r.status === "PENDING" || r.status === "REFERRED" || r.status === "EXPIRED" ? "amber" : "red"}>{r.status.toLowerCase()}</Badge> },
          { key: "evidenceRef", label: "Evidence", render: (r) => r.evidenceRef || "—" },
          { key: "expiresOn", label: "Expires", render: (r) => r.expiresOn || "—" },
          { key: "attempts", label: "Attempts", align: "right" },
          { key: "detail", label: "Detail", render: (r) => (r.dispositionNote ? r.detail + " · Decision: " + r.dispositionNote + " (" + r.disposedBy + ")" : r.detail || "—") },
          {
            key: "act",
            label: "",
            render: (r) =>
              r.referralStatus === "OPEN" &&
              (r.requestedBy === me ? (
                <small className="ws-hint">Needs another person</small>
              ) : (
                can(profile, "DISPOSE_SCREENING") && (
                  <Button variant="secondary" onClick={() => setDeciding({ ref: r.ref, name: r.customerName, outcome: "CLEARED", note: "" })}>
                    Decide referral
                  </Button>
                )
              )),
          },
        ]}
      />
      {deciding && (
        <Drawer title={"Referral " + deciding.ref} description={deciding.name + ": clear the possible match or confirm it. The decision is kept as audit evidence."} onClose={() => setDeciding(null)}>
          <FormGrid submitLabel="Record decision" busy={action.busy} error={action.error} onSubmit={decide}>
            <Field label="Decision" full>
              <select value={deciding.outcome} onChange={(e) => setDeciding({ ...deciding, outcome: e.target.value })}>
                <option value="CLEARED">Not the listed person: clear</option>
                <option value="CONFIRMED_MATCH">Confirmed match</option>
              </select>
            </Field>
            <Field label="Basis of the decision" full>
              <textarea rows={3} value={deciding.note} onChange={(e) => setDeciding({ ...deciding, note: e.target.value })} required minLength={10} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </Panel>
  );
}

const LEG_TONE = { DONE: "green", NOTHING_TO_CORRECT: "green", IN_PROGRESS: "amber", NOT_AUTOMATED: "amber", FAILED: "red" };
const COMP_LABEL = { COMPLETE: "Complete", IN_PROGRESS: "In progress", EXCEPTION: "Exception: a leg failed", MANUAL_FOLLOW_UP: "Manual follow-up" };

/** NS-TXN-004: each compensating event with the legs it must correct and whether they did. */
function Compensations({ session }) {
  const rows = useResource(session, "/integration/compensations", []);
  const [open, setOpen] = useState(null);
  return (
    <Panel
      title="Compensations"
      subtitle="Returned premiums, cancellations and refunds, each with the original event it reverses and every leg it must correct: journal, commission, reinsurance and customer communication. Anything not complete stays here as an exception case for the leg's owner."
    >
      <ErrorNote error={rows.error} />
      <DataTable
        rowKey={(r) => r.eventId}
        rows={rows.data}
        loading={rows.loading}
        empty="No compensating events yet"
        emptyDetail="Reverse a receipt in Collections to see its corrections tracked here."
        onRowClick={(r) => setOpen(r)}
        searchPlaceholder="Search event, reference, status…"
        columns={[
          { key: "occurredAt", label: "When", render: (r) => when(r.occurredAt) },
          { key: "eventType", label: "Compensation" },
          { key: "aggregateRef", label: "Reference" },
          { key: "amount", label: "Amount", align: "right", render: (r) => (r.amount == null ? "—" : pula(r.amount)) },
          { key: "original", label: "Reverses", render: (r) => (r.original ? r.original.eventType + " · " + r.original.receiptRef : "—") },
          {
            key: "legs",
            label: "Legs",
            sortValue: (r) => r.legs.filter((l) => l.state === "DONE" || l.state === "NOTHING_TO_CORRECT").length,
            render: (r) => r.legs.filter((l) => l.state === "DONE" || l.state === "NOTHING_TO_CORRECT").length + " of " + r.legs.length + " done",
          },
          {
            key: "status",
            label: "Status",
            render: (r) => <Badge tone={r.status === "COMPLETE" ? "green" : r.status === "EXCEPTION" ? "red" : "amber"}>{COMP_LABEL[r.status]}</Badge>,
          },
        ]}
      />
      {open && (
        <Drawer title={open.eventType + " · " + open.aggregateRef} description={"Event " + open.eventId + (open.original ? " reverses " + open.original.eventType + " " + open.original.eventId : "")} size="lg" onClose={() => setOpen(null)}>
          <DataTable
            rowKey={(l) => l.leg}
            rows={open.legs}
            searchFrom={99}
            columns={[
              { key: "leg", label: "Leg" },
              { key: "state", label: "State", render: (l) => <Badge tone={LEG_TONE[l.state]}>{l.state.replaceAll("_", " ").toLowerCase()}</Badge> },
              { key: "owner", label: "Owner" },
              { key: "detail", label: "Detail" },
            ]}
          />
        </Drawer>
      )}
    </Panel>
  );
}

function OperatorLog({ session }) {
  const rows = useResource(session, "/integration/operator-actions", []);
  return (
    <Panel title="Operator log" subtitle="Every replay, retry and availability change, with who did it, why and what happened. Also kept as chained audit evidence.">
      <ErrorNote error={rows.error} />
      <DataTable
        rows={rows.data}
        loading={rows.loading}
        empty="No operator actions yet"
        columns={[
          { key: "actedAt", label: "When", render: (r) => when(r.actedAt) },
          { key: "action", label: "Action", render: (r) => r.action.replaceAll("_", " ").toLowerCase() },
          { key: "interfaceCode", label: "Interface", render: (r) => r.interfaceCode || "—" },
          { key: "targetRef", label: "Item", render: (r) => r.targetRef || "—" },
          { key: "reason", label: "Reason" },
          { key: "outcome", label: "Outcome" },
          { key: "actor", label: "By" },
        ]}
      />
    </Panel>
  );
}

const blankConfirmation = () => ({
  provider: "OrangeMoney",
  providerReference: "",
  policyRef: "",
  amount: "",
  currency: "BWP",
  method: "Orange Money",
  providerHolds: true,
});

const blankCallback = () => ({
  provider: "OrangeMoney",
  providerTransactionId: "",
  policyRef: "",
  amount: "",
  method: "Orange Money",
  providerHolds: true,
  repeat: true,
  tamper: false,
});

function Inbound({ session, notify, profile, onChange }) {
  const inbound = useResource(session, "/integration/inbound", []);
  const [form, setForm] = useState(null);
  const [signed, setSigned] = useState(null);
  const [sent, setSent] = useState(null);
  const action = useAction(notify);
  const submit = async () => {
    const { providerHolds, ...notification } = form;
    const r = await action.run(async () => {
      // The provider's own record comes first: a notification it cannot confirm goes to suspense.
      if (providerHolds) {
        await request(session, "/integration/simulator/provider-receipts", {
          method: "POST",
          body: {
            provider: form.provider,
            providerReference: form.providerReference,
            amount: form.amount,
            currency: form.currency,
          },
        });
      }
      return request(session, "/integration/payment-notifications", { method: "POST", body: notification });
    });
    if (r) {
      notify(
        r.data.status === "APPLIED"
          ? "Payment applied to " + r.data.businessRef
          : r.data.status === "UNKNOWN"
            ? "Outcome unknown: the provider did not answer the status query"
            : "Payment held in suspense: " + r.data.detail,
      );
      setForm(null);
      inbound.reload();
      onChange();
    }
  };
  const sendSigned = async () => {
    const r = await action.run(() => request(session, "/integration/simulator/payment-callbacks", { method: "POST", body: signed }));
    if (r) {
      setSent(r.data);
      setSigned(null);
      inbound.reload();
      onChange();
    }
  };
  const requery = async (row) => {
    const r = await action.run(() => request(session, `/integration/inbound/${row.id}/status-query`, { method: "POST" }));
    if (r) {
      notify(r.data.status === "UNKNOWN" ? "The provider still does not answer; asked " + r.data.statusQueries + " times" : "Resolved: " + r.data.status, "success");
      inbound.reload();
      onChange();
    }
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setS = (k) => (e) => setSigned({ ...signed, [k]: e.target.value });
  const check = (k) => (e) => setSigned({ ...signed, [k]: e.target.checked });
  return (
    <>
      {form && (
        <Drawer
          title="Record a payment confirmation"
          description="What integration staff record from a bank or wallet. Premium is collected only when the provider confirms it holds the money; if the provider does not answer, the outcome stays unknown and is asked again — never re-sent."
          onClose={() => setForm(null)}
        >
          <FormGrid submitLabel="Send confirmation" busy={action.busy} error={action.error} onSubmit={submit}>
            <Field label="Provider">
              <input value={form.provider} onChange={set("provider")} required />
            </Field>
            <Field label="Provider reference">
              <input value={form.providerReference} onChange={set("providerReference")} required />
            </Field>
            <Field label="Policy reference">
              <input value={form.policyRef} onChange={set("policyRef")} required />
            </Field>
            <Field label="Amount (BWP)">
              <input type="number" step="0.01" value={form.amount} onChange={set("amount")} required />
            </Field>
            <Field label="Currency">
              <input value={form.currency} onChange={set("currency")} />
            </Field>
            <Field label="Payment method">
              <select value={form.method} onChange={set("method")}>
                {["Orange Money", "MyZaka", "Card", "Bank EFT"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.providerHolds}
                onChange={(e) => setForm({ ...form, providerHolds: e.target.checked })}
              />
              The provider has received this money
            </label>
          </FormGrid>
        </Drawer>
      )}
      {signed && (
        <Drawer
          title="Send a signed callback (simulated provider)"
          description="The simulator plays the bank or wallet: it signs the settlement callback with the shared secret and a timestamp and sends it to the real callback endpoint, which checks the signature and replay window before anything changes."
          onClose={() => setSigned(null)}
        >
          <FormGrid submitLabel="Sign and send" busy={action.busy} error={action.error} onSubmit={sendSigned}>
            <Field label="Provider">
              <input value={signed.provider} onChange={setS("provider")} required />
            </Field>
            <Field label="Provider transaction id">
              <input value={signed.providerTransactionId} onChange={setS("providerTransactionId")} required />
            </Field>
            <Field label="Policy reference">
              <input value={signed.policyRef} onChange={setS("policyRef")} required />
            </Field>
            <Field label="Amount (BWP)">
              <input type="number" step="0.01" value={signed.amount} onChange={setS("amount")} required />
            </Field>
            <label className="checkbox-label">
              <input type="checkbox" checked={signed.providerHolds} onChange={check("providerHolds")} />
              The provider has received this money
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={signed.repeat} onChange={check("repeat")} />
              Send the same callback twice (provider retry)
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={signed.tamper} onChange={check("tamper")} />
              Alter the amount after signing (tampered callback)
            </label>
          </FormGrid>
        </Drawer>
      )}
      {sent && (
        <Panel title="Last signed callback" subtitle={"Signature " + sent.signature.slice(0, 23) + "… · timestamp " + sent.timestamp}>
          <DataTable
            rowKey={(a) => a.attempt}
            rows={sent.attempts}
            searchFrom={99}
            columns={[
              { key: "attempt", label: "Attempt" },
              { key: "status", label: "Result", render: (a) => <Badge>{a.status}</Badge> },
              { key: "inboundId", label: "Inbound record", render: (a) => a.inboundId ?? "—" },
              { key: "detail", label: "Detail" },
            ]}
          />
        </Panel>
      )}
      <Panel
        title="Inbound payment confirmations"
        subtitle="Signed provider callbacks and staff-recorded confirmations, one per provider reference. UNKNOWN means the provider did not answer the status query: nothing was applied, and it is asked again."
        action={
          can(profile, "MANAGE_INTEGRATION") && (
            <div className="ws-row-actions">
              <Button variant="secondary" icon={Send} onClick={() => setSigned(blankCallback())}>
                Signed callback (simulator)
              </Button>
              <Button icon={Plus} onClick={() => setForm(blankConfirmation())}>
                Record confirmation
              </Button>
            </div>
          )
        }
      >
        <ErrorNote error={inbound.error || (!form && !signed && action.error)} />
        <DataTable
          rows={inbound.data}
          loading={inbound.loading}
          empty="No confirmations received"
          emptyDetail="Confirmations arrive from bank and wallet callbacks; send a signed one from the simulator to see how it is applied."
          searchPlaceholder="Search provider, reference, policy, outcome…"
          columns={[
            { key: "receivedAt", label: "Received", render: (r) => when(r.receivedAt) },
            { key: "provider", label: "Provider" },
            { key: "providerRef", label: "Provider ref" },
            { key: "channel", label: "Channel", render: (r) => (r.channel === "SIGNED_CALLBACK" ? "Signed callback" : "Staff entry") },
            { key: "businessRef", label: "Policy" },
            { key: "amount", label: "Amount", align: "right", render: (r) => pula(r.amount) },
            { key: "status", label: "Outcome", render: (r) => <Badge tone={r.status === "UNKNOWN" ? "amber" : undefined}>{r.status}</Badge> },
            { key: "detail", label: "Detail", render: (r) => r.detail || "—" },
            {
              key: "act",
              label: "",
              render: (r) =>
                r.status === "UNKNOWN" &&
                can(profile, "MANAGE_INTEGRATION") && (
                  <Button variant="secondary" icon={RefreshCw} busy={action.busy} onClick={() => requery(r)}>
                    Ask provider again
                  </Button>
                ),
            },
          ]}
        />
        <p className="subtitle">
          <Send className="icon icon-sm" aria-hidden="true" /> Suspense items post to account 2000 and stay visible
          until Finance applies or refunds them.
        </p>
      </Panel>
    </>
  );
}
