import { useEffect, useRef, useState } from "react";
import { Globe } from "./Globe";
import { useSettings } from "../lib/store/useSettings";
import { useUi } from "../lib/store/useUi";
import { useToast } from "../lib/store/useToast";
import { downloadFullCities, fullCitiesEnabled } from "../lib/reference/referenceData";
import { useT } from "../lib/i18n";

/**
 * First-run welcome — a full page (not a modal) with a live spinning earth,
 * one line about what Postcards is, and a button per optional download so a
 * newcomer can grab what they want on the spot. Skippable; shown once.
 */
export function IntroScreen({ onClose }: { onClose: () => void }) {
  const t = useT();
  const onlineMap = useSettings((s) => s.onlineMap);
  const offlineMode = useSettings((s) => s.offlineMode);
  const setOnlineMap = useSettings((s) => s.setOnlineMap);
  const setOfflineMode = useSettings((s) => s.setOfflineMode);
  const optimizeMarkers = useSettings((s) => s.optimizeMarkers);
  const setOptimizeMarkers = useSettings((s) => s.setOptimizeMarkers);
  const showToast = useToast((s) => s.show);
  const startRef = useRef<HTMLButtonElement>(null);

  const [mapOn, setMapOn] = useState(onlineMap);
  const [cities, setCities] = useState<"idle" | "busy" | "done">(
    fullCitiesEnabled() ? "done" : "idle",
  );

  useEffect(() => {
    startRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function getCities() {
    setCities("busy");
    const ok = await downloadFullCities();
    setCities(ok ? "done" : "idle");
    showToast(ok ? t("settings.cities.toast.done") : t("settings.cities.toast.failed"));
  }

  return (
    <div className="intro" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <button className="intro-skip" type="button" onClick={onClose}>
        {t("intro.skip")}
      </button>

      <div className="intro-hero">
        <Globe size={200} />
      </div>

      <h1 id="intro-title" className="intro-title">
        {t("intro.title")}
      </h1>
      <p className="intro-lede">{t("intro.lede")}</p>

      <ul className="intro-list">
        {/* The single most important choice, made explicit up front: is Postcards
            allowed online (richer) or fully self-contained (nothing leaves the
            device)? Everything below adapts to the mode picked here. */}
        <li className="intro-row intro-mode-row">
          <div className="intro-row-text">
            <span className="intro-row-title">
              {offlineMode ? "📴" : "🌐"} {t("intro.mode.title")}
            </span>
            <span className="intro-row-desc">
              {offlineMode ? t("intro.mode.offlineDesc") : t("intro.mode.onlineDesc")}
            </span>
          </div>
          <div className="intro-seg" role="group" aria-label={t("intro.mode.title")}>
            <button
              type="button"
              className={"intro-seg-btn" + (!offlineMode ? " is-on" : "")}
              aria-pressed={!offlineMode}
              title={t("intro.mode.onlineDesc")}
              onClick={() => setOfflineMode(false)}
            >
              {t("intro.mode.online")}
            </button>
            <button
              type="button"
              className={"intro-seg-btn" + (offlineMode ? " is-on" : "")}
              aria-pressed={offlineMode}
              title={t("intro.mode.offlineDesc")}
              onClick={() => setOfflineMode(true)}
            >
              {t("intro.mode.offline")}
            </button>
          </div>
        </li>

        {!offlineMode && (
          <li className="intro-row">
            <div className="intro-row-text">
              <span className="intro-row-title">🛰️ {t("intro.map.title")}</span>
              <span className="intro-row-desc">{t("intro.map.desc")}</span>
            </div>
            <button
              className="intro-get"
              type="button"
              disabled={mapOn}
              onClick={() => {
                setOnlineMap(true);
                setMapOn(true);
              }}
            >
              {mapOn ? `✓ ${t("intro.on")}` : t("intro.enable")}
            </button>
          </li>
        )}

        {/* Offline map for a trip — the actual region download lives in Settings
            (it needs a map to pick an area), so surface it here and jump there. */}
        <li className="intro-row">
          <div className="intro-row-text">
            <span className="intro-row-title">🗺️ {t("intro.offline.title")}</span>
            <span className="intro-row-desc">{t("intro.offline.desc")}</span>
          </div>
          <button
            className="intro-get"
            type="button"
            title={t("intro.offline.desc")}
            onClick={() => {
              useUi.getState().setTab("settings");
              onClose();
            }}
          >
            {t("intro.offline.action")}
          </button>
        </li>

        <li className="intro-row">
          <div className="intro-row-text">
            <span className="intro-row-title">🏙️ {t("intro.cities.title")}</span>
            <span className="intro-row-desc">{t("intro.cities.desc")}</span>
          </div>
          <button
            className="intro-get"
            type="button"
            disabled={cities !== "idle"}
            onClick={() => void getCities()}
          >
            {cities === "done"
              ? `✓ ${t("intro.saved")}`
              : cities === "busy"
                ? t("intro.getting")
                : t("intro.get")}
          </button>
        </li>

        {/* Set expectations up front: with lots of places the map can crowd/lag,
            and there's a one-tap fix. New users learn the option exists (and can
            opt in now); the full controls live in Settings → Optimisation. */}
        <li className="intro-row">
          <div className="intro-row-text">
            <span className="intro-row-title">⚡ {t("intro.optimize.title")}</span>
            <span className="intro-row-desc">{t("intro.optimize.desc")}</span>
          </div>
          <button
            className="intro-get"
            type="button"
            aria-pressed={optimizeMarkers}
            title={t("intro.optimize.desc")}
            onClick={() => setOptimizeMarkers(!optimizeMarkers)}
          >
            {optimizeMarkers ? `✓ ${t("intro.on")}` : t("intro.enable")}
          </button>
        </li>
      </ul>

      <p className="intro-more">{t("intro.more")}</p>

      <button ref={startRef} className="intro-start" type="button" onClick={onClose}>
        {t("intro.start")}
      </button>
    </div>
  );
}
