import React, { useState } from "react";
import { Play, Plus, RefreshCw, Send } from "lucide-react";
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

// SH12 integration monitor: outbox events and their per-handler deliveries, replay of failures, and inbound
// payment confirmations (deduplicated by provider reference; mismatches go to suspense).

const consumers = (r) => r.deliveries.map((x) => x.handler.split(".")[0]).join(", ");

export default function IntegrationMonitor({ session, notify, profile }) {
  const [tab, setTab] = useState("events");
  const [refresh, setRefresh] = useState(0);
  const dashboard = useResource(session, "/integration/dashboard");
  const action = useAction(notify);
  const confirm = useConfirm();
  const d = dashboard.data;
  const loading = dashboard.loading && !d;
  const dispatch = async () => {
    const pending = d?.deliveriesByStatus?.PENDING || 0;
    const ok = await confirm({
      title: "Dispatch pending deliveries now?",
      message:
        pending +
        " pending " +
        (pending === 1 ? "delivery is" : "deliveries are") +
        " handed to their consumers now. Any that fail show under Failed deliveries for replay.",
      confirmLabel: "Dispatch now",
    });
    if (!ok) return;
    const r = await action.run(() => request(session, "/integration/outbox/dispatch", { method: "POST" }));
    if (r) {
      notify(`Dispatched: ${r.data.delivered} delivered, ${r.data.failed} failed`);
      dashboard.reload();
      setRefresh((n) => n + 1);
    }
  };
  return (
    <>
      <Heading
        eyebrow="INTEGRATION & OPERATIONS"
        title="Integration monitor"
        subtitle="Every business event, who consumed it, and what failed — replayable without editing the payload."
      >
        {can(profile, "MANAGE_INTEGRATION") && (
          <Button icon={Play} busy={action.busy} onClick={dispatch}>
            Dispatch now
          </Button>
        )}
      </Heading>
      {(d || loading) && (
        <div className="stat-grid">
          <Stat label="Business events" value={d?.events} loading={loading} />
          <Stat
            label="Pending deliveries"
            value={d?.deliveriesByStatus?.PENDING || 0}
            tone="amber"
            note={d && (d.oldestPending ? "Oldest " + when(d.oldestPending) : "Queue is clear")}
            loading={loading}
          />
          <Stat label="Delivered" value={d?.deliveriesByStatus?.DELIVERED || 0} tone="blue" loading={loading} />
          <Stat label="Failed" value={d?.failed} tone={d?.failed ? "red" : "green"} note="Replay below" loading={loading} />
        </div>
      )}
      <ErrorNote error={dashboard.error} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ["events", "Events"],
          ["failed", "Failed deliveries"],
          ["inbound", "Inbound payments"],
        ]}
      />
      {tab !== "inbound" && (
        <Events
          key={tab + refresh}
          session={session}
          notify={notify}
          profile={profile}
          failedOnly={tab === "failed"}
          onChange={dashboard.reload}
        />
      )}
      {tab === "inbound" && (
        <Inbound session={session} notify={notify} profile={profile} onChange={dashboard.reload} />
      )}
    </>
  );
}

function Events({ session, notify, profile, failedOnly, onChange }) {
  const events = useResource(session, "/integration/events?failedOnly=" + failedOnly, []);
  const [open, setOpen] = useState(null);
  const action = useAction(notify);
  const confirm = useConfirm();
  const replay = async (delivery) => {
    const ok = await confirm({
      title: "Replay to " + delivery.handler + "?",
      message: (
        <>
          <strong>{open.eventType}</strong> for {open.aggregateRef} is delivered to {delivery.handler} again with its
          original payload. It has failed {delivery.attempts} {delivery.attempts === 1 ? "time" : "times"}
          {delivery.lastError ? ": " + delivery.lastError : "."}
        </>
      ),
      confirmLabel: "Replay delivery",
    });
    if (!ok) return;
    const r = await action.run(() =>
      request(session, `/integration/deliveries/${delivery.id}/replay`, { method: "POST" }),
    );
    if (r) {
      notify(`Replayed: ${r.data.delivered} delivered, ${r.data.failed} failed`);
      events.reload();
      onChange();
    }
  };
  return (
    <Panel title={failedOnly ? "Events with a failed delivery" : "Recent events"}>
      <ErrorNote error={events.error || (!open && action.error)} />
      <DataTable
        rowKey={(r) => r.eventId}
        rows={events.data}
        loading={events.loading}
        empty={failedOnly ? "No failed deliveries" : "No events yet"}
        emptyDetail={
          failedOnly
            ? "An event shows here when one of its consumers fails to process it."
            : "Events are published as policies, payments and claims change."
        }
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
          </div>
          <pre className="ws-mono">{JSON.stringify(JSON.parse(open.payload), null, 2)}</pre>
          <DataTable
            rows={open.deliveries}
            empty="No handler subscribes to this event"
            columns={[
              { key: "handler", label: "Handler" },
              { key: "status", label: "Status", render: (x) => <Badge>{x.status}</Badge> },
              { key: "attempts", label: "Attempts", align: "right" },
              { key: "lastError", label: "Last error", render: (x) => x.lastError || "—" },
              { key: "deliveredAt", label: "Delivered", render: (x) => when(x.deliveredAt) },
              {
                key: "act",
                label: "",
                render: (x) =>
                  x.status === "FAILED" &&
                  can(profile, "MANAGE_INTEGRATION") && (
                    <Button variant="secondary" icon={RefreshCw} busy={action.busy} onClick={() => replay(x)}>
                      Replay
                    </Button>
                  ),
              },
            ]}
          />
        </Drawer>
      )}
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
});

function Inbound({ session, notify, profile, onChange }) {
  const inbound = useResource(session, "/integration/inbound", []);
  const [form, setForm] = useState(null);
  const action = useAction(notify);
  const submit = async () => {
    const r = await action.run(() =>
      request(session, "/integration/payment-notifications", { method: "POST", body: form }),
    );
    if (r) {
      notify(
        r.data.status === "APPLIED"
          ? "Payment applied to " + r.data.businessRef
          : "Payment held in suspense: " + r.data.detail,
      );
      setForm(null);
      inbound.reload();
      onChange();
    }
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <>
      {form && (
        <Drawer
          title="Simulate a payment confirmation"
          description="What a bank or wallet callback does. Repeating a provider reference returns the first result."
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
          </FormGrid>
        </Drawer>
      )}
      <Panel
        title="Inbound payment confirmations"
        action={
          can(profile, "MANAGE_INTEGRATION") && (
            <Button icon={Plus} onClick={() => setForm(blankConfirmation())}>
              Simulate confirmation
            </Button>
          )
        }
      >
        <ErrorNote error={inbound.error} />
        <DataTable
          rows={inbound.data}
          loading={inbound.loading}
          empty="No confirmations received"
          emptyDetail="Confirmations arrive from bank and wallet callbacks; simulate one to see how it is applied."
          searchPlaceholder="Search provider, reference, policy, outcome…"
          columns={[
            { key: "receivedAt", label: "Received", render: (r) => when(r.receivedAt) },
            { key: "provider", label: "Provider" },
            { key: "providerRef", label: "Provider ref" },
            { key: "businessRef", label: "Policy" },
            { key: "amount", label: "Amount", align: "right", render: (r) => pula(r.amount) },
            { key: "status", label: "Outcome", render: (r) => <Badge>{r.status}</Badge> },
            { key: "detail", label: "Detail", render: (r) => r.detail || "—" },
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
