/*
 * Adaptations of MIT-licensed Kokonut UI components (shimmer-text, action-search-bar) and Magic UI (number-ticker, border-beam).
 * Attribution, exact source paths, and licenses: THIRD_PARTY_NOTICES.md.
 * Changed to plain CSS/JSX, bounded motion, reduced-motion support and demo actions.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  motion,
  MotionConfig,
  useInView,
  useMotionValue,
  useSpring,
} from "motion/react";
import { createScope, createTimeline, stagger } from "animejs";
import {
  ArrowUpRight,
  Sparkles,
  Command,
  Search,
  Layers3,
  ShieldCheck,
} from "lucide-react";
import "./intelligence.css";
// Animations follow the operating system's "reduce motion" setting; there is no in-app switch.
const MotionPreference = createContext({ off: false });
export function MotionProvider({ children }) {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? "off" : "on";
    return () => delete document.documentElement.dataset.motion;
  }, [reduced]);
  return (
    <MotionPreference.Provider value={{ off: reduced }}>
      <MotionConfig reducedMotion={reduced ? "always" : "never"}>{children}</MotionConfig>
    </MotionPreference.Provider>
  );
}
export const useCalmMotion = () => useContext(MotionPreference).off;
export function AnimatedWorkspace({ page, children }) {
  const root = useRef(null);
  const off = useCalmMotion();
  useEffect(() => {
    if (off) return;
    const scope = createScope({ root }).add(() => {
      const nodes = root.current.querySelectorAll(
        ".page-heading, .hero, .stat-card, .dashboard-grid > .panel, .quick-action, .bottom-grid > .panel, .config-banner, .config-stat, .product-card, .scheme-card, .ai-studio-header, .config-builder",
      );
      if (!nodes.length) return;
      createTimeline({ defaults: { duration: 460, ease: "out(3)" } }).add(
        nodes,
        {
          opacity: { from: 0.3, to: 1 },
          y: { from: 12, to: 0 },
          delay: stagger(35),
        },
      );
    });
    return () => scope.revert();
  }, [page, off]);
  return (
    <div className="content" ref={root}>
      {children}
    </div>
  );
}
export function StepReveal({ step, children, className = "" }) {
  const off = useCalmMotion();
  return (
    <motion.div
      key={step}
      className={className}
      initial={off ? false : { opacity: 0.2, y: 9 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {children}
    </motion.div>
  );
}
export function ShimmerText({ children, className = "" }) {
  const off = useCalmMotion();
  return (
    <motion.span
      className={"shimmer-text " + className}
      animate={
        off
          ? { backgroundPosition: "0% center" }
          : { backgroundPosition: ["200% center", "-200% center"] }
      }
      transition={{
        duration: off ? 0 : 3,
        ease: "linear",
        repeat: off ? 0 : 2,
      }}
    >
      {children}
    </motion.span>
  );
}
export function BorderBeam() {
  const off = useCalmMotion();
  return (
    <div className="border-beam" aria-hidden="true">
      <motion.div
        className="border-beam-light"
        initial={{ offsetDistance: "0%" }}
        animate={{ offsetDistance: off ? "0%" : ["0%", "100%"] }}
        transition={{
          repeat: off ? 0 : 2,
          ease: "linear",
          duration: off ? 0 : 6,
        }}
      />
    </div>
  );
}
function NumberTicker({ value, decimals }) {
  const ref = useRef(null);
  const raw = useMotionValue(value * 0.8);
  const spring = useSpring(raw, { damping: 40, stiffness: 110 });
  const inView = useInView(ref, { once: true });
  const off = useCalmMotion();
  useEffect(() => {
    if (inView && !off) raw.set(value);
  }, [inView, value, off, raw]);
  useEffect(() => {
    if (off) {
      if (ref.current)
        ref.current.textContent = value.toLocaleString("en-GB", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
      return;
    }
    return spring.on("change", (v) => {
      if (ref.current)
        ref.current.textContent = v.toLocaleString("en-GB", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
    });
  }, [spring, value, decimals, off]);
  return (
    <span ref={ref}>
      {value.toLocaleString("en-GB", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  );
}
export function AnimatedMetric({ value }) {
  const text = String(value);
  const m = text.match(/^([^\d]*)([\d,.]+)(.*)$/);
  if (!m) return value;
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {m[1]}
        <NumberTicker
          value={Number(m[2].replaceAll(",", ""))}
          decimals={(m[2].split(".")[1] || "").length}
        />
        {m[3]}
      </span>
    </>
  );
}
export function IntelligenceOrb({ small = false }) {
  return (
    <div
      className={"intelligence-orb " + (small ? "small" : "")}
      aria-hidden="true"
    >
      <div className="orb-grid" />
      <div className="orb-ring ring-a" />
      <div className="orb-ring ring-b" />
      <div className="orb-ring ring-c" />
      <div className="orb-core">
        <Sparkles />
      </div>
      <span className="orb-satellite satellite-a">
        <ShieldCheck size={18} />
      </span>
      <span className="orb-satellite satellite-b">
        <Layers3 size={17} />
      </span>
    </div>
  );
}
export function ActionSearch({ actions, onSelect }) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const off = useCalmMotion();
  const filtered = actions.filter((a) =>
    (a.label + " " + (a.description || ""))
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="action-search">
      <label className="command-input">
        <Search size={20} />
        <input
          autoFocus
          aria-label="Search workspace actions"
          role="combobox"
          aria-expanded="true"
          aria-controls="workspace-actions"
          aria-activedescendant={
            filtered[index] ? "action-" + filtered[index].id : undefined
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          placeholder="Where would you like to go?"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) =>
                filtered.length ? (i + 1) % filtered.length : 0,
              );
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) =>
                filtered.length
                  ? (i + filtered.length - 1) % filtered.length
                  : 0,
              );
            }
            if (e.key === "Enter" && filtered[index]) {
              e.preventDefault();
              onSelect(filtered[index].id);
            }
          }}
        />
        <kbd>esc</kbd>
      </label>
      <div className="command-section-label">QUICK ACTIONS & WORKSPACES</div>
      <motion.ul
        id="workspace-actions"
        role="listbox"
        aria-label="Workspace actions"
        initial={off ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {filtered.map((a, i) => (
          <li
            role="option"
            id={"action-" + a.id}
            aria-selected={i === index}
            key={a.id}
            className={i === index ? "selected" : ""}
            onMouseEnter={() => setIndex(i)}
          >
            <button type="button" tabIndex={-1} onClick={() => onSelect(a.id)}>
              <span className="command-result-icon">
                <Command size={17} />
              </span>
              <span>
                <strong>{a.label}</strong>
                <small>{a.description || "Open workspace"}</small>
              </span>
              <ArrowUpRight size={15} />
            </button>
          </li>
        ))}
      </motion.ul>
      {!filtered.length && (
        <p className="command-empty">
          No matching actions. Try “product”, “claim”, or “customer”.
        </p>
      )}
      <div className="command-help">
        <span>↑ ↓ navigate · ↵ open</span>
        <span>⌘ / Ctrl K to toggle</span>
      </div>
    </div>
  );
}
