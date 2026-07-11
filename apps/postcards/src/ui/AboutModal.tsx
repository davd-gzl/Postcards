import { useEffect, useRef } from "react";
import { useModalKeys } from "../lib/hooks/useModalKeys";

/**
 * "How it works" — explains the things that make Postcards unusual: it's
 * offline & local-first, private by default, an aggregator (never an author),
 * and everything lives in one portable file you own. Opened from the top bar.
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
          A private, local-first way to remember the places you’ve been — cities, countries,
          airports and monuments — and see them on a map. It’s a keeper of memories, not a trip
          planner.
        </p>

        <div className="about-grid">
        <div className="about-item">
          <span className="about-emoji" aria-hidden>📴</span>
          <div>
            <h3>Works offline</h3>
            <p>
              It’s an installable web app. The interface, the world map overview, and all reference
              data are cached on your device, so it keeps working with no signal. Turn on the
              detailed OpenStreetMap layer when you’re online and tap <em>Save area</em> to keep a
              region for later.
            </p>
          </div>
        </div>

        <div className="about-item">
          <span className="about-emoji" aria-hidden>🔒</span>
          <div>
            <h3>Private by default</h3>
            <p>
              No account, no server, no tracking. Your visits and photos live only on your device
              (in the browser’s storage) and never leave it unless you explicitly export them.
              Photos are stored inside your file, never as links that could phone home.
            </p>
          </div>
        </div>

        <div className="about-item">
          <span className="about-emoji" aria-hidden>📄</span>
          <div>
            <h3>One portable file you own</h3>
            <p>
              Everything is a single human-readable JSON file. Export it to a drive or git, import it
              on any device — no lock-in. Imports are validated and sanitized, never executed.
            </p>
          </div>
        </div>

        <div className="about-item">
          <span className="about-emoji" aria-hidden>🌍</span>
          <div>
            <h3>An aggregator, never an author</h3>
            <p>
              Every place fact — cities, borders, regions, monuments, languages — comes from named,
              openly-licensed datasets (Natural Earth, GeoNames, world-countries, UNESCO / Wikidata),
              each recorded in <em>Your data → sources</em>. The app never invents places; if one’s
              missing, it’s added to the open dataset, not hard-coded.
            </p>
          </div>
        </div>

        <div className="about-item">
          <span className="about-emoji" aria-hidden>📖</span>
          <div>
            <h3>Guides, on demand</h3>
            <p>
              Each place links out to <strong>Wikivoyage</strong> — travel guides, country overviews,
              and phrasebooks (with the alphabet and pronunciation). Links always work; a short
              overview is fetched only when you ask for it, and nothing is sent to load them.
            </p>
          </div>
        </div>

        </div>
        <p className="muted small about-foot">
          Built to a small <a
            href="https://github.com/davd-gzl/Postcards/blob/main/.specify/memory/constitution.md"
            target="_blank"
            rel="noopener noreferrer"
          >constitution</a>: local-first, private, open, accessible and keyboard-first. Press{" "}
          <kbd>?</kbd> for keyboard shortcuts.
        </p>

        <button ref={closeRef} className="btn" type="button" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
