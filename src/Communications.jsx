import React, { useEffect, useState } from "react";
import { Ban, CheckCheck, FilePlus2, MessageSquarePlus, RefreshCw, Search, Send } from "lucide-react";
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
  useAction,
  useConfirm,
  useResource,
  when,
} from "./ui/workspace";
import "./communications.css";

// SH09B communications: the message log (queued → delivered, suppressed with a reason, failed queue with retry),
// versioned templates with maker-checker approval, and customer channel preferences / opt-out.

const EVENT_FIELDS = {
  PolicyIssued: ["policyRef", "customerName", "product", "sumAssured", "premium"],
  PremiumReceived: ["policyRef", "customerName", "product", "amount", "method", "receiptRef"],
  ClaimPaid: ["claimRef", "policyRef", "customerName", "product", "amount", "payoutRef"],
  // Kept in step with nsure-be MergeFields: every event a template can be written for.
  ClaimReceived: ["claimRef", "policyRef", "customerName", "product", "amount"],
  ClaimApproved: ["claimRef", "policyRef", "customerName", "product", "amount"],
  ClaimRejected: ["claimRef", "policyRef", "customerName", "product", "amount", "reason"],
  ServiceCaseOpened: ["caseRef", "caseType", "customerName", "category"],
  PremiumDueReminder: ["policyRef", "customerName", "product", "amount", "dueDate"],
  OperationalNotice: ["customerName"],
};
const COMMON_FIELDS = ["customerRef", "portalLink"];
// NS-SH09B-004: accepted by the provider is not delivered; delivery comes only from the provider's report.
const STATUSES = ["QUEUED", "SUBMITTED", "ACCEPTED", "DELIVERED", "READ", "FAILED", "SUPPRESSED"];

const label = (value) => String(value || "").replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
const channelName = (c) => (c === "WHATSAPP" ? "WhatsApp" : "Email");

export default function Communications({ session, notify, profile }) {
  const [tab, setTab] = useState("messages");
  const [refresh, setRefresh] = useState(0);
  const all = useResource(session, "/communications/messages", []);
  const action = useAction(notify);
  const loading = all.loading && !all.data?.length;
  const counts = (all.data || []).reduce((acc, m) => ({ ...acc, [m.status]: (acc[m.status] || 0) + 1 }), {});
  const dispatch = async () => {
    const r = await action.run(() => request(session, "/communications/dispatch", { method: "POST" }));
    if (r) {
      const d = r.data;
      notify(
        `Handed ${d.processed} to the provider: ${d.accepted} accepted, ${d.retrying} will retry, ${d.failed} failed. ` +
          `${d.delivered} delivery report(s) received.`,
      );
      all.reload();
      setRefresh((n) => n + 1);
    }
  };
  const changed = () => {
    all.reload();
    setRefresh((n) => n + 1);
  };
  // Blueprint §5: scheduled reminders run every morning; this runs the sweep now. One per policy and due date.
  const runReminders = async () => {
    const r = await action.run(() => request(session, "/communications/reminders/run", { method: "POST" }));
    if (r) {
      notify(r.data.published + " premium reminder(s) raised. Dispatch to send them.");
      changed();
    }
  };
  return (
    <>
      <Heading
        eyebrow="CUSTOMER CORRESPONDENCE"
        title="Communications"
        subtitle="Email and WhatsApp messages raised by business events, the templates behind them, and each customer's channel choices."
      >
        {can(profile, "MANAGE_COMMUNICATION") && (
          <>
            <Button variant="secondary" icon={RefreshCw} busy={action.busy} onClick={runReminders}>
              Run premium reminders
            </Button>
            <Button icon={Send} busy={action.busy} onClick={dispatch}>
              Dispatch now
            </Button>
          </>
        )}
      </Heading>
      <div className="stat-grid">
        <Stat label="Queued" value={counts.QUEUED || 0} tone="amber" note="Waiting to be sent" loading={loading} />
        <Stat
          label="With the provider"
          value={(counts.SUBMITTED || 0) + (counts.ACCEPTED || 0)}
          tone="blue"
          note="Accepted, not yet reported delivered"
          loading={loading}
        />
        <Stat
          label="Delivered"
          value={(counts.DELIVERED || 0) + (counts.READ || 0)}
          tone="green"
          note={(counts.READ || 0) + " read, as reported by the provider"}
          loading={loading}
        />
        <Stat
          label="Failed"
          value={counts.FAILED || 0}
          tone={counts.FAILED ? "red" : "green"}
          note="Retry from the list"
          loading={loading}
        />
        <Stat label="Suppressed" value={counts.SUPPRESSED || 0} tone="blue" note="Opt-out or no contact" loading={loading} />
      </div>
      <ErrorNote error={all.error || action.error} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ["messages", "Messages"],
          ["delivery", "Delivery"],
          ["templates", "Templates"],
          ["preferences", "Preferences"],
          ["inbound", "Inbound"],
          ["bulk", "Bulk notices"],
        ]}
      />
      {tab === "messages" && (
        <Messages key={refresh} session={session} notify={notify} profile={profile} onChange={changed} />
      )}
      {tab === "delivery" && <Delivery key={refresh} session={session} />}
      {tab === "templates" && <Templates session={session} notify={notify} profile={profile} />}
      {tab === "preferences" && <Preferences session={session} notify={notify} profile={profile} onChange={changed} />}
      {tab === "inbound" && <Inbound session={session} notify={notify} profile={profile} />}
      {tab === "bulk" && <BulkNotices session={session} notify={notify} profile={profile} onChange={changed} />}
    </>
  );
}

