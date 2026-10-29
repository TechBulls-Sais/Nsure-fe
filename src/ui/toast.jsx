import React, { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import "./kit.css";

const ToastContext = createContext(() => {});

// Callers that know the outcome pass the tone; otherwise it is read from the wording.
const ERROR = /\b(fail|failed|error|cannot|can't|could not|not allowed|denied|forbidden|no authority|invalid|refused|not found|unable)\b/i;
const SUCCESS = /\b(saved|approved|created|issued|added|sent|ready|updated|recorded|paid|posted|verified|done|complete|completed|exported|assigned|closed|drafted|produced|accepted|resolved|queued|retried|replayed)\b/i;

export function toneOf(message) {
  const text = String(message ?? "");
  if (ERROR.test(text)) return "error";
  if (SUCCESS.test(text)) return "success";
  return "info";
}

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info };
const DURATION = { success: 4500, info: 5000, error: 8000 };

/**
 * notify(message) or notify(message, "error" | "success" | "info") or notify(message, { tone, title }).
 * Toasts stack bottom-right, pause while hovered, and sit in the top layer so they show above open dialogs.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const region = useRef(null);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const notify = useCallback((message, options) => {
    if (!message) return;
    const o = typeof options === "string" ? { tone: options } : options || {};
    const tone = o.tone || toneOf(message);
    const id = ++seq.current;
    setToasts((list) => [...list.slice(-3), { id, message: String(message), title: o.title, tone }]);
  }, []);

  useLayoutEffect(() => {
    const el = region.current;
    if (!el?.showPopover) return;
    // Re-showing moves the region above any dialog opened since it was last shown.
    if (el.matches(":popover-open")) el.hidePopover();
    if (toasts.length) el.showPopover();
  }, [toasts]);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <section ref={region} popover="manual" className="nk-toaster" aria-label="Notifications">
        <ol>
          {toasts.map((t) => {
            const Icon = ICONS[t.tone];
            return (
              <li
                key={t.id}
                className={"nk-toast " + t.tone}
                role={t.tone === "error" ? "alert" : "status"}
              >
                <Icon className="icon icon-sm nk-toast-icon" strokeWidth={2} aria-hidden="true" />
                <div className="nk-toast-text">
                  {t.title && <strong>{t.title}</strong>}
                  <span>{t.message}</span>
                </div>
                <button
                  type="button"
                  className="nk-toast-close"
                  aria-label="Dismiss notification"
                  onClick={() => dismiss(t.id)}
                >
                  <X className="icon icon-sm" aria-hidden="true" />
                </button>
                <span
                  className="nk-toast-timer"
                  style={{ animationDuration: DURATION[t.tone] + "ms" }}
                  onAnimationEnd={() => dismiss(t.id)}
                />
              </li>
            );
          })}
        </ol>
      </section>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
