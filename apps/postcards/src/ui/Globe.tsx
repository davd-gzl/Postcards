import { useEffect, useRef } from "react";
import { feature } from "topojson-client";
import { usePrefersReducedMotion } from "../lib/hooks/usePrefersReducedMotion";

// A slowly-spinning orthographic earth drawn on a canvas from the app's OWN
// bundled continent geometry (Natural Earth, same file the map uses). No
// libraries beyond topojson-client (already a dep), no network beyond the
// same-origin asset, no external textures — so it works offline, obeys the CSP,
// and looks like nothing off a shelf.

const GEOMETRY_URL = `${import.meta.env.BASE_URL}basemap/countries-50m.json`;
type Ring = [number, number][]; // [lon, lat] degrees

// Decoded once per session and shared (the intro mounts at most once, but this
// keeps a remount cheap).
let landPromise: Promise<Ring[]> | null = null;
async function loadLand(): Promise<Ring[]> {
  if (!landPromise) {
    landPromise = (async () => {
      try {
        const res = await fetch(GEOMETRY_URL);
        if (!res.ok) return [];
        const topo = (await res.json()) as Parameters<typeof feature>[0] & {
          objects: Record<string, Parameters<typeof feature>[1]>;
        };
        const fc = feature(topo, topo.objects.land) as unknown as {
          type: string;
          geometry?: { type: string; coordinates: unknown };
          features?: { geometry: { type: string; coordinates: unknown } }[];
        };
        const rings: Ring[] = [];
        const add = (geom: { type: string; coordinates: unknown }) => {
          if (geom.type === "Polygon") {
            for (const r of geom.coordinates as Ring[]) rings.push(r);
          } else if (geom.type === "MultiPolygon") {
            for (const poly of geom.coordinates as Ring[][]) for (const r of poly) rings.push(r);
          }
        };
        if (fc.features) for (const f of fc.features) add(f.geometry);
        else if (fc.geometry) add(fc.geometry);
        return rings;
      } catch {
        return [];
      }
    })();
  }
  return landPromise;
}

export function Globe({ size = 220 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctxOrNull = canvas.getContext("2d");
    if (!ctxOrNull) return;
    const ctx = ctxOrNull; // non-null, so the draw closures below don't re-widen it

    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.scale(dpr, dpr);

    const R = size / 2 - size * 0.06; // leave room for the atmosphere glow
    const cx = size / 2;
    const cy = size / 2;
    const phi0 = (-16 * Math.PI) / 180; // tilt the north a touch toward the viewer
    let lambda0 = (160 * Math.PI) / 180; // start with the Atlantic facing us
    let land: Ring[] = [];
    let cancelled = false;
    let raf = 0;

    // Orthographic projection centred at (lambda0, phi0). Returns screen x/y and
    // cosc (>= 0 means the point is on the visible near hemisphere).
    function project(lonDeg: number, latDeg: number): [number, number, number] {
      const lon = (lonDeg * Math.PI) / 180;
      const lat = (latDeg * Math.PI) / 180;
      const dl = lon - lambda0;
      const cosc = Math.sin(phi0) * Math.sin(lat) + Math.cos(phi0) * Math.cos(lat) * Math.cos(dl);
      const x = Math.cos(lat) * Math.sin(dl);
      const y = Math.cos(phi0) * Math.sin(lat) - Math.sin(phi0) * Math.cos(lat) * Math.cos(dl);
      return [cx + R * x, cy - R * y, cosc];
    }

    function draw() {
      ctx.clearRect(0, 0, size, size);

      // Soft atmosphere halo.
      const halo = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.16);
      halo.addColorStop(0, "rgba(96,160,240,0.40)");
      halo.addColorStop(1, "rgba(96,160,240,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.16, 0, Math.PI * 2);
      ctx.fill();

      // Ocean sphere — a radial gradient offset up-left reads as a lit globe.
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      const ocean = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.45, R * 0.15, cx, cy, R * 1.05);
      ocean.addColorStop(0, "#3f86e0");
      ocean.addColorStop(0.65, "#1f5bb0");
      ocean.addColorStop(1, "#0d306b");
      ctx.fillStyle = ocean;
      ctx.fillRect(0, 0, size, size);

      // Land. A soft earthy green (not the old near-white cream, which washed the
      // globe out to a pale disc on land-heavy faces). Back-hemisphere vertices are
      // clamped onto the rim so a continent straddling the horizon stays continuous.
      ctx.fillStyle = "rgba(150,192,118,0.95)";
      for (const ring of land) {
        let front = false;
        ctx.beginPath();
        for (let i = 0; i < ring.length; i++) {
          const [lon, lat] = ring[i]!;
          let [px, py, cosc] = project(lon, lat);
          if (cosc < 0) {
            const dx = px - cx;
            const dy = py - cy;
            const h = Math.hypot(dx, dy) || 1;
            px = cx + (dx / h) * R;
            py = cy + (dy / h) * R;
          } else {
            front = true;
          }
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        if (front) {
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();

      // Terminator/rim shadow for depth.
      const shade = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.2, cx, cy, R);
      shade.addColorStop(0, "rgba(255,255,255,0.06)");
      shade.addColorStop(0.6, "rgba(0,0,20,0)");
      shade.addColorStop(1, "rgba(3,10,32,0.45)");
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
    }

    function tick() {
      lambda0 += 0.0018;
      draw();
      raf = requestAnimationFrame(tick);
    }

    draw(); // paint the ocean immediately while the geometry decodes
    void loadLand().then((r) => {
      if (cancelled) return;
      land = r;
      if (reduced) draw();
      else raf = requestAnimationFrame(tick);
    });

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [size, reduced]);

  return (
    <canvas
      ref={canvasRef}
      className="intro-globe"
      aria-hidden
      style={{ width: size, height: size }}
    />
  );
}
