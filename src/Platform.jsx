import React, { useEffect, useState } from "react";
import { request } from "./api";

export default function Platform({ session }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [frequencies, relationships, controls, capabilities] = await Promise.all([
          request(session, "/reference/premium-frequencies"),
          request(session, "/reference/relationship-types"),
          request(session, "/controls"),
          request(session, "/capabilities"),
        ]);
        if (!active) return;
        setData({
          frequencies: frequencies.data,
          relationships: relationships.data,
          controls: controls.data,
          capabilities: capabilities.data,
        });
      } catch (loadError) {
        if (active) setError(loadError.message);
      }
    })();
    return () => {
      active = false;
    };
  }, [session]);

  if (error) {
    return <p className="form-error">{error}</p>;
  }
  if (!data) {
    return <p className="subtitle">Loading platform data…</p>;
  }

  return (
    <div className="stack">
      <header className="page-heading">
        <div>
          <div className="eyebrow">MIPAS FOUNDATION</div>
          <h1>Reference data and controls.</h1>
          <p className="subtitle">
            Seeded by Liquibase. Roles keep their capability grants in the database.
          </p>
        </div>
      </header>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Operational controls</h2>
            <p className="subtitle">Every control starts enabled and fails closed.</p>
          </div>
        </div>
        <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Control</th>
              <th>Type</th>
              <th>State</th>
              <th>Value</th>
              <th>Fail mode</th>
            </tr>
          </thead>
          <tbody>
            {data.controls.map((control) => (
              <tr key={control.key}>
                <td>
                  <strong>{control.name}</strong>
                  <p className="subtitle">{control.key}</p>
                </td>
                <td>{control.type}</td>
                <td>{control.enabled ? "Enabled" : "Disabled"}</td>
                <td>{control.value ?? "—"}</td>
                <td>{control.failMode}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Premium frequencies</h2>
          </div>
        </div>
        <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Months</th>
              <th>Label</th>
            </tr>
          </thead>
          <tbody>
            {data.frequencies.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.months}</td>
                <td>{row.shortLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Relationships</h2>
          </div>
        </div>
        <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Self</th>
            </tr>
          </thead>
          <tbody>
            {data.relationships.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.self ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Capability grants</h2>
            <p className="subtitle">Policyholder is intentionally empty.</p>
          </div>
        </div>
        {data.capabilities.roles.map((role) => (
          <p key={role.role}>
            <strong>{role.role}</strong>
            {" · "}
            {role.capabilities.length === 0 ? "No capabilities" : role.capabilities.join(", ")}
          </p>
        ))}
      </section>
    </div>
  );
}
