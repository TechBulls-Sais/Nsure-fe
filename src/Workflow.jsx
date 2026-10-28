import React, { useEffect, useState } from "react";
import {
  BadgeCheck,
  Check,
  CircleCheck,
  CircleX,
  Clock3,
  Download,
  Eye,
  FileText,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import { fetchFile, request, uploadFile } from "./api";
import { money } from "./data";
import "./workflow.css";

// The demo server's checkout methods, and the ways a claim or beneficiary can be paid out.
export const PAYMENT_METHODS = ["Orange Money", "MyZaka", "Card", "Bank EFT"];
export const PAYOUT_METHODS = ["Bank Account", "Mobile Wallet"];
export const RELATIONSHIPS = ["Spouse", "Child", "Parent", "Sibling", "Other"];

export const POLICY_STATES = ["Pending Payment", "Active", "Lapsed", "Expired", "Cancelled"];
export const CLAIM_STATES = ["Initiated", "Under Review", "Recommended", "Approved", "Rejected", "Paid"];

const OPEN_CLAIM = ["Initiated", "Under Review", "Recommended"];

function Btn({ icon: I, variant = "primary", children, ...props }) {
  return (
    <button type="button" className={"btn " + variant} {...props}>
      {I && <I className="icon icon-sm" strokeWidth={1.8} aria-hidden="true" />}
      {children}
    </button>
  );
}

function Item({ label, value }) {
  return (
    <div className="detail-item">
      <small>{label}</small>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value.length <= 10 ? value + "T00:00:00" : value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        ...(value.length > 10 ? { hour: "2-digit", minute: "2-digit" } : {}),
      });
}
export { formatDate };

