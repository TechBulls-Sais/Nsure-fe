import React, { useEffect, useId, useState } from "react";
import { AWAITING_APPROVAL_MESSAGE, awaitingApproval, request } from "./api";
import { Dialog, can, pula, useConfirm } from "./ui/workspace";
import "./access.css";

// Access administration: roles, the permission vocabulary, users and claim approval limits. The page opens with any
// of READ_ROLE, READ_USER or READ_PERMISSION, and each tab and action shows only with the code its endpoint checks
// (nsure-be ApiAccessRules). A write may come back 202 AWAITING_APPROVAL when maker-checker applies: it is then
// waiting for a second person, not failed.

// Identity changes always need a second person (Nsure Life NS-UX-004): their checker cannot be switched off.
const FOUR_EYES_LOCKED = new Set(["UPDATE_USER", "UPDATE_ROLE", "PERMISSIONS_ROLE"]);

// The Super Admin role keeps these so a mistaken edit cannot lock every administrator out of role grants.
const ADMIN_LIFELINE = new Set(["PERMISSIONS_ROLE", "CHECKER_PERMISSIONS_ROLE"]);

// Break-glass codes: held by no role, given only as time-limited emergency access (Nsure Life NS-SH11-003).
const BREAK_GLASS = [
  ["UPDATE_CONTROL", "Change an operational control"],
  ["OVERRIDE_CLAIM_FOUR_EYES", "Approve a claim you assessed (four-eyes override)"],
  ["PUBLISH_OWN_RATE_TABLE", "Publish a rate version you drafted"],
];
const MAX_EMERGENCY_HOURS = 8;

const CHECKER_CODES = ["CHECKER_UPDATE_USER", "CHECKER_UPDATE_ROLE", "CHECKER_PERMISSIONS_ROLE"];

// There is exactly one Super Admin role, recognised by its reserved name, as the server does (RoleCommandHandler).
const isSuperAdminRole = (role) => String(role?.name || "").trim().toLowerCase() === "super admin";

const PROTECTED_ROLE_NOTE =
  "A protected role is held by portal customers, so it can never be given permissions or desk access, and it " +
  "cannot be renamed, disabled or deleted.";

