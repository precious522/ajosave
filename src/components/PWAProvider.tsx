"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAProvider() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Capture install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setShowBanner(false);
    setInstallPrompt(null);
  };

  if (!showBanner) return null;

  return (
    <div style={{
      position: "fixed", bottom: "1rem", left: "50%", transform: "translateX(-50%)",
      background: "var(--color-bg-surface)", border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-xl)", padding: "1rem 1.5rem",
      display: "flex", alignItems: "center", gap: "1rem",
      boxShadow: "var(--shadow-md)", zIndex: 999, maxWidth: "calc(100vw - 2rem)",
    }}>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)" }}>
        Add Ajosave to your home screen
      </span>
      <button className="btn btn--primary btn--sm" onClick={handleInstall}>Install</button>
      <button className="btn btn--ghost btn--sm" onClick={() => setShowBanner(false)} aria-label="Dismiss">✕</button>
    </div>
  );
}
