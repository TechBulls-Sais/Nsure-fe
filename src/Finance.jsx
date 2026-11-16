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
          ["manual", "Manual journals"],
          ["suspense", "Suspense"],
        ]}
      />
      {tab === "balance" && <TrialBalance session={session} />}
      {tab === "journals" && <Journals session={session} notify={notify} profile={profile} />}
      {tab === "exceptions" && <Exceptions session={session} notify={notify} profile={profile} />}
      {tab === "rules" && <Rules session={session} notify={notify} profile={profile} />}
      {tab === "periods" && <Periods session={session} notify={notify} profile={profile} />}
      {tab === "gl" && <GlExport session={session} notify={notify} profile={profile} />}
      {tab === "manual" && <ManualJournals session={session} notify={notify} profile={profile} />}
      {tab === "suspense" && <Suspense session={session} notify={notify} profile={profile} />}
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
      title: "Prepare a GL batch?",
      message:
        "Every posted journal not yet on a GL batch, including those from rejected batches, is bundled into a new batch with its control totals. Submit it to the GL as the next step.",
      confirmLabel: "Prepare batch",
    });
    if (!ok) return;
    const done = await action.run(
      () => request(session, "/finance/gl-batches", { method: "POST" }),
      "GL batch prepared",
    );
    if (done) batches.reload();
  };
  const submit = async (r) => {
    const done = await action.run(
      () => request(session, `/finance/gl-batches/${r.ref}/submit`, { method: "POST" }),
      "GL batch " + r.ref + " submitted",
    );
    if (done) batches.reload();
  };
  const acknowledge = async () => {
    const done = await action.run(
      () =>
        ack.mode === "reconcile"
          ? request(session, `/finance/gl-batches/${ack.ref}/reconcile`, {
              method: "POST",
              body: { glDebitTotal: ack.glDebitTotal, glCreditTotal: ack.glCreditTotal },
            })
          : request(session, `/finance/gl-batches/${ack.ref}/acknowledge`, {
              method: "POST",
              body: { status: ack.status, glReference: ack.glReference, note: ack.note },
            }),
      ack.mode === "reconcile" ? "GL batch " + ack.ref + " reconciled" : "GL batch " + ack.ref + " " + ack.status.toLowerCase(),
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
        subtitle="Prepared → submitted → accepted or rejected → reconciled. Control totals travel with each batch; a rejected batch's journals go out again in the next one."
        action={
          can(profile, "EXPORT_GL") && (
            <Button icon={Upload} busy={action.busy} onClick={exportNow}>
              Prepare GL batch
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
            { key: "createdAt", label: "Prepared", render: (r) => when(r.createdAt) },
            {
              key: "act",
              label: "",
              render: (r) =>
                !can(profile, "EXPORT_GL") ? null : r.status === "PREPARED" ? (
                  <Button variant="secondary" icon={Upload} busy={action.busy} onClick={() => submit(r)}>
                    Submit to GL
                  </Button>
                ) : r.status === "SUBMITTED" ? (
                  <Button
                    variant="secondary"
                    icon={FileDown}
                    onClick={() => setAck({ ref: r.ref, status: "ACCEPTED", glReference: "", note: "" })}
                  >
                    Record GL response
                  </Button>
                ) : r.status === "ACCEPTED" ? (
                  <Button
                    variant="secondary"
                    onClick={() => setAck({ ref: r.ref, mode: "reconcile", glDebitTotal: "", glCreditTotal: "" })}
                  >
                    Reconcile
                  </Button>
                ) : null,
            },
          ]}
        />
      </Panel>
      {ack && ack.mode === "reconcile" && (
        <Drawer
          title={"Reconcile · " + ack.ref}
          description="Enter the totals the GL reports as posted for this batch. They must equal the batch control totals."
          onClose={() => setAck(null)}
        >
          <FormGrid busy={action.busy} error={action.error} onSubmit={acknowledge} submitLabel="Reconcile">
            <Field label="GL debit total">
              <input type="number" step="0.01" required value={ack.glDebitTotal}
                onChange={(e) => setAck({ ...ack, glDebitTotal: e.target.value })} />
            </Field>
            <Field label="GL credit total">
              <input type="number" step="0.01" required value={ack.glCreditTotal}
                onChange={(e) => setAck({ ...ack, glCreditTotal: e.target.value })} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      {ack && ack.mode !== "reconcile" && (
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

const blankLine = () => ({ account: "", debit: "", credit: "" });

/**
 * Manual journals (Solution Blueprint §7): proposed with a reason by someone holding MANAGE_FINANCE, posted only when
 * someone else approves it with APPROVE_JOURNAL. Until then no balance moves.
 */
function ManualJournals({ session, notify, profile }) {
  const list = useResource(session, "/finance/manual-journals", []);
  const accounts = useResource(session, "/finance/accounts", []);
  const action = useAction(notify);
  const confirm = useConfirm();
  const [draft, setDraft] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const me = profile?.username;
  const totals = (lines) =>
    lines.reduce(
      (t, l) => ({ debit: t.debit + (Number(l.debit) || 0), credit: t.credit + (Number(l.credit) || 0) }),
      { debit: 0, credit: 0 },
    );
  const setLine = (i, patch) => setDraft({ ...draft, lines: draft.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const propose = async () => {
    const done = await action.run(
      () =>
        request(session, "/finance/manual-journals", {
          method: "POST",
          body: {
            ...draft,
            lines: draft.lines
              .filter((l) => l.account)
              .map((l) => ({ account: l.account, debit: l.debit || 0, credit: l.credit || 0 })),
          },
        }),
      "Manual journal sent for approval",
    );
    if (done) {
      setDraft(null);
      list.reload();
    }
  };
  const approve = async (r) => {
    const ok = await confirm({
      title: "Post manual journal " + r.ref + "?",
      message: (
        <>
          {r.madeBy} proposed {pula(r.amount)}: <em>{r.reason}</em>. Approving posts it to the subledger.
        </>
      ),
      confirmLabel: "Approve and post",
    });
    if (!ok) return;
    const done = await action.run(
      () => request(session, `/finance/manual-journals/${r.ref}/approve`, { method: "POST" }),
      r.ref + " posted",
    );
    if (done) list.reload();
  };
  const reject = async () => {
    const done = await action.run(
      () =>
        request(session, `/finance/manual-journals/${rejecting.ref}/reject`, {
          method: "POST",
          body: { reason: rejecting.reason },
        }),
      rejecting.ref + " rejected",
    );
    if (done) {
      setRejecting(null);
      list.reload();
    }
  };
  const sum = draft ? totals(draft.lines) : null;
  return (
    <>
      <Panel
        title="Manual journals"
        subtitle="Each one is proposed with a reason and posted only when someone else approves it."
        action={
          can(profile, "MANAGE_FINANCE") && (
            <Button
              onClick={() =>
                setDraft({
                  description: "",
                  reason: "",
                  accountingDate: new Date().toISOString().slice(0, 10),
                  lines: [blankLine(), blankLine()],
                })
              }
            >
              New manual journal
            </Button>
          )
        }
      >
        <ErrorNote error={list.error || (!draft && !rejecting && action.error)} />
        <DataTable
          rowKey={(r) => r.ref}
          rows={list.data}
          loading={list.loading}
          empty="No manual journals"
          emptyDetail="A manual journal corrects or adds an entry that no business event produced."
          searchPlaceholder="Search reference, description, person…"
          columns={[
            { key: "ref", label: "Reference" },
            { key: "description", label: "Description" },
            { key: "amount", label: "Amount", align: "right", render: (r) => pula(r.amount) },
            { key: "accountingDate", label: "Date" },
            { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
            { key: "madeBy", label: "Proposed by" },
            { key: "checkedBy", label: "Decided by", render: (r) => r.checkedBy || "—" },
            { key: "journalRef", label: "Journal", render: (r) => r.journalRef || r.decisionNote || "—" },
            {
              key: "act",
              label: "",
              render: (r) =>
                r.status !== "PENDING" || !can(profile, "APPROVE_JOURNAL") ? null : r.madeBy === me ? (
                  <small className="ws-hint">Needs another approver</small>
                ) : (
                  <span className="ws-row-actions">
                    <Button variant="secondary" busy={action.busy} onClick={() => approve(r)}>
                      Approve
                    </Button>
                    <Button variant="secondary" onClick={() => setRejecting({ ref: r.ref, reason: "" })}>
                      Reject
                    </Button>
                  </span>
                ),
            },
          ]}
        />
      </Panel>
      {draft && (
        <Drawer
          title="New manual journal"
          description="Debits must equal credits. It posts only after a second person approves it."
          onClose={() => setDraft(null)}
        >
          <FormGrid busy={action.busy} error={action.error} onSubmit={propose} submitLabel="Send for approval">
            <Field label="Description">
              <input
                required
                maxLength={300}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </Field>
            <Field label="Accounting date">
              <input
                type="date"
                required
                value={draft.accountingDate}
                onChange={(e) => setDraft({ ...draft, accountingDate: e.target.value })}
              />
            </Field>
            <Field label="Reason" full>
              <input
                required
                minLength={10}
                maxLength={1000}
                value={draft.reason}
                onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
              />
            </Field>
            {draft.lines.map((line, i) => (
              <React.Fragment key={i}>
                <Field label={"Line " + (i + 1) + " account"}>
                  <select value={line.account} onChange={(e) => setLine(i, { account: e.target.value })}>
                    <option value="">Choose…</option>
                    {(accounts.data || []).map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={"Line " + (i + 1) + " debit or credit"}>
                  <span className="ws-row-actions">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Debit"
                      aria-label={"Line " + (i + 1) + " debit"}
                      value={line.debit}
                      onChange={(e) => setLine(i, { debit: e.target.value, credit: "" })}
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Credit"
                      aria-label={"Line " + (i + 1) + " credit"}
                      value={line.credit}
                      onChange={(e) => setLine(i, { credit: e.target.value, debit: "" })}
                    />
                  </span>
                </Field>
              </React.Fragment>
            ))}
            <Field label="Totals" full>
              <span>
                Debits {pula(sum.debit)} · Credits {pula(sum.credit)}
                {sum.debit.toFixed(2) !== sum.credit.toFixed(2) && " · does not balance yet"}{" "}
                <Button variant="secondary" onClick={() => setDraft({ ...draft, lines: [...draft.lines, blankLine()] })}>
                  Add line
                </Button>
              </span>
            </Field>
          </FormGrid>
        </Drawer>
      )}
      {rejecting && (
        <Drawer title={"Reject " + rejecting.ref} description="The proposer sees your reason." onClose={() => setRejecting(null)}>
          <FormGrid busy={action.busy} error={action.error} onSubmit={reject} submitLabel="Reject">
            <Field label="Reason" full>
              <input
                required
                minLength={5}
                value={rejecting.reason}
                onChange={(e) => setRejecting({ ...rejecting, reason: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

/**
 * Suspense (Solution Blueprint §7): cash received that could not be applied. Allocating it to a policy or refunding
 * it is requested with a reason and applied only when someone else approves it.
 */
function Suspense({ session, notify, profile }) {
  const list = useResource(session, "/finance/suspense", []);
  const action = useAction(notify);
  const confirm = useConfirm();
  const [clearing, setClearing] = useState(null);
  const me = profile?.username;
  const ask = async () => {
    const done = await action.run(
      () =>
        request(session, `/finance/suspense/${clearing.id}/clearance`, {
          method: "POST",
          body: {
            action: clearing.action,
            policyRef: clearing.action === "ALLOCATE" ? clearing.policyRef : null,
            reason: clearing.reason,
          },
        }),
      "Clearance sent for approval",
    );
    if (done) {
      setClearing(null);
      list.reload();
    }
  };
  const decide = async (r, verdict) => {
    const ok = await confirm({
      title: (verdict === "approve" ? "Approve" : "Reject") + " clearance of " + r.providerRef + "?",
      message: (
        <>
          {r.requestedBy} asked to{" "}
          {r.clearanceAction === "ALLOCATE" ? "allocate it to " + r.clearancePolicyRef : "refund it"}:{" "}
          <em>{r.clearanceReason}</em>.
        </>
      ),
      confirmLabel: verdict === "approve" ? "Approve" : "Reject",
      tone: verdict === "approve" ? undefined : "danger",
    });
    if (!ok) return;
    const done = await action.run(
      () => request(session, `/finance/suspense/${r.id}/clearance/${verdict}`, { method: "POST" }),
      verdict === "approve" ? "Clearance approved" : "Clearance rejected",
    );
    if (done) list.reload();
  };
  return (
    <>
      <Panel title="Suspense" subtitle="Receipts that could not be applied. Each clearance needs a reason and a second person.">
        <ErrorNote error={list.error || (!clearing && action.error)} />
        <DataTable
          rows={list.data}
          loading={list.loading}
          empty="Nothing in suspense"
          emptyDetail="A payment confirmation that does not match a policy or its premium lands here."
          searchPlaceholder="Search provider reference, policy…"
          columns={[
            { key: "providerRef", label: "Provider ref" },
            { key: "policyRef", label: "Quoted policy" },
            { key: "amount", label: "Amount", align: "right", render: (r) => pula(r.amount) },
            { key: "detail", label: "Why / outcome" },
            {
              key: "status",
              label: "Status",
              render: (r) => <Badge>{r.clearanceAction && r.status === "SUSPENSE" ? "AWAITING APPROVAL" : r.status}</Badge>,
            },
            {
              key: "act",
              label: "",
              render: (r) =>
                r.status !== "SUSPENSE" ? (
                  r.clearedBy ? <small className="ws-hint">Approved by {r.clearedBy}</small> : null
                ) : !r.clearanceAction ? (
                  can(profile, "MANAGE_FINANCE") && (
                    <Button
                      variant="secondary"
                      onClick={() => setClearing({ id: r.id, action: "REFUND", policyRef: "", reason: "" })}
                    >
                      Request clearance
                    </Button>
                  )
                ) : r.requestedBy === me || !can(profile, "APPROVE_JOURNAL") ? (
                  <small className="ws-hint">Waiting for another approver</small>
                ) : (
                  <span className="ws-row-actions">
                    <Button variant="secondary" busy={action.busy} onClick={() => decide(r, "approve")}>
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
      {clearing && (
        <Drawer
          title="Clear a suspense receipt"
          description="Allocate it to the policy whose premium it pays, or refund it."
          onClose={() => setClearing(null)}
        >
          <FormGrid busy={action.busy} error={action.error} onSubmit={ask} submitLabel="Send for approval">
            <Field label="Action">
              <select value={clearing.action} onChange={(e) => setClearing({ ...clearing, action: e.target.value })}>
                <option value="REFUND">Refund to the payer</option>
                <option value="ALLOCATE">Allocate to a policy</option>
              </select>
            </Field>
            {clearing.action === "ALLOCATE" && (
              <Field label="Policy">
                <input
                  required
                  value={clearing.policyRef}
                  placeholder="POL-…"
                  onChange={(e) => setClearing({ ...clearing, policyRef: e.target.value })}
                />
              </Field>
            )}
            <Field label="Reason" full>
              <input
                required
                minLength={10}
                value={clearing.reason}
                onChange={(e) => setClearing({ ...clearing, reason: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}
