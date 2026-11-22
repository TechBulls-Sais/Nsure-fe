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
          ["refunds", "Refunds"],
          ["billing", "Billing"],
          ["collections", "Debit orders"],
          ["reconciliation", "Reconciliation"],
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
      {tab === "refunds" && <Refunds session={session} notify={notify} profile={profile} />}
      {tab === "billing" && <Billing session={session} notify={notify} profile={profile} />}
      {tab === "collections" && <DebitOrders session={session} notify={notify} profile={profile} />}
      {tab === "reconciliation" && <Reconciliation session={session} notify={notify} profile={profile} />}
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
            <div>
              <small>Posting rule</small>
              <strong>
                {open.ruleVersion == null
                  ? "—"
                  : "v" + open.ruleVersion + (open.postingRuleId == null ? " (version no longer on file)" : "")}
              </strong>
            </div>
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

/**
 * Posting rules are versioned (NS-SH08-001): a change proposes the next version with a reason and an effective date,
 * someone else approves it, and it applies to events dated from then on. Journals keep the version they posted with.
 */
function Rules({ session, notify, profile }) {
  const rules = useResource(session, "/finance/posting-rules", []);
  const accounts = useResource(session, "/finance/accounts", []);
  const [edit, setEdit] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [history, setHistory] = useState(false);
  const action = useAction(notify);
  const confirm = useConfirm();
  const me = profile?.username;
  // The local calendar date (not UTC), so a change made after midnight is not dated yesterday.
  const today = new Date().toLocaleDateString("en-CA");
  const all = rules.data || [];
  const pendingFor = (eventType) => all.find((r) => r.eventType === eventType && r.approvalStatus === "PENDING_APPROVAL");
  const latestFor = (eventType) => all.filter((r) => r.eventType === eventType).reduce((a, r) => Math.max(a, r.version), 0);
  // Today's rule, anything waiting or scheduled; the full history on request.
  const shown = history
    ? all
    : all.filter(
        (r) =>
          r.inForce ||
          r.approvalStatus === "PENDING_APPROVAL" ||
          (r.approvalStatus === "APPROVED" && r.effectiveFrom > today),
      );
  const save = async () => {
    const done = await action.run(
      () =>
        request(session, "/finance/posting-rules/" + encodeURIComponent(edit.eventType), {
          method: "PUT",
          body: { ...edit, baseVersion: latestFor(edit.eventType) },
        }),
      "Change proposed — another user must approve it",
    );
    if (done) {
      setEdit(null);
      rules.reload();
    }
  };
  const approve = async (r) => {
    const ok = await confirm({
      title: `Approve ${r.eventType} v${r.version}?`,
      message: (
        <>
          {r.updatedBy} proposed Dr {r.debitAccount} / Cr {r.creditAccount} ({r.status}) from {r.effectiveFrom}:{" "}
          <em>{r.changeReason}</em>. Events dated from then on post with it; journals already posted keep their version.
        </>
      ),
      confirmLabel: "Approve",
    });
    if (!ok) return;
    const done = await action.run(
      () =>
        request(session, `/finance/posting-rules/${encodeURIComponent(r.eventType)}/versions/${r.version}/approve`, {
          method: "POST",
        }),
      `${r.eventType} v${r.version} approved`,
    );
    if (done) rules.reload();
  };
  const reject = async () => {
    const done = await action.run(
      () =>
        request(
          session,
          `/finance/posting-rules/${encodeURIComponent(rejecting.eventType)}/versions/${rejecting.version}/reject`,
          { method: "POST", body: { reason: rejecting.reason } },
        ),
      `${rejecting.eventType} v${rejecting.version} rejected`,
    );
    if (done) {
      setRejecting(null);
      rules.reload();
    }
  };
  const startEdit = (r) => {
    if (!can(profile, "MANAGE_FINANCE")) return;
    const pending = pendingFor(r.eventType);
    if (pending) {
      notify?.(`${r.eventType} v${pending.version} is awaiting approval; approve or reject it first.`, "error");
      return;
    }
    setEdit({
      eventType: r.eventType,
      debitAccount: r.debitAccount,
      creditAccount: r.creditAccount,
      amountField: r.amountField,
      domain: r.domain,
      status: r.status,
      description: r.description,
      effectiveFrom: today,
      reason: "",
    });
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
      <Panel
        title="Posting rules"
        subtitle="Event → debit / credit. A change is a new version that someone else approves; it applies to events dated from its effective date, and every journal keeps the version it posted with."
        action={
          <Button variant="secondary" onClick={() => setHistory(!history)}>
            {history ? "Hide history" : "Show history"}
          </Button>
        }
      >
        <ErrorNote error={rules.error || (!edit && !rejecting && action.error)} />
        <DataTable
          rowKey={(r) => r.id}
          rows={shown}
          loading={rules.loading}
          empty="No posting rules"
          emptyDetail="Each business event needs a rule naming the accounts it debits and credits before it can post."
          searchPlaceholder="Search event, account, domain…"
          onRowClick={can(profile, "MANAGE_FINANCE") ? startEdit : undefined}
          columns={[
            { key: "eventType", label: "Event" },
            { key: "version", label: "Version", render: (r) => "v" + r.version },
            { key: "debitAccount", label: "Debit" },
            { key: "creditAccount", label: "Credit" },
            { key: "domain", label: "Domain" },
            { key: "status", label: "Posts", render: (r) => <Badge>{r.status}</Badge> },
            {
              key: "effectiveFrom",
              label: "Applies",
              render: (r) => (r.effectiveTo ? `${r.effectiveFrom} – ${r.effectiveTo}` : `from ${r.effectiveFrom}`),
            },
            {
              key: "approvalStatus",
              label: "Approval",
              render: (r) => <Badge>{r.inForce ? "IN FORCE" : r.approvalStatus.replace("_", " ")}</Badge>,
            },
            { key: "updatedBy", label: "Proposed by" },
            { key: "approvedBy", label: "Decided by", render: (r) => r.approvedBy || "—" },
            {
              key: "act",
              label: "",
              render: (r) =>
                r.approvalStatus !== "PENDING_APPROVAL" || !can(profile, "APPROVE_JOURNAL") ? null : r.updatedBy ===
                  me ? (
                  <small className="ws-hint">Needs another approver</small>
                ) : (
                  <span className="ws-row-actions" onClick={(e) => e.stopPropagation()}>
                    <Button variant="secondary" busy={action.busy} onClick={() => approve(r)}>
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setRejecting({ eventType: r.eventType, version: r.version, reason: "" })}
                    >
                      Reject
                    </Button>
                  </span>
                ),
            },
          ]}
        />
      </Panel>
      {rejecting && (
        <Drawer
          title={`Reject ${rejecting.eventType} v${rejecting.version}`}
          description="The proposer sees your reason. The rule in force stays as it is."
          onClose={() => setRejecting(null)}
        >
          <FormGrid busy={action.busy} error={action.error} onSubmit={reject} submitLabel="Reject">
            <Field label="Reason" full>
              <input
                value={rejecting.reason}
                onChange={(e) => setRejecting({ ...rejecting, reason: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      {edit && (
        <Drawer
          title={"Propose a change · " + edit.eventType}
          description="This becomes the next version once someone else approves it. Events dated before its effective date, and journals already posted, keep the version they had."
          onClose={() => setEdit(null)}
        >
          <FormGrid busy={action.busy} error={action.error} onSubmit={save} submitLabel="Propose change">
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
            <Field label="Effective from">
              <input
                type="date"
                value={edit.effectiveFrom}
                onChange={(e) => setEdit({ ...edit, effectiveFrom: e.target.value })}
              />
            </Field>
            <Field label="Reason for the change" full>
              <input value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} />
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
/** The split lines of a clearance request, in words; null when it allocates the whole receipt to one policy. */
function splitLines(r) {
  if (!r.allocations) return null;
  try {
    return JSON.parse(r.allocations)
      .map((l) => pula(l.amount) + " to " + l.policyRef)
      .join(", ");
  } catch {
    return null;
  }
}

const RECON_LABELS = {
  MATCHED: "Matched",
  MISSING_RECEIPT: "On the statement, not here",
  AMOUNT_MISMATCH: "Amount differs",
  CURRENCY_MISMATCH: "Currency differs",
  DUPLICATE: "Twice on the statement",
  NOT_ON_STATEMENT: "Here, not on the statement",
};

/** Statement lines "reference,amount[,currency][,valueDate]", one per line; a header line is skipped. */
function parseStatementLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^reference/i.test(line))
    .map((line) => {
      const [reference, amount, currency, valueDate] = line.split(",").map((part) => part.trim());
      return { reference, amount, currency: currency || undefined, valueDate: valueDate || undefined };
    });
}

/**
 * Statement reconciliation (NS-SH04-006): upload a provider or bank statement; every line is matched to a receipt
 * by reference and checked for amount and currency, and receipts the statement does not show are listed too. Each
 * exception stays open with an owner and its age until someone says how it was resolved.
 */
function Reconciliation({ session, notify, profile }) {
  const open = useResource(session, "/collections/reconciliation", []);
  const statements = useResource(session, "/collections/statements", []);
  const action = useAction(notify);
  const [upload, setUpload] = useState(null);
  const [resolving, setResolving] = useState(null);
  const manage = can(profile, "MANAGE_FINANCE");
  const today = new Date().toISOString().slice(0, 10);
  const send = async () => {
    const done = await action.run(
      () =>
        request(session, "/collections/statements", {
          method: "POST",
          body: {
            provider: upload.provider,
            periodFrom: upload.periodFrom,
            periodTo: upload.periodTo,
            lines: parseStatementLines(upload.lines),
          },
        }),
      "Statement reconciled",
    );
    if (done) {
      setUpload(null);
      open.reload();
      statements.reload();
    }
  };
  const resolve = async () => {
    const done = await action.run(
      () =>
        request(session, `/collections/reconciliation/${resolving.id}/resolve`, {
          method: "POST",
          body: { resolution: resolving.resolution },
        }),
      "Exception resolved",
    );
    if (done) {
      setResolving(null);
      open.reload();
      statements.reload();
    }
  };
  const assign = async (item, owner) => {
    const done = await action.run(
      () => request(session, `/collections/reconciliation/${item.id}/assign`, { method: "POST", body: { owner } }),
      "Owner set",
    );
    if (done) open.reload();
  };
  return (
    <>
      <Panel
        title="Open reconciliation exceptions"
        subtitle="Oldest first. Each has an owner and stays open until someone records how it was resolved."
        action={
          manage && (
            <Button
              icon={Upload}
              onClick={() => setUpload({ provider: "", periodFrom: today, periodTo: today, lines: "" })}
            >
              Reconcile a statement
            </Button>
          )
        }
      >
        <ErrorNote error={open.error || (!upload && !resolving && action.error)} />
        <DataTable
          rows={open.data}
          loading={open.loading}
          empty="No open exceptions"
          emptyDetail="Every statement line matched a receipt, or each difference has been resolved."
          searchPlaceholder="Search reference, statement, owner…"
          columns={[
            { key: "statementRef", label: "Statement" },
            { key: "providerRef", label: "Reference" },
            { key: "status", label: "Exception", render: (r) => <Badge>{RECON_LABELS[r.status] || r.status}</Badge> },
            { key: "amount", label: "Amount", align: "right", render: (r) => (r.amount == null ? "—" : pula(r.amount)) },
            {
              key: "expectedAmount",
              label: "Recorded here",
              align: "right",
              render: (r) => (r.expectedAmount == null ? "—" : pula(r.expectedAmount)),
            },
            { key: "ageDays", label: "Age", align: "right", render: (r) => r.ageDays + " d" },
            {
              key: "owner",
              label: "Owner",
              render: (r) =>
                manage ? (
                  <input
                    className="input compact-input"
                    defaultValue={r.owner || ""}
                    aria-label={"Owner of " + r.providerRef}
                    onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== r.owner && assign(r, e.target.value.trim())}
                  />
                ) : (
                  r.owner || "—"
                ),
            },
            {
              key: "act",
              label: "",
              render: (r) =>
                manage && (
                  <Button variant="secondary" onClick={() => setResolving({ ...r, resolution: "" })}>
                    Resolve
                  </Button>
                ),
            },
          ]}
        />
      </Panel>
      <Panel title="Statements" subtitle="Each upload is kept with its counts.">
        <ErrorNote error={statements.error} />
        <DataTable
          rows={statements.data.map((s) => ({ ...s, id: s.ref }))}
          loading={statements.loading}
          empty="No statements yet"
          emptyDetail="Reconcile a provider or bank statement to see it here."
          columns={[
            { key: "ref", label: "Statement" },
            { key: "provider", label: "Provider" },
            { key: "periodFrom", label: "Period", render: (s) => s.periodFrom + " to " + s.periodTo },
            { key: "lines", label: "Lines", align: "right" },
            { key: "matched", label: "Matched", align: "right" },
            { key: "openExceptions", label: "Open", align: "right" },
            { key: "uploadedBy", label: "By", render: (s) => s.uploadedBy + " · " + when(s.uploadedAt) },
          ]}
        />
      </Panel>
      {upload && (
        <Drawer
          title="Reconcile a statement"
          description="Paste the statement lines as reference,amount[,currency][,valueDate], one per line. Receipts are matched by the provider's reference."
          onClose={() => setUpload(null)}
        >
          <FormGrid busy={action.busy} error={action.error} onSubmit={send} submitLabel="Reconcile">
            <Field label="Provider" hint="As it appears on receipts here, e.g. OrangeMoney or MOCK">
              <input required value={upload.provider} onChange={(e) => setUpload({ ...upload, provider: e.target.value })} />
            </Field>
            <Field label="From">
              <input
                required
                type="date"
                value={upload.periodFrom}
                onChange={(e) => setUpload({ ...upload, periodFrom: e.target.value })}
              />
            </Field>
            <Field label="To">
              <input
                required
                type="date"
                value={upload.periodTo}
                onChange={(e) => setUpload({ ...upload, periodTo: e.target.value })}
              />
            </Field>
            <Field label="Statement lines" full>
              <textarea
                required
                rows={8}
                className="textarea"
                placeholder={"reference,amount,currency,valueDate\nOM-1001,120.00,BWP," + today}
                value={upload.lines}
                onChange={(e) => setUpload({ ...upload, lines: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      {resolving && (
        <Drawer
          title={"Resolve " + resolving.providerRef}
          description={(RECON_LABELS[resolving.status] || resolving.status) + ". Say what was done; this closes the exception."}
          onClose={() => setResolving(null)}
        >
          <FormGrid busy={action.busy} error={action.error} onSubmit={resolve} submitLabel="Resolve">
            <Field label="How it was resolved" full>
              <input
                required
                minLength={10}
                maxLength={500}
                value={resolving.resolution}
                onChange={(e) => setResolving({ ...resolving, resolution: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

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
            action: clearing.action === "SPLIT" ? "ALLOCATE" : clearing.action,
            policyRef: clearing.action === "ALLOCATE" ? clearing.policyRef : null,
            // NS-SH04-003: split across policies or part-pay one; what is left stays unapplied in suspense.
            allocations:
              clearing.action === "SPLIT"
                ? clearing.lines.filter((l) => l.policyRef.trim()).map((l) => ({ policyRef: l.policyRef.trim(), amount: l.amount }))
                : undefined,
            // NS-SH04-005: a refund names where the money goes; the approver verifies it.
            payeeName: clearing.action === "REFUND" ? clearing.payeeName : undefined,
            payoutMethod: clearing.action === "REFUND" ? clearing.payoutMethod : undefined,
            accountRef: clearing.action === "REFUND" ? clearing.accountRef : undefined,
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
  const [verifying, setVerifying] = useState(null);
  const decide = async (r, verdict) => {
    if (verdict === "approve" && r.clearanceAction === "REFUND") {
      setVerifying({ id: r.id, providerRef: r.providerRef, requestedBy: r.requestedBy, reason: r.clearanceReason, verificationNote: "" });
      return;
    }
    const ok = await confirm({
      title: (verdict === "approve" ? "Approve" : "Reject") + " clearance of " + r.providerRef + "?",
      message: (
        <>
          {r.requestedBy} asked to{" "}
          {r.clearanceAction === "ALLOCATE"
            ? "allocate " + (splitLines(r) || "it to " + r.clearancePolicyRef)
            : "refund it"}
          :{" "}
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
  const approveRefund = async () => {
    const done = await action.run(
      () =>
        request(session, `/finance/suspense/${verifying.id}/clearance/approve`, {
          method: "POST",
          body: { verificationNote: verifying.verificationNote || undefined },
        }),
      "Refund approved; payout instruction sent",
    );
    if (done) {
      setVerifying(null);
      list.reload();
    }
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
            {
              key: "unapplied",
              label: "Unapplied",
              align: "right",
              render: (r) => (r.status === "SUSPENSE" ? pula(r.unapplied) : "—"),
            },
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
                      onClick={() =>
                        setClearing({
                          id: r.id,
                          action: "REFUND",
                          policyRef: "",
                          reason: "",
                          unapplied: r.unapplied,
                          lines: [{ policyRef: "", amount: "" }],
                          payeeName: "",
                          payoutMethod: "Bank Account",
                          accountRef: "",
                        })
                      }
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
                <option value="ALLOCATE">Allocate all of it to a policy</option>
                <option value="SPLIT">Split or part-pay (the rest stays unapplied)</option>
              </select>
            </Field>
            {clearing.action === "SPLIT" && (
              <Field
                label="Allocations"
                full
                hint={
                  "Unapplied BWP " +
                  clearing.unapplied +
                  " · allocating BWP " +
                  clearing.lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0).toFixed(2) +
                  ". A line below the policy's due amount part-pays its instalment."
                }
              >
                <div className="split-lines">
                  {clearing.lines.map((line, i) => (
                    <div key={i} className="split-line">
                      <input
                        required={i === 0}
                        placeholder="POL-…"
                        aria-label={"Policy " + (i + 1)}
                        value={line.policyRef}
                        onChange={(e) =>
                          setClearing({
                            ...clearing,
                            lines: clearing.lines.map((l, j) => (j === i ? { ...l, policyRef: e.target.value } : l)),
                          })
                        }
                      />
                      <input
                        required={Boolean(line.policyRef)}
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="Amount"
                        aria-label={"Amount " + (i + 1)}
                        value={line.amount}
                        onChange={(e) =>
                          setClearing({
                            ...clearing,
                            lines: clearing.lines.map((l, j) => (j === i ? { ...l, amount: e.target.value } : l)),
                          })
                        }
                      />
                    </div>
                  ))}
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setClearing({ ...clearing, lines: [...clearing.lines, { policyRef: "", amount: "" }] })}
                  >
                    Add a policy
                  </Button>
                </div>
              </Field>
            )}
            {clearing.action === "REFUND" && (
              <>
                <Field label="Payee">
                  <input required minLength={2} maxLength={150} value={clearing.payeeName} onChange={(e) => setClearing({ ...clearing, payeeName: e.target.value })} />
                </Field>
                <Field label="Payout method">
                  <select value={clearing.payoutMethod} onChange={(e) => setClearing({ ...clearing, payoutMethod: e.target.value })}>
                    <option>Bank Account</option>
                    <option>Mobile Wallet</option>
                  </select>
                </Field>
                <Field label="Account / wallet number" hint="The approver verifies it before the payout is sent">
                  <input required minLength={4} maxLength={60} value={clearing.accountRef} onChange={(e) => setClearing({ ...clearing, accountRef: e.target.value })} />
                </Field>
              </>
            )}
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
      {verifying && (
        <Drawer title={"Approve refund of " + verifying.providerRef} description={verifying.requestedBy + " asked to refund it: " + verifying.reason} onClose={() => setVerifying(null)}>
          <FormGrid busy={action.busy} error={action.error} onSubmit={approveRefund} submitLabel="Approve and send payout">
            <Field label="How you verified the destination" full hint="Not needed when the account is the payment mandate on file for the policy">
              <input minLength={10} maxLength={250} value={verifying.verificationNote} onChange={(e) => setVerifying({ ...verifying, verificationNote: e.target.value })} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

// AT-SH10-01: a refund is raised with a reason and paid only when someone else approves it, whatever roles the maker
// holds. Approval settles it (RefundSettled).
const REFUND_SOURCES = {
  PREMIUM: "Premium",
  SUSPENSE: "Suspense receipt",
  CREDIT_EARLY_SETTLEMENT: "Credit life early settlement",
  GROUP_SETTLEMENT: "Group settlement",
  OTHER: "Other",
};

function Refunds({ session, notify, profile }) {
  const list = useResource(session, "/finance/refunds", []);
  const action = useAction(notify);
  const confirm = useConfirm();
  const [form, setForm] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const me = profile?.username;
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const raise = async () => {
    const done = await action.run(
      () => request(session, "/finance/refunds", { method: "POST", body: form }),
      "Refund sent for approval",
    );
    if (done) {
      setForm(null);
      list.reload();
    }
  };
  const [approving, setApproving] = useState(null);
  const [destination, setDestination] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const approve = async () => {
    const done = await action.run(
      () =>
        request(session, "/finance/refunds/" + approving.ref + "/approve", {
          method: "POST",
          body: { verificationNote: approving.verificationNote || undefined, note: approving.note || undefined },
        }),
      "Refund approved; payout instruction sent",
    );
    if (done) {
      setApproving(null);
      list.reload();
    }
  };
  const saveDestination = async () => {
    const done = await action.run(
      () => request(session, "/finance/refunds/" + destination.ref + "/destination", { method: "POST", body: destination }),
      "Destination recorded; someone else approves the refund",
    );
    if (done) {
      setDestination(null);
      list.reload();
    }
  };
  const confirmPayout = async () => {
    const done = await action.run(
      () => request(session, "/finance/refunds/" + confirming.ref + "/payout-confirmed", { method: "POST", body: { reference: confirming.reference } }),
      "Payout confirmed; refund settled",
    );
    if (done) {
      setConfirming(null);
      list.reload();
    }
  };
  const reject = async () => {
    const done = await action.run(
      () => request(session, "/finance/refunds/" + rejecting.ref + "/reject", { method: "POST", body: { note: rejecting.note } }),
      "Refund rejected",
    );
    if (done) {
      setRejecting(null);
      list.reload();
    }
  };
  return (
    <>
      <Panel
        title="Refunds"
        subtitle="Premium and settlement refunds. Each is raised with a reason and paid only when a different person approves it."
        action={
          can(profile, "MANAGE_FINANCE") && (
            <Button
              onClick={() =>
                setForm({ source: "PREMIUM", sourceRef: "", policyRef: "", payeeName: "", payoutMethod: "Bank Account", accountRef: "", amount: "", reason: "" })
              }
            >
              Raise refund
            </Button>
          )
        }
      >
        <ErrorNote error={list.error || (!form && !rejecting && action.error)} />
        <DataTable
          rows={list.data}
          loading={list.loading}
          rowKey={(r) => r.ref}
          empty="No refunds"
          searchPlaceholder="Search refund, policy, payee…"
          columns={[
            { key: "ref", label: "Refund" },
            { key: "source", label: "For", render: (r) => REFUND_SOURCES[r.source] || r.source },
            { key: "policyRef", label: "Policy", render: (r) => r.policyRef || "—" },
            { key: "payeeName", label: "Payee" },
            { key: "amount", label: "Amount", align: "right", render: (r) => pula(r.amount) },
            { key: "requestedBy", label: "Raised by" },
            { key: "status", label: "Status", render: (r) => <Badge>{r.status.replace("_", " ")}</Badge> },
            {
              key: "payoutRef",
              label: "Destination / payout",
              render: (r) =>
                r.payoutRef ? (
                  <small className="ws-hint">
                    {r.payoutRef} via {r.payoutProvider}
                    {r.payoutReference ? " · " + r.payoutReference : ""}
                    <br />
                    {r.destinationCheck}
                  </small>
                ) : (
                  <small className="ws-hint">{r.payoutMethod} {r.accountRef}</small>
                ),
            },
            {
              key: "act",
              label: "",
              render: (r) =>
                r.status === "PAYOUT_SENT" ? (
                  can(profile, "MANAGE_FINANCE") && (
                    <Button variant="secondary" onClick={() => setConfirming({ ref: r.ref, reference: "" })}>
                      Confirm payout
                    </Button>
                  )
                ) : r.status !== "PENDING_APPROVAL" ? (
                  <small className="ws-hint">
                    {r.decidedBy ? (r.status === "REJECTED" ? "Rejected by " : "Approved by ") + r.decidedBy : ""}
                    {r.decisionNote ? ": " + r.decisionNote : ""}
                  </small>
                ) : r.source === "SUSPENSE" ? (
                  <small className="ws-hint">Decided in the Suspense tab</small>
                ) : r.accountRef === "TO CONFIRM" ? (
                  can(profile, "MANAGE_FINANCE") && (
                    <Button variant="secondary" onClick={() => setDestination({ ref: r.ref, payeeName: r.payeeName, payoutMethod: "Bank Account", accountRef: "" })}>
                      Record destination
                    </Button>
                  )
                ) : r.requestedBy === me || r.destinationSetBy === me || !can(profile, "APPROVE_JOURNAL") ? (
                  <small className="ws-hint">Waiting for another approver</small>
                ) : (
                  <span className="ws-row-actions">
                    <Button variant="secondary" busy={action.busy} onClick={() => setApproving({ ref: r.ref, r, verificationNote: "", note: "" })}>
                      Approve
                    </Button>
                    <Button variant="secondary" onClick={() => setRejecting({ ref: r.ref, note: "" })}>
                      Reject
                    </Button>
                  </span>
                ),
            },
          ]}
        />
      </Panel>
      {form && (
        <Drawer title="Raise a refund" description="A second person approves it before it is paid." onClose={() => setForm(null)}>
          <FormGrid busy={action.busy} error={action.error} onSubmit={raise} submitLabel="Send for approval">
            <Field label="For">
              <select value={form.source} onChange={set("source")}>
                {Object.entries(REFUND_SOURCES).filter(([k]) => k !== "SUSPENSE").map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Source reference" hint="The loan, receipt or settlement it refunds">
              <input value={form.sourceRef} maxLength={60} onChange={set("sourceRef")} />
            </Field>
            <Field label="Policy">
              <input value={form.policyRef} maxLength={40} placeholder="POL-…" onChange={set("policyRef")} />
            </Field>
            <Field label="Amount (BWP)">
              <input type="number" min="0.01" step="0.01" required value={form.amount} onChange={set("amount")} />
            </Field>
            <Field label="Payee">
              <input required maxLength={150} value={form.payeeName} onChange={set("payeeName")} />
            </Field>
            <Field label="Payout method">
              <select value={form.payoutMethod} onChange={set("payoutMethod")}>
                <option>Bank Account</option>
                <option>Mobile Wallet</option>
              </select>
            </Field>
            <Field label="Account / wallet number">
              <input required maxLength={60} value={form.accountRef} onChange={set("accountRef")} />
            </Field>
            <Field label="Reason" full>
              <input required minLength={10} maxLength={500} value={form.reason} onChange={set("reason")} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      {approving && (
        <Drawer
          title={"Approve refund " + approving.ref}
          description={"Pays " + pula(approving.r.amount) + " to " + approving.r.payeeName + " by " + approving.r.payoutMethod + " " + approving.r.accountRef + ", raised by " + approving.r.requestedBy + ": " + approving.r.reason}
          onClose={() => setApproving(null)}
        >
          <FormGrid busy={action.busy} error={action.error} onSubmit={approve} submitLabel="Approve and send payout">
            <Field label="How you verified the destination" full hint="Not needed when the account is the payment mandate on file for the policy">
              <input minLength={10} maxLength={250} value={approving.verificationNote} onChange={(e) => setApproving({ ...approving, verificationNote: e.target.value })} />
            </Field>
            <Field label="Note" full>
              <input maxLength={500} value={approving.note} onChange={(e) => setApproving({ ...approving, note: e.target.value })} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      {destination && (
        <Drawer title={"Destination for refund " + destination.ref} description="Where the refund is paid. Someone other than you approves it." onClose={() => setDestination(null)}>
          <FormGrid busy={action.busy} error={action.error} onSubmit={saveDestination} submitLabel="Record destination">
            <Field label="Payee">
              <input required maxLength={150} value={destination.payeeName} onChange={(e) => setDestination({ ...destination, payeeName: e.target.value })} />
            </Field>
            <Field label="Payout method">
              <select value={destination.payoutMethod} onChange={(e) => setDestination({ ...destination, payoutMethod: e.target.value })}>
                <option>Bank Account</option>
                <option>Mobile Wallet</option>
              </select>
            </Field>
            <Field label="Account / wallet number">
              <input required minLength={4} maxLength={60} value={destination.accountRef} onChange={(e) => setDestination({ ...destination, accountRef: e.target.value })} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      {confirming && (
        <Drawer title={"Confirm payout of " + confirming.ref} description="Record the bank's payment reference once the payout has been made." onClose={() => setConfirming(null)}>
          <FormGrid busy={action.busy} error={action.error} onSubmit={confirmPayout} submitLabel="Confirm payout">
            <Field label="Bank reference">
              <input required maxLength={60} value={confirming.reference} onChange={(e) => setConfirming({ ...confirming, reference: e.target.value })} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      {rejecting && (
        <Drawer title={"Reject refund " + rejecting.ref} description="The person who raised it sees why." onClose={() => setRejecting(null)}>
          <FormGrid busy={action.busy} error={action.error} onSubmit={reject} submitLabel="Reject refund">
            <Field label="Why" full>
              <input required maxLength={500} value={rejecting.note} onChange={(e) => setRejecting({ ...rejecting, note: e.target.value })} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

// SH04 collection run and instalment adjustments. The run goes to the background (spec §10) and is followed through
// GET /operations/{id}; an adjustment is a signed correction with a reason, made on the version on screen.
function Billing({ session, notify, profile }) {
  const action = useAction(notify);
  const [operation, setOperation] = useState(null);
  const [policyRef, setPolicyRef] = useState("");
  const [account, setAccount] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const [reversing, setReversing] = useState(null);
  const [reversalVersion, setReversalVersion] = useState(0);
  const manage = can(profile, "MANAGE_FINANCE");
  const requestReversal = async () => {
    const done = await action.run(
      () =>
        request(session, "/collections/receipts/" + encodeURIComponent(reversing.receiptRef) + "/reverse", {
          method: "POST",
          body: { kind: reversing.kind, reason: reversing.reason },
        }),
      "Reversal sent for approval by a second person",
    );
    if (done) {
      setReversing(null);
      setReversalVersion((v) => v + 1);
    }
  };
  const follow = async (id) => {
    for (let i = 0; i < 120; i++) {
      const r = await request(session, "/operations/" + encodeURIComponent(id));
      setOperation(r.data);
      if (r.data.status === "SUCCEEDED" || r.data.status === "FAILED") return r.data;
      await new Promise((done) => setTimeout(done, 1000));
    }
    return null;
  };
  const run = async () => {
    const started = await action.run(() => request(session, "/collections/billing-run?async=true", { method: "POST" }));
    if (!started) return;
    setOperation(started.data);
    try {
      const done = await follow(started.data.id);
      if (done?.status === "SUCCEEDED") notify("Billing run finished: " + (done.result?.issued ?? 0) + " instalment(s) issued", "success");
      if (done?.status === "FAILED") notify(done.error, "error");
    } catch (error) {
      notify(error.message, "error");
    }
  };
  const load = async (ref) => {
    const done = await action.run(() => request(session, "/collections/policies/" + encodeURIComponent(ref.trim())));
    if (done) setAccount(done.data);
  };
  const adjust = async () => {
    const done = await action.run(
      () =>
        request(session, "/collections/instalments/" + encodeURIComponent(adjusting.ref) + "/adjustments", {
          method: "POST",
          version: adjusting.version,
          body: { amount: adjusting.amount, reason: adjusting.reason },
        }),
      "Adjustment recorded",
    );
    if (done) {
      setAdjusting(null);
      setAccount(done.data);
    }
  };
  return (
    <>
      <Panel
        title="Collection run"
        subtitle="Issues the instalment of every in-force policy whose premium falls due within the lead time. It also runs every morning; running it again issues nothing twice."
        action={
          manage && (
            <Button icon={RefreshCw} busy={action.busy || operation?.status === "PROCESSING" || operation?.status === "ACCEPTED"} onClick={run}>
              Run billing now
            </Button>
          )
        }
      >
        {operation ? (
          <div className="ws-kv">
            <div>
              <small>Operation</small>
              <strong>{operation.id}</strong>
            </div>
            <div>
              <small>Status</small>
              <strong>
                <Badge>{operation.status}</Badge>
              </strong>
            </div>
            <div>
              <small>Last update</small>
              <strong>{when(operation.updatedAt)}</strong>
            </div>
            {operation.status === "SUCCEEDED" && (
              <div>
                <small>Issued</small>
                <strong>
                  {operation.result?.issued ?? 0}
                  {operation.result?.instalments?.length ? " · " + operation.result.instalments.join(", ") : ""}
                </strong>
              </div>
            )}
            {operation.status === "FAILED" && (
              <div>
                <small>Error</small>
                <strong>{operation.error}</strong>
              </div>
            )}
          </div>
        ) : (
          <p className="ws-hint">No run started from this screen yet.</p>
        )}
      </Panel>
      <Panel title="Instalments and adjustments" subtitle="Open a policy's billing account to correct an instalment with a signed adjustment and a reason.">
        <FormGrid submitLabel="Open account" busy={action.busy} error={!adjusting && action.error} onSubmit={() => load(policyRef)}>
          <Field label="Policy">
            <input required value={policyRef} placeholder="POL-…" onChange={(e) => setPolicyRef(e.target.value)} />
          </Field>
        </FormGrid>
        {account && <MandatePanel session={session} notify={notify} profile={profile} account={account} onChange={() => load(account.policyRef)} />}
        {account && (
          <DataTable
            rows={account.instalments}
            rowKey={(r) => r.ref}
            searchFrom={99}
            empty="No instalments issued"
            columns={[
              { key: "ref", label: "Instalment" },
              { key: "periodStart", label: "Period", render: (r) => r.periodStart + " – " + r.periodEnd },
              { key: "billed", label: "Billed", align: "right", render: (r) => pula(r.billed) },
              { key: "adjustments", label: "Adjustments", align: "right", render: (r) => pula(r.adjustments) },
              { key: "allocated", label: "Paid", align: "right", render: (r) => pula(r.allocated) },
              { key: "outstanding", label: "Outstanding", align: "right", render: (r) => pula(r.outstanding) },
              { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
              {
                key: "act",
                label: "",
                render: (r) =>
                  manage && (
                    <Button variant="secondary" onClick={() => setAdjusting({ ref: r.ref, version: r.version, amount: "", reason: "" })}>
                      Adjust
                    </Button>
                  ),
              },
            ]}
          />
        )}
      </Panel>
      {account && (
        <Panel title={"Receipts on " + account.policyRef} subtitle="A receipt the bank returned, reversed or charged back is reversed only when a second person approves.">
          <DataTable
            rows={account.receipts}
            rowKey={(r) => r.receiptRef}
            searchFrom={99}
            empty="No receipts"
            columns={[
              { key: "receiptRef", label: "Receipt" },
              { key: "periodStart", label: "Period", render: (r) => r.periodStart + " – " + r.periodEnd },
              { key: "amount", label: "Amount", align: "right", render: (r) => pula(r.amount) },
              { key: "method", label: "Method" },
              { key: "status", label: "Status", render: (r) => <Badge>{r.reversalKind ? r.reversalKind : r.status}</Badge> },
              {
                key: "act",
                label: "",
                render: (r) =>
                  manage && r.status === "SUCCESSFUL" ? (
                    <Button variant="secondary" onClick={() => setReversing({ receiptRef: r.receiptRef, kind: "RETURNED", reason: "" })}>
                      Request reversal
                    </Button>
                  ) : (
                    r.reversalReason && <small className="ws-hint">{r.reversalReason}</small>
                  ),
              },
            ]}
          />
        </Panel>
      )}
      <ReversalRequests session={session} notify={notify} profile={profile} version={reversalVersion} />
      {reversing && (
        <Drawer title={"Reverse receipt " + reversing.receiptRef} description="Nothing changes until a different person approves the reversal." onClose={() => setReversing(null)}>
          <FormGrid busy={action.busy} error={action.error} onSubmit={requestReversal} submitLabel="Send for approval">
            <Field label="Kind">
              <select value={reversing.kind} onChange={(e) => setReversing({ ...reversing, kind: e.target.value })}>
                <option value="RETURNED">Returned unpaid</option>
                <option value="REVERSED">Reversed</option>
                <option value="CHARGEBACK">Chargeback</option>
              </select>
            </Field>
            <Field label="Bank's reason" full>
              <input required minLength={10} maxLength={500} value={reversing.reason} onChange={(e) => setReversing({ ...reversing, reason: e.target.value })} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
      {adjusting && (
        <Drawer title={"Adjust " + adjusting.ref} description="A negative amount reduces what is owed; the billed amount itself never changes." onClose={() => setAdjusting(null)}>
          <FormGrid busy={action.busy} error={action.error} onSubmit={adjust} submitLabel="Record adjustment">
            <Field label="Amount (BWP, signed)">
              <input type="number" step="0.01" required value={adjusting.amount} onChange={(e) => setAdjusting({ ...adjusting, amount: e.target.value })} />
            </Field>
            <Field label="Reason" full>
              <input required minLength={10} maxLength={500} value={adjusting.reason} onChange={(e) => setAdjusting({ ...adjusting, reason: e.target.value })} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

// NS-SH04-002 payment mandate on a policy's billing account: the debit order or wallet a collection run pulls from.
const CHANNEL_LABELS = { DEBIT_ORDER: "Debit order", MOBILE_WALLET: "Mobile wallet" };

function MandatePanel({ session, notify, profile, account, onChange }) {
  const action = useAction(notify);
  const [form, setForm] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const manage = can(profile, "MANAGE_FINANCE");
  const m = account.mandate;
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const save = async () => {
    const done = await action.run(
      () => request(session, "/collections/mandates", { method: "POST", body: { ...form, policyRef: account.policyRef } }),
      "Mandate saved",
    );
    if (done) {
      setForm(null);
      onChange();
    }
  };
  const cancel = async () => {
    const done = await action.run(
      () => request(session, "/collections/mandates/" + m.ref + "/cancel", { method: "POST", body: { reason: cancelling } }),
      "Mandate cancelled",
    );
    if (done) {
      setCancelling(null);
      onChange();
    }
  };
  return (
    <div style={{ margin: "12px 0", display: "grid", gap: 8 }}>
      <div className="ws-kv">
        <div>
          <small>Payment mandate</small>
          <strong>{m ? CHANNEL_LABELS[m.channel] + " · " + m.institution + " " + m.accountMasked : "None — paid by checkout or receipt"}</strong>
        </div>
        {m?.debitDay && (
          <div>
            <small>Debit day</small>
            <strong>{m.debitDay}</strong>
          </div>
        )}
        {m && (
          <div>
            <small>Source</small>
            <strong>{m.source === "APPLICATION" ? "From the application" : "Recorded by " + m.createdBy}</strong>
          </div>
        )}
        {account.unresolvedPayments?.length > 0 && (
          <div>
            <small>Unresolved payments</small>
            <strong>{account.unresolvedPayments.join("; ")}</strong>
          </div>
        )}
      </div>
      {manage && (
        <span className="ws-row-actions">
          <Button variant="secondary" onClick={() => setForm({ channel: "DEBIT_ORDER", institution: "", accountNumber: "", accountHolder: "", debitDay: "" })}>
            {m ? "Replace mandate" : "Add mandate"}
          </Button>
          {m && (
            <Button variant="secondary" onClick={() => setCancelling("")}>
              Cancel mandate
            </Button>
          )}
        </span>
      )}
      {form && (
        <Drawer title={"Payment mandate for " + account.policyRef} description="Collection runs pull the premium from this account or wallet. It replaces any mandate on file." onClose={() => setForm(null)}>
          <FormGrid busy={action.busy} error={action.error} onSubmit={save} submitLabel="Save mandate">
            <Field label="Channel">
              <select value={form.channel} onChange={set("channel")}>
                <option value="DEBIT_ORDER">Debit order</option>
                <option value="MOBILE_WALLET">Mobile wallet</option>
              </select>
            </Field>
            <Field label={form.channel === "DEBIT_ORDER" ? "Bank" : "Wallet"}>
              {form.channel === "DEBIT_ORDER" ? (
                <input required minLength={2} maxLength={60} value={form.institution} onChange={set("institution")} />
              ) : (
                <select required value={form.institution} onChange={set("institution")}>
                  <option value="">Choose…</option>
                  <option>Orange Money</option>
                  <option>MyZaka</option>
                </select>
              )}
            </Field>
            <Field label={form.channel === "DEBIT_ORDER" ? "Account number" : "Wallet number"} hint="Demo simulator: ending in 99 is unpaid, 98 stays pending">
              <input required minLength={4} maxLength={30} value={form.accountNumber} onChange={set("accountNumber")} />
            </Field>
            <Field label="Account holder">
              <input maxLength={150} value={form.accountHolder} onChange={set("accountHolder")} />
            </Field>
            {form.channel === "DEBIT_ORDER" && (
              <Field label="Debit day (1–28)">
                <input type="number" min="1" max="28" required value={form.debitDay} onChange={set("debitDay")} />
              </Field>
            )}
          </FormGrid>
        </Drawer>
      )}
      {cancelling !== null && (
        <Drawer title={"Cancel mandate " + m.ref} description="No further collections are raised on it; the record is kept." onClose={() => setCancelling(null)}>
          <FormGrid busy={action.busy} error={action.error} onSubmit={cancel} submitLabel="Cancel mandate">
            <Field label="Reason" full>
              <input required minLength={10} maxLength={500} value={cancelling} onChange={(e) => setCancelling(e.target.value)} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </div>
  );
}

// NS-SH04-002 debit-order and mobile-money collection runs: prepared by Finance, approved by another person, sent to
// the (simulated) bank, whose response collects, fails or holds each instruction. Submission is not settlement.
const OUTCOME_CHOICES = [
  ["", "Bank decides (demo rule)"],
  ["CONFIRMED", "Collected"],
  ["FAILED", "Unpaid"],
  ["PENDING", "No answer yet"],
];

function DebitOrders({ session, notify, profile }) {
  const list = useResource(session, "/collections/batches", []);
  const action = useAction(notify);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [open, setOpen] = useState(null);
  const [notes, setNotes] = useState([]);
  const [outcomes, setOutcomes] = useState({});
  const [returning, setReturning] = useState(null);
  const manage = can(profile, "MANAGE_FINANCE");
  const me = profile?.username;
  const show = (batch) => {
    setOpen(batch);
    setOutcomes({});
  };
  const prepare = async () => {
    const done = await action.run(
      () => request(session, "/collections/batches", { method: "POST", body: { collectionDate: date } }),
      "Collection run prepared; a second person must approve it",
    );
    if (done) {
      setNotes(done.data.notes || []);
      show(done.data);
      list.reload();
    }
  };
  const step = async (path, body, message) => {
    const done = await action.run(() => request(session, "/collections/batches/" + open.ref + path, { method: "POST", body: body || {} }), message);
    if (done) {
      show(done.data);
      list.reload();
    }
  };
  const respond = () =>
    step(
      "/bank-response",
      { outcomes: Object.entries(outcomes).filter(([, o]) => o).map(([instructionRef, outcome]) => ({ instructionRef, outcome })) },
      "Bank response read",
    );
  const bankReturn = async () => {
    const done = await action.run(
      () =>
        request(session, "/collections/instructions/" + returning.ref + "/bank-return", {
          method: "POST",
          body: { kind: returning.kind, reason: returning.reason },
        }),
      "Return recorded; the receipt is reversed",
    );
    if (done) {
      setReturning(null);
      const r = await request(session, "/collections/batches/" + open.ref);
      show(r.data);
      list.reload();
    }
  };
  return (
    <>
      <Panel
        title="Debit-order and mobile-money runs"
        subtitle="One instruction per due instalment of an active policy with a mandate. Nothing is sent until a second person approves; only the bank's response collects money. The bank here is a SIMULATOR."
        action={
          manage && (
            <span className="ws-row-actions">
              <input type="date" aria-label="Collection date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Button busy={action.busy} onClick={prepare}>
                Prepare run
              </Button>
            </span>
          )
        }
      >
        <ErrorNote error={list.error || (!open && action.error)} />
        <DataTable
          rows={list.data}
          loading={list.loading}
          rowKey={(r) => r.ref}
          empty="No collection runs yet"
          emptyDetail="Run billing, record a mandate on a policy's billing account, then prepare a run."
          onRowClick={(r) => request(session, "/collections/batches/" + r.ref).then((res) => show(res.data))}
          columns={[
            { key: "ref", label: "Run" },
            { key: "collectionDate", label: "Collect on" },
            { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
            { key: "instructionCount", label: "Instructions", align: "right" },
            { key: "totalAmount", label: "Control total", align: "right", render: (r) => pula(r.totalAmount) },
            { key: "preparedBy", label: "Prepared by" },
            { key: "approvedBy", label: "Approved by", render: (r) => r.approvedBy || "—" },
            {
              key: "byStatus",
              label: "Outcome",
              render: (r) =>
                Object.entries(r.byStatus || {})
                  .map(([k, v]) => v + " " + k.toLowerCase())
                  .join(", "),
            },
          ]}
        />
      </Panel>
      {open && (
        <Drawer title={"Collection run " + open.ref} description={"Collect on " + open.collectionDate + " via " + open.provider + " (simulated bank)"} onClose={() => setOpen(null)}>
          <div className="ws-kv">
            <div>
              <small>Status</small>
              <strong>
                <Badge>{open.status}</Badge>
              </strong>
            </div>
            <div>
              <small>Control total</small>
              <strong>
                {open.instructionCount} · {pula(open.totalAmount)}
              </strong>
            </div>
            <div>
              <small>Prepared</small>
              <strong>
                {open.preparedBy} · {when(open.preparedAt)}
              </strong>
            </div>
            <div>
              <small>Approved</small>
              <strong>{open.approvedBy ? open.approvedBy + " · " + when(open.approvedAt) : "Waiting for a second person"}</strong>
            </div>
            {open.fileRef && (
              <div>
                <small>Bank file</small>
                <strong>{open.fileRef}</strong>
              </div>
            )}
            {open.note && (
              <div>
                <small>Note</small>
                <strong>{open.note}</strong>
              </div>
            )}
          </div>
          {notes.length > 0 && open.status === "PREPARED" && <p className="ws-hint">Left out: {notes.join("; ")}</p>}
          <ErrorNote error={!returning && action.error} />
          <span className="ws-row-actions">
            {open.status === "PREPARED" &&
              (can(profile, "APPROVE_JOURNAL") && open.preparedBy !== me ? (
                <Button busy={action.busy} onClick={() => step("/approve", null, "Run approved")}>
                  Approve run
                </Button>
              ) : (
                <small className="ws-hint">Waiting for another approver</small>
              ))}
            {open.status === "APPROVED" && manage && (
              <Button busy={action.busy} onClick={() => step("/submit", null, "Sent to the bank (simulated)")}>
                Send to bank
              </Button>
            )}
            {["PREPARED", "APPROVED"].includes(open.status) && manage && (
              <Button variant="secondary" busy={action.busy} onClick={() => step("/cancel", { reason: "Cancelled before submission from the workspace" }, "Run cancelled")}>
                Cancel run
              </Button>
            )}
            {open.status === "SUBMITTED" && manage && (
              <Button busy={action.busy} onClick={respond}>
                Read bank response (simulated)
              </Button>
            )}
          </span>
          <DataTable
            rows={open.instructions}
            rowKey={(r) => r.ref}
            searchFrom={8}
            empty="No instructions"
            columns={[
              { key: "ref", label: "Instruction" },
              { key: "policyRef", label: "Policy" },
              { key: "instalmentRef", label: "Instalment" },
              { key: "institution", label: "From", render: (r) => CHANNEL_LABELS[r.channel] + " · " + r.institution + " " + r.accountMasked },
              { key: "amount", label: "Amount", align: "right", render: (r) => pula(r.amount) },
              { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
              { key: "resultText", label: "Bank says", render: (r) => r.resultText || r.providerReference || "—" },
              { key: "receiptRef", label: "Receipt", render: (r) => r.receiptRef || "—" },
              {
                key: "act",
                label: "",
                render: (r) =>
                  open.status === "SUBMITTED" && ["SUBMITTED", "PENDING"].includes(r.status) && manage ? (
                    <select aria-label={"Simulated outcome for " + r.ref} value={outcomes[r.ref] || ""} onChange={(e) => setOutcomes({ ...outcomes, [r.ref]: e.target.value })}>
                      {OUTCOME_CHOICES.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : r.status === "CONFIRMED" && r.receiptRef && manage ? (
                    <Button variant="secondary" onClick={() => setReturning({ ref: r.ref, kind: "RETURNED", reason: "" })}>
                      Simulate bank return
                    </Button>
                  ) : null,
              },
            ]}
          />
        </Drawer>
      )}
      {returning && (
        <Drawer title={"Bank return of " + returning.ref} description="Simulated: the payer's bank takes the collected premium back. The receipt is reversed, the instalment reopens and the cover is reviewed." onClose={() => setReturning(null)}>
          <FormGrid busy={action.busy} error={action.error} onSubmit={bankReturn} submitLabel="Record return">
            <Field label="Kind">
              <select value={returning.kind} onChange={(e) => setReturning({ ...returning, kind: e.target.value })}>
                <option value="RETURNED">Returned unpaid</option>
                <option value="REVERSED">Reversed (disputed)</option>
              </select>
            </Field>
            <Field label="Bank's reason" full>
              <input required minLength={10} maxLength={400} value={returning.reason} onChange={(e) => setReturning({ ...returning, reason: e.target.value })} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

// NS-SH04-005 receipt reversals asked for by Finance and carried out only when a different person approves.
function ReversalRequests({ session, notify, profile, version }) {
  const list = useResource(session, "/collections/reversal-requests?v=" + version, []);
  const action = useAction(notify);
  const [rejecting, setRejecting] = useState(null);
  const me = profile?.username;
  const approve = async (r) => {
    const done = await action.run(
      () => request(session, "/collections/reversal-requests/" + r.ref + "/approve", { method: "POST", body: {} }),
      "Reversal approved: the receipt is reversed and the cover reviewed",
    );
    if (done) list.reload();
  };
  const reject = async () => {
    const done = await action.run(
      () => request(session, "/collections/reversal-requests/" + rejecting.ref + "/reject", { method: "POST", body: { note: rejecting.note } }),
      "Reversal rejected",
    );
    if (done) {
      setRejecting(null);
      list.reload();
    }
  };
  return (
    <Panel title="Receipt reversals" subtitle="Requested by one person with the bank's reason; approved by another, which reverses the receipt, reopens the instalment and reviews the cover.">
      <ErrorNote error={list.error || (!rejecting && action.error)} />
      <DataTable
        rows={list.data}
        loading={list.loading}
        rowKey={(r) => r.ref}
        empty="No reversal requests"
        columns={[
          { key: "ref", label: "Request" },
          { key: "receiptRef", label: "Receipt" },
          { key: "policyRef", label: "Policy" },
          { key: "kind", label: "Kind" },
          { key: "amount", label: "Amount", align: "right", render: (r) => pula(r.amount) },
          { key: "reason", label: "Reason" },
          { key: "requestedBy", label: "Requested by" },
          { key: "status", label: "Status", render: (r) => <Badge>{r.status.replace("_", " ")}</Badge> },
          {
            key: "act",
            label: "",
            render: (r) =>
              r.status !== "PENDING_APPROVAL" ? (
                <small className="ws-hint">
                  {r.decidedBy ? (r.status === "APPROVED" ? "Approved by " : "Rejected by ") + r.decidedBy : ""}
                  {r.reversalRef ? " · " + r.reversalRef : ""}
                  {r.decisionNote ? ": " + r.decisionNote : ""}
                </small>
              ) : r.requestedBy === me || !can(profile, "APPROVE_JOURNAL") ? (
                <small className="ws-hint">Waiting for another approver</small>
              ) : (
                <span className="ws-row-actions">
                  <Button variant="secondary" busy={action.busy} onClick={() => approve(r)}>
                    Approve
                  </Button>
                  <Button variant="secondary" onClick={() => setRejecting({ ref: r.ref, note: "" })}>
                    Reject
                  </Button>
                </span>
              ),
          },
        ]}
      />
      {rejecting && (
        <Drawer title={"Reject reversal " + rejecting.ref} description="The receipt stays as it is." onClose={() => setRejecting(null)}>
          <FormGrid busy={action.busy} error={action.error} onSubmit={reject} submitLabel="Reject reversal">
            <Field label="Why" full>
              <input required minLength={5} maxLength={500} value={rejecting.note} onChange={(e) => setRejecting({ ...rejecting, note: e.target.value })} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </Panel>
  );
}
