import React, { useState } from "react";
import { Download, Plus } from "lucide-react";
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

export default function PartnerPortal({ session, notify }) {
  const portal = useResource(session, "/ops/portal", null);
  const [form, setForm] = useState(null);
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
        <Button variant="secondary" icon={Download} busy={action.busy} onClick={() => exportPortfolio("MY_BOOK")}>
          Export my portfolio
        </Button>
        {type === "AGENT" && (
          <Button variant="secondary" icon={Download} busy={action.busy} onClick={() => exportPortfolio("ALL_POLICIES")}>
            Export with the all-policies template
          </Button>
        )}
        <Button icon={Plus} onClick={() => setForm({ requestType: REQUESTS[type][0][0], detail: "" })}>
          New request
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
            { key: "handledNote", label: "Answer", render: (r) => r.handledNote || "—" },
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