export default function AccessAdmin({ session, notify, profile }) {
  const allow = {
    readRoles: can(profile, "READ_ROLE"),
    createRole: can(profile, "CREATE_ROLE"),
    updateRole: can(profile, "UPDATE_ROLE"),
    deleteRole: can(profile, "DELETE_ROLE"),
    grant: can(profile, "PERMISSIONS_ROLE"),
    readPermissions: can(profile, "READ_PERMISSION"),
    updatePermission: can(profile, "UPDATE_PERMISSION"),
    readUsers: can(profile, "READ_USER"),
    createUser: can(profile, "CREATE_USER"),
    updateUser: can(profile, "UPDATE_USER"),
    deleteUser: can(profile, "DELETE_USER"),
    readAudit: can(profile, "READ_AUDIT"),
    check: CHECKER_CODES.some((code) => can(profile, code)),
    grantEmergency: can(profile, "GRANT_EMERGENCY_ACCESS"),
    reviewEmergency: can(profile, "REVIEW_EMERGENCY_ACCESS"),
  };
  const readEmergency = allow.grantEmergency || allow.reviewEmergency || allow.readAudit;
  const tabs = [
    allow.readRoles && ["roles", "Roles"],
    allow.readPermissions && ["permissions", "Permissions"],
    allow.readUsers && ["users", "Users"],
    allow.readRoles && ["limits", "Approval limits"],
    allow.readAudit && ["approvals", "Approvals"],
    allow.readAudit && ["evidence", "Audit evidence"],
    readEmergency && ["emergency", "Emergency access"],
  ].filter(Boolean);
  const [tab, setTab] = useState(() => tabs[0]?.[0] || "roles");
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [pending, setPending] = useState([]);
  const [emergency, setEmergency] = useState([]);
  const [limits, setLimits] = useState([]);
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
    // Each list loads only with its own read permission; a list the user may not read stays empty.
    const get = (path, allowed) =>
      allowed
        ? request(session, path)
            .then((r) => r.data || [])
            .catch((err) => {
              if (err.status === 403) return [];
              throw err;
            })
        : Promise.resolve([]);
    const [rolesD, permissionsD, usersD, limitsD, pendingD, emergencyD] = await Promise.all([
      get("/roles", allow.readRoles),
      get("/permissions", allow.readPermissions),
      get("/users", allow.readUsers),
      get("/admin/approval-authorities", allow.readRoles),
      get("/audits?status=AWAITING_APPROVAL&size=200", allow.readAudit),
      get("/admin/emergency-access", readEmergency),
    ]);
    setRoles(rolesD);
    setPermissions(permissionsD);
    setUsers(usersD);
    setPending(Array.isArray(pendingD) ? pendingD : pendingD.items || []);
    setEmergency(emergencyD);
    setLimits(limitsD.map((row) => ({ ...row, id: row.roleId })));
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

  /** Runs a write (or several), reloads, and says whether it took effect or awaits a second person. */
  async function run(work, saved) {
    setBusy(true);
    setError("");
    try {
      const outcome = await work();
      const pending = [].concat(outcome ?? []).some(awaitingApproval);
      await load();
      setEditor(null);
      const message = typeof saved === "function" ? saved(pending) : pending ? AWAITING_APPROVAL_MESSAGE : saved;
      notify(message, pending ? "info" : "success");
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const rolesById = new Map(roles.map((role) => [role.id, role]));
  const maySeeRole = (role) => !isSuperAdminRole(role) || profile?.superAdmin;

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADMINISTRATION</div>
          <h1>Access</h1>
          <p className="subtitle">
            Roles, the permissions they grant, the people who hold them, and how much each role may approve.
          </p>
        </div>
      </div>
      {error && !editor && <p className="form-error">{error}</p>}
      <div className="access-tabs" role="tablist">
        {tabs.map(([key, label]) => (
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

      {tab === "roles" && allow.readRoles && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Roles</h2>
              <p className="subtitle">
                Choose which permissions each role may use. Desk access makes a role&apos;s holders staff.
              </p>
            </div>
            {allow.createRole && (
              <button className="btn secondary" onClick={() => setEditor({ kind: "role", record: emptyRole() })}>
                New role
              </button>
            )}
          </div>
          <ResourceTable
            columns={["Role", "Description", "Desk access", "Permissions", "Status"]}
            rows={roles}
            render={(role) => (
              <>
                <td>
                  <span className="access-name-cell">
                    {role.name}
                    {role.protectedRole && (
                      <span className="badge gray" title={PROTECTED_ROLE_NOTE}>
                        <span className="status-dot" />
                        Protected
                      </span>
                    )}
                  </span>
                </td>
                <td>{role.description}</td>
                <td>{role.deskAccess ? "Yes" : "No"}</td>
                <td>{role.permissions?.length || 0}</td>
                <td>{role.disabled ? "Disabled" : "Active"}</td>
              </>
            )}
            editable={() => true}
            editLabel={(role) =>
              maySeeRole(role) && (allow.updateRole || (allow.grant && !role.protectedRole)) ? "Edit" : "View"
            }
            removable={(role) => allow.deleteRole && !isSuperAdminRole(role) && !role.protectedRole}
            onEdit={(role) => setEditor({ kind: "role", record: role })}
            onDelete={async (role) => {
              if (!(await confirmDelete("role", role.name))) return;
              run(
                () =>
                  request(session, "/roles/" + role.id, { method: "DELETE", idempotencyKey: crypto.randomUUID() }),
                "Role deleted.",
              );
            }}
          />
        </section>
      )}

      {tab === "permissions" && allow.readPermissions && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Permissions</h2>
              <p className="subtitle">
                The codes the application checks before an action. They are defined in the application, so they
                can be relabelled and regrouped here but not added or deleted.
              </p>
            </div>
          </div>
          <ResourceTable
            columns={["Code", "Function", "Group", "Maker-checker", "Entity", "Action"]}
            rows={permissions}
            render={(permission) => (
              <>
                <td>
                  {permission.code}
                  {permission.capability && <span className="access-capability">{permission.capability}</span>}
                </td>
                <td>{permission.functionName || "—"}</td>
                <td>{permission.grouping}</td>
                <td>{permission.canMakerChecker ? "Yes" : "No"}</td>
                <td>{permission.entityName || "—"}</td>
                <td>{permission.actionName || "—"}</td>
              </>
            )}
            editable={() => allow.updatePermission}
            onEdit={(permission) => setEditor({ kind: "permission", record: permission })}
          />
        </section>
      )}

      {tab === "users" && allow.readUsers && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Users</h2>
              <p className="subtitle">Assign one or more roles to each person.</p>
            </div>
            {allow.createUser && (
              <button
                className="btn secondary"
                onClick={() =>
                  setEditor({
                    kind: "user",
                    record: emptyUser(),
                  })
                }
              >
                New user
              </button>
            )}
          </div>
          <ResourceTable
            columns={["Username", "Roles", "Status"]}
            rows={users}
            render={(user) => (
              <>
                <td>{user.username}</td>
                <td>{(user.roles || []).join(", ") || "None"}</td>
                <td>{user.enabled ? "Active" : "Disabled"}</td>
              </>
            )}
            editable={() => allow.updateUser}
            removable={(user) => allow.deleteUser && user.username !== "admin" && user.username !== "system"}
            onEdit={(user) => setEditor({ kind: "user", record: { ...user, password: "" } })}
            onDelete={async (user) => {
              if (!(await confirmDelete("user", user.username))) return;
              run(
                () =>
                  request(session, "/users/" + user.id, { method: "DELETE", idempotencyKey: crypto.randomUUID() }),
                "User deleted.",
              );
            }}
          />
        </section>
      )}

      {tab === "limits" && allow.readRoles && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Claim approval limits</h2>
              <p className="subtitle">
                The largest payout each role may approve. A role with no limit is unlimited; someone holding
                several approving roles gets the highest of their limits. No role is exempt by name.
              </p>
            </div>
          </div>
          <ResourceTable
            columns={["Role", "Approves claims", "Approval limit"]}
            rows={limits}
            render={(row) => (
              <>
                <td>{row.roleName}</td>
                <td>{row.approvesClaims ? "Yes" : "No"}</td>
                <td>{row.maxPayoutAmount == null ? "Unlimited" : pula(row.maxPayoutAmount)}</td>
              </>
            )}
            editable={() => allow.updateRole}
            editLabel={(row) => (row.maxPayoutAmount == null ? "Set limit" : "Change limit")}
            onEdit={(row) => setEditor({ kind: "limit", record: { ...row, amount: row.maxPayoutAmount ?? "" } })}
            removable={(row) => allow.updateRole && row.maxPayoutAmount != null}
            removeLabel="Remove limit"
            onDelete={async (row) => {
              const ok = await confirm({
                title: `Remove the limit on ${row.roleName}?`,
                message: (
                  <>
                    <strong>{row.roleName}</strong> becomes unlimited: its holders may approve a payout of any size.
                  </>
                ),
                confirmLabel: "Remove limit",
                tone: "danger",
              });
              if (!ok) return;
              run(
                () => request(session, "/admin/approval-authorities/" + row.roleId, { method: "DELETE" }),
                row.roleName + " now has no approval limit.",
              );
            }}
          />
        </section>
      )}

      {tab === "approvals" && allow.readAudit && (
        <ApprovalsPanel
          pending={pending}
          users={users}
          profile={profile}
          busy={busy}
          decide={(command, verdict) =>
            run(
              () => request(session, "/audits/" + command.id + "/" + verdict, { method: "POST" }),
              verdict === "approve" ? "Change approved and applied." : "Change rejected.",
            )
          }
        />
      )}

      {tab === "evidence" && allow.readAudit && <EvidencePanel session={session} />}

      {tab === "emergency" && readEmergency && (
        <EmergencyPanel
          grants={emergency}
          users={users}
          rolesById={rolesById}
          profile={profile}
          allow={allow}
          busy={busy}
          error={error}
          confirm={confirm}
          run={run}
          session={session}
        />
      )}

      {tabs.length === 0 && (
        <section className="panel">
          <p className="subtitle">
            You do not hold a permission to read roles, permissions, users, approvals or emergency access.
          </p>
        </section>
      )}

      {editor && (
        <Editor
          editor={editor}
          setEditor={setEditor}
          roles={roles}
          rolesById={rolesById}
          permissions={permissions}
          profile={profile}
          allow={allow}
          busy={busy}
          error={error}
          onSave={(form) =>
            editor.kind === "role"
              ? run(() => saveRole(session, editor.record, form, allow), (pending) =>
                  pending
                    ? AWAITING_APPROVAL_MESSAGE +
                      (!form.id && (form.permissions || []).length
                        ? " Set its permissions once the role is approved."
                        : "")
                    : form.id
                      ? "Role updated."
                      : "Role created.",
                )
              : editor.kind === "permission"
                ? run(() => savePermission(session, form), "Permission updated.")
                : editor.kind === "limit"
                  ? run(
                      () =>
                        request(session, "/admin/approval-authorities/" + form.roleId, {
                          method: "PUT",
                          body: { maxPayoutAmount: Number(form.amount) },
                        }),
                      form.roleName + " may now approve up to " + pula(form.amount) + ".",
                    )
                  : run(() => saveUser(session, form), form.id ? "User updated." : "User created.")
          }
        />
      )}
    </>
  );
}

