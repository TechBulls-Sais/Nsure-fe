import React, { useMemo, useState } from "react";
import { Download, Filter, RefreshCw, X } from "lucide-react";
import { request } from "./api";
import {
  Badge,
  Button,
  DataTable,
  Drawer,
  Empty,
  ErrorNote,
  Field,
  Heading,
  Panel,
  Skeleton,
  Stat,
  Tabs,
  pula,
  useAction,
  useResource,
  when,
} from "./ui/workspace";

// SH13 management dashboard: Individual and Group business reported separately, plus shared services, filtered by
// period, product, channel and scheme. Every figure links to its metric dictionary entry and drills through to its
// source rows (permission-filtered and masked by the API); exports are logged. Nothing here authorises a payment or
// cover decision (NS-DAT-005).

const TONES = { good: "green", watch: "amber", alert: "red" };
const DIMENSION = { PERIOD: "period", PRODUCT: "product", CHANNEL: "channel", SCHEME: "scheme" };

const format = (metric) =>
  metric.value == null
    ? "—"
    : metric.unit === "BWP"
      ? pula(metric.value)
      : metric.unit === "PERCENT"
        ? Number(metric.value).toFixed(1) + "%"
        : Number(metric.value).toLocaleString("en-GB");

const cell = (v) =>
  v == null ? "—" : typeof v === "number" ? v.toLocaleString("en-GB") : /^\d{4}-\d{2}-\d{2}T/.test(String(v)) ? when(v) : String(v);

