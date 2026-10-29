import { useSyncExternalStore } from "react";

// The chosen theme is "light", "dark" or "system". It is applied as data-theme on <html>, which switches
// color-scheme and so every light-dark() colour in the stylesheets.
const KEY = "nsure-theme";
const CHOICES = ["light", "dark", "system"];
const media = () => window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set();

function read() {
  try {
    const value = localStorage.getItem(KEY);
    return CHOICES.includes(value) ? value : "light";
  } catch {
    return "light";
  }
}

let choice = typeof window === "undefined" ? "light" : read();

export function applyTheme(next = choice) {
  const dark = next === "dark" || (next === "system" && media().matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function setTheme(next) {
  if (!CHOICES.includes(next)) return;
  choice = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  // Every colour changes at once; without this each element would fade on its own transition timing.
  const root = document.documentElement;
  root.classList.add("nk-theme-switching");
  applyTheme(next);
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("nk-theme-switching")));
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  const onSystem = () => choice === "system" && (applyTheme(), fn());
  const mq = media();
  mq.addEventListener("change", onSystem);
  return () => {
    listeners.delete(fn);
    mq.removeEventListener("change", onSystem);
  };
}

/** [choice, resolved, setTheme]: resolved is what is on screen ("light" or "dark"). */
export function useTheme() {
  const current = useSyncExternalStore(subscribe, () => choice, () => "light");
  const resolved = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.theme || "light",
    () => "light",
  );
  return [current, resolved, setTheme];
}
