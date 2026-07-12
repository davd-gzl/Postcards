import { useEffect, useRef } from "react";

/** Minimal keyboard-shortcuts overlay (opened with "?"). */
export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Keyboard shortcuts</h2>
        <ul className="shortcuts">
          <li>
            <kbd>/</kbd> Search — <kbd>Enter</kbd> shows the place, <kbd>Shift</kbd>+
            <kbd>Enter</kbd> marks it visited
          </li>
          <li>
            <kbd>1</kbd>–<kbd>5</kbd> or <kbd>M</kbd> <kbd>P</kbd> <kbd>T</kbd> <kbd>J</kbd>{" "}
            <kbd>S</kbd> — switch sections (Map, Places, Trips, Journal, Stats)
          </li>
          <li>
            <kbd>F</kbd> Passport · <kbd>X</kbd> Moments (inside Places)
          </li>
          <li>
            <kbd>?</kbd> This help
          </li>
          <li>
            <kbd>Esc</kbd> Close / clear search
          </li>
        </ul>
        <button ref={closeRef} className="btn" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
