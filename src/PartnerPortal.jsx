import React, { useState } from "react";
import { Download, FileUp, Plus, Send } from "lucide-react";
import { request } from "./api";
import { Badge, Button, DataTable, Drawer, ErrorNote, Field, FormGrid, Heading, Panel, Stat, pula, useAction, useResource, when } from "./ui/workspace";

// The agent, employer and lender portals: each login sees only the one partner it is tied to.

const TITLE = { AGENT: "Agent and broker portal", EMPLOYER: "Employer portal", LENDER: "Lender portal" };
const REQUESTS = {
  AGENT: [
    ["NEW_APPLICATION", "New application for a client"],
    ["EVIDENCE", "Evidence for an application"],
    ["COMMISSION_QUERY", "Commission statement query"],
  ],
  EMPLOYER: [
    ["CENSUS", "Member census or salary changes"],
    ["JOINER_LEAVER", "Joiner or leaver"],
    ["RENEWAL_DATA", "Renewal data"],
    ["CLAIM", "Notify a claim"],
  ],
  LENDER: [
    ["NEW_LOAN", "New loan to cover"],
    ["BALANCE_UPDATE", "Balance update"],
    ["EARLY_SETTLEMENT", "Early settlement"],
    ["CREDIT_CLAIM", "Notify a credit claim"],
  ],
};
const label = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replaceAll("_", " ") : "—");

const BENEFIT = {
  GLA: "Group life assurance",
  LUMP_SUM_DISABILITY: "Lump-sum disability",
  CRITICAL_ILLNESS: "Critical illness",
  FAMILY: "Family benefits",
  INCOME_PROTECTION: "Income protection",
  CREDIT: "Group credit",
};

// Structured submissions (spec 04): checked against your own records when sent, processed by the insurer's team in
// the owning module, with the result shown under "My requests".
const SUBMISSIONS = {
  AGENT: [["NEW_APPLICATION", "Application for a client"]],
  EMPLOYER: [
    ["CENSUS", "Census file (CSV)"],
    ["JOINER_LEAVER", "Joiner or leaver"],
    ["RENEWAL_DATA", "Renewal data"],
  ],
  LENDER: [
    ["NEW_LOAN", "New loan to cover"],
    ["BALANCE_UPDATE", "Balance file"],
    ["CREDIT_CLAIM", "Credit claim"],
  ],
};
const CENSUS_HEADER = "memberKey,firstName,lastName,dateOfBirth,category,salary,action,effectiveDate";

