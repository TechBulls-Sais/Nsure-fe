import React, { useState } from "react";
import { request } from "./api";
import { Badge, Button, DataTable, ErrorNote, Field, FormGrid, can, useAction, useResource, when } from "./ui/workspace";

// SH01 party master screens: duplicate review and steward-approved merges, the KYC checklist (screening, hit review,
// verification source and expiry), contacts with independent approval, the relationship editor and the customer view.
// Every screen reads and writes the real API; the screening provider behind it is simulated.

const label = (value) =>
  String(value || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());

const SCREENING_TONE = { CLEAR: "green", HIT_CLEARED: "green", HIT: "red", HIT_CONFIRMED: "red", PROVIDER_ERROR: "amber" };

/** NS-SH01-002 / AT-SH01-02: possible duplicates, merge requests and the data steward's decision. */
export function DuplicateReview({ session, profile, notify, onMerged }) {
  const duplicates = useResource(session, "/portfolio/parties/duplicates", []);
  const requests = useResource(session, "/portfolio/parties/merge-requests", []);
  const action = useAction(notify);
  const [asking, setAsking] = useState(null);
  const [deciding, setDeciding] = useState(null);
  const me = profile?.username;
  const reload = () => {
    duplicates.reload();
    requests.reload();
  };
  const ask = async () => {
    const r = await action.run(
      () => request(session, "/portfolio/parties/merge-requests", { method: "POST", body: asking }),
      "Merge requested. A data steward who is someone else decides it; nothing moves until then.",
    );
    if (r) {
      setAsking(null);
      reload();
    }
  };
  const decide = async () => {
    const r = await action.run(
      () =>
        request(session, `/portfolio/parties/merge-requests/${deciding.ref}/${deciding.approve ? "approve" : "reject"}`, {
          method: "POST",
          body: { note: deciding.note },
        }),
      deciding.approve ? "Merged. Every reference moved to the surviving record." : "Merge rejected.",
    );
    if (r) {
      setDeciding(null);
      reload();
      if (deciding.approve) onMerged?.();
    }
  };
  const pending = (requests.data || []).filter((r) => r.status === "PENDING");
  return (
    <div className="party-stack">
      <p className="subtitle">
        Matches use identity number, email, name with date of birth, and a configurable similar-name check. A name alone is
        only ever “possible”. A merge waits for a data steward who did not ask for it.
      </p>
      <ErrorNote error={duplicates.error || requests.error || action.error} />
      <h3 className="section-title">Possible duplicates</h3>
      <DataTable
        rows={duplicates.data}
        loading={duplicates.loading}
        rowKey={(d) => d.first.ref + d.second.ref}
        empty="No possible duplicates"
        emptyDetail="New matches appear here as customers are added."
        columns={[
          {
            key: "pair",
            label: "Records",
            render: (d) => (
              <>
                <strong>
                  {d.first.ref} · {d.first.name}
                </strong>
                <small className="party-sub">
                  {d.second.ref} · {d.second.name}
                </small>
              </>
            ),
          },
          { key: "confidence", label: "Match", render: (d) => <Badge tone={d.confidence === "LIKELY" ? "amber" : "blue"}>{label(d.confidence)}</Badge> },
          { key: "reasons", label: "Why", render: (d) => d.reasons.join(" · ") },
          {
            key: "act",
            label: "",
            render: (d) =>
              d.pendingRequest ? (
                <small className="party-sub">Waiting: {d.pendingRequest}</small>
              ) : (
                can(profile, "KYC_CUSTOMER") && (
                  <Button
                    variant="secondary"
                    onClick={() => setAsking({ survivingRef: d.first.ref, mergedRef: d.second.ref, reason: "" })}
                  >
                    Request merge
                  </Button>
                )
              ),
          },
        ]}
      />
      {asking && (
        <div className="party-form">
          <FormGrid submitLabel="Request merge" busy={action.busy} error={action.error} onSubmit={ask}>
            <Field label="Keep (surviving record)">
              <input value={asking.survivingRef} onChange={(e) => setAsking({ ...asking, survivingRef: e.target.value.toUpperCase() })} required />
            </Field>
            <Field label="Merge in (its reference keeps resolving)">
              <input value={asking.mergedRef} onChange={(e) => setAsking({ ...asking, mergedRef: e.target.value.toUpperCase() })} required />
            </Field>
            <Field label="Why these are the same person" full hint="At least 10 characters, e.g. the evidence compared">
              <input value={asking.reason} minLength={10} required onChange={(e) => setAsking({ ...asking, reason: e.target.value })} />
            </Field>
          </FormGrid>
          <Button variant="secondary" onClick={() => setAsking(null)}>
            Cancel
          </Button>
        </div>
      )}
      <h3 className="section-title">Merge requests {pending.length ? `· ${pending.length} waiting` : ""}</h3>
      <DataTable
        rows={requests.data}
        loading={requests.loading}
        rowKey={(r) => r.ref}
        empty="No merge requests"
        columns={[
          { key: "ref", label: "Request", render: (r) => <span className="ws-mono">{r.ref}</span> },
          { key: "pair", label: "Merge", render: (r) => `${r.mergedRef} into ${r.survivingRef}` },
          {
            key: "reason",
            label: "Reason",
            render: (r) => (
              <>
                {r.reason}
                {r.matchDetail && <small className="party-sub">{r.matchDetail}</small>}
              </>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (r) => (
              <>
                <Badge tone={r.status === "APPROVED" ? "green" : r.status === "REJECTED" ? "red" : "amber"}>{label(r.status)}</Badge>
                <small className="party-sub">
                  Asked by {r.requestedBy}
                  {r.decidedBy ? ` · decided by ${r.decidedBy} ${when(r.decidedAt)}` : ""}
                </small>
                {r.movedDetail && <small className="party-sub">Moved: {r.movedDetail}</small>}
                {r.decisionNote && <small className="party-sub">{r.decisionNote}</small>}
              </>
            ),
          },
          {
            key: "act",
            label: "",
            render: (r) =>
              r.status === "PENDING" &&
              can(profile, "APPROVE_PARTY_MERGE") &&
              r.requestedBy !== me && (
                <div className="ws-row-actions">
                  <Button onClick={() => setDeciding({ ref: r.ref, approve: true, note: "" })}>Approve</Button>
                  <Button variant="secondary" onClick={() => setDeciding({ ref: r.ref, approve: false, note: "" })}>
                    Reject
                  </Button>
                </div>
              ),
          },
        ]}
      />
      {deciding && (
        <div className="party-form">
          <FormGrid
            submitLabel={deciding.approve ? "Approve and merge" : "Reject"}
            busy={action.busy}
            error={action.error}
            onSubmit={decide}
          >
            <Field label={deciding.approve ? "Note (optional)" : "Why they stay separate"} full>
              <input
                value={deciding.note}
                required={!deciding.approve}
                minLength={deciding.approve ? 0 : 5}
                onChange={(e) => setDeciding({ ...deciding, note: e.target.value })}
              />
            </Field>
          </FormGrid>
          <Button variant="secondary" onClick={() => setDeciding(null)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

/** NS-SH01-004: the KYC checklist: evidence, screening, the authorised hit review, the verification and its expiry. */
export function PartyKyc({ session, profile, notify, customer, onChanged }) {
  const kyc = useResource(session, "/portfolio/customers/" + customer.id + "/kyc-record", null);
  const action = useAction(notify);
  const [verify, setVerify] = useState(null);
  const [review, setReview] = useState(null);
  const k = kyc.data;
  const screen = async () => {
    const r = await action.run(() =>
      request(session, "/portfolio/customers/" + customer.id + "/screening", { method: "POST" }),
    );
    if (r) {
      notify("Screening result: " + label(r.data.screeningStatus), r.data.screeningStatus === "CLEAR" ? "success" : "error");
      kyc.reload();
    }
  };
  const submitReview = async () => {
    const r = await action.run(
      () => request(session, "/portfolio/customers/" + customer.id + "/screening/review", { method: "POST", body: review }),
      "Screening hit " + (review.decision === "CLEARED" ? "cleared" : "confirmed"),
    );
    if (r) {
      setReview(null);
      kyc.reload();
      onChanged?.();
    }
  };
  const submitVerify = async () => {
    const r = await action.run(
      () =>
        request(session, "/portfolio/customers/" + customer.id + "/kyc", {
          method: "POST",
          body: { decision: "VERIFIED", source: verify.source, sourceReference: verify.reference || undefined },
          version: customer.version,
        }),
      customer.name + " is verified.",
    );
    kyc.reload();
    if (r) {
      setVerify(null);
      onChanged?.(r.data);
    }
  };
  if (!k) return <ErrorNote error={kyc.error} />;
  const items = [
    ["Identity evidence", k.documents ? `${k.documents} document(s) on file` : "None sent yet", k.documents > 0],
    [
      "Screening",
      label(k.screeningStatus) + (k.screenedAt ? ` · ${when(k.screenedAt)} by ${k.screenedBy}` : ""),
      ["CLEAR", "HIT_CLEARED"].includes(k.screeningStatus),
    ],
    ["Verification", k.verifiedAt ? `${label(k.verificationSource)} · ${when(k.verifiedAt)} by ${k.verifiedBy}` : "Not verified", k.kycStatus === "VERIFIED"],
    ["Expiry", k.expiresOn ? (k.expired ? "Expired " : "Expires ") + k.expiresOn + (k.reviewDue && !k.expired ? " · review due" : "") : "—", k.expiresOn && !k.reviewDue],
  ];
  return (
    <div className="party-stack">
      <ErrorNote error={kyc.error || action.error} />
      <ul className="party-checklist">
        {items.map(([name, value, ok]) => (
          <li key={name} className={ok ? "is-done" : ""}>
            <span aria-hidden="true">{ok ? "✓" : "•"}</span>
            <div>
              <strong>{name}</strong>
              <small className="party-sub">{value}</small>
            </div>
          </li>
        ))}
      </ul>
      {k.screeningDetail && (
        <p className={"party-note " + (SCREENING_TONE[k.screeningStatus] === "green" ? "" : "is-warn")}>
          <Badge tone={SCREENING_TONE[k.screeningStatus] || "blue"}>{label(k.screeningStatus)}</Badge> {k.screeningDetail}
          {k.screeningProvider ? ` · ${k.screeningProvider}` : ""}
          {k.hitReason ? ` · Review by ${k.hitReviewedBy}: ${k.hitReason}` : ""}
        </p>
      )}
      {k.verificationReference && <p className="party-sub">Verified against: {k.verificationReference}</p>}
      <div className="detail-actions">
        {can(profile, "KYC_CUSTOMER") && (
          <Button variant="secondary" busy={action.busy} onClick={screen}>
            {k.screeningStatus === "NOT_SCREENED" ? "Screen now" : "Screen again"}
          </Button>
        )}
        {can(profile, "EDD_CUSTOMER") && k.screeningStatus === "HIT" && k.screenedBy !== profile?.username && (
          <Button onClick={() => setReview({ decision: "CLEARED", reason: "" })}>Review the hit</Button>
        )}
        {can(profile, "KYC_CUSTOMER") && k.kycStatus !== "VERIFIED" && (
          <Button onClick={() => setVerify({ source: "DOCUMENT_REVIEW", reference: "" })}>Verify with source</Button>
        )}
      </div>
      {k.screeningStatus === "HIT" && k.screenedBy === profile?.username && (
        <p className="party-sub">You ran this screening, so someone else with enhanced due diligence rights reviews the hit.</p>
      )}
      {review && (
        <div className="party-form">
          <FormGrid submitLabel="Record the review" busy={action.busy} error={action.error} onSubmit={submitReview}>
            <Field label="Decision">
              <select value={review.decision} onChange={(e) => setReview({ ...review, decision: e.target.value })}>
                <option value="CLEARED">Clear: a false match</option>
                <option value="CONFIRMED">Confirm the match (KYC fails)</option>
              </select>
            </Field>
            <Field label="Reason" full hint="At least 10 characters: what was compared">
              <input value={review.reason} minLength={10} required onChange={(e) => setReview({ ...review, reason: e.target.value })} />
            </Field>
          </FormGrid>
        </div>
      )}
      {verify && (
        <div className="party-form">
          <FormGrid submitLabel="Verify KYC" busy={action.busy} error={action.error} onSubmit={submitVerify}>
            <Field label="How the identity was verified">
              <select value={verify.source} onChange={(e) => setVerify({ ...verify, source: e.target.value })}>
                {(k.verificationSources || []).map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reference (optional)" hint="Defaults to the latest identity document on file">
              <input value={verify.reference} maxLength={100} onChange={(e) => setVerify({ ...verify, reference: e.target.value })} />
            </Field>
          </FormGrid>
          <p className="party-sub">
            Screening runs first if it has not been done; a hit or a provider failure stops the verification. The
            verification expires after five years (demo default).
          </p>
        </div>
      )}
    </div>
  );
}

/** NS-SH01-005 / NS-SH01-001: addresses with history, identifiers, and contact changes approved by someone else. */
export function PartyContacts({ session, profile, notify, customer, onChanged }) {
  const contacts = useResource(session, "/portfolio/customers/" + customer.id + "/contacts", null);
  const action = useAction(notify);
  const [form, setForm] = useState(null);
  const [code, setCode] = useState(null);
  const c = contacts.data;
  const me = profile?.username;
  const post = (path, body, ok) => action.run(() => request(session, path, { method: "POST", body }), ok);
  const submit = async () => {
    const base = "/portfolio/customers/" + customer.id;
    const { form: type, ...body } = form;
    let r;
    if (type === "change") {
      r = await post(base + "/contact-changes", body);
      if (r) {
        setCode({ ref: r.data.recordRef, challenge: r.data.challenge, demoCode: r.data.demoCode, code: "" });
        notify("A one-time code was sent to the new " + body.field.toLowerCase() + ".", "success");
      }
    } else if (type === "address") {
      r = await post(base + "/addresses", { ...body, validFrom: body.validFrom || undefined }, "Address recorded");
    } else {
      r = await post(base + "/identifiers", body, "Identifier added");
    }
    if (r) {
      setForm(null);
      contacts.reload();
    }
  };
  const verify = async () => {
    const r = await post(
      "/portfolio/contact-changes/" + code.ref + "/verify",
      { challenge: code.challenge, code: code.code },
      "Code accepted. Another person approves the change.",
    );
    if (r) {
      setCode(null);
      contacts.reload();
    }
  };
  const decide = async (ch, approve) => {
    const note = approve ? null : window.prompt("Why is the change rejected?");
    if (!approve && !note) return;
    const r = await post(
      "/portfolio/contact-changes/" + ch.recordRef + "/" + (approve ? "approve" : "reject"),
      { note },
      approve ? "Change applied to the customer record." : "Change rejected.",
    );
    if (r) {
      contacts.reload();
      if (approve) onChanged?.();
    }
  };
  if (!c) return <ErrorNote error={contacts.error} />;
  const canUpdate = can(profile, "UPDATE_CUSTOMER");
  return (
    <div className="party-stack">
      <ErrorNote error={contacts.error || action.error} />
      <div className="detail-grid">
        <div className="detail-item">
          <small>Email</small>
          <strong>{c.email}</strong>
        </div>
        <div className="detail-item">
          <small>Mobile</small>
          <strong>{c.phone}</strong>
        </div>
      </div>
      <h3 className="section-title">Contact changes</h3>
      <p className="subtitle">
        A new email or mobile is proved with a one-time code sent to it, then approved by someone other than whoever
        recorded it.
      </p>
      {(c.changes || []).length === 0 && <p className="party-sub">No changes requested.</p>}
      {(c.changes || []).map((ch) => (
        <div className="linked-record" key={ch.recordRef}>
          <div>
            <strong>
              {ch.recordRef} · {label(ch.field)} {ch.oldMasked ? `${ch.oldMasked} → ` : "→ "}
              {ch.newValue}
            </strong>
            <small>
              {label(ch.status)} · {label(ch.channel)} · asked by {ch.requestedBy} {when(ch.requestedAt)}
              {ch.decidedBy ? ` · decided by ${ch.decidedBy}` : ""}
              {ch.decisionNote ? ` · ${ch.decisionNote}` : ""}
            </small>
          </div>
          <div className="ws-row-actions">
            {ch.status === "AWAITING_APPROVAL" && can(profile, "KYC_CUSTOMER") && ch.requestedBy !== me && (
              <>
                <Button busy={action.busy} onClick={() => decide(ch, true)}>
                  Approve
                </Button>
                <Button variant="secondary" busy={action.busy} onClick={() => decide(ch, false)}>
                  Reject
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
      {code && (
        <div className="party-form">
          <FormGrid submitLabel="Check the code" busy={action.busy} error={action.error} onSubmit={verify}>
            <Field label={"Code the customer received for " + code.ref} hint={code.demoCode ? "Demo installation: the code is " + code.demoCode : "Ask the customer to read it out"}>
              <input value={code.code} inputMode="numeric" autoComplete="one-time-code" required onChange={(e) => setCode({ ...code, code: e.target.value })} />
            </Field>
          </FormGrid>
        </div>
      )}
      <h3 className="section-title">Addresses</h3>
      {(c.addresses || []).length === 0 && <p className="party-sub">No address recorded.</p>}
      {(c.addresses || []).map((a) => (
        <div className="linked-record" key={a.id}>
          <div>
            <strong>
              {label(a.kind)}: {a.line1}
              {a.line2 ? ", " + a.line2 : ""}, {a.city} {a.country}
            </strong>
            <small>
              From {a.validFrom}
              {a.validTo ? " to " + a.validTo : " (current)"} · {label(a.verification)} · {a.createdBy}
            </small>
          </div>
          {!a.validTo && <Badge tone="green">Current</Badge>}
        </div>
      ))}
      <h3 className="section-title">Identifiers</h3>
      {(c.identifiers || []).map((i, n) => (
        <div className="linked-record" key={n}>
          <div>
            <strong>
              {i.type} {i.number}
            </strong>
            <small>
              {i.primary ? "Primary proof of identity" : "Alternative identifier"}
              {i.country ? " · issued in " + i.country : ""}
              {i.evidenceDocumentId ? " · evidence on file" : ""}
            </small>
          </div>
        </div>
      ))}
      {canUpdate && !form && (
        <div className="detail-actions">
          <Button variant="secondary" onClick={() => setForm({ form: "change", field: "EMAIL", value: "", reason: "" })}>
            Change email or mobile
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              setForm({ form: "address", kind: "RESIDENTIAL", line1: "", city: "", country: "BW", validFrom: "", verification: "UNVERIFIED" })
            }
          >
            Record an address
          </Button>
          <Button variant="secondary" onClick={() => setForm({ form: "identifier", type: c.identifierTypes?.[0] || "Passport", number: "", country: "BW" })}>
            Add an identifier
          </Button>
        </div>
      )}
      {form && (
        <div className="party-form">
          <FormGrid
            submitLabel={form.form === "change" ? "Send the code" : "Save"}
            busy={action.busy}
            error={action.error}
            onSubmit={submit}
          >
            {form.form === "change" && (
              <>
                <Field label="Change">
                  <select value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })}>
                    <option value="EMAIL">Email</option>
                    <option value="PHONE">Mobile</option>
                  </select>
                </Field>
                <Field label={form.field === "EMAIL" ? "New email" : "New mobile"}>
                  <input value={form.value} required onChange={(e) => setForm({ ...form, value: e.target.value })} />
                </Field>
                <Field label="Reason" full>
                  <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                </Field>
              </>
            )}
            {form.form === "address" && (
              <>
                <Field label="Kind">
                  <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                    <option value="RESIDENTIAL">Residential</option>
                    <option value="POSTAL">Postal</option>
                  </select>
                </Field>
                <Field label="Address line">
                  <input value={form.line1} required onChange={(e) => setForm({ ...form, line1: e.target.value })} />
                </Field>
                <Field label="Town or city">
                  <input value={form.city} required onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </Field>
                <Field label="Country (2 letters)">
                  <input value={form.country} maxLength={2} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} />
                </Field>
                <Field label="Valid from">
                  <input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
                </Field>
                <Field label="Verification">
                  <select value={form.verification} onChange={(e) => setForm({ ...form, verification: e.target.value })}>
                    <option value="UNVERIFIED">Not verified</option>
                    <option value="DOCUMENT">Proof of address seen</option>
                    <option value="CUSTOMER_DECLARED">Declared by the customer</option>
                  </select>
                </Field>
              </>
            )}
            {form.form === "identifier" && (
              <>
                <Field label="Type">
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {(c.identifierTypes || []).map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Number">
                  <input value={form.number} required onChange={(e) => setForm({ ...form, number: e.target.value })} />
                </Field>
                <Field label="Country of issue (2 letters)">
                  <input value={form.country} maxLength={2} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} />
                </Field>
              </>
            )}
          </FormGrid>
          <Button variant="secondary" onClick={() => setForm(null)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

/** NS-SH01-003 / AT-SH01-03: roles from transactions, and recorded relationships and delegations with dates. */
export function PartyRelationships({ session, profile, notify, customer }) {
  const rel = useResource(session, "/portfolio/customers/" + customer.id + "/relationships", null);
  const action = useAction(notify);
  const [form, setForm] = useState(null);
  const r = rel.data;
  const save = async () => {
    const res = await action.run(
      () =>
        request(session, "/portfolio/customers/" + customer.id + "/relationships", {
          method: "POST",
          body: { ...form, validFrom: form.validFrom || undefined, validTo: form.validTo || undefined },
        }),
      "Relationship recorded",
    );
    if (res) {
      setForm(null);
      rel.reload();
    }
  };
  const end = async (x) => {
    const reason = window.prompt("Why does " + x.ref + " end?");
    if (!reason) return;
    const res = await action.run(
      () => request(session, "/portfolio/relationships/" + x.ref + "/end", { method: "POST", body: { reason } }),
      x.ref + " ended",
    );
    if (res) rel.reload();
  };
  if (!r) return <ErrorNote error={rel.error} />;
  return (
    <div className="party-stack">
      <ErrorNote error={rel.error || action.error} />
      <h3 className="section-title">Roles from their records</h3>
      {r.derived.length === 0 && <p className="party-sub">No policies, claims, loans or intermediaries yet.</p>}
      {r.derived.map((d, i) => (
        <div className="linked-record" key={i}>
          <div>
            <strong>
              {label(d.role)} · {d.relatedRef}
            </strong>
            <small>{d.detail}</small>
          </div>
        </div>
      ))}
      <h3 className="section-title">Recorded relationships and delegations</h3>
      <p className="subtitle">
        A delegation lets another customer act on these policies with its authority until it ends; once ended it gives no
        portal access, though it stays in the history.
      </p>
      {r.recorded.length === 0 && <p className="party-sub">None recorded.</p>}
      {r.recorded.map((x) => (
        <div className="linked-record" key={x.ref}>
          <div>
            <strong>
              {x.partyRef === customer.id ? label(x.role) + " of " : x.partyRef + " is " + label(x.role).toLowerCase() + " for "}
              {label(x.relatedKind).toLowerCase()} {x.relatedRef}
            </strong>
            <small>
              {x.ref} · {label(x.authority)} · {x.validFrom} to {x.validTo || "open"}
              {x.note ? " · " + x.note : ""} · {x.createdBy}
            </small>
          </div>
          <div className="ws-row-actions">
            <Badge tone={x.current ? "green" : undefined}>{x.current ? "Current" : "Ended"}</Badge>
            {x.current && can(profile, "UPDATE_CUSTOMER") && (
              <Button variant="secondary" onClick={() => end(x)}>
                End
              </Button>
            )}
          </div>
        </div>
      ))}
      {can(profile, "UPDATE_CUSTOMER") && !form && (
        <div className="detail-actions">
          <Button
            variant="secondary"
            onClick={() => setForm({ role: "DELEGATE", relatedKind: "CUSTOMER", relatedRef: "", authority: "VIEW", validFrom: "", validTo: "", note: "" })}
          >
            Record a relationship
          </Button>
        </div>
      )}
      {form && (
        <div className="party-form">
          <FormGrid submitLabel="Record" busy={action.busy} error={action.error} onSubmit={save}>
            <Field label={customer.name + " is"}>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {r.roles.map((x) => (
                  <option key={x} value={x}>
                    {label(x)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="For">
              <select value={form.relatedKind} onChange={(e) => setForm({ ...form, relatedKind: e.target.value })}>
                {["CUSTOMER", "POLICY", "SCHEME", "LOAN"].map((x) => (
                  <option key={x} value={x}>
                    {label(x)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reference">
              <input value={form.relatedRef} required placeholder="CUS-1001 or POL-…" onChange={(e) => setForm({ ...form, relatedRef: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Authority">
              <select value={form.authority} onChange={(e) => setForm({ ...form, authority: e.target.value })}>
                {r.authorities.map((x) => (
                  <option key={x} value={x}>
                    {label(x)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="From">
              <input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
            </Field>
            <Field label="Until" hint={form.role === "DELEGATE" ? "A delegation must end" : "Optional"}>
              <input type="date" value={form.validTo} required={form.role === "DELEGATE"} onChange={(e) => setForm({ ...form, validTo: e.target.value })} />
            </Field>
            <Field label="Note" full>
              <input value={form.note} maxLength={300} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
          </FormGrid>
          <Button variant="secondary" onClick={() => setForm(null)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

/** NS-SH01-006: what the reader may see of the customer, by reference: premiums, messages and marketing consent. */
export function CustomerView360({ session, customer }) {
  const view = useResource(session, "/portfolio/customers/" + customer.id + "/view", null);
  const v = view.data;
  if (!v) return <ErrorNote error={view.error} />;
  const hidden = Object.entries(v.visible || {})
    .filter(([, shown]) => !shown)
    .map(([k]) => k);
  return (
    <div className="party-stack">
      {v.mergedFrom?.length > 0 && <p className="party-sub">Also known by merged references: {v.mergedFrom.join(", ")}</p>}
      {v.premiums && (
        <>
          <h3 className="section-title">Premiums received</h3>
          {v.premiums.length === 0 && <p className="party-sub">No receipts yet.</p>}
          {v.premiums.slice(0, 5).map((p) => (
            <div className="linked-record" key={p.recordRef}>
              <div>
                <strong>
                  {p.recordRef} · {p.product}
                </strong>
                <small>
                  {p.recordDate} · {p.status}
                </small>
              </div>
              <Badge>{p.amount}</Badge>
            </div>
          ))}
        </>
      )}
      {v.messages && v.messages.length > 0 && (
        <>
          <h3 className="section-title">Recent messages</h3>
          {v.messages.slice(0, 5).map((m) => (
            <div className="linked-record" key={m.recordRef}>
              <div>
                <strong>
                  {m.recordRef} · {m.eventType}
                </strong>
                <small>
                  {label(m.channel)} · {when(m.createdAt)}
                  {m.businessRef ? " · " + m.businessRef : ""}
                </small>
              </div>
              <Badge>{label(m.status)}</Badge>
            </div>
          ))}
        </>
      )}
      <h3 className="section-title">Marketing choices</h3>
      {v.marketing.length === 0 ? (
        <p className="party-sub">No marketing consent recorded: marketing is never sent. Service messages are separate.</p>
      ) : (
        v.marketing.map((m) => (
          <p className="party-sub" key={m.channel}>
            {label(m.channel)}: {label(m.status)} · {label(m.consentSource)} · {m.consentEvidence} · {m.updatedBy}
          </p>
        ))
      )}
      {hidden.length > 0 && <p className="party-sub">Not shown with your access: {hidden.join(", ")}.</p>}
    </div>
  );
}
