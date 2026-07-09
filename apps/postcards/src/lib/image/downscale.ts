/**
 * Turn a chosen image File into a bounded JPEG data URL, entirely on-device via an
 * <img> + canvas — so a "postcard" photo stays small enough to live in the portable
 * file and never has to leave the device (Constitution II/III: local-first, private).
 * Modern browsers apply the image's EXIF orientation when drawing, so phone photos
 * aren't sideways.
 */
export async function fileToPostcard(file: File, maxDim = 1000, quality = 0.72): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode image"));
      el.src = url;
    });
    const sw = img.naturalWidth || img.width;
    const sh = img.naturalHeight || img.height;
    const scale = Math.min(1, maxDim / Math.max(sw, sh, 1));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
