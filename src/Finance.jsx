import React, { useState } from "react";
import { FileDown, RefreshCw, Upload } from "lucide-react";
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

// SH08 insurance subledger: trial balance, journals, posting rules, periods, exceptions and GL export.

const thisMonth = () => new Date().toISOString().slice(0, 7);

export default function Finance({ session, notify, profile }) {
  const [tab, setTab] = useState("balance");
  return (
    <>
      <Heading
        eyebrow="INSURANCE SUBLEDGER"
        title="Finance"
        subtitle="Balanced journals from every premium, claim, commission and cession — reconciled before they reach the GL."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ["balance", "Trial balance"],
          ["journals", "Journals"],
          ["exceptions", "Exceptions"],
          ["rules", "Posting rules"],
          ["periods", "Periods"],
          ["gl", "GL export"],
        ]}
      />
      {tab === "balance" && <TrialBalance session={session} />}
      {tab === "journals" && <Journals session={session} notify={notify} profile={profile} />}
      {tab === "exceptions" && <Exceptions session={session} notify={notify} profile={profile} />}
      {tab === "rules" && <Rules session={session} notify={notify} profile={profile} />}
      {tab === "periods" && <Periods session={session} notify={notify} profile={profile} />}
      {tab === "gl" && <GlExport session={session} notify={notify} profile={profile} />}
    </>
  );
}

function TrialBalance({ session }) {
  const [period, setPeriod] = useState("");
  const tb = useResource(session, "/finance/trial-balance" + (period ? "?period=" + period : ""));
  const data = tb.data;
  const loading = tb.loading && !data;
  return (
    <>
      {(data || loading) && (
        <div className="stat-grid three">
          <Stat label="Total debits" value={pula(data?.totalDebit)} loading={loading} />
          <Stat label="Total credits" value={pula(data?.totalCredit)} tone="blue" loading={loading} />
          <Stat
            label="Balanced"
            value={data?.balanced ? "Yes" : "No"}
            tone={!data || data.balanced ? "green" : "red"}
            note={data && "As of " + when(data.asOf)}
            loading={loading}
          />
        </div>
      )}
      <Panel
        title="Trial balance"
        subtitle={period ? "Period " + period : "All periods"}
        action={
          <input
            type="month"
            aria-label="Period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        }
      >
        <ErrorNote error={tb.error} />
        <DataTable
          rowKey={(r) => r.code}
          rows={data?.rows}
          loading={tb.loading}
          empty="No balances"
          emptyDetail="Accounts appear here once journals post to them; pick another period or clear it to see all periods."
          searchPlaceholder="Search account code, name or type…"
          columns={[
            { key: "code", label: "Account" },
            { key: "name", label: "Name" },
            { key: "accountType", label: "Type" },
            { key: "debit", label: "Debit", align: "right", render: (r) => pula(r.debit) },
            { key: "credit", label: "Credit", align: "right", render: (r) => pula(r.credit) },
            { key: "balance", label: "Balance", align: "right", render: (r) => pula(r.balance) },
          ]}
        />
      </Panel>
    </>
  );
}

function Journals({ session, notify, profile }) {
  const [period, setPeriod] = useState("");
  const journals = useResource(session, "/finance/journals" + (period ? "?period=" + period : ""), []);
  const [open, setOpen] = useState(null);
  const [reason, setReason] = useState("");
  const action = useAction(notify);
  const confirm = useConfirm();
  const reverse = async (journal) => {
    const ok = await confirm({
      title: "Reverse " + journal.ref + "?",
      message: (
        <>
          A reversal journal for {pula(journal.amount)} is posted against <strong>{journal.ref}</strong> (
          {journal.eventType} · {journal.sourceRef}). The original journal stays as it is; the reversal cannot be
          undone.
        </>
      ),
      confirmLabel: "Reverse journal",
      tone: "danger",
    });
    if (!ok) return;
    const ref = journal.ref;
    const done = await action.run(
      () => request(session, `/finance/journals/${ref}/reverse`, { method: "POST", body: { reason } }),
      "Reversal posted for " + ref,
    );
    if (done) {
      setReason("");
      setOpen(null);
      journals.reload();
    }
  };
  return (
    <Panel
      title="Journals"
      subtitle="Posted journals never change; a correction is a reversal journal."
      action={
        <input type="month" aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value)} />
      }
    >
      <ErrorNote error={journals.error} />
      <DataTable
        rowKey={(r) => r.ref}
        rows={journals.data}
        loading={journals.loading}
        empty="No journals"
        emptyDetail="Journals post automatically from premiums, claims, commissions and cessions in the chosen period."
        searchPlaceholder="Search journal, event, source, domain…"
        onRowClick={(r) => setOpen(r)}
        columns={[
          { key: "ref", label: "Journal" },
          { key: "eventType", label: "Event" },
          { key: "sourceRef", label: "Source" },
          { key: "domain", label: "Domain" },
          { key: "periodCode", label: "Period" },
          { key: "amount", label: "Amount", align: "right", render: (r) => pula(r.amount) },
          {
            key: "status",
            label: "Status",
            sortValue: (r) => (r.reversesRef ? "Reversal of " + r.reversesRef : r.status),
            render: (r) => (
              <Badge>{r.reversesRef ? "Reversal of " + r.reversesRef : r.status}</Badge>
            ),
          },
          { key: "glBatchRef", label: "GL batch", render: (r) => r.glBatchRef || "—" },
        ]}
      />
      {open && (
        <Drawer
          title={open.ref + " · " + open.description}
          description={open.eventType + " · " + open.sourceRef + " · " + pula(open.amount)}
          size="lg"
          onClose={() => setOpen(null)}
        >
          <div className="ws-kv">
            <div><small>Event date</small><strong>{open.eventDate}</strong></div>
            <div><small>Accounting date</small><strong>{open.accountingDate}</strong></div>
            <div><small>Rule version</small><strong>{open.ruleVersion ?? "—"}</strong></div>
            <div><small>Posted by</small><strong>{open.createdBy}</strong></div>
          </div>
          <DataTable
            rowKey={(l) => l.lineNo}
            rows={open.lines}
            empty="No lines"
            columns={[
              { key: "accountCode", label: "Account" },
              { key: "accountName", label: "Name" },
              { key: "debit", label: "Debit", align: "right", render: (l) => pula(l.debit) },
              { key: "credit", label: "Credit", align: "right", render: (l) => pula(l.credit) },
            ]}
          />
          {can(profile, "MANAGE_FINANCE") && open.status === "POSTED" && !open.reversesRef && (
            <FormGrid
              submitLabel="Reverse journal"
              busy={action.busy}
              error={action.error}
              onSubmit={() => reverse(open)}
            >
              <Field label="Reason for reversal" full>
                <input value={reason} onChange={(e) => setReason(e.target.value)} required />
              </Field>
            </FormGrid>
          )}
        </Drawer>
      )}
    </Panel>
  );
}

