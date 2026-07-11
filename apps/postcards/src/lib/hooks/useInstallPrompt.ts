import { useEffect, useState } from "react";

/** Chromium's install-prompt event (not yet in lib.dom). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * PWA install affordance: captures `beforeinstallprompt` so the app can show
 * its own "Install" button (browsers hide the ambient one). No-op when already
 * installed (standalone) or on browsers without the event (iOS Safari uses
 * Share → Add to Home Screen instead).
 */
export function useInstallPrompt(): { canInstall: boolean; install: () => Promise<void> } {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof matchMedia !== "undefined" && matchMedia("(display-mode: standalone)").matches) {
      return; // already installed — never offer
    }
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep the event for OUR button
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return {
    canInstall: deferred !== null,
    install: async () => {
      if (!deferred) return;
      await deferred.prompt();
      setDeferred(null); // the event is single-use
    },
  };
}
