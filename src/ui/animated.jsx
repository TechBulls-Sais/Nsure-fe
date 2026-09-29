/*
 * Adaptations of MIT-licensed Kokonut UI components (shimmer-text, spotlight-cards,
 * ai-input-search, action-search-bar) and Magic UI (number-ticker, border-beam).
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
  AnimatePresence,
  MotionConfig,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import { createScope, createTimeline, stagger } from "animejs";
import {
  ArrowUp,
  ArrowUpRight,
  Sparkles,
  Command,
  Search,
  FileText,
  Check,
  Waves,
  Pause,
  Layers3,
  ShieldCheck,
  WandSparkles,
} from "lucide-react";
import "./intelligence.css";
const MotionPreference = createContext({ off: false, toggle: () => {} });
export function MotionProvider({ children }) {
  const [off, setOff] = useState(false);
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
    document.documentElement.dataset.motion = off || reduced ? "off" : "on";
    return () => delete document.documentElement.dataset.motion;
  }, [off, reduced]);
  return (
    <MotionPreference.Provider
      value={{
        off: off || reduced,
        system: reduced,
        toggle: () => setOff((x) => !x),
      }}
    >
      <MotionConfig reducedMotion={off || reduced ? "always" : "never"}>
        {children}
      </MotionConfig>
    </MotionPreference.Provider>
  );
}
export const useCalmMotion = () => useContext(MotionPreference).off;
export function MotionToggle() {
  const { off, toggle, system } = useContext(MotionPreference);
  return (
    <button
      className="motion-toggle"
      onClick={toggle}
      disabled={system}
      title={
        system
          ? "Reduced motion is enabled in your system preferences."
          : undefined
      }
      aria-label={
        system
          ? "System reduced motion enabled"
          : off
            ? "Enable interface animations"
            : "Pause interface animations"
      }
      aria-pressed={!off}
    >
      {off ? <Pause size={14} /> : <Waves size={14} />}
      <span>Motion {off ? "off" : "on"}</span>
    </button>
  );
}
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
export function SpotlightCard({
  children,
  className = "",
  color = "#8b7ee0",
  ...props
}) {
  const ref = useRef(null);
  const off = useCalmMotion();
  const x = useMotionValue(0.5),
    y = useMotionValue(0.5);
  const rx = useSpring(useTransform(y, [0, 1], [2, -2]), {
    stiffness: 300,
    damping: 28,
  });
  const ry = useSpring(useTransform(x, [0, 1], [-2, 2]), {
    stiffness: 300,
    damping: 28,
  });
  const glow = useSpring(0, { stiffness: 180, damping: 22 });
  return (
    <motion.article
      {...props}
      ref={ref}
      className={"spotlight-card " + className}
      onPointerMove={(e) => {
        if (off || e.pointerType === "touch") return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - r.left) / r.width);
        y.set((e.clientY - r.top) / r.height);
      }}
      onPointerEnter={() => !off && glow.set(1)}
      onPointerLeave={() => {
        x.set(0.5);
        y.set(0.5);
        glow.set(0);
      }}
      style={off ? {} : { rotateX: rx, rotateY: ry, transformPerspective: 900 }}
    >
      <motion.div
        aria-hidden="true"
        className="spotlight-glow"
        style={{
          opacity: off ? 0 : glow,
          background: `radial-gradient(ellipse at 20% 20%,${color}20,transparent 70%)`,
        }}
      />
      {children}
    </motion.article>
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
export function AIComposer({
  onSubmit,
  busy = false,
  placeholder = "Ask anything about your demo workspace…",
  label = "Message the demo assistant",
  buttonLabel = "Send message",
  onSample,
}) {
  const [value, setValue] = useState("");
  const [focus, setFocus] = useState(false);
  const ref = useRef(null);
  const off = useCalmMotion();
  const submit = () => {
    if (!value.trim() || busy) return;
    onSubmit(value.trim());
    setValue("");
  };
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = Math.min(ref.current.scrollHeight, 160) + "px";
    }
  }, [value]);
  return (
    <motion.div
      className={"ai-composer " + (focus ? "focused" : "")}
      animate={{
        boxShadow: focus
          ? "0 0 0 3px #b0a3df20, 0 10px 35px #6e58ab0a"
          : "0 3px 18px #38433305",
      }}
      transition={{ duration: off ? 0 : 0.2 }}
    >
      <textarea
        aria-label={label}
        ref={ref}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        rows={2}
      />
      <div className="composer-tools">
        <div>
          <span className="composer-model">
            <Sparkles size={13} /> Nsure intelligence <span>DEMO</span>
          </span>
          {onSample && (
            <button
              className="composer-sample"
              type="button"
              onClick={() => {
                setValue("Summarize an application");
                onSample();
                ref.current?.focus();
              }}
            >
              <FileText size={14} />
              Sample case
            </button>
          )}
        </div>
        <motion.button
          type="button"
          className="composer-submit"
          disabled={busy || !value.trim()}
          aria-label={buttonLabel}
          onClick={submit}
          whileTap={off ? {} : { scale: 0.92 }}
        >
          <ArrowUp size={19} />
        </motion.button>
      </div>
      <BorderBeam />
    </motion.div>
  );
}
export function ThinkingSteps({
  steps = [
    "Reading sample context",
    "Organizing the key details",
    "Preparing a demo response",
  ],
}) {
  const [index, setIndex] = useState(0);
  const off = useCalmMotion();
  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => Math.min(i + 1, steps.length - 1)),
      400,
    );
    return () => clearInterval(id);
  }, [steps.length]);
  return (
    <div className="thinking-steps" role="status">
      <span className="thinking-icon">
        <Sparkles size={16} />
      </span>
      <div>
        <ShimmerText>Working on your demo…</ShimmerText>
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={off ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: off ? 0 : 0.15 }}
          >
            {steps[index]}
          </motion.p>
        </AnimatePresence>
      </div>
      <span className="thinking-dots">
        <i />
        <i />
        <i />
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
export function ProductDraftPrompt({ onDraft }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const generate = (text) => {
    setBusy(true);
    timer.current = setTimeout(() => {
      let product = /funeral|family/i.test(text)
        ? {
            name: "FamilyCare Plus",
            code: "AI-FAM",
            benefits: ["Funeral benefit", "Accidental death"],
            cover: 50000,
            premium: 185,
          }
        : /hospital|cash|health/i.test(text)
          ? {
              name: "Care Cash Essential",
              code: "AI-CARE",
              benefits: ["Hospital cash"],
              cover: 1000,
              premium: 265,
            }
          : /group|employer|employee/i.test(text)
            ? {
                name: "Team Life Protect",
                code: "AI-GROUP",
                domain: "Group Life",
                benefits: ["Death benefit", "Accidental death"],
                cover: 500000,
                premium: 350,
              }
            : {
                name: "LifeCare Essential",
                code: "AI-LIFE",
                benefits: ["Death benefit"],
                cover: 500000,
                premium: 420,
              };
      onDraft({
        ...product,
        description:
          "Illustrative blueprint based on your brief: " + text.slice(0, 180),
      });
      setBusy(false);
      setOpen(false);
    }, 1200);
  };
  return (
    <div className="draft-copilot">
      <div className="draft-copilot-heading">
        <span className="copilot-mark">
          <WandSparkles size={20} />
        </span>
        <div>
          <h3>Start with an idea. Let’s shape the details.</h3>
          <p>
            Describe your product and explore an AI-style configuration flow.
          </p>
        </div>
        <button
          className="btn ai-gradient-button"
          onClick={() => setOpen((x) => !x)}
          aria-expanded={open}
        >
          <Sparkles size={15} />
          {open ? "Hide copilot" : "Design with AI"}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            className="draft-copilot-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="draft-examples">
              {[
                "Family funeral cover",
                "Hospital cash plan",
                "Group employee protection",
              ].map((t) => (
                <button key={t} disabled={busy} onClick={() => generate(t)}>
                  {t}
                  <ArrowUpRight size={12} />
                </button>
              ))}
            </div>
            {busy ? (
              <ThinkingSteps
                steps={[
                  "Matching a sample product template",
                  "Adding illustrative benefits and rates",
                  "Preparing your editable blueprint",
                ]}
              />
            ) : (
              <AIComposer
                label="Describe a product"
                placeholder="e.g. A family funeral plan with affordable monthly premiums…"
                buttonLabel="Generate demo blueprint"
                onSubmit={generate}
              />
            )}
            <p className="copilot-disclaimer">
              Scripted templates, not live AI. Review and edit every proposed
              setting.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <BorderBeam />
    </div>
  );
}
