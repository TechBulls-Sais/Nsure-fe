import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  Check,
  ChevronRight,
  Download,
  GitCompare,
  History,
  Info,
  Percent,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { fetchFile, request } from "./api";
import { Button, Dialog, Field, can, when } from "./ui/workspace";
import "./rate-tables.css";

// Rate tables in the demo server's format (docs/spec/03 §3, 11 §4): a table per product plan,
// versions, and a grid of age bands down by life types across, priced per month.
//
// Spec 11 §3 workflow: the editor never touches the live price. Saving writes the table's DRAFT; the author submits it
// (PENDING_APPROVAL); a second person with PUBLISH_RATE_TABLE approves it for a date (SCHEDULED, or PUBLISHED when that
// date is today) or rejects it back to the author. Only the PUBLISHED version prices quotes and policies.

const amount = (value) =>
  value === null || value === undefined || value === ""
    ? "—"
    : Number(value).toLocaleString("en-GB", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
const pula = (value) => "BWP " + Number(value || 0).toLocaleString("en-GB");
const pula2 = (value) => "BWP " + amount(value);
const pct = (value) =>
  value === null || value === undefined ? "—" : (Number(value) > 0 ? "+" : "") + amount(value) + "%";
const day = (value) =>
  value
    ? new Date(String(value).slice(0, 10) + "T00:00:00").toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";
const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// Status words and pill colours for each version state.
const STATUS = {
  DRAFT: ["Draft", "draft"],
  PENDING_APPROVAL: ["Pending approval", "pending"],
  SCHEDULED: ["Scheduled", "scheduled"],
  PUBLISHED: ["Published · live", "live"],
  SUPERSEDED: ["Superseded", "off"],
  REJECTED: ["Rejected", "rejected"],
};
// A scheduled version cancelled before it took effect is stored as REJECTED with this reason prefix.
const CANCELLED_PREFIX = "Cancelled before it took effect";
const isCancelled = (v) => v?.status === "REJECTED" && String(v.rejectionReason || "").startsWith(CANCELLED_PREFIX);
const EDITABLE = ["DRAFT", "REJECTED"];
const IN_FLIGHT = ["PENDING_APPROVAL", "SCHEDULED"];

function StatusPill({ version }) {
  if (!version) return null;
  const [label, tone] = STATUS[version.status] || [version.status || (version.current ? "Published · live" : "—"), "off"];
  return <span className={"rt-status " + tone}>{isCancelled(version) ? "Cancelled" : label}</span>;
}

let nextKey = 0;
const bandKey = () => "band-" + ++nextKey;

// The editable copy of a version's grid: strings, so a half-typed number survives a re-render.
function toDraft(grid) {
  if (!grid) return { cover: {}, bands: [] };
  return {
    cover: Object.fromEntries(
      grid.lifeTypes.map((type) => [type, grid.cover[type] != null ? String(grid.cover[type]) : ""]),
    ),
    // Loaded bands are keyed by position, so the saved copy and the draft line up cell for cell.
    bands: grid.bands.map((band, i) => ({
      key: "saved-" + i,
      ageFrom: String(band.ageFrom),
      ageTo: String(band.ageTo),
      premiums: Object.fromEntries(
        grid.lifeTypes.map((type) => [
          type,
          band.premiums[type] != null ? Number(band.premiums[type]).toFixed(2) : "",
        ]),
      ),
    })),
  };
}

function draftRows(draft, lifeTypes) {
  const rows = [];
  for (const band of draft.bands) {
    for (const lifeType of lifeTypes) {
      const premium = band.premiums[lifeType];
      if (premium === "" || premium === undefined) continue;
      rows.push({
        lifeType,
        ageFrom: band.ageFrom === "" ? null : Number(band.ageFrom),
        ageTo: band.ageTo === "" ? null : Number(band.ageTo),
        coverAmount: draft.cover[lifeType] === "" || draft.cover[lifeType] === undefined ? null : Number(draft.cover[lifeType]),
        monthlyPremium: Number(premium),
      });
    }
  }
  return rows;
}

// Client-side copy of rules V5–V8, so problems show while typing; the server checks again on save.
function draftProblems(draft, lifeTypes) {
  const bandIssues = {};
  const add = (key, text) => (bandIssues[key] = [...(bandIssues[key] || []), text]);
  for (const band of draft.bands) {
    const from = Number(band.ageFrom);
    const to = Number(band.ageTo);
    if (band.ageFrom === "" || band.ageTo === "" || from > to)
      add(band.key, "Age from must be less than or equal to age to.");
    else if (from < 0) add(band.key, "Age cannot be negative.");
    for (const type of lifeTypes) {
      const value = band.premiums[type];
      if (value !== "" && value !== undefined && !(Number(value) > 0))
        add(band.key, type + ": premium must be greater than 0.");
    }
  }
  for (const type of lifeTypes) {
    const priced = draft.bands
      .filter((band) => band.premiums[type] !== "" && band.premiums[type] !== undefined && band.ageFrom !== "" && band.ageTo !== "")
      .sort((a, b) => Number(a.ageFrom) - Number(b.ageFrom));
    for (let i = 1; i < priced.length; i++) {
      if (Number(priced[i].ageFrom) <= Number(priced[i - 1].ageTo))
        add(
          priced[i].key,
          `${type}: ${priced[i].ageFrom}–${priced[i].ageTo} overlaps ${priced[i - 1].ageFrom}–${priced[i - 1].ageTo}.`,
        );
    }
    const used = draft.bands.some((band) => band.premiums[type] !== "" && band.premiums[type] !== undefined);
    if (used && !(Number(draft.cover[type]) > 0)) add("cover", type + ": enter a cover amount.");
  }
  return bandIssues;
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export default function RateTables({ session, notify, profile }) {
  const [tables, setTables] = useState(null);
  const [error, setError] = useState("");
  const [openRef, setOpenRef] = useState(null);

  const load = () =>
    request(session, "/admin/rate-tables")
      .then(({ data }) => {
        setTables(data || []);
        setError("");
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  if (openRef)
    return (
      <RateTableDetail
        session={session}
        notify={notify}
        profile={profile}
        reference={openRef}
        onBack={() => {
          setOpenRef(null);
          load();
        }}
      />
    );

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR CONNECTED WORKSPACE</div>
          <h1>Rate tables</h1>
          <p className="subtitle">
            Age-banded monthly rates for each plan. Plans without a table use their flat premium. Changes are drafted,
            approved by a second person and only then published.
          </p>
        </div>
      </div>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Priced plans</h2>
            <p className="subtitle">
              {tables ? tables.length + " rate tables" : "Loading rate tables…"}
            </p>
          </div>
        </div>
        {error && (
          <p className="rt-error" role="alert">
            {error}
          </p>
        )}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rate table</th>
                <th>Type</th>
                <th>Plan cover</th>
                <th>Live version</th>
                <th>Effective from</th>
                <th>Rows</th>
                <th>Life types</th>
                <th>From</th>
                <th>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(tables || []).map((t) => (
                <tr key={t.ref}>
                  <td>
                    <button className="rt-link" onClick={() => setOpenRef(t.ref)}>
                      <strong>{t.title}</strong>
                      <small>{t.ref}</small>
                    </button>
                  </td>
                  <td>
                    <span className="rt-type">{t.productType || "—"}</span>
                  </td>
                  <td>
                    {pula(t.planCover)}
                    {t.coverUnit ? " / " + t.coverUnit : ""}
                  </td>
                  <td>
                    <span className={"rt-status " + (t.active && t.version ? "live" : "off")}>
                      {t.version || "None published"} {t.version ? (t.active ? "· Published" : "· Inactive") : ""}
                    </span>
                  </td>
                  <td className="muted">{t.validFrom}</td>
                  <td>{t.rows}</td>
                  <td className="rt-types-cell" title={t.lifeTypes.join(", ")}>
                    {t.lifeTypes.length > 2
                      ? t.lifeTypes.slice(0, 2).join(", ") + " +" + (t.lifeTypes.length - 2)
                      : t.lifeTypes.join(", ")}
                  </td>
                  <td>{t.fromPremium != null ? "BWP " + amount(t.fromPremium) + "/mo" : "—"}</td>
                  <td>
                    <button
                      className="icon-btn"
                      aria-label={"Open " + t.title}
                      onClick={() => setOpenRef(t.ref)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tables && !tables.length && (
            <p className="rt-empty">No plan is priced from a rate table yet.</p>
          )}
        </div>
      </section>
    </>
  );
}

function RateTableDetail({ session, notify, profile, reference, onBack }) {
  const canRead = can(profile, "READ_RATE_TABLE");
  const canWrite = can(profile, "UPDATE_RATE_TABLE");
  const canPublish = can(profile, "PUBLISH_RATE_TABLE");
  const [table, setTable] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  // approve | reject | cancel | diff | import | scale
  const [dialog, setDialog] = useState(null);

  const show = (data) => {
    setTable(data);
    setDraft(toDraft(data.version));
  };
  const load = (version) =>
    request(session, "/admin/rate-tables/" + reference + (version ? "?version=" + version : ""))
      .then(({ data }) => {
        // No published version yet: open the newest one (a draft or one awaiting approval) instead of an empty grid.
        if (!version && !data.version && data.versions?.length) {
          return load(data.versions[0].versionNo);
        }
        show(data);
        setError("");
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, [reference]);

  const versions = table?.versions || [];
  const grid = table?.version;
  const shown = grid ? versions.find((v) => v.versionNo === grid.versionNo) : null;
  const live = versions.find((v) => v.current) || versions.find((v) => v.status === "PUBLISHED");
  const openDraft = versions.find((v) => EDITABLE.includes(v.status));
  const inFlight = versions.find((v) => IN_FLIGHT.includes(v.status));
  const lifeTypes = useMemo(
    () => (grid?.lifeTypes?.length ? grid.lifeTypes : (table?.rules || []).map((rule) => rule.lifeType)),
    [grid, table],
  );
  // What the editor saves against: the open draft if there is one, otherwise the live version (saving then cuts a new
  // draft from it). Nothing can be saved while a version awaits approval or its effective date.
  const baseVersion = openDraft?.versionNo ?? live?.versionNo ?? null;
  const editable =
    canWrite &&
    !inFlight &&
    (openDraft ? shown?.versionNo === openDraft.versionNo : !versions.length || shown?.versionNo === live?.versionNo);
  const editingDraft = editable && Boolean(openDraft);
  const nextNo = versions.reduce((max, v) => Math.max(max, v.versionNo), 0) + 1;
  const original = useMemo(() => toDraft(grid), [grid]);
  const problems = useMemo(() => (draft ? draftProblems(draft, lifeTypes) : {}), [draft, lifeTypes]);
  const dirty =
    draft && original
      ? JSON.stringify(draftRows(draft, lifeTypes)) !== JSON.stringify(draftRows(original, lifeTypes))
      : false;
  const problemCount = Object.values(problems).flat().length;
  const reopening = editingDraft && shown?.status === "REJECTED";
  const notLive = shown && shown.status !== "PUBLISHED";

  if (!table)
    return (
      <div className="rt-loading">
        {error ? (
          <p className="rt-error" role="alert">
            {error}
          </p>
        ) : (
          "Loading rate table…"
        )}
      </div>
    );

  const setCell = (key, type, value) =>
    setDraft((d) => ({
      ...d,
      bands: d.bands.map((band) =>
        band.key === key ? { ...band, premiums: { ...band.premiums, [type]: value } } : band,
      ),
    }));
  const setBand = (key, field, value) =>
    setDraft((d) => ({
      ...d,
      bands: d.bands.map((band) => (band.key === key ? { ...band, [field]: value } : band)),
    }));
  const addBand = () =>
    setDraft((d) => {
      const last = d.bands[d.bands.length - 1];
      const from = last ? Number(last.ageTo) + 1 : 18;
      return {
        ...d,
        bands: [
          ...d.bands,
          {
            key: bandKey(),
            ageFrom: String(from),
            ageTo: String(from + 4),
            premiums: Object.fromEntries(lifeTypes.map((type) => [type, ""])),
          },
        ],
      };
    });
  const removeBand = (key) =>
    setDraft((d) => ({ ...d, bands: d.bands.filter((band) => band.key !== key) }));

  /** A detail the server answered with after a write: show it and say whether it is a draft. */
  const savedAsDraft = (data, how) => {
    show(data);
    const v = data.versions.find((x) => x.versionNo === data.version?.versionNo);
    if (!v || v.status === "PUBLISHED") {
      notify("No rate changes to save. " + (v ? v.label + " stays live." : ""), "info");
    } else {
      notify(
        how + " " + v.label + " as a draft. It is not live: submit it for approval to change prices.",
        "success",
      );
    }
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const { data } = await request(session, "/admin/rate-tables/" + reference + "/grid", {
        method: "PUT",
        body: { baseVersion, rows: draftRows(draft, lifeTypes) },
      });
      savedAsDraft(data, "Saved");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  /** A workflow step on the shown version. Returns the error (for a dialog to show) or null. */
  const step = async (path, body, done) => {
    setBusy(path);
    setError("");
    try {
      const { data } = await request(
        session,
        "/admin/rate-tables/" + reference + "/versions/" + shown.versionNo + "/" + path,
        { method: "POST", body },
      );
      show(data);
      notify(typeof done === "function" ? done(data) : done, "success");
      return null;
    } catch (e) {
      return e;
    } finally {
      setBusy("");
    }
  };

  const submit = async () => {
    const failed = await step(
      "submit",
      undefined,
      shown.label + " is submitted for approval. A second person with publishing rights approves or rejects it.",
    );
    if (failed) setError(failed.message);
  };

  const exportCsv = async () => {
    setBusy("export");
    try {
      const blob = await fetchFile(
        session,
        "/admin/rate-tables/" + reference + "/export" + (grid ? "?version=" + grid.versionNo : ""),
      );
      download(blob, (grid ? grid.label : reference) + ".csv");
      notify("Exported " + (grid ? grid.label : reference) + " as CSV.", "success");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy("");
    }
  };

  const changed = (key, type) => {
    const before = original?.bands.find((band) => band.key === key);
    const now = draft.bands.find((band) => band.key === key);
    if (!before) return true;
    return before.premiums[type] !== now.premiums[type];
  };

  const serverIssues = dirty ? [] : grid?.issues || [];
  const warnings = serverIssues.filter((text) => /^warning:/i.test(text));
  const gaps = serverIssues.filter((text) => !/^warning:/i.test(text));
  const inFlightNote = inFlight
    ? inFlight.label +
      " is " +
      (inFlight.status === "SCHEDULED" ? "scheduled" : "pending approval") +
      ". Approve, reject or cancel it before starting another change."
    : "";
  const blockedChange = inFlightNote || (dirty ? "Save or discard your grid changes first." : "");

  return (
    <>
      <div className="page-heading">
        <div>
          <button className="rt-back" onClick={onBack}>
            <ArrowLeft size={15} /> All rate tables
          </button>
          <h1>{table.title}</h1>
          <p className="subtitle">
            {table.ref} · {table.productType || "Product"} · {table.plan} plan cover{" "}
            {pula(table.planCover)}
            {table.coverUnit ? " / " + table.coverUnit : ""} · flat premium without this table BWP{" "}
            {table.flatPremium}/mo
          </p>
        </div>
        <div className="heading-actions">
          {canRead && (
            <Button variant="secondary" icon={Download} busy={busy === "export"} disabled={!grid} onClick={exportCsv}>
              Export CSV
            </Button>
          )}
          {canWrite && (
            <Button
              variant="secondary"
              icon={Upload}
              disabled={Boolean(blockedChange)}
              title={blockedChange || "Upload a CSV; you see the changes before anything is saved"}
              onClick={() => setDialog("import")}
            >
              Import CSV
            </Button>
          )}
          {canWrite && (
            <Button
              variant="secondary"
              icon={Percent}
              disabled={Boolean(blockedChange) || !versions.length}
              title={blockedChange || "Raise or lower every premium by a factor, as a draft"}
              onClick={() => setDialog("scale")}
            >
              Scale rates
            </Button>
          )}
          {editable && (
            <>
              <Button
                variant="secondary"
                icon={RotateCcw}
                disabled={!dirty || saving}
                onClick={() => setDraft(toDraft(grid))}
              >
                Discard changes
              </Button>
              <Button
                icon={Save}
                busy={saving}
                disabled={!(dirty || reopening) || problemCount > 0}
                onClick={save}
              >
                {editingDraft ? (reopening ? "Save and reopen draft" : "Save draft") : "Save as draft v" + nextNo}
              </Button>
            </>
          )}
        </div>
      </div>

      <VersionBanner
        shown={shown}
        live={live}
        openDraft={openDraft}
        inFlight={inFlight}
        editable={editable}
        flatPremium={table.flatPremium}
        onOpen={(v) => load(v.current ? undefined : v.versionNo)}
      />

      {shown && (
        <div className="rt-workflow">
          {shown.status === "DRAFT" && canWrite && (
            <Button
              icon={Send}
              busy={busy === "submit"}
              disabled={dirty || Boolean(busy)}
              title={dirty ? "Save your changes before submitting" : undefined}
              onClick={submit}
            >
              Submit for approval
            </Button>
          )}
          {shown.status === "PENDING_APPROVAL" && canPublish && (
            <>
              <Button icon={Check} disabled={Boolean(busy)} onClick={() => setDialog("approve")}>
                Approve…
              </Button>
              <Button variant="secondary" icon={X} disabled={Boolean(busy)} onClick={() => setDialog("reject")}>
                Reject…
              </Button>
            </>
          )}
          {shown.status === "SCHEDULED" && canPublish && (
            <Button variant="secondary" icon={Ban} disabled={Boolean(busy)} onClick={() => setDialog("cancel")}>
              Cancel scheduled version…
            </Button>
          )}
          {live && shown.versionNo !== live.versionNo && canRead && (
            <Button variant="secondary" icon={GitCompare} onClick={() => setDialog("diff")}>
              Compare with live ({live.label})
            </Button>
          )}
          {shown.status === "PENDING_APPROVAL" && !canPublish && (
            <span className="rt-workflow-note">
              Waiting for someone with publishing rights to approve or reject it.
            </span>
          )}
        </div>
      )}

      <div className="rt-layout">
        <div className="rt-main">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>
                  Rates · {grid ? grid.label : editable ? "new draft" : "no version"} <StatusPill version={shown} />
                  {grid && !editable && <span className="rt-readonly">read only</span>}
                </h2>
                <p className="subtitle">
                  Monthly premium per life, by age last birthday. Bands are inclusive at both ends.
                  {editable && !editingDraft && live && " Editing here starts a new draft; the live rates do not change."}
                </p>
              </div>
            </div>
            <div className="rt-rules">
              {table.rules.map((rule) => (
                <span key={rule.lifeType} className="rt-rule">
                  <strong>{rule.lifeType}</strong> ages {rule.minAge ?? 0}–{rule.maxAge ?? "any"} · up to{" "}
                  {rule.maxCount}
                </span>
              ))}
            </div>
            {error && (
              <p className="rt-error" role="alert">
                {error}
              </p>
            )}
            <div className="table-wrap">
              <table className="data-table rt-grid">
                <thead>
                  <tr>
                    <th>Age band</th>
                    {lifeTypes.map((type) => (
                      <th key={type}>{type}</th>
                    ))}
                    <th>
                      <span className="sr-only">Problems</span>
                    </th>
                  </tr>
                  <tr className="rt-cover-row">
                    <td>Cover (BWP)</td>
                    {lifeTypes.map((type) => (
                      <td key={type}>
                        {editable ? (
                          <input
                            aria-label={type + " cover amount"}
                            inputMode="decimal"
                            value={draft.cover[type] ?? ""}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, cover: { ...d.cover, [type]: e.target.value } }))
                            }
                          />
                        ) : grid?.cover[type] != null ? (
                          Number(grid.cover[type]).toLocaleString("en-GB")
                        ) : (
                          "—"
                        )}
                      </td>
                    ))}
                    <td>
                      {problems.cover && (
                        <span className="rt-warn" title={problems.cover.join("\n")}>
                          <TriangleAlert size={15} />
                        </span>
                      )}
                    </td>
                  </tr>
                </thead>
                <tbody>
                  {draft.bands.map((band) => (
                    <tr key={band.key} className={problems[band.key] ? "rt-bad" : ""}>
                      <td className="rt-band">
                        {editable ? (
                          <>
                            <input
                              aria-label="Age from"
                              inputMode="numeric"
                              value={band.ageFrom}
                              onChange={(e) => setBand(band.key, "ageFrom", e.target.value)}
                            />
                            <span>–</span>
                            <input
                              aria-label="Age to"
                              inputMode="numeric"
                              value={band.ageTo}
                              onChange={(e) => setBand(band.key, "ageTo", e.target.value)}
                            />
                          </>
                        ) : (
                          `${band.ageFrom} – ${band.ageTo}`
                        )}
                      </td>
                      {lifeTypes.map((type) => (
                        <td
                          key={type}
                          className={editable && changed(band.key, type) ? "rt-dirty" : ""}
                        >
                          {editable ? (
                            <input
                              aria-label={`${type} premium, ages ${band.ageFrom} to ${band.ageTo}`}
                              inputMode="decimal"
                              placeholder="—"
                              value={band.premiums[type] ?? ""}
                              onChange={(e) => setCell(band.key, type, e.target.value)}
                            />
                          ) : (
                            amount(band.premiums[type])
                          )}
                        </td>
                      ))}
                      <td className="rt-row-end">
                        {problems[band.key] && (
                          <span className="rt-warn" title={problems[band.key].join("\n")}>
                            <TriangleAlert size={15} />
                          </span>
                        )}
                        {editable && (
                          <button
                            className="icon-btn"
                            aria-label={`Remove band ${band.ageFrom} to ${band.ageTo}`}
                            onClick={() => removeBand(band.key)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!draft.bands.length && (
              <p className="rt-empty">
                {editable ? "No rates yet. Add an age band to start the first draft." : "This version has no rates."}
              </p>
            )}
            {editable && (
              <button className="rt-add" onClick={addBand}>
                <Plus size={15} /> Add age band
              </button>
            )}
            {problemCount > 0 && (
              <ul className="rt-issues" aria-live="polite">
                {Object.values(problems)
                  .flat()
                  .map((text, i) => (
                    <li key={i}>
                      <TriangleAlert size={14} /> {text}
                    </li>
                  ))}
              </ul>
            )}
            {gaps.length > 0 && (
              <div className="rt-issues rt-issue-block">
                <strong>
                  {gaps.length === 1 ? "1 gap" : gaps.length + " gaps"} · this version cannot be published until every
                  allowed age is priced
                </strong>
                <ul>
                  {gaps.map((text) => (
                    <li key={text}>
                      <TriangleAlert size={14} /> {text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {warnings.length > 0 && (
              <div className="rt-issues rt-warnings rt-issue-block">
                <strong>
                  {warnings.length === 1 ? "1 warning" : warnings.length + " warnings"} · worth a look, but they do not
                  block publishing
                </strong>
                <ul>
                  {warnings.map((text) => (
                    <li key={text}>
                      <Info size={14} /> {text.replace(/^warning:\s*/i, "")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {shown && ["DRAFT", "REJECTED", "PENDING_APPROVAL", "SCHEDULED"].includes(shown.status) && canRead && (
            <ImpactPanel session={session} reference={reference} version={shown} dirty={dirty} />
          )}
        </div>

        <aside className="panel rt-history">
          <div className="panel-header">
            <div>
              <h2>
                <History size={16} /> Versions
              </h2>
              <p className="subtitle">
                Drafted, submitted, approved, then published. Only the published version prices cover.
              </p>
            </div>
          </div>
          <ol>
            {versions.map((v) => (
              <li key={v.versionNo} className={v.versionNo === grid?.versionNo ? "is-shown" : ""}>
                <button onClick={() => load(v.current ? undefined : v.versionNo)} aria-label={"Show " + v.label}>
                  <span className="rt-history-top">
                    <strong>{v.label}</strong>
                    <StatusPill version={v} />
                  </span>
                  <VersionTrail version={v} />
                  {v.rejectionReason && (
                    <span className="rt-reason">
                      {isCancelled(v) ? "" : "Rejected: "}
                      {v.rejectionReason}
                    </span>
                  )}
                  {v.overrideReason && <span className="rt-reason override">{v.overrideReason}</span>}
                  {v.changeSummary && <span className="rt-summary">{v.changeSummary}</span>}
                </button>
              </li>
            ))}
          </ol>
          {!versions.length && <p className="rt-empty">No versions yet.</p>}
        </aside>
      </div>

      {dialog === "approve" && shown && (
        <ApproveDialog
          version={shown}
          live={live}
          profile={profile}
          busy={busy === "approve"}
          onClose={() => setDialog(null)}
          onApprove={async (body) => {
            const failed = await step("approve", body, (data) => {
              const v = data.versions.find((x) => x.versionNo === shown.versionNo);
              return v?.status === "PUBLISHED"
                ? shown.label + " is published. It prices new quotes and policies from today."
                : shown.label + " is approved and scheduled to take effect on " + day(v?.effectiveFrom) + ".";
            });
            if (!failed) setDialog(null);
            return failed;
          }}
        />
      )}
      {(dialog === "reject" || dialog === "cancel") && shown && (
        <ReasonDialog
          title={(dialog === "reject" ? "Reject " : "Cancel ") + shown.label + "?"}
          description={
            dialog === "reject"
              ? "It goes back to its author as an editable draft, with your reason."
              : "It will not take effect on " + day(shown.effectiveFrom) + ". The live rates stay as they are."
          }
          label={dialog === "reject" ? "Why is it rejected?" : "Why is it cancelled?"}
          confirmLabel={dialog === "reject" ? "Reject version" : "Cancel scheduled version"}
          busy={busy === dialog}
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            const failed = await step(
              dialog,
              { reason },
              dialog === "reject"
                ? shown.label + " is rejected and back with its author."
                : shown.label + " is cancelled; it will not take effect.",
            );
            if (!failed) setDialog(null);
            return failed;
          }}
        />
      )}
      {dialog === "diff" && shown && live && (
        <DiffDialog session={session} reference={reference} from={live} to={shown} onClose={() => setDialog(null)} />
      )}
      {dialog === "import" && (
        <ImportDialog
          session={session}
          reference={reference}
          live={live}
          onClose={() => setDialog(null)}
          onImported={(data) => {
            setDialog(null);
            savedAsDraft(data, "Imported");
          }}
        />
      )}
      {dialog === "scale" && (
        <ScaleDialog
          session={session}
          reference={reference}
          lifeTypes={lifeTypes}
          base={openDraft || live}
          onClose={() => setDialog(null)}
          onScaled={(data) => {
            setDialog(null);
            savedAsDraft(data, "Scaled rates saved in");
          }}
        />
      )}
    </>
  );
}

/** What the shown version is, and that only the published one is the live price. */
function VersionBanner({ shown, live, openDraft, inFlight, editable, flatPremium, onOpen }) {
  const pricedBy = live
    ? "Quotes and policies are priced from " + live.label + " (live)."
    : "No version is published yet, so this plan is priced at its flat premium (BWP " + flatPremium + "/mo).";
  let tone = "info";
  let title = "";
  let body = "";
  if (!shown) {
    title = editable ? "Start the first draft" : "No version to show";
    body = pricedBy;
  } else if (shown.status === "PUBLISHED") {
    tone = "live";
    title = shown.label + " is the live price";
    body =
      "Live since " +
      day(shown.validFrom) +
      (shown.approvedBy ? ", approved by " + shown.approvedBy : "") +
      "." +
      (editable ? " Editing starts a draft; the live price changes only when a draft is approved and published." : "");
  } else if (shown.status === "DRAFT") {
    tone = "draft";
    title = "Draft · not the live price";
    body =
      pricedBy +
      " This draft changes nothing until it is submitted, approved by a second person and published.";
  } else if (shown.status === "REJECTED") {
    tone = "rejected";
    title = isCancelled(shown) ? "Cancelled · not the live price" : "Rejected · back with its author";
    body =
      (shown.rejectionReason ? shown.rejectionReason.replace(/\.?$/, ". ") : "") +
      (editable ? "Edit and save it to reopen it as a draft, then submit it again. " : "") +
      pricedBy;
  } else if (shown.status === "PENDING_APPROVAL") {
    tone = "pending";
    title = "Pending approval · not the live price";
    body = "Submitted" + (shown.submittedBy ? " by " + shown.submittedBy : "") + ". " + pricedBy;
  } else if (shown.status === "SCHEDULED") {
    tone = "scheduled";
    title = "Scheduled for " + day(shown.effectiveFrom) + " · not live yet";
    body =
      "Approved" +
      (shown.approvedBy ? " by " + shown.approvedBy : "") +
      ". It becomes the live price on " +
      day(shown.effectiveFrom) +
      ". Until then: " +
      pricedBy.charAt(0).toLowerCase() +
      pricedBy.slice(1);
  } else if (shown.status === "SUPERSEDED") {
    tone = "off";
    title = "Superseded · history only";
    body = "Was live " + day(shown.validFrom) + (shown.validTo ? " to " + day(shown.validTo) : "") + ". " + pricedBy;
  }
  // Point to work in progress when looking at another version.
  const elsewhere = [openDraft, inFlight].filter((v) => v && v.versionNo !== shown?.versionNo);
  return (
    <div className={"rt-banner " + tone} role="status">
      {tone === "scheduled" ? <CalendarClock size={18} aria-hidden="true" /> : <Info size={18} aria-hidden="true" />}
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
      {elsewhere.length > 0 && (
        <div className="rt-banner-actions">
          {elsewhere.map((v) => (
            <button key={v.versionNo} type="button" className="btn secondary" onClick={() => onOpen(v)}>
              Open {v.label} ({(STATUS[v.status] || [v.status])[0].toLowerCase()})
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Who did what to a version, and when. */
function VersionTrail({ version: v }) {
  const lines = [];
  if (v.createdBy) lines.push((v.status === "DRAFT" ? "Drafted by " : "Author ") + v.createdBy);
  if (v.submittedBy) lines.push("Submitted by " + v.submittedBy);
  if (v.approvedBy) lines.push("Approved by " + v.approvedBy);
  if (v.effectiveFrom && ["SCHEDULED", "PUBLISHED", "SUPERSEDED"].includes(v.status))
    lines.push("Effective " + day(v.effectiveFrom));
  if (["PUBLISHED", "SUPERSEDED"].includes(v.status) && v.validFrom)
    lines.push(day(v.validFrom) + (v.validTo ? " → " + day(v.validTo) : " → open"));
  lines.push(v.rows + " rows" + (v.source ? " · " + v.source.toLowerCase() : ""));
  if (v.updatedAt) lines.push("Updated " + when(v.updatedAt));
  return (
    <small className="rt-trail">
      {lines.map((line, i) => (
        <span key={i}>{line}</span>
      ))}
    </small>
  );
}

/** E-20: every in-force policy on the plan re-priced against this version, compared with what it pays now. */
function ImpactPanel({ session, reference, version, dirty }) {
  const [impact, setImpact] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const run = () => {
    setLoading(true);
    setError("");
    request(session, "/admin/rate-tables/" + reference + "/versions/" + version.versionNo + "/impact")
      .then(({ data }) => setImpact(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    setImpact(null);
    run();
  }, [reference, version.versionNo, version.updatedAt]);
  const movement = Number(impact?.movementAmount || 0);
  return (
    <section className="panel rt-impact">
      <div className="panel-header">
        <div>
          <h2>Impact on the in-force book</h2>
          <p className="subtitle">
            Every active and no-cover policy on this plan priced with {version.label}, against what it pays today.
            {dirty ? " Based on the saved version; save to include your edits." : ""}
          </p>
        </div>
        <Button variant="secondary" icon={RefreshCw} busy={loading} onClick={run}>
          Recalculate
        </Button>
      </div>
      {error && (
        <p className="rt-error" role="alert">
          {error}
        </p>
      )}
      {!impact && loading && <p className="rt-empty">Pricing the in-force book…</p>}
      {impact && (
        <>
          <div className="rt-impact-grid">
            <div>
              <small>Policies affected</small>
              <strong>{impact.policiesAffected}</strong>
            </div>
            <div>
              <small>Monthly income today</small>
              <strong>{pula2(impact.currentMonthlyIncome)}</strong>
            </div>
            <div>
              <small>Monthly income with {impact.version}</small>
              <strong>{pula2(impact.projectedMonthlyIncome)}</strong>
            </div>
            <div className={movement > 0 ? "up" : movement < 0 ? "down" : ""}>
              <small>Movement</small>
              <strong>
                {(movement > 0 ? "+" : "") + pula2(impact.movementAmount)} ({pct(impact.movementPct)})
              </strong>
            </div>
            <div className={impact.policiesIncreasingOver10Pct ? "warn" : ""}>
              <small>Rising by more than 10%</small>
              <strong>{impact.policiesIncreasingOver10Pct}</strong>
            </div>
            <div className={impact.policiesBecomingUnrateable?.length ? "bad" : ""}>
              <small>Could not be priced</small>
              <strong>{impact.policiesBecomingUnrateable?.length || 0}</strong>
            </div>
          </div>
          {impact.policiesBecomingUnrateable?.length > 0 && (
            <div className="rt-issues rt-issue-block">
              <strong>Policies this version could not price (they would keep their current premium)</strong>
              <ul>
                {impact.policiesBecomingUnrateable.map((line) => (
                  <li key={line}>
                    <TriangleAlert size={14} /> {line}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="rt-asof">As of {when(impact.asOf)}</p>
        </>
      )}
    </section>
  );
}

/** PENDING_APPROVAL → SCHEDULED (future date) or PUBLISHED (today), with the notice rule and four-eyes. */
function ApproveDialog({ version, live, profile, busy, onClose, onApprove }) {
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [noticeIssuedAt, setNoticeIssuedAt] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [error, setError] = useState(null);
  const ownVersion =
    Boolean(profile?.username) && String(version.createdBy || "").toLowerCase() === profile.username.toLowerCase();
  const needsNotice = error?.status === 409;
  const approve = async () => {
    setError(null);
    const failed = await onApprove({
      effectiveFrom: effectiveFrom || undefined,
      noticeIssuedAt: noticeIssuedAt || undefined,
      overrideReason: overrideReason.trim() || undefined,
    });
    if (failed) setError(failed);
  };
  const scheduled = effectiveFrom && effectiveFrom > today();
  return (
    <Dialog
      title={"Approve " + version.label}
      eyebrow="RATE APPROVAL"
      description={
        scheduled
          ? "It will be scheduled and becomes the live price on " + day(effectiveFrom) + "."
          : "Effective today: it is published straight away and prices new quotes and policies."
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={Check} busy={busy} onClick={approve}>
            {scheduled ? "Approve and schedule" : "Approve and publish"}
          </Button>
        </>
      }
    >
      <div className="rt-dialog-grid">
        <Field label="Effective from" hint="Today publishes now; a later date schedules it.">
          <input
            className="input"
            type="date"
            min={today()}
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
        </Field>
        <Field
          label="Written notice issued on"
          hint={live ? "A re-rate needs written notice to policyholders before it takes effect." : "Not needed: there is no live version to re-rate."}
        >
          <input
            className={"input" + (needsNotice ? " rt-attention" : "")}
            type="date"
            value={noticeIssuedAt}
            onChange={(e) => setNoticeIssuedAt(e.target.value)}
          />
        </Field>
        <Field
          label="Override reason (optional)"
          full
          hint={
            ownVersion
              ? "You authored this version. With four-eyes on, a second approver must publish it, unless you hold the break-glass permission and give a reason here."
              : "Needed only to publish a re-rate without enough notice. It is recorded on the version."
          }
        >
          <textarea
            className={"textarea" + (needsNotice ? " rt-attention" : "")}
            rows={3}
            maxLength={450}
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />
        </Field>
      </div>
      {ownVersion && !error && (
        <p className="rt-note">
          <TriangleAlert size={14} aria-hidden="true" /> You authored this version.
        </p>
      )}
      {error && (
        <p className="rt-error rt-dialog-error" role="alert">
          {error.message}
          {needsNotice && "\nEnter the date the notice was issued (or a later effective date), or give an override reason."}
        </p>
      )}
    </Dialog>
  );
}

/** Reject (PENDING_APPROVAL) or cancel (SCHEDULED): a reason is required. */
function ReasonDialog({ title, description, label, confirmLabel, busy, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  return (
    <Dialog
      title={title}
      description={description}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Back
          </Button>
          <Button
            variant="danger"
            busy={busy}
            disabled={!reason.trim()}
            onClick={async () => {
              setError("");
              const failed = await onConfirm(reason.trim());
              if (failed) setError(failed.message);
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Field label={label} full>
        <textarea
          className="textarea"
          rows={3}
          maxLength={450}
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      {error && (
        <p className="rt-error rt-dialog-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}

function DiffStats({ added, removed, changed, averageMovementPct }) {
  return (
    <div className="rt-diff-stats">
      <span>
        <strong>{changed}</strong> changed
      </span>
      <span>
        <strong>{added}</strong> added
      </span>
      <span>
        <strong>{removed}</strong> removed
      </span>
      <span>
        <strong>{pct(averageMovementPct)}</strong> average movement
      </span>
    </div>
  );
}

function DiffLines({ lines }) {
  if (!lines?.length) return <p className="rt-empty">No differences.</p>;
  return (
    <ul className="rt-diff-lines">
      {lines.map((line, i) => (
        <li
          key={i}
          className={/^added/i.test(line) ? "added" : /^removed/i.test(line) ? "removed" : "changed"}
        >
          {line}
        </li>
      ))}
    </ul>
  );
}

/** "Compare with live": the readable diff from the live version to the shown one. */
function DiffDialog({ session, reference, from, to, onClose }) {
  const [diff, setDiff] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    request(session, "/admin/rate-tables/" + reference + "/versions/" + from.versionNo + "/diff/" + to.versionNo)
      .then(({ data }) => setDiff(data))
      .catch((e) => setError(e.message));
  }, [session, reference, from.versionNo, to.versionNo]);
  return (
    <Dialog
      title={to.label + " compared with live " + from.label}
      eyebrow="RATE CHANGES"
      description={diff?.summary}
      size="lg"
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {error && (
        <p className="rt-error rt-dialog-error" role="alert">
          {error}
        </p>
      )}
      {!diff && !error && <p className="rt-empty">Comparing…</p>}
      {diff && (
        <>
          <DiffStats {...diff} />
          <DiffLines lines={diff.lines} />
        </>
      )}
    </Dialog>
  );
}

/** Upload a CSV, see the dry run against the live version (nothing written), then confirm it as a DRAFT. */
function ImportDialog({ session, reference, live, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const choose = async (event) => {
    const picked = event.target.files?.[0] || null;
    setResult(null);
    setError("");
    setFile(picked);
    // A spreadsheet's UTF-8 byte-order mark would hide the header row from the server's parser.
    setCsv(picked ? (await picked.text()).replace(/^﻿/, "") : "");
  };
  const dryRun = async () => {
    setBusy("check");
    setError("");
    try {
      const { data } = await request(session, "/admin/rate-tables/" + reference + "/import", {
        method: "POST",
        body: { csv },
      });
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };
  const confirm = async () => {
    setBusy("confirm");
    setError("");
    try {
      const { data } = await request(session, "/admin/rate-tables/" + reference + "/import/confirm", {
        method: "POST",
        body: { csv, dryRunToken: result.dryRunToken },
      });
      onImported(data);
    } catch (e) {
      setError(e.message);
      if (e.status === 409) setResult(null);
    } finally {
      setBusy("");
    }
  };
  const clean = result && !result.issues?.length && result.dryRunToken;
  return (
    <Dialog
      title="Import rates from CSV"
      eyebrow="RATE IMPORT"
      description="Checked first against the live rates; nothing is saved until you confirm, and confirming creates a draft, never a live price."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {clean ? (
            <Button icon={Check} busy={busy === "confirm"} onClick={confirm}>
              Create draft from this file
            </Button>
          ) : (
            <Button icon={RefreshCw} busy={busy === "check"} disabled={!csv.trim()} onClick={dryRun}>
              Check file
            </Button>
          )}
        </>
      }
    >
      <Field
        label="CSV file"
        full
        hint="Columns: product_code, plan, life_type, age_from, age_to, cover_amount, monthly_premium (the same format as Export CSV)."
      >
        <input className="input" type="file" accept=".csv,text/csv" onChange={choose} />
      </Field>
      {file && (
        <p className="rt-note">
          {file.name} · {csv.split(/\r?\n/).filter((line) => line.trim()).length} lines
        </p>
      )}
      {error && (
        <p className="rt-error rt-dialog-error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div className="rt-import-result">
          <h3>Dry run against {live ? "live " + live.label : "an empty table"}</h3>
          <DiffStats
            added={result.addedRows}
            removed={result.removedRows}
            changed={result.changedRows}
            averageMovementPct={result.averageMovementPct}
          />
          {result.issues?.length > 0 && (
            <div className="rt-issues rt-issue-block">
              <strong>
                {result.issues.length === 1 ? "1 problem" : result.issues.length + " problems"} · fix the file and
                check it again
              </strong>
              <ul>
                {result.issues.map((text, i) => (
                  <li key={i}>
                    <TriangleAlert size={14} /> {text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <DiffLines lines={result.diff} />
          {clean && <p className="rt-note">The file is clean. Confirming saves it as a draft for approval.</p>}
        </div>
      )}
    </Dialog>
  );
}

/** E-10: every premium (or one life type's) multiplied by a factor, saved as a DRAFT. */
function ScaleDialog({ session, reference, lifeTypes, base, onClose, onScaled }) {
  const [factor, setFactor] = useState("1.05");
  const [lifeType, setLifeType] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const value = Number(factor);
  const valid = factor.trim() !== "" && value > 0 && value <= 10;
  const scale = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await request(session, "/admin/rate-tables/" + reference + "/scale", {
        method: "POST",
        body: { factor: factor.trim(), ...(lifeType ? { lifeType } : {}) },
      });
      onScaled(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title="Scale rates"
      eyebrow="BULK CHANGE"
      description={
        "Multiplies premiums from " +
        (base ? base.label + (base.status === "PUBLISHED" ? " (live)" : " (the open draft)") : "the current rates") +
        " and saves the result as a draft. Nothing changes live until it is approved."
      }
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={Percent} busy={busy} disabled={!valid} onClick={scale}>
            Save as draft
          </Button>
        </>
      }
    >
      <div className="rt-dialog-grid">
        <Field label="Factor" hint="e.g. 1.05 raises by 5%, 0.97 lowers by 3%.">
          <input
            className="input"
            type="number"
            step="0.0001"
            min="0.0001"
            max="10"
            value={factor}
            onChange={(e) => setFactor(e.target.value)}
          />
        </Field>
        <Field label="Life type">
          <select className="input" value={lifeType} onChange={(e) => setLifeType(e.target.value)}>
            <option value="">All life types</option>
            {lifeTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {valid && (
        <p className="rt-note">
          {lifeType || "Every"} premium × {value} ({pct((value - 1) * 100)})
        </p>
      )}
      {error && (
        <p className="rt-error rt-dialog-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
