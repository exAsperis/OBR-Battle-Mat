import OBR from "@owlbear-rodeo/sdk";
import { useEffect, useState } from "react";
import { BuiltInGallery } from "./components/BuiltInGallery";
import { configFromBuiltIn, configFromUrl, loadImageDimensions, type BuiltInBackground } from "./config/builtInBackgrounds";
import { getRenderDistance, poolSizeForRadius, radiusForRenderDistance, RENDER_DISTANCE_OPTIONS, setRenderDistance } from "./config/localSettings";
import { backgroundMetadata, configFromImage, EMPTY_BACKGROUND_CONFIG } from "./config/sceneConfig";
import { RENDER_DISTANCE_EVENT, RENDER_DISTANCE_KEY } from "./constants";
import { useActionHeight } from "./hooks/useActionHeight";
import { useOwlbear } from "./hooks/useOwlbear";
import type { BackgroundConfigV1, RenderDistance } from "./types";
import { RELEASE_VERSION } from "./version";

type UrlCheckState =
  | { status: "idle" | "checking" }
  | { status: "valid"; url: string; width: number; height: number }
  | { status: "error"; message: string };

function rightsTooltip(rights: NonNullable<BackgroundConfigV1["image"]>["rights"]): string {
  if (!rights) return "";
  return Object.entries(rights).map(([field, value]) => {
    const label = field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/(^|_)(\w)/g, (_, space, letter: string) => `${space ? " " : ""}${letter.toUpperCase()}`);
    return `${label}: ${value}`;
  }).join("\n");
}

export default function App() {
  useActionHeight();
  const { status, role, sceneReady, config, error, refresh } = useOwlbear();
  const [distance, setDistanceState] = useState<RenderDistance>(() => getRenderDistance());
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showBuiltIns, setShowBuiltIns] = useState(false);
  const [showUrlForm, setShowUrlForm] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [columns, setColumns] = useState("16");
  const [rows, setRows] = useState("16");
  const [urlCheck, setUrlCheck] = useState<UrlCheckState>({ status: "idle" });
  useEffect(() => {
    const update = () => setDistanceState(getRenderDistance());
    const storage = (event: StorageEvent) => { if (event.key === RENDER_DISTANCE_KEY) update(); };
    window.addEventListener("storage", storage); window.addEventListener(RENDER_DISTANCE_EVENT, update);
    return () => { window.removeEventListener("storage", storage); window.removeEventListener(RENDER_DISTANCE_EVENT, update); };
  }, []);
  useEffect(() => {
    if (!showUrlForm || !imageUrl.trim()) { setUrlCheck({ status: "idle" }); return; }
    let active = true;
    const url = imageUrl.trim();
    const timeout = window.setTimeout(() => {
      setUrlCheck({ status: "checking" });
      void (async () => {
        try {
          const candidate = configFromUrl({ url, columns: 1, rows: 1 }, { width: 1, height: 1 });
          const dimensions = await loadImageDimensions(candidate.image!.url, true);
          if (active) setUrlCheck({ status: "valid", url, ...dimensions });
        } catch (cause) {
          if (active) setUrlCheck({ status: "error", message: cause instanceof Error ? cause.message : "This image cannot be used by Owlbear Rodeo." });
        }
      })();
    }, 600);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [imageUrl, showUrlForm]);
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
    const dimensions = await loadImageDimensions(background.url);
    await OBR.scene.setMetadata(backgroundMetadata(configFromBuiltIn(background, dimensions)));
    setShowBuiltIns(false);
  });
  const chooseUrl = () => runGmAction(async () => {
    const input = { url: imageUrl.trim(), columns: Number(columns), rows: Number(rows) };
    if (urlCheck.status !== "valid" || urlCheck.url !== input.url) throw new Error("Wait for the URL compatibility check to finish.");
    await OBR.scene.setMetadata(backgroundMetadata(configFromUrl(input, { width: urlCheck.width, height: urlCheck.height })));
    setShowUrlForm(false);
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
        <div className="section-heading"><div><h2>{showBuiltIns ? "Built in" : "Scene background"}</h2></div>{role !== "GM" && <span className="role-chip">GM controlled</span>}</div>
        {showBuiltIns && role === "GM" ? <BuiltInGallery busy={busy} onBack={() => setShowBuiltIns(false)} onSelect={(background) => void chooseBuiltIn(background)} /> : <>
        <div className={`image-card ${configured ? "configured" : ""}`}>
          {configured ? <><div className="thumbnail" style={{ backgroundImage: `url(${config!.image!.url})` }} role="img" aria-label="Current background preview" /><div className="image-details">
            {config!.image!.ai && <span className="ai-glyph main-ai" title="Made with generative AI" aria-label="Made with generative AI">AI</span>}
            <strong>{config!.image!.name || "Selected image"}</strong>
            <span>{config!.image!.width} × {config!.image!.height}px{config!.image!.columns && config!.image!.rows ? ` · ${config!.image!.columns} × ${config!.image!.rows} cells` : ""}</span>
            {config!.image!.rights && <span className="main-image-rights">
              <span title={rightsTooltip(config!.image!.rights)}>{config!.image!.rights.creator}</span>
              {config!.image!.rights.license && <span title={rightsTooltip(config!.image!.rights)}>{config!.image!.rights.license}</span>}
            </span>}
          </div></>
            : <div className="image-placeholder"><span>＋</span><div><strong>No image selected</strong><small>Choose a background to repeat</small></div></div>}
        </div>
        {role === "GM" ? <div className="gm-controls">
          <label className="toggle-row"><span><strong>Enabled</strong><small>Show this background to all players</small></span><input type="checkbox" checked={Boolean(config?.enabled)} disabled={!configured || busy} onChange={(event) => config && void updateConfig({ ...config, enabled: event.target.checked })} /></label>
          {showUrlForm ? <form className="url-source-form" onSubmit={(event) => { event.preventDefault(); void chooseUrl(); }}>
            <p className="license-notice">You must ensure this image is properly licensed for your intended use.</p>
            <label><span>Image URL</span><input type="url" required placeholder="https://example.com/image.png" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} aria-describedby="url-check-status" /></label>
            <div id="url-check-status" className={`url-check ${urlCheck.status}`} aria-live="polite">
              {urlCheck.status === "checking" && <><span className="mini-spinner" /> Checking Owlbear compatibility…</>}
              {urlCheck.status === "valid" && <span>Compatible image · {urlCheck.width} × {urlCheck.height}px</span>}
              {urlCheck.status === "error" && <span role="alert">{urlCheck.message}</span>}
            </div>
            <div className="url-grid-fields"><label><span>Columns</span><input type="number" required min="1" step="1" value={columns} onChange={(event) => setColumns(event.target.value)} /></label><label><span>Rows</span><input type="number" required min="1" step="1" value={rows} onChange={(event) => setRows(event.target.value)} /></label></div>
            <div className="button-row"><button type="button" className="secondary" disabled={busy} onClick={() => { setActionError(null); setShowUrlForm(false); }}>Cancel</button><button type="submit" className="primary" disabled={busy || urlCheck.status !== "valid"}>Apply</button></div>
          </form> : <div className="source-control"><strong className="source-title">New image from:</strong><div className="source-buttons"><button className="primary" disabled={busy} onClick={() => { setActionError(null); setShowBuiltIns(true); }}>Built in</button><button className="secondary" disabled={busy} onClick={() => void chooseImage()}>My OBR images</button><button className="secondary" disabled={busy} onClick={() => { setActionError(null); setShowUrlForm(true); }}>URL</button></div></div>}
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
