import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleCheck,
  Clock3,
  Grid2X2,
  Heart,
  HeartPulse,
  Infinity,
  Landmark,
  LogOut,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { request } from "./api";
import { money } from "./data";
import "./customer-policies.css";
import CoveredLives, { LifeCoverList, completeLives, livesBody, useLifeQuote } from "./CoveredLives";
import {
  BeneficiaryForm,
  BeneficiaryList,
  ClaimChecks,
  ClaimDocuments,
  ClaimLodgeForm,
  PayForm,
  formatDate,
} from "./Workflow";

// Products name their "need" icon (need_icon in the database); this maps the name to a component.
const needIcons = { Users, Infinity, Heart, HeartPulse, Landmark, ShieldCheck };

// " / day" for cover paid per day, nothing for a lump sum (cover_unit in the database).
function coverSuffix(product) {
  return product?.coverUnit ? " / " + product.coverUnit : "";
}

// The chosen tier's premium; the product's headline premium when it has no tiers.
function chosenPremium(product, tierName) {
  const tier = (product?.tiers || []).find((item) => item.name === tierName);
  return tier ? money(tier.premium) : product?.premium;
}

function defaultTierName(product) {
  const tiers = product?.tiers || [];
  return (tiers.find((tier) => tier.popular) || tiers[0])?.name || "";
}