const when = (value) =>
  value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";

/** A one-line description of a pending command's body: grants and removals, or the fields it changes. */
function describeCommand(command) {
  const body = command.command || {};
  if (body.permissions && typeof body.permissions === "object") {
    const on = Object.keys(body.permissions).filter((code) => body.permissions[code]);
    const off = Object.keys(body.permissions).filter((code) => !body.permissions[code]);
    return [on.length && "Grant " + on.join(", "), off.length && "Remove " + off.join(", ")].filter(Boolean).join(" · ");
  }
  return (
    Object.entries(body)
      .filter(([key]) => key !== "password")
      .map(([key, value]) => key + ": " + (Array.isArray(value) ? value.join(", ") : String(value)))
      .join(" · ") || "—"
  );
}

/**
 * The maker-checker inbox. Changes to users and roles wait here for a second person holding CHECKER_<code>; nobody
 * approves their own change, the administrator included (Nsure Life NS-UX-004).
 */
/**
 * Append-only audit evidence (NS-SH11-005): decisions, approvals, sign-ins, sensitive downloads and exports, each
 * chained to the one before by its hash. "Check the chain" recomputes every link, so an edited or removed record is
 * named (AT-SH11-03).
 */
function EvidencePanel({ session }) {
  const [rows, setRows] = useState([]);
  const [ref, setRef] = useState("");
  const [check, setCheck] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = async (record) => {
    setError("");
    try {
      const query = record ? "?entityRef=" + encodeURIComponent(record) + "&limit=200" : "?limit=200";
      const r = await request(session, "/audits/evidence" + query);
      setRows((r.data || []).map((row) => ({ ...row, id: row.sequenceNo })));
    } catch (err) {
      setError(err.message);
    }
  };
  useEffect(() => {
    load("");
  }, [session]);
  const verify = async () => {
    setBusy(true);
    setError("");
    try {
      setCheck((await request(session, "/audits/evidence/verify")).data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Audit evidence</h2>
          <p className="subtitle">
            Every decision, approval, sign-in, document download and export, newest first. Records are never edited or
            deleted; each one carries the hash of the one before it.
          </p>
        </div>
        <button className="btn secondary" disabled={busy} onClick={verify}>
          {busy ? "Checking…" : "Check the chain"}
        </button>
      </div>
      {check && (
        <p className={"notice " + (check.intact ? "" : "danger")} role="status">
          {check.intact
            ? "Intact: all " + check.records + " records link up and none was changed."
            : "Broken at record " + check.brokenAt + ": " + check.problem}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <form
        className="access-filter"
        onSubmit={(e) => {
          e.preventDefault();
          load(ref.trim());
        }}
      >
        <input
          className="input"
          value={ref}
          placeholder="Record reference, e.g. POL-10843 or CLM-0843"
          aria-label="Record reference"
          onChange={(e) => setRef(e.target.value)}
        />
        <button className="btn secondary" type="submit">
          Show
        </button>
      </form>
      <ResourceTable
        columns={["#", "When", "Who", "What", "Record", "Why", "Reference"]}
        rows={rows}
        render={(e) => (
          <>
            <td>{e.sequenceNo}</td>
            <td>{when(e.occurredAt)}</td>
            <td>{e.actor}</td>
            <td>{e.action}</td>
            <td>
              {e.entityType}
              {e.entityRef ? " " + e.entityRef : ""}
            </td>
            <td>{e.reason || "—"}</td>
            <td>
              <small>{e.correlationId ? e.correlationId.slice(0, 8) : "—"}</small>
            </td>
          </>
        )}
        editable={() => false}
      />
    </section>
  );
}

function ApprovalsPanel({ pending, users, profile, busy, decide }) {
  const names = new Map(users.map((user) => [user.id, user.username]));
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Waiting for approval</h2>
          <p className="subtitle">
            Changes to users and roles take effect only when a second person approves them. Nobody approves their own
            change.
          </p>
        </div>
      </div>
      <ResourceTable
        columns={["Change", "Details", "Made by", "When"]}
        rows={pending}
        render={(command) => (
          <>
            <td>
              {command.actionName} {command.entityName}
              {command.resourceId ? " #" + command.resourceId : ""}
            </td>
            <td>{describeCommand(command)}</td>
            <td>{names.get(command.makerId) || "#" + command.makerId}</td>
            <td>{when(command.madeOn)}</td>
          </>
        )}
        editable={(command) => command.makerId !== profile?.id && can(profile, checkerCode(command))}
        editLabel={() => (busy ? "Working…" : "Approve")}
        onEdit={(command) => decide(command, "approve")}
        removable={(command) => command.makerId !== profile?.id && can(profile, checkerCode(command))}
        removeLabel="Reject"
        onDelete={(command) => decide(command, "reject")}
        note={(command) =>
          command.makerId === profile?.id
            ? "Your change: another administrator approves it."
            : !can(profile, checkerCode(command))
              ? "Needs " + checkerCode(command) + "."
              : null
        }
      />
    </section>
  );
}

const checkerCode = (command) => "CHECKER_" + command.actionName + "_" + command.entityName;

/**
 * Emergency access (Nsure Life NS-SH11-003): a break-glass code for one person, for at most eight hours, with a
 * written reason. Granting alerts everyone who holds READ_AUDIT; once it ends, someone other than the granter and the
 * holder reviews it.
 */
function EmergencyPanel({ grants, users, rolesById, profile, allow, busy, error, confirm, run, session }) {
  const blank = { username: "", permission: BREAK_GLASS[0][0], hours: 2, reason: "" };
  const [form, setForm] = useState(blank);
  const [reviewing, setReviewing] = useState(null);
  const [note, setNote] = useState("");
  const formId = useId();
  const reviewId = useId();
  // Only enabled staff (a role with desk access) can receive emergency access; nobody grants it to themselves.
  const isStaff = (user) =>
    rolesById.size === 0 ||
    (user.roleIds || []).some((id) => rolesById.get(id)?.deskAccess && !rolesById.get(id)?.disabled);
  const candidates = users.filter((user) => user.enabled && user.username !== profile?.username && isStaff(user));
  const label = (code) => BREAK_GLASS.find(([key]) => key === code)?.[1] || code;
  const tone = { ACTIVE: "amber", EXPIRED: "gray", REVOKED: "gray" };
  const needsReview = (grant) =>
    grant.status !== "ACTIVE" &&
    !grant.reviewedBy &&
    allow.reviewEmergency &&
    grant.grantedBy !== profile?.username &&
    grant.username !== profile?.username;

  async function grant(event) {
    event.preventDefault();
    const ok = await run(
      () =>
        request(session, "/admin/emergency-access", {
          method: "POST",
          body: { ...form, hours: Number(form.hours) },
        }),
      "Emergency access granted to " + form.username + " for " + form.hours + " hour(s). Auditors have been alerted.",
    );
    if (ok) setForm(blank);
  }

  async function revoke(row) {
    const ok = await confirm({
      title: "Revoke " + row.username + "'s emergency access?",
      message: (
        <>
          <strong>{row.username}</strong> loses {row.permission} now, before it would have expired.
        </>
      ),
      confirmLabel: "Revoke access",
      tone: "danger",
    });
    if (!ok) return;
    run(
      () => request(session, "/admin/emergency-access/" + row.id + "/revoke", { method: "POST" }),
      "Emergency access revoked.",
    );
  }

  async function review(event) {
    event.preventDefault();
    const ok = await run(
      () =>
        request(session, "/admin/emergency-access/" + reviewing.id + "/review", {
          method: "POST",
          body: { note },
        }),
      "Review recorded.",
    );
    if (ok) {
      setReviewing(null);
      setNote("");
    }
  }

  return (
    <>
      {allow.grantEmergency && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Grant emergency access</h2>
              <p className="subtitle">
                No role holds these permissions. Give one to one staff member for up to {MAX_EMERGENCY_HOURS} hours,
                with a reason. Everyone who reads the audit log is alerted, and it is reviewed once it ends.
              </p>
            </div>
          </div>
          <form id={formId} onSubmit={grant}>
            <div className="field-grid">
              <label className="form-label">
                Staff member
                {candidates.length ? (
                  <select
                    className="input"
                    required
                    value={form.username}
                    onChange={(event) => setForm({ ...form, username: event.target.value })}
                  >
                    <option value="">Choose a user…</option>
                    {candidates.map((user) => (
                      <option key={user.id} value={user.username}>
                        {user.username}
                        {user.roles?.length ? " · " + user.roles.join(", ") : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input"
                    required
                    value={form.username}
                    placeholder="Username"
                    onChange={(event) => setForm({ ...form, username: event.target.value })}
                  />
                )}
              </label>
              <label className="form-label">
                Permission
                <select
                  className="input"
                  value={form.permission}
                  onChange={(event) => setForm({ ...form, permission: event.target.value })}
                >
                  {BREAK_GLASS.map(([code, text]) => (
                    <option key={code} value={code}>
                      {text} ({code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-label">
                Hours
                <input
                  className="input"
                  type="number"
                  min="1"
                  max={MAX_EMERGENCY_HOURS}
                  required
                  value={form.hours}
                  onChange={(event) => setForm({ ...form, hours: event.target.value })}
                />
              </label>
            </div>
            <label className="form-label">
              Reason
              <textarea
                className="input"
                rows={2}
                required
                minLength={10}
                maxLength={1000}
                placeholder="The incident or ticket, and why the normal route cannot be used"
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
              />
            </label>
            {error && !reviewing && <p className="form-error">{error}</p>}
            <button className="btn primary emergency-grant" disabled={busy}>
              {busy ? "Granting…" : "Grant emergency access"}
            </button>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Emergency access register</h2>
            <p className="subtitle">Every grant, who gave it and why, when it ends, and its review.</p>
          </div>
        </div>
        <ResourceTable
          columns={["User", "Permission", "Reason", "Granted", "Ends", "Status", "Review"]}
          rows={grants}
          render={(row) => (
            <>
              <td>{row.username}</td>
              <td title={row.permission}>{label(row.permission)}</td>
              <td>{row.reason}</td>
              <td>
                {row.grantedBy}
                <br />
                <small>{when(row.grantedAt)}</small>
              </td>
              <td>
                {row.revokedAt ? "Revoked " + when(row.revokedAt) + " by " + row.revokedBy : when(row.expiresAt)}
              </td>
              <td>
                <span className={"badge " + (tone[row.status] || "gray")}>
                  <span className="status-dot" />
                  {row.status === "ACTIVE" ? "Active" : row.status === "REVOKED" ? "Revoked" : "Expired"}
                </span>
              </td>
              <td>
                {row.reviewedBy ? (
                  <>
                    {row.reviewedBy}: {row.reviewNote}
                  </>
                ) : row.status === "ACTIVE" ? (
                  "After it ends"
                ) : (
                  "Not reviewed"
                )}
              </td>
            </>
          )}
          editable={needsReview}
          editLabel={() => "Review"}
          onEdit={(row) => {
            setReviewing(row);
            setNote("");
          }}
          removable={(row) => allow.grantEmergency && row.status === "ACTIVE"}
          removeLabel="Revoke"
          onDelete={revoke}
        />
      </section>

      {reviewing && (
        <Dialog
          title={"Review emergency access · " + reviewing.username}
          eyebrow="Access"
          onClose={() => setReviewing(null)}
          footer={
            <>
              <button type="button" className="btn secondary" onClick={() => setReviewing(null)}>
                Cancel
              </button>
              <button className="btn primary" form={reviewId} disabled={busy}>
                {busy ? "Saving…" : "Record review"}
              </button>
            </>
          }
        >
          <form id={reviewId} onSubmit={review}>
            {error && <p className="form-error">{error}</p>}
            <p className="subtitle">
              {reviewing.grantedBy} gave {reviewing.username} {reviewing.permission} on {when(reviewing.grantedAt)}:
              “{reviewing.reason}”. Check what was done with it, then record your conclusion.
            </p>
            <label className="form-label">
              Review note
              <textarea
                className="input"
                rows={3}
                required
                minLength={5}
                maxLength={1000}
                autoFocus
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
          </form>
        </Dialog>
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

function ResourceTable({
  columns,
  rows,
  render,
  onEdit,
  onDelete,
  editable,
  removable = () => false,
  editLabel = () => "Edit",
  removeLabel = "Delete",
  note = () => null,
}) {
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
                    {editLabel(row)}
                  </button>
                )}{" "}
                {removable(row) && (
                  <button className="btn secondary" onClick={() => onDelete(row)}>
                    {removeLabel}
                  </button>
                )}
                {note(row) && <small className="ws-hint">{note(row)}</small>}
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

function Editor({ editor, setEditor, roles, rolesById, permissions, profile, allow, busy, error, onSave }) {
  const [form, setForm] = useState(editor.record);
  const formId = useId();
  const confirm = useConfirm();
  const isNew = !form.id;
  const before = editor.record;

  // What this user may change on a role: its fields need CREATE_ROLE (new) or UPDATE_ROLE, its permissions
  // PERMISSIONS_ROLE. A protected role never gets permissions or desk access; only a super admin edits Super Admin.
  const superRole = editor.kind === "role" && !isNew && isSuperAdminRole(before);
  const lockedSuper = superRole && !profile?.superAdmin;
  const protectedRole = editor.kind === "role" && Boolean(before.protectedRole);
  const roleFields = editor.kind === "role" && !lockedSuper && (isNew ? allow.createRole : allow.updateRole);
  const roleGrants = editor.kind === "role" && !lockedSuper && !protectedRole && allow.grant;
  const canSave =
    editor.kind === "role"
      ? roleFields || roleGrants
      : editor.kind === "permission"
        ? allow.updatePermission
        : editor.kind === "limit"
          ? allow.updateRole
          : isNew
            ? allow.createUser
            : allow.updateUser;

  const title =
    editor.kind === "role"
      ? isNew
        ? "New role"
        : canSave
          ? "Edit role"
          : "Role"
      : editor.kind === "permission"
        ? "Edit permission"
        : editor.kind === "limit"
          ? "Approval limit · " + form.roleName
          : isNew
            ? "New user"
            : "Edit user";

  async function submit() {
    if (!canSave) return;
    if (editor.kind === "limit" && !(Number(form.amount) > 0)) return;
    if (!isNew && editor.kind === "role") {
      const kept = new Set(form.permissions || []);
      const removed = (before.permissions || []).filter((code) => !kept.has(code));
      const disabling = !before.disabled && !!form.disabled;
      const deskOff = before.deskAccess && !form.deskAccess;
      if (disabling || removed.length || deskOff) {
        const ok = await confirm({
          title: disabling
            ? `Disable role ${form.name}?`
            : removed.length
              ? `Remove ${removed.length} permission${removed.length === 1 ? "" : "s"} from ${form.name}?`
              : `Remove desk access from ${form.name}?`,
          message: (
            <>
              {disabling && (
                <p>
                  The role <strong>{form.name}</strong> is saved as disabled.
                </p>
              )}
              {deskOff && (
                <p>
                  Holders of <strong>{form.name}</strong> no longer count as staff through this role.
                </p>
              )}
              {removed.length > 0 && (
                <p>
                  These permissions are removed from <strong>{form.name}</strong>: {removed.join(", ")}.
                </p>
              )}
            </>
          ),
          confirmLabel: disabling ? "Disable role" : removed.length ? "Remove permissions" : "Remove desk access",
          tone: "danger",
        });
        if (!ok) return;
      }
    }
    if (!isNew && editor.kind === "user" && before.enabled !== false && form.enabled === false) {
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
      size={editor.kind === "role" ? "lg" : "md"}
      footer={
        <>
          <button type="button" className="btn secondary" onClick={() => setEditor(null)}>
            {canSave ? "Cancel" : "Close"}
          </button>
          {canSave && (
            <button className="btn primary" form={formId} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          )}
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
        {error && <p className="form-error">{error}</p>}
        {editor.kind === "role" && (
          <>
            {protectedRole && (
              <div className="notice">
                <span className="badge gray">
                  <span className="status-dot" />
                  Protected
                </span>
                <p>
                  <strong>{before.name}</strong> is a protected role. {PROTECTED_ROLE_NOTE}
                </p>
              </div>
            )}
            {lockedSuper && (
              <div className="notice">
                <p>Only a super admin can change the Super Admin role.</p>
              </div>
            )}
            <label className="form-label">
              Name
              <input
                className="input"
                value={form.name}
                required
                disabled={!roleFields || protectedRole || superRole}
                title={
                  protectedRole
                    ? "A protected role cannot be renamed."
                    : superRole
                      ? "The Super Admin role keeps its name."
                      : undefined
                }
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className="form-label">
              Description
              <input
                className="input"
                value={form.description}
                required
                disabled={!roleFields}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </label>
            <label className="access-check">
              <input
                type="checkbox"
                checked={!!form.deskAccess}
                disabled={!roleFields || protectedRole || superRole}
                onChange={(event) => setForm({ ...form, deskAccess: event.target.checked })}
              />
              <span>
                Desk access (staff workspace)
                <small>
                  {protectedRole
                    ? "A protected role can never have desk access."
                    : superRole
                      ? "The Super Admin role keeps desk access."
                      : "Holders of this role are staff and can sign in to the operations workspace."}
                </small>
              </span>
            </label>
            <label className="access-check">
              <input
                type="checkbox"
                checked={!!form.disabled}
                disabled={!roleFields || protectedRole || superRole}
                onChange={(event) => setForm({ ...form, disabled: event.target.checked })}
              />
              <span>
                Disabled
                <small>A disabled role grants nothing; who holds it is kept.</small>
              </span>
            </label>
            <fieldset className="perm-group">
              <h3>
                Permissions
                <span className="perm-total">
                  {(form.permissions || []).length}
                  {permissions.length ? " of " + permissions.length : ""} selected
                </span>
              </h3>
              {protectedRole ? (
                <p className="subtitle">A protected role never holds a permission.</p>
              ) : !permissions.length ? (
                <p className="subtitle">
                  {(form.permissions || []).join(", ") || "No permissions."}
                  {allow.readPermissions ? "" : " Reading the permission list needs READ_PERMISSION."}
                </p>
              ) : (
                <>
                  {!roleGrants && (
                    <p className="subtitle access-note">
                      {lockedSuper
                        ? "Shown read-only."
                        : "Changing a role's permissions needs PERMISSIONS_ROLE; shown read-only."}
                    </p>
                  )}
                  {groupPermissions(permissions).map(([group, items]) => (
                    <div key={group} className="perm-section">
                      <h4>{group}</h4>
                      <div className="perm-grid">
                        {items.map((permission) => {
                          const checked = (form.permissions || []).includes(permission.code);
                          // Nobody grants a code they do not hold; Super Admin keeps the codes that restore grants.
                          const cannotGrant = !checked && !can(profile, permission.code);
                          const keeps = superRole && ADMIN_LIFELINE.has(permission.code) && checked;
                          const locked = !roleGrants || cannotGrant || keeps;
                          return (
                            <label
                              key={permission.code}
                              className={"perm-option " + (locked && roleGrants ? "locked" : "")}
                              title={
                                cannotGrant && roleGrants
                                  ? "You cannot grant " + permission.code + " because you do not hold it."
                                  : keeps
                                    ? "The Super Admin role keeps " + permission.code + " so grants can always be restored."
                                    : undefined
                              }
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={locked}
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
                                <span className="perm-code">
                                  {permission.code}
                                  {permission.capability && (
                                    <span className="access-capability">{permission.capability}</span>
                                  )}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </fieldset>
          </>
        )}
        {editor.kind === "permission" && (
          <>
            <p className="subtitle">
              The code, entity and action are defined in the application and cannot change here.
            </p>
            <div className="field-grid">
              <label className="form-label">
                Code
                <input className="input" value={form.code} disabled readOnly />
              </label>
              <label className="form-label">
                Capability
                <input className="input" value={form.capability || "—"} disabled readOnly />
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
                  maxLength={45}
                  onChange={(event) => setForm({ ...form, grouping: event.target.value })}
                />
              </label>
              <label className="form-label">
                Entity
                <input className="input" value={form.entityName || "—"} disabled readOnly />
              </label>
              <label className="form-label">
                Action
                <input className="input" value={form.actionName || "—"} disabled readOnly />
              </label>
            </div>
            <label className="access-check">
              <input
                type="checkbox"
                checked={!!form.canMakerChecker}
                disabled={FOUR_EYES_LOCKED.has(form.code) && !!form.canMakerChecker}
                onChange={(event) => setForm({ ...form, canMakerChecker: event.target.checked })}
              />
              <span>
                Maker-checker
                <small>
                  {FOUR_EYES_LOCKED.has(form.code)
                    ? "Changes to users and roles always wait for a second person; this cannot be switched off."
                    : "A change made with this permission waits for a second person to approve it."}
                </small>
              </span>
            </label>
          </>
        )}
        {editor.kind === "limit" && (
          <>
            <p className="subtitle">
              Holders of <strong>{form.roleName}</strong> may approve a claim payout up to this amount. A larger
              payout needs a more senior approver.
              {!form.approvesClaims && " This role does not approve claims today, so the limit applies once it does."}
            </p>
            <label className="form-label">
              Maximum payout (BWP)
              <input
                className="input"
                type="number"
                min="0.01"
                step="0.01"
                required
                autoFocus
                value={form.amount ?? ""}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
              />
            </label>
          </>
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
                  autoComplete="new-password"
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
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
              {roles.length ? (
                <div className="perm-grid">
                  {roles.map((role) => {
                    const checked = (form.roleIds || []).includes(role.id);
                    // Only a super admin assigns (or removes) the Super Admin role.
                    const locked = isSuperAdminRole(role) && !profile?.superAdmin;
                    return (
                      <label
                        key={role.id}
                        className={locked ? "perm-option locked" : undefined}
                        title={locked ? "Only a super admin can assign the Super Admin role." : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={locked}
                          onChange={(event) => {
                            const current = new Set(form.roleIds || []);
                            if (event.target.checked) current.add(role.id);
                            else current.delete(role.id);
                            setForm({ ...form, roleIds: [...current] });
                          }}
                        />{" "}
                        {role.name}
                        {role.protectedRole ? " (protected)" : ""}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="subtitle">
                  {(form.roles || []).join(", ") ||
                    (form.roleIds || []).map((id) => rolesById.get(id)?.name || "#" + id).join(", ") ||
                    "No roles."}{" "}
                  Choosing roles needs READ_ROLE.
                </p>
              )}
            </fieldset>
          </>
        )}
      </form>
    </Dialog>
  );
}

/** Creates or updates a role, then applies only the permission changes (so nobody re-grants codes they lack). */
async function saveRole(session, before, form, allow) {
  const key = crypto.randomUUID();
  const results = [];
  let id = form.id;
  const superRole = Boolean(id) && isSuperAdminRole(before);
  if (!id) {
    const created = await request(session, "/roles", {
      method: "POST",
      body: {
        name: form.name,
        description: form.description,
        disabled: !!form.disabled,
        deskAccess: !!form.deskAccess,
      },
      idempotencyKey: key,
    });
    results.push(created);
    // Awaiting a second person: the role does not exist yet, so its permissions follow once it is approved.
    if (awaitingApproval(created)) return results;
    id = created.data?.resourceId;
  } else if (allow.updateRole) {
    const changes = {};
    if (form.name !== before.name && !before.protectedRole && !superRole) changes.name = form.name;
    if (form.description !== before.description) changes.description = form.description;
    if (!!form.disabled !== !!before.disabled && !before.protectedRole && !superRole) changes.disabled = !!form.disabled;
    if (!!form.deskAccess !== !!before.deskAccess && !before.protectedRole && !superRole) {
      changes.deskAccess = !!form.deskAccess;
    }
    if (Object.keys(changes).length) {
      results.push(await request(session, "/roles/" + id, { method: "PUT", body: changes, idempotencyKey: key }));
    }
  }
  if (id && allow.grant && !before.protectedRole) {
    const was = new Set(before.permissions || []);
    const now = new Set(form.permissions || []);
    const changes = {};
    now.forEach((code) => !was.has(code) && (changes[code] = true));
    was.forEach((code) => !now.has(code) && (changes[code] = false));
    if (Object.keys(changes).length) {
      results.push(
        await request(session, "/roles/" + id + "/permissions", {
          method: "PUT",
          body: { permissions: changes },
          idempotencyKey: key + "-permissions",
        }),
      );
    }
  }
  return results;
}

/** Only the label, the group and maker-checker can change; the code is fixed in source. */
function savePermission(session, form) {
  return request(session, "/permissions/" + form.id, {
    method: "PUT",
    body: {
      functionName: form.functionName || null,
      grouping: form.grouping,
      canMakerChecker: !!form.canMakerChecker,
    },
    idempotencyKey: crypto.randomUUID(),
  });
}

function saveUser(session, form) {
  const payload = {
    username: form.username,
    enabled: form.enabled !== false,
    roleIds: form.roleIds || [],
  };
  if (form.password) payload.password = form.password;
  return request(session, form.id ? "/users/" + form.id : "/users", {
    method: form.id ? "PUT" : "POST",
    body: payload,
    idempotencyKey: crypto.randomUUID(),
  });
}

function emptyRole() {
  return { name: "", description: "", disabled: false, deskAccess: true, permissions: [] };
}

function emptyUser() {
  return { username: "", password: "", enabled: true, roleIds: [] };
}
