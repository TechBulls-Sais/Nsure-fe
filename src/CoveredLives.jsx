import React, { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { request } from "./api";
import { money } from "./data";
import "./covered-lives.css";

// The customer is always the main insured (the self relationship); these screens add everyone else.
const SELF = "Main Insured";

/** Who a rate-table tier lets you add beside the main insured (its life assured rules, spec 03 R-7). */
export function addableLives(tier) {
  return tier?.priceIsFrom ? (tier.lives || []).filter((rule) => rule.lifeType !== SELF) : [];
}

export function completeLives(lives) {
  return lives.filter((life) => life.relationship && life.fullName.trim() && life.dateOfBirth);
}

/** What a save sends: every life as entered, so the server can refuse an incomplete one by name. */
export function livesBody(lives) {
  return lives.map(({ relationship, fullName, dateOfBirth }) => ({
    relationship,
    fullName: fullName.trim(),
    dateOfBirth,
  }));
}

/** Lives back from a saved record, minus the main insured, ready to re-price (issuing an application). */
export function otherLives(record) {
  return (record?.lives || [])
    .filter((life) => life.relationship !== SELF)
    .map(({ relationship, fullName, dateOfBirth }) => ({ relationship, fullName, dateOfBirth }));
}

/**
 * The server's price for a tier and its complete lives, refreshed as they change. The server applies the
 * plan's rules and the current rate table version, so what is shown is what a save will store (R-18).
 */
export function useLifeQuote(session, path, body, enabled) {
  const [state, setState] = useState({ quote: null, error: "", loading: false });
  const key = enabled ? JSON.stringify(body) : "";
  useEffect(() => {
    if (!key) {
      setState({ quote: null, error: "", loading: false });
      return undefined;
    }
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    const timer = window.setTimeout(async () => {
      try {
        const result = await request(session, path, { method: "POST", body: JSON.parse(key) });
        if (live) setState({ quote: result.data, error: "", loading: false });
      } catch (err) {
        if (live) setState({ quote: null, error: err.message, loading: false });
      }
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [session, path, key]);
  return state;
}

// Per-life rates and their totals are quoted to the thebe, even when a rate happens to be whole pula.
function premium(value) {
  return "BWP " + Number(value || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ageRange(rule) {
  if (rule.minAge != null && rule.maxAge != null) return rule.minAge + "–" + rule.maxAge;
  if (rule.minAge != null) return rule.minAge + "+";
  return rule.maxAge != null ? "up to " + rule.maxAge : "any age";
}

/**
 * The lives on a rate-table-priced plan: the main insured (the customer) plus anyone the plan's rules allow,
 * each priced by age from the server's quote.
 */
export default function CoveredLives({ tier, mainName, lives, onChange, quote, error, loading }) {
  const rules = addableLives(tier);
  const today = new Date().toISOString().slice(0, 10);
  const counts = lives.reduce((all, life) => ({ ...all, [life.relationship]: (all[life.relationship] || 0) + 1 }), {});
  const complete = completeLives(lives);
  // Quote lines follow the request: the main insured, then each complete life in order.
  const lines = quote?.lives || [];
  let next = 1;
  const priced = lives.map((life) => (complete.includes(life) ? lines[next++] : null));
  const update = (index, patch) => onChange(lives.map((life, i) => (i === index ? { ...life, ...patch } : life)));
  const incomplete = lives.length - complete.length;
  return (
    <section className="covered-lives" aria-label="Covered lives">
      <header>
        <strong>Covered lives</strong>
        <small>
          Each life is priced by age{quote?.rateTableVersion ? " from " + quote.rateTableVersion : ""}.
        </small>
      </header>
      <ul>
        <li className="covered-life covered-life-main">
          <div>
            <strong>{mainName || "Customer"}</strong>
            <small>{SELF}{lines[0] ? " · age " + lines[0].age : ""}</small>
          </div>
          <span className="covered-life-price">{lines[0] ? premium(lines[0].monthlyPremium) : "—"}</span>
        </li>
        {lives.map((life, index) => {
          const rule = rules.find((r) => r.lifeType === life.relationship);
          const line = priced[index];
          return (
            <li className="covered-life" key={life.key}>
              <div className="covered-life-fields">
                <input
                  aria-label="Full name"
                  placeholder="Full name"
                  value={life.fullName}
                  maxLength={200}
                  onChange={(e) => update(index, { fullName: e.target.value })}
                />
                <select
                  aria-label="Relationship"
                  value={life.relationship}
                  onChange={(e) => update(index, { relationship: e.target.value })}
                >
                  {rules.map((r) => (
                    <option key={r.lifeType} value={r.lifeType}>
                      {r.lifeType}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Date of birth"
                  type="date"
                  max={today}
                  value={life.dateOfBirth}
                  onChange={(e) => update(index, { dateOfBirth: e.target.value })}
                />
              </div>
              <span className="covered-life-price">
                {line ? premium(line.monthlyPremium) : "—"}
                {line && <small>age {line.age} · cover {money(line.coverAmount)}</small>}
                {!line && rule && <small>ages {ageRange(rule)}</small>}
              </span>
              <button
                type="button"
                className="covered-life-remove"
                aria-label={"Remove " + (life.fullName || life.relationship)}
                onClick={() => onChange(lives.filter((_, i) => i !== index))}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      {rules.length > 0 && (
        <div className="covered-lives-add">
          {rules.map((rule) => {
            const full = (counts[rule.lifeType] || 0) >= rule.maxCount;
            return (
              <button
                type="button"
                key={rule.lifeType}
                disabled={full}
                aria-label={"Add " + rule.lifeType + " (" + (counts[rule.lifeType] || 0) + " of " + rule.maxCount + ", ages " + ageRange(rule) + ")"}
                title={"Ages " + ageRange(rule) + ", up to " + rule.maxCount}
                onClick={() =>
                  onChange([
                    ...lives,
                    {
                      key: Date.now() + "-" + Math.random(),
                      relationship: rule.lifeType,
                      fullName: "",
                      dateOfBirth: "",
                    },
                  ])
                }
              >
                <Plus size={13} aria-hidden="true" /> {rule.lifeType}
                <small>
                  {counts[rule.lifeType] || 0}/{rule.maxCount}
                </small>
              </button>
            );
          })}
        </div>
      )}
      {error ? (
        <p className="covered-lives-error" role="alert">
          {error}
        </p>
      ) : (
        <footer>
          <span>
            {incomplete
              ? "Add a name and date of birth to price " + (incomplete === 1 ? "the new life." : "the new lives.")
              : loading
                ? "Pricing…"
                : (lines.length || 1) + (lines.length === 1 ? " life" : " lives") + " · monthly premium"}
          </span>
          <strong>{quote ? premium(quote.premium) : "—"}</strong>
        </footer>
      )}
    </section>
  );
}

/** A saved record's lives: why its premium is what it is (spec 03 R-16). */
export function LifeCoverList({ lives }) {
  if (!lives?.length) return null;
  return (
    <ul className="covered-lives covered-lives-saved">
      {lives.map((life, index) => (
        <li className="covered-life" key={index}>
          <div>
            <strong>{life.fullName}</strong>
            <small>
              {life.relationship} · age {life.age} at entry · cover {money(life.coverAmount)}
            </small>
          </div>
          <span className="covered-life-price">{premium(life.monthlyPremium)}</span>
        </li>
      ))}
    </ul>
  );
}
