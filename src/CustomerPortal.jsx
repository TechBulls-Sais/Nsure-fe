import React, { useEffect, useState } from "react";
import { request } from "./api";
import { money, initials } from "./data";
import {
  BeneficiaryForm,
  BeneficiaryList,
  ClaimChecks,
  ClaimLodgeForm,
  PayForm,
  formatDate,
} from "./Workflow";

const productImages = {
  "Term Life": "/products/term-life.jpg",
  "Whole of Life": "/products/whole-of-life.jpg",
  "Family Funeral": "/products/family-funeral.jpg",
  "Care Cash": "/products/care-cash.jpg",
  "Individual Credit": "/products/individual-credit.jpg",
};

export default function CustomerPortal({ session, notify, logout, Icon, Button, Badge }) {
  const [profile, setProfile] = useState(null);
  const [products, setProducts] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [error, setError] = useState("");
  const [busyProduct, setBusyProduct] = useState("");
  const [claims, setClaims] = useState([]);
  const [acting, setActing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const canBuy = Boolean(profile?.kycVerified && !profile?.eddBlocked);

  async function load() {
    const [meR, productsR, policiesR, claimsR] = await Promise.all([
      request(session, "/portal/me"),
      request(session, "/portal/products"),
      request(session, "/portal/policies"),
      request(session, "/portal/claims"),
    ]);
    setProfile(meR.data);
    setProducts(productsR.data);
    setPolicies(policiesR.data);
    setClaims(claimsR.data);
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

  async function buy(product) {
    setBusyProduct(product.name);
    setError("");
    try {
      const result = await request(session, "/portal/purchase", {
        method: "POST",
        body: { product: product.name },
      });
      await load();
      notify(
        product.name + " is reserved as " + result.data.policyId + ". Pay the first premium to start your cover.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyProduct("");
    }
  }

  // A workflow call on the customer's own policy or claim, then a fresh load of the portal.
  async function act(path, body, done, method = "POST") {
    setActing(true);
    setError("");
    try {
      await request(session, path, { method, body });
      await load();
      if (done) notify(done);
      return true;
    } catch (err) {
      notify(err.message);
      return false;
    } finally {
      setActing(false);
    }
  }

  if (!profile) {
    return (
      <div className="customer-portal">
        <p className="subtitle">{error || "Loading your portal…"}</p>
      </div>
    );
  }

  return (
    <div className="customer-portal">
      <header className="customer-portal-top">
        <div>
          <div className="eyebrow">CUSTOMER PORTAL</div>
          <h1>Welcome, {profile.name.split(" ")[0]}.</h1>
          <p className="subtitle">
            Choose a product and buy protection in your own name.
          </p>
        </div>
        <div className="customer-portal-account">
          <span className="avatar">{initials(profile.name)}</span>
          <div>
            <strong>{profile.name}</strong>
            <small>
              {profile.customerRef} · {profile.status}
            </small>
          </div>
          <button className="btn secondary" type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      {error && <p className="form-error">{error}</p>}

      {!profile.kycVerified && (
        <div className="notice">
          <p>
            {profile.kycRejectionReason ? (
              <>
                <strong>We could not verify your identity:</strong> {profile.kycRejectionReason}. Please contact us.
              </>
            ) : (
              <>
                <strong>KYC is still pending.</strong> An onboarding specialist must
                mark your verification successful before you can buy a policy.
              </>
            )}
          </p>
        </div>
      )}
      {profile.kycVerified && profile.eddBlocked && (
        <div className="notice">
          <p>
            <strong>An extra identity review is in progress.</strong> You can browse cover, and buy it once the
            review is verified.
            {profile.eddRejectionReason ? " Reason: " + profile.eddRejectionReason : ""}
          </p>
        </div>
      )}

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Your policies</h2>
            <p className="subtitle">
              A policy you buy is reserved until you pay its first premium; cover starts once it is paid.
            </p>
          </div>
        </div>
        {policies.length === 0 ? (
          <p className="muted">No policies yet. Pick a product below to get started.</p>
        ) : (
          <div className="portal-policies">
            {policies.map((policy) => {
              const editable = ["Pending Payment", "Active"].includes(policy.status);
              return (
                <article className="portal-policy" key={policy.id}>
                  <header>
                    <div>
                      <strong>{policy.product}</strong>
                      <small>
                        {policy.id} · cover {money(policy.amount)} · {money(policy.premium)} / month
                      </small>
                    </div>
                    <Badge>{policy.status}</Badge>
                  </header>
                  {policy.status === "Pending Payment" && (
                    <p className="muted small">
                      {policy.paymentDueBy
                        ? "Pay by " + formatDate(policy.paymentDueBy) + " or the reservation expires."
                        : "Reserved for you with no deadline."}
                    </p>
                  )}
                  {policy.status === "Active" && (
                    <p className="muted small">
                      Cover since {formatDate(policy.coverStartDate)} · next premium due{" "}
                      {formatDate(policy.nextPremiumDue)}
                      {policy.inGrace ? " · overdue: pay by " + formatDate(policy.gracePeriodEnd) + " to keep your cover" : ""}
                    </p>
                  )}
                  {policy.status === "Lapsed" && (
                    <p className="muted small">Lapsed on {formatDate(policy.lapseDate)}: the premium was not paid.</p>
                  )}
                  {policy.status === "Expired" && (
                    <p className="muted small">Not paid in time. Buy the cover again to restart.</p>
                  )}
                  {policy.status === "Cancelled" && (
                    <p className="muted small">Cancelled{policy.statusNote ? ": " + policy.statusNote : "."}</p>
                  )}
                  {editable && (
                    <PayForm
                      busy={acting}
                      label={(policy.status === "Active" ? "Pay premium " : "Pay ") + money(policy.premium)}
                      onPay={(method) =>
                        act(
                          "/portal/policies/" + policy.id + "/pay",
                          { method },
                          policy.status === "Active"
                            ? "Premium paid for " + policy.id + "."
                            : policy.id + " is paid. Your cover has started.",
                        )
                      }
                    />
                  )}
                  <details>
                    <summary>Beneficiaries · {policy.beneficiaries?.length || 0} of 5</summary>
                    <BeneficiaryList
                      beneficiaries={policy.beneficiaries}
                      busy={acting}
                      onRemove={
                        editable
                          ? (b) =>
                              act(
                                "/portal/policies/" + policy.id + "/beneficiaries/" + b.id,
                                undefined,
                                b.fullName + " removed.",
                                "DELETE",
                              )
                          : null
                      }
                    />
                    {editable && (policy.beneficiaries?.length || 0) < 5 && (
                      <BeneficiaryForm
                        busy={acting}
                        onSave={(body) =>
                          act("/portal/policies/" + policy.id + "/beneficiaries", body, "Beneficiary added.")
                        }
                      />
                    )}
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Your claims</h2>
            <p className="subtitle">
              We check a claim straight away. A clear claim that pays a registered beneficiary can be approved at
              once; others are reviewed by our claims team.
            </p>
          </div>
          {!claiming && policies.some((p) => ["Active", "Lapsed"].includes(p.status)) && (
            <Button onClick={() => setClaiming(true)}>Make a claim</Button>
          )}
        </div>
        {claiming && (
          <ClaimLodgeForm
            policies={policies.filter((p) => ["Active", "Lapsed"].includes(p.status))}
            busy={acting}
            submitLabel="Submit claim"
            onCancel={() => setClaiming(false)}
            onSave={async (body) => {
              const ok = await act("/portal/claims", body, "Your claim is received.");
              if (ok) setClaiming(false);
            }}
          />
        )}
        {claims.length === 0 ? (
          !claiming && <p className="muted">You have not made a claim.</p>
        ) : (
          <div className="portal-policies">
            {claims.map((claim) => (
              <article className="portal-policy" key={claim.id}>
                <header>
                  <div>
                    <strong>
                      {claim.id} · {claim.product}
                    </strong>
                    <small>
                      Policy {claim.policy} · {claim.claimant}
                      {claim.eventDate ? " · event " + formatDate(claim.eventDate) : ""}
                    </small>
                  </div>
                  <Badge>{claim.status}</Badge>
                </header>
                {claim.status === "Rejected" && <p className="muted small">Not approved: {claim.rejectionReason}</p>}
                {claim.status === "Approved" && (
                  <p className="muted small">
                    Approved for {money(claim.payoutAmount)}. The payout to {claim.payee?.name} is on its way.
                  </p>
                )}
                {claim.status === "Paid" && (
                  <p className="muted small">
                    {money(claim.payoutAmount)} paid to {claim.payee?.name}
                    {claim.paidAt ? " on " + formatDate(claim.paidAt) : ""}.
                  </p>
                )}
                <details>
                  <summary>Checks</summary>
                  <ClaimChecks checks={claim.checks} />
                </details>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Buy a policy</h2>
            <p className="subtitle">Select any product to purchase cover.</p>
          </div>
        </div>
        <div className="product-grid">
          {products.map((product) => {
            const image = productImages[product.name];
            return (
              <article
                className={"product-card " + product.color + (image ? " has-photo" : "")}
                key={product.name}
              >
                {image && (
                  <div className="product-photo-wrap">
                    <img className="product-photo" src={image} alt="" />
                    <div className="product-overlay">
                      <h2>{product.name}</h2>
                      <p>{product.description}</p>
                      <div className="product-cover">
                        <small>COVER</small>
                        <strong>{product.cover}</strong>
                      </div>
                      <div className="product-footer">
                        <div>
                          <strong>BWP {product.premium}</strong>
                          <small> / month</small>
                        </div>
                        <Button
                          disabled={!canBuy || busyProduct === product.name}
                          onClick={() => buy(product)}
                        >
                          {busyProduct === product.name ? "Buying…" : "Buy policy"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                {!image && (
                  <>
                    <h2>{product.name}</h2>
                    <p>{product.description}</p>
                    <div className="product-cover">
                      <small>COVER</small>
                      <strong>{product.cover}</strong>
                    </div>
                    <Button
                      disabled={!canBuy || busyProduct === product.name}
                      onClick={() => buy(product)}
                    >
                      {busyProduct === product.name ? "Buying…" : "Buy policy"}
                    </Button>
                  </>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