export default function PartnerPortal({ session, notify }) {
  const portal = useResource(session, "/ops/portal", null);
  const [form, setForm] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [quote, setQuote] = useState(null);
  const [certificate, setCertificate] = useState(null);
  const action = useAction(notify);
  const p = portal.data;
  const submit = async () => {
    const done = await action.run(() => request(session, "/ops/portal/requests", { method: "POST", body: form }));
    if (done) {
      notify("Request received. Your reference is " + done.data.ref, "success");
      setForm(null);
      portal.reload();
    }
  };
  const send = async () => {
    const { type: kind, ...fields } = submission;
    let body = { type: kind, ...fields };
    if (kind === "BALANCE_UPDATE") {
      // One row per line: loan id, effective date, balance.
      const rows = String(fields.rowsText || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [lenderLoanId, effectiveDate, balance] = l.split(",").map((x) => x.trim());
          return { lenderLoanId, effectiveDate, balance };
        });
      body = { type: kind, batchReference: fields.batchReference, rows };
    }
    if (kind === "NEW_APPLICATION") {
      body = {
        ...body,
        declarationAccepted: Boolean(fields.declarationAccepted),
        disclosures: { TOBACCO: fields.tobacco || "NO", TREATMENT: fields.treatment || "NO" },
      };
    }
    const done = await action.run(() => request(session, "/ops/portal/submissions", { method: "POST", body }));
    if (done) {
      notify("Received and checked. Your reference is " + done.data.ref + ".", "success");
      setSubmission(null);
      portal.reload();
    }
  };
  const priceIt = async () => {
    const done = await action.run(() =>
      request(session, "/ops/portal/quote", { method: "POST", body: { customerRef: quote.customerRef, product: quote.product, tier: quote.tier } }),
    );
    if (done) setQuote({ ...quote, result: done.data });
  };
  const setField = (k) => (e) => setSubmission({ ...submission, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  if (!p) {
    return (
      <>
        <Heading eyebrow="PARTNER PORTAL" title="Partner portal" subtitle="Your own records with the insurer." />
        <ErrorNote error={portal.error} />
      </>
    );
  }
  const type = p.portalType;
  // AT-SH13-03: the export is cut to this partner's own portfolio on the server, whichever template is chosen.
  const exportPortfolio = async (template) => {
    const done = await action.run(() => request(session, "/reports/partner-portfolio?template=" + template));
    if (done) {
      const rows = done.data.rows;
      const keys = rows.length ? Object.keys(rows[0]) : [];
      const esc = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
      const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      a.download = done.data.ref + "-portfolio.csv";
      a.click();
      URL.revokeObjectURL(a.href);
      notify(done.data.ref + ": " + done.data.recordCount + " rows · " + done.data.scope, "success");
    }
  };
  return (
    <>
      <Heading
        eyebrow="PARTNER PORTAL"
        title={TITLE[type]}
        subtitle={(p.partner?.name || p.scopeRef || "") + " · you see only your own records. Every request you send gets a reference."}
      >
        <Button icon={FileUp} onClick={() => setSubmission({ type: SUBMISSIONS[type][0][0] })}>
          Send data
        </Button>
        {type === "AGENT" && (
          <Button variant="secondary" onClick={() => setQuote({ customerRef: "", product: "Term Life", tier: "Silver" })}>
            Quote for a client
          </Button>
        )}
        <Button variant="secondary" icon={Download} busy={action.busy} onClick={() => exportPortfolio("MY_BOOK")}>
          Export my portfolio
        </Button>
        {type === "AGENT" && (
          <Button variant="secondary" icon={Download} busy={action.busy} onClick={() => exportPortfolio("ALL_POLICIES")}>
            Export with the all-policies template
          </Button>
        )}
        <Button variant="secondary" icon={Plus} onClick={() => setForm({ requestType: REQUESTS[type][0][0], detail: "" })}>
          Other request
        </Button>
      </Heading>
      {type === "AGENT" && (
        <>
          <div className="stat-grid">
            <Stat label="Applications" value={p.applications.length} />
            <Stat label="Policies in my portfolio" value={p.policies.length} tone="blue" />
            <Stat label="Commission earned" value={pula(p.commissions.reduce((s, c) => s + Number(c.amount || 0), 0))} />
          </div>
          <Panel title="My applications" subtitle="Evidence requests show here; medical detail stays with the underwriter.">
            <DataTable
              rows={p.applications}
              rowKey={(r) => r.recordRef}
              empty="No applications under your code"
              columns={[
                { key: "recordRef", label: "Application" },
                { key: "customerName", label: "Client" },
                { key: "product", label: "Product" },
                { key: "amount", label: "Cover", align: "right", render: (r) => pula(r.amount) },
                { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
              ]}
            />
          </Panel>
          {/* NS-IL02-002, AT-IL02-03: what underwriting asked for and its status; never the evidence itself. */}
          <Panel title="Evidence requests" subtitle="Evidence underwriting asked for on your applications. Restricted medical evidence is named only as such.">
            <DataTable
              rows={p.evidenceRequests || []}
              rowKey={(r) => r.id}
              empty="No evidence requested on your applications"
              columns={[
                { key: "applicationRef", label: "Application" },
                { key: "requirement", label: "Evidence" },
                {
                  key: "status",
                  label: "Status",
                  render: (r) => (
                    <Badge tone={r.status === "REQUESTED" ? "amber" : "green"}>
                      {r.status === "REQUESTED" ? "Outstanding" : r.status === "RECEIVED" ? "Received" : "Waived"}
                    </Badge>
                  ),
                },
                { key: "dueDate", label: "Due" },
                { key: "reminderCount", label: "Reminders", align: "right", render: (r) => r.reminderCount || "—" },
              ]}
            />
          </Panel>
          <Panel title="My portfolio">
            <DataTable
              rows={p.policies}
              rowKey={(r) => r.recordRef}
              empty="No policies assigned to you"
              columns={[
                { key: "recordRef", label: "Policy" },
                { key: "customerName", label: "Client" },
                { key: "product", label: "Product" },
                { key: "premium", label: "Premium", align: "right", render: (r) => pula(r.premium) },
                { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "Active" ? "green" : undefined}>{r.status}</Badge> },
              ]}
            />
          </Panel>
          <Panel title="Arrears and renewal tasks" subtitle="Policies in your book that are not in force: contact the client.">
            <DataTable
              rows={p.arrears || []}
              rowKey={(r) => r.recordRef}
              empty="No policies need attention"
              columns={[
                { key: "recordRef", label: "Policy" },
                { key: "customerName", label: "Client" },
                { key: "product", label: "Product" },
                { key: "premium", label: "Premium", align: "right", render: (r) => pula(r.premium) },
                { key: "status", label: "Status", render: (r) => <Badge tone="amber">{r.status}</Badge> },
              ]}
            />
          </Panel>
          <Panel title="Commission statements">
            <DataTable
              rows={p.statements || []}
              rowKey={(r) => r.recordRef}
              empty="No statements yet"
              columns={[
                { key: "recordRef", label: "Statement" },
                { key: "lineCount", label: "Lines", align: "right" },
                { key: "netAmount", label: "Net", align: "right", render: (r) => pula(r.netAmount) },
                { key: "issuedAt", label: "Issued", render: (r) => when(r.issuedAt) },
                { key: "status", label: "Status", render: (r) => (r.paidAt ? "Paid " + when(r.paidAt) : label(r.status)) },
              ]}
            />
          </Panel>
          <Panel title="My commission">
            <DataTable
              rows={p.commissions}
              rowKey={(r) => r.recordRef}
              empty="No commission yet"
              columns={[
                { key: "recordRef", label: "Line" },
                { key: "policyRef", label: "Policy" },
                { key: "lineKind", label: "Type", render: (r) => label(r.lineKind) },
                { key: "amount", label: "Amount", align: "right", render: (r) => pula(r.amount) },
                { key: "status", label: "Status", render: (r) => label(r.status) },
              ]}
            />
          </Panel>
          {/* NS-SH06-006: the intermediary's own commission statements. */}
          <Panel title="My statements">
            <DataTable
              rows={p.statements || []}
              rowKey={(r) => r.recordRef}
              empty="No statements yet"
              columns={[
                { key: "recordRef", label: "Statement" },
                { key: "lineCount", label: "Lines", align: "right" },
                { key: "netAmount", label: "Net", align: "right", render: (r) => pula(r.netAmount) },
                { key: "status", label: "Status", render: (r) => label(r.status) },
              ]}
            />
          </Panel>
        </>
      )}
      {type === "EMPLOYER" && (
        <>
          <div className="stat-grid">
            <Stat label="Members" value={p.members.length} note={(p.certificates || []).length + " certificate(s)"} />
            <Stat label="Invoices outstanding" value={pula(p.invoices.reduce((s, i) => s + Number(i.outstanding || 0), 0))} tone="amber" />
            <Stat label="Policy year" value={p.partner?.policyYear ?? 1} note={"Renews " + (p.partner?.renewal || "")} tone="blue" />
          </div>
          <Panel title="Members" subtitle="Cover in force and cover awaiting underwriting. Medical evidence and underwriting reasons are not shown here.">
            <DataTable
              rows={p.members}
              rowKey={(r) => r.memberKey}
              empty="No members yet"
              columns={[
                { key: "memberKey", label: "Member no." },
                { key: "name", label: "Member", render: (r) => r.firstName + " " + r.lastName, sortValue: (r) => r.lastName },
                { key: "joinDate", label: "Joined" },
                { key: "acceptedCover", label: "Cover in force", align: "right", render: (r) => pula(r.acceptedCover) },
                { key: "pendingCover", label: "Pending", align: "right", render: (r) => (Number(r.pendingCover) > 0 ? pula(r.pendingCover) : "—") },
                { key: "memberStatus", label: "Status", render: (r) => <Badge tone={r.memberStatus === "ACTIVE" ? "green" : "amber"}>{label(r.memberStatus)}</Badge> },
              ]}
            />
          </Panel>
          <Panel title="Member certificates" subtitle="Only accepted cover is certified. Cover awaiting underwriting is shown as pending and is not yet in force.">
            <DataTable
              rows={p.certificates || []}
              rowKey={(r) => r.certificateNo}
              onRowClick={setCertificate}
              empty="No certificates yet"
              emptyDetail="Certificates appear once members are on cover."
              columns={[
                { key: "certificateNo", label: "Certificate" },
                { key: "member", label: "Member" },
                { key: "category", label: "Category", render: (r) => r.category || "—" },
                { key: "acceptedCover", label: "Cover in force", align: "right", render: (r) => pula(r.acceptedCover) },
                { key: "pendingCover", label: "Pending", align: "right", render: (r) => (Number(r.pendingCover) > 0 ? pula(r.pendingCover) : "—") },
                { key: "coverTo", label: "To" },
              ]}
            />
          </Panel>
          <Panel title="Invoices">
            <DataTable
              rows={p.invoices}
              rowKey={(r) => r.recordRef}
              empty="No invoices yet"
              columns={[
                { key: "recordRef", label: "Invoice" },
                { key: "billingPeriod", label: "Period" },
                { key: "memberCount", label: "Members", align: "right" },
                { key: "amount", label: "Amount", align: "right", render: (r) => pula(r.amount) },
                { key: "outstanding", label: "Outstanding", align: "right", render: (r) => pula(r.outstanding) },
                { key: "invoiceStatus", label: "Status", render: (r) => label(r.invoiceStatus) },
              ]}
            />
          </Panel>
        </>
      )}
      {type === "LENDER" && (
        <>
          <div className="stat-grid">
            <Stat label="Loans covered" value={p.loans.length} />
            <Stat label="Balance covered" value={pula(p.loans.filter((l) => l.status === "OPEN").reduce((s, l) => s + Number(l.balance || 0), 0))} tone="blue" />
            <Stat label="Refunds" value={p.refunds.length} />
          </div>
          <Panel title="My loans" subtitle="Cover confirmation, the balance held and any exception to clear.">
            <DataTable
              rows={p.loans}
              rowKey={(r) => r.recordRef}
              empty="No loans yet"
              columns={[
                { key: "lenderLoanId", label: "Loan id" },
                { key: "borrowerName", label: "Borrower" },
                { key: "principal", label: "Principal", align: "right", render: (r) => pula(r.principal) },
                { key: "balance", label: "Balance held", align: "right", render: (r) => pula(r.balance) + (r.balanceAsOf ? " · " + r.balanceAsOf : "") },
                { key: "disbursementDate", label: "Disbursed", render: (r) => r.disbursementDate || "Not confirmed" },
                { key: "policyRef", label: "Cover" },
                { key: "status", label: "Status", render: (r) => (r.balanceException ? <Badge tone="red">Balance to confirm</Badge> : <Badge>{label(r.status)}</Badge>) },
              ]}
            />
          </Panel>
          <Panel title="Premium refunds">
            <DataTable
              rows={p.refunds}
              rowKey={(r) => r.recordRef}
              empty="No refunds"
              columns={[
                { key: "recordRef", label: "Refund" },
                { key: "borrowerName", label: "Borrower" },
                { key: "amount", label: "Amount", align: "right", render: (r) => pula(r.amount) },
                { key: "status", label: "Status", render: (r) => (r.status === "PAID" ? "Paid" : "To be paid") },
              ]}
            />
          </Panel>
        </>
      )}
      <Panel title="My requests" subtitle="Each request is acknowledged with a reference and answered here.">
        <DataTable
          rows={p.requests}
          rowKey={(r) => r.recordRef}
          empty="No requests sent"
          columns={[
            { key: "recordRef", label: "Reference" },
            { key: "requestType", label: "Request", render: (r) => label(r.requestType) },
            { key: "detail", label: "Detail" },
            { key: "createdAt", label: "Sent", render: (r) => when(r.createdAt) },
            { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "DONE" ? "green" : "amber"}>{r.status === "DONE" ? "Completed" : "Received"}</Badge> },
            { key: "handledNote", label: "Answer", render: (r) => r.result || r.handledNote || "—" },
          ]}
        />
      </Panel>
      {certificate && (
        <Drawer title={"Certificate " + certificate.certificateNo} description={certificate.scheme + " · policy year " + certificate.policyYear} onClose={() => setCertificate(null)}>
          <div className="ws-kv">
            <div>
              <small>Member</small>
              <strong>{certificate.member}</strong>
            </div>
            <div>
              <small>Category</small>
              <strong>{certificate.category || "—"}</strong>
            </div>
            <div>
              <small>Cover in force</small>
              <strong>{pula(certificate.acceptedCover)}</strong>
            </div>
            <div>
              <small>Pending underwriting</small>
              <strong>{Number(certificate.pendingCover) > 0 ? pula(certificate.pendingCover) + " (not in force)" : "None"}</strong>
            </div>
            <div>
              <small>Cover period</small>
              <strong>
                {certificate.coverFrom} → {certificate.coverTo}
              </strong>
            </div>
            <div>
              <small>Benefits</small>
              <strong>{(certificate.benefits || []).map((b) => BENEFIT[b] || b).join(", ")}</strong>
            </div>
          </div>
          <div className="ws-form-actions">
            <Button variant="secondary" onClick={() => window.print()}>
              Print certificate
            </Button>
          </div>
        </Drawer>
      )}
      {quote && (
        <Drawer title="Quote for a client" description="Priced with the insurer's rating service. Only clients in your own book." onClose={() => setQuote(null)}>
          <FormGrid submitLabel="Price it" busy={action.busy} error={action.error} onSubmit={priceIt}>
            <Field label="Client customer reference">
              <input value={quote.customerRef} onChange={(e) => setQuote({ ...quote, customerRef: e.target.value.toUpperCase(), result: null })} required />
            </Field>
            <Field label="Product">
              <input value={quote.product} onChange={(e) => setQuote({ ...quote, product: e.target.value, result: null })} required />
            </Field>
            <Field label="Tier">
              <input value={quote.tier} onChange={(e) => setQuote({ ...quote, tier: e.target.value, result: null })} />
            </Field>
          </FormGrid>
          {quote.result && (
            <div className="ws-kv">
              {Object.entries(quote.result)
                .filter(([, v]) => v !== null && typeof v !== "object")
                .slice(0, 8)
                .map(([k, v]) => (
                  <div key={k}>
                    <small>{label(k.replace(/([A-Z])/g, "_$1"))}</small>
                    <strong>{String(v)}</strong>
                  </div>
                ))}
            </div>
          )}
        </Drawer>
      )}
      {submission && (
        <Drawer
          title="Send data"
          description="Checked against your own records now; the insurer's team processes it and the result appears under My requests."
          onClose={() => setSubmission(null)}
        >
          <FormGrid submitLabel="Send" busy={action.busy} error={action.error} onSubmit={send}>
            <Field label="What" full>
              <select value={submission.type} onChange={(e) => setSubmission({ type: e.target.value })}>
                {SUBMISSIONS[type].map(([k, text]) => (
                  <option key={k} value={k}>
                    {text}
                  </option>
                ))}
              </select>
            </Field>
            {submission.type === "NEW_APPLICATION" && (
              <>
                <Field label="Client customer reference" hint="Or give a new client's name below">
                  <input value={submission.customerRef || ""} onChange={setField("customerRef")} />
                </Field>
                <Field label="New client's name">
                  <input value={submission.clientName || ""} onChange={setField("clientName")} />
                </Field>
                <Field label="Product">
                  <input value={submission.product || ""} onChange={setField("product")} placeholder="Term Life" required />
                </Field>
                <Field label="Tier">
                  <input value={submission.tier || ""} onChange={setField("tier")} placeholder="Silver" />
                </Field>
                <Field label="Tobacco or nicotine in the last 12 months?">
                  <select value={submission.tobacco || "NO"} onChange={setField("tobacco")}>
                    <option value="NO">No</option>
                    <option value="YES">Yes</option>
                  </select>
                </Field>
                <Field label="Under treatment for a condition?">
                  <select value={submission.treatment || "NO"} onChange={setField("treatment")}>
                    <option value="NO">No</option>
                    <option value="YES">Yes</option>
                  </select>
                </Field>
                <Field label="The client read and accepted the declaration" full>
                  <input type="checkbox" checked={Boolean(submission.declarationAccepted)} onChange={setField("declarationAccepted")} />
                </Field>
              </>
            )}
            {submission.type === "CENSUS" && (
              <Field label="Census rows (CSV)" full hint={"First line: " + CENSUS_HEADER}>
                <textarea rows={8} value={submission.csv ?? CENSUS_HEADER + "\n"} onChange={setField("csv")} required />
              </Field>
            )}
            {submission.type === "JOINER_LEAVER" && (
              <>
                <Field label="Joiner or leaver">
                  <select value={submission.kind || "JOINER"} onChange={setField("kind")}>
                    <option value="JOINER">Joiner</option>
                    <option value="LEAVER">Leaver</option>
                  </select>
                </Field>
                <Field label="Member (staff) number">
                  <input value={submission.memberKey || ""} onChange={setField("memberKey")} required />
                </Field>
                <Field label="Effective date">
                  <input type="date" value={submission.effectiveDate || ""} onChange={setField("effectiveDate")} required />
                </Field>
                {(submission.kind || "JOINER") === "JOINER" && (
                  <>
                    <Field label="First name">
                      <input value={submission.firstName || ""} onChange={setField("firstName")} />
                    </Field>
                    <Field label="Last name">
                      <input value={submission.lastName || ""} onChange={setField("lastName")} />
                    </Field>
                    <Field label="Date of birth">
                      <input type="date" value={submission.dateOfBirth || ""} onChange={setField("dateOfBirth")} />
                    </Field>
                    <Field label="Category">
                      <input value={submission.category || ""} onChange={setField("category")} />
                    </Field>
                    <Field label="Annual salary">
                      <input type="number" min="0" value={submission.salary || ""} onChange={setField("salary")} />
                    </Field>
                  </>
                )}
              </>
            )}
            {submission.type === "RENEWAL_DATA" && (
              <>
                <Field label="Members at renewal">
                  <input type="number" min="1" value={submission.memberCount || ""} onChange={setField("memberCount")} required />
                </Field>
                <Field label="Total annual salaries">
                  <input value={submission.totalSalaries || ""} onChange={setField("totalSalaries")} required />
                </Field>
                <Field label="Notes" full>
                  <textarea rows={3} value={submission.notes || ""} onChange={setField("notes")} />
                </Field>
              </>
            )}
            {submission.type === "NEW_LOAN" && (
              <>
                <Field label="Your loan number">
                  <input value={submission.lenderLoanId || ""} onChange={setField("lenderLoanId")} required />
                </Field>
                <Field label="Borrower customer reference">
                  <input value={submission.customerRef || ""} onChange={setField("customerRef")} required />
                </Field>
                <Field label="Principal">
                  <input type="number" min="1" value={submission.principal || ""} onChange={setField("principal")} required />
                </Field>
                <Field label="Term (months)">
                  <input type="number" min="1" value={submission.termMonths || ""} onChange={setField("termMonths")} required />
                </Field>
                <Field label="Purpose">
                  <select value={submission.purpose || ""} onChange={setField("purpose")} required>
                    <option value="">Choose…</option>
                    <option value="CREDIT_LIFE_COVER">Credit life cover for this loan</option>
                  </select>
                </Field>
                <Field label="The borrower consented to the insurer receiving these loan details" full>
                  <input type="checkbox" checked={Boolean(submission.borrowerConsent)} onChange={setField("borrowerConsent")} />
                </Field>
              </>
            )}
            {submission.type === "BALANCE_UPDATE" && (
              <>
                <Field label="File reference">
                  <input value={submission.batchReference || ""} onChange={setField("batchReference")} required />
                </Field>
                <Field label="Balances" full hint="One per line: loan number, effective date (YYYY-MM-DD), balance">
                  <textarea rows={6} value={submission.rowsText || ""} onChange={setField("rowsText")} required />
                </Field>
              </>
            )}
            {submission.type === "CREDIT_CLAIM" && (
              <>
                <Field label="Your loan number">
                  <input value={submission.lenderLoanId || ""} onChange={setField("lenderLoanId")} required />
                </Field>
                <Field label="Date of the event">
                  <input type="date" value={submission.eventDate || ""} onChange={setField("eventDate")} required />
                </Field>
                <Field label="What happened" full>
                  <input value={submission.cause || ""} onChange={setField("cause")} required />
                </Field>
              </>
            )}
          </FormGrid>
        </Drawer>
      )}
      {form && (
        <Drawer title="New request" description="Our team actions it and answers under the reference you receive." onClose={() => setForm(null)}>
          <FormGrid submitLabel="Send request" busy={action.busy} error={action.error} onSubmit={submit}>
            <Field label="Request" full>
              <select value={form.requestType} onChange={(e) => setForm({ ...form, requestType: e.target.value })}>
                {REQUESTS[type].map(([k, text]) => (
                  <option key={k} value={k}>
                    {text}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Details" full>
              <textarea value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} rows={5} required />
            </Field>
          </FormGrid>
        </Drawer>
      )}
    </>
  );
}
