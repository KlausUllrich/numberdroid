import { useCallback, useEffect, useState } from "react";
import { requiresLandscape } from "./orientationPolicy";

function isStandaloneFullscreen() {
  return Boolean(document.fullscreenElement) || window.matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches;
}

function mobileLike() {
  return window.matchMedia("(pointer: coarse)").matches || Math.min(window.innerWidth, window.innerHeight) < 700;
}

function landscapeRequiredNow() {
  return requiresLandscape(window.innerWidth, window.innerHeight, mobileLike());
}

function needsPrompt() {
  return mobileLike();
}

export function useAppFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [bypassed, setBypassed] = useState(false);
  const [error, setError] = useState("");
  const [needsFullscreenPrompt, setNeedsFullscreenPrompt] = useState(false);

  const sync = useCallback(() => {
    const full = isStandaloneFullscreen();
    const portraitBlocked = landscapeRequiredNow();
    setIsFullscreen(full);
    setError((current) => portraitBlocked
      ? "Bitte drehe dein Gerät ins Querformat. Numberdroid ist ein Breitbild-Spiel."
      : current.startsWith("Bitte drehe") ? "" : current);
    setNeedsFullscreenPrompt(portraitBlocked || (!bypassed && !full && needsPrompt()));
  }, [bypassed]);

  useEffect(() => {
    sync();
    document.addEventListener("fullscreenchange", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, [sync]);

  const enterFullscreen = useCallback(async () => {
    if (landscapeRequiredNow()) {
      setError("Bitte drehe dein Gerät zuerst ins Querformat. Vollbild startet erst im Breitbildformat.");
      setNeedsFullscreenPrompt(true);
      return;
    }
    setError("");
    try {
      if (!document.fullscreenElement) {
        if (!document.documentElement.requestFullscreen) throw new Error("unsupported");
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      }
      try {
        const orientation = screen.orientation as ScreenOrientation & { lock?: (orientation: "landscape") => Promise<void> };
        await orientation.lock?.("landscape");
      } catch { /* orientation lock is optional after the physical landscape guard */ }
      setBypassed(false);
      sync();
    } catch {
      setError("Dieser Browser erlaubt hier keinen direkten Vollbildmodus. Du kannst im Querformat ohne Vollbild weiterspielen oder Numberdroid zum Startbildschirm hinzufügen.");
      setNeedsFullscreenPrompt(true);
    }
  }, [sync]);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch { /* browser may already have left fullscreen */ }
    sync();
  }, [sync]);

  const continueWithoutFullscreen = useCallback(() => {
    if (landscapeRequiredNow()) {
      setError("Bitte drehe dein Gerät zuerst ins Querformat. Im Hochformat bleibt das Spiel pausiert.");
      setNeedsFullscreenPrompt(true);
      return;
    }
    setBypassed(true);
    setNeedsFullscreenPrompt(false);
  }, []);

  return { isFullscreen, needsFullscreenPrompt, error, enterFullscreen, exitFullscreen, continueWithoutFullscreen };
}
