import React, { useState } from "react";
import { Banknote, CircleCheck, CircleX, Landmark, RefreshCw, RotateCcw, Repeat, TimerOff, Undo2 } from "lucide-react";
import { request } from "./api";
import { Badge, Button, DataTable, Panel, can, pula, useAction, useResource, when } from "./ui/workspace";
import "./payouts.css";

// Outgoing benefit payments (NS-SH05-007, §09 payment state machine, AT-SH05-02/03). Every claim or Care Cash payout
// is a payment instruction: created and approved with the decision, sent to the payout rail, and settled, failed or
// returned only on the bank's answer. The bank here is SIMULATED (no provider is chosen yet, decision D12): the
// "Simulated bank" buttons stand in for the bank so a demo can show settlement, rejection, a lost callback, an
// unknown outcome reconciled by status enquiry, a returned payment and a repeated callback.

const STATUS_LABELS = {
  CREATED: "Created",
  APPROVED: "Approved",
  SUBMITTED: "Submitted",
  PENDING: "Pending at bank",
  UNKNOWN: "Unknown outcome",
  SETTLED: "Settled",
  FAILED: "Failed",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};

const SIMULATOR = {
  SETTLE: { label: "Bank settles", icon: CircleCheck, variant: "secondary" },
  REJECT: { label: "Bank rejects", icon: CircleX, variant: "secondary" },
  RETURN: { label: "Bank returns the funds", icon: Undo2, variant: "secondary" },
  SETTLE_SILENTLY: { label: "Bank pays, callback lost", icon: Landmark, variant: "ghost" },
  TIMEOUT: { label: "No answer in time", icon: TimerOff, variant: "ghost" },
  REPEAT: { label: "Bank repeats last callback", icon: Repeat, variant: "ghost" },
};

// ISO 20022-style reasons the simulated bank can give when it rejects or returns a payment.
const REASONS = [
  ["AC01", "Incorrect account number"],
  ["AC04", "Account closed"],
  ["AC06", "Account blocked"],
  ["BE01", "Name does not match the account holder"],
  ["AM04", "Insufficient funds at the paying bank"],
];

export const payoutStatus = (status) => STATUS_LABELS[status] || status;