export default function CustomerPortal({
  session,
  shop,
  notify,
  onLogout,
  onShop,
}) {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("policies");
  const [need, setNeed] = useState("all");
  const [choice, setChoice] = useState(null);
  const [tierChoice, setTierChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const customer = shop?.customer;
  const verified = customer?.kycStatus === "VERIFIED";
  const products = shop?.products || [];
  const policies = shop?.policies || [];
  const requests = shop?.requests || [];
  const monthlyTotal = policies.reduce((sum, policy) => sum + Number(policy.premium || 0), 0);
  // Spec 01 BR-25: plan selection waits for an open or failed EDD review to clear.
  const eddBlocked = ["PENDING", "FAILED"].includes(customer?.eddStatus);
  const canRequest = verified && !eddBlocked;
  const [showPolicies, setShowPolicies] = useState(false);
  const firstName = (customer?.name || "there").split(" ")[0];
  const [lives, setLives] = useState([]);
  const [acting, setActing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const claims = shop?.claims || [];
  const awaitingPayment = requests.filter((item) => item.status === "Pending Payment");
  const chosenTier = (products.find((product) => product.name === choice)?.tiers || []).find(
    (tier) => tier.name === tierChoice,
  );
  const rated = chosenTier?.priceIsFrom ? chosenTier : null;
  const priced = useLifeQuote(
    session,
    "/portfolio/shop/quote",
    { product: choice, tier: tierChoice, lives: livesBody(completeLives(lives)) },
    Boolean(rated && canRequest),
  );

  const needs = useMemo(() => {
    const byKey = new Map();
    for (const product of products) {
      if (product.need && !byKey.has(product.need)) {
        byKey.set(product.need, {
          id: product.need,
          label: product.needLabel || product.need,
          icon: needIcons[product.needIcon] || ShieldCheck,
        });
      }
    }
    return [{ id: "all", label: "All cover", icon: Grid2X2 }, ...byKey.values()];
  }, [products]);

  const visibleProducts = useMemo(
    () => (need === "all" ? products : products.filter((product) => product.need === need)),
    [need, products],
  );
  const productByName = useMemo(
    () => Object.fromEntries(products.map((product) => [product.name, product])),
    [products],
  );

  useEffect(() => {
    let frame;
    const update = () => {
      setScrolled(window.scrollY > 24);
      const explore = document.getElementById("available-cover");
      setActiveSection(
        explore && explore.getBoundingClientRect().top < 210
          ? "explore"
          : "policies",
      );
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [customer?.id]);

  function scrollBehavior() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth";
  }

  useEffect(() => {
    if (!choice) return undefined;
    document
      .getElementById("customer-buy")
      ?.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
    return undefined;
  }, [choice]);

  function scrollToSection(event) {
    event.preventDefault();
    const target = event.currentTarget.getAttribute("href").slice(1);
    document.getElementById(target)?.scrollIntoView({
      behavior: scrollBehavior(),
      block: "start",
    });
  }

  async function buy(event) {
    event.preventDefault();
    if (!choice) return;
    setBusy(true);
    setError("");
    try {
      const result = await request(session, "/portfolio/shop", {
        method: "POST",
        body: {
          product: choice,
          tier: tierChoice || undefined,
          ...(rated ? { lives: livesBody(lives) } : {}),
        },
      });
      onShop(result.data);
      setChoice(null);
      setLives([]);
      setMessage(
        choice + (tierChoice ? " (" + tierChoice + ")" : "") +
          " is reserved for you. Pay the first premium below to start your cover.",
      );
      notify("Cover reserved. Pay to activate it.");
      window.setTimeout(() => {
        document
          .getElementById("your-requests")
          ?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
      }, 80);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // A workflow call on the customer's own policy or claim; the server answers with the refreshed portal.
  async function act(path, body, done, method = "POST") {
    setActing(true);
    setError("");
    try {
      const result = await request(session, path, { method, body });
      onShop(result.data);
      setMessage("");
      if (done) notify(done);
      return true;
    } catch (err) {
      notify(err.message);
      return false;
    } finally {
      setActing(false);
    }
  }

  function beneficiaries(policy) {
    const editable = ["Pending Payment", "Active"].includes(policy.status);
    return (
      <div className="customer-workflow">
        <h4>Beneficiaries · {policy.beneficiaries?.length || 0} of 5</h4>
        <BeneficiaryList
          beneficiaries={policy.beneficiaries}
          busy={acting}
          onRemove={
            editable
              ? (b) =>
                  act(
                    "/portfolio/shop/policies/" + policy.id + "/beneficiaries/" + b.id,
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
              act("/portfolio/shop/policies/" + policy.id + "/beneficiaries", body, "Beneficiary added.")
            }
          />
        )}
      </div>
    );
  }

  if (shop?.error) {
    return (
      <div className="login-page">
        <p className="form-error">{shop.error}</p>
        <button className="btn secondary" type="button" onClick={onLogout}>
          Sign out
        </button>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="login-page">
        <p className="login-note">Loading your cover options…</p>
      </div>
    );
  }

  return (
    <div className="customer-shell">
      <header className={"customer-top" + (scrolled ? " is-scrolled" : "")}>
        <a className="customer-brand" href="#/overview" aria-label="Nsure Life home">
          <img
            className="brand-logo"
            src="/brand/nsure-life-logo.svg"
            alt="Nsure Life"
          />
        </a>
        <nav className="customer-nav" aria-label="Customer navigation">
          <a
            href="#your-cover"
            onClick={scrollToSection}
            aria-current={activeSection === "policies" ? "location" : undefined}
          >
            Your policies <span>{policies.length}</span>
          </a>
          {requests.length > 0 && (
            <a href="#your-requests" onClick={scrollToSection}>
              To pay <span>{awaitingPayment.length}</span>
            </a>
          )}
          <a href="#your-claims" onClick={scrollToSection}>
            Claims <span>{claims.length}</span>
          </a>
          <a
            href="#available-cover"
            onClick={scrollToSection}
            aria-current={activeSection === "explore" ? "location" : undefined}
          >
            Explore cover
          </a>
        </nav>
        <div className="customer-user">
          <span className="customer-avatar" aria-hidden="true">
            {firstName.slice(0, 1)}
          </span>
          <div>
            <strong>{customer.name}</strong>
            <small>{customer.id}</small>
          </div>
          <button
            className="customer-signout"
            aria-label="Sign out"
            type="button"
            onClick={onLogout}
          >
            <LogOut size={17} aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      <main className="customer-main">
        <section className="customer-hero" aria-labelledby="customer-welcome">
          <div className="customer-hero-copy">
            <p className="customer-kicker">Your personal insurance space</p>
            <h1 id="customer-welcome">Hello, {firstName}.</h1>
            <p className="customer-hero-description">
              {policies.length
                ? "Your policies, your peace of mind. Everything you need, in one place."
                : "A little protection goes a long way. Let’s find the right cover for you."}
            </p>
          </div>
          <div className={"customer-account" + (verified ? "" : " is-waiting")}>
            {verified ? (
              <CircleCheck size={20} aria-hidden="true" />
            ) : (
              <Clock3 size={20} aria-hidden="true" />
            )}
            <div>
              <strong>
                {verified ? "Identity verified" : "Verification pending"}
              </strong>
              <p>
                {verified
                  ? eddBlocked
                    ? "Our team is completing an extra identity review. You can buy cover once it clears." +
                      (customer.eddRejectionReason ? " Reason: " + customer.eddRejectionReason : "")
                    : "You can buy cover. It starts as soon as you pay the first premium."
                  : customer.kycStatus === "FAILED"
                    ? "We could not verify your identity" +
                      (customer.kycRejectionReason ? ": " + customer.kycRejectionReason : ".") +
                      " Please contact us."
                    : "Our team needs to verify your identity before you can buy cover."}
              </p>
            </div>
          </div>
        </section>

        {message && (
          <div className="customer-flash" role="status">
            {message}
          </div>
        )}

        <section
          className={"customer-policies" + (!policies.length ? " is-empty" : "") + (showPolicies ? " is-open" : "")}
          id="your-cover"
          aria-labelledby="customer-policies-heading"
        >
          <div className="customer-section-head">
            <div>
              <p className="customer-eyebrow">YOUR COVER AT A GLANCE</p>
              <h2 id="customer-policies-heading">
                Your policies{" "}
                <span className="customer-policy-count">{policies.length}</span>
              </h2>
              <p>
                {policies.length
                  ? "Cover you have paid for. Tap to see every policy."
                  : "Your cover appears here once you pay its first premium."}
              </p>
            </div>
            <a
              className="customer-add-cover"
              href="#available-cover"
              onClick={scrollToSection}
            >
              Request more cover <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
          {!policies.length ? (
            <div className="customer-empty">
              <span>
                <ShieldCheck size={26} aria-hidden="true" />
              </span>
              <div>
                <h3>Your cover will live here</h3>
                <p>
                  Choose cover below and pay the first premium. Your policy
                  appears here as soon as it is paid.
                </p>
              </div>
              <a href="#available-cover" onClick={scrollToSection}>
                Find your cover <ArrowRight size={17} aria-hidden="true" />
              </a>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="customer-policy-toggle"
                aria-expanded={showPolicies}
                aria-controls="customer-policy-list"
                onClick={() => setShowPolicies((open) => !open)}
              >
                <span className="customer-policy-toggle-summary">
                  <strong>
                    {policies.length} {policies.length === 1 ? "policy" : "policies"}
                  </strong>
                  <span>{money(monthlyTotal)} / month in total</span>
                </span>
                <span className="customer-policy-toggle-products" aria-hidden="true">
                  {[...new Set(policies.map((policy) => policy.product))].slice(0, 4).map((name) => (
                    <em key={name}>{name}</em>
                  ))}
                </span>
                <span className="customer-policy-toggle-action">
                  {showPolicies ? "Hide policies" : "View all policies"}
                  <ChevronDown size={16} aria-hidden="true" />
                </span>
              </button>
              {showPolicies && (
                <ul className="customer-policy-list" id="customer-policy-list">
                  {policies.map((policy) => {
                    const isActive = ["active", "in force", "in_force"].includes(
                      String(policy.status).toLowerCase(),
                    );
                    return (
                      <li key={policy.id}>
                        <div className="customer-policy-card-head">
                          <span className="customer-policy-icon">
                            <ShieldCheck size={16} aria-hidden="true" />
                          </span>
                          <div className="customer-policy-title">
                            <h3>
                              {policy.product}
                              {policy.tier ? " · " + policy.tier : ""}
                            </h3>
                            <p className="customer-policy-reference">{policy.id}</p>
                          </div>
                          <span className={"customer-policy-status" + (isActive ? " is-active" : "")}>
                            {isActive && <span aria-hidden="true" />}
                            {policy.status || "Status unavailable"}
                          </span>
                        </div>
                        <dl className="customer-policy-values">
                          <div>
                            <dt>Cover</dt>
                            <dd>
                              {money(policy.amount)}
                              {coverSuffix(productByName[policy.product])}
                            </dd>
                          </div>
                          <div>
                            <dt>Premium</dt>
                            <dd>
                              {money(policy.premium)}
                              <small> / month</small>
                            </dd>
                          </div>
                        </dl>
                        <details className="customer-policy-details">
                          <summary>
                            Details <ChevronDown size={14} aria-hidden="true" />
                          </summary>
                          <dl>
                            {policy.coverStartDate && (
                              <div>
                                <dt>Cover started</dt>
                                <dd>{formatDate(policy.coverStartDate)}</dd>
                              </div>
                            )}
                            {policy.status === "Active" && policy.nextPremiumDue && (
                              <div>
                                <dt>Next premium due</dt>
                                <dd>{formatDate(policy.nextPremiumDue)}</dd>
                              </div>
                            )}
                            {policy.status === "Lapsed" && policy.lapseDate && (
                              <div>
                                <dt>Lapsed on</dt>
                                <dd>{formatDate(policy.lapseDate)}</dd>
                              </div>
                            )}
                            <div>
                              <dt>Policyholder</dt>
                              <dd>{customer.name}</dd>
                            </div>
                          </dl>
                          <LifeCoverList lives={policy.lives} />
                          {beneficiaries(policy)}
                        </details>
                        {policy.inGrace && (
                          <p className="customer-grace">
                            Your premium is overdue. Pay by {formatDate(policy.gracePeriodEnd)} to keep your cover.
                          </p>
                        )}
                        {policy.status === "Active" && (
                          <PayForm
                            busy={acting}
                            label={"Pay premium " + money(policy.premium)}
                            onPay={(method) =>
                              act(
                                "/portfolio/shop/policies/" + policy.id + "/pay",
                                { method },
                                "Premium paid for " + policy.id + ".",
                              )
                            }
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </section>

        {requests.length > 0 && (
          <section className="customer-requests" id="your-requests" aria-labelledby="customer-requests-heading">
            <div className="customer-requests-head">
              <h2 id="customer-requests-heading">
                Awaiting payment <span>{awaitingPayment.length}</span>
              </h2>
              <p>Cover you chose is reserved until the time shown. It starts when you pay the first premium.</p>
            </div>
            <ul>
              {requests.map((item) => {
                const pending = item.status === "Pending Payment";
                return (
                  <li key={item.id} className={pending ? "is-pending" : "is-rejected"}>
                    <span className="customer-request-icon" aria-hidden="true">
                      {pending ? <Clock3 size={15} /> : <X size={15} />}
                    </span>
                    <div>
                      <strong>
                        {item.product}
                        {item.tier ? " · " + item.tier : ""}
                      </strong>
                      <small>
                        {item.id} · chosen {item.date} · {money(item.premium)} / month
                      </small>
                      {pending && (
                        <p>
                          {item.paymentDueBy
                            ? "Pay by " + formatDate(item.paymentDueBy) + " or the reservation expires."
                            : "Reserved for you with no deadline."}
                        </p>
                      )}
                      {item.status === "Expired" && <p>Not paid in time. Choose the cover again to buy it.</p>}
                      {item.status === "Cancelled" && (
                        <p>Cancelled{item.reviewNote ? ": " + item.reviewNote : "."}</p>
                      )}
                      {pending && (
                        <>
                          <PayForm
                            busy={acting}
                            label={"Pay " + money(item.premium)}
                            onPay={(method) =>
                              act(
                                "/portfolio/shop/policies/" + item.id + "/pay",
                                { method },
                                item.id + " is paid. Your cover has started.",
                              )
                            }
                          />
                          {beneficiaries(item)}
                        </>
                      )}
                    </div>
                    <span className="customer-request-status">{item.status}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="customer-requests customer-claims" id="your-claims" aria-labelledby="customer-claims-heading">
          <div className="customer-requests-head">
            <h2 id="customer-claims-heading">
              Your claims <span>{claims.length}</span>
            </h2>
            <p>
              Tell us what happened and we check the claim straight away. Clear claims that pay a registered
              beneficiary can be approved at once; others are reviewed by our claims team.
            </p>
            {policies.length > 0 && !claiming && (
              <button className="btn primary" type="button" onClick={() => setClaiming(true)}>
                Make a claim
              </button>
            )}
          </div>
          {claiming && (
            <div className="customer-claim-form">
              <ClaimLodgeForm
                policies={policies}
                busy={acting}
                submitLabel="Submit claim"
                onCancel={() => setClaiming(false)}
                onSave={async (body) => {
                  const ok = await act("/portfolio/shop/claims", body, "Your claim is received.");
                  if (ok) setClaiming(false);
                }}
              />
            </div>
          )}
          {claims.length > 0 ? (
            <ul>
              {claims.map((item) => (
                <li
                  key={item.id}
                  className={["Rejected"].includes(item.status) ? "is-rejected" : "is-pending"}
                >
                  <span className="customer-request-icon" aria-hidden="true">
                    {item.status === "Rejected" ? <X size={15} /> : ["Approved", "Paid"].includes(item.status) ? <Check size={15} /> : <Clock3 size={15} />}
                  </span>
                  <div>
                    <strong>
                      {item.id} · {item.product}
                    </strong>
                    <small>
                      Policy {item.policy} · {item.claimant}
                      {item.eventDate ? " · event " + formatDate(item.eventDate) : ""}
                    </small>
                    {item.status === "Rejected" && <p>Not approved: {item.rejectionReason}</p>}
                    {item.status === "Approved" && (
                      <p>
                        Approved for {money(item.payoutAmount)}. The payout to {item.payee?.name} is on its way.
                      </p>
                    )}
                    {item.status === "Paid" && (
                      <p>
                        {money(item.payoutAmount)} paid to {item.payee?.name}
                        {item.paidAt ? " on " + formatDate(item.paidAt) : ""}.
                      </p>
                    )}
                    <details className="customer-policy-details">
                      <summary>
                        Checks <ChevronDown size={14} aria-hidden="true" />
                      </summary>
                      <ClaimChecks checks={item.checks} />
                    </details>
                    <details className="customer-policy-details">
                      <summary>
                        Documents ({(item.documents || []).length}) <ChevronDown size={14} aria-hidden="true" />
                      </summary>
                      <ClaimDocuments
                        session={session}
                        claim={item}
                        basePath={"/portfolio/shop/claims/" + item.id + "/documents"}
                        canUpload
                        onUploaded={onShop}
                        notify={notify}
                      />
                    </details>
                  </div>
                  <span className="customer-request-status">{item.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            !claiming && <p className="subtitle">You have not made a claim.</p>
          )}
        </section>

        <section
          className="customer-need"
          id="available-cover"
          aria-labelledby="customer-needs-heading"
        >
          <h2 id="customer-needs-heading">What would you like to protect?</h2>
          <p>
            Start with what matters most. We’ll help you find the cover to
            match.
          </p>
          <div
            className="customer-need-list"
            role="group"
            aria-label="Filter cover by need"
          >
            {needs.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={need === item.id}
                disabled={busy}
                className={need === item.id ? "active" : ""}
                onClick={() => {
                  setNeed(item.id);
                  if (item.id !== "all") {
                    setChoice(null);
                  }
                }}
              >
                <item.icon size={18} aria-hidden="true" />
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="customer-products">
          <div className="customer-section-head">
            <div>
              <h2>
                {need === "all"
                  ? "Cover for every chapter"
                  : needs.find((item) => item.id === need)?.label}
              </h2>
              <p>
                Simple options. Clear monthly premiums. Cover that fits your
                life.
              </p>
            </div>
            <span className="customer-result-count" role="status">
              {visibleProducts.length}{" "}
              {visibleProducts.length === 1 ? "option" : "options"} available
            </span>
          </div>
          <div className="customer-product-list">
            {visibleProducts.map((product) => {
              const open = choice === product.name;
              const benefits = product.benefits || [];
              return (
                <article
                  className={"customer-product" + (open ? " selected" : "")}
                  key={product.name}
                >
                  <div className="customer-product-summary">
                    {product.image && (
                      <img
                        className="customer-product-photo"
                        src={product.image}
                        alt=""
                        style={{ objectPosition: product.imageFocus || "center" }}
                      />
                    )}
                    <div className="customer-product-copy">
                      {policies.some(
                        (policy) => policy.product === product.name,
                      ) && (
                        <span className="customer-owned">
                          <CircleCheck size={13} aria-hidden="true" />
                          In your policies
                        </span>
                      )}
                      {product.needLabel && (
                        <span className="customer-product-category">
                          {product.needLabel}
                        </span>
                      )}
                      <h3>{product.name}</h3>
                      <p>{product.summary || product.description}</p>
                      <div className="customer-product-figures">
                        <span>
                          <small>Cover amount</small>
                          <strong>{product.cover}</strong>
                        </span>
                        <span>
                          <small>Monthly premium</small>
                          <strong>
                            {product.premium}
                            <small className="customer-price-unit">
                              {" "}
                              / month
                            </small>
                          </strong>
                        </span>
                      </div>
                    </div>
                    <button
                      className="btn customer-view-button"
                      aria-expanded={open}
                      aria-controls={open ? "customer-buy" : undefined}
                      type="button"
                      disabled={!canRequest || busy}
                      onClick={() => {
                        setChoice(open ? null : product.name);
                        setTierChoice(open ? "" : defaultTierName(product));
                        setLives([]);
                        setError("");
                        setMessage("");
                      }}
                    >
                      {!verified
                        ? "Verification needed"
                        : eddBlocked
                          ? "Review in progress"
                          : open
                          ? "Close details"
                          : "Explore cover"}
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  </div>

                  {open && (
                    <form
                      className="customer-product-detail"
                      id="customer-buy"
                      onSubmit={buy}
                    >
                      {product.fits && <p className="customer-fits">{product.fits}</p>}
                      {benefits.length > 0 && (
                        <ul>
                          {benefits.map((point) => (
                            <li key={point}>
                              <Check size={16} aria-hidden="true" />
                              {point}
                            </li>
                          ))}
                        </ul>
                      )}
                      {(product.tiers || []).length > 0 && (
                        <fieldset className="customer-tiers">
                          <legend>Choose your tier</legend>
                          <div className="customer-tier-options">
                            {product.tiers.map((tier) => (
                              <label
                                key={tier.name}
                                className={"customer-tier" + (tierChoice === tier.name ? " selected" : "")}
                              >
                                <input
                                  type="radio"
                                  name="tier"
                                  value={tier.name}
                                  checked={tierChoice === tier.name}
                                  onChange={() => {
                                    setTierChoice(tier.name);
                                    if (!tier.priceIsFrom) setLives([]);
                                  }}
                                />
                                <span className="customer-tier-name">
                                  {tier.name}
                                  {tier.popular && <em>Most chosen</em>}
                                </span>
                                <strong>
                                  BWP {Number(tier.cover).toLocaleString("en-GB")}
                                  {coverSuffix(product)}
                                </strong>
                                <small>
                                  {tier.priceIsFrom ? "from " : ""}BWP {tier.premium}/month
                                </small>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      )}
                      {rated && (
                        <CoveredLives
                          tier={rated}
                          mainName={customer.name}
                          lives={lives}
                          onChange={setLives}
                          {...priced}
                        />
                      )}
                      <div className="customer-buy-bar">
                        <div>
                          <small>Buying</small>
                          <strong>
                            {customer.name} · {product.name}
                            {tierChoice ? " " + tierChoice : ""} ·{" "}
                            {rated
                              ? priced.quote
                                ? money(priced.quote.premium)
                                : "priced by age"
                              : chosenPremium(product, tierChoice)}
                            /month
                          </strong>
                        </div>
                        {error && (
                          <p className="form-error" role="alert">
                            {error}
                          </p>
                        )}
                        <button
                          className="btn primary"
                          type="submit"
                          disabled={busy || !canRequest}
                        >
                          {busy ? "Reserving…" : "Buy cover"}
                        </button>
                      </div>
                    </form>
                  )}
                </article>
              );
            })}
          </div>
          <p className="customer-pricing-note">
            All amounts are in Botswana Pula (BWP). Premiums shown are
            illustrative.
          </p>
          {!visibleProducts.length && (
            <p className="subtitle">No products match that need right now.</p>
          )}
        </section>
      </main>
      <footer className="customer-footer">
        <span>Nsure · Insurance, connected.</span>
        <span>Made for life. Built around you.</span>
      </footer>
    </div>
  );
}
