import { useEffect, useState } from "react";
import { useToast } from "../lib/store/useToast";

/** Single restrained toast with an optional focusable Undo. Auto-dismisses after
 *  6s, but the timer pauses while the toast is hovered or keyboard-focused so an
 *  Undo is never yanked away mid-reach (WCAG 2.2.1). */
export function Toast() {
  const toast = useToast((s) => s.toast);
  const dismiss = useToast((s) => s.dismiss);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!toast || paused) return;
    const t = setTimeout(dismiss, 6000);
    return () => clearTimeout(t);
  }, [toast?.id, paused, dismiss]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!toast) return null;

  return (
    <div
      className="toast"
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <span className="toast-msg">{toast.message}</span>
      {toast.undo && (
        <button
          className="toast-undo"
          type="button"
          onClick={() => {
            void toast.undo?.();
            dismiss();
          }}
        >
          Undo
        </button>
      )}
      <button className="toast-close" type="button" aria-label="Dismiss" onClick={dismiss}>
        ×
      </button>
    </div>
  );
}
