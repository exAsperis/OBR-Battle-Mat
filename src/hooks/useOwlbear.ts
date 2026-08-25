import OBR from "@owlbear-rodeo/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { readBackgroundConfig } from "../config/sceneConfig";
import { applyOwlbearTheme } from "../theme";
import type { BackgroundConfigV1 } from "../types";

export type ConnectionStatus = "connecting" | "ready" | "error";
export interface OwlbearState {
  status: ConnectionStatus; role: "GM" | "PLAYER" | null; sceneReady: boolean;
  config: BackgroundConfigV1 | null; error: string | null; refresh: () => Promise<void>;
}

export function useOwlbear(): OwlbearState {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [role, setRole] = useState<"GM" | "PLAYER" | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [config, setConfig] = useState<BackgroundConfigV1 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);
  const refresh = useCallback(async () => {
    if (!active.current) return;
    try {
      const [nextRole, nextSceneReady] = await Promise.all([OBR.player.getRole(), OBR.scene.isReady()]);
      const nextConfig = nextSceneReady ? readBackgroundConfig(await OBR.scene.getMetadata()) : null;
      if (!active.current) return;
      setRole(nextRole); setSceneReady(nextSceneReady); setConfig(nextConfig); setError(null); setStatus("ready");
    } catch (cause) {
      if (!active.current) return;
      setError(cause instanceof Error ? cause.message : "Unable to read Owlbear Rodeo state."); setStatus("error");
    }
  }, []);
  useEffect(() => {
    active.current = true;
    let cleanupTheme: (() => void) | undefined;
    let cleanupPlayer: (() => void) | undefined;
    let cleanupScene: (() => void) | undefined;
    let cleanupMetadata: (() => void) | undefined;
    if (window.self === window.top) {
      setError("Open this extension inside an Owlbear Rodeo room."); setStatus("error");
      return () => { active.current = false; };
    }
    OBR.onReady(async () => {
      if (!active.current) return;
      try { applyOwlbearTheme(await OBR.theme.getTheme()); cleanupTheme = OBR.theme.onChange(applyOwlbearTheme); } catch { /* CSS fallbacks remain usable. */ }
      cleanupPlayer = OBR.player.onChange(() => void refresh());
      cleanupScene = OBR.scene.onReadyChange(() => void refresh());
      cleanupMetadata = OBR.scene.onMetadataChange((metadata) => { if (active.current) setConfig(readBackgroundConfig(metadata)); });
      await refresh();
    });
    return () => { active.current = false; cleanupTheme?.(); cleanupPlayer?.(); cleanupScene?.(); cleanupMetadata?.(); };
  }, [refresh]);
  return { status, role, sceneReady, config, error, refresh };
}
