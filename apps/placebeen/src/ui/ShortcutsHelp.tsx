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
            <kbd>/</kbd> Search &amp; quick-add
          </li>
          <li>
            <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> or <kbd>M</kbd> <kbd>S</kbd> <kbd>P</kbd> — switch
            tabs
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
