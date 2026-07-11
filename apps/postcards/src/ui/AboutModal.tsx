import { useEffect, useRef } from "react";
import { useModalKeys } from "../lib/hooks/useModalKeys";

/**
 * "How it works": a short, plain-language summary of what Postcards is,
 * where your data lives, how offline works, and where facts come from.
 * Opened from the top bar.
 */
export function AboutModal({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useModalKeys(dialogRef, onClose);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal about-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="about-title">How Postcards works</h2>
        <p className="about-lede">
          A simple, private way to remember the places you have been.
        </p>

        <div className="about-grid">
        <div className="about-item">
          <span className="about-emoji" aria-hidden>🗺️</span>
          <div>
            <h3>What it is</h3>
            <p>
              Log the cities, countries, airports and monuments you have visited; see them on a
              map. It keeps memories, not travel plans.
            </p>
          </div>
        </div>

        <div className="about-item">
          <span className="about-emoji" aria-hidden>🔒</span>
          <div>
            <h3>Your data</h3>
            <p>
              Everything stays on this device. No account; no tracking. Export one file from
              Settings; bring it back on any device.
            </p>
          </div>
        </div>

        <div className="about-item">
          <span className="about-emoji" aria-hidden>📴</span>
          <div>
            <h3>Offline</h3>
            <p>
              The app works with no connection. To keep maps for later, download the world or a
              region in <em>Settings, Offline maps</em>; areas you browse online are kept too.
            </p>
          </div>
        </div>

        <div className="about-item">
          <span className="about-emoji" aria-hidden>🌍</span>
          <div>
            <h3>Where facts come from</h3>
            <p>
              Maps and place facts come from open sources: OpenStreetMap, Natural Earth, GeoNames
              and UNESCO. The app never invents data.
            </p>
          </div>
        </div>

        </div>
        <p className="muted small about-foot">
          Press <kbd>?</kbd> to see keyboard shortcuts.
        </p>

        <button ref={closeRef} className="btn" type="button" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
