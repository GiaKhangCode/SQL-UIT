import { useEffect, useRef, useState } from "react";
import { Dialog } from "./ui";

export type BannerCrop = { x: number; y: number; zoom: number };
export const defaultBannerCrop: BannerCrop = { x: 0.5, y: 0.5, zoom: 1 };
const OUTPUT_WIDTH = 1800;
const OUTPUT_HEIGHT = 600;

function geometry(width: number, height: number, frameWidth: number, zoom: number) {
  const frameHeight = frameWidth / 3;
  const scale = Math.max(frameWidth / width, frameHeight / height) * zoom;
  return { frameHeight, scale, cropWidth: frameWidth / scale, cropHeight: frameHeight / scale };
}

function clampCrop(crop: BannerCrop, width: number, height: number, frameWidth: number): BannerCrop {
  const { cropWidth, cropHeight } = geometry(width, height, frameWidth, crop.zoom);
  return {
    ...crop,
    x: Math.max(cropWidth / (2 * width), Math.min(1 - cropWidth / (2 * width), crop.x)),
    y: Math.max(cropHeight / (2 * height), Math.min(1 - cropHeight / (2 * height), crop.y)),
  };
}

function toWebP(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (blob?.type === "image/webp") resolve(blob);
    else reject(new Error("This browser cannot export WebP banners."));
  }, "image/webp", quality));
}

export function ContestBannerCrop({ sourceUrl, initialCrop, onClose, onApply }: {
  sourceUrl: string;
  initialCrop: BannerCrop;
  onClose: () => void;
  onApply: (banner: Blob, source: Blob, crop: BannerCrop) => Promise<void>;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [frameWidth, setFrameWidth] = useState(600);
  const [crop, setCrop] = useState(initialCrop);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth * image.naturalHeight > 40_000_000) {
        setError("Choose an image smaller than 40 megapixels.");
        return;
      }
      imageRef.current = image;
      setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => setError("Could not load this banner image.");
    image.src = sourceUrl;
    return () => { image.onload = null; image.onerror = null; };
  }, [sourceUrl]);

  useEffect(() => {
    if (!frameRef.current) return;
    const observer = new ResizeObserver(() => setFrameWidth(frameRef.current?.clientWidth || 600));
    observer.observe(frameRef.current);
    setFrameWidth(frameRef.current.clientWidth || 600);
    return () => observer.disconnect();
  }, []);

  const { width, height } = dimensions;
  const active = width && height ? clampCrop(crop, width, height, frameWidth) : crop;
  const { frameHeight, scale } = width && height ? geometry(width, height, frameWidth, active.zoom) : { frameHeight: frameWidth / 3, scale: 1 };
  const renderedWidth = width * scale;
  const renderedHeight = height * scale;

  function move(deltaX: number, deltaY: number) {
    if (!width || !height) return;
    setCrop((current) => {
      const scaleNow = geometry(width, height, frameWidth, current.zoom).scale;
      return clampCrop({ ...current, x: current.x - deltaX / (scaleNow * width), y: current.y - deltaY / (scaleNow * height) }, width, height, frameWidth);
    });
  }

  async function apply() {
    const image = imageRef.current;
    if (!image || !width || !height || busy) return;
    setBusy(true);
    setError("");
    try {
      const bounded = clampCrop(crop, width, height, frameWidth);
      const { cropWidth, cropHeight } = geometry(width, height, frameWidth, bounded.zoom);
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_WIDTH;
      canvas.height = OUTPUT_HEIGHT;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not prepare the image crop.");
      context.drawImage(image, bounded.x * width - cropWidth / 2, bounded.y * height - cropHeight / 2,
        cropWidth, cropHeight, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
      const banner = await toWebP(canvas, 0.88);

      const sourceCanvas = document.createElement("canvas");
      const sourceScale = Math.min(1, 5000 / Math.max(width, height), Math.sqrt(12_000_000 / (width * height)));
      sourceCanvas.width = Math.round(width * sourceScale);
      sourceCanvas.height = Math.round(height * sourceScale);
      const sourceContext = sourceCanvas.getContext("2d");
      if (!sourceContext) throw new Error("Could not prepare the source image.");
      sourceContext.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);
      const source = await toWebP(sourceCanvas, 0.82);
      await onApply(banner, source, bounded);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not apply banner crop.");
    } finally {
      setBusy(false);
    }
  }

  return <Dialog title="Adjust contest banner" className="teacher-banner-crop-dialog" onClose={() => { if (!busy) onClose(); }}>
    <p className="tiny muted">Drag the image inside the fixed 3:1 banner frame. Zoom to choose the visible area.</p>
    <div className="teacher-banner-crop-frame" ref={frameRef}
      onPointerDown={(event) => { if (!width) return; event.currentTarget.setPointerCapture(event.pointerId); lastPointer.current = { x: event.clientX, y: event.clientY }; }}
      onPointerMove={(event) => { if (!lastPointer.current) return; move(event.clientX - lastPointer.current.x, event.clientY - lastPointer.current.y); lastPointer.current = { x: event.clientX, y: event.clientY }; }}
      onPointerUp={() => { lastPointer.current = null; }} onPointerCancel={() => { lastPointer.current = null; }}>
      {width > 0 && <img src={sourceUrl} alt="Banner crop preview" draggable={false} style={{ width: renderedWidth, height: renderedHeight,
        left: frameWidth / 2 - active.x * renderedWidth, top: frameHeight / 2 - active.y * renderedHeight }} />}
    </div>
    <label className="teacher-banner-zoom">Zoom
      <input type="range" min="1" max="3" step="0.01" value={crop.zoom} onChange={(event) => setCrop((current) => width && height
        ? clampCrop({ ...current, zoom: Number(event.target.value) }, width, height, frameWidth)
        : { ...current, zoom: Number(event.target.value) })} aria-label="Banner zoom" />
      <span>{Math.round(crop.zoom * 100)}%</span>
    </label>
    {error && <p className="teacher-form-message" role="alert">{error}</p>}
    <div className="teacher-banner-actions"><button className="button" type="button" disabled={busy} onClick={() => setCrop(defaultBannerCrop)}>Reset</button>
      <button className="button" type="button" disabled={busy} onClick={onClose}>Cancel</button>
      <button className="button primary" type="button" disabled={busy || !width} onClick={() => { void apply(); }}>{busy ? "Applying…" : "Apply"}</button></div>
  </Dialog>;
}
