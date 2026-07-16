import { useEffect, useRef } from "react";
import { useModalKeys } from "../lib/hooks/useModalKeys";
import { useT } from "../lib/i18n";

/**
 * "How it works": a short, plain-language summary of what Postcards is,
 * where your data lives, how offline works, and where facts come from.
 * Opened from the top bar.
 */
export function AboutModal({ onClose }: { onClose: () => void }) {
  const t = useT();
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
        <h2 id="about-title">{t("about.title")}</h2>
        <p className="about-lede">{t("about.lede")}</p>

        <div className="about-grid">
        <div className="about-item">
          <span className="about-emoji" aria-hidden>🗺️</span>
          <div>
            <h3>{t("about.whatItIs.title")}</h3>
            <p>{t("about.whatItIs.body")}</p>
          </div>
        </div>

        <div className="about-item">
          <span className="about-emoji" aria-hidden>🔒</span>
          <div>
            <h3>{t("about.yourData.title")}</h3>
            <p>{t("about.yourData.body")}</p>
          </div>
        </div>

        <div className="about-item">
          <span className="about-emoji" aria-hidden>📴</span>
          <div>
            <h3>{t("about.offline.title")}</h3>
            <p>
              {t("about.offline.bodyPre")}
              <em>{t("about.offline.bodyEm")}</em>
              {t("about.offline.bodyPost")}
            </p>
          </div>
        </div>

        <div className="about-item">
          <span className="about-emoji" aria-hidden>🌍</span>
          <div>
            <h3>{t("about.facts.title")}</h3>
            <p>{t("about.facts.body")}</p>
          </div>
        </div>

        </div>
        <p className="muted small about-foot">
          {t("about.footPre")}
          <kbd>?</kbd>
          {t("about.footPost")}
        </p>

        <button ref={closeRef} className="btn" type="button" onClick={onClose}>
          {t("about.gotIt")}
        </button>
      </div>
    </div>
  );
}
