import React, { useRef, useState } from "react";
import { CheckCircle2, Download, FileUp, Play, Rocket, RotateCcw, Send, ShieldOff, XCircle } from "lucide-react";
import { request } from "../api";
import { Badge, Button, DataTable, Dialog, ErrorNote, Field, FormGrid, can, useAction, useResource, when } from "../ui/workspace";

// SH02 release workspace for one product configuration (NS-SH02-001/002/003/006, AT-SH02-01, NS-SH03-006): the
// release checklist, the release manifest (frozen with its checksum at approval), the golden cases an actuary
// approves, and the lifecycle Draft → In review → Approved → Scheduled/Active → Withdrawn. Activation publishes the
// configuration to the catalogue, so quoting and issue sell exactly what was approved.

const STATUS_TONE = {
  Draft: "blue",
  "In review": "amber",
  Approved: "green",
  Scheduled: "amber",
  Active: "green",
  Withdrawn: "red",
};

export function ConfigStatus({ value }) {
  return <Badge tone={STATUS_TONE[value]}>{value}</Badge>;
}

const pula = (v) => (v == null ? "Refused" : "BWP " + Number(v).toLocaleString("en-GB", { minimumFractionDigits: 2 }));

function download(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The release drawer: checklist, manifest, golden cases and lifecycle actions for one configuration. */
export function ReleaseDrawer({ session, profile, notify, config, onClose, onChanged }) {
  const checklist = useResource(session, "/portfolio/product-configs/" + encodeURIComponent(config.id) + "/checklist");
  const versions = useResource(session, "/portfolio/product-configs/" + encodeURIComponent(config.id) + "/versions", []);
  const { busy, error, run } = useAction(notify);
  const [reason, setReason] = useState(null);
  const [golden, setGolden] = useState(null);
  const [rollbackTo, setRollbackTo] = useState("");
  const me = (profile?.username || "").toLowerCase();
  const c = checklist.data;
  const madeByMe = Boolean(config.madeBy) && config.madeBy.toLowerCase() === me;
  const base = "/portfolio/product-configs/" + encodeURIComponent(config.id);

  const act = async (path, body, message) => {
    const result = await run(async () => {
      const r = await request(session, base + path, { method: "POST", body: body || {} });
      return r.data;
    }, message);
    if (result) {
      setReason(null);
      setGolden(null);
      checklist.reload();
      versions.reload();
      if (result.id && result.status) onChanged?.(result);
    }
    return result;
  };
  const exportPackage = () =>
    run(async () => {
      const r = await request(session, base + "/package");
      download(config.code + "-package.json", r.data);
      return r.data;
    }, "Signed package downloaded.");

  const actions = c?.actions || [];
  const goldenRows = c?.goldenCases || [];
  const manifest = c?.manifest || {};
  return (
    <Dialog
      variant="drawer"
      size="lg"
      title={"Release · " + config.name}
      description={
        config.code +
        " v" +
        (c?.version ?? config.version) +
        " · sells as " +
        (config.sellsAs || config.name) +
        " – " +
        (config.sellsAsPlan || "Standard")
      }
      onClose={onClose}
    >
      <ErrorNote error={checklist.error || error} />
      {c && (
        <>
          <div className="ws-kv">
            <div>
              <small>Status</small>
              <strong>
                <ConfigStatus value={c.status} />
              </strong>
            </div>
            <div>
              <small>Made by</small>
              <strong>{config.madeBy || "—"}</strong>
            </div>
            <div>
              <small>Approved</small>
              <strong>{config.approvedBy ? config.approvedBy + " · " + when(config.approvedAt) : "—"}</strong>
            </div>
            <div>
              <small>Released</small>
              <strong>
                {config.releasedBy ? config.releasedBy + " · " + when(config.releasedAt) : "Not released"}
                {config.withdrawnBy ? " · withdrawn by " + config.withdrawnBy + " " + when(config.withdrawnAt) : ""}
              </strong>
            </div>
          </div>
          {config.importedFrom && <p className="ws-hint">Imported: {config.importedFrom}</p>}

          <h3 className="section-title">Release checklist</h3>
          <ul className="wf-evidence">
            {c.items.map((i) => (
              <li key={i.key} className={i.ok ? "received" : i.blocking ? "missing" : "optional"}>
                {i.ok ? <CheckCircle2 size={15} aria-hidden="true" /> : <XCircle size={15} aria-hidden="true" />}
                {i.label}
                <small>
                  {i.detail}
                  {!i.blocking ? " · for information" : ""}
                </small>
              </li>
            ))}
          </ul>
          <p className="ws-hint">
            {c.passed
              ? "The checklist passes."
              : "Approval and activation are refused until every blocking item passes."}
          </p>

          <h3 className="section-title">Release manifest</h3>
          <div className="ws-kv">
            <div>
              <small>Rates</small>
              <strong>
                {manifest.rates?.basis === "RATE_TABLE"
                  ? "Rate table " + manifest.rates.rateTable + " " + (manifest.rates.version || "(no published version)")
                  : "Flat premium " + (manifest.rates?.premium ?? "—") + " " + (manifest.rates?.frequency || "")}
              </strong>
            </div>
            <div>
              <small>Wording / template</small>
              <strong>
                {(manifest.wording?.text || "—") +
                  (manifest.wording?.template ? " · " + manifest.wording.template + " v" + manifest.wording.templateVersion : "")}
              </strong>
            </div>
            <div>
              <small>Accounting</small>
              <strong>{(manifest.accounting || []).map((a) => a.event + " r" + a.rule + " v" + a.version).join(", ") || "—"}</strong>
            </div>
            <div>
              <small>Commission · reinsurance</small>
              <strong>
                {(manifest.commission || []).length} rule(s) ·{" "}
                {(manifest.reinsurance || []).map((t) => t.treaty).join(", ") || "no treaty"}
              </strong>
            </div>
            <div>
              <small>Golden baselines</small>
              <strong>{(manifest.goldenCases || []).map((g) => "#" + g.id + " b" + g.baseline).join(", ") || "—"}</strong>
            </div>
            <div>
              <small>Checksum</small>
              <strong title={c.manifestChecksum}>
                {(c.manifestChecksum || "").slice(0, 16)}… ·{" "}
                {c.manifestFrozen ? (c.manifestMatches ? "frozen at approval, unchanged" : "CHANGED since approval") : "preview"}
              </strong>
            </div>
          </div>

          <h3 className="section-title">Golden cases</h3>
          <DataTable
            rows={goldenRows}
            pageSize={0}
            rowKey={(g) => g.id}
            empty="No golden cases yet"
            emptyDetail="Propose at least one: an actuary approves it, and activation needs every approved case to pass."
            columns={[
              { key: "label", label: "Case" },
              { key: "dateOfBirth", label: "Born" },
              { key: "pricedOn", label: "Priced on" },
              { key: "expectedPremium", label: "Expected", render: (g) => pula(g.expectedPremium) },
              { key: "actual", label: "Gives now", render: (g) => g.actual || "—" },
              {
                key: "result",
                label: "Result",
                render: (g) => (g.result ? <Badge tone={g.result === "PASS" ? "green" : "red"}>{g.result}</Badge> : "—"),
              },
              {
                key: "status",
                label: "Status",
                render: (g) => (
                  <span>
                    <Badge>{g.status}</Badge> <small className="muted">b{g.baseline}</small>
                  </span>
                ),
              },
              {
                key: "actions",
                label: "",
                render: (g) => (
                  <span className="detail-actions">
                    {g.status === "PROPOSED" &&
                      can(profile, "PUBLISH_RATE_TABLE") &&
                      (g.proposedBy || "").toLowerCase() !== me && (
                        <>
                          <Button variant="secondary" busy={busy} onClick={() => act("/golden-cases/" + g.id + "/approve", null, "Golden case approved.")}>
                            Approve
                          </Button>
                          <Button variant="ghost" busy={busy} onClick={() => act("/golden-cases/" + g.id + "/reject", null, "Golden case rejected.")}>
                            Reject
                          </Button>
                        </>
                      )}
                    {g.status === "APPROVED" && g.result === "FAIL" && can(profile, "UPDATE_PRODUCT") && (
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setGolden({
                            label: g.label,
                            dateOfBirth: g.dateOfBirth,
                            pricedOn: g.pricedOn,
                            expectedPremium: g.actual?.startsWith("REFUSED") ? "" : g.actual || "",
                            supersedes: g.id,
                            reason: "",
                          })
                        }
                      >
                        Revise baseline
                      </Button>
                    )}
                  </span>
                ),
              },
            ]}
          />
          <div className="detail-actions">
            <Button variant="ghost" icon={Play} busy={busy} onClick={() => act("/golden-cases/run", null, "Golden cases re-run.")}>
              Run golden cases
            </Button>
            {can(profile, "UPDATE_PRODUCT") && !golden && (
              <Button
                variant="secondary"
                onClick={() =>
                  setGolden({ label: "", dateOfBirth: "", pricedOn: new Date().toISOString().slice(0, 10), expectedPremium: "", reason: "" })
                }
              >
                Propose a golden case
              </Button>
            )}
          </div>
          {golden && (
            <FormGrid
              submitLabel={golden.supersedes ? "Propose revised baseline" : "Propose case"}
              busy={busy}
              onSubmit={() => act("/golden-cases", golden, "Golden case proposed for actuarial approval.")}
              extra={
                <Button type="button" variant="secondary" onClick={() => setGolden(null)}>
                  Cancel
                </Button>
              }
            >
              <Field label="Case">
                <input value={golden.label} onChange={(e) => setGolden({ ...golden, label: e.target.value })} required placeholder="e.g. Age 30, leap-year birthday" />
              </Field>
              <Field label="Date of birth">
                <input type="date" value={golden.dateOfBirth} onChange={(e) => setGolden({ ...golden, dateOfBirth: e.target.value })} required />
              </Field>
              <Field label="Priced on">
                <input type="date" value={golden.pricedOn} onChange={(e) => setGolden({ ...golden, pricedOn: e.target.value })} />
              </Field>
              <Field label="Expected premium" hint="Leave empty when the configuration must refuse this life.">
                <input inputMode="decimal" value={golden.expectedPremium} onChange={(e) => setGolden({ ...golden, expectedPremium: e.target.value })} />
              </Field>
              {golden.supersedes && (
                <Field label="Why the validated result changes" full>
                  <input value={golden.reason} onChange={(e) => setGolden({ ...golden, reason: e.target.value })} required />
                </Field>
              )}
            </FormGrid>
          )}

          <h3 className="section-title">Release</h3>
          {madeByMe && actions.some((a) => ["approve", "activate", "reject"].includes(a)) && (
            <p className="ws-hint">You made the current version, so another user approves, rejects or activates it.</p>
          )}
          <div className="detail-actions">
            {actions.includes("submit") && can(profile, "UPDATE_PRODUCT") && (
              <Button icon={Send} busy={busy} onClick={() => act("/submit", null, "Submitted for review.")}>
                Submit for review
              </Button>
            )}
            {actions.includes("approve") && can(profile, "ACTIVATE_PRODUCT") && !madeByMe && (
              <Button icon={CheckCircle2} busy={busy} disabled={!c.passed && false} onClick={() => act("/approve", { note: "Checklist reviewed" }, "Approved; manifest frozen.")}>
                Approve release
              </Button>
            )}
            {actions.includes("activate") && can(profile, "ACTIVATE_PRODUCT") && !madeByMe && (
              <Button icon={Rocket} busy={busy} onClick={() => act("/activate", null, "Released to the catalogue.")}>
                Activate
              </Button>
            )}
            {actions.includes("reject") && can(profile, "ACTIVATE_PRODUCT") && !madeByMe && (
              <Button variant="secondary" icon={XCircle} onClick={() => setReason({ verb: "reject", text: "" })}>
                Return to draft
              </Button>
            )}
            {actions.includes("withdraw") && can(profile, "ACTIVATE_PRODUCT") && (
              <Button variant="danger" icon={ShieldOff} onClick={() => setReason({ verb: "withdraw", text: "" })}>
                Withdraw from new business
              </Button>
            )}
            <Button variant="ghost" icon={Download} busy={busy} onClick={exportPackage}>
              Export signed package
            </Button>
          </div>
          {reason && (
            <div className="wf-reason">
              <textarea
                className="textarea"
                rows={2}
                maxLength={500}
                value={reason.text}
                onChange={(e) => setReason({ ...reason, text: e.target.value })}
                placeholder={reason.verb === "withdraw" ? "Why it comes off sale (issued policies keep their terms)" : "What must change before approval"}
              />
              <div className="detail-actions">
                <Button variant="secondary" onClick={() => setReason(null)}>
                  Back
                </Button>
                <Button
                  disabled={!reason.text.trim()}
                  busy={busy}
                  onClick={() =>
                    act("/" + reason.verb, { reason: reason.text.trim() }, reason.verb === "withdraw" ? "Withdrawn from new business." : "Returned to draft.")
                  }
                >
                  Confirm
                </Button>
              </div>
            </div>
          )}
          {actions.includes("rollback") && can(profile, "UPDATE_PRODUCT") && (versions.data || []).length > 1 && (
            <div className="detail-actions">
              <select aria-label="Version to roll back to" value={rollbackTo} onChange={(e) => setRollbackTo(e.target.value)}>
                <option value="">Roll back to version…</option>
                {(versions.data || []).map((v) => (
                  <option key={v.version} value={v.version}>
                    v{v.version} · {v.status} · {v.savedBy} · {when(v.savedAt)}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                icon={RotateCcw}
                disabled={!rollbackTo}
                busy={busy}
                onClick={() => act("/rollback", { version: Number(rollbackTo) }, "Content restored as a new draft.")}
              >
                Roll back
              </Button>
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}

/** Imports a signed package as a new draft; refused (with every reason) when a dependency is missing here. */
export function ImportPackageButton({ session, notify, onImported }) {
  const input = useRef(null);
  const { busy, run } = useAction(notify);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const text = await file.text();
          let pkg;
          try {
            pkg = JSON.parse(text);
          } catch {
            notify?.("That file is not a product package.", "error");
            return;
          }
          const saved = await run(async () => {
            const r = await request(session, "/portfolio/product-configs/import", { method: "POST", body: pkg });
            return r.data;
          }, "Package imported as a new draft.");
          if (saved) onImported?.(saved);
        }}
      />
      <button className="btn secondary" disabled={busy} onClick={() => input.current?.click()}>
        <FileUp size={16} />
        Import package
      </button>
    </>
  );
}
