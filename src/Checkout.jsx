import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Clock3,
  KeyRound,
  Lock,
  RotateCcw,
  Send,
  ShieldCheck,
  TimerOff,
} from "lucide-react";
import { request } from "./api";
import { money } from "./data";
import { PayForm, formatDate } from "./Workflow";
import "./checkout.css";

// The customer's side of paying a premium (spec 01 BR-5/BR-6, spec 13 §8):
//  - before the first premium, a declaration: four consents and a 6-digit code (a lock follows too many wrong codes);
//  - mobile money and EFT settle at once through the shop endpoint;
//  - Card goes to the provider's hosted checkout. The browser leaves the app, and the server sends it back to one of
//    the /buy/ result routes (confirmation, failed, pending, expired), which PaymentResult shows.

export const CARD = "Card";

/** The /buy/ route for a transaction's state: SETTLED → confirmation, FAILED → failed, EXPIRED → expired, else pending. */
export function resultRoute({ status, transactionId, policyRef, policyNumber }) {
  const tx = "tx=" + encodeURIComponent(transactionId);
  if (status === "SETTLED") return "buy/confirmation?policy=" + encodeURIComponent(policyNumber || policyRef) + "&" + tx;
  if (status === "FAILED") return "buy/payment?status=failed&" + tx;
  if (status === "EXPIRED") return "buy/payment?status=expired&" + tx;
  return "buy/payment/pending?" + tx;
}

/** Moves to another route without leaving the one it replaces in the history (a pending page is not worth going back to). */
function replaceRoute(route) {
  window.location.replace("#/" + route);
}

/**
 * Starts a card checkout: POST /checkout/{ref}/pay with the method only (the server prices it; never an amount).
 * A REDIRECT sends the browser to the provider's page; an IMMEDIATE answer goes straight to its result route.
 */
export async function startCheckout(session, policyRef, method, navigate) {
  const { data } = await request(session, "/checkout/" + encodeURIComponent(policyRef) + "/pay", {
    method: "POST",
    body: { method },
  });
  if (data.mode === "REDIRECT" && data.redirectUrl) {
    window.location.assign(data.redirectUrl);
    return "redirect";
  }
  navigate(resultRoute(data));
  return "route";
}

// ── declaration lock and the policies declared in this browser session ───────────────────────────────────

