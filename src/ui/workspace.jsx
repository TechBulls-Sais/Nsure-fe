import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Monitor,
  Moon,
  Search,
  SearchX,
  Sun,
  X,
} from "lucide-react";
import { request } from "../api";
import { useTheme } from "./theme";
import "./workspace.css";
import "./kit.css";

export { Dialog, Drawer, useConfirm } from "./overlay";

// Building blocks for the Nsure Life operational workspaces (group, finance, distribution, reinsurance,
// communications, service desk, integration, reports). They reuse the app's own classes (page-heading, panel,
// data-table, badge, btn, filter-tab, form-label) so new pages look like the existing ones.

export const can = (profile, code) =>
  Boolean(profile?.superAdmin || profile?.permissions?.includes(code));

export const pula = (value) =>
  "BWP " +
  Number(value || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// The API sends LocalDateTime in the server's own (insurer business) timezone, so it is shown as given.
export const when = (value) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export function Heading({ eyebrow = "NSURE LIFE", title, subtitle, children }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}

export function Panel({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={"panel ws-panel " + className}>
      {(title || action) && (
        <div className="panel-header">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p className="subtitle">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="ws-panel-body">{children}</div>
    </section>
  );
}

const GREEN = /active|approved|delivered|posted|paid|accepted|resolved|closed|applied|open period|^open$|committed|issued|settled|verified/;
const AMBER = /pending|queued|submitted|review|paused|draft|validated|partial|soft|underwriting|in progress|prepared|outstanding/;
const RED = /failed|rejected|declined|suspended|lapsed|cancelled|breach|suspense|exception|ceased|reversed|unmatched|^closed period/;

export function Badge({ children, tone }) {
  const s = String(children ?? "").toLowerCase();
  const color =
    tone ||
    (RED.test(s) ? "red" : GREEN.test(s) ? "green" : AMBER.test(s) ? "amber" : "blue");
  return (
    <span className={"badge " + color}>
      <span className="status-dot" />
      {children}
    </span>
  );
}

/** variant: primary | secondary | danger | ghost. While busy it shows a spinner and ignores clicks. */
export function Button({ children, icon: IconComponent, variant = "primary", busy, ...props }) {
  return (
    <button
      className={"btn " + variant}
      disabled={busy || props.disabled}
      aria-busy={busy || undefined}
      {...props}
    >
      {busy ? (
        <span className="nk-spinner" aria-hidden="true" />
      ) : (
        IconComponent && <IconComponent className="icon icon-sm" strokeWidth={1.8} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

export function Stat({ label, value, note, tone = "green", loading }) {
  return (
    <div className={"stat-card ws-stat " + tone}>
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value">
        {loading ? <Skeleton width="60%" height={26} /> : value}
      </div>
      {note && <div className="stat-trend"><span>{note}</span></div>}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs ws-tabs" role="tablist">
      {tabs.map((t) => {
        const [key, label] = Array.isArray(t) ? t : [t, t];
        return (
          <button
            key={key}
            role="tab"
            aria-selected={value === key}
            className={"filter-tab " + (value === key ? "active" : "")}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function Empty({ text = "Nothing here yet", detail, action }) {
  return (
    <div className="empty-state">
      <SearchX className="icon" aria-hidden="true" />
      <h3>{text}</h3>
      {detail && <p>{detail}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ width = "100%", height = 12, radius, className = "" }) {
  return (
    <span
      className={"nk-skeleton " + className}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return (
    <div className="ws-error" role="alert">
      <CircleAlert className="icon icon-sm" aria-hidden="true" />
      {error}
    </div>
  );
}

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const plain = (v) => (v == null ? "" : Array.isArray(v) ? v.join(", ") : typeof v === "object" ? "" : String(v));
const isActionColumn = (c) => !c.label || c.key === "act" || c.key === "actions";

function compare(a, b) {
  if (a == null || a === "") return b == null || b === "" ? 0 : 1;
  if (b == null || b === "") return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && String(a).trim() !== "" && String(b).trim() !== "") return na - nb;
  return collator.compare(String(a), String(b));
}

function pageList(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i);
  const set = new Set([0, pages - 1, page - 1, page, page + 1].filter((p) => p >= 0 && p < pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push("gap-" + p);
    out.push(p);
  });
  return out;
}

/**
 * columns: [{ key, label, render?(row), align?, sortable?, sortValue?(row) }]. rows: array.
 * Searching, sorting and paging happen here: search shows once there are more than `searchFrom` rows, a labelled
 * column sorts (click its header) when the rows carry its key or it has a sortValue, and `pageSize` rows show per
 * page (0 shows all). While `loading` with
 * no rows yet it draws skeleton rows; with no rows it draws the Empty state.
 */
export function DataTable({
  columns,
  rows,
  rowKey = (r, i) => r.id ?? r.ref ?? i,
  empty,
  emptyDetail,
  onRowClick,
  loading = false,
  pageSize = 10,
  searchFrom = 6,
  searchPlaceholder = "Search…",
  toolbar,
  total,
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(null);
  const [page, setPage] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const list = rows || [];

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    let out = list;
    if (q) {
      out = out.filter((row) =>
        Object.values(row).some((v) => plain(v).toLowerCase().includes(q)),
      );
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      const value = col?.sortValue || ((row) => row[sort.key]);
      out = [...out].sort((a, b) => compare(value(a), value(b)) * (sort.dir === "asc" ? 1 : -1));
    }
    return out;
  }, [list, deferredQuery, sort, columns]);

  const pages = pageSize ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  useEffect(() => {
    if (page > pages - 1) setPage(pages - 1);
  }, [page, pages]);
  useEffect(() => setPage(0), [deferredQuery, sort]);

  const showSearch = list.length > searchFrom || query;
  const visible = pageSize ? filtered.slice(page * pageSize, page * pageSize + pageSize) : filtered;
  const from = filtered.length ? page * pageSize + 1 : 0;
  const to = pageSize ? Math.min(filtered.length, (page + 1) * pageSize) : filtered.length;

  if (loading && list.length === 0) {
    return (
      <div className="nk-table" aria-busy="true">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }, (_, i) => (
                <tr key={i} className="nk-skeleton-row">
                  {columns.map((c, j) => (
                    <td key={c.key}>
                      {isActionColumn(c) ? null : <Skeleton width={`${55 + ((i * 7 + j * 13) % 40)}%`} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (list.length === 0) return <Empty text={empty || "No records yet"} detail={emptyDetail} />;

  const toggleSort = (key) =>
    setSort((s) => (!s || s.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));

  return (
    <div className="nk-table">
      {(showSearch || toolbar) && (
        <div className="nk-table-toolbar">
          {showSearch ? (
            <label className="search-box">
              <Search className="icon icon-sm" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search this table"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => setQuery("")}>
                  <X className="icon icon-sm" aria-hidden="true" />
                </button>
              )}
            </label>
          ) : (
            <span />
          )}
          <div className="ws-row-actions">
            {toolbar}
            <span className="nk-table-count">
              {filtered.length === list.length ? `${list.length} records` : `${filtered.length} of ${list.length}`}
            </span>
          </div>
        </div>
      )}
      {filtered.length === 0 ? (
        <Empty
          text={`No matches for “${query}”`}
          detail="Try another word, a reference or a status."
          action={
            <Button variant="secondary" onClick={() => setQuery("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((c) => {
                  const sortable =
                    c.sortable ?? (!isActionColumn(c) && Boolean(c.sortValue || list.some((r) => r[c.key] != null)));
                  const active = sort?.key === c.key;
                  const SortIcon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                  return (
                    <th
                      key={c.key}
                      style={c.align ? { textAlign: c.align } : undefined}
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                    >
                      {sortable ? (
                        <button type="button" className="nk-sort" onClick={() => toggleSort(c.key)}>
                          {c.label}
                          <SortIcon className="icon" aria-hidden="true" />
                        </button>
                      ) : (
                        c.label
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, i) => (
                <tr
                  key={rowKey(row, i)}
                  className={onRowClick ? "ws-clickable" : undefined}
                  onClick={
                    onRowClick
                      ? (e) => {
                          if (e.target.closest("button, a, input, select, textarea, label")) return;
                          onRowClick(row);
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                >
                  {columns.map((c) => (
                    <td key={c.key} className={c.className} style={c.align ? { textAlign: c.align } : undefined}>
                      {c.render ? c.render(row) : row[c.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {((pageSize > 0 && filtered.length > pageSize) || total != null) && (
        <div className="nk-table-footer">
          <span>
            {pages > 1 ? `Showing ${from}–${to} of ${filtered.length}` : `Showing ${filtered.length}`}
            {total != null && total !== filtered.length ? ` · ${total} records in total` : " records"}
          </span>
          {pages > 1 && (
          <nav className="nk-pager" aria-label="Pages">
            <button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="icon icon-sm" aria-hidden="true" />
            </button>
            {pageList(page, pages).map((p) =>
              typeof p === "string" ? (
                <span key={p} className="nk-gap">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  aria-current={p === page ? "page" : undefined}
                  onClick={() => setPage(p)}
                >
                  {p + 1}
                </button>
              ),
            )}
            <button
              type="button"
              aria-label="Next page"
              disabled={page >= pages - 1}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="icon icon-sm" aria-hidden="true" />
            </button>
          </nav>
          )}
        </div>
      )}
    </div>
  );
}

export function Field({ label, children, full = false, hint }) {
  return (
    <label className={"form-label " + (full ? "full" : "")}>
      <span>{label}</span>
      {children}
      {hint && <small className="ws-hint">{hint}</small>}
    </label>
  );
}

/** A form laid out on the app's two-column field grid with a submit row. */
export function FormGrid({ children, onSubmit, submitLabel = "Save", busy, error, extra }) {
  return (
    <form
      className="ws-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="field-grid">{children}</div>
      <ErrorNote error={error} />
      <div className="ws-form-actions">
        {extra}
        <Button type="submit" busy={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

const THEMES = [
  ["light", "Light", Sun],
  ["dark", "Dark", Moon],
  ["system", "System", Monitor],
];

/** Light / Dark / System segmented switch; `compact` shows icons only. */
export function ThemeSwitch({ compact = false }) {
  const [choice, , setTheme] = useTheme();
  return (
    <div className="nk-theme-switch" role="radiogroup" aria-label="Colour theme">
      {THEMES.map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          aria-label={compact ? label + " theme" : undefined}
          title={compact ? label : undefined}
          onClick={() => setTheme(value)}
        >
          <Icon className="icon icon-sm" strokeWidth={1.8} aria-hidden="true" />
          {!compact && label}
        </button>
      ))}
    </div>
  );
}

/** Loads `path` (GET) and exposes { data, error, loading, reload }. */
export function useResource(session, path, initial = null) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      const r = await request(session, path);
      setData(r.data);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session, path]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, setData, error, loading, reload };
}

/** Wraps a write: runs it, shows a toast, reloads, and keeps the error for the form. */
export function useAction(notify) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (fn, success) => {
    setBusy(true);
    setError("");
    try {
      const result = await fn();
      if (success) notify?.(success, "success");
      return result;
    } catch (e) {
      setError(e.message);
      notify?.(e.message, "error");
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}
