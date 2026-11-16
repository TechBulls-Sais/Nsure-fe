import React, { useMemo, useState } from "react";
import { FileText, RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  Drawer,
  Empty,
  ErrorNote,
  Panel,
  Skeleton,
  Tabs,
  pula,
  useResource,
  when,
} from "./ui/workspace";
import "./checkout.css";

// Staff reconciliation of premium payments (spec 13, NFR-11): every provider transaction with how it settled, and the
// raw gateway log behind it. Read-only; READ_PAYMENT (the Collections page's own code) opens it.

const STATUS_TONE = {
  CREATED: "amber",
  REDIRECTED: "amber",
  PENDING_VERIFICATION: "amber",
  SETTLED: "green",
  FAILED: "red",
  EXPIRED: "gray",
};

const STATUS_LABEL = {
  CREATED: "Created",
  REDIRECTED: "At provider",
  PENDING_VERIFICATION: "Verifying",
  SETTLED: "Settled",
  FAILED: "Failed",
  EXPIRED: "Expired",
};

const PURPOSE_LABEL = {
  FIRST_PREMIUM: "First premium",
  RENEWAL: "Renewal",
  REINSTATEMENT: "Reinstatement",
};

const FILTERS = [
  ["all", "All"],
  ["open", "In progress"],
  ["SETTLED", "Settled"],
  ["FAILED", "Failed"],
  ["EXPIRED", "Expired"],
];

export function TransactionStatus({ status }) {
  return <Badge tone={STATUS_TONE[status] || "blue"}>{STATUS_LABEL[status] || status}</Badge>;
}

const money = (tx) => (tx.currency && tx.currency !== "BWP" ? tx.currency + " " + tx.amount : pula(tx.amount));

export default function PaymentTransactions({ session }) {
  const list = useResource(session, "/payments/transactions", []);
  const [filter, setFilter] = useState("all");
  const [logFor, setLogFor] = useState(null);
  const rows = useMemo(() => {
    const all = list.data || [];
    if (filter === "all") return all;
    if (filter === "open") return all.filter((tx) => !tx.terminal);
    return all.filter((tx) => tx.status === filter);
  }, [list.data, filter]);
  const columns = [
    {
      key: "transactionId",
      label: "Transaction",
      render: (tx) => (
        <span className="pay-tx-id">
          <strong>#{tx.transactionId}</strong>
          <small>{when(tx.createdAt)}</small>
        </span>
      ),
      sortValue: (tx) => tx.transactionId,
    },
    { key: "status", label: "Status", render: (tx) => <TransactionStatus status={tx.status} /> },
    { key: "policyRef", label: "Policy" },
    { key: "method", label: "Method" },
    { key: "provider", label: "Provider" },
    { key: "amount", label: "Amount", align: "right", render: money, sortValue: (tx) => Number(tx.amount) },
    { key: "purpose", label: "Purpose", render: (tx) => PURPOSE_LABEL[tx.purpose] || tx.purpose || "—" },
    { key: "period", label: "Period", className: "muted" },
    {
      key: "settledVia",
      label: "Settled via",
      render: (tx) =>
        tx.settledVia ? (
          <span title={tx.settledAt ? "Settled " + when(tx.settledAt) : undefined}>{tx.settledVia}</span>
        ) : (
          "—"
        ),
    },
    { key: "verifyAttempts", label: "Attempts", align: "right" },
    {
      key: "failureReason",
      label: "Failure reason",
      render: (tx) => (tx.failureReason ? <span className="pay-reason">{tx.failureReason}</span> : "—"),
    },
    { key: "createdAt", label: "Created", className: "muted", render: (tx) => when(tx.createdAt) },
    {
      key: "act",
      label: "",
      render: (tx) => (
        <Button variant="secondary" icon={FileText} onClick={() => setLogFor(tx)}>
          Gateway log
        </Button>
      ),
    },
  ];
  return (
    <>
      <Panel
        title="Payment transactions"
        subtitle="The latest 200 attempts to collect a premium, newest first: card checkouts, mobile money, EFT and premiums staff recorded. Read-only."
        action={
          <Button variant="secondary" icon={RefreshCw} busy={list.loading && list.data?.length > 0} onClick={list.reload}>
            Refresh
          </Button>
        }
      >
        <ErrorNote error={list.error} />
        <Tabs tabs={FILTERS} value={filter} onChange={setFilter} />
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(tx) => tx.transactionId}
          loading={list.loading}
          onRowClick={setLogFor}
          empty={filter === "all" ? "No payment transactions yet" : "No transactions with this status"}
          emptyDetail="A transaction is created whenever a customer or staff member starts a premium payment."
          searchPlaceholder="Search by policy, method, provider or reason…"
        />
      </Panel>
      {logFor && <GatewayLog session={session} tx={logFor} onClose={() => setLogFor(null)} />}
    </>
  );
}

/** Everything sent to and received from the provider for one transaction, oldest first. */
function GatewayLog({ session, tx, onClose }) {
  const log = useResource(session, "/payments/transactions/" + tx.transactionId + "/log", []);
  return (
    <Drawer
      eyebrow="GATEWAY LOG"
      title={"Transaction #" + tx.transactionId}
      description={[tx.policyRef, tx.method, tx.provider, money(tx)].filter(Boolean).join(" · ")}
      onClose={onClose}
      size="lg"
    >
      <div className="pay-log-summary">
        <TransactionStatus status={tx.status} />
        <span>{PURPOSE_LABEL[tx.purpose] || tx.purpose}</span>
        {tx.period && <span>{tx.period}</span>}
        {tx.settledVia && <span>Settled via {tx.settledVia}{tx.settledAt ? " · " + when(tx.settledAt) : ""}</span>}
        <span>{tx.verifyAttempts} verify attempt{tx.verifyAttempts === 1 ? "" : "s"}</span>
      </div>
      {tx.failureReason && <ErrorNote error={tx.failureReason} />}
      <ErrorNote error={log.error} />
      {log.loading && !log.data?.length ? (
        <div className="pay-log">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={48} />
          ))}
        </div>
      ) : !log.data?.length ? (
        <Empty text="No gateway calls logged" detail="Nothing was sent to or received from a provider for this transaction." />
      ) : (
        <ol className="pay-log">
          {log.data.map((entry, i) => (
            <li key={i}>
              <div className="pay-log-head">
                <strong>{entry.operation}</strong>
                <small>
                  {entry.provider || "—"} · {when(entry.at)}
                </small>
              </div>
              <pre>{entry.payload || "(empty)"}</pre>
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}
