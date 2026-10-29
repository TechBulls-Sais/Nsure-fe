import React, { useState } from "react";
import { CheckCheck, FilePlus2, MessageSquarePlus, RefreshCw, Search, Send } from "lucide-react";
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
  ServiceCaseOpened: ["caseRef", "caseType", "customerName", "category"],
};
const COMMON_FIELDS = ["customerRef", "portalLink"];
const STATUSES = ["QUEUED", "DELIVERED", "FAILED", "SUPPRESSED"];

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
      notify(`Sent ${d.processed}: ${d.delivered} delivered, ${d.retrying} will retry, ${d.failed} failed`);
      all.reload();
      setRefresh((n) => n + 1);
    }
  };
  const changed = () => {
    all.reload();
    setRefresh((n) => n + 1);
  };
  return (
    <>
      <Heading
        eyebrow="CUSTOMER CORRESPONDENCE"
        title="Communications"
        subtitle="Email and WhatsApp messages raised by business events, the templates behind them, and each customer's channel choices."
      >
        {can(profile, "MANAGE_COMMUNICATION") && (
          <Button icon={Send} busy={action.busy} onClick={dispatch}>
            Dispatch now
          </Button>
        )}
      </Heading>
      <div className="stat-grid">
        <Stat label="Queued" value={counts.QUEUED || 0} tone="amber" note="Waiting for the provider" loading={loading} />
        <Stat label="Delivered" value={counts.DELIVERED || 0} tone="green" loading={loading} />
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
          ["templates", "Templates"],
          ["preferences", "Preferences"],
        ]}
      />
      {tab === "messages" && (
        <Messages key={refresh} session={session} notify={notify} profile={profile} onChange={changed} />
      )}
      {tab === "templates" && <Templates session={session} notify={notify} profile={profile} />}
      {tab === "preferences" && <Preferences session={session} notify={notify} profile={profile} onChange={changed} />}
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
            { key: "status", label: "Status", render: (m) => <Badge>{label(m.status)}</Badge> },
            {
              key: "act",
              label: "",
              render: (m) =>
                m.status === "FAILED" &&
                manage && (
                  <div className="ws-row-actions" onClick={(e) => e.stopPropagation()}>
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
      </div>
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

function ManualMessage({ session, notify, onClose, onSent }) {
  const empty = { customerRef: "", channel: "EMAIL", subject: "", body: "" };
  const [form, setForm] = useState(empty);
  const action = useAction(notify);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async () => {
    const r = await action.run(() => request(session, "/communications/messages", { method: "POST", body: form }));
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
        subtitle="Approved versions are used for new messages. A change is a new version that another user approves."
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
            { key: "status", label: "Status", render: (t) => <Badge>{label(t.status)}</Badge> },
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
                  {t.status === "DRAFT" && canApprove && (t.createdBy !== profile?.username || profile?.superAdmin) && (
                    <Button icon={CheckCheck} busy={action.busy} onClick={() => approve(t)}>
                      Approve
                    </Button>
                  )}
                  {t.status !== "RETIRED" && canDraft && (
                    <Button variant="secondary" onClick={() => newVersion(t)}>
                      New version
                    </Button>
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
              Merge fields used: {open.placeholders.length ? open.placeholders.map((f) => `{{${f}}}`).join(", ") : "none"}
              {open.status === "DRAFT" && open.createdBy === profile?.username &&
                (profile?.superAdmin
                  ? " · You drafted this. As super admin you can still approve it."
                  : " · You drafted this, so another user approves it.")}
            </p>
            <div className={"com-message " + (open.channel === "WHATSAPP" ? "is-whatsapp" : "is-email")}>
              {open.subject && <strong>{open.subject}</strong>}
              <p>{open.body}</p>
            </div>
          </div>
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
  const fields = [...(EVENT_FIELDS[form.eventType] || []), ...COMMON_FIELDS];
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
