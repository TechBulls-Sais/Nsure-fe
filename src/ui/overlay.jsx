import React, { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import { CircleAlert, TriangleAlert, X } from "lucide-react";
import "./kit.css";

/**
 * The element portaled popups (Select) mount into. A modal <dialog> sits in the browser's top layer, so a popup
 * portaled to <body> would render underneath it; inside a dialog this context points at the dialog itself.
 */
export const PortalContainer = createContext(null);

const FOCUSABLE =
  'input:not([type="hidden"]):not([aria-hidden="true"]):not(:disabled),[role="combobox"],textarea:not(:disabled),select:not(:disabled)';

/**
 * A modal dialog on the native <dialog> element: focus is trapped, the page behind is inert, Escape and a click on
 * the backdrop close it. variant "drawer" slides in from the right, for forms.
 */
export function Dialog({
  title,
  eyebrow,
  description,
  onClose,
  children,
  footer,
  size = "md",
  variant = "modal",
  className = "",
  closeLabel = "Close dialog",
  bodyClassName = "",
}) {
  const ref = useRef(null);
  const [node, setNode] = useState(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const previous = document.activeElement;
    if (!el.open) el.showModal();
    setNode(el);
    (el.querySelector("[autofocus]") || el.querySelector(FOCUSABLE) || el.querySelector(".nk-dialog-panel"))?.focus();
    return () => {
      if (el.open) el.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`nk-dialog nk-${variant} nk-${size} ${className}`}
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        // An open Select owns Escape until it closes.
        if (document.querySelector("[data-nsure-select-popup]")) return;
        onClose?.();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <PortalContainer.Provider value={node}>
        <div className="nk-dialog-panel modal" tabIndex={-1}>
          <header className="nk-dialog-header modal-header">
            <div>
              {eyebrow && <span className="eyebrow">{eyebrow}</span>}
              {title && <h2 id={titleId}>{title}</h2>}
              {description && (
                <p id={descriptionId} className="subtitle">
                  {description}
                </p>
              )}
            </div>
            {onClose && (
              <button type="button" className="icon-btn" aria-label={closeLabel} onClick={onClose}>
                <X className="icon" strokeWidth={1.8} aria-hidden="true" />
              </button>
            )}
          </header>
          <div className={"nk-dialog-body modal-body " + bodyClassName}>{children}</div>
          {footer && <footer className="nk-dialog-footer">{footer}</footer>}
        </div>
      </PortalContainer.Provider>
    </dialog>
  );
}

/** A slide-over panel from the right edge; the home for create and edit forms. */
export function Drawer(props) {
  return <Dialog size="md" {...props} variant="drawer" />;
}

const ConfirmContext = createContext((options) =>
  Promise.resolve(window.confirm(typeof options === "string" ? options : options.message || options.title)),
);

/**
 * const confirm = useConfirm(); if (await confirm({ title, message, confirmLabel, tone: "danger" })) …
 * Resolves true on confirm, false on cancel, Escape or a click outside.
 */
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }) {
  const [pending, setPending] = useState(null);
  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        const o = typeof options === "string" ? { message: options } : options;
        setPending({ ...o, resolve });
      }),
    [],
  );
  const finish = (answer) => {
    pending?.resolve(answer);
    setPending(null);
  };
  const danger = pending?.tone === "danger";
  const Icon = danger ? TriangleAlert : CircleAlert;
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <Dialog
          size="sm"
          className={"nk-confirm " + (danger ? "danger" : "")}
          title={pending.title || "Are you sure?"}
          onClose={() => finish(false)}
          closeLabel="Cancel"
          footer={
            <>
              <button type="button" className="btn secondary" onClick={() => finish(false)}>
                {pending.cancelLabel || "Cancel"}
              </button>
              <button
                type="button"
                className={"btn " + (danger ? "danger" : "primary")}
                autoFocus
                onClick={() => finish(true)}
              >
                {pending.confirmLabel || "Confirm"}
              </button>
            </>
          }
        >
          <div className="nk-confirm-body">
            <span className="nk-confirm-icon">
              <Icon className="icon" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div>{pending.message}</div>
          </div>
        </Dialog>
      )}
    </ConfirmContext.Provider>
  );
}
