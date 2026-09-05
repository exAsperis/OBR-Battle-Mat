import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchBuiltInManifest, type BuiltInBackground } from "../config/builtInBackgrounds";

interface BuiltInGalleryProps {
  busy: boolean;
  onBack: () => void;
  onSelect: (background: BuiltInBackground) => void;
}

export function BuiltInGallery({ busy, onBack, onSelect }: BuiltInGalleryProps) {
  const [images, setImages] = useState<BuiltInBackground[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collection, setCollection] = useState("all");
  const [hideAi, setHideAi] = useState(false);
  const request = useRef(0);

  const load = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const manifest = await fetchBuiltInManifest();
      if (current === request.current) setImages(manifest.images);
    } catch (cause) {
      if (current === request.current) {
        setImages([]);
        setError(cause instanceof Error ? cause.message : "Unable to load built-in images.");
      }
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => { request.current += 1; };
  }, [load]);

  const collections = useMemo(() => [...new Set(images.flatMap((image) => image.collection))].sort((a, b) => a.localeCompare(b)), [images]);
  const filteredImages = useMemo(() => images.filter((image) =>
    (collection === "all" || image.collection.includes(collection)) && (!hideAi || !image.ai)
  ), [collection, hideAi, images]);

  return <>
    <div className="gallery-filters">
      <label className="collection-filter"><span>Collection</span><select value={collection} onChange={(event) => setCollection(event.target.value)}>
        <option value="all">All collections</option>
        {collections.map((value) => <option key={value} value={value}>{value}</option>)}
      </select></label>
      <label className="compact-toggle"><span>Hide AI</span><input type="checkbox" checked={hideAi} onChange={(event) => setHideAi(event.target.checked)} /></label>
    </div>
    <div className="gallery-toolbar">
      <button type="button" className="secondary" disabled={busy} onClick={onBack}>← Back</button>
      <button type="button" className="secondary" disabled={busy || loading} onClick={() => void load()}>Refresh</button>
    </div>
    {loading ? <div className="gallery-state"><div className="spinner" /><p>Loading built-in images…</p></div>
      : error ? <div className="gallery-state"><p className="error-notice" role="alert">{error}</p><button type="button" className="primary" disabled={busy} onClick={() => void load()}>Try again</button></div>
        : images.length === 0 ? <div className="gallery-state"><p>No built-in images are available yet.</p></div>
          : filteredImages.length === 0 ? <div className="gallery-state"><p>No built-in images match these filters.</p></div>
          : <div className="background-gallery" aria-label="Built in">
            {filteredImages.map((image) => <button type="button" className="background-option" key={image.url} disabled={busy} onClick={() => onSelect(image)}>
              <span className="background-preview"><img src={image.url} alt="" loading="lazy" decoding="async" /></span>
              <span className="background-option-details">
                {image.ai && <span className="ai-glyph" title="Made with generative AI" aria-label="Made with generative AI">AI</span>}
                <strong>{image.name}</strong><small>{image.columns} × {image.rows} cells</small>
                <small className="image-rights"><span>{image.rights.creator}</span>{image.rights.license && <span>{image.rights.license}</span>}</small>
              </span>
            </button>)}
          </div>}
  </>;
}
