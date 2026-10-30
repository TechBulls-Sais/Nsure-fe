import { useEffect, useState } from "react";
import { request } from "./api";

// The insurer this deployment serves, from GET /public/config. One frontend build runs behind every insurer's
// hostname and learns its name, environment and brand colour at runtime; it never chooses an insurer itself.

let cached = null;
let pending = null;

function load() {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = request(null, "/public/config")
      .then((r) => {
        cached = r.data;
        return cached;
      })
      .catch(() => {
        pending = null;
        return null;
      });
  }
  return pending;
}

export const environmentLabel = (env) =>
  ({ dev: "Development", test: "Test", uat: "UAT", prod: "Production" })[env] || env;

export function useInsurer() {
  const [insurer, setInsurer] = useState(cached);
  useEffect(() => {
    let active = true;
    load().then((value) => {
      if (!active || !value) return;
      setInsurer(value);
      document.title = value.displayName + (value.environment === "prod" ? "" : " · " + environmentLabel(value.environment));
      if (value.primaryColor) document.documentElement.style.setProperty("--insurer-brand", value.primaryColor);
    });
    return () => {
      active = false;
    };
  }, []);
  return insurer;
}
