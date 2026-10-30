import React, { useState } from "react";
import { CheckCircle2, Plus, Rocket, Send, Trash2, XCircle } from "lucide-react";
import { request } from "./api";
import { environmentLabel } from "./insurer";
import {
  Badge,
  Button,
  DataTable,
  ErrorNote,
  Field,
  FormGrid,
  Heading,
  Panel,
  Stat,
  can,
  useAction,
  useResource,
  when,
} from "./ui/workspace";

// Insurer configuration releases (guide §7, §12, §16). A maker drafts the extra policy fields per product and
// submits; a different user approves or rejects; a deployer activates. Approved content is fixed by its checksum.

const TYPES = ["STRING", "NUMBER", "DATE", "BOOLEAN", "ENUM"];
const TYPE_LABELS = { STRING: "Text", NUMBER: "Number", DATE: "Date", BOOLEAN: "Yes / no", ENUM: "Choice" };
const STATUS_LABELS = {
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ACTIVE: "Active",
  RETIRED: "Retired",
};

const blankField = () => ({ key: "", label: "", type: "STRING", required: false, sensitive: false, maxLength: 100, allowedValues: "" });

export default function ConfigReleases({ session, notify, profile, products = [] }) {
  const deployment = useResource(session, "/admin/deployment");
  const releases = useResource(session, "/admin/config-releases", []);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(null);
  const d = deployment.data;
  const reload = () => {
    releases.reload();
    deployment.reload();
  };
  const selected = open && (releases.data || []).find((r) => r.id === open);
  return (
    <>
      <Heading
        eyebrow="INSTALLATION & CONFIGURATION"
        title="Configuration"
        subtitle="This installation's insurer, schema and approved business configuration. Differences between insurers live here as versioned data, not in code."
      >
        {can(profile, "MANAGE_CONFIG") && !editing && (
          <Button
            icon={Plus}
            onClick={() => {
              setOpen(null);
              setEditing({ code: "", description: "", forms: [{ product: products[0]?.name || "", fields: [blankField()] }] });
            }}
          >
            New release
          </Button>
        )}
      </Heading>
      {d && (
        <div className="stat-grid">
          <Stat label="Insurer" value={d.displayName} note={d.insurerCode} />
          <Stat label="Environment" value={environmentLabel(d.environment)} tone="blue" note={"Bound " + when(d.boundAt)} />
          <Stat label="Schema changesets" value={d.schema.changesets} tone="amber" note={"Last: " + d.schema.lastChangeset} />
          <Stat
            label="Active releases"
            value={d.activeConfigReleases.length}
            note={d.activeConfigReleases.join(", ") || "None"}
          />
        </div>
      )}
      {d && (
        <p className="subtitle">
          Installation <span className="ws-mono">{d.installationUuid}</span> · this backend only ever serves{" "}
          <strong>{d.insurerCode}</strong>; another insurer runs its own installation and database.
        </p>
      )}
      <ErrorNote error={deployment.error} />
      {editing && (
        <ReleaseEditor
          session={session}
          notify={notify}
          products={products}
          draft={editing}
          onCancel={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            setOpen(saved.id);
            reload();
          }}
        />
      )}
      <Panel title="Releases" subtitle="Draft → in review → approved → active. Rejected and retired releases stay as history.">
        <ErrorNote error={releases.error} />
        <DataTable
          rows={releases.data}
          empty="No configuration releases yet"
          onRowClick={(r) => setOpen(open === r.id ? null : r.id)}
          columns={[
            { key: "code", label: "Release" },
            { key: "description", label: "Description" },
            { key: "status", label: "Status", render: (r) => <Badge>{STATUS_LABELS[r.status] || r.status}</Badge> },
            { key: "forms", label: "Products", render: (r) => r.forms.map((f) => f.product + (f.versionNo ? " v" + f.versionNo : "")).join(", ") },
            { key: "createdBy", label: "Drafted by" },
            { key: "approvedBy", label: "Reviewed by", render: (r) => r.approvedBy || "—" },
            { key: "activatedAt", label: "Activated", render: (r) => when(r.activatedAt) },
          ]}
        />
      </Panel>
      {selected && (
        <ReleaseDetail
          key={selected.id + ":" + selected.rowVersion}
          session={session}
          notify={notify}
          profile={profile}
          release={selected}
          onEdit={() => {
            setEditing({
              id: selected.id,
              expectedVersion: selected.rowVersion,
              code: selected.code,
              description: selected.description,
              forms: selected.forms.map((f) => ({
                product: f.product,
                fields: f.fields.map((x) => ({ ...x, allowedValues: (x.allowedValues || []).join(", ") })),
              })),
            });
            setOpen(null);
          }}
          onChanged={reload}
        />
      )}
    </>
  );
}

