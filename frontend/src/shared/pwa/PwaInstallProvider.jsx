import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const PwaInstallContext = createContext(null);
const DISMISS_KEY = "luxuosa:pwa-install-dismissed-at";
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function detectEnvironment() {
  if (typeof navigator === "undefined") return { platform: "desktop", browser: "other" };
  const ua = navigator.userAgent || "";
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const browser = /CriOS/i.test(ua)
    ? "chrome-ios"
    : /FxiOS/i.test(ua)
      ? "firefox-ios"
      : /EdgiOS/i.test(ua)
        ? "edge-ios"
        : iOS && /Safari/i.test(ua)
          ? "safari-ios"
          : /Edg/i.test(ua)
            ? "edge"
            : /Chrome|Chromium/i.test(ua)
              ? "chrome"
              : /Firefox/i.test(ua)
                ? "firefox"
                : /Safari/i.test(ua)
                  ? "safari"
                  : "other";
  return { platform: iOS ? "ios" : android ? "android" : "desktop", browser };
}

export function PwaInstallProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [dialogOpen, setDialogOpen] = useState(false);
  const environment = useMemo(detectEnvironment, []);

  useEffect(() => {
    if (installed) return undefined;

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setDialogOpen(false);
      localStorage.removeItem(DISMISS_KEY);
    };
    const displayMode = window.matchMedia?.("(display-mode: standalone)");
    const onDisplayModeChange = () => {
      if (isStandalone()) onInstalled();
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    displayMode?.addEventListener?.("change", onDisplayModeChange);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      displayMode?.removeEventListener?.("change", onDisplayModeChange);
    };
  }, [installed]);

  useEffect(() => {
    if (installed || dialogOpen) return undefined;
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - dismissedAt < DISMISS_FOR_MS) return undefined;
    const canExplainManualInstall = environment.platform === "ios" || environment.platform === "android";
    if (!deferredPrompt && !canExplainManualInstall) return undefined;
    const timer = window.setTimeout(() => setDialogOpen(true), 1400);
    return () => window.clearTimeout(timer);
  }, [deferredPrompt, dialogOpen, environment.platform, installed]);

  const openInstall = useCallback(() => {
    if (!installed) setDialogOpen(true);
  }, [installed]);

  const dismissInstall = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDialogOpen(false);
  }, []);

  const requestInstall = useCallback(async () => {
    if (!deferredPrompt) return { outcome: "unavailable" };
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice?.outcome === "dismissed") dismissInstall();
      return choice || { outcome: "unknown" };
    } catch {
      setDeferredPrompt(null);
      return { outcome: "unavailable" };
    }
  }, [deferredPrompt, dismissInstall]);

  const value = useMemo(
    () => ({
      canPrompt: Boolean(deferredPrompt),
      dialogOpen,
      dismissInstall,
      environment,
      installed,
      openInstall,
      requestInstall,
      setDialogOpen
    }),
    [deferredPrompt, dialogOpen, dismissInstall, environment, installed, openInstall, requestInstall]
  );

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}

export function usePwaInstall() {
  const value = useContext(PwaInstallContext);
  if (!value) throw new Error("usePwaInstall deve ser usado dentro de PwaInstallProvider");
  return value;
}
