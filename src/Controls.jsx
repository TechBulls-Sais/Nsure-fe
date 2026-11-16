import React, { useState } from "react";
import { History, Pencil, RefreshCw, TriangleAlert } from "lucide-react";
import { request } from "./api";
import {
  Badge,
  Button,
  DataTable,
  Drawer,
  Empty,
  ErrorNote,
  Field,
  FormGrid,
  Heading,
  Panel,
  Stat,
  Tabs,
  can,
  pula,
  useAction,
  useResource,
  when,
} from "./ui/workspace";
import { STP_INELIGIBLE_LABELS } from "./Workflow";
import "./access.css";

// Operational controls (spec 12): the switches and thresholds that govern claims, rates, payments and declarations,
// who changed them and why, plus the straight-through-processing monitor. Read with READ_CONTROL; any change needs
// UPDATE_CONTROL, which no role holds by default (C-10), and always a written reason.

const TYPE_LABELS = { TOGGLE: "On / off", THRESHOLD: "Threshold", DURATION: "Duration" };

const hasValue = (control) => control.type === "THRESHOLD" || control.type === "DURATION";

/** The unit a numeric control is measured in, read from its key (claim.stp_ceiling, rate.notice_days …). */
function unitOf(key = "") {
  if (/ceiling/.test(key)) return "BWP";
  if (/_days$/.test(key)) return "days";
  if (/_hours$/.test(key)) return "hours";
  if (/_minutes$/.test(key)) return "minutes";
  if (/_attempts$/.test(key)) return "attempts";
  return "";
}

function amount(value, key) {
  if (value == null || value === "") return "—";
  const unit = unitOf(key);
  if (unit === "BWP") return pula(value);
  const n = Number(value);
  const text = Number.isInteger(n) ? String(n) : n.toLocaleString("en-GB", { maximumFractionDigits: 2 });
  return unit ? text + " " + unit : text;
}

const failModeLabel = (mode) =>
  mode === "CLOSED" ? "Fails closed" : mode === "OPEN" ? "Fails open" : mode ? String(mode).toLowerCase() : "—";

const pct = (value) => (value == null ? "—" : Number(value).toLocaleString("en-GB", { maximumFractionDigits: 1 }) + "%");

export default function Controls({ session, notify, profile }) {
  const [tab, setTab] = useState("controls");
  const dashboard = useResource(session, "/admin/controls/stp-dashboard");
  const d = dashboard.data;
  return (
    <>
      <Heading
        eyebrow="ADMINISTRATION"
        title="Operational controls"
        subtitle="The switches and limits that keep claims, rates and payments safe: their state, who changed them, when and why."
      >
        <Button variant="secondary" icon={RefreshCw} onClick={dashboard.reload} busy={dashboard.loading && !!d}>
          Refresh
        </Button>
      </Heading>
      {d?.zeroRateAlert && (
        <div className="ctl-alert" role="alert">
          <TriangleAlert className="icon" strokeWidth={1.8} aria-hidden="true" />
          <div>
            <strong>Straight-through processing approved nothing in the last 7 days.</strong>
            {d.lodgedLast7Days} claim{d.lodgedLast7Days === 1 ? " was" : "s were"} lodged and none was approved
            straight through, although STP is switched on. If this reads 0%, STP is broken: check the ineligibility
            reasons below.
          </div>
        </div>
      )}
      {!can(profile, "UPDATE_CONTROL") && (
        <div className="notice">
          <TriangleAlert className="icon" strokeWidth={1.8} aria-hidden="true" />
          <p>
            You can see the controls but not change them. Changing a control needs UPDATE_CONTROL, which no role
            holds by default.
          </p>
        </div>
      )}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ["controls", "Controls"],
          ["stp", "Straight-through processing"],
          ["products", "Product STP policies"],
        ]}
      />
      {tab === "controls" && <ControlList session={session} notify={notify} profile={profile} onChange={dashboard.reload} />}
      {tab === "stp" && <StpDashboard dashboard={dashboard} />}
      {tab === "products" && <ProductPolicies session={session} notify={notify} profile={profile} />}
    </>
  );
}