function ReleaseDetail({ session, notify, profile, release, onEdit, onChanged }) {
  const action = useAction(notify);
  const [reason, setReason] = useState("");
  const me = profile?.username;
  const independent = release.createdBy !== me && release.submittedBy !== me;
  const act = async (verb, label, extra = {}) => {
    const done = await action.run(
      () =>
        request(session, `/admin/config-releases/${release.id}/${verb}`, {
          method: "POST",
          body: { expectedVersion: release.rowVersion, ...extra },
        }),
      `${release.code} ${label}`,
    );
    if (done) onChanged();
  };
  return (
    <Panel
      title={release.code + " · " + (STATUS_LABELS[release.status] || release.status)}
      subtitle={release.description}
    >
      <div className="ws-kv">
        <div><small>Drafted</small><strong>{release.createdBy} · {when(release.createdAt)}</strong></div>
        <div><small>Submitted</small><strong>{release.submittedBy ? release.submittedBy + " · " + when(release.submittedAt) : "—"}</strong></div>
        <div><small>Reviewed</small><strong>{release.approvedBy ? release.approvedBy + " · " + when(release.approvedAt) : "—"}</strong></div>
        <div><small>Activated</small><strong>{release.activatedBy ? release.activatedBy + " · " + when(release.activatedAt) : "—"}</strong></div>
        <div><small>Checksum</small><strong className="ws-mono">{release.checksum ? release.checksum.slice(0, 16) + "…" : "set on submit"}</strong></div>
        <div><small>Schema at submit</small><strong>{release.schemaVersion || "—"}</strong></div>
      </div>
      {release.rejectionReason && <ErrorNote error={"Rejected: " + release.rejectionReason} />}
      {release.forms.map((form) => (
        <div key={form.product}>
          <h3 className="section-title">
            {form.product} {form.versionNo ? <Badge tone="blue">form v{form.versionNo} · {form.status.toLowerCase()}</Badge> : null}
          </h3>
          <DataTable
            rowKey={(f) => f.key}
            rows={form.fields}
            columns={[
              { key: "label", label: "Field" },
              { key: "key", label: "Key", render: (f) => <span className="ws-mono">{f.key}</span> },
              { key: "type", label: "Type", render: (f) => TYPE_LABELS[f.type] || f.type },
              { key: "required", label: "Required", render: (f) => (f.required ? "Yes" : "No") },
              { key: "sensitive", label: "Sensitive", render: (f) => (f.sensitive ? "Yes" : "No") },
              {
                key: "rules",
                label: "Rules",
                render: (f) => (f.type === "ENUM" ? f.allowedValues.join(" / ") : f.maxLength ? "≤ " + f.maxLength + " chars" : "—"),
              },
            ]}
          />
        </div>
      ))}
      <ErrorNote error={action.error} />
      <div className="ws-form-actions">
        {release.status === "DRAFT" && can(profile, "MANAGE_CONFIG") && (
          <>
            <Button variant="secondary" onClick={onEdit}>
              Edit draft
            </Button>
            <Button icon={Send} busy={action.busy} onClick={() => act("submit", "submitted for review")}>
              Submit for review
            </Button>
          </>
        )}
        {release.status === "IN_REVIEW" &&
          can(profile, "APPROVE_CONFIG") &&
          (independent ? (
            <>
              <input
                aria-label="Rejection reason"
                placeholder="Reason, if rejecting"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button variant="secondary" icon={XCircle} busy={action.busy} onClick={() => act("reject", "rejected", { reason })}>
                Reject
              </Button>
              <Button icon={CheckCircle2} busy={action.busy} onClick={() => act("approve", "approved")}>
                Approve
              </Button>
            </>
          ) : (
            <small className="ws-hint">You drafted or submitted this release; another user must review it.</small>
          ))}
        {release.status === "APPROVED" && can(profile, "ACTIVATE_CONFIG") && (
          <Button icon={Rocket} busy={action.busy} onClick={() => act("activate", "activated")}>
            Activate for new business
          </Button>
        )}
      </div>
    </Panel>
  );
}