function Messages({ session, notify, profile, onChange }) {
  const [status, setStatus] = useState("ALL");
  const [open, setOpen] = useState(null);
  const [composing, setComposing] = useState(false);
  const messages = useResource(
    session,
    "/communications/messages" + (status === "ALL" ? "" : "?status=" + status),
    [],
  );
  const action = useAction(notify);
  const confirm = useConfirm();
  const manage = can(profile, "MANAGE_COMMUNICATION");
  const me = profile?.username;
  // SH09B failed-message queue: one person takes a failed message to work it.
  const own = async (m, release) => {
    const r = await action.run(
      () => request(session, `/communications/messages/${m.id}/owner`, { method: "POST", body: release ? { release: true } : {} }),
      release ? m.ref + " is back in the queue" : "You are working " + m.ref,
    );
    if (r) messages.reload();
  };
  const retry = async (m) => {
    const ok = await confirm({
      title: "Retry " + m.ref + "?",
      message: (
        <>
          The {channelName(m.channel)} message to <strong>{m.recipientName || m.customerRef || "the recipient"}</strong>
          {m.contact && <> at {m.contact}</>} is queued again and goes out on the next dispatch. It has been tried{" "}
          {m.attempts || 0} {m.attempts === 1 ? "time" : "times"}
          {m.lastError && <>; the last error was “{m.lastError}”</>}.
        </>
      ),
      confirmLabel: "Queue again",
    });
    if (!ok) return;
    const r = await action.run(
      () => request(session, `/communications/messages/${m.id}/retry`, { method: "POST" }),
      m.ref + " is queued again",
    );
    if (r) {
      setOpen(r.data);
      messages.reload();
      onChange();
    }
  };
  return (
    <>
      <Panel
        title="Message log"
        subtitle="Rendered content is kept exactly as sent, with the template version used."
        action={
          manage && (
            <Button variant="secondary" icon={MessageSquarePlus} onClick={() => setComposing(true)}>
              Send a service message
            </Button>
          )
        }
      >
        <Tabs
          value={status}
          onChange={(s) => {
            setStatus(s);
            setOpen(null);
          }}
          tabs={[["ALL", "All"], ...STATUSES.map((s) => [s, label(s)])]}
        />
        <ErrorNote error={messages.error || action.error} />
        <DataTable
          rows={messages.data}
          loading={messages.loading}
          empty={status === "ALL" ? "No messages yet" : "No " + label(status).toLowerCase() + " messages"}
          emptyDetail={
            status === "ALL"
              ? "Messages appear here when a policy, premium, claim or service event is raised, or one is sent by hand."
              : "Choose All to see messages in every state."
          }
          searchPlaceholder="Search message, recipient, contact, event…"
          onRowClick={(m) => setOpen(open?.id === m.id ? null : m)}
          columns={[
            { key: "ref", label: "Message", render: (m) => <span className="ws-mono">{m.ref}</span> },
            { key: "createdAt", label: "Raised", render: (m) => when(m.createdAt) },
            { key: "eventType", label: "Event", render: (m) => m.eventType + (m.businessRef ? " · " + m.businessRef : "") },
            {
              key: "recipient",
              label: "Recipient",
              sortValue: (m) => m.recipientName || m.customerRef,
              render: (m) => (
                <>
                  {m.recipientName || "—"}
                  {m.customerRef && <small className="com-sub">{m.customerRef}</small>}
                </>
              ),
            },
            {
              key: "channel",
              label: "Channel",
              render: (m) => (
                <>
                  {channelName(m.channel)}
                  {m.contact && <small className="com-sub ws-mono">{m.contact}</small>}
                </>
              ),
            },
            {
              key: "template",
              label: "Template",
              sortValue: (m) => (m.templateCode ? `${m.templateCode} ${String(m.templateVersion).padStart(4, "0")}` : ""),
              render: (m) => (m.templateCode ? `${m.templateCode} v${m.templateVersion}` : "Manual"),
            },
            { key: "attempts", label: "Tries", align: "right" },
            {
              key: "status",
              label: "Status",
              render: (m) => (
                <>
                  <Badge>{label(m.status)}</Badge>
                  {m.owner && <small className="com-sub">Worked by {m.owner}</small>}
                </>
              ),
            },
            {
              key: "act",
              label: "",
              render: (m) =>
                m.status === "FAILED" &&
                manage && (
                  <div className="ws-row-actions" onClick={(e) => e.stopPropagation()}>
                    {!m.owner && (
                      <Button variant="secondary" busy={action.busy} onClick={() => own(m, false)}>
                        Take
                      </Button>
                    )}
                    {m.owner === me && (
                      <Button variant="secondary" busy={action.busy} onClick={() => own(m, true)}>
                        Give back
                      </Button>
                    )}
                    <Button variant="secondary" icon={RefreshCw} busy={action.busy} onClick={() => retry(m)}>
                      Retry
                    </Button>
                  </div>
                ),
            },
          ]}
        />
      </Panel>
      {open && (
        <Drawer
          title={<span className="ws-mono">{open.ref}</span>}
          description={
            open.eventType +
            (open.businessRef ? " · " + open.businessRef : "") +
            " · " +
            (open.recipientName || open.customerRef || "—")
          }
          onClose={() => setOpen(null)}
        >
          <MessagePreview message={open} />
          <MessageTrail session={session} id={open.id} key={open.id + ":" + open.status} />
        </Drawer>
      )}
      {composing && (
        <ManualMessage
          session={session}
          notify={notify}
          onClose={() => setComposing(false)}
          onSent={() => {
            setComposing(false);
            messages.reload();
            onChange();
          }}
        />
      )}
    </>
  );
}

