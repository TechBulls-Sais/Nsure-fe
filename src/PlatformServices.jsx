import React, { useState } from "react";
import { Download, Plus, Sparkles } from "lucide-react";
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

function Assistants({ session, notify, profile }) {
  const cases = useResource(session, "/platform/assistants", []);
  const log = useResource(session, can(profile, "READ_AUDIT") ? "/platform/assistants/log" : null, []);
  const customers = useResource(session, can(profile, "READ_CUSTOMER") ? "/portfolio/customers" : null, []);
  const claims = useResource(session, can(profile, "READ_CLAIM") ? "/portfolio/claims" : null, []);
  const applications = useResource(session, can(profile, "READ_APPLICATION") ? "/portfolio/applications" : null, []);
  const [form, setForm] = useState({ useCase: "CLAIM_SUMMARY", subject: "", purpose: "PREMIUM_REMINDER" });
  const [result, setResult] = useState(null);
  const action = useAction(notify);
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
      log.reload();
    }
  };
  const review = async (accept) => {
    const done = await action.run(
      () => request(session, "/platform/assistants/log/" + result.id + "/review", { method: "POST", body: { accept } }),
      accept ? "Marked as reviewed and accepted" : "Marked as rejected",
    );
    if (done) {
      setResult({ ...result, reviewStatus: done.data.reviewStatus });
      log.reload();
    }
  };
  const toggle = async (c) => {
    const done = await action.run(
      () => request(session, "/platform/assistants/" + c.code, { method: "PUT", body: { enabled: !c.enabled } }),
      c.name + (c.enabled ? " switched off" : " switched on"),
    );
    if (done) cases.setData(done.data);
  };
  return (
    <>
      <Panel
        title="Ask an assistant"
        subtitle="Assistants read the record and say where each point comes from. They never change a policy or claim, and a person reviews every output."
      >
        <ErrorNote error={action.error} />
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
              <Sparkles size={14} aria-hidden="true" /> {result.useCase.replaceAll("_", " ").toLowerCase()} · {result.modelVersion} · confidence{" "}
              {result.confidence}% ·{" "}
              <Badge tone={result.reviewStatus === "ACCEPTED" ? "green" : result.reviewStatus === "REJECTED" ? "red" : "amber"}>
                {result.reviewStatus === "PENDING" ? "Awaiting review" : result.reviewStatus.charAt(0) + result.reviewStatus.slice(1).toLowerCase()}
              </Badge>
            </span>
            <ul className="uw-list">
              {result.output.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <small className="ws-hint">Sources: {result.sources.join("; ")}</small>
            {result.reviewStatus === "PENDING" && (
              <div className="ws-form-actions">
                <Button variant="secondary" onClick={() => review(false)}>
                  Reject
                </Button>
                <Button onClick={() => review(true)}>Reviewed and accepted</Button>
              </div>
            )}
          </div>
        )}
      </Panel>
      <Panel title="Assistant register" subtitle="Each assistant has an owner, a version and a switch. Switched off, the manual process carries on unaffected.">
        <DataTable
          rows={cases.data}
          loading={cases.loading}
          rowKey={(r) => r.code}
          searchFrom={99}
          columns={[
            { key: "name", label: "Assistant" },
            { key: "purpose", label: "Purpose" },
            { key: "owner", label: "Owner" },
            { key: "modelVersion", label: "Version" },
            { key: "enabled", label: "Status", render: (r) => <Badge tone={r.enabled ? "green" : undefined}>{r.enabled ? "On" : "Off"}</Badge> },
            {
              key: "act",
              label: "",
              render: (r) =>
                can(profile, "MANAGE_CONFIG") && (
                  <Button variant="secondary" busy={action.busy} onClick={() => toggle(r)}>
                    {r.enabled ? "Switch off" : "Switch on"}
                  </Button>
                ),
            },
          ]}
        />
      </Panel>
      {can(profile, "READ_AUDIT") && (
        <Panel title="Assistant log" subtitle="Every output, with its sources, version and the person who reviewed it.">
          <DataTable
            rows={log.data}
            loading={log.loading}
            rowKey={(r) => r.id}
            empty="No assistant has been used yet"
            columns={[
              { key: "requestedAt", label: "When", render: (r) => when(r.requestedAt) },
              { key: "useCase", label: "Assistant", render: (r) => r.useCase.replaceAll("_", " ").toLowerCase() },
              { key: "subjectRef", label: "About" },
              { key: "output", label: "Output", render: (r) => r.output[0] },
              { key: "requestedBy", label: "Asked by" },
              { key: "reviewStatus", label: "Review", render: (r) => (r.reviewStatus === "PENDING" ? "Awaiting review" : r.reviewStatus.toLowerCase() + " · " + r.reviewedBy) },
            ]}
          />
        </Panel>
      )}
    </>
  );
}