function Exceptions({ session, notify, profile }) {
  const list = useResource(session, "/finance/exceptions", []);
  const action = useAction(notify);
  const confirm = useConfirm();
  const retry = async (r) => {
    const ok = await confirm({
      title: "Retry " + r.eventType + " for " + r.sourceRef + "?",
      message: (
        <>
          The event for {pula(r.amount)} is posted again with the current posting rules. It failed because:{" "}
          <em>{r.reason}</em>. If the rule has been fixed, a journal is created.
        </>
      ),
      confirmLabel: "Retry posting",
    });
    if (!ok) return;
    await action.run(
      () => request(session, `/finance/exceptions/${r.id}/retry`, { method: "POST" }),
      "Retried " + r.eventType,
    );
    list.reload();
  };
  return (
    <Panel
      title="Financial exceptions"
      subtitle="Events that could not post. Fix the posting rule, then retry; the business transaction was never blocked."
    >
      <ErrorNote error={list.error || action.error} />
      <DataTable
        rows={list.data}
        loading={list.loading}
        empty="No unposted events"
        emptyDetail="An event appears here when no active posting rule can post it to a journal."
        searchPlaceholder="Search event, source, reason…"
        columns={[
          { key: "eventType", label: "Event" },
          { key: "sourceRef", label: "Source" },
          { key: "amount", label: "Amount", align: "right", render: (r) => pula(r.amount) },
          { key: "reason", label: "Reason" },
          { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
          { key: "journalRef", label: "Journal", render: (r) => r.journalRef || "—" },
          {
            key: "act",
            label: "",
            render: (r) =>
              r.status === "OPEN" &&
              can(profile, "MANAGE_FINANCE") && (
                <Button variant="secondary" icon={RefreshCw} busy={action.busy} onClick={() => retry(r)}>
                  Retry
                </Button>
              ),
          },
        ]}
      />
    </Panel>
  );
}

function Rules({ session, notify, profile }) {
  const rules = useResource(session, "/finance/posting-rules", []);
  const accounts = useResource(session, "/finance/accounts", []);
  const [edit, setEdit] = useState(null);
  const action = useAction(notify);
  const save = async () => {
    const done = await action.run(
      () =>
        request(session, "/finance/posting-rules/" + encodeURIComponent(edit.eventType), {
          method: "PUT",
          body: edit,
        }),
      "Posting rule saved",
    );
    if (done) {
      setEdit(null);
      rules.reload();
    }
  };
  const accountSelect = (field) => (
    <select value={edit[field]} onChange={(e) => setEdit({ ...edit, [field]: e.target.value })}>
      {(accounts.data || []).map((a) => (
        <option key={a.code} value={a.code}>
          {a.code} · {a.name}
        </option>
      ))}
    </select>
  );
  return (
    <>
      <Panel title="Posting rules" subtitle="Event → debit / credit. Each change is versioned and recorded on every journal.">
        <ErrorNote error={rules.error} />
        <DataTable
          rowKey={(r) => r.eventType}
          rows={rules.data}
          loading={rules.loading}
          empty="No posting rules"
          emptyDetail="Each business event needs a rule naming the accounts it debits and credits before it can post."
          searchPlaceholder="Search event, account, domain…"
          onRowClick={can(profile, "MANAGE_FINANCE") ? (r) => setEdit({ ...r }) : undefined}
          columns={[
            { key: "eventType", label: "Event" },
            { key: "debitAccount", label: "Debit" },
            { key: "creditAccount", label: "Credit" },
            { key: "amountField", label: "Amount field" },
            { key: "domain", label: "Domain" },
            { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
            { key: "version", label: "Version" },
            { key: "updatedBy", label: "Changed by" },
          ]}
        />
      </Panel>
      {edit && (
        <Drawer
          title={"Edit rule · " + edit.eventType}
          description="Each saved change is a new version of the rule; every journal records the version it posted with."
          onClose={() => setEdit(null)}
        >
          <FormGrid busy={action.busy} error={action.error} onSubmit={save}>
            <Field label="Debit account">{accountSelect("debitAccount")}</Field>
            <Field label="Credit account">{accountSelect("creditAccount")}</Field>
            <Field label="Amount field">
              <input value={edit.amountField} onChange={(e) => setEdit({ ...edit, amountField: e.target.value })} />
            </Field>
            <Field label="Domain">
              <select value={edit.domain} onChange={(e) => setEdit({ ...edit, domain: e.target.value })}>
                {["INDIVIDUAL", "GROUP", "SHARED"].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                <option>ACTIVE</option>
                <option>INACTIVE</option>
              </select>
            </Field>
            <Field label="Description">
              <input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

function Periods({ session, notify, profile }) {
  const periods = useResource(session, "/finance/periods", []);
  const [code, setCode] = useState(thisMonth());
  const [reason, setReason] = useState("");
  const [acknowledge, setAcknowledge] = useState(false);
  const action = useAction(notify);
  const confirm = useConfirm();
  const current = (periods.data || []).find((p) => p.code === code);
  const counts = current
    ? " It has " + current.journalCount + " journals, " + current.unexportedCount + " not yet exported to the GL."
    : "";
  const prompts = {
    "soft-close": {
      title: "Soft-close " + code + "?",
      message: "Period " + code + " moves to soft-closed." + counts,
      confirmLabel: "Soft-close",
    },
    reopen: {
      title: "Reopen " + code + "?",
      message: "Period " + code + " opens again for posting." + (reason ? " Reason: " + reason + "." : ""),
      confirmLabel: "Reopen period",
    },
    close: {
      title: "Close " + code + "?",
      message:
        "Period " + code + " is closed." + counts +
        (acknowledge
          ? " You have accepted closing it with any unposted events, unexported journals and unacknowledged GL batches."
          : " Closing lists any unposted events, unexported journals and unacknowledged GL batches."),
      confirmLabel: "Close period",
      tone: "danger",
    },
  };
  const act = async (verb) => {
    if (!(await confirm(prompts[verb]))) return;
    const done = await action.run(
      () =>
        request(session, `/finance/periods/${code}/${verb}`, {
          method: "POST",
          body: { reason, acknowledgeOpenItems: acknowledge },
        }),
      "Period " + code + ": " + verb,
    );
    if (done) periods.reload();
  };
  return (
    <>
      {can(profile, "CLOSE_PERIOD") && (
        <Panel title="Period control" subtitle="Open → soft-closed → closed. Closing lists unposted events, unexported journals and unacknowledged GL batches.">
          <div className="field-grid">
            <Field label="Period">
              <input type="month" value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Field label="Reason (needed to reopen or close with open items)">
              <input value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <Field label="Close with open items" full>
              <span>
                <input
                  type="checkbox"
                  checked={acknowledge}
                  onChange={(e) => setAcknowledge(e.target.checked)}
                />{" "}
                I have reviewed the open items and accept closing with them
              </span>
            </Field>
          </div>
          <ErrorNote error={action.error} />
          <div className="ws-form-actions">
            <Button variant="secondary" busy={action.busy} onClick={() => act("soft-close")}>
              Soft-close
            </Button>
            <Button variant="secondary" busy={action.busy} onClick={() => act("reopen")}>
              Reopen
            </Button>
            <Button busy={action.busy} onClick={() => act("close")}>
              Close period
            </Button>
          </div>
        </Panel>
      )}
      <Panel title="Accounting periods">
        <ErrorNote error={periods.error} />
        <DataTable
          rowKey={(r) => r.code}
          rows={periods.data}
          loading={periods.loading}
          empty="No accounting periods"
          emptyDetail="A period appears once a journal posts into its month."
          searchPlaceholder="Search period, status, note…"
          columns={[
            { key: "code", label: "Period" },
            { key: "status", label: "Status", render: (r) => <Badge>{r.status.replace("_", " ")}</Badge> },
            { key: "journalCount", label: "Journals", align: "right" },
            { key: "unexportedCount", label: "Not exported", align: "right" },
            { key: "note", label: "Note", render: (r) => r.note || "—" },
            { key: "updatedBy", label: "By" },
            { key: "updatedAt", label: "When", render: (r) => when(r.updatedAt) },
          ]}
        />
      </Panel>
    </>
  );
}

function GlExport({ session, notify, profile }) {
  const batches = useResource(session, "/finance/gl-batches", []);
  const [ack, setAck] = useState(null);
  const action = useAction(notify);
  const confirm = useConfirm();
  const exportNow = async () => {
    const ok = await confirm({
      title: "Export journals to the GL?",
      message:
        "Every posted journal not yet on a GL batch, including those from rejected batches, is sent to the GL as a new batch with its control totals.",
      confirmLabel: "Export to GL",
    });
    if (!ok) return;
    const done = await action.run(
      () => request(session, "/finance/gl-batches", { method: "POST" }),
      "Journals exported to the GL",
    );
    if (done) batches.reload();
  };
  const acknowledge = async () => {
    const done = await action.run(
      () =>
        request(session, `/finance/gl-batches/${ack.ref}/acknowledge`, {
          method: "POST",
          body: { status: ack.status, glReference: ack.glReference, note: ack.note },
        }),
      "GL batch " + ack.ref + " " + ack.status.toLowerCase(),
    );
    if (done) {
      setAck(null);
      batches.reload();
    }
  };
  return (
    <>
      <Panel
        title="GL export batches"
        subtitle="Control totals travel with each batch. A rejected batch's journals go out again in the next export."
        action={
          can(profile, "EXPORT_GL") && (
            <Button icon={Upload} busy={action.busy} onClick={exportNow}>
              Export to GL
            </Button>
          )
        }
      >
        <ErrorNote error={batches.error || (!ack && action.error)} />
        <DataTable
          rowKey={(r) => r.ref}
          rows={batches.data}
          loading={batches.loading}
          empty="No GL batches"
          emptyDetail="Export to GL bundles every posted journal not yet sent into a batch."
          searchPlaceholder="Search batch, status, GL reference…"
          columns={[
            { key: "ref", label: "Batch" },
            { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
            { key: "journalCount", label: "Journals", align: "right" },
            { key: "lineCount", label: "Lines", align: "right" },
            { key: "debitTotal", label: "Debits", align: "right", render: (r) => pula(r.debitTotal) },
            { key: "creditTotal", label: "Credits", align: "right", render: (r) => pula(r.creditTotal) },
            { key: "glReference", label: "GL ref", render: (r) => r.glReference || "—" },
            { key: "createdAt", label: "Exported", render: (r) => when(r.createdAt) },
            {
              key: "act",
              label: "",
              render: (r) =>
                r.status === "SUBMITTED" &&
                can(profile, "EXPORT_GL") && (
                  <Button
                    variant="secondary"
                    icon={FileDown}
                    onClick={() => setAck({ ref: r.ref, status: "ACCEPTED", glReference: "", note: "" })}
                  >
                    Record GL response
                  </Button>
                ),
            },
          ]}
        />
      </Panel>
      {ack && (
        <Drawer
          title={"GL response · " + ack.ref}
          description="Record what the GL did with this batch. A rejected batch's journals go out again in the next export."
          onClose={() => setAck(null)}
        >
          <FormGrid busy={action.busy} error={action.error} onSubmit={acknowledge} submitLabel="Save response">
            <Field label="Outcome">
              <select value={ack.status} onChange={(e) => setAck({ ...ack, status: e.target.value })}>
                <option>ACCEPTED</option>
                <option>REJECTED</option>
              </select>
            </Field>
            <Field label="GL reference">
              <input value={ack.glReference} onChange={(e) => setAck({ ...ack, glReference: e.target.value })} />
            </Field>
            <Field label="Note (required when rejected)" full>
              <input value={ack.note} onChange={(e) => setAck({ ...ack, note: e.target.value })} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}