function MessagePreview({ message: m }) {
  return (
    <div className="com-preview">
      <div className="ws-kv">
        <div>
          <small>Status</small>
          <strong>
            <Badge>{label(m.status)}</Badge>
          </strong>
        </div>
        <div>
          <small>Sent to</small>
          <strong className="ws-mono">{m.contact || "—"}</strong>
        </div>
        <div>
          <small>Provider message id</small>
          <strong className="ws-mono">{m.providerMessageId || "—"}</strong>
        </div>
        <div>
          <small>Last update</small>
          <strong>{when(m.updatedAt)}</strong>
        </div>
        <div>
          <small>Purpose</small>
          <strong>{m.purpose ? label(m.purpose) : "—"}</strong>
        </div>
        <div>
          <small>Recipient</small>
          <strong>{m.recipientRole ? label(m.recipientRole) : "Customer"}</strong>
        </div>
      </div>
      {m.recipientBasis && <p className="com-sub">Why this recipient: {m.recipientBasis}</p>}
      {m.lastError && (
        <p className={"com-reason " + (m.status === "SUPPRESSED" ? "is-info" : "is-error")}>
          {m.status === "SUPPRESSED" ? "Not sent: " : "Provider error: "}
          {m.lastError}
        </p>
      )}
      <div className={"com-message " + (m.channel === "WHATSAPP" ? "is-whatsapp" : "is-email")}>
        {m.subject && <strong>{m.subject}</strong>}
        <p>{m.body}</p>
      </div>
      {m.eventId && (
        <small className="com-sub ws-mono">
          Event {m.eventId} · created by {m.createdBy}
        </small>
      )}
    </div>
  );
}

