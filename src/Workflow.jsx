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
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import { fetchFile, request, uploadFile } from "./api";
import { money } from "./data";
import { useConfirm } from "./ui/overlay";
import { can as holds } from "./ui/workspace";
import "./workflow.css";
import "./access.css";

// The demo server's checkout methods, and the ways a claim or beneficiary can be paid out.
export const PAYMENT_METHODS = ["Orange Money", "MyZaka", "Card", "Bank EFT"];
export const PAYOUT_METHODS = ["Bank Account", "Mobile Wallet"];
export const RELATIONSHIPS = ["Spouse", "Child", "Parent", "Sibling", "Other"];

// Spec 10 §1.3, as PolicyWorkflow on the server names them. "Active - No Cover": the grace period ended unpaid, so the
// policy stays in force for up to 3 months without cover; paying resumes cover with no new waiting period.
// "Claimed": ended by a paid claim.
export const NO_COVER = "Active - No Cover";
export const POLICY_STATES = ["Pending Payment", "Active", NO_COVER, "Lapsed", "Expired", "Cancelled", "Claimed"];
/** In force: cover running, or paused (no cover) but still revivable by paying. */
export const IN_FORCE_STATES = ["Active", NO_COVER];
/** A premium can be collected (first premium, renewal, or reinstatement from no cover). */
export const PAYABLE_STATES = ["Pending Payment", "Active", NO_COVER];
/** Staff can cancel these, with a reason. */
export const CANCELLABLE_STATES = ["Pending Payment", "Active", NO_COVER];
/** Beneficiaries can still be changed (the server refuses Cancelled, Expired and Lapsed). */
const BENEFICIARY_STATES = ["Pending Payment", "Active", NO_COVER];
/** TC-18 / TC-20: months a policy stays in force without cover before it lapses. */
export const NO_COVER_MONTHS = 3;

/** The date a no-cover policy lapses unless paid: cover end (its unpaid due date) plus three months. */
export function noCoverLapsesOn(policy) {
  const from = policy?.nextPremiumDue || policy?.gracePeriodEnd;
  if (!from) return "";
  const date = new Date(from.slice(0, 10) + "T00:00:00");
  if (Number.isNaN(date.getTime())) return "";
  const dayOfMonth = date.getDate();
  date.setMonth(date.getMonth() + NO_COVER_MONTHS);
  // Like the server's plusMonths: 30 Nov + 3 months is 28 Feb, not 2 March.
  if (date.getDate() !== dayOfMonth) date.setDate(0);
  // Local parts, not toISOString(): east of UTC that would give the day before.
  const pad = (n) => String(n).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

/** Badge colour for a policy state: in force green, waiting or paused amber, ended red, closed by a claim blue. */
export function policyTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === NO_COVER.toLowerCase() || s === "pending payment") return "amber";
  if (s === "active") return "green";
  if (s === "claimed") return "blue";
  if (["lapsed", "expired", "cancelled"].includes(s)) return "red";
  return null;
}

export const CLAIM_STATES = ["Initiated", "Under Review", "Recommended", "Approved", "Rejected", "Paid"];

const OPEN_CLAIM = ["Initiated", "Under Review", "Recommended"];

// Same split as ClaimWorkflow on the server. A failed hard check means there was no valid cover, so the claim can
// only be rejected; a failed soft check can be approved with a written reason.
const HARD_CHECKS = ["Policy Active", "Waiting Period", "Premiums Paid"];
const SOFT_CHECKS = ["Beneficiary Match", "No Duplicate"];

/** The claims list's audit filter: approved or paid despite failed checks, or without checks. */
export const NEEDS_AUDIT = "Needs audit";

/** The coded gate that kept a claim from straight-through processing (spec 12 C-12), in words. */
export const STP_INELIGIBLE_LABELS = {
  CHECKS_FAILED: "A claim check failed",
  STP_DISABLED: "Straight-through processing is switched off",
  OVER_CEILING: "The payout is over the STP ceiling",
  NO_VERIFIED_PAYOUT: "No verified payout account to pay",
  PRODUCT_OPT_OUT: "The product is opted out of STP",
  CLAIM_LIMIT: "The policy reached its yearly claim limit",
};

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

