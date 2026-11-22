import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { fetchFile, newIdempotencyKey, request, uploadFile } from "./api";
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

export const CLAIM_STATES = [
  "Initiated",
  "Under Review",
  "Recommended",
  "Approved",
  "Payout Sent",
  "Payout Failed",
  "Rejected",
  "Paid",
];

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
  OVER_LIMIT: "The payout is more than what is left of the benefit limit",
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
  const hasSchedule = (documents) =>
    (documents || []).some((d) => d.type === "Policy schedule" && d.status !== "SUPERSEDED");
  const issued = hasSchedule(policy.documents);
  return (
    <DocumentsPanel
      record={policy}
      open={false}
      canUpload={false}
      // The schedule is filed by an event a few seconds after the first premium starts cover; until it arrives the
      // panel says it is being prepared and looks again, rather than offering to issue a second one.
      waitFor={(documents) => Boolean(policy.coverStartDate) && !hasSchedule(documents)}
      waitingText="Preparing the policy schedule…"
      // SH09A template preview: the schedule as it would be issued now, marked as a preview and never filed.
      previewSlug="schedule/preview"
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

const WAIT_TRIES = 8;
const WAIT_MS = 2000;
const sameDocuments = (a, b) =>
  a.length === b.length &&
  a.every((doc, i) => doc.id === b[i]?.id && doc.uploadId === b[i]?.uploadId && doc.status === b[i]?.status);
// AT-SH09A-02: an upload waits in quarantine until a reviewer releases it. Until then it has no document id: it cannot
// be opened here and does not count as evidence. A refused upload stays listed with the reason.
const HELD = ["QUARANTINED", "REJECTED"];
const isHeld = (doc) => HELD.includes(doc.status);
const docKey = (doc) => (doc.id != null ? "d" + doc.id : "u" + doc.uploadId);

function DocumentsPanel({
  session,
  record,
  open,
  generate,
  basePath,
  canUpload,
  canGenerate,
  onUploaded,
  notify,
  waitFor,
  waitingText,
  previewSlug,
}) {
  const documents = record.documents || [];
  const [type, setType] = useState(DOCUMENT_TYPES[0]);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const [reissuing, setReissuing] = useState(null);
  const [reason, setReason] = useState("");
  const [waiting, setWaiting] = useState(false);
  // The record in the open dialog can be older than the server's list (documents filed by an event after a payment,
  // or by another user), so the staff view reads the list again when it opens. The customer portal (/shop/) has no
  // list endpoint; its page is refreshed as a whole.
  const listable = !basePath.includes("/shop/");
  const latest = useRef({ documents, onUploaded, waitFor });
  latest.current = { documents, onUploaded, waitFor };
  const reload = useCallback(async () => {
    const { data } = await request(session, basePath);
    if (!sameDocuments(data, latest.current.documents)) latest.current.onUploaded(data);
    return data;
  }, [session, basePath]);
  useEffect(() => {
    if (!listable) return undefined;
    let active = true;
    let timer = null;
    let tries = 0;
    const look = async () => {
      try {
        const data = await reload();
        if (!active) return;
        tries += 1;
        const pending = Boolean(latest.current.waitFor?.(data)) && tries < WAIT_TRIES;
        setWaiting(pending);
        if (pending) timer = setTimeout(look, WAIT_MS);
      } catch {
        if (active) setWaiting(false);
      }
    };
    look();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [listable, reload, record.status, record.coverStartDate]);
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
      notify(file.name + " uploaded. It is checked before it can be opened or count as evidence.");
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
      // 409: it was issued meanwhile (automatically, or by someone else). Show it rather than an error.
      if (error.status === 409 && listable) {
        await reload().catch(() => {});
        notify(error.message, "info");
      } else {
        notify(error.message, "error");
      }
    } finally {
      setBusy(false);
    }
  };

  // The tab opens on the click itself so the popup blocker allows it; the file arrives a moment later.
  const view = async (doc, path = basePath + "/" + doc.id) => {
    const tab = window.open("", "_blank");
    try {
      const url = URL.createObjectURL(await fetchFile(session, path));
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
      {waiting && (
        <p className="muted small" role="status">
          {waitingText || "Loading documents…"}
        </p>
      )}
      {canGenerate && !waiting && !(generate.blocked && generate.hideWhenBlocked) && (
        <div className="wf-doc-generate">
          <Btn variant="secondary" icon={FileText} disabled={busy || !!generate.blocked} onClick={runGenerate}>
            {generate.label}
          </Btn>
          <small className="muted">{generate.blocked || generate.hint}</small>
        </div>
      )}
      {canGenerate && previewSlug && listable && (
        <div className="wf-doc-generate">
          <Btn variant="secondary" icon={Eye} onClick={() => view(null, basePath + "/" + previewSlug)}>
            Preview
          </Btn>
          <small className="muted">The schedule as it would be issued now, from today's data and wording. Not filed.</small>
        </div>
      )}
      {generate.blocked && generate.hideWhenBlocked && <p className="muted small">{generate.blocked}</p>}
      {documents.length === 0 ? (
        <p className="muted small">No documents on file yet.</p>
      ) : (
        <ul className="wf-doc-list">
          {documents.map((doc) => (
            <li
              key={docKey(doc)}
              className={doc.status === "SUPERSEDED" || doc.status === "REJECTED" ? "wf-doc-superseded" : undefined}
            >
              <FileText size={18} aria-hidden="true" />
              <div>
                <strong>
                  {doc.type}
                  {doc.status === "SUPERSEDED" && <em className="wf-tag">Superseded</em>}
                  {doc.status === "QUARANTINED" && <em className="wf-tag is-held">Being checked</em>}
                  {doc.status === "REJECTED" && <em className="wf-tag is-refused">Not accepted</em>}
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
                {doc.note && <small className="wf-doc-reason">{doc.note}</small>}
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
                {!isHeld(doc) && (
                  <>
                    <Btn variant="secondary" icon={Eye} onClick={() => view(doc)} aria-label={"View " + doc.fileName}>
                      View
                    </Btn>
                    <Btn
                      variant="secondary"
                      icon={Download}
                      onClick={() => download(doc)}
                      aria-label={"Download " + doc.fileName}
                    >
                      Download
                    </Btn>
                  </>
                )}
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
          <small className="muted">
            PDF, JPG or PNG, up to 10 MB. Each file is checked before it can be opened or count as evidence.
          </small>
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
export function PolicyWorkflowPanel({ session, policy: p, canManage, onUpdated, notify, profile }) {
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
      <BillingAccount session={session} policy={p} profile={profile} notify={notify} onChanged={onUpdated} />
    </div>
  );
}

/**
 * The policy's billing account (NS-SH04-001/004): its due schedule, what was applied to each instalment, the
 * receipts, paid-to date and arrears. Finance can record a returned or charged-back receipt, which reopens the
 * period and starts a cover review (AT-SH04-02).
 */
function BillingAccount({ session, policy: p, profile, notify, onChanged }) {
  const [account, setAccount] = useState(null);
  const [error, setError] = useState("");
  const [busy, run] = useAction(notify);
  const [reversing, setReversing] = useState(null);
  const load = React.useCallback(async () => {
    try {
      setAccount((await request(session, "/collections/policies/" + p.id)).data);
      setError("");
    } catch (err) {
      setError(err.status === 403 ? "" : err.message);
    }
  }, [session, p.id]);
  useEffect(() => {
    load();
  }, [load, p.status, p.nextPremiumDue]);
  if (!account) return error ? <p className="form-error">{error}</p> : null;
  const reverse = (receipt, kind, reason) =>
    run(async () => {
      const result = await request(session, "/collections/receipts/" + receipt.receiptRef + "/reverse", {
        method: "POST",
        body: { kind, reason },
      });
      setReversing(null);
      await load();
      const fresh = await request(session, "/portfolio/policies");
      const updated = (fresh.data || []).find((x) => x.id === p.id);
      if (updated) onChanged(updated);
      return result.data;
    }, "Reversal of " + receipt.receiptRef + " sent for approval by a second person (Finance > Billing).");
  const mayReverse = holds(profile, "MANAGE_FINANCE");
  return (
    <div className="wf-billing">
      <h3 className="section-title">Billing</h3>
      <div className="detail-grid">
        <Item label="Paid to" value={account.paidTo ? formatDate(account.paidTo) : "Not yet paid"} />
        <Item label="Next due" value={formatDate(account.nextDue)} />
        <Item
          label="Arrears"
          value={
            Number(account.arrears) > 0
              ? money(account.arrears) + " (" + account.overdueInstalments + " overdue)"
              : "None"
          }
        />
        <Item label="Instalments issued" value={String(account.instalments.length)} />
      </div>
      {account.unresolvedPayments.length > 0 && (
        <div className="notice">
          <Clock3 size={18} aria-hidden="true" />
          <p>
            Waiting on money that may still arrive: {account.unresolvedPayments.join("; ")}. Cover decisions wait until
            it is resolved.
          </p>
        </div>
      )}
      {account.instalments.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Instalment</th>
                <th>Period</th>
                <th className="num">Billed</th>
                <th className="num">Applied</th>
                <th className="num">Outstanding</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {account.instalments.map((i) => (
                <tr key={i.ref}>
                  <td>{i.ref}</td>
                  <td>
                    {formatDate(i.periodStart)} – {formatDate(i.periodEnd)}
                  </td>
                  <td className="num">
                    {money(i.billed)}
                    {Number(i.adjustments) !== 0 && <small className="ws-hint"> adj. {money(i.adjustments)}</small>}
                  </td>
                  <td className="num">{money(i.allocated)}</td>
                  <td className="num">{money(i.outstanding)}</td>
                  <td>
                    <span className={"badge " + (i.status === "PAID" ? "green" : i.status === "WAIVED" ? "gray" : "amber")}>
                      <span className="status-dot" />
                      {i.status.replace("_", " ").toLowerCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {account.receipts.length > 0 && (
        <div className="wf-receipts">
          {account.receipts.map((r) => (
            <div key={r.receiptRef} className="linked-record">
              <Wallet aria-hidden="true" />
              <div>
                <strong>
                  {r.receiptRef} · {money(r.amount)} by {r.method}
                </strong>
                <small>
                  {formatDate(r.periodStart)} – {formatDate(r.periodEnd)} · {formatDate(r.paidAt)}
                  {r.reversalRef ? " · " + r.reversalKind.toLowerCase() + " (" + r.reversalRef + "): " + r.reversalReason : ""}
                </small>
              </div>
              {r.status === "SUCCESSFUL" && mayReverse && reversing !== r.receiptRef && (
                <Btn variant="secondary" disabled={busy} onClick={() => setReversing(r.receiptRef)}>
                  Record a return
                </Btn>
              )}
              {r.status !== "SUCCESSFUL" && (
                <span className="badge red">
                  <span className="status-dot" />
                  Reversed
                </span>
              )}
            </div>
          ))}
          {reversing && (
            <ReturnForm
              receipt={account.receipts.find((r) => r.receiptRef === reversing)}
              busy={busy}
              onCancel={() => setReversing(null)}
              onConfirm={reverse}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Why the bank took a receipt back. The receipt is kept; the period reopens and cover is reviewed. */
function ReturnForm({ receipt, busy, onCancel, onConfirm }) {
  const [kind, setKind] = useState("RETURNED");
  const [reason, setReason] = useState("");
  return (
    <div className="wf-reason">
      <label className="form-label">
        <span>What happened to {receipt.receiptRef}</span>
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="RETURNED">Returned by the bank (e.g. unpaid debit)</option>
          <option value="CHARGEBACK">Charged back by the payer</option>
          <option value="REVERSED">Reversed in error</option>
        </select>
      </label>
      <textarea
        className="textarea"
        rows={2}
        maxLength={500}
        placeholder="Reason, e.g. Debit returned: insufficient funds (bank ref 4471)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="detail-actions">
        <Btn variant="secondary" onClick={onCancel}>
          Back
        </Btn>
        <Btn icon={CircleX} disabled={busy || reason.trim().length < 10} onClick={() => onConfirm(receipt, kind, reason.trim())}>
          Record the return
        </Btn>
      </div>
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
  const [evidenceReason, setEvidenceReason] = useState("");
  const [closing, setClosing] = useState(null);
  const [approveError, setApproveError] = useState("");
  // Reserve history, benefit limits and decisions (GET .../financials), for the approval summary and the panel.
  const [financials, setFinancials] = useState(null);
  useEffect(() => {
    let active = true;
    request(session, "/portfolio/claims/" + encodeURIComponent(c.id) + "/financials")
      .then((r) => active && setFinancials(r.data))
      .catch(() => active && setFinancials(null));
    return () => {
      active = false;
    };
  }, [session, c.id, c.version]);
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
  // NS-SH05-003: mandatory evidence still outstanding does not block the claim, but approving it needs a reason.
  const missingEvidence = (c.evidence || []).filter((e) => e.mandatory && !e.received).map((e) => e.documentType);
  // Why the claim cannot move towards payout; the server refuses the same cases.
  const blocked = hardFailed.length
    ? hardFailed.join(", ") + " failed, so there was no valid cover for this event. This claim can only be rejected."
    : notChecked
      ? "The checks have not run on this claim. Re-run the checks before it can be assessed or approved."
      : null;
  const call = (path, options, done) =>
    run(async () => {
      // Acts on the version on screen; if someone else changed the claim meanwhile the server refuses it (409).
      const result = await request(session, "/portfolio/claims/" + c.id + path, { ...options, version: c.version });
      onUpdated(result.data);
      return result.data;
    }, done);
  const payee = c.payee || {};
  const payeeComplete = payee.name && payee.payoutMethod && payee.accountRef;
  // A failed payout is corrected (and re-verified) before it is sent again.
  const canEditPayee =
    (open || c.status === "Payout Failed") && (holds(profile, "UPDATE_CLAIM") || holds(profile, "ASSESS_CLAIM"));
  const approve = async () => {
    const amount = payout ? Number(payout) : c.amount;
    const ok = await confirm({
      title: "Approve " + c.id + "?",
      message: (
        <ApprovalSummary
          claim={c}
          amount={amount}
          financials={financials}
          softFailed={softFailed}
          overrideReason={overrideReason.trim()}
          missingEvidence={missingEvidence}
          evidenceReason={evidenceReason.trim()}
          breakGlass={breakGlass}
          fourEyesReason={fourEyesReason.trim()}
        />
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
          version: c.version,
          idempotencyKey: newIdempotencyKey(),
          body: {
            ...(payout ? { payoutAmount: Number(payout) } : {}),
            ...(softFailed.length ? { overrideReason: overrideReason.trim() } : {}),
            ...(breakGlass ? { fourEyesOverrideReason: fourEyesReason.trim() } : {}),
            ...(missingEvidence.length ? { evidenceOverrideReason: evidenceReason.trim() } : {}),
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
        <Item label="Covered life" value={c.coveredLife} />
        <Item label="Claimant" value={c.claimant + (c.claimantRelationship ? " (" + c.claimantRelationship + ")" : "")} />
        <Item label="Date of event" value={formatDate(c.eventDate)} />
        <Item label="Processing" value={c.processingType} />
        <Item label="Policy cover" value={money(c.amount)} />
        <Item
          label="Payout"
          value={
            c.payoutAmount != null
              ? money(c.payoutAmount) + (Number(c.payoutAmount) < Number(c.amount) ? " · partially approved" : "")
              : "Not decided"
          }
        />
        <Item label="Case reserve" value={money(c.reserve)} />
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
      {c.evidence?.length > 0 && (
        <>
          <h3 className="section-title">Evidence</h3>
          <ul className="wf-evidence">
            {c.evidence.map((e) => (
              <li key={e.documentType} className={e.received ? "received" : e.mandatory ? "missing" : "optional"}>
                {e.received ? <BadgeCheck size={15} aria-hidden="true" /> : <Clock3 size={15} aria-hidden="true" />}
                {e.documentType}
                <small>{e.received ? "on file" : e.mandatory ? "required, not yet on file" : "optional"}</small>
              </li>
            ))}
          </ul>
        </>
      )}
      {c.related?.length > 0 && (
        <>
          <h3 className="section-title">Other claims on this policy</h3>
          <ul className="wf-evidence">
            {c.related.map((r) => (
              <li key={r.ref} className={r.possibleDuplicate ? "missing" : "optional"}>
                {[r.ref, r.type, r.coveredLife, r.eventDate ? "event " + formatDate(r.eventDate) : "event date not recorded", r.status]
                  .filter(Boolean)
                  .join(" · ")}
                {r.possibleDuplicate && <small>possibly the same event</small>}
              </li>
            ))}
          </ul>
        </>
      )}
      {financials && <ClaimCalculation claim={c} financials={financials} profile={profile} />}
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
      {open && missingEvidence.length > 0 && (
        <div className="notice wf-alert" role="status">
          <ShieldAlert size={18} aria-hidden="true" />
          <p>
            <strong>Required evidence not yet on file:</strong> {missingEvidence.join(", ")}. The claim can still be
            assessed; approving it before the evidence arrives needs a reason, which is kept with the claim.
          </p>
        </div>
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
      {c.evidenceOverrideReason && (
        <p className="muted small">
          Approved before the required evidence was on file: {c.evidenceOverrideReason}
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
      {c.closedAt && (
        <div className="notice">
          <CircleCheck size={18} aria-hidden="true" />
          <p>
            Closed on {formatDate(c.closedAt)} by {c.closedBy}
            {c.closeNote ? ": " + c.closeNote : ""}. The settlement and its financial tasks are complete.
          </p>
        </div>
      )}
      {c.status === "Payout Sent" && (
        <div className="notice">
          <Clock3 size={18} aria-hidden="true" />
          <p>
            {money(c.payoutAmount)} sent to {payee.name} · {c.payoutReference}. It counts as paid once the provider
            confirms settlement.
          </p>
        </div>
      )}
      {c.status === "Payout Failed" && (
        <div className="notice">
          <CircleX size={18} aria-hidden="true" />
          <p>
            Payout {c.payoutReference} failed or was returned. Correct and verify the payee's details, then send it
            again. The claim history records the provider's reason.
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
            title={
              blocked ||
              (payeeComplete
                ? missingEvidence.length
                  ? "Required evidence outstanding: " + missingEvidence.join(", ")
                  : undefined
                : "Add the payee first")
            }
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
        {mayApprove && !blocked && missingEvidence.length > 0 && (
          <label className="form-label wf-override">
            <span>Reason for approving without {missingEvidence.join(", ")} (kept with the claim)</span>
            <textarea
              className="input"
              rows={2}
              maxLength={500}
              value={evidenceReason}
              onChange={(e) => setEvidenceReason(e.target.value)}
              placeholder="e.g. Original certificate seen at the branch; certified copy to follow"
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
              min="0.01"
              step="0.01"
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
                (missingEvidence.length > 0 && !evidenceReason.trim()) ||
                (breakGlass && !fourEyesReason.trim())
              }
              title={
                blocked ||
                (softFailed.length > 0 && !overrideReason.trim()
                  ? "Enter the reason for approving first"
                  : missingEvidence.length > 0 && !evidenceReason.trim()
                    ? "Enter the reason for approving without the required evidence first"
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
                title: (c.status === "Payout Failed" ? "Send again: " : "Pay out ") + money(c.payoutAmount) + "?",
                message: (
                  <>
                    Sends {money(c.payoutAmount)} to <strong>{payee.name}</strong> by {payee.payoutMethod}{" "}
                    {payee.accountRef}. The claim is paid once the provider confirms settlement. A payout cannot be
                    recalled from here.
                  </>
                ),
                confirmLabel: "Send payout",
              });
              if (ok)
                call(
                  "/pay",
                  { method: "POST", idempotencyKey: newIdempotencyKey() },
                  "Payout sent for " + c.id + ". Waiting for the provider to confirm settlement.",
                );
            }}
          >
            {c.status === "Payout Failed" ? "Send payout again" : "Pay out " + money(c.payoutAmount)}
          </Btn>
        )}
        {can("confirm-payout") && holds(profile, "SETTLE_CLAIM") && (
          <Btn
            icon={CircleCheck}
            disabled={busy}
            onClick={async () => {
              const ok = await confirm({
                title: "Confirm settlement of " + c.payoutReference + "?",
                message: (
                  <>
                    Only when the provider or bank statement shows {money(c.payoutAmount)} reached{" "}
                    <strong>{payee.name}</strong>. The claim becomes Paid and the payment is posted.
                  </>
                ),
                confirmLabel: "Confirm settlement",
              });
              if (ok)
                call(
                  "/confirm-payout",
                  { method: "POST", body: { providerReference: c.payoutReference }, idempotencyKey: newIdempotencyKey() },
                  c.id + " is paid.",
                );
            }}
          >
            Confirm settlement
          </Btn>
        )}
        {can("payout-failed") && holds(profile, "SETTLE_CLAIM") && (
          <ReasonAction
            label="Payout failed"
            icon={CircleX}
            busy={busy}
            placeholder="What the provider or bank said, e.g. Returned: account closed"
            onConfirm={(reason) =>
              call(
                "/payout-failed",
                { method: "POST", body: { reason } },
                "Payout on " + c.id + " recorded as failed. Verify the payee's details before sending again.",
              )
            }
          />
        )}
        {can("close") && holds(profile, "SETTLE_CLAIM") && !closing && (
          <Btn variant="secondary" icon={CircleCheck} disabled={busy} onClick={() => setClosing({ note: "", retain: false })}>
            Close claim
          </Btn>
        )}
        {closing && (
          <div className="wf-reason">
            <textarea
              className="textarea"
              rows={2}
              maxLength={500}
              placeholder="Note (needed when a reinsurance recovery stays open on its own)"
              value={closing.note}
              onChange={(e) => setClosing({ ...closing, note: e.target.value })}
            />
            <label className="wf-check-label">
              <input
                type="checkbox"
                checked={closing.retain}
                onChange={(e) => setClosing({ ...closing, retain: e.target.checked })}
              />{" "}
              Keep any expected reinsurance recovery open on its own
            </label>
            <div className="detail-actions">
              <Btn variant="secondary" onClick={() => setClosing(null)}>
                Back
              </Btn>
              <Btn
                icon={CircleCheck}
                disabled={busy || (closing.retain && !closing.note.trim())}
                onClick={async () => {
                  const ok = await call(
                    "/close",
                    { method: "POST", body: { note: closing.note.trim(), retainRecovery: closing.retain } },
                    c.id + " is closed.",
                  );
                  if (ok) setClosing(null);
                }}
              >
                Confirm close
              </Btn>
            </div>
          </div>
        )}
        {can("reopen") && holds(profile, "APPROVE_CLAIM") && (
          <ReasonAction
            label={c.status === "Approved" ? "Reopen before payment" : "Reopen"}
            icon={RotateCcw}
            busy={busy}
            placeholder="Why the decision is being reviewed, e.g. the death certificate has now arrived"
            onConfirm={(reason) =>
              call("/reopen", { method: "POST", body: { reason } }, c.id + " is reopened for review.")
            }
          />
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

/**
 * The SH05 claim workspace beside the checks: the cover reconstructed as at the event date, the benefit calculation
 * against the cover and the per-life and policy limits, the case reserve's movements, every decision (including those
 * a reopening set aside) and the reinsurance recoveries on the claim. All from GET /portfolio/claims/{ref}/financials.
 */
function ClaimCalculation({ claim: c, financials: f, profile }) {
  const cover = f.eventCover;
  const left = (limit, used) => (limit == null || used == null ? null : Number(limit) - Number(used));
  const lifeLeft = left(f.lifeLimit, f.lifeUsed);
  const policyLeft = left(f.policyLimit, f.policyUsed);
  // While the claim is open, nothing of it is reserved yet: the most it can be approved for is what is left.
  const open = OPEN_CLAIM.includes(c.status);
  const most = open ? Math.min(Number(c.amount), lifeLeft ?? Infinity, policyLeft ?? Infinity) : null;
  const label = (d) => ({ APPROVED: "Approved", PARTIALLY_APPROVED: "Partially approved", REJECTED: "Declined", REOPENED: "Reopened" })[d] || d;
  return (
    <>
      {cover && (
        <>
          <h3 className="section-title">Cover on the event date</h3>
          <div className="detail-grid">
            <Item label={"Policy on " + formatDate(cover.eventDate)} value={cover.policyStatusOnEventDate + (cover.coverInForce ? " · cover in force" : " · no cover")} />
            <Item label="Cover from" value={formatDate(cover.coverStartDate)} />
            <Item
              label="Waiting period"
              value={cover.waitingPeriodDays ? cover.waitingPeriodDays + " days, to " + formatDate(cover.waitingPeriodEnds) : "None"}
            />
            <Item label="Cover claimed" value={money(cover.coverAmount)} />
            <Item label="Paid to (today)" value={cover.paidTo ? formatDate(cover.paidTo) : "Not recorded"} />
            <Item label="Beneficiaries then" value={(cover.beneficiariesOnEventDate || []).join(", ") || "None designated"} />
          </div>
        </>
      )}
      <h3 className="section-title">Benefit calculation</h3>
      <table className="wf-before-after">
        <tbody>
          <tr>
            <th scope="row">Cover for {c.coveredLife || "the life"}</th>
            <td>{money(c.amount)}</td>
          </tr>
          {lifeLeft != null && (
            <tr>
              <th scope="row">Benefit limit for {c.coveredLife || "the life"}</th>
              <td>
                {money(f.lifeLimit)} · used or reserved {money(f.lifeUsed)} · left {money(lifeLeft)}
              </td>
            </tr>
          )}
          {policyLeft != null && (
            <tr>
              <th scope="row">Policy limit</th>
              <td>
                {money(f.policyLimit)} · used or reserved {money(f.policyUsed)} · left {money(policyLeft)}
              </td>
            </tr>
          )}
          <tr>
            <th scope="row">{open ? "Most that can be approved now" : "Approved payout"}</th>
            <td>
              <strong>{open ? money(most) : c.payoutAmount != null ? money(c.payoutAmount) : "—"}</strong>
            </td>
          </tr>
        </tbody>
      </table>
      {(f.movements?.length > 0 || f.decisions?.length > 0) && (
        <>
          <h3 className="section-title">Reserve and decisions</h3>
          <ul className="wf-evidence">
            {(f.movements || []).map((m, i) => (
              <li key={"m" + i} className="optional">
                Reserve {Number(m.change) >= 0 ? "+" : "−"}
                {money(Math.abs(Number(m.change)))} → {money(m.balance)} · {m.reason}
                <small>
                  {m.by} · {formatDate(m.at)}
                </small>
              </li>
            ))}
            {(f.decisions || []).map((d) => (
              <li key={"d" + d.sequence} className={d.supersededBy ? "optional" : "received"}>
                {label(d.decision)}
                {d.amount != null ? " · " + money(d.amount) : ""}
                {d.reason ? " · " + d.reason : ""}
                <small>
                  {d.decidedBy} · {formatDate(d.decidedAt)}
                  {d.supersededBy ? " · set aside by decision " + d.supersededBy : ""}
                </small>
              </li>
            ))}
          </ul>
        </>
      )}
      {f.recoveries?.length > 0 && (
        <>
          <h3 className="section-title">Reinsurance recoveries</h3>
          <ul className="wf-evidence">
            {f.recoveries.map((r) => (
              <li key={r.ref} className={r.status === "RECEIVED" ? "received" : "missing"}>
                {r.ref} · {r.treatyRef} · {money(r.amount)}
                <small>
                  {r.status === "RECEIVED" ? "received " + money(r.receivedAmount) : "expected from the reinsurer"}
                </small>
                {holds(profile, "READ_REINSURANCE") && <a href="#/reinsurance">Open in Reinsurance</a>}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/**
 * What an approval changes (NS-UX-004): the claim's state, the payout against the cover, the case reserve and the
 * benefit limits before and after, the payee, the checks and evidence it is approved on, and the reasons recorded.
 */
function ApprovalSummary({
  claim: c,
  amount,
  financials: f,
  softFailed,
  overrideReason,
  missingEvidence,
  evidenceReason,
  breakGlass,
  fourEyesReason,
}) {
  const payee = c.payee || {};
  const left = (limit, used) => (limit == null || used == null ? null : Number(limit) - Number(used));
  const lifeLeft = left(f?.lifeLimit, f?.lifeUsed);
  const policyLeft = left(f?.policyLimit, f?.policyUsed);
  const mandatory = (c.evidence || []).filter((e) => e.mandatory);
  const rows = [
    ["Status", c.status, "Approved"],
    ["Payout", c.payoutAmount != null ? money(c.payoutAmount) : "Not decided", money(amount) + (amount < c.amount ? " (partial of " + money(c.amount) + ")" : "")],
    ["Case reserve", money(c.reserve), money(amount)],
    ...(lifeLeft != null ? [["Benefit limit left for " + (c.coveredLife || "the life"), money(lifeLeft), money(lifeLeft - amount)]] : []),
    ...(policyLeft != null ? [["Policy limit left", money(policyLeft), money(policyLeft - amount)]] : []),
  ];
  return (
    <div className="wf-approval">
      <table className="wf-before-after">
        <thead>
          <tr>
            <th scope="col"></th>
            <th scope="col">Before</th>
            <th scope="col">After</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, before, after]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{before}</td>
              <td>
                <strong>{after}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Pays <strong>{payee.name || "the payee"}</strong>
        {payee.payoutMethod ? " by " + payee.payoutMethod + " " + (payee.accountRef || "") : ""}
        {payee.verified ? " (details verified" + (payee.verifiedBy ? " by " + payee.verifiedBy : "") + ")" : ""}. The
        amount is reserved against the limits now and used once the payout settles.
      </p>
      <ul className="wf-evidence">
        <li className={softFailed.length ? "missing" : "received"}>
          Checks: {softFailed.length ? softFailed.join(" and ") + " failed" : "all passed"}
          {softFailed.length > 0 && <small>reason: {overrideReason || "—"}</small>}
        </li>
        <li className={missingEvidence.length ? "missing" : "received"}>
          Evidence: {mandatory.length - missingEvidence.length} of {mandatory.length} required on file
          {missingEvidence.length > 0 && (
            <small>
              missing {missingEvidence.join(", ")} · reason: {evidenceReason || "—"}
            </small>
          )}
        </li>
        <li className={breakGlass ? "missing" : "received"}>
          Four-eyes: {c.recommendedBy ? "assessed by " + c.recommendedBy : "not assessed"}
          {breakGlass && <small>break-glass override · reason: {fourEyesReason || "—"}</small>}
        </li>
      </ul>
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
        <label className="form-label">
          <span>Covered life (optional)</span>
          <input
            name="coveredLife"
            className="input"
            maxLength={200}
            placeholder="Leave blank for the policyholder"
            title="The full name of the covered spouse, child or parent the claim is for"
          />
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

/**
 * The quote behind an application or policy (NS-IL01-001/004): every version with its price, rate version, validity,
 * calculation trace and acceptance. An expired or changed offer is re-quoted into the next version, which shows what
 * changed and needs the customer's acceptance before issue. Earlier versions stay readable (AT-IL01-01).
 */
export function QuotePanel({ session, quoteRef, profile, notify, onChanged }) {
  const [versions, setVersions] = useState(null);
  const [error, setError] = useState("");
  const [shown, setShown] = useState(null);
  const [replay, setReplay] = useState(null);
  const [busy, run] = useAction(notify);
  const confirm = useConfirm();
  const load = React.useCallback(async () => {
    try {
      const data = (await request(session, "/portfolio/quotes/" + quoteRef)).data || [];
      setVersions(data);
      setError("");
    } catch (err) {
      setError(err.status === 403 ? "" : err.message);
    }
  }, [session, quoteRef]);
  useEffect(() => {
    load();
  }, [load]);
  if (!versions) return error ? <p className="form-error">{error}</p> : null;
  const latest = versions[0];
  const q = versions.find((v) => v.version === shown) || latest;
  const mayQuote = holds(profile, "CREATE_APPLICATION") || holds(profile, "CREATE_POLICY");
  const requote = () =>
    run(async () => {
      const result = await request(session, "/portfolio/quotes/" + quoteRef + "/requote", { method: "POST" });
      await load();
      setShown(null);
      return result.data;
    }, "Re-quoted as version " + (latest.version + 1) + ". Show the customer what changed and record their acceptance.");
  const accept = async () => {
    const ok = await confirm({
      title: "Record acceptance of " + quoteRef + " v" + latest.version + "?",
      message: (
        <>
          Only when the customer has accepted <strong>{money(latest.premium)}</strong> a month on the rates{" "}
          {latest.rateVersion}
          {latest.differences ? <> after seeing what changed: {latest.differences}</> : null}.
        </>
      ),
      confirmLabel: "Record acceptance",
    });
    if (!ok) return;
    await run(async () => {
      const result = await request(session, "/portfolio/quotes/" + quoteRef + "/accept", {
        method: "POST",
        body: { version: latest.version },
      });
      await load();
      onChanged?.(result.data);
      return result.data;
    }, "Acceptance recorded for " + quoteRef + " v" + latest.version + ".");
  };
  const check = () =>
    run(async () => {
      const result = await request(session, "/portfolio/quotes/" + quoteRef + "/replay?version=" + q.version);
      setReplay(result.data);
      return result.data;
    });
  const lines = q.trace?.lines || [];
  return (
    <div className="wf-panel">
      <h3 className="section-title">
        Quote {quoteRef} · version {q.version}
        {q.version !== latest.version ? " (earlier offer)" : ""}
      </h3>
      <div className="detail-grid">
        <Item label="Premium" value={money(q.premium) + " a month"} />
        <Item label="Cover" value={money(q.sumAssured)} />
        <Item label="Rates" value={q.pricingMethod === "RATE_TABLE" ? q.rateVersion : "Flat tier premium"} />
        <Item label="Priced on" value={formatDate(q.pricedOn)} />
        <Item label="Valid until" value={formatDate(q.validUntil) + (q.expired ? " (expired)" : "")} />
        <Item
          label="Status"
          value={
            q.status === "ACCEPTED"
              ? "Accepted by " + q.acceptedBy + " on " + formatDate(q.acceptedAt)
              : q.status === "SUPERSEDED"
                ? "Replaced by a later version"
                : "Waiting for the customer's acceptance"
          }
        />
      </div>
      {q.differences && (
        <div className="notice">
          <RotateCcw size={18} aria-hidden="true" />
          <p>Changed from the previous version: {q.differences}</p>
        </div>
      )}
      {latest.expired && latest.version === q.version && (
        <div className="notice">
          <Clock3 size={18} aria-hidden="true" />
          <p>
            This offer expired on {formatDate(latest.validUntil)}. It cannot be issued; re-quote it, show the customer
            what changed and record their acceptance of the revised offer.
          </p>
        </div>
      )}
      {lines.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Life</th>
                <th>Relationship</th>
                <th className="num">Age</th>
                <th className="num">Cover</th>
                <th className="num">Premium</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.fullName}</td>
                  <td>{l.relationship}</td>
                  <td className="num">{l.age}</td>
                  <td className="num">{money(l.coverAmount)}</td>
                  <td className="num">{money(l.monthlyPremium)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">
        {q.trace?.rounding}. Inputs fingerprint {String(q.inputHash).slice(0, 12)}… · {q.serviceVersion}
        {replay && replay.version === q.version
          ? " · Re-priced under " + replay.rateVersion + ": " + (replay.reproduced ? "same amount" : "different amount (" + money(replay.replayed) + ")")
          : ""}
      </p>
      <div className="detail-actions">
        {versions.length > 1 && (
          <select
            className="input"
            aria-label="Quote version"
            value={q.version}
            onChange={(e) => setShown(Number(e.target.value))}
          >
            {versions.map((v) => (
              <option key={v.version} value={v.version}>
                Version {v.version} · {v.status.toLowerCase()} · {money(v.premium)}
              </option>
            ))}
          </select>
        )}
        <Btn variant="secondary" disabled={busy} onClick={check}>
          Check the price
        </Btn>
        {mayQuote && latest.status === "QUOTED" && !latest.expired && (
          <Btn icon={Check} disabled={busy} onClick={accept}>
            Record acceptance
          </Btn>
        )}
        {mayQuote && !latest.policyRef && (
          <Btn variant="secondary" icon={RotateCcw} disabled={busy} onClick={requote}>
            Re-quote
          </Btn>
        )}
      </div>
    </div>
  );
}

/**
 * What an application captured and what it still needs (NS-IL01-002/003): payer, mandate, channel, disclosure
 * answers, the declaration, and the evidence checklist. A draft shows what stands between it and submission; a
 * submitted one shows the evidence still outstanding, which holds issue until it is recorded (AT-IL01-02).
 */
export function ApplicationChecklist({ session, application: a, profile, notify, onChanged }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const [busy, run] = useAction(notify);
  const [recording, setRecording] = useState(null);
  const load = React.useCallback(async () => {
    try {
      setState((await request(session, "/portfolio/applications/" + a.id + "/checklist")).data);
      setError("");
    } catch (err) {
      setError(err.status === 403 ? "" : err.message);
    }
  }, [session, a.id]);
  useEffect(() => {
    load();
  }, [load, a.status]);
  if (!state) return error ? <p className="form-error">{error}</p> : null;
  const mayUpdate = holds(profile, "UPDATE_APPLICATION");
  const call = (path, options, done) =>
    run(async () => {
      const result = await request(session, "/portfolio/applications/" + a.id + path, options);
      setState(result.data);
      setRecording(null);
      onChanged?.({ ...a, status: result.data.status });
      return result.data;
    }, done);
  return (
    <div className="wf-panel">
      <h3 className="section-title">Application details</h3>
      <div className="detail-grid">
        <Item label="Proposer" value={state.proposer} />
        <Item label="Payer" value={state.payer} />
        <Item
          label="Payment mandate"
          value={
            state.mandateMethod
              ? state.mandateMethod.replace("_", " ").toLowerCase() +
                (state.mandateAccount ? " · " + state.mandateInstitution + " " + state.mandateAccount : "") +
                (state.mandateDebitDay ? " · day " + state.mandateDebitDay : "")
              : "Not decided yet"
          }
        />
        <Item
          label="Channel"
          value={state.channel.replace("_", " ").toLowerCase() + (state.intermediaryCode ? " · " + state.intermediaryCode : "")}
        />
        <Item
          label="Declaration"
          value={
            state.declaredAt
              ? "Accepted, recorded by " + state.declaredBy
              : state.preCapture
                ? "Not recorded (predates this record)"
                : "Not accepted"
          }
        />
        <Item
          label="Submitted"
          value={
            state.submittedAt
              ? formatDate(state.submittedAt) + " by " + state.submittedBy
              : state.preCapture
                ? "Before this was recorded"
                : "Not submitted"
          }
        />
      </div>
      {state.submissionProblems.length > 0 && (
        <div className="notice">
          <Clock3 size={18} aria-hidden="true" />
          <p>Before this application can be submitted: {state.submissionProblems.join(" ")}</p>
        </div>
      )}
      {state.missingEvidence.length > 0 && (
        <div className="notice">
          <ShieldAlert size={18} aria-hidden="true" />
          <p>
            It cannot be issued until this evidence is received: {state.missingEvidence.join(", ")}. Record each item
            below when it arrives.
          </p>
        </div>
      )}
      {state.preCapture && (
        <p className="muted small">
          This application was submitted before disclosures and the declaration were captured, so none were recorded
          for it. New applications capture them before they can be submitted.
        </p>
      )}
      {state.disclosures.length > 0 && !state.preCapture && (
        <>
          <h3 className="section-title">Disclosures</h3>
          <ul className="wf-evidence">
            {state.disclosures.map((d) => (
              <li key={d.code} className={d.answer ? "received" : d.mandatory ? "missing" : "optional"}>
                {d.answer ? <BadgeCheck size={15} aria-hidden="true" /> : <Clock3 size={15} aria-hidden="true" />}
                {d.question}
                <small>{d.answer ? d.answer : d.mandatory ? "not answered" : "optional"}</small>
              </li>
            ))}
          </ul>
        </>
      )}
      <h3 className="section-title">Evidence</h3>
      <ul className="wf-evidence">
        {state.evidence.map((e) => (
          <li key={e.documentType} className={e.received ? "received" : e.mandatory ? "missing" : "optional"}>
            {e.received ? <BadgeCheck size={15} aria-hidden="true" /> : <Clock3 size={15} aria-hidden="true" />}
            {e.documentType}
            <small>
              {e.received
                ? e.note + (e.recordedBy ? " · " + e.recordedBy : "")
                : e.mandatory
                  ? "required, not yet received"
                  : "optional"}
            </small>
            {!e.received && mayUpdate && recording !== e.documentType && (
              <Btn variant="secondary" disabled={busy} onClick={() => setRecording(e.documentType)}>
                Record
              </Btn>
            )}
          </li>
        ))}
      </ul>
      {recording && (
        <EvidenceNote
          documentType={recording}
          busy={busy}
          onCancel={() => setRecording(null)}
          onConfirm={(note) =>
            call("/evidence", { method: "POST", body: { documentType: recording, note } }, recording + " recorded.")
          }
        />
      )}
      {a.status === "Draft" && mayUpdate && (
        <div className="detail-actions">
          <Btn
            icon={Check}
            disabled={busy || state.submissionProblems.length > 0}
            title={state.submissionProblems.length > 0 ? "Complete the application first" : undefined}
            onClick={() => call("/submit", { method: "POST" }, a.id + " submitted.")}
          >
            Submit application
          </Btn>
        </div>
      )}
    </div>
  );
}

/** What was received and checked, kept with the evidence item. */
function EvidenceNote({ documentType, busy, onCancel, onConfirm }) {
  const [note, setNote] = useState("");
  return (
    <div className="wf-reason">
      <textarea
        className="textarea"
        rows={2}
        maxLength={300}
        autoFocus
        placeholder={"What was received and checked for " + documentType}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="detail-actions">
        <Btn variant="secondary" onClick={onCancel}>
          Back
        </Btn>
        <Btn icon={Check} disabled={busy || note.trim().length < 5} onClick={() => onConfirm(note.trim())}>
          Record it
        </Btn>
      </div>
    </div>
  );
}