function InstructionCard({ session, instruction: i, profile, notify, onChanged }) {
  const { busy, run } = useAction(notify);
  const [reason, setReason] = useState("AC01");
  const [resolving, setResolving] = useState(null);
  const settle = can(profile, "SETTLE_CLAIM");
  const act = (path, body, done) =>
    run(async () => {
      const result = await request(session, "/payments/payouts/" + encodeURIComponent(i.ref) + path, {
        method: "POST",
        body: body || {},
      });
      await onChanged?.();
      return result.data;
    }, done);
  const simulate = (action) => {
    const picked = REASONS.find(([code]) => code === reason);
    const body =
      action === "REJECT" || action === "RETURN"
        ? { action, reasonCode: picked[0], reasonText: picked[1] }
        : { action };
    return run(async () => {
      const result = await request(session, "/payments/payouts/" + encodeURIComponent(i.ref) + "/simulator", {
        method: "POST",
        body,
      });
      await onChanged?.();
      const r = result.data;
      notify?.(
        r.result === "DUPLICATE"
          ? "Duplicate callback recognised: no second payment."
          : r.result === "CONFLICT"
            ? "The bank's answer contradicts the instruction; it is in the exception queue."
            : r.note || "Simulated bank answered.",
        r.result === "CONFLICT" ? "error" : "success",
      );
      return r;
    });
  };
  return (
    <div className={"payout-card" + (i.exceptionState === "OPEN" ? " payout-exception" : "")}>
      <div className="payout-head">
        <Banknote size={18} aria-hidden="true" />
        <strong>{i.ref}</strong>
        <span className="muted small">attempt {i.attempt}</span>
        <Badge>{payoutStatus(i.status)}</Badge>
        {i.exceptionState === "OPEN" && <Badge tone="red">Exception</Badge>}
        <span className="payout-amount">{pula(i.amount)}</span>
      </div>
      <div className="payout-meta muted small">
        {[
          i.payeeName + " · " + i.payoutMethod + " " + i.account,
          i.providerReference ? "Bank ref " + i.providerReference + (i.bankStatus ? " (" + i.bankStatus.toLowerCase() + ")" : "") : "Not yet sent",
          "Approved by " + (i.approvedBy || "—"),
          i.replacesRef ? "replaces " + i.replacesRef : null,
          "key " + i.idempotencyKey,
        ]
          .filter(Boolean)
          .join(" · ")}
      </div>
      {i.failureReason && (
        <p className="small">
          <strong>Bank's reason:</strong> {i.failureCode ? i.failureCode + " — " : ""}
          {i.failureReason}
        </p>
      )}
      {i.exceptionNote && (
        <p className={"small" + (i.exceptionState === "OPEN" ? " form-error" : " muted")}>
          {i.exceptionState === "OPEN" ? "Exception: " : "Exception resolved: "}
          {i.exceptionNote}
          {i.exceptionResolvedBy ? " · " + i.exceptionResolvedBy + " " + when(i.exceptionResolvedAt) : ""}
        </p>
      )}
      <details className="payout-trail">
        <summary>
          {i.steps.length} steps · {i.callbacks.length} bank answer{i.callbacks.length === 1 ? "" : "s"}
        </summary>
        <ol className="wf-evidence">
          {i.steps.map((s, n) => (
            <li key={"s" + n} className="optional">
              {(s.from ? payoutStatus(s.from) + " → " : "") + payoutStatus(s.to)}
              {s.note ? " · " + s.note : ""}
              <small>
                {s.actor} · {when(s.at)}
              </small>
            </li>
          ))}
          {i.callbacks.map((c) => (
            <li key={c.eventId} className={c.result === "APPLIED" ? "received" : c.result === "CONFLICT" ? "missing" : "optional"}>
              Bank answer {c.outcome.toLowerCase()} · {c.result.toLowerCase()}
              {c.note ? " · " + c.note : ""}
              <small>
                event {c.eventId} · {when(c.receivedAt)}
              </small>
            </li>
          ))}
        </ol>
      </details>
      {settle && (
        <div className="detail-actions">
          {i.actions.includes("reconcile") && (
            <Button
              icon={RefreshCw}
              variant={i.status === "UNKNOWN" ? "primary" : "secondary"}
              busy={busy}
              onClick={() => act("/reconcile", null, "Status enquiry sent to the bank.")}
            >
              Reconcile with bank
            </Button>
          )}
          {i.actions.includes("resolve") && !resolving && (
            <Button icon={RotateCcw} variant="secondary" onClick={() => setResolving("")}>
              Resolve exception
            </Button>
          )}
        </div>
      )}
      {resolving !== null && (
        <div className="wf-reason">
          <textarea
            className="textarea"
            rows={2}
            maxLength={300}
            value={resolving}
            onChange={(e) => setResolving(e.target.value)}
            placeholder="How it was resolved, e.g. bank confirmed the notice was sent in error"
          />
          <div className="detail-actions">
            <Button variant="secondary" onClick={() => setResolving(null)}>
              Back
            </Button>
            <Button
              disabled={resolving.trim().length < 5}
              busy={busy}
              onClick={async () => {
                const ok = await act("/resolve", { note: resolving.trim() }, "Exception resolved.");
                if (ok) setResolving(null);
              }}
            >
              Confirm
            </Button>
          </div>
        </div>
      )}
      {settle && i.simulator.length > 0 && (
        <div className="payout-simulator" role="group" aria-label={"Simulated bank for " + i.ref}>
          <span className="eyebrow">Simulated bank · demo only, no money moves</span>
          <div className="detail-actions">
            {(i.simulator.includes("REJECT") || i.simulator.includes("RETURN")) && (
              <select
                className="input payout-reason"
                aria-label="Reason the bank gives"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                {REASONS.map(([code, text]) => (
                  <option key={code} value={code}>
                    {code} {text}
                  </option>
                ))}
              </select>
            )}
            {i.simulator.map((action) => {
              const s = SIMULATOR[action];
              return s ? (
                <Button key={action} icon={s.icon} variant={s.variant} busy={busy} onClick={() => simulate(action)}>
                  {s.label}
                </Button>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** The payment instructions of one claim or Care Cash event, newest first, with the simulated bank. */
export function PayoutInstructions({ session, source, sourceRef, profile, notify, version, onChanged }) {
  const path = sourceRef
    ? "/payments/payouts?source=" + encodeURIComponent(source) + "&ref=" + encodeURIComponent(sourceRef) + "&v=" + (version ?? 0)
    : null;
  const list = useResource(session, path, []);
  if (!list.data?.length) {
    return list.loading ? null : (
      <p className="muted small">No payment instruction yet: one is created and approved with the decision.</p>
    );
  }
  return (
    <div className="payout-list">
      {list.data.map((i) => (
        <InstructionCard
          key={i.ref}
          session={session}
          instruction={i}
          profile={profile}
          notify={notify}
          onChanged={async () => {
            await list.reload();
            await onChanged?.();
          }}
        />
      ))}
    </div>
  );
}

/**
 * The payout exception queue (AT-SH05-03): instructions the bank rejected or returned, whose outcome is unknown, or
 * whose callback contradicted them. A claim here stays unpaid; nothing shows as settled until the bank says so.
 */
export function PayoutExceptionQueue({ session, profile, notify, onOpen }) {
  const list = useResource(session, can(profile, "READ_CLAIM") ? "/payments/payouts/exceptions" : null, []);
  const [open, setOpen] = useState(null);
  const rows = list.data || [];
  const selected = rows.find((r) => r.ref === open);
  return (
    <Panel
      title="Payout exceptions"
      subtitle="Payments the bank rejected or returned, whose outcome is unknown, or whose answer contradicted the instruction. Each stays unpaid until it is replaced, reconciled or resolved."
      action={
        <Button variant="ghost" icon={RefreshCw} onClick={() => list.reload()}>
          Refresh
        </Button>
      }
    >
      <DataTable
        loading={list.loading}
        rows={rows}
        pageSize={5}
        empty="No payout exceptions"
        emptyDetail="Every instruction sent to the bank is pending, settled or replaced."
        columns={[
          { key: "ref", label: "Instruction" },
          {
            key: "sourceRef",
            label: "For",
            render: (r) => (r.sourceType === "CARE_CASH" ? "Care Cash " : "Claim ") + r.sourceRef,
          },
          { key: "status", label: "Status", render: (r) => <Badge>{payoutStatus(r.status)}</Badge> },
          { key: "amount", label: "Amount", align: "right", render: (r) => pula(r.amount) },
          { key: "payeeName", label: "Payee" },
          { key: "exceptionNote", label: "Why", render: (r) => <span className="small">{r.exceptionNote}</span> },
          {
            key: "actions",
            label: "",
            render: (r) => (
              <span className="detail-actions">
                <Button variant="secondary" onClick={() => setOpen(open === r.ref ? null : r.ref)}>
                  {open === r.ref ? "Hide" : "Details"}
                </Button>
                {onOpen && (
                  <Button variant="ghost" onClick={() => onOpen(r)}>
                    Open {r.sourceType === "CARE_CASH" ? "event" : "claim"}
                  </Button>
                )}
              </span>
            ),
          },
        ]}
      />
      {selected && (
        <InstructionCard
          session={session}
          instruction={selected}
          profile={profile}
          notify={notify}
          onChanged={() => list.reload()}
        />
      )}
    </Panel>
  );
}