/** NS-SH09B-007: every state of the message, who or what moved it, and the provider's own report as evidence. */
function MessageTrail({ session, id }) {
  const trail = useResource(session, "/communications/messages/" + id, null);
  const steps = trail.data?.trail || [];
  return (
    <div className="com-trail">
      <strong>Trail</strong>
      <ErrorNote error={trail.error} />
      {trail.loading && !steps.length && <p className="com-sub">Loading…</p>}
      <ol>
        {steps.map((e, i) => (
          <li key={i}>
            <Badge>{label(e.status)}</Badge> <span className="com-sub-inline">{when(e.occurredAt)}</span>
            <small className="com-sub">
              {e.detail}
              {" · "}
              {e.source === "PROVIDER" ? "provider" : e.source === "STAFF" ? e.actor : "system"}
            </small>
            {e.rawPayload && (
              <details>
                <summary>Provider report</summary>
                <code className="ws-mono">{e.rawPayload}</code>
              </details>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** SH09B delivery dashboard: per channel and per day over a period, from the message log. */
function Delivery({ session }) {
  const [days, setDays] = useState("30");
  const metrics = useResource(session, "/communications/metrics?days=" + days, null);
  const d = metrics.data;
  return (
    <Panel
      title="Delivery"
      subtitle="Messages raised in the period, by channel and state. Delivered counts only what the provider reported delivered."
      action={
        <select className="input" value={days} onChange={(e) => setDays(e.target.value)} aria-label="Period">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      }
    >
      <ErrorNote error={metrics.error} />
      <DataTable
        rows={d?.channels}
        loading={metrics.loading}
        rowKey={(c) => c.channel}
        empty="No messages in the period"
        columns={[
          { key: "channel", label: "Channel", render: (c) => channelName(c.channel) },
          { key: "total", label: "Raised", align: "right" },
          { key: "queued", label: "Queued", align: "right" },
          { key: "inFlight", label: "With provider", align: "right" },
          { key: "delivered", label: "Delivered", align: "right" },
          { key: "read", label: "Read", align: "right" },
          { key: "failed", label: "Failed", align: "right" },
          { key: "suppressed", label: "Suppressed", align: "right" },
          {
            key: "deliveryRate",
            label: "Delivered of sent",
            align: "right",
            render: (c) => (c.deliveryRate == null ? "—" : c.deliveryRate + "%"),
          },
        ]}
      />
      {d && (
        <p className="com-sub">
          {d.failedUnowned} failed message(s) nobody has taken yet. From {d.from}.
        </p>
      )}
      <DataTable
        rows={(d?.byDay || []).filter((x) => x.raised > 0).reverse()}
        loading={metrics.loading}
        rowKey={(x) => x.day}
        empty="Nothing raised on any day in the period"
        columns={[
          { key: "day", label: "Day" },
          { key: "raised", label: "Raised", align: "right" },
          { key: "delivered", label: "Delivered", align: "right" },
          { key: "failed", label: "Failed", align: "right" },
        ]}
      />
    </Panel>
  );
}

function ManualMessage({ session, notify, onClose, onSent }) {
  const empty = { customerRef: "", channel: "EMAIL", subject: "", body: "", caseRef: "" };
  const [form, setForm] = useState(empty);
  const action = useAction(notify);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async () => {
    const { caseRef, ...rest } = form;
    const body = caseRef.trim() ? { ...rest, caseRef: caseRef.trim() } : rest;
    const r = await action.run(() => request(session, "/communications/messages", { method: "POST", body }));
    if (r) {
      notify(
        r.data.status === "SUPPRESSED"
          ? `${r.data.ref} was not sent: ${r.data.lastError}`
          : `${r.data.ref} is queued for ${r.data.recipientName}`,
      );
      setForm(empty);
      onSent();
    }
  };
  return (
    <Drawer
      title="Send a service message"
      description="Written by hand for one customer. Their opt-outs apply; keep sensitive detail in the portal."
      onClose={onClose}
    >
      <FormGrid submitLabel="Queue message" busy={action.busy} error={action.error} onSubmit={submit}>
        <Field label="Customer reference">
          <input value={form.customerRef} onChange={set("customerRef")} placeholder="CUS-1001" required />
        </Field>
        <Field label="Channel">
          <select value={form.channel} onChange={set("channel")}>
            <option value="EMAIL">Email</option>
            <option value="WHATSAPP">WhatsApp</option>
          </select>
        </Field>
        <Field label="Service case (optional)" hint="Joins the case's conversation">
          <input value={form.caseRef} onChange={set("caseRef")} placeholder="SR-000123" />
        </Field>
        {form.channel === "EMAIL" && (
          <Field label="Subject" full>
            <input value={form.subject} onChange={set("subject")} maxLength={200} required />
          </Field>
        )}
        <Field label="Message" full hint={`${form.body.length} / 2000`}>
          <textarea rows={4} value={form.body} onChange={set("body")} maxLength={2000} required />
        </Field>
      </FormGrid>
    </Drawer>
  );
}

function Templates({ session, notify, profile }) {
  const templates = useResource(session, "/communications/templates", []);
  const [open, setOpen] = useState(null);
  const [draft, setDraft] = useState(null);
  const action = useAction(notify);
  const confirm = useConfirm();
  const canDraft = can(profile, "MANAGE_COMMUNICATION");
  const canApprove = can(profile, "APPROVE_TEMPLATE");
  const approve = async (t) => {
    const ok = await confirm({
      title: `Approve ${t.code} v${t.version}?`,
      message: (
        <>
          From now on every new <strong>{t.eventType}</strong> {channelName(t.channel)} message to the{" "}
          {label(t.audience).toLowerCase()} uses this version, drafted by {t.createdBy}. Earlier versions of {t.code}{" "}
          are retired.
        </>
      ),
      confirmLabel: "Approve template",
    });
    if (!ok) return;
    const r = await action.run(
      () => request(session, `/communications/templates/${t.id}/approve`, { method: "POST" }),
      `${t.code} v${t.version} approved; earlier versions retired`,
    );
    if (r) {
      setOpen(r.data);
      templates.reload();
    }
  };
  // D-22: an approved version is withdrawn without a replacement: one user asks with a reason, another confirms.
  const [withdrawing, setWithdrawing] = useState(null);
  const askWithdrawal = async () => {
    const t = withdrawing.template;
    const r = await action.run(
      () =>
        request(session, `/communications/templates/${t.id}/withdraw`, {
          method: "POST",
          body: { reason: withdrawing.reason.trim() },
        }),
      `Withdrawal of ${t.code} v${t.version} sent for approval`,
    );
    if (r) {
      setWithdrawing(null);
      setOpen(r.data);
      templates.reload();
    }
  };
  const decideWithdrawal = async (t, verdict) => {
    const approveIt = verdict === "approve";
    const ok = await confirm({
      title: (approveIt ? "Withdraw " : "Keep ") + `${t.code} v${t.version}?`,
      message: approveIt ? (
        <>
          No new <strong>{t.eventType}</strong> {channelName(t.channel)} message uses this version from now on, and no
          other version replaces it. {t.withdrawalRequestedBy} asked: “{t.withdrawalReason}”.
        </>
      ) : (
        <>The version stays approved and in use. The request from {t.withdrawalRequestedBy} is declined.</>
      ),
      confirmLabel: approveIt ? "Withdraw template" : "Decline withdrawal",
      tone: approveIt ? "danger" : undefined,
    });
    if (!ok) return;
    const r = await action.run(
      () => request(session, `/communications/templates/${t.id}/withdraw/${verdict}`, { method: "POST" }),
      approveIt ? `${t.code} v${t.version} withdrawn` : "Withdrawal declined",
    );
    if (r) {
      setOpen(r.data);
      templates.reload();
    }
  };
  const newVersion = (t) =>
    setDraft({
      code: t.code,
      eventType: t.eventType,
      channel: t.channel,
      audience: t.audience,
      subject: t.subject || "",
      body: t.body,
      locked: true,
    });
  return (
    <>
      <Panel
        title="Templates"
        subtitle="Approved versions are used for new messages. A change is a new version that another user approves; a withdrawal, also confirmed by another user, stops a version without replacing it."
        action={
          canDraft && (
            <Button
              variant="secondary"
              icon={FilePlus2}
              onClick={() =>
                setDraft({ code: "", eventType: "PolicyIssued", channel: "EMAIL", audience: "CUSTOMER", subject: "", body: "" })
              }
            >
              New template
            </Button>
          )
        }
      >
        <ErrorNote error={templates.error || action.error} />
        <DataTable
          rows={templates.data}
          loading={templates.loading}
          rowKey={(t) => t.id}
          empty="No templates yet"
          emptyDetail="Draft a template for a business event; once another user approves it, new messages use it."
          searchPlaceholder="Search code, event, status, author…"
          onRowClick={(t) => setOpen(open?.id === t.id ? null : t)}
          columns={[
            { key: "code", label: "Code", render: (t) => <span className="ws-mono">{t.code}</span> },
            { key: "version", label: "Version", render: (t) => "v" + t.version },
            { key: "eventType", label: "Event" },
            { key: "channel", label: "Channel", render: (t) => channelName(t.channel) },
            { key: "audience", label: "Audience", render: (t) => label(t.audience) },
            {
              key: "status",
              label: "Status",
              render: (t) => (
                <>
                  <Badge tone={t.status === "WITHDRAWN" ? "red" : undefined}>{label(t.status)}</Badge>
                  {t.status === "APPROVED" && t.withdrawalRequestedBy && (
                    <small className="com-sub">Withdrawal asked by {t.withdrawalRequestedBy}</small>
                  )}
                </>
              ),
            },
            { key: "createdBy", label: "Drafted by" },
            {
              key: "approvedBy",
              label: "Approved",
              sortValue: (t) => t.approvedAt,
              render: (t) => (t.approvedBy ? `${t.approvedBy} · ${when(t.approvedAt)}` : "—"),
            },
            {
              key: "act",
              label: "",
              render: (t) => (
                <div className="ws-row-actions" onClick={(e) => e.stopPropagation()}>
                  {t.status === "DRAFT" && canApprove && t.createdBy !== profile?.username && (
                    <Button icon={CheckCheck} busy={action.busy} onClick={() => approve(t)}>
                      Approve
                    </Button>
                  )}
                  {t.status !== "RETIRED" && canDraft && (
                    <Button variant="secondary" onClick={() => newVersion(t)}>
                      New version
                    </Button>
                  )}
                  {t.status === "APPROVED" && !t.withdrawalRequestedBy && (canDraft || canApprove) && (
                    <Button variant="secondary" icon={Ban} onClick={() => setWithdrawing({ template: t, reason: "" })}>
                      Withdraw
                    </Button>
                  )}
                  {t.status === "APPROVED" &&
                    t.withdrawalRequestedBy &&
                    canApprove &&
                    t.withdrawalRequestedBy !== profile?.username && (
                      <>
                        <Button icon={Ban} busy={action.busy} onClick={() => decideWithdrawal(t, "approve")}>
                          Confirm withdrawal
                        </Button>
                        <Button variant="secondary" busy={action.busy} onClick={() => decideWithdrawal(t, "decline")}>
                          Keep
                        </Button>
                      </>
                    )}
                </div>
              ),
            },
          ]}
        />
      </Panel>
      {open && (
        <Drawer
          title={
            <>
              <span className="ws-mono">{open.code}</span> v{open.version}
            </>
          }
          description={open.eventType + " · " + channelName(open.channel) + " · " + label(open.audience)}
          onClose={() => setOpen(null)}
        >
          <div className="com-preview">
            <p>
              <Badge>{label(open.status)}</Badge>
            </p>
            <p className="com-sub">
              Purpose: {label(open.purpose)} (a service notice, never promotional) · Merge fields used:{" "}
              {open.placeholders.length ? open.placeholders.map((f) => `{{${f}}}`).join(", ") : "none"}
              {open.status === "DRAFT" && open.createdBy === profile?.username &&
                " · You drafted this, so another user approves it."}
            </p>
            {open.withdrawalRequestedBy && (
              <p className={"com-reason " + (open.status === "WITHDRAWN" ? "is-error" : "is-info")}>
                {open.status === "WITHDRAWN"
                  ? `Withdrawn by ${open.withdrawnBy} on ${when(open.withdrawnAt)}, asked by ${open.withdrawalRequestedBy}: `
                  : `Withdrawal asked by ${open.withdrawalRequestedBy} on ${when(open.withdrawalRequestedAt)}, waiting for another approver: `}
                {open.withdrawalReason}
              </p>
            )}
            <div className={"com-message " + (open.channel === "WHATSAPP" ? "is-whatsapp" : "is-email")}>
              {open.subject && <strong>{open.subject}</strong>}
              <p>{open.body}</p>
            </div>
          </div>
        </Drawer>
      )}
      {withdrawing && (
        <Drawer
          title={`Withdraw ${withdrawing.template.code} v${withdrawing.template.version}`}
          description="Stops new messages from using this version without replacing it. Another approver confirms before it takes effect; until then it is still used."
          onClose={() => setWithdrawing(null)}
        >
          <FormGrid submitLabel="Ask for withdrawal" busy={action.busy} error={action.error} onSubmit={askWithdrawal}>
            <Field label="Reason" full hint={`${withdrawing.reason.trim().length} / 500, at least 10`}>
              <textarea
                rows={3}
                value={withdrawing.reason}
                maxLength={500}
                minLength={10}
                required
                placeholder="e.g. Gives the wrong appeal address"
                onChange={(e) => setWithdrawing({ ...withdrawing, reason: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      {draft && (
        <TemplateForm
          session={session}
          notify={notify}
          draft={draft}
          onCancel={() => setDraft(null)}
          onSaved={(t) => {
            setDraft(null);
            setOpen(t);
            templates.reload();
          }}
        />
      )}
    </>
  );
}

function TemplateForm({ session, notify, draft, onCancel, onSaved }) {
  const [form, setForm] = useState(draft);
  const action = useAction(notify);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  // Template designer preview: rendered on the server with sample values, flagging fields the audience may not use.
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!form.body.trim()) {
      setPreview(null);
      return undefined;
    }
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await request(session, "/communications/templates/preview", {
          method: "POST",
          body: { eventType: form.eventType, audience: form.audience, subject: form.subject, body: form.body },
        });
        if (live) setPreview(data);
      } catch {
        if (live) setPreview(null);
      }
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [session, form.eventType, form.audience, form.subject, form.body]);
  const fields =
    preview?.knownFields ||
    (form.audience === "INTERMEDIARY" ? ["policyRef", "product", "customerName", "intermediaryName", "portalLink"]
      : [...(EVENT_FIELDS[form.eventType] || []), ...COMMON_FIELDS]);
  const submit = async () => {
    const { locked, ...body } = form;
    const r = await action.run(
      () => request(session, "/communications/templates", { method: "POST", body }),
      "Draft saved. Another user approves it before it is used.",
    );
    if (r) onSaved(r.data);
  };
  return (
    <Drawer
      title={form.locked ? `New version of ${form.code}` : "New template"}
      description="Link to the secure portal for policy, claim or KYC detail rather than putting it in the message."
      onClose={onCancel}
    >
      <FormGrid submitLabel="Save draft" busy={action.busy} error={action.error} onSubmit={submit}>
        <Field label="Code" hint="Letters, digits and underscores, e.g. CLAIM_PAID_WHATSAPP">
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            disabled={form.locked}
            required
          />
        </Field>
        <Field label="Event">
          <select value={form.eventType} onChange={set("eventType")} disabled={form.locked}>
            {Object.keys(EVENT_FIELDS).map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </Field>
        <Field label="Channel">
          <select value={form.channel} onChange={set("channel")} disabled={form.locked}>
            <option value="EMAIL">Email</option>
            <option value="WHATSAPP">WhatsApp</option>
          </select>
        </Field>
        <Field label="Audience">
          <select value={form.audience} onChange={set("audience")} disabled={form.locked}>
            <option value="CUSTOMER">Customer</option>
            <option value="INTERMEDIARY">Intermediary</option>
          </select>
        </Field>
        <Field label={form.channel === "EMAIL" ? "Subject" : "Subject (optional)"} full>
          <input value={form.subject} onChange={set("subject")} maxLength={200} required={form.channel === "EMAIL"} />
        </Field>
        <Field label="Body" full hint={"Merge fields: " + fields.map((f) => `{{${f}}}`).join(" ")}>
          <textarea rows={5} value={form.body} onChange={set("body")} maxLength={2000} required />
        </Field>
      </FormGrid>
      {preview && (
        <div className="com-preview">
          <small className="com-sub">Preview with sample values · purpose {label(preview.purpose)}</small>
          {preview.unknownFields.length > 0 && (
            <p className="com-reason is-error">
              {preview.unknownFields.map((f) => `{{${f}}}`).join(", ")}{" "}
              {preview.unknownFields.length === 1 ? "is" : "are"} not available for this event and audience; approval will
              be refused.
            </p>
          )}
          <div className={"com-message " + (form.channel === "WHATSAPP" ? "is-whatsapp" : "is-email")}>
            {preview.subject && <strong>{preview.subject}</strong>}
            <p>{preview.body}</p>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Preferences({ session, notify, profile, onChange }) {
  const [ref, setRef] = useState("");
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ channel: "WHATSAPP", status: "OPTED_IN", contact: "" });
  const lookup = useAction();
  const save = useAction(notify);
  const confirm = useConfirm();
  const find = async (e) => {
    e?.preventDefault();
    if (!ref.trim()) return;
    const r = await lookup.run(() =>
      request(session, "/communications/preferences/" + encodeURIComponent(ref.trim().toUpperCase())),
    );
    setData(r ? r.data : null);
  };
  const submit = async () => {
    const body = { channel: form.channel, status: form.status, ...(form.contact.trim() ? { contact: form.contact.trim() } : {}) };
    const optOut = form.status === "OPTED_OUT";
    const ok = await confirm({
      title: `Opt ${data.customerName || data.customerRef} ${optOut ? "out of" : "in to"} ${channelName(form.channel)}?`,
      message: (
        <>
          {optOut ? (
            <>
              <strong>{data.customerName}</strong> ({data.customerRef}) stops receiving {channelName(form.channel)}{" "}
              messages; new ones are suppressed with a reason.
            </>
          ) : (
            <>
              <strong>{data.customerName}</strong> ({data.customerRef}) can be sent {channelName(form.channel)} messages
              {body.contact ? <> at {body.contact}</> : " at the current contact"}.
            </>
          )}{" "}
          Record this only on the customer's own instruction.
        </>
      ),
      confirmLabel: "Save preference",
    });
    if (!ok) return;
    const r = await save.run(
      () =>
        request(session, "/communications/preferences/" + encodeURIComponent(data.customerRef), {
          method: "PUT",
          body,
        }),
      "Preference saved",
    );
    if (r) {
      setData(r.data);
      setForm({ ...form, contact: "" });
      onChange();
    }
  };
  return (
    <>
      <Panel title="Channel preferences" subtitle="Email is on by default at the registered address; WhatsApp needs an explicit opt-in.">
        <form className="com-lookup" onSubmit={find}>
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Customer reference, e.g. CUS-1006" />
          <Button type="submit" variant="secondary" icon={Search} busy={lookup.busy}>
            Look up
          </Button>
        </form>
        <ErrorNote error={lookup.error} />
        {data && (
          <>
            <p className="com-sub">
              {data.customerName} · {data.customerRef}
            </p>
            <DataTable
              rows={data.channels}
              rowKey={(c) => c.channel}
              empty="No channels on record"
              emptyDetail="Record the customer's choice for a channel below."
              columns={[
                { key: "channel", label: "Channel", render: (c) => channelName(c.channel) },
                {
                  key: "status",
                  label: "Choice",
                  render: (c) => (
                    <>
                      <Badge tone={c.status === "OPTED_IN" ? "green" : c.status === "OPTED_OUT" ? "red" : "blue"}>
                        {label(c.status)}
                      </Badge>
                      {!c.explicit && <small className="com-sub">Default</small>}
                    </>
                  ),
                },
                { key: "contact", label: "Contact", render: (c) => <span className="ws-mono">{c.contact || "—"}</span> },
                { key: "verified", label: "Verified", render: (c) => (c.verified === "Y" ? "Yes" : "No") },
                {
                  key: "deliverable",
                  label: "Messages",
                  render: (c) => (c.deliverable ? <Badge tone="green">Sent</Badge> : <span className="com-sub">{c.note}</span>),
                },
                {
                  key: "updatedBy",
                  label: "Changed",
                  sortValue: (c) => c.updatedAt,
                  render: (c) => (c.updatedBy ? `${c.updatedBy} · ${when(c.updatedAt)}` : "—"),
                },
              ]}
            />
          </>
        )}
      </Panel>
      {data && <Conversation session={session} customerRef={data.customerRef} key={data.customerRef + JSON.stringify(data.channels)} />}
      {data && can(profile, "MANAGE_COMMUNICATION") && (
        <Panel title="Change a channel" subtitle="Record the customer's own instruction. A new contact is unverified unless it matches their registered one.">
          <FormGrid submitLabel="Save preference" busy={save.busy} error={save.error} onSubmit={submit}>
            <Field label="Channel">
              <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                <option value="EMAIL">Email</option>
                <option value="WHATSAPP">WhatsApp</option>
              </select>
            </Field>
            <Field label="Choice">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="OPTED_IN">Opted in</option>
                <option value="OPTED_OUT">Opted out</option>
              </select>
            </Field>
            <Field
              label={form.channel === "EMAIL" ? "Email address" : "WhatsApp number"}
              full
              hint="Leave empty to keep the current contact."
            >
              <input
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                placeholder={form.channel === "EMAIL" ? "name@example.com" : "+267 7x xxx xxx"}
              />
            </Field>
          </FormGrid>
        </Panel>
      )}
    </>
  );
}

/** SH09B case conversation timeline: what we sent the customer and what they sent us, with the service case. */
function Conversation({ session, customerRef }) {
  const items = useResource(session, "/communications/conversations/" + encodeURIComponent(customerRef), []);
  return (
    <Panel title="Conversation" subtitle="Messages sent and replies received, oldest first, with the service case each belongs to.">
      <ErrorNote error={items.error} />
      <DataTable
        rows={items.data}
        loading={items.loading}
        rowKey={(i) => i.direction + i.ref}
        empty="No messages with this customer yet"
        columns={[
          { key: "at", label: "When", render: (i) => when(i.at) },
          { key: "direction", label: "", render: (i) => (i.direction === "IN" ? "Received" : "Sent") },
          { key: "channel", label: "Channel", render: (i) => channelName(i.channel) },
          {
            key: "body",
            label: "Message",
            render: (i) => (
              <>
                {i.subject && <strong>{i.subject} </strong>}
                {i.body}
              </>
            ),
          },
          { key: "caseRef", label: "Case", render: (i) => i.caseRef || "—" },
          { key: "status", label: "Status", render: (i) => <Badge>{label(i.status)}</Badge> },
          { key: "by", label: "By" },
        ]}
      />
    </Panel>
  );
}

/**
 * Inbound correspondence (Solution Blueprint §5): replies matched to one customer are linked to a service case; an
 * unknown or ambiguous sender waits in triage until someone says who it is.
 */
function Inbound({ session, notify, profile }) {
  const [status, setStatus] = useState("TRIAGE");
  const list = useResource(session, "/communications/inbound" + (status ? "?status=" + status : ""), []);
  const action = useAction(notify);
  const [assigning, setAssigning] = useState(null);
  const assign = async () => {
    const done = await action.run(
      () =>
        request(session, `/communications/inbound/${assigning.id}/assign`, {
          method: "POST",
          body: { customerRef: assigning.customerRef },
        }),
      "Linked to the customer's service case",
    );
    if (done) {
      setAssigning(null);
      list.reload();
    }
  };
  return (
    <>
      <Panel
        title="Inbound messages"
        subtitle="Replies by Email and WhatsApp. A known sender joins their service case; others wait here for a person."
        action={
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter">
            <option value="TRIAGE">Needs triage</option>
            <option value="LINKED">Linked to a case</option>
            <option value="">All</option>
          </select>
        }
      >
        <ErrorNote error={list.error || (!assigning && action.error)} />
        <DataTable
          rows={list.data}
          loading={list.loading}
          empty={status === "TRIAGE" ? "Nothing to triage" : "No inbound messages"}
          emptyDetail="Replies from customers arrive here from the Email and WhatsApp provider."
          searchPlaceholder="Search sender, text, case…"
          columns={[
            { key: "receivedAt", label: "Received", render: (r) => when(r.receivedAt) },
            { key: "channel", label: "Channel", render: (r) => channelName(r.channel) },
            { key: "sender", label: "From" },
            { key: "body", label: "Message" },
            { key: "status", label: "Status", render: (r) => <Badge>{label(r.status)}</Badge> },
            { key: "caseRef", label: "Case", render: (r) => r.caseRef || r.note || "—" },
            {
              key: "act",
              label: "",
              render: (r) =>
                r.status === "TRIAGE" &&
                can(profile, "MANAGE_COMMUNICATION") && (
                  <Button variant="secondary" onClick={() => setAssigning({ id: r.id, customerRef: "" })}>
                    Assign customer
                  </Button>
                ),
            },
          ]}
        />
      </Panel>
      {assigning && (
        <Drawer
          title="Who sent this?"
          description="Check the sender against the customer record before linking it; never guess."
          onClose={() => setAssigning(null)}
        >
          <FormGrid busy={action.busy} error={action.error} onSubmit={assign} submitLabel="Link to customer">
            <Field label="Customer reference" full>
              <input
                required
                placeholder="CUS-1001"
                value={assigning.customerRef}
                onChange={(e) => setAssigning({ ...assigning, customerRef: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

/**
 * Controlled bulk operational notices (Solution Blueprint §5): an approved OperationalNotice template sent to the
 * customers holding policies of a status (and product). Requested by one person, released by another.
 */
function BulkNotices({ session, notify, profile, onChange }) {
  const list = useResource(session, "/communications/bulk-notices", []);
  const templates = useResource(session, "/communications/templates", []);
  const action = useAction(notify);
  const confirm = useConfirm();
  const [draft, setDraft] = useState(null);
  const me = profile?.username;
  const usable = (templates.data || []).filter(
    (t) => t.eventType === "OperationalNotice" && t.status === "APPROVED" && t.audience === "CUSTOMER",
  );
  const requestNotice = async () => {
    const done = await action.run(
      () =>
        request(session, "/communications/bulk-notices", {
          method: "POST",
          body: { ...draft, templateId: Number(draft.templateId), product: draft.product || null },
        }),
      "Notice sent for approval",
    );
    if (done) {
      setDraft(null);
      list.reload();
    }
  };
  const decide = async (n, verdict) => {
    const ok = await confirm({
      title: (verdict === "approve" ? "Send" : "Reject") + " notice " + n.ref + "?",
      message:
        verdict === "approve"
          ? `${n.templateCode} goes to ${n.recipients} customer(s), each through their own consent and opt-out.`
          : "The notice is not sent.",
      confirmLabel: verdict === "approve" ? "Approve and send" : "Reject",
      tone: verdict === "approve" ? undefined : "danger",
    });
    if (!ok) return;
    const done = await action.run(
      () => request(session, `/communications/bulk-notices/${n.ref}/${verdict}`, { method: "POST" }),
      verdict === "approve" ? "Notice " + n.ref + " queued" : "Notice " + n.ref + " rejected",
    );
    if (done) {
      list.reload();
      onChange();
    }
  };
  return (
    <>
      <Panel
        title="Bulk operational notices"
        subtitle="Service notices to many customers at once. Not a marketing tool: approved templates only, and a second person releases each one."
        action={
          can(profile, "MANAGE_COMMUNICATION") && (
            <Button
              icon={MessageSquarePlus}
              onClick={() => setDraft({ templateId: usable[0]?.id || "", policyStatus: "Active", product: "", reason: "" })}
            >
              New notice
            </Button>
          )
        }
      >
        <ErrorNote error={list.error || (!draft && action.error)} />
        <DataTable
          rowKey={(r) => r.ref}
          rows={list.data}
          loading={list.loading}
          empty="No bulk notices"
          emptyDetail="A notice is drafted from an approved OperationalNotice template."
          searchPlaceholder="Search notice, template, reason…"
          columns={[
            { key: "ref", label: "Notice" },
            { key: "templateCode", label: "Template" },
            {
              key: "audience",
              label: "Audience",
              render: (r) => (r.product ? r.product + " · " : "All products · ") + r.policyStatus + " policies",
            },
            { key: "recipients", label: "Customers", align: "right" },
            { key: "reason", label: "Reason" },
            { key: "status", label: "Status", render: (r) => <Badge>{label(r.status)}</Badge> },
            { key: "requestedBy", label: "Requested by" },
            {
              key: "result",
              label: "Result",
              render: (r) =>
                r.status === "SENT" ? `${r.queued} queued · ${r.suppressed} suppressed · by ${r.decidedBy}` : r.decidedBy || "—",
            },
            {
              key: "act",
              label: "",
              render: (r) =>
                r.status !== "PENDING" || !can(profile, "APPROVE_TEMPLATE") ? null : r.requestedBy === me ? (
                  <small className="ws-hint">Needs another approver</small>
                ) : (
                  <span className="ws-row-actions">
                    <Button variant="secondary" icon={CheckCheck} busy={action.busy} onClick={() => decide(r, "approve")}>
                      Approve
                    </Button>
                    <Button variant="secondary" onClick={() => decide(r, "reject")}>
                      Reject
                    </Button>
                  </span>
                ),
            },
          ]}
        />
      </Panel>
      {draft && (
        <Drawer title="New bulk notice" description="Counted now; sent only once someone else approves it." onClose={() => setDraft(null)}>
          <FormGrid busy={action.busy} error={action.error} onSubmit={requestNotice} submitLabel="Send for approval">
            <Field label="Approved template">
              <select required value={draft.templateId} onChange={(e) => setDraft({ ...draft, templateId: e.target.value })}>
                {usable.length === 0 && <option value="">No approved OperationalNotice template</option>}
                {usable.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} v{t.version} · {channelName(t.channel)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Policies that are">
              <select value={draft.policyStatus} onChange={(e) => setDraft({ ...draft, policyStatus: e.target.value })}>
                <option>Active</option>
                <option>Active - No Cover</option>
                <option>Lapsed</option>
                <option>Pending Payment</option>
              </select>
            </Field>
            <Field label="Product (optional)">
              <input value={draft.product} placeholder="All products" onChange={(e) => setDraft({ ...draft, product: e.target.value })} />
            </Field>
            <Field label="Reason" full>
              <input required minLength={10} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}
