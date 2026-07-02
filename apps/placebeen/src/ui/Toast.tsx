import { useEffect } from "react";
import { useToast } from "../lib/store/useToast";

/** Single restrained toast with an optional focusable Undo. Auto-dismisses. */
export function Toast() {
  const toast = useToast((s) => s.toast);
  const dismiss = useToast((s) => s.dismiss);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismiss, 6000);
    return () => clearTimeout(t);
  }, [toast?.id, dismiss]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!toast) return null;

  return (
    <div className="toast" role="status">
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