/** The workflow log of a policy, claim, or a customer's KYC / EDD review, oldest first. */
export function WorkflowTimeline({ session, type, refId, version = 0 }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const types = Array.isArray(type) ? type : [type];
    Promise.all(types.map((t) => request(session, "/portfolio/history/" + t + "/" + refId)))
      .then((results) => {
        if (!live) return;
        setRows(
          results
            .flatMap((r) => r.data)
            .sort((a, b) => a.performedAt.localeCompare(b.performedAt)),
        );
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [session, String(type), refId, version]);
  if (error) return <p className="form-error">{error}</p>;
  if (!rows) return <p className="muted">Loading history…</p>;
  if (!rows.length) return <p className="muted">No workflow steps recorded yet.</p>;
  return (
    <div className="timeline">
      {rows.map((row, i) => (
        <div className="timeline-item" key={i}>
          <span />
          <div>
            <strong>
              {row.action}
              {row.previousState !== row.newState && row.newState
                ? " · " + (row.previousState ? row.previousState + " → " : "") + row.newState
                : ""}
            </strong>
            <small>
              {formatDate(row.performedAt)} · {row.performedBy}
            </small>
            {row.details && <p>{row.details}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Pass / Fail of the five straight-through checks. */
export function ClaimChecks({ checks = [] }) {
  return (
    <div className="wf-checks">
      {checks.map((check) => (
        <div className={"wf-check " + check.result.toLowerCase()} key={check.name}>
          {check.result === "Pass" ? (
            <CircleCheck size={16} aria-hidden="true" />
          ) : check.result === "Fail" ? (
            <CircleX size={16} aria-hidden="true" />
          ) : (
            <Clock3 size={16} aria-hidden="true" />
          )}
          <span>{check.name}</span>
          <em>{check.result}</em>
        </div>
      ))}
    </div>
  );
}

// Same list and limit as ClaimDocumentService on the server.
export const DOCUMENT_TYPES = [
  "Identity document",
  "Signed declaration",
  "Death certificate",
  "Medical report",
  "Hospital bill",
  "Supporting evidence",
];
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

function fileSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return Math.max(1, Math.round(bytes / 1024)) + " KB";
}

/**
 * Evidence on one claim: list, view, download, (while the claim is open) upload, and a generated claim summary.
 * `basePath` is the staff path (/portfolio/claims/{ref}/documents) or the customer's
 * (/portfolio/shop/claims/{ref}/documents); `onUploaded` receives whatever that endpoint answers.
 */
export function ClaimDocuments({ claim, ...props }) {
  return (
    <DocumentsPanel
      record={claim}
      open={!["Paid", "Rejected"].includes(claim.status)}
      generate={{
        slug: "summary",
        label: "Generate claim summary",
        hint: "A PDF of the claim, checks, payee, decision and history as they stand now.",
        done: "Claim summary generated.",
      }}
      {...props}
    />
  );
}

/** Documents filed on one policy: the generated policy schedule, viewed and downloaded like claim documents. */
export function PolicyDocuments({ policy, ...props }) {
  return (
    <DocumentsPanel
      record={policy}
      open={false}
      canUpload={false}
      generate={{
        slug: "schedule",
        label: "Generate policy schedule",
        hint: "A PDF of the policy, cover, covered lives, beneficiaries and history as they stand now.",
        done: "Policy schedule generated.",
      }}
      {...props}
    />
  );
}

function DocumentsPanel({ session, record, open, generate, basePath, canUpload, canGenerate, onUploaded, notify }) {
  const documents = record.documents || [];
  const [type, setType] = useState(DOCUMENT_TYPES[0]);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  const choose = (event) => {
    const picked = event.target.files?.[0] || null;
    if (picked && picked.size > MAX_DOCUMENT_BYTES) {
      notify("Files can be at most 10 MB.");
      setInputKey((k) => k + 1);
      setFile(null);
      return;
    }
    setFile(picked);
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const result = await uploadFile(session, basePath, file, { type });
      onUploaded(result.data);
      notify(file.name + " uploaded.");
      setFile(null);
      setInputKey((k) => k + 1);
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  };

  // A PDF snapshot of the record, filed with its documents. Allowed on closed claims too.
  const runGenerate = async () => {
    setBusy(true);
    try {
      const result = await request(session, basePath + "/" + generate.slug, { method: "POST" });
      onUploaded(result.data);
      notify(generate.done);
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  };

  // The tab opens on the click itself so the popup blocker allows it; the file arrives a moment later.
  const view = async (doc) => {
    const tab = window.open("", "_blank");
    try {
      const url = URL.createObjectURL(await fetchFile(session, basePath + "/" + doc.id));
      if (tab) tab.location.href = url;
      else window.location.assign(url);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      tab?.close();
      notify(error.message);
    }
  };

  const download = async (doc) => {
    try {
      const url = URL.createObjectURL(await fetchFile(session, basePath + "/" + doc.id));
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      notify(error.message);
    }
  };

  return (
    <div className="wf-docs">
      {canGenerate && (
        <div className="wf-doc-generate">
          <Btn variant="secondary" icon={FileText} disabled={busy} onClick={runGenerate}>
            {generate.label}
          </Btn>
          <small className="muted">{generate.hint}</small>
        </div>
      )}
      {documents.length === 0 ? (
        <p className="muted small">No documents on file yet.</p>
      ) : (
        <ul className="wf-doc-list">
          {documents.map((doc) => (
            <li key={doc.id}>
              <FileText size={18} aria-hidden="true" />
              <div>
                <strong>{doc.type}</strong>
                <small>
                  {doc.fileName} · {fileSize(doc.size)} · {doc.uploadedBy}, {formatDate(doc.uploadedAt)}
                </small>
              </div>
              <span className="wf-doc-actions">
                <Btn variant="secondary" icon={Eye} onClick={() => view(doc)} aria-label={"View " + doc.fileName}>
                  View
                </Btn>
                <Btn variant="secondary" icon={Download} onClick={() => download(doc)} aria-label={"Download " + doc.fileName}>
                  Download
                </Btn>
              </span>
            </li>
          ))}
        </ul>
      )}
      {canUpload && open && (
        <div className="wf-doc-upload">
          <select className="input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Document type">
            {DOCUMENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input key={inputKey} className="input" type="file" accept={DOCUMENT_ACCEPT} onChange={choose} aria-label="Document file" />
          <Btn icon={Upload} disabled={!file || busy} onClick={upload}>
            {busy ? "Uploading…" : "Upload"}
          </Btn>
          <small className="muted">PDF, JPG or PNG, up to 10 MB.</small>
        </div>
      )}
      {canUpload && !open && <p className="muted small">This claim is closed, so no more documents can be added.</p>}
    </div>
  );
}

export function BeneficiaryList({ beneficiaries = [], onRemove, busy }) {
  if (!beneficiaries.length) return <p className="muted">No beneficiaries yet. A claim pays a beneficiary.</p>;
  return (
    <ul className="wf-beneficiaries">
      {beneficiaries.map((b) => (
        <li key={b.id}>
          <div>
            <strong>
              {b.fullName}
              {b.primary && <em className="wf-tag">Primary</em>}
            </strong>
            <small>
              {b.relationship}
              {b.mobile ? " · " + b.mobile : ""}
              {b.payoutMethod ? " · " + b.payoutMethod + " " + b.accountRef : " · no payout details"}
            </small>
          </div>
          {onRemove && (
            <button
              type="button"
              className="icon-btn"
              aria-label={"Remove " + b.fullName}
              disabled={busy}
              onClick={() => onRemove(b)}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Adds one beneficiary; up to five per policy. */
export function BeneficiaryForm({ onSave, busy }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Btn variant="secondary" icon={UserPlus} onClick={() => setOpen(true)}>
        Add beneficiary
      </Btn>
    );
  }
  return (
    <form
      className="wf-inline-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget));
        const ok = await onSave({ ...f, primary: f.primary === "on" });
        if (ok !== false) setOpen(false);
      }}
    >
      <div className="field-grid">
        <label className="form-label">
          <span>Full name</span>
          <input name="fullName" className="input" required maxLength={200} />
        </label>
        <label className="form-label">
          <span>Relationship</span>
          <select name="relationship" className="input" defaultValue="Spouse">
            {RELATIONSHIPS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="form-label">
          <span>National ID (optional)</span>
          <input name="nationalId" className="input" maxLength={40} />
        </label>
        <label className="form-label">
          <span>Mobile (optional)</span>
          <input name="mobile" className="input" type="tel" maxLength={40} />
        </label>
        <label className="form-label">
          <span>Payout method</span>
          <select name="payoutMethod" className="input" defaultValue="">
            <option value="">Not yet</option>
            {PAYOUT_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="form-label">
          <span>Account / wallet number</span>
          <input name="accountRef" className="input" maxLength={80} />
        </label>
        <label className="wf-check-label">
          <input type="checkbox" name="primary" /> Primary beneficiary
        </label>
      </div>
      <div className="detail-actions">
        <Btn variant="secondary" icon={X} onClick={() => setOpen(false)}>
          Cancel
        </Btn>
        <Btn type="submit" icon={Check} disabled={busy}>
          Save beneficiary
        </Btn>
      </div>
    </form>
  );
}

/** Choose a payment method and pay. */
export function PayForm({ label = "Pay now", onPay, busy }) {
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  return (
    <div className="wf-pay">
      <select className="input" aria-label="Payment method" value={method} onChange={(e) => setMethod(e.target.value)}>
        {PAYMENT_METHODS.map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>
      <Btn icon={Wallet} disabled={busy} onClick={() => onPay(method)}>
        {label}
      </Btn>
    </div>
  );
}

/** A reason box with a confirm button; used wherever a rejection or cancellation must say why. */
export function ReasonAction({ label, icon = X, placeholder, onConfirm, busy, variant = "secondary" }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) {
    return (
      <Btn variant={variant} icon={icon} disabled={busy} onClick={() => setOpen(true)}>
        {label}
      </Btn>
    );
  }
  return (
    <div className="wf-reason">
      <textarea
        className="textarea"
        rows={2}
        maxLength={500}
        autoFocus
        placeholder={placeholder || "Reason (the customer is told why)"}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="detail-actions">
        <Btn variant="secondary" onClick={() => setOpen(false)}>
          Back
        </Btn>
        <Btn
          icon={icon}
          disabled={busy || !reason.trim()}
          onClick={async () => {
            const ok = await onConfirm(reason.trim());
            if (ok !== false) {
              setOpen(false);
              setReason("");
            }
          }}
        >
          Confirm {label.toLowerCase()}
        </Btn>
      </div>
    </div>
  );
}

function useAction(notify) {
  const [busy, setBusy] = useState(false);
  const run = async (fn, done) => {
    setBusy(true);
    try {
      const result = await fn();
      if (done) notify(done);
      return result;
    } catch (error) {
      notify(error.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return [busy, run];
}

/** Staff view of a policy's lifecycle: dates, beneficiaries, record a premium, cancel an unpaid policy. */
export function PolicyWorkflowPanel({ session, policy: p, canManage, onUpdated, notify }) {
  const [busy, run] = useAction(notify);
  const call = (path, options, done) =>
    run(async () => {
      const result = await request(session, "/portfolio/policies/" + p.id + path, options);
      onUpdated(result.data);
      return result.data;
    }, done);
  return (
    <div className="wf-panel">
      <h3 className="section-title">Policy lifecycle</h3>
      <div className="detail-grid">
        {p.status === "Pending Payment" ? (
          <Item label="Pay by" value={p.paymentDueBy ? formatDate(p.paymentDueBy) : "No deadline (on hold)"} />
        ) : (
          <Item label="Cover start" value={formatDate(p.coverStartDate)} />
        )}
        <Item label="Next premium due" value={formatDate(p.nextPremiumDue)} />
        <Item label="Grace period ends" value={formatDate(p.gracePeriodEnd)} />
        <Item
          label={p.status === "Lapsed" ? "Lapsed on" : "Payment method"}
          value={p.status === "Lapsed" ? formatDate(p.lapseDate) : p.paymentMethod}
        />
      </div>
      {p.inGrace && (
        <div className="notice">
          <Clock3 size={18} aria-hidden="true" />
          <p>The premium is overdue. The policy lapses on {formatDate(p.gracePeriodEnd)} unless it is paid.</p>
        </div>
      )}
      {p.status === "Cancelled" && p.reviewNote && (
        <div className="notice">
          <X size={18} aria-hidden="true" />
          <p>
            Cancelled by {p.reviewedBy}: {p.reviewNote}
          </p>
        </div>
      )}
      <h3 className="section-title">Beneficiaries · {p.beneficiaries?.length || 0} of 5</h3>
      <BeneficiaryList
        beneficiaries={p.beneficiaries}
        busy={busy}
        onRemove={
          canManage && ["Pending Payment", "Active"].includes(p.status)
            ? (b) => call("/beneficiaries/" + b.id, { method: "DELETE" }, b.fullName + " removed.")
            : null
        }
      />
      {canManage && ["Pending Payment", "Active"].includes(p.status) && (p.beneficiaries?.length || 0) < 5 && (
        <BeneficiaryForm
          busy={busy}
          onSave={(body) => call("/beneficiaries", { method: "POST", body }, "Beneficiary added.")}
        />
      )}
      {canManage && ["Pending Payment", "Active"].includes(p.status) && (
        <>
          <h3 className="section-title">
            {p.status === "Pending Payment" ? "Collect the first premium" : "Record a premium"}
          </h3>
          <p className="muted small">
            {p.status === "Pending Payment"
              ? "The policy goes Active with cover from today."
              : "Moves the next due date on by one premium period."}{" "}
            Premium {money(p.premium)}.
          </p>
          <div className="detail-actions">
            <PayForm
              busy={busy}
              label="Record payment"
              onPay={(method) =>
                call("/payments", { method: "POST", body: { method } }, "Payment recorded for " + p.id + ".")
              }
            />
            {p.status === "Pending Payment" && (
              <ReasonAction
                label="Cancel policy"
                busy={busy}
                onConfirm={(reason) =>
                  call("/cancel", { method: "POST", body: { reason } }, p.id + " is cancelled.")
                }
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Staff view of a claim's workflow: checks, payee, and the assess / approve / reject / pay actions. */
export function ClaimWorkflowPanel({ session, claim: c, profile, onUpdated, notify }) {
  const [busy, run] = useAction(notify);
  const [editPayee, setEditPayee] = useState(false);
  const [payout, setPayout] = useState("");
  const open = OPEN_CLAIM.includes(c.status);
  const can = (action) => c.actions?.includes(action);
  const call = (path, options, done) =>
    run(async () => {
      const result = await request(session, "/portfolio/claims/" + c.id + path, options);
      onUpdated(result.data);
      return result.data;
    }, done);
  const payee = c.payee || {};
  const payeeComplete = payee.name && payee.payoutMethod && payee.accountRef;
  const canEditPayee = open && (profile?.canUpdateClaims || profile?.canAssessClaims);
  return (
    <div className="wf-panel">
      <div className="detail-grid">
        <Item label="Policy" value={c.policy} />
        <Item label="Claimant" value={c.claimant + (c.claimantRelationship ? " (" + c.claimantRelationship + ")" : "")} />
        <Item label="Date of event" value={formatDate(c.eventDate)} />
        <Item label="Processing" value={c.processingType} />
        <Item label="Policy cover" value={money(c.amount)} />
        <Item label="Payout" value={c.payoutAmount != null ? money(c.payoutAmount) : "Not decided"} />
      </div>
      {c.description && (
        <div className="notice">
          <ShieldCheck size={18} aria-hidden="true" />
          <p>{c.description}</p>
        </div>
      )}
      <h3 className="section-title">Straight-through checks</h3>
      <ClaimChecks checks={c.checks} />
      {c.stpIneligibleReason && <p className="muted small">Not straight-through: {c.stpIneligibleReason}.</p>}

      <h3 className="section-title">Payee</h3>
      {editPayee ? (
        <form
          className="wf-inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget));
            const ok = await call(
              "/payee",
              { method: "PUT", body: { ...f, verified: f.verified === "on" } },
              "Payee saved.",
            );
            if (ok) setEditPayee(false);
          }}
        >
          <div className="field-grid">
            <label className="form-label">
              <span>Payee name</span>
              <input name="name" className="input" defaultValue={payee.name} required />
            </label>
            <label className="form-label">
              <span>Relationship</span>
              <input name="relationship" className="input" defaultValue={payee.relationship} />
            </label>
            <label className="form-label">
              <span>Mobile</span>
              <input name="mobile" className="input" defaultValue={payee.mobile} />
            </label>
            <label className="form-label">
              <span>Payout method</span>
              <select name="payoutMethod" className="input" defaultValue={payee.payoutMethod || PAYOUT_METHODS[0]}>
                {PAYOUT_METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="form-label">
              <span>Account / wallet number</span>
              <input name="accountRef" className="input" defaultValue={payee.accountRef} required />
            </label>
            <label className="wf-check-label">
              <input type="checkbox" name="verified" /> I checked these details against the claim documents
            </label>
          </div>
          <div className="detail-actions">
            <Btn variant="secondary" onClick={() => setEditPayee(false)}>
              Cancel
            </Btn>
            <Btn type="submit" icon={Check} disabled={busy}>
              Save payee
            </Btn>
          </div>
        </form>
      ) : (
        <div className="linked-record">
          {payee.verified ? <BadgeCheck aria-hidden="true" /> : <Clock3 aria-hidden="true" />}
          <div>
            <strong>{payeeComplete ? payee.name : "No payee with payout details yet"}</strong>
            <small>
              {payeeComplete
                ? [payee.relationship, payee.payoutMethod + " " + payee.accountRef, payee.source]
                    .filter(Boolean)
                    .join(" · ")
                : "Add who this claim pays before it can be assessed."}
            </small>
          </div>
          <span className={"badge " + (payee.verified ? "green" : "amber")}>
            <span className="status-dot" />
            {payee.verified ? "Verified" + (payee.verifiedBy ? " by " + payee.verifiedBy : "") : "Not verified"}
          </span>
        </div>
      )}
      {canEditPayee && !editPayee && (
        <Btn variant="secondary" onClick={() => setEditPayee(true)}>
          {payeeComplete ? "Change payee" : "Add payee"}
        </Btn>
      )}

      {c.recommendedBy && (
        <p className="muted small">
          Assessed by {c.recommendedBy}
          {c.adjudicatedBy ? " · decided by " + c.adjudicatedBy : ""}
          {c.fourEyesApplied === true
            ? " · four-eyes applied"
            : c.fourEyesApplied === false
              ? c.adjudicatedBy === c.recommendedBy
                ? " · four-eyes overridden by super admin"
                : " · four-eyes control was off"
              : ""}
        </p>
      )}
      {c.status === "Rejected" && (
        <div className="notice">
          <X size={18} aria-hidden="true" />
          <p>
            Rejected by {c.adjudicatedBy}: {c.rejectionReason}
          </p>
        </div>
      )}
      {c.status === "Paid" && (
        <div className="notice">
          <CircleCheck size={18} aria-hidden="true" />
          <p>
            {money(c.payoutAmount)} paid to {payee.name} on {formatDate(c.paidAt)} · {c.payoutReference}
          </p>
        </div>
      )}

      <div className="detail-actions">
        {open && profile?.canUpdateClaims && (
          <Btn variant="secondary" icon={RotateCcw} disabled={busy} onClick={() => call("/checks", { method: "POST" }, "Checks re-run.")}>
            Re-run checks
          </Btn>
        )}
        {can("assess") && profile?.canAssessClaims && (
          <Btn
            icon={BadgeCheck}
            disabled={busy || !payeeComplete}
            title={payeeComplete ? undefined : "Add the payee first"}
            onClick={() => call("/assess", { method: "POST", body: {} }, c.id + " is recommended for approval.")}
          >
            Assess &amp; recommend
          </Btn>
        )}
        {can("approve") && profile?.canApproveClaims && (
          <span className="wf-pay">
            <input
              className="input"
              type="number"
              min="1"
              max={c.amount}
              placeholder={"Payout (default " + c.amount + ")"}
              aria-label="Payout amount"
              value={payout}
              onChange={(e) => setPayout(e.target.value)}
            />
            <Btn
              icon={Check}
              disabled={busy}
              onClick={() =>
                call(
                  "/approve",
                  { method: "POST", body: payout ? { payoutAmount: Number(payout) } : {} },
                  c.id + " is approved.",
                )
              }
            >
              Approve
            </Btn>
          </span>
        )}
        {can("pay") && profile?.canSettleClaims && (
          <Btn icon={Wallet} disabled={busy} onClick={() => call("/pay", { method: "POST" }, "Payout sent for " + c.id + ".")}>
            Pay out {money(c.payoutAmount)}
          </Btn>
        )}
        {can("reject") && profile?.canRejectClaims && (
          <ReasonAction
            label="Reject"
            busy={busy}
            onConfirm={(reason) => call("/reject", { method: "POST", body: { reason } }, c.id + " is rejected.")}
          />
        )}
      </div>
      {c.status === "Recommended" && c.recommendedBy === profile?.username && (
        <p className="muted small">
          {profile?.superAdmin
            ? "You assessed this claim. As super admin you can still approve it; it is recorded as a four-eyes override."
            : "You assessed this claim, so a different person must approve it (four-eyes)."}
        </p>
      )}
    </div>
  );
}

/** Lodge a claim on a policy: who is claiming, what happened, and when. */
export function ClaimLodgeForm({ policies = [], onSave, onCancel, submitLabel = "Lodge claim", busy }) {
  const today = new Date().toISOString().slice(0, 10);
  // With several policies, nothing is pre-selected: the claim is filed under the chosen policy's holder,
  // so defaulting to the first (newest) policy put claims under the wrong customer.
  const [policyId, setPolicyId] = useState(policies.length === 1 ? policies[0].id : "");
  const chosen = policies.find((p) => p.id === policyId);
  if (!policies.length) {
    return <p className="muted">There is no policy to claim on yet.</p>;
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(Object.fromEntries(new FormData(e.currentTarget)));
      }}
    >
      <div className="field-grid">
        <label className="form-label full">
          <span>Policy</span>
          <select
            name="policy"
            className="input"
            required
            value={policyId}
            onChange={(e) => setPolicyId(e.target.value)}
          >
            {policies.length > 1 && (
              <option value="" disabled>
                Choose the policy this claim is for…
              </option>
            )}
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name} · {p.product}
                {p.tier ? " " + p.tier : ""} ({p.status})
              </option>
            ))}
          </select>
          {chosen && (
            <small className="muted small">
              Filed under policyholder <strong>{chosen.name}</strong>. The claimant below is the person reporting it.
            </small>
          )}
        </label>
        <label className="form-label">
          <span>Claimant full name</span>
          <input name="claimantName" className="input" required maxLength={200} />
        </label>
        <label className="form-label">
          <span>Claimant mobile</span>
          <input name="claimantMobile" className="input" type="tel" required maxLength={40} />
        </label>
        <label className="form-label">
          <span>Relationship to the insured</span>
          <select name="claimantRelationship" className="input" defaultValue="Spouse">
            {RELATIONSHIPS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="form-label">
          <span>Date of the event</span>
          <input name="eventDate" className="input" type="date" max={today} required />
        </label>
        <label className="form-label">
          <span>Benefit type</span>
          <select name="type" className="input" defaultValue="Death benefit">
            <option>Death benefit</option>
            <option>Funeral benefit</option>
            <option>Disability benefit</option>
            <option>Hospital admission</option>
          </select>
        </label>
        <label className="form-label full">
          <span>What happened</span>
          <textarea name="description" className="textarea" rows={3} required maxLength={1000} />
        </label>
      </div>
      <p className="muted small">
        Five checks run straight away. A claim that passes them all and pays a registered beneficiary may be approved
        automatically; any other goes to a claims assessor.
      </p>
      <div className="modal-footer">
        {onCancel && (
          <Btn variant="secondary" onClick={onCancel}>
            Cancel
          </Btn>
        )}
        <Btn type="submit" icon={Check} disabled={busy}>
          {submitLabel}
        </Btn>
      </div>
    </form>
  );
}