/** Pass / Fail / Pending (open claim) / Not run (decided claim recorded before the checks) of the five checks. */
export function ClaimChecks({ checks = [] }) {
  return (
    <div className="wf-checks">
      {checks.map((check) => (
        <div className={"wf-check " + (check.result === "Not run" ? "pending" : check.result.toLowerCase())} key={check.name}>
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
  const closed = ["Paid", "Rejected"].includes(claim.status);
  // Superseded documents are kept (Blueprint §8) but no longer count as issued.
  const current = (claim.documents || []).filter((d) => d.status !== "SUPERSEDED");
  const issued = current.some((d) => d.type === "Claim summary");
  const interimIssued = current.some((d) => d.type === "Interim claim summary");
  // An open claim gets an interim summary (re-issuing replaces it); a closed one gets its final summary, once.
  const generate = closed
    ? {
        slug: "summary",
        label: "Issue claim summary",
        hint: "A one-time PDF recording the claim as decided: checks, decision, payment, documents and timeline."
          + (interimIssued ? " It supersedes the interim summary, which is kept." : ""),
        done: "Claim summary issued.",
        blocked: issued ? "This claim's summary has been issued. A summary is issued once per claim." : null,
        hideWhenBlocked: issued,
      }
    : {
        slug: "summary",
        label: interimIssued ? "Update interim summary" : "Issue interim summary",
        hint:
          "A PDF of the claim so far, marked as not yet decided."
          + (interimIssued ? " Updating supersedes the current interim summary; the earlier one is kept." : "")
          + " The final summary is issued once the claim is paid or rejected.",
        done: interimIssued ? "Interim summary updated." : "Interim summary issued.",
        blocked: null,
      };
  return (
    <DocumentsPanel
      record={claim}
      open={!closed}
      generate={generate}
      {...props}
    />
  );
}

/**
 * Documents filed on one policy: its policy schedule, viewed and downloaded like claim documents. The schedule is
 * issued once per policy, after the first premium starts cover; a new or renewed policy gets its own.
 */
export function PolicyDocuments({ policy, ...props }) {
  const issued = (policy.documents || []).some((d) => d.type === "Policy schedule" && d.status !== "SUPERSEDED");
  return (
    <DocumentsPanel
      record={policy}
      open={false}
      canUpload={false}
      generate={{
        slug: "schedule",
        label: "Issue policy schedule",
        hint: "A one-time PDF setting out this policy's cover, premium, covered lives, beneficiaries and terms.",
        done: "Policy schedule issued.",
        blocked: issued
          ? "This policy's schedule has been issued. A schedule is issued once per policy; a new or renewed policy gets its own."
          : !policy.coverStartDate
            ? "The policy schedule can be issued once the first premium is paid and cover starts."
            : null,
        hideWhenBlocked: issued,
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
  const [reissuing, setReissuing] = useState(null);
  const [reason, setReason] = useState("");
  // Staff may reissue the current policy schedule with a reason (Blueprint §8); the old one is kept as superseded.
  const mayReissue = (doc) =>
    canGenerate && !basePath.includes("/shop/") && doc.type === "Policy schedule" && doc.status !== "SUPERSEDED";
  const byId = new Map(documents.map((d) => [d.id, d]));

  const reissue = async (doc) => {
    if (reason.trim().length < 5) return;
    setBusy(true);
    try {
      const result = await request(session, basePath + "/" + doc.id + "/reissue", {
        method: "POST",
        body: { reason: reason.trim() },
      });
      onUploaded(result.data);
      notify("Schedule reissued. The earlier one is kept as superseded.");
      setReissuing(null);
      setReason("");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

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
      notify(error.message, "error");
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
      notify(error.message, "error");
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
      notify(error.message, "error");
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
      notify(error.message, "error");
    }
  };

  return (
    <div className="wf-docs">
      {canGenerate && !(generate.blocked && generate.hideWhenBlocked) && (
        <div className="wf-doc-generate">
          <Btn variant="secondary" icon={FileText} disabled={busy || !!generate.blocked} onClick={runGenerate}>
            {generate.label}
          </Btn>
          <small className="muted">{generate.blocked || generate.hint}</small>
        </div>
      )}
      {generate.blocked && generate.hideWhenBlocked && <p className="muted small">{generate.blocked}</p>}
      {documents.length === 0 ? (
        <p className="muted small">No documents on file yet.</p>
      ) : (
        <ul className="wf-doc-list">
          {documents.map((doc) => (
            <li key={doc.id} className={doc.status === "SUPERSEDED" ? "wf-doc-superseded" : undefined}>
              <FileText size={18} aria-hidden="true" />
              <div>
                <strong>
                  {doc.type}
                  {doc.status === "SUPERSEDED" && <em className="wf-tag">Superseded</em>}
                </strong>
                <small>
                  {doc.fileName} · {fileSize(doc.size)} · {doc.uploadedBy}, {formatDate(doc.uploadedAt)}
                  {doc.sha256 && (
                    <span title={"SHA-256 " + doc.sha256}> · SHA-256 {doc.sha256.slice(0, 12)}…</span>
                  )}
                </small>
                {doc.status === "SUPERSEDED" && (
                  <small className="wf-doc-reason">
                    Replaced{doc.supersededBy && byId.get(doc.supersededBy) ? " by " + byId.get(doc.supersededBy).fileName : ""}
                    {doc.supersededReason ? ": " + doc.supersededReason : ""}
                  </small>
                )}
                {reissuing === doc.id && (
                  <span className="wf-doc-reissue">
                    <input
                      className="input"
                      value={reason}
                      maxLength={500}
                      placeholder="Reason for the replacement, e.g. beneficiary name corrected"
                      aria-label="Reason for reissuing"
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <Btn disabled={busy || reason.trim().length < 5} onClick={() => reissue(doc)}>
                      {busy ? "Reissuing…" : "Reissue"}
                    </Btn>
                    <Btn variant="secondary" onClick={() => setReissuing(null)}>
                      Cancel
                    </Btn>
                  </span>
                )}
              </div>
              <span className="wf-doc-actions">
                <Btn variant="secondary" icon={Eye} onClick={() => view(doc)} aria-label={"View " + doc.fileName}>
                  View
                </Btn>
                <Btn variant="secondary" icon={Download} onClick={() => download(doc)} aria-label={"Download " + doc.fileName}>
                  Download
                </Btn>
                {mayReissue(doc) && reissuing !== doc.id && (
                  <Btn variant="secondary" icon={FileText} onClick={() => { setReissuing(doc.id); setReason(""); }}>
                    Reissue
                  </Btn>
                )}
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

/** Choose a payment method and pay. `hint(method)` may add a line under the button (e.g. "you'll leave this page"). */
export function PayForm({ label = "Pay now", onPay, busy, hint }) {
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const note = hint?.(method);
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
      {note && <small className="muted small wf-pay-hint">{note}</small>}
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
      if (done) notify(done, "success");
      return result;
    } catch (error) {
      notify(error.message, "error");
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
  const confirm = useConfirm();
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
          <p>
            The premium is overdue. Cover ends on {formatDate(p.gracePeriodEnd)} unless it is paid; the policy then
            stays in force without cover for {NO_COVER_MONTHS} months before it lapses.
          </p>
        </div>
      )}
      {p.status === NO_COVER && (
        <div className="notice wf-warn">
          <ShieldAlert size={18} aria-hidden="true" />
          <p>
            <strong>In force, no cover.</strong> The grace period ended with the premium due{" "}
            {formatDate(p.nextPremiumDue) || "on the due date"} unpaid, so no claim event is covered for now. A premium
            collected restores cover from that day with no new waiting period
            {noCoverLapsesOn(p) ? "; unpaid, the policy lapses after " + formatDate(noCoverLapsesOn(p)) : ""}.
          </p>
        </div>
      )}
      {p.status === "Claimed" && (
        <div className="notice">
          <CircleCheck size={18} aria-hidden="true" />
          <p>This policy ended when a claim on it was paid. It can no longer be paid or changed.</p>
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
      <h3 className="section-title">Beneficiaries · {p.beneficiaries?.length || 0} of {p.maxBeneficiaries || 5}</h3>
      <BeneficiaryList
        beneficiaries={p.beneficiaries}
        busy={busy}
        onRemove={
          canManage && BENEFICIARY_STATES.includes(p.status)
            ? async (b) => {
                const ok = await confirm({
                  title: "Remove " + b.fullName + "?",
                  message: b.fullName + " will no longer be paid from policy " + p.id + ".",
                  confirmLabel: "Remove beneficiary",
                  tone: "danger",
                });
                if (ok) call("/beneficiaries/" + b.id, { method: "DELETE" }, b.fullName + " removed.");
              }
            : null
        }
      />
      {canManage && BENEFICIARY_STATES.includes(p.status) && (p.beneficiaries?.length || 0) < (p.maxBeneficiaries || 5) && (
        <BeneficiaryForm
          busy={busy}
          onSave={(body) => call("/beneficiaries", { method: "POST", body }, "Beneficiary added.")}
        />
      )}
      {canManage && (PAYABLE_STATES.includes(p.status) || CANCELLABLE_STATES.includes(p.status)) && (
        <>
          <h3 className="section-title">
            {p.status === "Pending Payment"
              ? "Collect the first premium"
              : p.status === NO_COVER
                ? "Record a premium to restore cover"
                : "Record a premium"}
          </h3>
          <p className="muted small">
            {p.status === "Pending Payment"
              ? "The policy goes Active with cover from today."
              : p.status === NO_COVER
                ? "The policy goes back to Active with cover from today and no new waiting period."
                : "Moves the next due date on by one premium period."}{" "}
            Premium {money(p.premium)}.
          </p>
          <div className="detail-actions">
            {PAYABLE_STATES.includes(p.status) && (
              <PayForm
                busy={busy}
                label="Record payment"
                onPay={(method) =>
                  call("/payments", { method: "POST", body: { method } }, "Payment recorded for " + p.id + ".")
                }
              />
            )}
            {CANCELLABLE_STATES.includes(p.status) && (
              <ReasonAction
                label="Cancel policy"
                busy={busy}
                placeholder={
                  p.status === "Pending Payment"
                    ? "Reason (the customer is told why)"
                    : "Reason, e.g. the policyholder's written request of 12 Nov (the customer is told why)"
                }
                onConfirm={(reason) =>
                  call("/cancel", { method: "POST", body: { reason } }, p.id + " is cancelled.")
                }
              />
            )}
          </div>
          {CANCELLABLE_STATES.includes(p.status) && p.status !== "Pending Payment" && (
            <p className="muted small">
              Cancelling an in-force policy needs the policyholder's written request. Within 30 days of the policy
              start it is a cooling-off cancellation and the premiums are refundable.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** Staff view of a claim's workflow: checks, payee, and the assess / approve / reject / pay actions. */
export function ClaimWorkflowPanel({ session, claim: c, profile, onUpdated, notify }) {
  const [busy, run] = useAction(notify);
  const confirm = useConfirm();
  const [editPayee, setEditPayee] = useState(false);
  const [payout, setPayout] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [fourEyesReason, setFourEyesReason] = useState("");
  const [approveError, setApproveError] = useState("");
  const open = OPEN_CLAIM.includes(c.status);
  // Legal from the claim's state (the server's list); whether this user may take it is the permission check below.
  const can = (action) => c.actions?.includes(action);
  // Four-eyes: whoever assessed the claim may not also approve its payout, unless they hold the break-glass
  // OVERRIDE_CLAIM_FOUR_EYES and write down why (the reason is kept on the claim and in the controls register).
  const assessedByMe = Boolean(c.recommendedBy) && c.recommendedBy === profile?.username;
  const breakGlass = assessedByMe && holds(profile, "OVERRIDE_CLAIM_FOUR_EYES");
  const mayApprove = can("approve") && holds(profile, "APPROVE_CLAIM") && (!assessedByMe || breakGlass);
  const stpLabel = c.stpIneligibleCode ? STP_INELIGIBLE_LABELS[c.stpIneligibleCode] || c.stpIneligibleCode : null;
  const result = (name) => c.checks?.find((check) => check.name === name)?.result;
  const hardFailed = HARD_CHECKS.filter((name) => result(name) === "Fail");
  const notChecked = HARD_CHECKS.some((name) => result(name) === "Pending");
  const softFailed = SOFT_CHECKS.filter((name) => result(name) === "Fail");
  // Why the claim cannot move towards payout; the server refuses the same cases.
  const blocked = hardFailed.length
    ? hardFailed.join(", ") + " failed, so there was no valid cover for this event. This claim can only be rejected."
    : notChecked
      ? "The checks have not run on this claim. Re-run the checks before it can be assessed or approved."
      : null;
  const call = (path, options, done) =>
    run(async () => {
      const result = await request(session, "/portfolio/claims/" + c.id + path, options);
      onUpdated(result.data);
      return result.data;
    }, done);
  const payee = c.payee || {};
  const payeeComplete = payee.name && payee.payoutMethod && payee.accountRef;
  const canEditPayee = open && (holds(profile, "UPDATE_CLAIM") || holds(profile, "ASSESS_CLAIM"));
  const approve = async () => {
    const amount = payout ? Number(payout) : c.amount;
    const ok = await confirm({
      title: "Approve " + c.id + "?",
      message: (
        <>
          Approve a payout of <strong>{money(amount)}</strong>
          {amount < c.amount ? " (partial, cover " + money(c.amount) + ")" : ""} to {payee.name || "the payee"}.
          {breakGlass
            ? " You assessed this claim, so this is a break-glass four-eyes override, recorded on the claim with your reason."
            : ""}
        </>
      ),
      confirmLabel: breakGlass ? "Override and approve" : "Approve payout",
      tone: breakGlass ? "danger" : undefined,
    });
    if (!ok) return;
    setApproveError("");
    await run(async () => {
      try {
        const result = await request(session, "/portfolio/claims/" + c.id + "/approve", {
          method: "POST",
          body: {
            ...(payout ? { payoutAmount: Number(payout) } : {}),
            ...(softFailed.length ? { overrideReason: overrideReason.trim() } : {}),
            ...(breakGlass ? { fourEyesOverrideReason: fourEyesReason.trim() } : {}),
          },
        });
        onUpdated(result.data);
        return result.data;
      } catch (error) {
        // An approval limit or four-eyes refusal (403) says who may approve instead; keep it next to the button.
        setApproveError(error.message);
        throw error;
      }
    }, c.id + " is approved.");
  };
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
      {c.auditFlag && (
        <div className="notice wf-alert">
          <CircleX size={18} aria-hidden="true" />
          <p>
            <strong>Needs audit.</strong> {c.auditFlag}. This claim went through before these checks blocked
            approval; review whether the payout was due.
          </p>
        </div>
      )}
      <h3 className="section-title">Checks</h3>
      <ClaimChecks checks={c.checks} />
      <p className="muted small">
        All five passing pays the claim straight through. If Policy Active, Waiting Period or Premiums Paid fails,
        the claim can only be rejected; if Beneficiary Match or No Duplicate fails, it can be approved with a reason.
      </p>
      {(stpLabel || c.stpIneligibleReason) && (
        <p className="muted small">
          Not straight-through: <strong>{stpLabel || c.stpIneligibleReason}</strong>
          {stpLabel && c.stpIneligibleReason && c.stpIneligibleReason !== stpLabel ? " (" + c.stpIneligibleReason + ")" : ""}.
        </p>
      )}
      {c.checks?.every((check) => check.result === "Not run") && (
        <p className="muted small">
          The checks never ran on this claim: it was recorded before the claim checks existed
          {[!c.eventDate && "no date of the event", !c.policy && "no linked policy"].filter(Boolean).length
            ? ", with " +
              [!c.eventDate && "no date of the event", !c.policy && "no linked policy"].filter(Boolean).join(" and ")
            : ""}
          , so there is nothing to check it against.
        </p>
      )}
      {open && blocked && (
        <div className="notice wf-alert">
          <CircleX size={18} aria-hidden="true" />
          <p>{blocked} If the policy or claim details were wrong, correct them and re-run the checks.</p>
        </div>
      )}

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
              ? c.fourEyesOverrideReason
                ? " · four-eyes overridden (break-glass)"
                : " · four-eyes control was off"
              : ""}
        </p>
      )}
      {c.fourEyesOverrideReason && (
        <div className="notice wf-alert">
          <ShieldAlert size={18} aria-hidden="true" />
          <p>
            <strong>Four-eyes override.</strong> {c.adjudicatedBy || "The approver"} approved a claim they assessed
            themselves: {c.fourEyesOverrideReason}
          </p>
        </div>
      )}
      {c.checkOverrideReason && (
        <p className="muted small">
          Approved although {softFailed.join(" and ") || "a check"} failed: {c.checkOverrideReason}
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
        {open && holds(profile, "UPDATE_CLAIM") && (
          <Btn variant="secondary" icon={RotateCcw} disabled={busy} onClick={() => call("/checks", { method: "POST" }, "Checks re-run.")}>
            Re-run checks
          </Btn>
        )}
        {can("assess") && holds(profile, "ASSESS_CLAIM") && (
          <Btn
            icon={BadgeCheck}
            disabled={busy || !payeeComplete || !!blocked}
            title={blocked || (payeeComplete ? undefined : "Add the payee first")}
            onClick={() => call("/assess", { method: "POST", body: {} }, c.id + " is recommended for approval.")}
          >
            Assess &amp; recommend
          </Btn>
        )}
        {mayApprove && !blocked && softFailed.length > 0 && (
          <label className="form-label wf-override">
            <span>Reason for approving although {softFailed.join(" and ")} failed</span>
            <textarea
              className="input"
              rows={2}
              maxLength={500}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="e.g. Payee verified against the death certificate"
            />
          </label>
        )}
        {mayApprove && breakGlass && !blocked && (
          <label className="form-label wf-override wf-break-glass">
            <span>Break-glass override — reason (recorded on the claim)</span>
            <textarea
              className="input"
              rows={2}
              maxLength={500}
              value={fourEyesReason}
              onChange={(e) => setFourEyesReason(e.target.value)}
              placeholder="e.g. Sole approver on duty; second approver unavailable until Monday"
            />
          </label>
        )}
        {mayApprove && (
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
              disabled={
                busy ||
                !!blocked ||
                (softFailed.length > 0 && !overrideReason.trim()) ||
                (breakGlass && !fourEyesReason.trim())
              }
              title={
                blocked ||
                (softFailed.length > 0 && !overrideReason.trim()
                  ? "Enter the reason for approving first"
                  : breakGlass && !fourEyesReason.trim()
                    ? "Enter the break-glass override reason first"
                    : undefined)
              }
              onClick={approve}
            >
              {breakGlass ? "Override and approve" : "Approve"}
            </Btn>
          </span>
        )}
        {can("pay") && holds(profile, "SETTLE_CLAIM") && (
          <Btn
            icon={Wallet}
            disabled={busy}
            onClick={async () => {
              const ok = await confirm({
                title: "Pay out " + money(c.payoutAmount) + "?",
                message: (
                  <>
                    Sends {money(c.payoutAmount)} to <strong>{payee.name}</strong> by {payee.payoutMethod}{" "}
                    {payee.accountRef}. A payout cannot be recalled from here.
                  </>
                ),
                confirmLabel: "Send payout",
              });
              if (ok) call("/pay", { method: "POST" }, "Payout sent for " + c.id + ".");
            }}
          >
            Pay out {money(c.payoutAmount)}
          </Btn>
        )}
        {can("reject") && holds(profile, "REJECT_CLAIM") && (
          <ReasonAction
            label="Reject"
            busy={busy}
            onConfirm={(reason) => call("/reject", { method: "POST", body: { reason } }, c.id + " is rejected.")}
          />
        )}
      </div>
      {approveError && (
        <p className="form-error" role="alert">
          {approveError}
        </p>
      )}
      {c.status === "Recommended" && assessedByMe && (
        <p className="muted small">
          {breakGlass
            ? "You assessed this claim. You hold the break-glass authority, so you may approve it only with a written reason; it is recorded on the claim and in the four-eyes register."
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