const downloadCsv = (name, columns, rows) => {
  const esc = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
  const csv = [columns.map((c) => esc(c.label)).join(","), ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

const query = (f) =>
  Object.entries(f)
    .filter(([, v]) => v)
    .map(([k, v]) => k + "=" + encodeURIComponent(v))
    .join("&");

const EMPTY = { from: "", to: "", product: "", intermediary: "", scheme: "" };

export default function ManagementReports({ session, notify }) {
  const [draft, setDraft] = useState(EMPTY);
  const [filters, setFilters] = useState(EMPTY);
  const qs = query(filters);
  const report = useResource(session, "/reports/management" + (qs ? "?" + qs : ""));
  const [domain, setDomain] = useState("ALL");
  const [drill, setDrill] = useState(null);
  const action = useAction(notify);
  const sections = (report.data?.sections || []).filter((s) => domain === "ALL" || s.domain === domain);
  const dims = report.data?.dimensionValues || {};
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
  const exportSection = async (section) => {
    const r = await action.run(() =>
      request(session, "/reports/exports", { method: "POST", body: { kind: "SECTION", key: section.key, ...filters } }),
    );
    if (r) {
      downloadCsv(r.data.ref + "-" + section.key + ".csv", r.data.columns, r.data.rows);
      notify(r.data.ref + ": " + r.data.recordCount + " rows exported and logged", "success");
    }
  };
  return (
    <>
      <Heading
        eyebrow="MANAGEMENT INFORMATION"
        title="Management dashboard"
        subtitle={report.data ? report.data.freshness + " As of " + when(report.data.asOf) + "." : "Loading…"}
      >
        <Button variant="secondary" icon={RefreshCw} busy={report.loading} onClick={report.reload}>
          Refresh
        </Button>
      </Heading>
      <Panel title="Filters" subtitle="The period applies to flow figures (business written, premiums collected, claims paid in it); in-force and open figures are as at the time shown. Each section says which filters it honours.">
        <form
          className="ws-form"
          onSubmit={(e) => {
            e.preventDefault();
            setFilters(draft);
          }}
        >
          <div className="field-grid">
            <Field label="From">
              <input type="date" value={draft.from} onChange={set("from")} />
            </Field>
            <Field label="To">
              <input type="date" value={draft.to} onChange={set("to")} />
            </Field>
            <Field label="Product">
              <select value={draft.product} onChange={set("product")}>
                <option value="">All products</option>
                {(dims.products || []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Channel">
              <select value={draft.intermediary} onChange={set("intermediary")}>
                <option value="">All channels</option>
                {(dims.intermediaries || []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Scheme">
              <select value={draft.scheme} onChange={set("scheme")}>
                <option value="">All schemes</option>
                {(dims.schemes || []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="ws-form-actions">
            {qs && (
              <Button
                type="button"
                variant="secondary"
                icon={X}
                onClick={() => {
                  setDraft(EMPTY);
                  setFilters(EMPTY);
                }}
              >
                Clear
              </Button>
            )}
            <Button type="submit" icon={Filter} busy={report.loading}>
              Apply filters
            </Button>
          </div>
        </form>
        {report.data?.filters?.length > 0 && <p className="subtitle">Applied: {report.data.filters.join(" · ")}</p>}
      </Panel>
      <ErrorNote error={report.error || action.error} />
      <Tabs
        value={domain}
        onChange={setDomain}
        tabs={[
          ["ALL", "Everything"],
          ["INDIVIDUAL", "Individual life"],
          ["GROUP", "Group schemes"],
          ["SHARED", "Shared services"],
          ["EXPORTS", "Export log"],
        ]}
      />
      {domain === "EXPORTS" && <ExportLog session={session} />}
      {domain !== "EXPORTS" && report.loading && !report.data && (
        <Panel title={<Skeleton width={180} height={16} />}>
          <div className="stat-grid">
            {[0, 1, 2, 3].map((i) => (
              <Stat key={i} label={<Skeleton width={110} />} loading />
            ))}
          </div>
        </Panel>
      )}
      {domain !== "EXPORTS" && report.data && sections.length === 0 && (
        <Empty text="Nothing to report" detail="No section covers this business line yet; choose Everything to see all sections." />
      )}
      {domain !== "EXPORTS" &&
        sections.map((section) => (
          <Panel
            key={section.key}
            title={section.title}
            subtitle={
              <>
                <Badge tone="blue">{section.domain}</Badge> As of {when(section.asOf)}
                {section.dimensions?.length > 0 ? " · filters: " + section.dimensions.map((d) => DIMENSION[d]).join(", ") : " · not filtered"}
              </>
            }
            action={
              !section.error && (
                <Button variant="secondary" icon={Download} busy={action.busy} onClick={() => exportSection(section)}>
                  Export CSV
                </Button>
              )
            }
          >
            {section.error ? (
              <ErrorNote error={section.error} />
            ) : (
              <>
                <div className="stat-grid">
                  {section.metrics.map((m) => (
                    <div
                      key={m.label}
                      role={m.drill || m.key ? "button" : undefined}
                      tabIndex={m.drill || m.key ? 0 : undefined}
                      title={m.drill ? "Show the source rows" : m.key ? "Show the definition" : undefined}
                      style={m.drill || m.key ? { cursor: "pointer" } : undefined}
                      onClick={() => (m.drill || m.key) && setDrill({ metric: m })}
                      onKeyDown={(e) => e.key === "Enter" && (m.drill || m.key) && setDrill({ metric: m })}
                    >
                      <Stat
                        label={m.label}
                        value={format(m)}
                        tone={m.definitionStatus === "PENDING_APPROVAL" ? "amber" : TONES[m.tone] || "green"}
                        note={
                          m.definitionStatus === "PENDING_APPROVAL"
                            ? "Definition awaiting approval" + (m.note ? " · " + m.note : "")
                            : m.note
                        }
                      />
                    </div>
                  ))}
                </div>
                {section.reconciliation?.length > 0 && <Reconciliation lines={section.reconciliation} />}
                {section.breakdowns.filter((b) => b.rows.length > 0).length > 0 && (
                  <div className="ws-grid-2">
                    {section.breakdowns
                      .filter((b) => b.rows.length > 0)
                      .map((b) => (
                        <div key={b.title}>
                          <h3 className="subtitle">{b.title}</h3>
                          <DataTable
                            rowKey={(r) => r.label}
                            rows={b.rows}
                            searchPlaceholder={"Search " + b.title.toLowerCase() + "…"}
                            columns={[
                              { key: "label", label: "" },
                              { key: "count", label: "Count", align: "right" },
                              {
                                key: "amount",
                                label: "Amount",
                                align: "right",
                                render: (r) => (r.amount == null ? "—" : pula(r.amount)),
                              },
                            ]}
                          />
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </Panel>
        ))}
      {drill && <DrillDrawer session={session} notify={notify} metric={drill.metric} filters={filters} onClose={() => setDrill(null)} />}
    </>
  );
}

/** AT-SH13-02: each operational figure against its subledger control total, with every item that explains it. */
function Reconciliation({ lines }) {
  const [open, setOpen] = useState(null);
  return (
    <>
      <h3 className="subtitle">Reconciliation to the subledger</h3>
      <DataTable
        rowKey={(l) => l.measure}
        rows={lines}
        searchFrom={99}
        onRowClick={(l) => setOpen(open === l.measure ? null : l.measure)}
        columns={[
          { key: "measure", label: "Measure" },
          { key: "operational", label: "Operational", align: "right", render: (l) => pula(l.operational) },
          { key: "posted", label: "Subledger", align: "right", render: (l) => pula(l.posted) },
          { key: "difference", label: "Difference", align: "right", render: (l) => pula(l.difference) },
          {
            key: "status",
            label: "Status",
            render: (l) => (
              <Badge tone={l.status === "RECONCILED" ? "green" : l.status === "EXPLAINED" ? "amber" : "red"}>
                {l.status === "RECONCILED" ? "Reconciled" : l.status === "EXPLAINED" ? "Explained by " + l.items.length + " item(s)" : "Unexplained break"}
              </Badge>
            ),
          },
          { key: "basis", label: "Basis" },
        ]}
      />
      {lines
        .filter((l) => l.measure === open && l.items.length > 0)
        .map((l) => (
          <DataTable
            key={l.measure}
            rowKey={(i, n) => i.eventType + i.sourceRef + n}
            rows={l.items}
            columns={[
              { key: "eventType", label: "Event" },
              { key: "sourceRef", label: "Reference" },
              { key: "amount", label: "Amount", align: "right", render: (i) => (i.amount == null ? "—" : pula(i.amount)) },
              { key: "state", label: "State", render: (i) => <Badge>{i.state.toLowerCase()}</Badge> },
              { key: "reason", label: "Why it is not posted" },
            ]}
          />
        ))}
    </>
  );
}

function DrillDrawer({ session, notify, metric, filters, onClose }) {
  const qs = query({ ...filters, key: metric.drill });
  const rows = useResource(session, metric.drill ? "/reports/drill?" + qs : null);
  const dictionary = useResource(session, !metric.drill && metric.key ? "/platform/metrics" : null, []);
  const action = useAction(notify);
  const definition = useMemo(() => {
    if (rows.data?.definition) return rows.data.definition;
    return (dictionary.data || []).find((d) => d.key === metric.key && d.status === "APPROVED") || (dictionary.data || []).find((d) => d.key === metric.key);
  }, [rows.data, dictionary.data, metric.key]);
  const exportRows = async () => {
    const r = await action.run(() =>
      request(session, "/reports/exports", { method: "POST", body: { kind: "DRILL", key: metric.drill, ...filters } }),
    );
    if (r) {
      downloadCsv(r.data.ref + "-" + metric.drill + ".csv", r.data.columns, r.data.rows);
      notify(
        r.data.ref + ": " + r.data.recordCount + " rows exported" + (r.data.masked ? " (masked)" : "") + (r.data.sensitive ? "; logged as personal data" : ""),
        "success",
      );
    }
  };
  const d = rows.data;
  return (
    <Drawer title={metric.label} description={format(metric) + (metric.note ? " · " + metric.note : "")} size="lg" onClose={onClose}>
      <ErrorNote error={rows.error || action.error} />
      {definition && (
        <div className="ws-kv">
          <div>
            <small>Definition (v{definition.version})</small>
            <strong>{definition.definition}</strong>
          </div>
          <div>
            <small>Numerator / denominator</small>
            <strong>
              {definition.numerator}
              {definition.denominator ? " ÷ " + definition.denominator : ""}
            </strong>
          </div>
          <div>
            <small>Date basis and window</small>
            <strong>
              {definition.dateBasis === "ACCOUNTING" ? "Accounting date" : "Event date"} · {definition.timeBasis} · {definition.timeWindow}
            </strong>
          </div>
          <div>
            <small>Exclusions</small>
            <strong>{definition.exclusions || "None"}</strong>
          </div>
          <div>
            <small>Owner and status</small>
            <strong>
              {definition.owner} ·{" "}
              <Badge tone={definition.status === "APPROVED" ? "green" : "amber"}>{definition.status === "APPROVED" ? "Approved" : "Awaiting approval"}</Badge>
            </strong>
          </div>
        </div>
      )}
      {metric.drill && (
        <Panel
          title={d ? d.title + " · " + d.total + " row(s)" : "Source rows"}
          subtitle={
            d &&
            (d.masked ? "Names and dates of birth are masked: you may not read customer records. " : "") +
              (d.truncated ? "Showing the first " + d.rows.length + "; export for all. " : "") +
              (d.filters.length ? "Filters: " + d.filters.join(" · ") : "")
          }
          action={
            d && (
              <Button variant="secondary" icon={Download} busy={action.busy} onClick={exportRows}>
                Export CSV
              </Button>
            )
          }
        >
          <DataTable
            rowKey={(r, i) => i}
            rows={d?.rows || []}
            loading={rows.loading}
            empty="No rows behind this figure"
            columns={(d?.columns || []).map((c) => ({ key: c.key, label: c.label, render: (r) => cell(r[c.key]) }))}
          />
        </Panel>
      )}
    </Drawer>
  );
}

function ExportLog({ session }) {
  const rows = useResource(session, "/reports/exports", []);
  return (
    <Panel title="Export log" subtitle="Every report, drill-through and partner export: who, what, the filters, how many rows and whether personal data was masked. Personal-data and large exports are also kept as audit evidence.">
      <ErrorNote error={rows.error} />
      <DataTable
        rowKey={(r) => r.ref}
        rows={rows.data}
        loading={rows.loading}
        empty="Nothing exported yet"
        columns={[
          { key: "exportedAt", label: "When", render: (r) => when(r.exportedAt) },
          { key: "ref", label: "Export" },
          { key: "kind", label: "Kind" },
          { key: "subject", label: "What" },
          { key: "scope", label: "Scope" },
          { key: "filters", label: "Filters", render: (r) => r.filters || "—" },
          { key: "recordCount", label: "Rows", align: "right" },
          {
            key: "flags",
            label: "Data",
            render: (r) => (r.masked ? "Masked" : r.sensitive ? <Badge tone="amber">Personal data</Badge> : "Aggregates") ,
          },
          { key: "exportedBy", label: "By" },
        ]}
      />
    </Panel>
  );
}
