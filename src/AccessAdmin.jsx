import React, { useEffect, useId, useState } from "react";
import { request } from "./api";
import { Dialog, useConfirm } from "./ui/workspace";

const PROTECTED_PERMISSIONS = new Set([
  "ALL_FUNCTIONS",
  "ALL_FUNCTIONS_READ",
  "CHECKER_SUPER_USER",
]);

export default function AccessAdmin({ session, notify }) {
  const [tab, setTab] = useState("roles");
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [offices, setOffices] = useState([]);
  const [editor, setEditor] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  async function confirmDelete(kind, name) {
    return confirm({
      title: `Delete ${kind} ${name}?`,
      message: (
        <>
          The {kind} <strong>{name}</strong> is deleted permanently. This cannot be undone.
        </>
      ),
      confirmLabel: `Delete ${kind}`,
      tone: "danger",
    });
  }

  async function load() {
    const [rolesR, permissionsR, usersR, officesR] = await Promise.all([
      request(session, "/roles"),
      request(session, "/permissions"),
      request(session, "/users"),
      request(session, "/offices"),
    ]);
    setRoles(rolesR.data);
    setPermissions(permissionsR.data);
    setUsers(usersR.data);
    setOffices(officesR.data);
  }

  useEffect(() => {
    let active = true;
    load().catch((err) => {
      if (active) setError(err.message);
    });
    return () => {
      active = false;
    };
  }, [session]);

  async function run(work, saved) {
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
      setEditor(null);
      notify(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR CONNECTED WORKSPACE</div>
          <h1>Access</h1>
          <p className="subtitle">
            Roles, permissions, and users. Only a super admin can open this page.
          </p>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="access-tabs" role="tablist">
        {[
          ["roles", "Roles"],
          ["permissions", "Permissions"],
          ["users", "Users"],
        ].map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={"filter-tab " + (tab === key ? "active" : "")}
            onClick={() => {
              setTab(key);
              setEditor(null);
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "roles" && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Roles</h2>
              <p className="subtitle">Choose which permissions each role may use.</p>
            </div>
            <button className="btn secondary" onClick={() => setEditor({ kind: "role", record: emptyRole() })}>
              New role
            </button>
          </div>
          <ResourceTable
            columns={["Role", "Description", "Permissions", "Status"]}
            rows={roles}
            render={(role) => (
              <>
                <td>{role.name}</td>
                <td>{role.description}</td>
                <td>{role.permissions?.length || 0}</td>
                <td>{role.disabled ? "Disabled" : "Active"}</td>
              </>
            )}
            editable={() => true}
            removable={(role) => role.name !== "Super user"}
            onEdit={(role) => setEditor({ kind: "role", record: role })}
            onDelete={async (role) => {
              if (!(await confirmDelete("role", role.name))) return;
              run(
                () => request(session, "/roles/" + role.id, { method: "DELETE" }),
                "Role deleted.",
              );
            }}
          />
        </section>
      )}

      {tab === "permissions" && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Permissions</h2>
              <p className="subtitle">Codes the application checks before an action.</p>
            </div>
            <button
              className="btn secondary"
              onClick={() => setEditor({ kind: "permission", record: emptyPermission() })}
            >
              New permission
            </button>
          </div>
          <ResourceTable
            columns={["Code", "Function", "Group", "Entity", "Action"]}
            rows={permissions}
            render={(permission) => (
              <>
                <td>{permission.code}</td>
                <td>{permission.functionName || "—"}</td>
                <td>{permission.grouping}</td>
                <td>{permission.entityName || "—"}</td>
                <td>{permission.actionName || "—"}</td>
              </>
            )}
            editable={(permission) => !PROTECTED_PERMISSIONS.has(permission.code)}
            removable={(permission) => !PROTECTED_PERMISSIONS.has(permission.code)}
            onEdit={(permission) => setEditor({ kind: "permission", record: permission })}
            onDelete={async (permission) => {
              if (!(await confirmDelete("permission", permission.code))) return;
              run(
                () => request(session, "/permissions/" + permission.id, { method: "DELETE" }),
                "Permission deleted.",
              );
            }}
          />
        </section>
      )}

      {tab === "users" && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Users</h2>
              <p className="subtitle">Assign one or more roles to each person.</p>
            </div>
            <button
              className="btn secondary"
              onClick={() =>
                setEditor({
                  kind: "user",
                  record: emptyUser(offices[0]?.id),
                })
              }
            >
              New user
            </button>
          </div>
          <ResourceTable
            columns={["Username", "Office", "Roles", "Status"]}
            rows={users}
            render={(user) => (
              <>
                <td>{user.username}</td>
                <td>{user.officeName || "—"}</td>
                <td>{(user.roles || []).join(", ") || "None"}</td>
                <td>{user.enabled ? "Active" : "Disabled"}</td>
              </>
            )}
            editable={() => true}
            removable={(user) => user.username !== "admin" && user.username !== "system"}
            onEdit={(user) => setEditor({ kind: "user", record: { ...user, password: "" } })}
            onDelete={async (user) => {
              if (!(await confirmDelete("user", user.username))) return;
              run(
                () => request(session, "/users/" + user.id, { method: "DELETE" }),
                "User deleted.",
              );
            }}
          />
        </section>
      )}

      {editor && (
        <Editor
          editor={editor}
          setEditor={setEditor}
          roles={roles}
          permissions={permissions}
          offices={offices}
          busy={busy}
          onSave={(body) => save(editor, body, session, run)}
        />
      )}
    </>
  );
}