function ControlList({ session, notify, profile, onChange }) {
  const controls = useResource(session, "/admin/controls", []);
  const [editing, setEditing] = useState(null);
  const [historyOf, setHistoryOf] = useState(null);
  const canChange = can(profile, "UPDATE_CONTROL");
  return (
    <Panel
      title="Controls"
      subtitle="A control that is off, or a threshold without a value, fails the way its fail mode says."
    >
      <ErrorNote error={controls.error} />
      <DataTable
        rowKey={(r) => r.key}
        rows={controls.data}
        loading={controls.loading}
        pageSize={0}
        empty="No controls are provisioned"
        searchPlaceholder="Search controls…"
        columns={[
          {
            key: "name",
            label: "Control",
            render: (r) => (
              <div className="ctl-name" title={r.description || undefined}>
                <strong>{r.name}</strong>
                <small>{r.key}</small>
              </div>
            ),
          },
          { key: "type", label: "Type", render: (r) => TYPE_LABELS[r.type] || r.type },
          {
            key: "enabled",
            label: "State",
            sortValue: (r) => (r.enabled ? 1 : 0),
            render: (r) => <Badge tone={r.enabled ? "green" : "red"}>{r.enabled ? "On" : "Off"}</Badge>,
          },
          {
            key: "numericValue",
            label: "Value",
            render: (r) => (hasValue(r) ? amount(r.numericValue, r.key) : "—"),
          },
          { key: "failMode", label: "Fail mode", render: (r) => failModeLabel(r.failMode) },
          {
            key: "lastChangedAt",
            label: "Last changed",
            sortValue: (r) => r.lastChangedAt || "",
            render: (r) =>
              r.lastChangedAt ? (
                <div className="ctl-name">
                  <strong>{r.lastChangedBy || "—"}</strong>
                  <small>{when(r.lastChangedAt)}</small>
                </div>
              ) : (
                <span className="muted">Never changed</span>
              ),
          },
          {
            key: "lastChangeReason",
            label: "Reason",
            render: (r) => r.lastChangeReason || "—",
          },
          {
            key: "act",
            label: "",
            render: (r) => (
              <div className="ws-row-actions">
                <Button variant="secondary" icon={History} onClick={() => setHistoryOf(r)}>
                  History
                </Button>
                {canChange && (
                  <Button variant="secondary" icon={Pencil} onClick={() => setEditing(r)}>
                    Change
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />
      {editing && (
        <ControlEditor
          session={session}
          notify={notify}
          control={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            controls.reload();
            onChange();
          }}
        />
      )}
      {historyOf && <ControlHistory session={session} control={historyOf} onClose={() => setHistoryOf(null)} />}
    </Panel>
  );
}

function ControlEditor({ session, notify, control, onClose, onSaved }) {
  const numeric = hasValue(control);
  const [enabled, setEnabled] = useState(Boolean(control.enabled));
  const [value, setValue] = useState(control.numericValue ?? "");
  const [reason, setReason] = useState("");
  const action = useAction(notify);
  const unit = unitOf(control.key);
  const valueChanged = numeric && value !== "" && Number(value) !== Number(control.numericValue);
  const changed = enabled !== Boolean(control.enabled) || valueChanged;
  const outOfRange =
    numeric &&
    value !== "" &&
    ((control.minValue != null && Number(value) < Number(control.minValue)) ||
      (control.maxValue != null && Number(value) > Number(control.maxValue)));
  const range =
    control.minValue != null || control.maxValue != null
      ? "Between " +
        (control.minValue != null ? amount(control.minValue, control.key) : "any") +
        " and " +
        (control.maxValue != null ? amount(control.maxValue, control.key) : "any") +
        "."
      : unit
        ? "In " + unit + "."
        : undefined;
  const submit = async () => {
    if (!changed) {
      action.setError("Nothing to change: switch the control or enter a new value first.");
      return;
    }
    if (!reason.trim()) {
      action.setError("Enter the reason for this change. It is recorded with the control.");
      return;
    }
    if (outOfRange) {
      action.setError(control.name + " must be " + (range || "within its range").replace(/^B/, "b"));
      return;
    }
    const body = { reason: reason.trim() };
    if (enabled !== Boolean(control.enabled)) body.enabled = enabled;
    if (valueChanged) body.numericValue = Number(value);
    const r = await action.run(
      () => request(session, "/admin/controls/" + encodeURIComponent(control.key), { method: "PUT", body }),
      control.name + " is updated.",
    );
    if (r) onSaved();
  };
  return (
    <Drawer title={"Change " + control.name} eyebrow={control.key} description={control.description} onClose={onClose}>
      <FormGrid submitLabel="Save change" busy={action.busy} error={action.error} onSubmit={submit}>
        <Field label="State" full hint={"When off, it " + failModeLabel(control.failMode).toLowerCase() + "."}>
          <span className="ctl-toggle">
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={control.name + " on"}
              className={"toggle " + (enabled ? "active" : "")}
              onClick={() => setEnabled(!enabled)}
            />
            {enabled ? "On" : "Off"}
          </span>
        </Field>
        {numeric && (
          <Field label={"Value" + (unit ? " (" + unit + ")" : "")} full hint={range}>
            <input
              type="number"
              step="any"
              min={control.minValue ?? undefined}
              max={control.maxValue ?? undefined}
              value={value}
              required
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
        )}
        <Field label="Reason (recorded with the change)" full>
          <textarea
            rows={3}
            maxLength={1000}
            required
            value={reason}
            placeholder="Why is this changing, and for how long?"
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        {control.enabled && !enabled && (
          <div className="notice full">
            <TriangleAlert className="icon" strokeWidth={1.8} aria-hidden="true" />
            <p>Switching this off alerts everyone who can read controls, with your name and reason.</p>
          </div>
        )}
      </FormGrid>
    </Drawer>
  );
}

function ControlHistory({ session, control, onClose }) {
  const history = useResource(session, "/admin/controls/" + encodeURIComponent(control.key) + "/history", []);
  const rows = history.data || [];
  const state = (v) => (v == null ? "—" : v ? "On" : "Off");
  return (
    <Drawer title={control.name + " history"} eyebrow={control.key} description={control.description} onClose={onClose}>
      <ErrorNote error={history.error} />
      {history.loading && !rows.length ? (
        <p className="muted">Loading history…</p>
      ) : !rows.length ? (
        <Empty text="No changes yet" detail="This control still has its installed setting." />
      ) : (
        <ol className="ctl-history">
          {rows.map((h, i) => (
            <li key={i}>
              <strong>
                {h.previousEnabled !== h.newEnabled
                  ? "Switched " + state(h.newEnabled).toLowerCase()
                  : "Value changed"}
                {hasValue(control) && h.previousValue !== h.newValue
                  ? " · " + amount(h.previousValue, control.key) + " → " + amount(h.newValue, control.key)
                  : ""}
              </strong>
              <small>
                {when(h.changedAt)} · {h.changedBy || "—"}
                {h.previousEnabled !== h.newEnabled ? " · " + state(h.previousEnabled) + " → " + state(h.newEnabled) : ""}
              </small>
              {h.reason && <p>{h.reason}</p>}
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}

function StpDashboard({ dashboard }) {
  const d = dashboard.data;
  const loading = dashboard.loading && !d;
  const reasons = Object.entries(d?.ineligibleReasons || {}).sort((a, b) => b[1] - a[1]);
  const most = reasons.reduce((max, [, count]) => Math.max(max, count), 0);
  return (
    <>
      <ErrorNote error={dashboard.error} />
      <div className="stat-grid">
        <Stat
          label="STP rate, all claims"
          value={pct(d?.stpRatePct)}
          note={d && d.stpApproved + " of " + d.claimsLodged + " claims straight through"}
          loading={loading}
        />
        <Stat
          label="STP rate, last 7 days"
          value={pct(d?.stpRateLast7DaysPct)}
          tone={d?.zeroRateAlert ? "red" : "blue"}
          note={d && d.stpLast7Days + " of " + d.lodgedLast7Days + " claims"}
          loading={loading}
        />
        <Stat
          label="STP switch"
          value={d ? (d.stpEnabled ? "On" : "Off") : "—"}
          tone={d && !d.stpEnabled ? "amber" : "green"}
          note={d && (d.stpCeiling != null ? "Ceiling " + pula(d.stpCeiling) : "No ceiling set")}
          loading={loading}
        />
        <Stat
          label="Four-eyes not applied"
          value={d ? d.fourEyesNotApplied?.length || 0 : "—"}
          tone={d?.fourEyesNotApplied?.length ? "amber" : "green"}
          note="Approved or paid without a second person"
          loading={loading}
        />
      </div>
      {d?.asOf && <p className="muted small">As of {when(d.asOf)}.</p>}
      <div className="ws-grid-2">
        <Panel title="Why claims were not straight through" subtitle="Claims by the first gate that stopped them">
          {loading ? (
            <p className="muted">Loading…</p>
          ) : reasons.length === 0 ? (
            <Empty text="No ineligible claims" detail="Every lodged claim that was checked went straight through." />
          ) : (
            <ul className="ctl-reasons">
              {reasons.map(([code, count]) => (
                <li key={code}>
                  <span>{STP_INELIGIBLE_LABELS[code] || code}</span>
                  <strong>{count}</strong>
                  <span className="ctl-bar" aria-hidden="true">
                    <span style={{ width: (most ? (count / most) * 100 : 0) + "%" }} />
                  </span>
                  <small className="ws-mono">{code}</small>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel
          title="Four-eyes not applied"
          subtitle="Claims approved by the person who assessed them (break-glass), or while the control was off"
        >
          <DataTable
            rowKey={(r) => r.claimRef}
            rows={d?.fourEyesNotApplied || []}
            loading={loading}
            pageSize={8}
            empty="Nothing to review"
            emptyDetail="Every manually reviewed claim was approved by a second person."
            columns={[
              { key: "claimRef", label: "Claim" },
              { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
              { key: "assessedBy", label: "Assessed by", render: (r) => r.assessedBy || "—" },
              { key: "approvedBy", label: "Approved by", render: (r) => r.approvedBy || "—" },
              { key: "detail", label: "Detail", render: (r) => r.detail || "—" },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}

function ProductPolicies({ session, notify, profile }) {
  const policies = useResource(session, "/admin/controls/stp-policies", []);
  const [editing, setEditing] = useState(null);
  const canChange = can(profile, "UPDATE_CONTROL");
  return (
    <Panel
      title="Product STP policies"
      subtitle="A product without its own policy follows the global switches and ceiling."
    >
      <ErrorNote error={policies.error} />
      <DataTable
        rowKey={(r) => r.productId}
        rows={policies.data}
        loading={policies.loading}
        empty="No products yet"
        searchPlaceholder="Search products…"
        onRowClick={canChange ? (r) => setEditing(r) : undefined}
        columns={[
          { key: "product", label: "Product" },
          {
            key: "overridden",
            label: "Policy",
            sortValue: (r) => (r.overridden ? 1 : 0),
            render: (r) => (r.overridden ? <Badge tone="purple">Own policy</Badge> : <Badge tone="gray">Defaults</Badge>),
          },
          {
            key: "stpEnabled",
            label: "STP",
            sortValue: (r) => (r.stpEnabled ? 1 : 0),
            render: (r) => <Badge tone={r.stpEnabled ? "green" : "red"}>{r.stpEnabled ? "On" : "Off"}</Badge>,
          },
          {
            key: "stpCeiling",
            label: "Ceiling",
            render: (r) => (r.stpCeiling != null ? pula(r.stpCeiling) : <span className="muted">Global ceiling</span>),
          },
          {
            key: "requiresVerifiedPayout",
            label: "Verified payout",
            sortValue: (r) => (r.requiresVerifiedPayout ? 1 : 0),
            render: (r) => (r.requiresVerifiedPayout ? "Required" : "Not required"),
          },
          {
            key: "maxClaimsPerPolicyPerYear",
            label: "Claims per policy a year",
            render: (r) => r.maxClaimsPerPolicyPerYear ?? <span className="muted">No limit</span>,
          },
          {
            key: "act",
            label: "",
            render: (r) =>
              canChange && (
                <Button variant="secondary" icon={Pencil} onClick={() => setEditing(r)}>
                  Edit
                </Button>
              ),
          },
        ]}
      />
      {editing && (
        <ProductPolicyEditor
          session={session}
          notify={notify}
          policy={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            policies.reload();
          }}
        />
      )}
    </Panel>
  );
}

function ProductPolicyEditor({ session, notify, policy, onClose, onSaved }) {
  const [form, setForm] = useState({
    stpEnabled: Boolean(policy.stpEnabled),
    stpCeiling: policy.stpCeiling ?? "",
    requiresVerifiedPayout: Boolean(policy.requiresVerifiedPayout),
    maxClaimsPerPolicyPerYear: policy.maxClaimsPerPolicyPerYear ?? "",
  });
  const action = useAction(notify);
  const submit = async () => {
    if (form.stpCeiling !== "" && Number(form.stpCeiling) < 0) {
      action.setError("The ceiling cannot be negative. Leave it empty to use the global ceiling.");
      return;
    }
    if (form.maxClaimsPerPolicyPerYear !== "" && !(Number(form.maxClaimsPerPolicyPerYear) >= 1)) {
      action.setError("The yearly claim limit must be at least 1, or empty for no limit.");
      return;
    }
    const r = await action.run(
      () =>
        request(session, "/admin/controls/stp-policies/" + policy.productId, {
          method: "PUT",
          body: {
            stpEnabled: form.stpEnabled,
            stpCeiling: form.stpCeiling === "" ? null : Number(form.stpCeiling),
            requiresVerifiedPayout: form.requiresVerifiedPayout,
            maxClaimsPerPolicyPerYear:
              form.maxClaimsPerPolicyPerYear === "" ? null : Math.round(Number(form.maxClaimsPerPolicyPerYear)),
          },
        }),
      policy.product + " STP policy is saved.",
    );
    if (r) onSaved();
  };
  return (
    <Drawer
      title={"STP policy · " + policy.product}
      description="Narrows straight-through processing for this product; the global controls still apply."
      onClose={onClose}
    >
      <FormGrid submitLabel="Save policy" busy={action.busy} error={action.error} onSubmit={submit}>
        <Field label="Straight-through processing" full>
          <span className="ctl-toggle">
            <button
              type="button"
              role="switch"
              aria-checked={form.stpEnabled}
              aria-label={"Straight-through processing for " + policy.product}
              className={"toggle " + (form.stpEnabled ? "active" : "")}
              onClick={() => setForm({ ...form, stpEnabled: !form.stpEnabled })}
            />
            {form.stpEnabled ? "On" : "Off for this product"}
          </span>
        </Field>
        <Field label="Ceiling (BWP)" hint="Empty uses the global STP ceiling.">
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.stpCeiling}
            onChange={(e) => setForm({ ...form, stpCeiling: e.target.value })}
          />
        </Field>
        <Field label="Claims per policy a year" hint="Empty means no limit.">
          <input
            type="number"
            min="1"
            step="1"
            value={form.maxClaimsPerPolicyPerYear}
            onChange={(e) => setForm({ ...form, maxClaimsPerPolicyPerYear: e.target.value })}
          />
        </Field>
        <Field label="Payout account" full>
          <span className="ctl-toggle">
            <input
              type="checkbox"
              checked={form.requiresVerifiedPayout}
              onChange={(e) => setForm({ ...form, requiresVerifiedPayout: e.target.checked })}
            />
            Straight-through needs a verified payout account
          </span>
        </Field>
      </FormGrid>
    </Drawer>
  );
}
