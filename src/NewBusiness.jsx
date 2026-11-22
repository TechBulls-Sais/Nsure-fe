import React, { useEffect, useState } from "react";
import { FileSignature, Plus, Save, X } from "lucide-react";
import { request } from "./api";
import { Badge, Button, DataTable, ErrorNote, Panel, can, pula, useAction, useResource, when } from "./ui/workspace";

// IL01 new business workspace: the cross-application missing-evidence queue and a side-by-side quote comparison.

/** Every evidence item still outstanding on an open application, from its checklist or its underwriting case. */
export function EvidenceQueue({ session, onOpen }) {
  const queue = useResource(session, "/portfolio/applications/evidence-queue", []);
  const rows = queue.data || [];
  const overdue = rows.filter((r) => r.overdue).length;
  return (
    <Panel
      title="Missing evidence"
      subtitle={
        rows.length +
        " item(s) outstanding on open applications" +
        (overdue ? ", " + overdue + " overdue" : "") +
        ". Application evidence is due 14 days after submission (demo default); underwriting evidence on the date the underwriter set."
      }
    >
      <ErrorNote error={queue.error} />
      <DataTable
        rows={rows}
        loading={queue.loading}
        rowKey={(r, i) => r.applicationRef + "-" + i}
        onRowClick={onOpen ? (r) => onOpen(r.applicationRef) : undefined}
        empty="No evidence outstanding"
        emptyDetail="Every open application has the evidence it needs."
        searchPlaceholder="Search applications, applicants, evidence…"
        columns={[
          { key: "applicationRef", label: "Application" },
          { key: "customerName", label: "Applicant" },
          { key: "product", label: "Product" },
          { key: "item", label: "Evidence" },
          { key: "life", label: "Life" },
          {
            key: "source",
            label: "Asked by",
            render: (r) => (r.source === "UNDERWRITING" ? "Underwriting " + (r.caseRef || "") : "Application checklist"),
          },
          {
            key: "dueDate",
            label: "Due",
            render: (r) => <Badge tone={r.overdue ? "red" : "amber"}>{(r.overdue ? "Overdue " : "") + r.dueDate}</Badge>,
          },
          { key: "reminders", label: "Reminders", align: "right", render: (r) => r.reminders || "—" },
          { key: "status", label: "Application status" },
        ]}
      />
    </Panel>
  );
}

const MAX_COMPARE = 4;

/**
 * Quote comparison (IL01 workspace): price up to four plans side by side for one customer on the server, save the
 * chosen one as a stored quote, and start a draft application from it.
 */
