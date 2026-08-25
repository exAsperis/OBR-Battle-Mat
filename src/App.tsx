import OBR, { buildImage } from "@owlbear-rodeo/sdk";
import { useEffect, useState } from "react";
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
    const images = await OBR.assets.downloadImages(false, config?.image?.name, "MAP");
    if (images.length) await OBR.scene.setMetadata(backgroundMetadata(configFromImage(images[0])));
  });
  const testLocalImage = async () => {
    setBusy(true); setActionError(null);
    try {
      if (!(await OBR.scene.isReady())) throw new Error("Open a scene before testing a local image.");
      const [width, height] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
      const center = await OBR.viewport.inverseTransformPoint({ x: width / 2, y: height / 2 });
      const image = buildImage(
        {
          width: 300,
          height: 300,
          url: "https://upload.wikimedia.org/wikipedia/commons/3/3f/PNG_icon.png",
          mime: "image/png",
        },
        { dpi: 300, offset: { x: 150, y: 150 } },
      )
        .position(center)
        .scale({ x: 1, y: 1 })
        .layer("CHARACTER")
        .visible(true)
        .locked(false)
        .name("LOCAL IMAGE TEST")
        .build();
      console.log("About to add local image:", image);
      await OBR.scene.local.addItems([image]);
      const locals = await OBR.scene.local.getItems();
      console.log("Local items after add:", locals);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "The local image test failed.");
    } finally { setBusy(false); }
  };
  const updateConfig = (next: BackgroundConfigV1) => runGmAction(() => OBR.scene.setMetadata(backgroundMetadata(next)));
  const changeDistance = (value: RenderDistance) => { setRenderDistance(value); setDistanceState(value); };
  if (status === "connecting") return <main className="center-state"><div className="spinner" /><p>Connecting to Owlbear Rodeo…</p></main>;
  if (status === "error") return <main className="center-state"><div className="app-mark small">BM</div><h1>Battle Mat unavailable</h1><p>{error}</p><button onClick={() => void refresh()}>Try again</button></main>;
  const tileCount = poolSizeForRadius(radiusForRenderDistance(distance));
  const configured = Boolean(config?.image);
  return <main className="app-shell">
    <header className="app-header"><div className="app-mark">BM</div><div><p className="eyebrow">Owlbear Rodeo</p><h1>Battle Mat</h1></div><span className={`status-pill ${config?.enabled ? "active" : ""}`}>{config?.enabled ? "Active" : "Inactive"}</span></header>
    {!sceneReady ? <section className="empty-card"><div className="scene-icon">◇</div><h2>No scene open</h2><p>Open a scene to configure its repeating background.</p></section> : <>
      <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">Shared with everyone</p><h2>Scene background</h2></div>{role !== "GM" && <span className="role-chip">GM controlled</span>}</div>
        <div className={`image-card ${configured ? "configured" : ""}`}>
          {configured ? <><div className="thumbnail" style={{ backgroundImage: `url(${config!.image!.url})` }} role="img" aria-label="Current background preview" /><div className="image-details"><strong>{config!.image!.name || "Selected image"}</strong><span>{config!.image!.width} × {config!.image!.height}px</span></div></>
            : <div className="image-placeholder"><span>＋</span><div><strong>No image selected</strong><small>Choose a map asset to repeat</small></div></div>}
        </div>
        {role === "GM" ? <div className="gm-controls">
          <label className="toggle-row"><span><strong>Enabled</strong><small>Show this background to all players</small></span><input type="checkbox" checked={Boolean(config?.enabled)} disabled={!configured || busy} onChange={(event) => config && void updateConfig({ ...config, enabled: event.target.checked })} /></label>
          <div className="button-row"><button className="primary" disabled={busy} onClick={() => void chooseImage()}>{busy ? "Working…" : configured ? "Replace image" : "Choose image"}</button>{configured && <button className="danger" disabled={busy} onClick={() => void updateConfig(EMPTY_BACKGROUND_CONFIG)}>Clear</button>}</div>
        </div> : <p className="player-note">{config?.enabled ? "The GM has enabled a repeating background for this scene." : "No repeating background is enabled for this scene."}</p>}
        {actionError && <p className="error-notice" role="alert">{actionError}</p>}
      </section>
      <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">Temporary diagnostic</p><h2>Local image test</h2></div></div>
        <p className="hint">Adds one interactive image at the center of this viewport.</p>
        <button className="primary" disabled={busy} onClick={() => void testLocalImage()}>Add local image</button>
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
