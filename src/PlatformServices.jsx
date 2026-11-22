import React, { useState } from "react";
import { Download, Plus, Send, Sparkles } from "lucide-react";
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
  Tabs,
  can,
  pula,
  useAction,
  useResource,
  when,
} from "./ui/workspace";

// Shared services: duplicate parties and merges, the wording library, governed data extracts with the metric
// dictionary, and the governed assistants with their switch and review log.

const downloadCsv = (name, rows) => {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const esc = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

export default function PlatformServices({ session, notify, profile }) {
  const tabs = [
    can(profile, "READ_CUSTOMER") && ["parties", "Duplicate parties"],
    can(profile, "READ_PRODUCT") && ["wordings", "Wording library"],
    can(profile, "READ_REPORT") && ["extracts", "Extracts & metrics"],
    ["assistants", "Assistants"],
    ["scope", "Scope & AI coverage"],
  ].filter(Boolean);
  const [tab, setTab] = useState(tabs[0][0]);
  return (
    <>
      <Heading
        eyebrow="DATA & GOVERNANCE"
        title="Data and assistants"
        subtitle="Possible duplicate customers and merges, approved policy wording, actuarial and regulatory extracts with the metric dictionary, and the governed assistants."
      />
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      {tab === "parties" && <Parties session={session} notify={notify} profile={profile} />}
      {tab === "wordings" && <Wordings session={session} notify={notify} profile={profile} />}
      {tab === "extracts" && <Extracts session={session} notify={notify} profile={profile} />}
      {tab === "assistants" && <Assistants session={session} notify={notify} profile={profile} />}
      {tab === "scope" && <ScopeCoverage session={session} notify={notify} profile={profile} />}
    </>
  );
}

function Parties({ session, notify, profile }) {
  const pairs = useResource(session, "/platform/parties/duplicates", []);
  const merges = useResource(session, "/platform/parties/merges", []);
  const [form, setForm] = useState(null);
  const action = useAction(notify);
  const submit = async () => {
    const done = await action.run(() => request(session, "/platform/parties/merges", { method: "POST", body: form }), "Records merged");
    if (done) {
      setForm(null);
      pairs.reload();
      merges.reload();
    }
  };
  const who = (p) => p.name + " · " + p.ref;
  return (
    <>
      <Panel title="Possible duplicates" subtitle="Records that share an identity number, email, or name and date of birth. A matching name alone is only a possibility: a person decides.">
        <ErrorNote error={pairs.error} />
        <DataTable
          rows={pairs.data}
          loading={pairs.loading}
          rowKey={(r) => r.first.ref + r.second.ref}
          empty="No possible duplicates"
          columns={[
            { key: "first", label: "Record", render: (r) => who(r.first), sortValue: (r) => r.first.name },
            { key: "second", label: "May be the same as", render: (r) => who(r.second), sortValue: (r) => r.second.name },
            { key: "reasons", label: "Because", render: (r) => r.reasons.join(", ") },
            { key: "confidence", label: "Match", render: (r) => <Badge tone={r.confidence === "LIKELY" ? "amber" : undefined}>{r.confidence === "LIKELY" ? "Likely" : "Possible"}</Badge> },
            { key: "policies", label: "Policies", render: (r) => r.first.policies + " / " + r.second.policies },
            {
              key: "act",
              label: "",
              render: (r) =>
                can(profile, "KYC_CUSTOMER") && (
                  <Button variant="secondary" onClick={() => setForm({ survivingRef: r.first.ref, mergedRef: r.second.ref, reason: "", pair: r })}>
                    Merge
                  </Button>
                ),
            },
          ]}
        />
      </Panel>
      <Panel title="Merge register" subtitle="A merged reference stays on this register, so earlier documents and messages can still be traced.">
        <DataTable
          rows={merges.data}
          loading={merges.loading}
          rowKey={(r) => r.mergedRef}
          empty="No merges"
          columns={[
            { key: "mergedRef", label: "Merged record", render: (r) => r.mergedName + " · " + r.mergedRef },
            { key: "survivingRef", label: "Now part of" },
            { key: "recordsMoved", label: "Records moved", align: "right" },
            { key: "reason", label: "Reason" },
            { key: "mergedBy", label: "By", render: (r) => r.mergedBy + " · " + when(r.mergedAt) },
          ]}
        />
      </Panel>
      {form && (
        <Drawer title="Merge two records" description="Applications, policies and claims move to the record that is kept." onClose={() => setForm(null)}>
          <FormGrid submitLabel="Merge" busy={action.busy} error={action.error} onSubmit={submit}>
            <Field label="Keep" full>
              <select
                value={form.survivingRef}
                onChange={(e) =>
                  setForm({
                    ...form,
                    survivingRef: e.target.value,
                    mergedRef: e.target.value === form.pair.first.ref ? form.pair.second.ref : form.pair.first.ref,
                  })
                }
              >
                <option value={form.pair.first.ref}>{who(form.pair.first)}</option>
                <option value={form.pair.second.ref}>{who(form.pair.second)}</option>
              </select>
            </Field>
            <Field label="Why these are the same party" full>
              <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} required />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

function Wordings({ session, notify, profile }) {
  const rows = useResource(session, "/platform/wordings", []);
  const products = useResource(session, "/public/products", []);
  const [form, setForm] = useState(null);
  const action = useAction(notify);
  const me = session?.username;
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const save = async () => {
    const done = await action.run(() => request(session, "/platform/wordings", { method: "POST", body: form }), "Wording saved as a draft");
    if (done) {
      setForm(null);
      rows.reload();
    }
  };
  const approve = async (r) => {
    const done = await action.run(
      () => request(session, "/platform/wordings/" + r.ref + "/versions/" + r.version + "/approval", { method: "POST" }),
      "Wording approved",
    );
    if (done) rows.reload();
  };
  return (
    <>
      <Panel
        title="Wording and clause library"
        subtitle="Each clause is versioned. A new version applies only once someone other than its author approves it, and issued documents keep the version they were issued with."
        action={
          can(profile, "UPDATE_PRODUCT") && (
            <Button icon={Plus} onClick={() => setForm({ product: (products.data || [])[0]?.name || "", clauseType: "BENEFIT", title: "", body: "" })}>
              New clause
            </Button>
          )
        }
      >
        <ErrorNote error={rows.error || action.error} />
        <DataTable
          rows={rows.data}
          loading={rows.loading}
          rowKey={(r) => r.ref + "-" + r.version}
          searchPlaceholder="Search wording…"
          columns={[
            { key: "ref", label: "Clause", render: (r) => r.ref + " v" + r.version },
            { key: "product", label: "Product" },
            { key: "clauseType", label: "Type", render: (r) => r.clauseType.charAt(0) + r.clauseType.slice(1).toLowerCase() },
            { key: "title", label: "Title" },
            { key: "body", label: "Wording" },
            { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "APPROVED" ? "green" : r.status === "DRAFT" ? "amber" : undefined}>{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</Badge> },
            {
              key: "act",
              label: "",
              render: (r) => (
                <div className="ws-row-actions">
                  {r.status === "DRAFT" && can(profile, "ACTIVATE_PRODUCT") && r.createdBy !== me && (
                    <Button variant="secondary" busy={action.busy} onClick={() => approve(r)}>
                      Approve
                    </Button>
                  )}
                  {r.status === "DRAFT" && r.createdBy === me && <small className="ws-hint">Needs another approver</small>}
                  {r.status === "APPROVED" && can(profile, "UPDATE_PRODUCT") && (
                    <Button variant="secondary" onClick={() => setForm({ ref: r.ref, product: r.product, clauseType: r.clauseType, title: r.title, body: r.body })}>
                      New version
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Panel>
      {form && (
        <Drawer title={form.ref ? "New version of " + form.ref : "New clause"} onClose={() => setForm(null)}>
          <FormGrid submitLabel="Save draft" busy={action.busy} error={action.error} onSubmit={save}>
            <Field label="Product">
              <select value={form.product} onChange={set("product")} disabled={Boolean(form.ref)}>
                {(products.data || []).map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type">
              <select value={form.clauseType} onChange={set("clauseType")}>
                <option value="BENEFIT">Benefit</option>
                <option value="EXCLUSION">Exclusion</option>
                <option value="CONDITION">Condition</option>
                <option value="ENDORSEMENT">Endorsement</option>
                <option value="DISCLOSURE">Disclosure</option>
              </select>
            </Field>
            <Field label="Title" full>
              <input value={form.title} onChange={set("title")} required />
            </Field>
            <Field label="Wording" full>
              <textarea value={form.body} onChange={set("body")} rows={6} required />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

function Extracts({ session, notify, profile }) {
  const runs = useResource(session, "/platform/extracts", []);
  const metrics = useResource(session, "/platform/metrics", []);
  const action = useAction(notify);
  const [proposal, setProposal] = useState(null);
  const me = session?.username;
  const propose = async () => {
    const { key, ...body } = proposal;
    const done = await action.run(
      () => request(session, "/platform/metrics/" + key + "/versions", { method: "POST", body }),
      "New definition proposed; someone else approves it",
    );
    if (done) {
      setProposal(null);
      metrics.reload();
    }
  };
  const approveMetric = async (m) => {
    const done = await action.run(
      () => request(session, "/platform/metrics/" + m.key + "/versions/" + m.version + "/approval", { method: "POST" }),
      m.name + " v" + m.version + " approved",
    );
    if (done) metrics.reload();
  };
  const run = async (extractType) => {
    const done = await action.run(() => request(session, "/platform/extracts", { method: "POST", body: { extractType } }));
    if (done) {
      downloadCsv(done.data.ref + "-" + extractType.toLowerCase() + ".csv", done.data.rows);
      notify(done.data.ref + ": " + done.data.recordCount + " records, control total " + pula(done.data.controlTotal) + (done.data.masked ? " (customer references masked)" : ""), "success");
      runs.reload();
    }
  };
  return (
    <>
      <Panel
        title="Actuarial and regulatory extracts"
        subtitle="Each run is recorded with its record count, control total and checksum, so the file received can be reconciled to the run."
        action={
          <div className="ws-row-actions">
            {["POLICIES", "PREMIUMS", "CLAIMS"].map((t) => (
              <Button key={t} variant="secondary" icon={Download} busy={action.busy} onClick={() => run(t)}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </Button>
            ))}
          </div>
        }
      >
        <ErrorNote error={runs.error || action.error} />
        <DataTable
          rows={runs.data}
          loading={runs.loading}
          rowKey={(r) => r.ref}
          empty="No extracts produced yet"
          columns={[
            { key: "ref", label: "Run" },
            { key: "extractType", label: "Extract", render: (r) => r.extractType.charAt(0) + r.extractType.slice(1).toLowerCase() },
            { key: "asOf", label: "As of" },
            { key: "recordCount", label: "Records", align: "right" },
            { key: "controlTotal", label: "Control total", align: "right", render: (r) => pula(r.controlTotal) },
            { key: "checksum", label: "Checksum", render: (r) => <span className="ws-mono">{r.checksum.slice(0, 16)}…</span> },
            { key: "runBy", label: "By", render: (r) => r.runBy + " · " + when(r.runAt) },
          ]}
        />
      </Panel>
      <Panel
        title="Metric dictionary"
        subtitle="Every dashboard figure is defined here: numerator and denominator, event or accounting date, window, exclusions, currency and owner. A change is a new version that applies once someone else approves it; persistency and the claims ratio need actuarial approval."
      >
        <ErrorNote error={metrics.error} />
        <DataTable
          rows={metrics.data}
          loading={metrics.loading}
          rowKey={(r) => r.key + "-" + r.version}
          searchPlaceholder="Search metrics…"
          columns={[
            { key: "name", label: "Metric", render: (r) => r.name + " v" + r.version },
            { key: "definition", label: "Definition" },
            { key: "numerator", label: "Numerator ÷ denominator", render: (r) => r.numerator + (r.denominator ? " ÷ " + r.denominator : "") },
            { key: "timeBasis", label: "Date basis", render: (r) => (r.dateBasis === "ACCOUNTING" ? "Accounting · " : "Event · ") + r.timeBasis },
            { key: "timeWindow", label: "Window" },
            { key: "exclusions", label: "Exclusions", render: (r) => r.exclusions || "—" },
            { key: "owner", label: "Owner" },
            {
              key: "status",
              label: "Status",
              render: (r) => (
                <Badge tone={r.status === "APPROVED" ? "green" : r.status === "PENDING_APPROVAL" ? "amber" : undefined}>
                  {r.status === "PENDING_APPROVAL" ? "Awaiting approval" : r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                </Badge>
              ),
            },
            {
              key: "act",
              label: "",
              render: (r) => (
                <div className="ws-row-actions">
                  {r.status === "PENDING_APPROVAL" && can(profile, "APPROVE_METRIC") && r.proposedBy !== me && (
                    <Button variant="secondary" busy={action.busy} onClick={() => approveMetric(r)}>
                      Approve
                    </Button>
                  )}
                  {r.status === "PENDING_APPROVAL" && r.proposedBy === me && <small className="ws-hint">Needs another approver</small>}
                  {r.status !== "SUPERSEDED" && can(profile, "MANAGE_METRIC") && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setProposal({ key: r.key, name: r.name, definition: r.definition, numerator: r.numerator, denominator: r.denominator || "", timeWindow: r.timeWindow, exclusions: r.exclusions || "", changeNote: "" })
                      }
                    >
                      Propose change
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Panel>
      {proposal && (
        <Drawer title={"New version of " + proposal.name} description="It applies to the dashboards once someone else approves it." onClose={() => setProposal(null)}>
          <FormGrid submitLabel="Propose" busy={action.busy} error={action.error} onSubmit={propose}>
            <Field label="Definition" full>
              <textarea rows={3} value={proposal.definition} onChange={(e) => setProposal({ ...proposal, definition: e.target.value })} required />
            </Field>
            <Field label="Numerator" full>
              <input value={proposal.numerator} onChange={(e) => setProposal({ ...proposal, numerator: e.target.value })} required />
            </Field>
            <Field label="Denominator" full>
              <input value={proposal.denominator} onChange={(e) => setProposal({ ...proposal, denominator: e.target.value })} />
            </Field>
            <Field label="Time window">
              <input value={proposal.timeWindow} onChange={(e) => setProposal({ ...proposal, timeWindow: e.target.value })} required />
            </Field>
            <Field label="Exclusions">
              <input value={proposal.exclusions} onChange={(e) => setProposal({ ...proposal, exclusions: e.target.value })} />
            </Field>
            <Field label="What changes and why" full>
              <textarea rows={2} value={proposal.changeNote} onChange={(e) => setProposal({ ...proposal, changeNote: e.target.value })} required minLength={5} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

const REVIEW_LABEL = { PENDING: "Awaiting review", ACCEPTED: "Accepted", OVERRIDDEN: "Overridden", REJECTED: "Rejected" };
const reviewTone = (s) => ({ ACCEPTED: "green", OVERRIDDEN: "amber", REJECTED: "red" })[s] || "amber";

function Assistants({ session, notify, profile }) {
  const cases = useResource(session, "/platform/assistants", []);
  const log = useResource(session, can(profile, "READ_AUDIT") ? "/platform/assistants/log" : null, []);
  const changes = useResource(session, "/platform/assistants/changes", []);
  const monitoring = useResource(session, "/platform/assistants/monitoring", []);
  const customers = useResource(session, can(profile, "READ_CUSTOMER") ? "/portfolio/customers" : null, []);
  const claims = useResource(session, can(profile, "READ_CLAIM") ? "/portfolio/claims" : null, []);
  const applications = useResource(session, can(profile, "READ_APPLICATION") ? "/portfolio/applications" : null, []);
  const [form, setForm] = useState({ useCase: "CLAIM_SUMMARY", subject: "", purpose: "PREMIUM_REMINDER" });
  const [result, setResult] = useState(null);
  const [review, setReview] = useState(null);
  const [change, setChange] = useState(null);
  const [overridesOnly, setOverridesOnly] = useState(false);
  const action = useAction(notify);
  const me = session?.username;
  const reload = () => {
    log.reload();
    monitoring.reload();
  };
  const options =
    form.useCase === "CLAIM_SUMMARY" ? claims.data || [] : form.useCase === "APPLICATION_CHECK" ? applications.data || [] : customers.data || [];
  const ask = async () => {
    const path = {
      CLAIM_SUMMARY: "/platform/assistants/claim-summary/" + form.subject,
      APPLICATION_CHECK: "/platform/assistants/application-check/" + form.subject,
      RISK_SCORE: "/platform/assistants/risk-indicators/" + form.subject,
      DRAFT_MESSAGE: "/platform/assistants/draft-message",
    }[form.useCase];
    const body = form.useCase === "DRAFT_MESSAGE" ? { customerRef: form.subject, purpose: form.purpose } : undefined;
    const done = await action.run(() => request(session, path, { method: "POST", body }));
    if (done) {
      setResult(done.data);
      reload();
    }
  };
  const submitReview = async () => {
    const done = await action.run(
      () => request(session, "/platform/assistants/log/" + review.id + "/review", { method: "POST", body: review.body }),
      "Review recorded: " + REVIEW_LABEL[{ ACCEPT: "ACCEPTED", OVERRIDE: "OVERRIDDEN", REJECT: "REJECTED" }[review.body.decision]],
    );
    if (done) {
      if (result?.id === review.id) setResult({ ...result, reviewStatus: done.data.reviewStatus, finalText: done.data.finalText });
      setReview(null);
      reload();
    }
  };
  const send = async (row) => {
    const done = await action.run(() => request(session, "/platform/assistants/log/" + row.id + "/send", { method: "POST" }));
    if (done) {
      notify("Sent as " + done.data.messageRef + " (" + done.data.messageStatus.toLowerCase() + ")", "success");
      if (result?.id === row.id) setResult({ ...result, sentRef: done.data.messageRef });
      reload();
    }
  };
  const toggle = async (c) => {
    const done = await action.run(
      () => request(session, "/platform/assistants/" + c.code, { method: "PUT", body: { enabled: !c.enabled } }),
      c.name + (c.enabled ? " switched off" : " switched on"),
    );
    if (done) cases.setData(done.data);
  };
  const requestChange = async () => {
    const { code, ...body } = change;
    const done = await action.run(
      () => request(session, "/platform/assistants/" + code + "/changes", { method: "POST", body }),
      "Version change requested; a second person approves it",
    );
    if (done) {
      setChange(null);
      changes.reload();
    }
  };
  const decide = async (c, approve) => {
    const done = await action.run(
      () =>
        request(session, "/platform/assistants/changes/" + c.id + "/decision", {
          method: "POST",
          body: { approve, note: approve ? "Approved" : "Rejected after review" },
        }),
      approve ? c.useCase + " now runs " + c.toVersion : "Version change rejected",
    );
    if (done) {
      changes.reload();
      cases.reload();
    }
  };
  const canReview = (r) => r.reviewStatus === "PENDING";
  const logRows = (log.data || []).filter((r) => !overridesOnly || ["OVERRIDDEN", "REJECTED"].includes(r.reviewStatus));
  return (
    <>
      <Panel
        title="Ask an assistant"
        subtitle="No AI model is called: each assistant is a set of deterministic rules over the record, governed as a model would be — owner, permitted inputs, approved version, human review, override log and a switch. They never change a policy or claim."
      >
        <ErrorNote error={!review && !change && action.error} />
        <FormGrid submitLabel="Ask" busy={action.busy} onSubmit={ask}>
          <Field label="Assistant">
            <select value={form.useCase} onChange={(e) => setForm({ ...form, useCase: e.target.value, subject: "" })}>
              {(cases.data || []).map((c) => (
                <option key={c.code} value={c.code} disabled={!c.enabled}>
                  {c.name}
                  {c.enabled ? "" : " (off)"}
                </option>
              ))}
            </select>
          </Field>
          <Field label={form.useCase === "CLAIM_SUMMARY" ? "Claim" : form.useCase === "APPLICATION_CHECK" ? "Application" : "Customer"}>
            <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required>
              <option value="">Choose…</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.id} · {o.name}
                </option>
              ))}
            </select>
          </Field>
          {form.useCase === "DRAFT_MESSAGE" && (
            <Field label="Message" full>
              <select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
                <option value="PREMIUM_REMINDER">Premium reminder</option>
                <option value="EVIDENCE_REQUEST">Request for a document</option>
                <option value="CLAIM_UPDATE">Claim progress update</option>
              </select>
            </Field>
          )}
        </FormGrid>
        {result && (
          <div className="form-label full">
            <span>
              <Sparkles size={14} aria-hidden="true" /> {result.useCase.replaceAll("_", " ").toLowerCase()} · {result.engine} · {result.modelVersion} ·
              computed confidence {result.confidence}% ·{" "}
              <Badge tone={reviewTone(result.reviewStatus)}>{REVIEW_LABEL[result.reviewStatus]}</Badge>
              {result.sentRef && <> · sent as {result.sentRef}</>}
            </span>
            <ul className="uw-list">
              {result.output.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <small className="ws-hint">Sources: {result.sources.join("; ")}</small>
            {result.explanation?.length > 0 && <small className="ws-hint">Why: {result.explanation.join("; ")}</small>}
            {result.finalText && result.reviewStatus === "OVERRIDDEN" && <small className="ws-hint">Final text kept: {result.finalText}</small>}
            <div className="ws-form-actions">
              {canReview(result) && (
                <Button variant="secondary" onClick={() => setReview({ id: result.id, row: result, body: { decision: "ACCEPT", reason: "", finalText: result.output.join("\n") } })}>
                  Review…
                </Button>
              )}
              {result.useCase === "DRAFT_MESSAGE" && ["ACCEPTED", "OVERRIDDEN"].includes(result.reviewStatus) && !result.sentRef && can(profile, "MANAGE_COMMUNICATION") && (
                <Button icon={Send} busy={action.busy} onClick={() => send(result)}>
                  Send reviewed message
                </Button>
              )}
            </div>
          </div>
        )}
      </Panel>
      <Panel title="Assistant register" subtitle="Each assistant has an owner, permitted inputs, an approved version, who may review it, a threshold and a switch. Switched off, the manual process carries on unaffected. A version change is its own approval, separate from wording edits.">
        <DataTable
          rows={cases.data}
          loading={cases.loading}
          rowKey={(r) => r.code}
          searchFrom={99}
          columns={[
            { key: "name", label: "Assistant", render: (r) => r.name + " · " + r.owner },
            { key: "permittedInputs", label: "Permitted inputs" },
            { key: "engine", label: "Engine", render: (r) => r.engine + " · " + r.modelVersion },
            { key: "reviewPermission", label: "Reviewed by", render: (r) => r.reviewPermission + (r.fourEyes ? " · four eyes" : "") },
            { key: "acceptanceThreshold", label: "Threshold", align: "right", render: (r) => r.acceptanceThreshold + "%" },
            { key: "enabled", label: "Status", render: (r) => <Badge tone={r.enabled ? "green" : undefined}>{r.enabled ? "On" : "Off"}</Badge> },
            {
              key: "act",
              label: "",
              render: (r) =>
                can(profile, "MANAGE_CONFIG") && (
                  <div className="ws-row-actions">
                    <Button variant="secondary" busy={action.busy} onClick={() => toggle(r)}>
                      {r.enabled ? "Switch off" : "Switch on"}
                    </Button>
                    <Button variant="secondary" onClick={() => setChange({ code: r.code, toVersion: "", changeNote: "", validationSummary: "" })}>
                      Change version
                    </Button>
                  </div>
                ),
            },
          ]}
        />
        {(changes.data || []).length > 0 && (
          <>
            <h3 className="subtitle">Version changes</h3>
            <DataTable
              rows={changes.data}
              rowKey={(r) => r.id}
              searchFrom={99}
              columns={[
                { key: "useCase", label: "Assistant" },
                { key: "toVersion", label: "Change", render: (r) => r.fromVersion + " → " + r.toVersion },
                { key: "changeNote", label: "Why" },
                { key: "validationSummary", label: "Validation", render: (r) => r.validationSummary || "—" },
                { key: "requestedBy", label: "Asked by" },
                { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
                {
                  key: "act",
                  label: "",
                  render: (r) =>
                    r.status === "PENDING" &&
                    (r.requestedBy === me ? (
                      <small className="ws-hint">Needs another approver</small>
                    ) : (
                      can(profile, "APPROVE_CONFIG") && (
                        <div className="ws-row-actions">
                          <Button variant="secondary" busy={action.busy} onClick={() => decide(r, false)}>
                            Reject
                          </Button>
                          <Button busy={action.busy} onClick={() => decide(r, true)}>
                            Approve
                          </Button>
                        </div>
                      )
                    )),
                },
              ]}
            />
          </>
        )}
      </Panel>
      <Panel title="Monitoring" subtitle="Reviewed outputs against each assistant's agreed threshold: acceptance, overrides, rejections (false positives), the review backlog and drift (last 30 days against before). Below threshold raises an alert.">
        <ErrorNote error={monitoring.error} />
        <DataTable
          rows={monitoring.data}
          loading={monitoring.loading}
          rowKey={(r) => r.code}
          searchFrom={99}
          columns={[
            { key: "name", label: "Assistant" },
            { key: "outputs", label: "Outputs", align: "right" },
            { key: "awaitingReview", label: "Awaiting review", align: "right" },
            { key: "acceptanceRate", label: "Accepted", align: "right", render: (r) => (r.acceptanceRate == null ? "—" : r.acceptanceRate + "%") },
            { key: "overrideRate", label: "Overridden", align: "right", render: (r) => (r.overrideRate == null ? "—" : r.overrideRate + "%") },
            { key: "falsePositiveRate", label: "Rejected", align: "right", render: (r) => (r.falsePositiveRate == null ? "—" : r.falsePositiveRate + "%") },
            { key: "drift", label: "Drift", align: "right", render: (r) => (r.drift == null ? "—" : (r.drift > 0 ? "+" : "") + r.drift + " pts") },
            { key: "threshold", label: "Threshold", align: "right", render: (r) => r.threshold + "%" },
            {
              key: "status",
              label: "Status",
              render: (r) => (
                <Badge tone={r.status === "BELOW_THRESHOLD" ? "red" : r.status === "WITHIN_THRESHOLD" ? "green" : undefined}>
                  {r.status === "INSUFFICIENT_DATA" ? "Fewer than 5 reviews" : r.status === "BELOW_THRESHOLD" ? "Below threshold" : "Within threshold"}
                </Badge>
              ),
            },
          ]}
        />
      </Panel>
      {can(profile, "READ_AUDIT") && (
        <Panel
          title="Assistant log and overrides"
          subtitle="Every output with its version, sources, explanation, the reviewer's decision and reason, and the final human text. Outputs you may not read are withheld."
          action={
            <label className="checkbox-label">
              <input type="checkbox" checked={overridesOnly} onChange={(e) => setOverridesOnly(e.target.checked)} /> Overrides and rejections only
            </label>
          }
        >
          <DataTable
            rows={logRows}
            loading={log.loading}
            rowKey={(r) => r.id}
            empty={overridesOnly ? "No overrides or rejections" : "No assistant has been used yet"}
            columns={[
              { key: "requestedAt", label: "When", render: (r) => when(r.requestedAt) },
              { key: "useCase", label: "Assistant", render: (r) => r.useCase.replaceAll("_", " ").toLowerCase() + " · " + r.modelVersion },
              { key: "subjectRef", label: "About" },
              { key: "output", label: "Output", render: (r) => r.output[0] },
              { key: "confidence", label: "Confidence", align: "right", render: (r) => r.confidence + "%" },
              { key: "requestedBy", label: "Asked by" },
              {
                key: "reviewStatus",
                label: "Review",
                render: (r) => (
                  <>
                    <Badge tone={reviewTone(r.reviewStatus)}>{REVIEW_LABEL[r.reviewStatus]}</Badge>
                    {r.reviewedBy ? " " + r.reviewedBy : ""}
                    {r.reviewReason ? " · " + r.reviewReason : ""}
                    {r.sentRef ? " · sent " + r.sentRef : ""}
                  </>
                ),
              },
              {
                key: "act",
                label: "",
                render: (r) => (
                  <div className="ws-row-actions">
                    {canReview(r) && !r.withheld && (
                      <Button variant="secondary" onClick={() => setReview({ id: r.id, row: r, body: { decision: "ACCEPT", reason: "", finalText: r.output.join("\n") } })}>
                        Review
                      </Button>
                    )}
                    {r.useCase === "DRAFT_MESSAGE" && ["ACCEPTED", "OVERRIDDEN"].includes(r.reviewStatus) && !r.sentRef && can(profile, "MANAGE_COMMUNICATION") && (
                      <Button variant="secondary" icon={Send} busy={action.busy} onClick={() => send(r)}>
                        Send
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Panel>
      )}
      {review && (
        <Drawer title="Review the output" description="Accept it as it is, accept it with your own changes (an override), or reject it. An override or rejection needs a reason; the final text you keep is what is used." onClose={() => setReview(null)}>
          <ul className="uw-list">
            {review.row.output.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <FormGrid submitLabel="Record review" busy={action.busy} error={action.error} onSubmit={submitReview}>
            <Field label="Decision" full>
              <select value={review.body.decision} onChange={(e) => setReview({ ...review, body: { ...review.body, decision: e.target.value } })}>
                <option value="ACCEPT">Accept as it is</option>
                <option value="OVERRIDE">Accept with my changes (override)</option>
                <option value="REJECT">Reject</option>
              </select>
            </Field>
            {review.body.decision === "OVERRIDE" && (
              <Field label="Final text" full>
                <textarea rows={5} value={review.body.finalText} onChange={(e) => setReview({ ...review, body: { ...review.body, finalText: e.target.value } })} required />
              </Field>
            )}
            {review.body.decision !== "ACCEPT" && (
              <Field label="Reason" full>
                <textarea rows={2} value={review.body.reason} onChange={(e) => setReview({ ...review, body: { ...review.body, reason: e.target.value } })} required minLength={5} />
              </Field>
            )}
          </FormGrid>
        </Drawer>
      )}
      {change && (
        <Drawer title={"Change the version of " + change.code} description="The running version changes only when a second person approves." onClose={() => setChange(null)}>
          <FormGrid submitLabel="Request change" busy={action.busy} error={action.error} onSubmit={requestChange}>
            <Field label="New version">
              <input value={change.toVersion} onChange={(e) => setChange({ ...change, toVersion: e.target.value })} required placeholder="rules-1.1" />
            </Field>
            <Field label="What changes and why" full>
              <textarea rows={3} value={change.changeNote} onChange={(e) => setChange({ ...change, changeNote: e.target.value })} required minLength={10} />
            </Field>
            <Field label="Validation evidence" full>
              <textarea rows={2} value={change.validationSummary} onChange={(e) => setChange({ ...change, validationSummary: e.target.value })} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}

function ScopeCoverage({ session, notify, profile }) {
  const coverage = useResource(session, "/platform/ai-coverage", []);
  const scope = useResource(session, "/platform/scope-exceptions", []);
  const [deciding, setDeciding] = useState(null);
  const action = useAction(notify);
  const decide = async () => {
    const { code, ...body } = deciding;
    const done = await action.run(
      () => request(session, "/platform/scope-exceptions/" + code + "/decision", { method: "POST", body }),
      "Insurer decision recorded",
    );
    if (done) {
      setDeciding(null);
      scope.reload();
    }
  };
  return (
    <>
      <Panel title="Scope exceptions (RFP section 17)" subtitle="Each item the build does not fully deliver, with its current position, the proposed disposition and the insurer decision it awaits. A proposed exception is not an approved one until the insurer's decision is recorded.">
        <ErrorNote error={scope.error} />
        <DataTable
          rows={scope.data}
          loading={scope.loading}
          rowKey={(r) => r.code}
          searchFrom={99}
          columns={[
            { key: "code", label: "Item", render: (r) => r.code + " · " + r.requirement },
            { key: "currentPosition", label: "Current position" },
            { key: "proposedDisposition", label: "Proposed disposition" },
            { key: "decisionRef", label: "Decision", render: (r) => r.decisionRef + " · " + r.owner },
            {
              key: "status",
              label: "Status",
              render: (r) => (
                <>
                  <Badge tone={r.status === "ACCEPTED" ? "green" : r.status === "REJECTED" ? "red" : "amber"}>{r.status === "PROPOSED" ? "Awaiting insurer" : r.status.toLowerCase()}</Badge>
                  {r.decisionNote ? " " + r.decisionNote : ""}
                </>
              ),
            },
            {
              key: "act",
              label: "",
              render: (r) =>
                r.status === "PROPOSED" &&
                can(profile, "APPROVE_CONFIG") && (
                  <Button variant="secondary" onClick={() => setDeciding({ code: r.code, requirement: r.requirement, decision: "ACCEPTED", note: "" })}>
                    Record decision
                  </Button>
                ),
            },
          ]}
        />
      </Panel>
      <Panel title="RFP AI coverage (AI-001 to AI-050)" subtitle="How each group of mandatory AI items is covered today. Nothing here calls an AI model: covered items are rule-based or governance; the rest await data, validation and hosting approval (decision D15).">
        <ErrorNote error={coverage.error} />
        <DataTable
          rows={coverage.data}
          loading={coverage.loading}
          rowKey={(r) => r.range}
          searchFrom={99}
          columns={[
            { key: "range", label: "RFP items" },
            { key: "capability", label: "Capability" },
            { key: "disposition", label: "Disposition", render: (r) => <Badge tone={r.disposition === "DELIVERED_RULES" ? "green" : "amber"}>{r.disposition.replaceAll("_", " ").toLowerCase()}</Badge> },
            { key: "deliveredBy", label: "Covered by" },
            { key: "limits", label: "Not covered" },
            { key: "owner", label: "Owner", render: (r) => r.owner + " · " + r.decisionRef },
            { key: "status", label: "Status", render: (r) => (r.status === "PROPOSED" ? "Proposed" : r.status) },
          ]}
        />
      </Panel>
      {deciding && (
        <Drawer title={"Insurer decision: " + deciding.code} description={deciding.requirement + ". Record the decision the insurer signed; it is kept as audit evidence."} onClose={() => setDeciding(null)}>
          <FormGrid submitLabel="Record decision" busy={action.busy} error={action.error} onSubmit={decide}>
            <Field label="Decision" full>
              <select value={deciding.decision} onChange={(e) => setDeciding({ ...deciding, decision: e.target.value })}>
                <option value="ACCEPTED">Exception accepted</option>
                <option value="REJECTED">Exception rejected (deliver it)</option>
              </select>
            </Field>
            <Field label="Decision reference and date" full>
              <textarea rows={2} value={deciding.note} onChange={(e) => setDeciding({ ...deciding, note: e.target.value })} required minLength={10} />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}
