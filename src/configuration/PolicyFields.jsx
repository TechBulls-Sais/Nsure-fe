import React, { useEffect, useState } from "react";
import { Pencil, Save } from "lucide-react";
import { request } from "../api";
import { Badge, Button, ErrorNote } from "../ui/workspace";

// Insurer-configured extra policy fields (guide §15). The server sends a bounded form definition; this file only
// renders the allow-listed types and sends values back for the server to validate. Nothing here evaluates code.

/** The active form for new business on a product: { form, error }. form.fields is [] when none is configured. */
export function usePolicyForm(session, product) {
  const [state, setState] = useState({ form: null, error: "" });
  useEffect(() => {
    if (!product) return undefined;
    let active = true;
    request(session, "/configuration/forms/policy?product=" + encodeURIComponent(product))
      .then((r) => active && setState({ form: r.data, error: "" }))
      .catch((e) => active && setState({ form: null, error: e.message }));
    return () => {
      active = false;
    };
  }, [session, product]);
  return state;
}

function inputFor(field, value, onChange) {
  const common = { "aria-label": field.label, required: field.required };
  switch (field.type) {
    case "NUMBER":
      return <input type="number" step="any" value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...common} />;
    case "DATE":
      return <input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...common} />;
    case "BOOLEAN":
      return (
        <select value={value === undefined || value === "" ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? "" : e.target.value === "true")} {...common}>
          <option value="">Choose…</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    case "ENUM":
      return (
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...common}>
          <option value="">Choose…</option>
          {field.allowedValues.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      );
    default:
      return (
        <input
          value={value ?? ""}
          maxLength={field.maxLength || undefined}
          onChange={(e) => onChange(e.target.value)}
          {...common}
        />
      );
  }
}

/** Renders a form's fields on the app's field grid; values is a plain object keyed by field key. */
export function CustomFieldInputs({ form, values, onChange }) {
  if (!form?.fields?.length) return null;
  return (
    <>
      <h3 className="section-title">
        Additional details <small className="ws-hint">· {form.releaseCode} v{form.versionNo}</small>
      </h3>
      <div className="field-grid">
        {form.fields.map((field) => (
          <label className="form-label" key={field.key}>
            <span>
              {field.label}
              {field.required ? " *" : ""}
            </span>
            {inputFor(field, values[field.key], (v) => onChange({ ...values, [field.key]: v }))}
            {field.helpText && <small className="ws-hint">{field.helpText}</small>}
          </label>
        ))}
      </div>
    </>
  );
}

/** Drops blank values so an optional field left empty is simply absent. */
export const cleanValues = (values) =>
  Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "" && v !== undefined && v !== null));

const show = (field, value) =>
  value === undefined || value === null || value === ""
    ? "—"
    : field?.type === "BOOLEAN"
      ? value === true ? "Yes" : value === false ? "No" : String(value)
      : String(value);

/** A policy's extra details against the form it was issued under, editable with stale-version protection. */
export function PolicyAttributesPanel({ session, policyRef, canEdit, notify }) {
  const [view, setView] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = React.useCallback(async () => {
    try {
      const r = await request(session, `/portfolio/policies/${encodeURIComponent(policyRef)}/attributes`);
      setView(r.data);
      setError("");
    } catch (e) {
      setError(e.status === 403 ? "" : e.message);
    }
  }, [session, policyRef]);
  useEffect(() => {
    load();
  }, [load]);
  if (!view?.form) return error ? <ErrorNote error={error} /> : null;
  const save = async () => {
    setBusy(true);
    try {
      const r = await request(session, `/portfolio/policies/${encodeURIComponent(policyRef)}/attributes`, {
        method: "PUT",
        body: { expectedVersion: view.rowVersion, customAttributes: cleanValues(editing) },
      });
      setView(r.data);
      setEditing(null);
      setError("");
      notify?.("Additional details saved");
    } catch (e) {
      setError(e.status === 409 ? e.message + " Showing the latest values." : e.message);
      if (e.status === 409) {
        setEditing(null);
        load();
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <h3 className="section-title">
        Additional details{" "}
        <Badge tone={view.currentForm ? "green" : "blue"}>
          {view.form.releaseCode} v{view.form.versionNo}
          {view.currentForm ? "" : " · earlier form"}
        </Badge>
      </h3>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <CustomFieldInputs form={{ ...view.form, fields: view.form.fields }} values={editing} onChange={setEditing} />
          <ErrorNote error={error} />
          <div className="ws-form-actions">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" icon={Save} busy={busy}>
              Save details
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="detail-grid">
            {view.form.fields.map((field) => (
              <div key={field.key}>
                <small>{field.label}</small>
                <strong>{show(field, view.values[field.key])}</strong>
              </div>
            ))}
          </div>
          <ErrorNote error={error} />
          {canEdit && (
            <div className="ws-form-actions">
              <Button variant="secondary" icon={Pencil} onClick={() => setEditing({ ...view.values })}>
                Edit details
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
