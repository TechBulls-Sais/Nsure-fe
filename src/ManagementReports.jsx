import React, { useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  Empty,
  ErrorNote,
  Heading,
  Panel,
  Skeleton,
  Stat,
  Tabs,
  pula,
  useResource,
  when,
} from "./ui/workspace";

// SH13 management dashboard: Individual and Group business reported separately, plus shared services. Every
// section carries its own as-of time; nothing here authorises a payment or cover decision (NS-DAT-005).

const TONES = { good: "green", watch: "amber", alert: "red" };

const format = (metric) =>
  metric.unit === "BWP"
    ? pula(metric.value)
    : metric.unit === "PERCENT"
      ? Number(metric.value).toFixed(1) + "%"
      : Number(metric.value).toLocaleString("en-GB");

export default function ManagementReports({ session }) {
  const report = useResource(session, "/reports/management");
  const [domain, setDomain] = useState("ALL");
  const sections = (report.data?.sections || []).filter((s) => domain === "ALL" || s.domain === domain);
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
      <ErrorNote error={report.error} />
      <Tabs
        value={domain}
        onChange={setDomain}
        tabs={[
          ["ALL", "Everything"],
          ["INDIVIDUAL", "Individual life"],
          ["GROUP", "Group schemes"],
          ["SHARED", "Shared services"],
        ]}
      />
      {report.loading && !report.data && (
        <Panel title={<Skeleton width={180} height={16} />}>
          <div className="stat-grid">
            {[0, 1, 2, 3].map((i) => (
              <Stat key={i} label={<Skeleton width={110} />} loading />
            ))}
          </div>
        </Panel>
      )}
      {report.data && sections.length === 0 && (
        <Empty text="Nothing to report" detail="No section covers this business line yet; choose Everything to see all sections." />
      )}
      {sections.map((section) => (
        <Panel
          key={section.key}
          title={section.title}
          subtitle={
            <>
              <Badge tone="blue">{section.domain}</Badge> As of {when(section.asOf)}
            </>
          }
        >
          {section.error ? (
            <ErrorNote error={section.error} />
          ) : (
            <>
              <div className="stat-grid">
                {section.metrics.map((m) => (
                  <Stat
                    key={m.label}
                    label={m.label}
                    value={format(m)}
                    tone={TONES[m.tone] || "green"}
                    note={m.note}
                  />
                ))}
              </div>
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
    </>
  );
}
