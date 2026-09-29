import React, { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import {
  Sparkles,
  FileSearch,
  MessageSquareText,
  ScanText,
  ArrowUpRight,
  RotateCcw,
  Check,
  Copy,
} from "lucide-react";
import {
  AIComposer,
  IntelligenceOrb,
  ThinkingSteps,
  ShimmerText,
  SpotlightCard,
  useCalmMotion,
} from "./ui/animated";
const prompts = [
  [
    "Summarize an application",
    "Turn case details into a clear next step.",
    FileSearch,
    "#8a78ce",
  ],
  [
    "Draft a customer message",
    "The right words, with a human touch.",
    MessageSquareText,
    "#669789",
  ],
  [
    "Show document extraction",
    "A preview of paperwork, simplified.",
    ScanText,
    "#ceab6e",
  ],
];
function sampleReply(text) {
  if (/summari|application|case/i.test(text))
    return "Sample case · APP-2048\nAmara Dube has applied for Term Life with illustrative cover of BWP 500,000 at BWP 420/month. The application is under review. Identity and declaration checks are recorded. Next step: an underwriter reviews the evidence and accepted terms.\nSource: seeded demo application APP-2048. No automated decision has been made.";
  if (/draft|message|email/i.test(text))
    return "Sample draft · missing evidence\nHello Naledi, thank you for your claim submission. To help us continue the review, please provide your hospital discharge summary through the secure portal. Your reference is CLM-0841. Our team is here if you need a hand.\nThis draft is for staff review. Nothing has been sent.";
  if (/extract|document/i.test(text))
    return "Sample extraction · fictional identity document\nFull name: Amara Dube · confidence 99%\nDate of birth: 15 June 1992 · confidence 97%\nDocument type: National identity card · confidence 96%\nVerification: human review required.\nNo document was actually processed. These fields demonstrate the proposed extraction experience.";
  return "This is a scripted AI showcase, so I cannot answer arbitrary questions or access live records. Try “Summarize an application”, “Draft a customer message”, or “Show document extraction” to explore the three demo experiences.";
}
export default function AssistantStudio() {
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(null);
  const [copyError, setCopyError] = useState("");
  const timer = useRef(null);
  const panel = useRef(null);
  const off = useCalmMotion();
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    panel.current?.scrollTo({
      top: panel.current.scrollHeight,
      behavior: off ? "instant" : "smooth",
    });
  }, [messages, busy, off]);
  const send = (text) => {
    if (busy) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    timer.current = setTimeout(
      () => {
        setMessages((m) => [
          ...m,
          { role: "assistant", text: sampleReply(text) },
        ]);
        setBusy(false);
      },
      off ? 350 : 1200,
    );
  };
  const clear = () => {
    clearTimeout(timer.current);
    setMessages([]);
    setBusy(false);
    setCopied(null);
  };
  return (
    <div className="intelligence-studio">
      <header className="ai-studio-header">
        <div className="intelligence-label">
          <Sparkles size={14} /> NSURE INTELLIGENCE <span>DEMO</span>
        </div>
        <h1>
          Your next step.
          <br />
          <ShimmerText>A little clearer.</ShimmerText>
        </h1>
        <p>
          A thoughtful copilot for your people, products, and everyday
          decisions.
        </p>
        <IntelligenceOrb small />
      </header>
      <div className="ai-studio-layout">
        <aside className="assistant-toolbox">
          <div className="eyebrow">A FEW WAYS TO GET STARTED</div>
          {prompts.map(([title, desc, Icon, color]) => (
            <SpotlightCard
              className="assistant-tool-card"
              color={color}
              key={title}
            >
              <button onClick={() => send(title)} disabled={busy}>
                <span style={{ background: color + "18", color }}>
                  <Icon size={19} />
                </span>
                <strong>{title}</strong>
                <p>{desc}</p>
                <ArrowUpRight size={15} />
              </button>
            </SpotlightCard>
          ))}
          <div className="assistant-trust">
            <Check size={15} />
            <p>
              Human judgment comes first.
              <br />
              <strong>Every output is a scripted example.</strong>
            </p>
          </div>
        </aside>
        <section className="assistant-conversation">
          <header>
            <span className="assistant-avatar">
              <Sparkles size={19} />
            </span>
            <div>
              <h2>Nsure copilot</h2>
              <p>
                <span className="live-dot" /> Ready to explore with you
              </p>
            </div>
            <button
              className="icon-btn"
              aria-label="Clear conversation"
              onClick={clear}
            >
              <RotateCcw size={16} />
            </button>
          </header>
          <div
            className="assistant-messages"
            ref={panel}
            aria-live="polite"
            aria-relevant="additions"
          >
            {!messages.length ? (
              <div className="assistant-empty">
                <div className="assistant-empty-symbol">
                  <Sparkles size={29} />
                </div>
                <h3>
                  Less busywork.
                  <br />
                  More possibilities.
                </h3>
                <p>
                  Start with a suggestion or ask about a sample case.
                  <br />
                  Let’s see what a little intelligence could do.
                </p>
                <span className="assistant-context">
                  <FileSearch size={13} /> Sample case library connected
                </span>
              </div>
            ) : (
              messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={off ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={"studio-message " + m.role}
                >
                  <div className="studio-message-label">
                    {m.role === "assistant" ? (
                      <>
                        <Sparkles size={13} /> NSURE COPILOT{" "}
                        <span>SCRIPTED</span>
                      </>
                    ) : (
                      "YOU"
                    )}
                  </div>
                  <p>{m.text}</p>
                  {m.role === "assistant" && (
                    <div className="studio-response-footer">
                      <span>
                        <Check size={12} /> Ready for human review
                      </span>
                      <button
                        className="icon-btn"
                        aria-label="Copy response"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(m.text);
                            setCopied(i);
                            setCopyError("");
                          } catch {
                            setCopyError(
                              "Copy is unavailable here. Select the response text to copy it.",
                            );
                          }
                        }}
                      >
                        {copied === i ? (
                          <Check size={14} />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>
                  )}
                </motion.div>
              ))
            )}
            {busy && <ThinkingSteps />}
          </div>
          {copyError && (
            <p role="status" className="copilot-disclaimer">
              {copyError}
            </p>
          )}
          <div className="assistant-compose-wrap">
            <AIComposer onSubmit={send} busy={busy} onSample={() => {}} />
            <p className="copilot-disclaimer">
              Sample responses, not live AI. Do not enter personal information.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
