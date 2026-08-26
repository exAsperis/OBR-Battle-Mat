import OBR from "@owlbear-rodeo/sdk";
import { useEffect, useState } from "react";
import { BuiltInGallery } from "./components/BuiltInGallery";
import { configFromBuiltIn, loadImageDimensions, type BuiltInBackground } from "./config/builtInBackgrounds";
import { getRenderDistance, poolSizeForRadius, radiusForRenderDistance, RENDER_DISTANCE_OPTIONS, setRenderDistance } from "./config/localSettings";
import { backgroundMetadata, configFromImage, EMPTY_BACKGROUND_CONFIG } from "./config/sceneConfig";
import { RENDER_DISTANCE_EVENT, RENDER_DISTANCE_KEY } from "./constants";
import { useOwlbear } from "./hooks/useOwlbear";
import type { BackgroundConfigV1, RenderDistance } from "./types";
import { RELEASE_VERSION } from "./version";

export default function App() {
  const { status, role, sceneReady, config, error, refresh } = useOwlbear();
  const [distance, setDistanceState] = useState<RenderDistance>(() => getRenderDistance());
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showBuiltIns, setShowBuiltIns] = useState(false);
  useEffect(() => {
    const update = () => setDistanceState(getRenderDistance());
    const storage = (event: StorageEvent) => { if (event.key === RENDER_DISTANCE_KEY) update(); };
    window.addEventListener("storage", storage); window.addEventListener(RENDER_DISTANCE_EVENT, update);
    return () => { window.removeEventListener("storage", storage); window.removeEventListener(RENDER_DISTANCE_EVENT, update); };
  }, []);
  const runGmAction = async (action: () => Promise<void>) => {
    setBusy(true); setActionError(null);
    try {
      if (await OBR.player.getRole() !== "GM") throw new Error("Only the GM can change the scene background.");
      if (!(await OBR.scene.isReady())) throw new Error("Open a scene before changing its background.");
      await action();
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "The background could not be updated."); }
    finally { setBusy(false); }
  };
  const chooseImage = () => runGmAction(async () => {
    const images = await OBR.assets.downloadImages(false, undefined, "MAP");
    if (images.length) await OBR.scene.setMetadata(backgroundMetadata(configFromImage(images[0])));
  });
  const chooseBuiltIn = (background: BuiltInBackground) => runGmAction(async () => {
    const [dimensions, sceneDpi] = await Promise.all([loadImageDimensions(background.url), OBR.scene.grid.getDpi()]);
    await OBR.scene.setMetadata(backgroundMetadata(configFromBuiltIn(background, dimensions, sceneDpi)));
    setShowBuiltIns(false);
  });
  const updateConfig = (next: BackgroundConfigV1) => runGmAction(() => OBR.scene.setMetadata(backgroundMetadata(next)));
  const changeDistance = (value: RenderDistance) => { setRenderDistance(value); setDistanceState(value); };
  if (status === "connecting") return <main className="center-state"><div className="spinner" /><p>Connecting to Owlbear Rodeo…</p></main>;
  if (status === "error") return <main className="center-state"><img className="app-mark small" src="/icon.svg" alt="" /><h1>Battle Mat unavailable</h1><p>{error}</p><button onClick={() => void refresh()}>Try again</button></main>;
  const tileCount = poolSizeForRadius(radiusForRenderDistance(distance));
  const configured = Boolean(config?.image);
  return <main className="app-shell">
    <header className="app-header"><img className="app-mark" src="/icon.svg" alt="" /><h1>Battle Mat</h1><span className={`status-pill ${config?.enabled ? "active" : ""}`}>{config?.enabled ? "Active" : "Inactive"}</span></header>
    {!sceneReady ? <section className="empty-card"><div className="scene-icon">◇</div><h2>No scene open</h2><p>Open a scene to configure its repeating background.</p></section> : <>
      <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">Shared with everyone</p><h2>{showBuiltIns ? "Built-in backgrounds" : "Scene background"}</h2></div>{role !== "GM" && <span className="role-chip">GM controlled</span>}</div>
        {showBuiltIns && role === "GM" ? <BuiltInGallery busy={busy} onBack={() => setShowBuiltIns(false)} onSelect={(background) => void chooseBuiltIn(background)} /> : <>
        <div className={`image-card ${configured ? "configured" : ""}`}>
          {configured ? <><div className="thumbnail" style={{ backgroundImage: `url(${config!.image!.url})` }} role="img" aria-label="Current background preview" /><div className="image-details"><strong>{config!.image!.name || "Selected image"}</strong><span>{config!.image!.width} × {config!.image!.height}px</span></div></>
            : <div className="image-placeholder"><span>＋</span><div><strong>No image selected</strong><small>Choose a background to repeat</small></div></div>}
        </div>
        {role === "GM" ? <div className="gm-controls">
          <label className="toggle-row"><span><strong>Enabled</strong><small>Show this background to all players</small></span><input type="checkbox" checked={Boolean(config?.enabled)} disabled={!configured || busy} onChange={(event) => config && void updateConfig({ ...config, enabled: event.target.checked })} /></label>
          <div className="source-buttons"><button className="primary" disabled={busy} onClick={() => { setActionError(null); setShowBuiltIns(true); }}>Built-in backgrounds</button><button className="secondary" disabled={busy} onClick={() => void chooseImage()}>My OBR maps</button></div>
          {configured && <div className="button-row"><button className="danger" disabled={busy} onClick={() => void updateConfig(EMPTY_BACKGROUND_CONFIG)}>Clear background</button></div>}
        </div> : <p className="player-note">{config?.enabled ? "The GM has enabled a repeating background for this scene." : "No repeating background is enabled for this scene."}</p>}
        </>}
        {actionError && <p className="error-notice" role="alert">{actionError}</p>}
      </section>
      <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">Local performance</p><h2>This device</h2></div><span className="tile-count">{tileCount} tiles</span></div>
        <fieldset className="distance-control"><legend>Render distance</legend><div className="segmented">{RENDER_DISTANCE_OPTIONS.map((option) => <label key={option.value} className={distance === option.value ? "selected" : ""}><input type="radio" name="distance" checked={distance === option.value} onChange={() => changeDistance(option.value)} /><span>{option.label}</span></label>)}</div></fieldset>
        <p className="hint">Render distance affects only this device. Lower settings use fewer local image tiles; zoom never adds more.</p>
      </section>
    </>}
    <footer className="version-footer">OBR Battle Mat v{RELEASE_VERSION}</footer>
  </main>;
}