/** GET /portfolio/shop/declaration: {locked, lockedUntil, attemptsLeft}. Re-checks itself when a lock runs out. */
export function useDeclarationLock(session, enabled) {
  const [lock, setLock] = useState(null);
  const reload = useCallback(() => {
    if (!enabled) return Promise.resolve();
    return request(session, "/portfolio/shop/declaration")
      .then(({ data }) => setLock(data))
      .catch(() => {});
  }, [session, enabled]);
  useEffect(() => {
    reload();
  }, [reload]);
  useEffect(() => {
    if (!lock?.locked || !lock.lockedUntil) return undefined;
    const wait = Date.parse(lock.lockedUntil) - Date.now();
    if (!(wait > 0)) return undefined;
    const timer = setTimeout(reload, Math.min(wait + 1000, 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [lock, reload]);
  return [lock, reload];
}

/**
 * Which pending purchases had their declaration confirmed. The shop view does not say, so this browser session
 * remembers it (it survives the trip to the card provider); a payment refused for a missing declaration clears it.
 */
export function useDeclaredPolicies(customerId) {
  const key = "nsure-declared-" + (customerId || "");
  const [refs, setRefs] = useState([]);
  useEffect(() => {
    try {
      setRefs(JSON.parse(sessionStorage.getItem(key) || "[]"));
    } catch {
      setRefs([]);
    }
  }, [key]);
  const mark = useCallback(
    (ref, declared) =>
      setRefs((previous) => {
        const next = declared ? [...new Set([...previous, ref])] : previous.filter((item) => item !== ref);
        try {
          sessionStorage.setItem(key, JSON.stringify(next));
        } catch {
          // Storage can be blocked; the declaration still holds on the server for this purchase.
        }
        return next;
      }),
    [key],
  );
  return [refs, mark];
}

function LockNotice({ lock }) {
  if (!lock?.locked) return null;
  return (
    <div className="pay-lock" role="alert">
      <Lock size={16} aria-hidden="true" />
      <p>
        Too many wrong codes. For your security, payment is locked
        {lock.lockedUntil ? " until " + formatDate(lock.lockedUntil) : " for now"}. You can try again after that.
      </p>
    </div>
  );
}

const CONSENTS = [
  ["accuracy", "I confirm the information I gave is accurate and complete."],
  ["terms", "I accept the terms and conditions of this cover."],
  ["dataProtection", "I accept the data protection notice and how my personal information is used."],
  ["falseInformation", "I understand that false or incomplete information may void the policy."],
];

/** Spec 01 BR-5 / BR-6: the four consents and an OTP, once per purchase, before its first premium. */
export function DeclarationStep({ session, policy, lock, reloadLock, onDeclared, notify }) {
  const [consents, setConsents] = useState(() => Object.fromEntries(CONSENTS.map(([key]) => [key, false])));
  const [otp, setOtp] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const locked = Boolean(lock?.locked);
  const allGiven = CONSENTS.every(([key]) => consents[key]);
  const base = "/portfolio/shop/policies/" + encodeURIComponent(policy.id) + "/declaration";

  const send = async () => {
    setBusy("send");
    setError("");
    try {
      const { data } = await request(session, base + "/otp", { method: "POST", body: {} });
      setOtp(data);
      setCode("");
      notify("We sent a 6-digit code to " + (data.sentTo || "your registered contact") + ".", "info");
    } catch (err) {
      setError(err.message);
      if (err.status === 403) reloadLock();
    } finally {
      setBusy("");
    }
  };

  const confirm = async (event) => {
    event.preventDefault();
    setBusy("verify");
    setError("");
    try {
      await request(session, base, { method: "POST", body: { code: code.trim(), ...consents } });
      onDeclared(policy.id, true);
      reloadLock();
      notify("Declaration confirmed. You can now pay the first premium.", "success");
    } catch (err) {
      setError(err.message);
      // A wrong code uses an attempt; the last one locks payment (403).
      reloadLock();
      if (err.status === 403) {
        setOtp(null);
        setCode("");
      }
    } finally {
      setBusy("");
    }
  };

  return (
    <form className="pay-declaration" onSubmit={confirm} aria-label={"Declaration for " + policy.id}>
      <p className="pay-step">
        <span>Step 1 of 2</span> Declaration and consent
      </p>
      <p className="pay-lead">
        Before you pay the first premium, please confirm the following and enter the code we send you.
      </p>
      <fieldset className="pay-consents" disabled={locked || busy === "verify"}>
        <legend className="sr-only">Your declaration</legend>
        {CONSENTS.map(([key, label]) => (
          <label key={key} className="wf-check-label">
            <input
              type="checkbox"
              checked={consents[key]}
              onChange={(e) => setConsents((c) => ({ ...c, [key]: e.target.checked }))}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <LockNotice lock={lock} />
      {!locked && (
        <div className="pay-code">
          <button
            type="button"
            className="btn secondary"
            disabled={Boolean(busy)}
            onClick={send}
          >
            <Send className="icon icon-sm" aria-hidden="true" />
            {busy === "send" ? "Sending…" : otp ? "Send a new code" : "Send code"}
          </button>
          <label className="pay-code-input">
            <span>6-digit code</span>
            <input
              className="input"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="••••••"
              value={code}
              disabled={!otp || Boolean(busy)}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </label>
          <button
            type="submit"
            className="btn primary"
            disabled={!otp || !allGiven || code.length !== 6 || Boolean(busy)}
            title={!allGiven ? "Tick all four statements first" : !otp ? "Send yourself a code first" : undefined}
          >
            <KeyRound className="icon icon-sm" aria-hidden="true" />
            {busy === "verify" ? "Confirming…" : "Confirm declaration"}
          </button>
        </div>
      )}
      {otp && !locked && (
        <p className="muted small">
          Code sent to {otp.sentTo || "your registered contact"}
          {otp.expiresAt ? "; it works until " + formatDate(otp.expiresAt) : ""}.
          {lock?.attemptsLeft != null ? " You have " + lock.attemptsLeft + " attempt(s) to enter it." : ""}
        </p>
      )}
      {otp?.devCode && !locked && (
        <p className="pay-dev-code" role="note">
          Demo installation: use the code <strong>{otp.devCode}</strong>.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

/**
 * The pay step for one policy: the declaration first when it is a purchase awaiting its first premium, then the
 * payment. Card goes to the hosted checkout; other methods settle here and return the refreshed portal.
 */
export function PolicyPayment({
  session,
  policy,
  label,
  done,
  firstPremium = false,
  declared,
  onDeclared,
  lock,
  reloadLock,
  onShop,
  notify,
  onNavigate,
}) {
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");

  if (firstPremium && !declared) {
    return (
      <DeclarationStep
        session={session}
        policy={policy}
        lock={lock}
        reloadLock={reloadLock}
        onDeclared={onDeclared}
        notify={notify}
      />
    );
  }

  const pay = async (method) => {
    setBusy(true);
    setError("");
    try {
      if (method === CARD) {
        const outcome = await startCheckout(session, policy.id, method, onNavigate);
        if (outcome === "redirect") {
          setLeaving(true);
          return;
        }
      } else {
        const { data } = await request(session, "/portfolio/shop/policies/" + encodeURIComponent(policy.id) + "/pay", {
          method: "POST",
          body: { method },
        });
        onShop(data);
        notify(done, "success");
      }
    } catch (err) {
      // The server holds the declaration; if it has none for this purchase, ask for it again.
      if (/declaration and consent/i.test(err.message)) onDeclared?.(policy.id, false);
      if (err.status === 403) reloadLock?.();
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pay-step-block">
      {firstPremium && (
        <p className="pay-step">
          <span>Step 2 of 2</span> Payment
          <span className="pay-step-done">
            <CircleCheck size={14} aria-hidden="true" /> Declaration confirmed
          </span>
        </p>
      )}
      <LockNotice lock={lock} />
      {leaving ? (
        <p className="pay-leaving" role="status">
          <span className="nk-spinner" aria-hidden="true" /> Taking you to the secure payment page…
        </p>
      ) : (
        <PayForm
          busy={busy || Boolean(lock?.locked)}
          label={label}
          onPay={pay}
          hint={(method) =>
            method === CARD
              ? "You'll enter your card details on our payment provider's secure page, then come back here."
              : null
          }
        />
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ── the four result screens the provider returns to ────────────────────────────────────────────────────

function useTransaction(session, id) {
  const [state, setState] = useState({ data: null, error: "", loading: Boolean(id) });
  useEffect(() => {
    if (!id) return undefined;
    let live = true;
    request(session, "/checkout/transactions/" + encodeURIComponent(id))
      .then(({ data }) => live && setState({ data, error: "", loading: false }))
      .catch((err) => live && setState({ data: null, error: err.message, loading: false }));
    return () => {
      live = false;
    };
  }, [session, id]);
  return state;
}

/** An old or edited link can name a transaction that ended otherwise: show the screen for how it really stands. */
function useMatchingRoute(payment, expected) {
  const status = payment.data?.status;
  useEffect(() => {
    if (status && status !== expected) replaceRoute(resultRoute(payment.data));
  }, [status, expected]);
}

const sentence = (text) => (/[.!?]$/.test(text) ? text : text + ".");

function ResultCard({ tone, icon: Icon, title, children, actions }) {
  return (
    <section className={"pay-result " + tone} aria-labelledby="pay-result-title">
      <span className="pay-result-icon" aria-hidden="true">
        <Icon size={26} />
      </span>
      <h1 id="pay-result-title">{title}</h1>
      {children}
      {actions && <div className="pay-result-actions">{actions}</div>}
    </section>
  );
}

function BackButton({ onNavigate, label = "Back to my policies", variant = "secondary" }) {
  return (
    <button type="button" className={"btn " + variant} onClick={() => onNavigate("overview")}>
      {label} <ArrowRight className="icon icon-sm" aria-hidden="true" />
    </button>
  );
}

/** Routes: buy/confirmation, buy/payment?status=failed|expired, buy/payment/pending. */
export function PaymentResult({ session, route, shop, onShop, onNavigate, notify }) {
  const [path, query] = route.split("?");
  const params = new URLSearchParams(query || "");
  const tx = params.get("tx");
  if (path === "buy/confirmation") {
    return <Confirmation session={session} policyRef={params.get("policy")} tx={tx} shop={shop} onShop={onShop} onNavigate={onNavigate} />;
  }
  if (path === "buy/payment/pending") {
    return <Pending session={session} tx={tx} onNavigate={onNavigate} />;
  }
  if (path === "buy/payment" && params.get("status") === "failed") {
    return <Failed session={session} tx={tx} onNavigate={onNavigate} notify={notify} />;
  }
  if (path === "buy/payment" && params.get("status") === "expired") {
    return <Expired session={session} tx={tx} onNavigate={onNavigate} />;
  }
  return (
    <ResultCard tone="neutral" icon={CircleAlert} title="We could not find that page" actions={<BackButton onNavigate={onNavigate} variant="primary" />}>
      <p>Your policies and payments are on your portal.</p>
    </ResultCard>
  );
}

function Confirmation({ session, policyRef, tx, shop, onShop, onNavigate }) {
  const payment = useTransaction(session, tx);
  useMatchingRoute(payment, "SETTLED");
  // The settlement happened just before the provider sent the browser back; load the portal again so the policy shows
  // as it is now.
  useEffect(() => {
    let live = true;
    request(session, "/portfolio/shop")
      .then(({ data }) => live && onShop(data))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [session]);
  const ref = policyRef || payment.data?.policyNumber || payment.data?.policyRef;
  const policy = [...(shop?.policies || []), ...(shop?.requests || [])].find((p) => p.id === ref);
  const product = (shop?.products || []).find((p) => p.name === policy?.product);
  const p = payment.data;
  return (
    <ResultCard
      tone="success"
      icon={CircleCheck}
      title="Payment received"
      actions={<BackButton onNavigate={onNavigate} label="Go to my policies" variant="primary" />}
    >
      <p>{p?.customerMessage || (ref ? "Your policy " + ref + " is active." : "Your policy is active.")}</p>
      {ref && (
        <div className="pay-policy-number">
          <small>Policy number</small>
          <strong>{ref}</strong>
        </div>
      )}
      <dl className="pay-summary">
        {policy && (
          <>
            <div>
              <dt>Cover</dt>
              <dd>
                {policy.product}
                {policy.tier ? " · " + policy.tier : ""}
              </dd>
            </div>
            <div>
              <dt>Cover amount</dt>
              <dd>
                {money(policy.amount)}
                {product?.coverUnit ? " / " + product.coverUnit : ""}
              </dd>
            </div>
            <div>
              <dt>Monthly premium</dt>
              <dd>{money(policy.premium)}</dd>
            </div>
            {policy.coverStartDate && (
              <div>
                <dt>Cover started</dt>
                <dd>{formatDate(policy.coverStartDate)}</dd>
              </div>
            )}
            {policy.nextPremiumDue && (
              <div>
                <dt>Next premium due</dt>
                <dd>{formatDate(policy.nextPremiumDue)}</dd>
              </div>
            )}
          </>
        )}
        {p && (
          <div>
            <dt>Paid</dt>
            <dd>
              {money(p.amount)} by {p.method}
              {p.settledAt ? " · " + formatDate(p.settledAt) : ""}
            </dd>
          </div>
        )}
      </dl>
      {!policy && !shop && <p className="muted small">Loading your policy…</p>}
      <p className="muted small">Your policy schedule is in your portal under the policy's documents.</p>
    </ResultCard>
  );
}

/** Retry / start again: a fresh checkout for the same policy and method. */
function useRestart(session, payment, onNavigate) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const restart = async () => {
    const policyRef = payment.data?.policyRef;
    if (!policyRef) {
      onNavigate("overview");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const outcome = await startCheckout(session, policyRef, payment.data.method || CARD, onNavigate);
      if (outcome === "redirect") return;
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };
  return { busy, error, restart };
}

function Failed({ session, tx, onNavigate }) {
  const payment = useTransaction(session, tx);
  useMatchingRoute(payment, "FAILED");
  const { busy, error, restart } = useRestart(session, payment, onNavigate);
  const p = payment.data;
  return (
    <ResultCard
      tone="danger"
      icon={CircleAlert}
      title="Your payment did not go through"
      actions={
        <>
          <button type="button" className="btn primary" disabled={busy || payment.loading} onClick={restart}>
            {busy ? <span className="nk-spinner" aria-hidden="true" /> : <RotateCcw className="icon icon-sm" aria-hidden="true" />}
            {busy ? "Opening the payment page…" : "Retry"}
          </button>
          <BackButton onNavigate={onNavigate} label="Choose another way to pay" />
        </>
      }
    >
      {payment.loading && <p className="muted">Checking what happened…</p>}
      {p && <p>{p.customerMessage}</p>}
      {p?.failureReason && (
        <p className="pay-reason-box">
          <strong>Reason:</strong> {p.failureReason}
        </p>
      )}
      {!p && !payment.loading && <p>You have not been charged for this attempt. You can try again.</p>}
      {p && (
        <p className="muted small">
          {money(p.amount)} for policy {p.policyRef} · {p.method}
        </p>
      )}
      {(payment.error || error) && (
        <p className="form-error" role="alert">
          {error || payment.error}
        </p>
      )}
    </ResultCard>
  );
}

function Expired({ session, tx, onNavigate }) {
  const payment = useTransaction(session, tx);
  useMatchingRoute(payment, "EXPIRED");
  const { busy, error, restart } = useRestart(session, payment, onNavigate);
  const p = payment.data;
  return (
    <ResultCard
      tone="neutral"
      icon={TimerOff}
      title="Your payment session expired"
      actions={
        <>
          <button type="button" className="btn primary" disabled={busy || payment.loading} onClick={restart}>
            {busy ? <span className="nk-spinner" aria-hidden="true" /> : <RotateCcw className="icon icon-sm" aria-hidden="true" />}
            {busy ? "Opening the payment page…" : "Start again"}
          </button>
          <BackButton onNavigate={onNavigate} />
        </>
      }
    >
      <p>{p?.customerMessage || "This payment session expired before it was completed. Please start the payment again."}</p>
      <p className="muted small">You have not been charged for the expired session.</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </ResultCard>
  );
}

const FAST_POLL_MS = 2000;
const FAST_FOR_MS = 30000;
const SLOW_POLL_MS = 5000;
const GIVE_UP_AFTER_MS = 120000;

/** Not an error: the provider has not confirmed yet. Polls 2 s for 30 s, then 5 s up to 2 minutes. */
function Pending({ session, tx, onNavigate }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [gaveUp, setGaveUp] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!tx) return undefined;
    let cancelled = false;
    let timer;
    const started = Date.now();
    const tick = async () => {
      try {
        const { data } = await request(session, "/checkout/transactions/" + encodeURIComponent(tx));
        if (cancelled) return;
        setStatus(data);
        if (data.terminal) {
          replaceRoute(resultRoute(data));
          return;
        }
      } catch (err) {
        if (cancelled) return;
        // Someone else's or an unknown transaction will not change by waiting; anything else is retried.
        if ([403, 404].includes(err.status)) {
          setError(err.message);
          return;
        }
      }
      const elapsed = Date.now() - started;
      if (elapsed >= GIVE_UP_AFTER_MS) {
        setGaveUp(true);
        return;
      }
      timer = setTimeout(tick, elapsed < FAST_FOR_MS ? FAST_POLL_MS : SLOW_POLL_MS);
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [session, tx, round]);

  if (!tx || error) {
    return (
      <ResultCard tone="neutral" icon={CircleAlert} title="We could not check this payment" actions={<BackButton onNavigate={onNavigate} variant="primary" />}>
        <p>{sentence(error || "This link does not name a payment")} Your policies show whether your cover is active.</p>
      </ResultCard>
    );
  }
  return (
    <ResultCard
      tone="pending"
      icon={gaveUp ? ShieldCheck : Clock3}
      title={gaveUp ? "Your payment is being confirmed" : "We're confirming your payment"}
      actions={
        gaveUp ? (
          <>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setGaveUp(false);
                setRound((r) => r + 1);
              }}
            >
              <RotateCcw className="icon icon-sm" aria-hidden="true" /> Check again
            </button>
            <BackButton onNavigate={onNavigate} variant="primary" />
          </>
        ) : null
      }
    >
      {gaveUp ? (
        <p>
          Your payment is being confirmed. We'll send you an SMS as soon as your policy is active. You can safely close
          this page.
        </p>
      ) : (
        <>
          <p className="pay-waiting" role="status">
            <span className="nk-spinner" aria-hidden="true" />
            {status?.customerMessage || "We're confirming your payment with the provider."}
          </p>
          <p className="muted small">This usually takes a few seconds. Please keep this page open.</p>
        </>
      )}
      {status && (
        <p className="muted small">
          {money(status.amount)} for policy {status.policyRef} · {status.method}
        </p>
      )}
    </ResultCard>
  );
}