export function QuoteComparison({ session, customers = [], products = [], notify, profile, onDraftCreated }) {
  const [customerRef, setCustomerRef] = useState(customers[0]?.id || "");
  const [picks, setPicks] = useState([]);
  const [product, setProduct] = useState(products[0]?.name || "");
  const [tier, setTier] = useState("");
  const [prices, setPrices] = useState({});
  const action = useAction(notify);
  const saved = useResource(
    session,
    customerRef ? "/portfolio/quotes?customerRef=" + encodeURIComponent(customerRef) : null,
    [],
  );
  const mayQuote = can(profile, "CREATE_APPLICATION") || can(profile, "CREATE_POLICY");
  const tiersOf = (name) => products.find((p) => p.name === name)?.tiers || [];
  useEffect(() => {
    const first = tiersOf(product)[0];
    setTier(first?.name || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);
  // Every pick is priced on the server for the chosen customer (flat or rated); nothing is priced in the browser.
  useEffect(() => {
    let live = true;
    if (!customerRef) return undefined;
    picks.forEach((p) => {
      const key = p.product + "|" + p.tier;
      request(session, "/portfolio/quote", { method: "POST", body: { customerRef, product: p.product, tier: p.tier } })
        .then((r) => live && setPrices((all) => ({ ...all, [key]: { quote: r.data } })))
        .catch((e) => live && setPrices((all) => ({ ...all, [key]: { error: e.message } })));
    });
    return () => {
      live = false;
    };
  }, [session, customerRef, picks]);
  const add = () => {
    if (!product || !tier || picks.length >= MAX_COMPARE) return;
    if (picks.some((p) => p.product === product && p.tier === tier)) return;
    setPicks([...picks, { product, tier }]);
  };
  const saveQuote = async (p) => {
    const done = await action.run(
      () => request(session, "/portfolio/quotes", { method: "POST", body: { customerRef, product: p.product, tier: p.tier } }),
      "Quote saved",
    );
    if (done) saved.reload();
  };
  const startApplication = async (q) => {
    const done = await action.run(
      () =>
        request(session, "/portfolio/applications", {
          method: "POST",
          body: { customerRef: q.customerRef, product: q.product, tier: q.tier, quoteRef: q.ref, status: "Draft" },
        }),
      "Draft application started from " + q.ref + ". Open it to complete and submit.",
    );
    if (done) {
      saved.reload();
      onDraftCreated?.(done.data);
    }
  };
  const customer = customers.find((c) => c.id === customerRef);
  return (
    <>
      <Panel
        title="Compare quotes"
        subtitle="Price up to four plans side by side for one customer. Prices come from the server on today's approved rates and product terms; a saved quote keeps its inputs, trace and validity."
      >
        <div className="nb-compare-controls">
          <label>
            <span>Customer</span>
            <select value={customerRef} onChange={(e) => setCustomerRef(e.target.value)}>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Product</span>
            <select value={product} onChange={(e) => setProduct(e.target.value)}>
              {products
                .filter((p) => (p.tiers || []).length)
                .map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>Plan</span>
            <select value={tier} onChange={(e) => setTier(e.target.value)}>
              {tiersOf(product).map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <Button icon={Plus} variant="secondary" disabled={!tier || picks.length >= MAX_COMPARE} onClick={add}>
            Add to comparison
          </Button>
        </div>
        <ErrorNote error={action.error} />
        {picks.length === 0 ? (
          <p className="ws-hint">Add plans to compare their cover, benefits and price for {customer?.name || "the customer"}.</p>
        ) : (
          <div className="nb-compare-grid">
            {picks.map((p) => {
              const key = p.product + "|" + p.tier;
              const t = tiersOf(p.product).find((x) => x.name === p.tier) || {};
              const price = prices[key];
              return (
                <div className="nb-compare-card" key={key}>
                  <div className="nb-compare-head">
                    <strong>{p.product}</strong>
                    <span>{p.tier}</span>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={"Remove " + key}
                      onClick={() => setPicks(picks.filter((x) => x !== p))}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <dl>
                    <dt>Cover</dt>
                    <dd>{pula(price?.quote?.cover ?? t.cover)}</dd>
                    <dt>Monthly premium</dt>
                    <dd>
                      {price?.error ? (
                        <span className="form-error">{price.error}</span>
                      ) : price?.quote ? (
                        pula(price.quote.premium)
                      ) : (
                        "Pricing…"
                      )}
                    </dd>
                    <dt>Pricing</dt>
                    <dd>{price?.quote?.rated ? "Rated by age (" + price.quote.rateTableVersion + ")" : "Flat plan premium"}</dd>
                    <dt>Benefits</dt>
                    <dd>{t.benefits || "As described in the product terms"}</dd>
                  </dl>
                  {mayQuote && price?.quote && (
                    <Button icon={Save} variant="secondary" disabled={action.busy} onClick={() => saveQuote(p)}>
                      Save as quote
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
      {customerRef && (
        <Panel title={"Saved quotes for " + (customer?.name || customerRef)} subtitle="The latest version of each stored quote.">
          <ErrorNote error={saved.error} />
          <DataTable
            rows={saved.data || []}
            loading={saved.loading}
            rowKey={(r) => r.ref}
            searchFrom={99}
            empty="No saved quotes"
            columns={[
              { key: "ref", label: "Quote", render: (r) => r.ref + " v" + r.version },
              { key: "product", label: "Product", render: (r) => r.product + " · " + r.tier },
              { key: "premium", label: "Premium", align: "right", render: (r) => pula(r.premium) },
              {
                key: "terms",
                label: "Product terms",
                render: (r) => r.trace?.productVersion?.label || "—",
              },
              {
                key: "validUntil",
                label: "Valid until",
                render: (r) => (r.expired ? <Badge tone="red">Expired {r.validUntil}</Badge> : r.validUntil),
              },
              { key: "status", label: "Status" },
              { key: "createdAt", label: "Saved", render: (r) => when(r.createdAt) },
              {
                key: "act",
                label: "",
                render: (r) =>
                  can(profile, "CREATE_APPLICATION") &&
                  !r.applicationRef &&
                  !r.expired && (
                    <Button icon={FileSignature} variant="secondary" disabled={action.busy} onClick={() => startApplication(r)}>
                      Start application
                    </Button>
                  ),
              },
            ]}
          />
        </Panel>
      )}
    </>
  );
}