function ReleaseEditor({ session, notify, products, draft, onCancel, onSaved }) {
  const [release, setRelease] = useState(draft);
  const action = useAction(notify);
  const setForm = (i, form) => setRelease({ ...release, forms: release.forms.map((f, j) => (j === i ? form : f)) });
  const save = async () => {
    const body = {
      ...(release.id ? { expectedVersion: release.expectedVersion } : { code: release.code }),
      description: release.description,
      forms: release.forms.map((form) => ({
        product: form.product,
        fields: form.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required,
          sensitive: f.sensitive,
          maxLength: f.type === "STRING" ? Number(f.maxLength) || 100 : undefined,
          allowedValues: f.type === "ENUM" ? String(f.allowedValues).split(",").map((v) => v.trim()).filter(Boolean) : undefined,
          helpText: f.helpText || undefined,
        })),
      })),
    };
    const r = await action.run(
      () =>
        request(session, release.id ? "/admin/config-releases/" + release.id : "/admin/config-releases", {
          method: release.id ? "PUT" : "POST",
          body,
        }),
      "Draft saved",
    );
    if (r) onSaved(r.data);
  };
  return (
    <Panel title={release.id ? "Edit draft " + release.code : "New configuration release"} subtitle="Extra policy fields per product. Core values such as cover and premium are not configurable here.">
      <FormGrid
        busy={action.busy}
        error={action.error}
        onSubmit={save}
        submitLabel="Save draft"
        extra={
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        }
      >
        <Field label="Release code">
          <input
            value={release.code}
            disabled={Boolean(release.id)}
            placeholder="e.g. 2026-R2"
            onChange={(e) => setRelease({ ...release, code: e.target.value })}
            required
          />
        </Field>
        <Field label="Description">
          <input value={release.description} onChange={(e) => setRelease({ ...release, description: e.target.value })} required />
        </Field>
        {release.forms.map((form, i) => (
          <div className="full" key={i}>
            <h3 className="section-title">
              <select
                aria-label="Product"
                value={form.product}
                onChange={(e) => setForm(i, { ...form, product: e.target.value })}
              >
                {products.map((p) => (
                  <option key={p.name}>{p.name}</option>
                ))}
              </select>{" "}
              <Button
                type="button"
                variant="secondary"
                icon={Trash2}
                onClick={() => setRelease({ ...release, forms: release.forms.filter((_, j) => j !== i) })}
              >
                Remove product
              </Button>
            </h3>
            {form.fields.map((field, k) => {
              const setField = (patch) =>
                setForm(i, { ...form, fields: form.fields.map((f, m) => (m === k ? { ...f, ...patch } : f)) });
              return (
                <div className="field-grid" key={k}>
                  <Field label="Label">
                    <input value={field.label} onChange={(e) => setField({ label: e.target.value })} required />
                  </Field>
                  <Field label="Key (camelCase)">
                    <input value={field.key} placeholder="employerReference" onChange={(e) => setField({ key: e.target.value })} required />
                  </Field>
                  <Field label="Type">
                    <select value={field.type} onChange={(e) => setField({ type: e.target.value })}>
                      {TYPES.map((t) => (
                        <option key={t} value={t}>
                          {TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {field.type === "STRING" && (
                    <Field label="Max length">
                      <input type="number" min="1" max="500" value={field.maxLength} onChange={(e) => setField({ maxLength: e.target.value })} />
                    </Field>
                  )}
                  {field.type === "ENUM" && (
                    <Field label="Allowed values (comma separated)">
                      <input value={field.allowedValues} onChange={(e) => setField({ allowedValues: e.target.value })} required />
                    </Field>
                  )}
                  <Field label="Rules">
                    <span>
                      <label>
                        <input type="checkbox" checked={field.required} onChange={(e) => setField({ required: e.target.checked })} /> Required
                      </label>{" "}
                      <label>
                        <input type="checkbox" checked={field.sensitive} onChange={(e) => setField({ sensitive: e.target.checked })} /> Sensitive
                      </label>{" "}
                      <Button
                        type="button"
                        variant="secondary"
                        icon={Trash2}
                        onClick={() => setForm(i, { ...form, fields: form.fields.filter((_, m) => m !== k) })}
                      >
                        Remove
                      </Button>
                    </span>
                  </Field>
                </div>
              );
            })}
            <Button type="button" variant="secondary" icon={Plus} onClick={() => setForm(i, { ...form, fields: [...form.fields, blankField()] })}>
              Add field
            </Button>
          </div>
        ))}
        <div className="full">
          <Button
            type="button"
            variant="secondary"
            icon={Plus}
            onClick={() =>
              setRelease({
                ...release,
                forms: [...release.forms, { product: products.find((p) => !release.forms.some((f) => f.product === p.name))?.name || "", fields: [blankField()] }],
              })
            }
          >
            Add product form
          </Button>
        </div>
      </FormGrid>
    </Panel>
  );
}
