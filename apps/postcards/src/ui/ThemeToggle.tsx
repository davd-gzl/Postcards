import { useSettings, type ThemeMode } from "../lib/store/useSettings";
import { useT, type MessageKey } from "../lib/i18n";

// System / Light / Dark, as a three-option segmented control (mirrors ScopeToggle).
const OPTIONS: { value: ThemeMode; label: MessageKey; title: MessageKey }[] = [
  { value: "system", label: "theme.system", title: "theme.systemTitle" },
  { value: "light", label: "theme.light", title: "theme.lightTitle" },
  { value: "dark", label: "theme.dark", title: "theme.darkTitle" },
];

/**
 * Explicit colour-theme picker: follow the device, or force light or dark. The
 * choice is saved on this device only (localStorage) and applied by toggling a
 * data-theme attribute on <html>.
 */
export function ThemeToggle() {
  const t = useT();
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  return (
    <div className="segmented" role="group" aria-label={t("theme.aria")}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={theme === o.value}
          className={theme === o.value ? "seg-on" : ""}
          onClick={() => setTheme(o.value)}
          title={t(o.title)}
        >
          {t(o.label)}
        </button>
      ))}
    </div>
  );
}