function groupPermissions(permissions) {
  const groups = new Map();
  for (const permission of permissions) {
    const group = permission.grouping || "other";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(permission);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function ResourceTable({ columns, rows, render, onEdit, onDelete, editable, removable }) {
  return (
    <div className="table-wrap">
      <table className="data-table access-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
            <th className="access-actions">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {render(row)}
              <td className="access-actions">
                {editable(row) && (
                  <button className="btn secondary" onClick={() => onEdit(row)}>
                    Edit
                  </button>
                )}{" "}
                {removable(row) && (
                  <button className="btn secondary" onClick={() => onDelete(row)}>
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + 1}>Nothing here yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Editor({ editor, setEditor, roles, permissions, offices, busy, onSave }) {
  const [form, setForm] = useState(editor.record);
  const title =
    editor.kind === "role"
      ? form.id
        ? "Edit role"
        : "New role"
      : editor.kind === "permission"
        ? form.id
          ? "Edit permission"
          : "New permission"
        : form.id
          ? "Edit user"
          : "New user";
  const formId = useId();
  const confirm = useConfirm();

  async function submit() {
    const before = editor.record;
    if (form.id && editor.kind === "role") {
      const kept = new Set(form.permissions || []);
      const removed = (before.permissions || []).filter((code) => !kept.has(code));
      const disabling = !before.disabled && !!form.disabled;
      if (disabling || removed.length) {
        const ok = await confirm({
          title: disabling
            ? `Disable role ${form.name}?`
            : `Remove ${removed.length} permission${removed.length === 1 ? "" : "s"} from ${form.name}?`,
          message: (
            <>
              {disabling && (
                <p>
                  The role <strong>{form.name}</strong> is saved as disabled.
                </p>
              )}
              {removed.length > 0 && (
                <p>
                  These permissions are removed from <strong>{form.name}</strong>: {removed.join(", ")}.
                </p>
              )}
            </>
          ),
          confirmLabel: disabling ? "Disable role" : "Remove permissions",
          tone: "danger",
        });
        if (!ok) return;
      }
    }
    if (form.id && editor.kind === "user" && before.enabled !== false && form.enabled === false) {
      const ok = await confirm({
        title: `Disable user ${form.username}?`,
        message: (
          <>
            <strong>{form.username}</strong> is saved as disabled and can no longer sign in.
          </>
        ),
        confirmLabel: "Disable user",
        tone: "danger",
      });
      if (!ok) return;
    }
    onSave(form);
  }

  return (
    <Dialog
      title={title}
      eyebrow="Access"
      onClose={() => setEditor(null)}
      size="lg"
      footer={
        <>
          <button type="button" className="btn secondary" onClick={() => setEditor(null)}>
            Cancel
          </button>
          <button className="btn primary" form={formId} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {editor.kind === "role" && (
          <>
            <label className="form-label">
              Name
              <input
                className="input"
                value={form.name}
                required
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className="form-label">
              Description
              <input
                className="input"
                value={form.description}
                required
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </label>
            <label className="form-label">
              <span>
                <input
                  type="checkbox"
                  checked={!!form.disabled}
                  onChange={(event) => setForm({ ...form, disabled: event.target.checked })}
                />{" "}
                Disabled
              </span>
            </label>
            <fieldset className="perm-group">
              <h3>
                Permissions
                <span className="perm-total">
                  {(form.permissions || []).length} of {permissions.length} selected
                </span>
              </h3>
              {groupPermissions(permissions).map(([group, items]) => (
                <div key={group} className="perm-section">
                  <h4>{group}</h4>
                  <div className="perm-grid">
                    {items.map((permission) => (
                      <label key={permission.code} className="perm-option">
                        <input
                          type="checkbox"
                          checked={(form.permissions || []).includes(permission.code)}
                          onChange={(event) => {
                            const current = new Set(form.permissions || []);
                            if (event.target.checked) current.add(permission.code);
                            else current.delete(permission.code);
                            setForm({ ...form, permissions: [...current] });
                          }}
                        />
                        <span>
                          <span className="perm-function">
                            {permission.functionName || permission.code}
                          </span>
                          <span className="perm-code">{permission.code}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>
          </>
        )}
        {editor.kind === "permission" && (
          <div className="field-grid">
            <label className="form-label">
              Code
              <input
                className="input"
                value={form.code}
                required
                onChange={(event) => setForm({ ...form, code: event.target.value })}
              />
            </label>
            <label className="form-label">
              Function
              <input
                className="input"
                value={form.functionName || ""}
                placeholder="e.g. Create actuary profile"
                maxLength={150}
                onChange={(event) => setForm({ ...form, functionName: event.target.value })}
              />
            </label>
            <label className="form-label">
              Group
              <input
                className="input"
                value={form.grouping}
                required
                onChange={(event) => setForm({ ...form, grouping: event.target.value })}
              />
            </label>
            <label className="form-label">
              Entity
              <input
                className="input"
                value={form.entityName || ""}
                onChange={(event) => setForm({ ...form, entityName: event.target.value })}
              />
            </label>
            <label className="form-label">
              Action
              <input
                className="input"
                value={form.actionName || ""}
                onChange={(event) => setForm({ ...form, actionName: event.target.value })}
              />
            </label>
          </div>
        )}
        {editor.kind === "user" && (
          <>
            <div className="field-grid">
              <label className="form-label">
                Username
                <input
                  className="input"
                  value={form.username}
                  required
                  onChange={(event) => setForm({ ...form, username: event.target.value })}
                />
              </label>
              <label className="form-label">
                Password
                <input
                  className="input"
                  type="password"
                  value={form.password || ""}
                  placeholder={form.id ? "Leave blank to keep the current password" : "At least 8 characters"}
                  required={!form.id}
                  minLength={form.password ? 8 : undefined}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
              </label>
              <label className="form-label">
                Office
                <select
                  className="input"
                  value={form.officeId || ""}
                  required
                  onChange={(event) => setForm({ ...form, officeId: Number(event.target.value) })}
                >
                  {offices.map((office) => (
                    <option key={office.id} value={office.id}>
                      {office.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-label">
                <span>
                  <input
                    type="checkbox"
                    checked={form.enabled !== false}
                    onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
                  />{" "}
                  Enabled
                </span>
              </label>
            </div>
            <fieldset className="perm-group">
              <h3>Roles</h3>
              <div className="perm-grid">
                {roles.map((role) => (
                  <label key={role.id}>
                    <input
                      type="checkbox"
                      checked={(form.roleIds || []).includes(role.id)}
                      onChange={(event) => {
                        const current = new Set(form.roleIds || []);
                        if (event.target.checked) current.add(role.id);
                        else current.delete(role.id);
                        setForm({ ...form, roleIds: [...current] });
                      }}
                    />{" "}
                    {role.name}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}
      </form>
    </Dialog>
  );
}

async function save(editor, form, session, run) {
  const key = crypto.randomUUID();
  if (editor.kind === "role") {
    await run(async () => {
      const payload = {
        name: form.name,
        description: form.description,
        disabled: !!form.disabled,
      };
      const saved = form.id
        ? await request(session, "/roles/" + form.id, {
            method: "PUT",
            body: payload,
            idempotencyKey: key,
          })
        : await request(session, "/roles", { method: "POST", body: payload, idempotencyKey: key });
      const id = form.id || saved.data.resourceId;
      const selected = new Set(form.permissions || []);
      const permissions = {};
      (await request(session, "/permissions")).data.forEach((permission) => {
        permissions[permission.code] = selected.has(permission.code);
      });
      await request(session, "/roles/" + id + "/permissions", {
        method: "PUT",
        body: { permissions },
        idempotencyKey: key + "-permissions",
      });
    }, form.id ? "Role updated." : "Role created.");
    return;
  }
  if (editor.kind === "permission") {
    const payload = {
      code: form.code,
      grouping: form.grouping,
      entityName: form.entityName || null,
      actionName: form.actionName || null,
      functionName: form.functionName || null,
      canMakerChecker: !!form.canMakerChecker,
    };
    await run(
      () =>
        request(session, form.id ? "/permissions/" + form.id : "/permissions", {
          method: form.id ? "PUT" : "POST",
          body: payload,
          idempotencyKey: key,
        }),
      form.id ? "Permission updated." : "Permission created.",
    );
    return;
  }
  const payload = {
    username: form.username,
    enabled: form.enabled !== false,
    officeId: form.officeId,
    roleIds: form.roleIds || [],
  };
  if (form.password) payload.password = form.password;
  await run(
    () =>
      request(session, form.id ? "/users/" + form.id : "/users", {
        method: form.id ? "PUT" : "POST",
        body: payload,
        idempotencyKey: key,
      }),
    form.id ? "User updated." : "User created.",
  );
}

function emptyRole() {
  return { name: "", description: "", disabled: false, permissions: [] };
}

function emptyPermission() {
  return {
    code: "",
    functionName: "",
    grouping: "custom",
    entityName: "",
    actionName: "",
    canMakerChecker: false,
  };
}

function emptyUser(officeId) {
  return { username: "", password: "", enabled: true, officeId, roleIds: [] };
}
