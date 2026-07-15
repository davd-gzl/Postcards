import { useSettings, type ThemeMode } from "../lib/store/useSettings";

// System / Light / Dark, as a three-option segmented control (mirrors ScopeToggle).
const OPTIONS: { value: ThemeMode; label: string; title: string }[] = [
  { value: "system", label: "System", title: "Follow your device's light/dark setting" },
  { value: "light", label: "Light", title: "Always use the light palette" },
  { value: "dark", label: "Dark", title: "Always use the dark palette" },
];

/**
 * Explicit colour-theme picker: follow the device, or force light or dark. The
 * choice is saved on this device only (localStorage) and applied by toggling a
 * data-theme attribute on <html>.
 */
export function ThemeToggle() {
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  return (
    <div className="segmented" role="group" aria-label="Colour theme">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={theme === o.value}
          className={theme === o.value ? "seg-on" : ""}
          onClick={() => setTheme(o.value)}
          title={o.title}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
