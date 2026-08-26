import { useCallback, useEffect, useRef, useState } from "react";
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
        setError(cause instanceof Error ? cause.message : "Unable to load built-in backgrounds.");
      }
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => { request.current += 1; };
  }, [load]);

  return <>
    <div className="gallery-toolbar">
      <button type="button" className="secondary" disabled={busy} onClick={onBack}>← Back</button>
      <button type="button" className="secondary" disabled={busy || loading} onClick={() => void load()}>Refresh</button>
    </div>
    {loading ? <div className="gallery-state"><div className="spinner" /><p>Loading built-in backgrounds…</p></div>
      : error ? <div className="gallery-state"><p className="error-notice" role="alert">{error}</p><button type="button" className="primary" disabled={busy} onClick={() => void load()}>Try again</button></div>
        : images.length === 0 ? <div className="gallery-state"><p>No built-in backgrounds are available yet.</p></div>
          : <div className="background-gallery" aria-label="Built-in backgrounds">
            {images.map((image) => <button type="button" className="background-option" key={image.url} disabled={busy} onClick={() => onSelect(image)}>
              <span className="background-preview" style={{ backgroundImage: `url(${image.url})` }} />
              <span className="background-option-details"><strong>{image.name}</strong><small>{image.columns} × {image.rows} cells</small></span>
            </button>)}
          </div>}
  </>;
}
