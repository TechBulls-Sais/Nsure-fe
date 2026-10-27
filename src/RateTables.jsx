import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  History,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { request } from "./api";
import "./rate-tables.css";

// Rate tables in the demo server's format (docs/spec/03 §3, 11 §4): a table per product plan,
// immutable versions, and a grid of age bands down by life types across, priced per month.

const amount = (value) =>
  value === null || value === undefined || value === ""
    ? "—"
    : Number(value).toLocaleString("en-GB", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
const pula = (value) => "BWP " + Number(value || 0).toLocaleString("en-GB");

let nextKey = 0;
const bandKey = () => "band-" + ++nextKey;

// The editable copy of a version's grid: strings, so a half-typed number survives a re-render.
function toDraft(grid) {
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
        coverAmount: draft.cover[lifeType] === "" ? null : Number(draft.cover[lifeType]),
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
      .filter((band) => band.premiums[type] !== "" && band.ageFrom !== "" && band.ageTo !== "")
      .sort((a, b) => Number(a.ageFrom) - Number(b.ageFrom));
    for (let i = 1; i < priced.length; i++) {
      if (Number(priced[i].ageFrom) <= Number(priced[i - 1].ageTo))
        add(
          priced[i].key,
          `${type}: ${priced[i].ageFrom}–${priced[i].ageTo} overlaps ${priced[i - 1].ageFrom}–${priced[i - 1].ageTo}.`,
        );
    }
    const used = draft.bands.some((band) => band.premiums[type] !== "");
    if (used && !(Number(draft.cover[type]) > 0)) add("cover", type + ": enter a cover amount.");
  }
  return bandIssues;
}

export default function RateTables({ session, notify }) {
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
            Age-banded monthly rates for each plan. Plans without a table use their flat premium.
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
                <th>Version</th>
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
                    <span className={"rt-status " + (t.active ? "live" : "off")}>
                      {t.version || "—"} {t.active ? "· Published" : "· Inactive"}
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

function RateTableDetail({ session, notify, reference, onBack }) {
  const [table, setTable] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const show = (data) => {
    setTable(data);
    setDraft(data.version ? toDraft(data.version) : { cover: {}, bands: [] });
  };
  const load = (version) =>
    request(session, "/admin/rate-tables/" + reference + (version ? "?version=" + version : ""))
      .then(({ data }) => {
        show(data);
        setError("");
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, [reference]);

  const grid = table?.version;
  const lifeTypes = grid?.lifeTypes || [];
  const editable = Boolean(grid?.current);
  const original = useMemo(() => (grid ? toDraft(grid) : null), [grid]);
  const problems = useMemo(
    () => (draft ? draftProblems(draft, lifeTypes) : {}),
    [draft, lifeTypes],
  );
  const dirty =
    draft && original
      ? JSON.stringify(draftRows(draft, lifeTypes)) !== JSON.stringify(draftRows(original, lifeTypes))
      : false;
  const problemCount = Object.values(problems).flat().length;

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

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const { data } = await request(session, "/admin/rate-tables/" + reference + "/grid", {
        method: "PUT",
        body: { baseVersion: grid.versionNo, rows: draftRows(draft, lifeTypes) },
      });
      show(data);
      notify(
        data.version.versionNo === grid.versionNo
          ? "No rate changes to save."
          : "Saved as " + data.version.label + ". " + grid.label + " is kept in the history.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const changed = (key, type) => {
    const before = original?.bands.find((band) => band.key === key);
    const now = draft.bands.find((band) => band.key === key);
    if (!before) return true;
    return before.premiums[type] !== now.premiums[type];
  };

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
        {editable && (
          <div className="heading-actions">
            <button
              className="btn secondary"
              disabled={!dirty || saving}
              onClick={() => setDraft(toDraft(grid))}
            >
              <RotateCcw size={15} /> Discard changes
            </button>
            <button
              className="btn primary"
              disabled={!dirty || saving || problemCount > 0}
              onClick={save}
            >
              <Save size={15} /> {saving ? "Saving…" : "Save as v" + (grid.versionNo + 1)}
            </button>
          </div>
        )}
      </div>

      <div className="rt-layout">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>
                Rates · {grid ? grid.label : "no version"}{" "}
                <span className={"rt-status " + (grid?.current ? "live" : "off")}>
                  {grid?.current ? "Current" : "Superseded · read only"}
                </span>
              </h2>
              <p className="subtitle">
                Monthly premium per life, by age last birthday. Bands are inclusive at both ends.
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
                      ) : grid.cover[type] != null ? (
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
          {!dirty && grid?.issues?.length > 0 && (
            <ul className="rt-issues rt-gaps">
              {grid.issues.map((text) => (
                <li key={text}>
                  <TriangleAlert size={14} /> {text}
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="panel rt-history">
          <div className="panel-header">
            <div>
              <h2>
                <History size={16} /> Version history
              </h2>
              <p className="subtitle">Versions are never edited; a change adds the next one.</p>
            </div>
          </div>
          <ol>
            {table.versions.map((v) => (
              <li key={v.versionNo} className={v.versionNo === grid?.versionNo ? "is-shown" : ""}>
                <button
                  onClick={() => load(v.current ? undefined : v.versionNo)}
                  aria-label={"Show " + v.label}
                >
                  <span className="rt-history-top">
                    <strong>{v.label}</strong>
                    <span className={"rt-status " + (v.current ? "live" : "off")}>
                      {v.current ? "Current" : "Superseded"}
                    </span>
                  </span>
                  <small>
                    {v.validFrom}
                    {v.validTo ? " → " + v.validTo : " → open"} · {v.rows} rows · {v.createdBy || "—"}
                  </small>
                  {v.changeSummary && <span className="rt-summary">{v.changeSummary}</span>}
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </>
  );
}
