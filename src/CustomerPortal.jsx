import React, { useEffect, useState } from "react";
import { request } from "./api";
import { money, initials } from "./data";

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

  async function load() {
    const [meR, productsR, policiesR] = await Promise.all([
      request(session, "/portal/me"),
      request(session, "/portal/products"),
      request(session, "/portal/policies"),
    ]);
    setProfile(meR.data);
    setProducts(productsR.data);
    setPolicies(policiesR.data);
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
        "Policy " + result.data.policyId + " is in force for " + product.name + ".",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyProduct("");
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
            <strong>KYC is still pending.</strong> An onboarding specialist must
            mark your verification successful before you can buy a policy.
          </p>
        </div>
      )}

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Your policies</h2>
            <p className="subtitle">Cover already linked to your account.</p>
          </div>
        </div>
        {policies.length === 0 ? (
          <p className="muted">No policies yet. Pick a product below to get started.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Policy</th>
                  <th>Product</th>
                  <th>Cover</th>
                  <th>Premium</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((policy) => (
                  <tr key={policy.id}>
                    <td>{policy.id}</td>
                    <td>{policy.product}</td>
                    <td>{money(policy.amount)}</td>
                    <td>{money(policy.premium)}</td>
                    <td>
                      <Badge>{policy.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                          disabled={!profile.kycVerified || busyProduct === product.name}
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
                      disabled={!profile.kycVerified || busyProduct === product.name}
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
