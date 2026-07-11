import { useEffect, type RefObject } from "react";

/**
 * The shared modal keyboard contract: Escape closes; Tab wraps focus among the
 * dialog's focusable elements (keyboard-first, WCAG 2.4.3). An optional
 * `opts.onKey` runs before the trap and may claim the event by returning true.
 */
export function useModalKeys(
  dialogRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  opts?: {
    enabled?: boolean;
    selector?: string;
    onKey?: (e: KeyboardEvent) => boolean | void;
  },
) {
  const enabled = opts?.enabled !== false;
  const selector = opts?.selector ?? "a[href], button:not([disabled])";
  const extraKey = opts?.onKey;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (extraKey?.(e)) return;
      if (e.key !== "Tab") return;
      const f = dialogRef.current?.querySelectorAll<HTMLElement>(selector);
      if (!f || !f.length) return;
      const first = f[0]!;
      const last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, selector, extraKey, onClose, dialogRef]);
}
