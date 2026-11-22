import React, { useState } from "react";
import { Check, FileSignature, RefreshCw, Scale } from "lucide-react";
import { request } from "./api";
import { Badge, Button, DataTable, ErrorNote, Field, FormGrid, Panel, can, pula, useAction, useResource, when } from "./ui/workspace";

// Scheme renewal (GL05): review of the expiring year's census and claims experience, quotation versions negotiated with
// the sponsor, the sponsor's acceptance and a second person's approval into next-year category terms. Reads and writes
// /group/schemes/{ref}/renewals and /group/renewals/{ref}/**.

const label = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
const day = (value) =>
  value ? new Date(value + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const pct = (value) => (value === null || value === undefined ? "—" : `${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(2)}%`);
const inlineErrors = (notify) => (message, tone) => {
  if (tone !== "error") notify?.(message, tone);
};
const TONES = { QUOTED: "blue", NEGOTIATING: "amber", ACCEPTED: "purple", RENEWED: "green", WITHDRAWN: "gray" };

export default function RenewalTab({ session, notify, profile, detail, reload }) {
  const scheme = detail.scheme;
  const list = useResource(session, `/group/schemes/${encodeURIComponent(scheme.ref)}/renewals`, []);
  const action = useAction(inlineErrors(notify));
  const [form, setForm] = useState(null); // { kind: negotiate | accept | approve, ... }
  const renewals = list.data || [];
  const current = renewals.find((r) => ["QUOTED", "NEGOTIATING", "ACCEPTED"].includes(r.status)) || renewals[0];
  const manage = can(profile, "MANAGE_SCHEME");
  const approver = can(profile, "UNDERWRITE_MEMBER");
  const refresh = () => {
    list.reload();
    reload();
  };

  const prepare = async () => {
    const r = await action.run(() => request(session, `/group/schemes/${scheme.ref}/renewals`, { method: "POST", body: {} }), "Renewal prepared");
    if (r) refresh();
  };
  const submit = async () => {
    const base = `/group/renewals/${current.ref}`;
    let call;
    if (form.kind === "negotiate") {
      const terms = Object.entries(form.rates)
        .filter(([, v]) => v !== "")
        .map(([category, ratePerMille]) => ({ category, ratePerMille, cessationAge: form.ages[category] || undefined }));
      call = () => request(session, base + "/versions", { method: "POST", body: { rateChangePercent: form.rateChangePercent, terms, note: form.note } });
    } else if (form.kind === "accept") {
      call = () =>
        request(session, base + "/acceptance", {
          method: "POST",
          body: { version: form.version, sponsorReference: form.sponsorReference, note: form.note, nextStartDate: form.nextStartDate || undefined, gapReason: form.gapReason || undefined },
        });
    } else {
      call = () => request(session, base + "/approval", { method: "POST", body: { note: form.note } });
    }
    const r = await action.run(call, form.kind === "negotiate" ? "New version recorded" : form.kind === "accept" ? "Sponsor acceptance recorded" : "Scheme renewed");
    if (r) {
      setForm(null);
      refresh();
    }
  };

  const open = current && ["QUOTED", "NEGOTIATING", "ACCEPTED"].includes(current.status);
  const latest = current?.versions?.[0];
  return (
    <>
      <Panel
        title="Renewal"
        subtitle={`Policy year ${scheme.policyYear} ends ${day(scheme.renewalDate ? scheme.renewalDate : null)}. Prepare the renewal from the year's census and claims experience, negotiate versions, record the sponsor's acceptance and have a second person approve.`}
        action={
          manage && !open && scheme.status === "ACTIVE" ? (
            <Button icon={RefreshCw} busy={action.busy} onClick={prepare}>
              Prepare renewal
            </Button>
          ) : null
        }
      >
        <ErrorNote error={list.error || action.error} />
        {!current ? (
          <p className="ga-muted">{list.loading ? "Loading…" : "No renewal prepared for this scheme yet."}</p>
        ) : (
          <>
            <div className="ws-kv">
              <div>
                <small>Renewal</small>
                <strong>
                  <span className="ws-mono">{current.ref}</span> <Badge tone={TONES[current.status]}>{label(current.status)}</Badge>
                </strong>
              </div>
              <div>
                <small>Expiring year</small>
                <strong>
                  {current.expiringYear}: {day(current.expiringStart)} – {day(current.expiringEnd)}
                </strong>
              </div>
              <div>
                <small>Next year</small>
                <strong>
                  {current.nextYear}: {day(current.nextStart)} – {day(current.nextEnd)}
                </strong>
              </div>
              <div>
                <small>Recommended change</small>
                <strong title={current.experience?.basis}>{pct(current.recommendedChangePercent)}</strong>
              </div>
            </div>
            {current.experience && (
              <section className="ga-drawer-section">
                <h3>Experience (expiring year)</h3>
                <p className="subtitle">
                  {current.experience.membersOnCover} member(s) · cover {pula(current.experience.coverInForce)} · average age at renewal {current.experience.averageAgeAtRenewal} · premium billed{" "}
                  {pula(current.experience.premiumBilled)} · {current.experience.claims} claim(s) incurred {pula(current.experience.claimsIncurred)}
                  {current.experience.lossRatio != null && ` · loss ratio ${(Number(current.experience.lossRatio) * 100).toFixed(1)}%`}
                </p>
                <p className="subtitle">{current.experience.basis}</p>
              </section>
            )}
            {current.checks && (
              <section className="ga-drawer-section">
                <h3>Renewal checks</h3>
                <p className="subtitle">{current.checks.continuity}</p>
                {current.checks.notes?.length ? (
                  <ul className="ga-checks">
                    {current.checks.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="subtitle">Nothing needs attention before renewal.</p>
                )}
                {current.checks.incomeBenefitsInPayment?.length > 0 && (
                  <DataTable
                    rows={current.checks.incomeBenefitsInPayment}
                    rowKey={(c) => c.ref}
                    searchFrom={20}
                    columns={[
                      { key: "ref", label: "Income benefit", render: (c) => <span className="ws-mono">{c.ref}</span> },
                      { key: "memberKey", label: "Member" },
                      { key: "nextReviewDate", label: "Next review", render: (c) => day(c.nextReviewDate) },
                      { key: "contractualCessation", label: "Contractual cessation", render: (c) => day(c.contractualCessation) },
                      { key: "treatment", label: "At renewal" },
                    ]}
                  />
                )}
                {current.checks.membersReachingCessationAge?.length > 0 && (
                  <DataTable
                    rows={current.checks.membersReachingCessationAge}
                    rowKey={(m) => m.memberKey}
                    searchFrom={20}
                    columns={[
                      { key: "memberKey", label: "Member", render: (m) => `${m.name} · ${m.memberKey}` },
                      { key: "category", label: "Category" },
                      { key: "cessationAge", label: "Cessation age", align: "right" },
                      { key: "ceasesOn", label: "Cover ceases", render: (m) => day(m.ceasesOn) },
                    ]}
                  />
                )}
              </section>
            )}
            {latest && (
              <section className="ga-drawer-section">
                <h3>
                  Comparison · version {latest.version} ({label(latest.status)}) · {pct(latest.rateChangePercent)}
                </h3>
                <p className="subtitle">
                  Annual premium on current cover: expiring {pula(latest.expiringPremium)} → proposed {pula(latest.annualPremium)}. {latest.note}
                </p>
                <DataTable
                  rows={latest.terms}
                  rowKey={(t) => t.category}
                  searchFrom={20}
                  columns={[
                    { key: "category", label: "Category" },
                    { key: "members", label: "Members", align: "right" },
                    { key: "cover", label: "Cover", align: "right", render: (t) => pula(t.cover) },
                    { key: "rate", label: "Rate ‰ (expiring → proposed)", align: "right", render: (t) => `${Number(t.expiringRate).toFixed(4)} → ${Number(t.proposedRate).toFixed(4)}` },
                    { key: "free", label: "Free cover limit", align: "right", render: (t) => (t.expiringFreeCover === t.proposedFreeCover ? pula(t.proposedFreeCover) : `${pula(t.expiringFreeCover)} → ${pula(t.proposedFreeCover)}`) },
                    { key: "cessationAge", label: "Cessation age", align: "right" },
                    { key: "annual", label: "Annual premium", align: "right", render: (t) => `${pula(t.expiringAnnual)} → ${pula(t.proposedAnnual)}` },
                  ]}
                />
              </section>
            )}
            {current.acceptedBy && (
              <p className="subtitle">
                Accepted version {current.acceptedVersion} by the sponsor ({current.sponsorReference}), recorded by {current.acceptedBy} {when(current.acceptedAt)}: {current.acceptanceNote}
                {current.gapNote && ` · ${current.gapNote}`}
                {current.approvedBy && ` · approved by ${current.approvedBy} ${when(current.approvedAt)}: ${current.approvalNote}`}
              </p>
            )}
            {open && (
              <div className="ws-row-actions">
                {manage && current.status !== "ACCEPTED" && (
                  <Button
                    variant="secondary"
                    icon={Scale}
                    onClick={() =>
                      setForm({
                        kind: "negotiate",
                        rateChangePercent: String(latest?.rateChangePercent ?? 0),
                        rates: Object.fromEntries((latest?.terms || []).map((t) => [t.category, ""])),
                        ages: Object.fromEntries((latest?.terms || []).map((t) => [t.category, String(t.cessationAge)])),
                        note: "",
                      })
                    }
                  >
                    New version
                  </Button>
                )}
                {manage && current.status !== "ACCEPTED" && (
                  <Button icon={FileSignature} onClick={() => setForm({ kind: "accept", version: latest?.version, sponsorReference: "", note: "", nextStartDate: "", gapReason: "" })}>
                    Record sponsor acceptance
                  </Button>
                )}
                {approver && current.status === "ACCEPTED" && current.acceptedBy !== session?.username && (
                  <Button icon={Check} onClick={() => setForm({ kind: "approve", note: "" })}>
                    Approve and renew
                  </Button>
                )}
                {current.status === "ACCEPTED" && current.acceptedBy === session?.username && (
                  <span className="ga-muted">You recorded the acceptance; another person approves it.</span>
                )}
              </div>
            )}
            {form && (
              <FormGrid
                onSubmit={submit}
                busy={action.busy}
                error={action.error}
                submitLabel={form.kind === "negotiate" ? "Record version" : form.kind === "accept" ? "Record acceptance" : "Approve and renew"}
                extra={
                  <Button type="button" variant="secondary" onClick={() => setForm(null)}>
                    Cancel
                  </Button>
                }
              >
                {form.kind === "negotiate" && (
                  <>
                    <Field label="Rate change on expiring rates (%)" hint="Categories without their own rate below take this change.">
                      <input className="input" type="number" step="0.5" value={form.rateChangePercent} onChange={(e) => setForm({ ...form, rateChangePercent: e.target.value })} />
                    </Field>
                    {Object.keys(form.rates).map((code) => (
                      <Field key={code} label={`${code}: rate ‰ / cessation age`}>
                        <div className="ws-row-actions">
                          <input className="input" type="number" step="0.0001" min="0" placeholder="from the % change" value={form.rates[code]} onChange={(e) => setForm({ ...form, rates: { ...form.rates, [code]: e.target.value } })} />
                          <input className="input" type="number" min="50" max="80" value={form.ages[code]} onChange={(e) => setForm({ ...form, ages: { ...form.ages, [code]: e.target.value } })} aria-label={`${code} cessation age`} />
                        </div>
                      </Field>
                    ))}
                  </>
                )}
                {form.kind === "accept" && (
                  <>
                    <Field label="Version accepted">
                      <select className="select" value={form.version} onChange={(e) => setForm({ ...form, version: Number(e.target.value) })}>
                        {current.versions.map((v) => (
                          <option key={v.version} value={v.version}>
                            Version {v.version} · {pct(v.rateChangePercent)} · {pula(v.annualPremium)} a year
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Sponsor acceptance reference">
                      <input className="input" maxLength={80} value={form.sponsorReference} onChange={(e) => setForm({ ...form, sponsorReference: e.target.value })} required />
                    </Field>
                    <Field label="Next year starts" hint={`Leave empty for ${day(current.nextStart)} (no gap). A later date needs a gap reason; an earlier one is refused.`}>
                      <input className="input" type="date" value={form.nextStartDate} onChange={(e) => setForm({ ...form, nextStartDate: e.target.value })} />
                    </Field>
                    {form.nextStartDate && (
                      <Field label="Gap reason">
                        <input className="input" maxLength={200} value={form.gapReason} onChange={(e) => setForm({ ...form, gapReason: e.target.value })} />
                      </Field>
                    )}
                  </>
                )}
                <Field label={form.kind === "negotiate" ? "Negotiation note" : form.kind === "accept" ? "Acceptance note" : "Approval note"} full>
                  <textarea className="textarea" rows={2} maxLength={300} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} required />
                </Field>
              </FormGrid>
            )}
          </>
        )}
      </Panel>
      {renewals.length > 0 && (
        <Panel title="Renewal history" subtitle="Every renewal with its versions; superseded versions are kept.">
          <DataTable
            rows={renewals.flatMap((r) => r.versions.map((v) => ({ ...v, ref: r.ref, renewalStatus: r.status, year: r.nextYear })))}
            rowKey={(v) => `${v.ref}-${v.version}`}
            searchFrom={20}
            columns={[
              { key: "ref", label: "Renewal", render: (v) => <span className="ws-mono">{v.ref}</span> },
              { key: "year", label: "For year", align: "right" },
              { key: "version", label: "Version", align: "right" },
              { key: "status", label: "Version status", render: (v) => label(v.status) },
              { key: "rateChangePercent", label: "Change", align: "right", render: (v) => pct(v.rateChangePercent) },
              { key: "annualPremium", label: "Annual premium", align: "right", render: (v) => pula(v.annualPremium) },
              { key: "note", label: "Note" },
              { key: "createdAt", label: "Recorded", render: (v) => `${when(v.createdAt)} · ${v.createdBy}` },
            ]}
          />
        </Panel>
      )}
    </>
  );
}
