import { memo, useEffect, useRef } from 'react';

/*
 * Geometry is expressed in a 1000×1000 viewBox and mirrors the proportions of the
 * dome inside the official emblem (src/assets/alquds-logo.png, 507×492 px), so the
 * scroll transition can land the illustration exactly on the emblem's dome:
 *   emblem dome: x 160→340 (width 180), base at y 235.
 *   here:        x 180→820 (width 640), base at y 680.
 */
export const DOME_GEOMETRY = {
  viewBox: 1000,
  domeWidth: 640,
  domeBase: { x: 500, y: 680 },
  logo: { width: 507, height: 492, domeWidth: 180, domeBase: { x: 250, y: 235 } },
};

const GOLD = '#C5A45D';
const GOLD_LIGHT = '#E8D29C';
const GOLD_DEEP = '#8A6A2C';
const NAVY = '#102A43';

// Left half of the dome outline as a cubic Bézier (base → apex); mirrored for the right half.
const P0 = { x: 180, y: 680 };
const P1 = { x: 180, y: 472 };
const P2 = { x: 324, y: 331 };
const P3 = { x: 500, y: 307 };

function bezier(t: number) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return { x: a * P0.x + b * P1.x + c * P2.x + d * P3.x, y: a * P0.y + b * P1.y + c * P2.y + d * P3.y };
}

const DOME_SAMPLES = Array.from({ length: 161 }, (_, i) => bezier(i / 160));

/** Half-width of the dome silhouette at a given height. */
function hw(y: number): number {
  for (let i = 1; i < DOME_SAMPLES.length; i++) {
    const a = DOME_SAMPLES[i - 1], b = DOME_SAMPLES[i];
    if (y <= a.y && y >= b.y) {
      const k = (a.y - y) / (a.y - b.y || 1);
      return 500 - (a.x + (b.x - a.x) * k);
    }
  }
  return 0;
}

const DOME_PATH = `M ${P0.x} ${P0.y} C ${P1.x} ${P1.y} ${P2.x} ${P2.y} ${P3.x} ${P3.y} C ${1000 - P2.x} ${P2.y} ${1000 - P1.x} ${P1.y} ${1000 - P0.x} ${P0.y} Z`;

/* ---------------------------------------------------------------------------
 * Tiled grid: latitude lines curve with the dome; each band is split into cells
 * whose dividers follow the silhouette. One city name sits in each cell.
 * ------------------------------------------------------------------------- */

const sagAt = (y: number) => 6 + (y - 307) * 0.045;
/** y of a latitude line at horizontal fraction f (−1..1); the line is a parabola. */
const lineY = (y: number, f: number) => y + sagAt(y) * (1 - f * f);
const latitudePath = (y: number) => {
  const h = hw(y);
  return `M ${500 - h} ${y} Q 500 ${y + 2 * sagAt(y)} ${500 + h} ${y}`;
};

// A curated selection of Palestinian cities and towns (not an exhaustive list).
const CAP_BOTTOM = 408;
const BANDS: { top: number; bottom: number; cities: string[] }[] = [
  { top: 408, bottom: 462, cities: ['عكا', 'حيفا', 'يافا'] },
  { top: 462, bottom: 516, cities: ['بيسان', 'طبريا', 'صفد', 'الناصرة'] },
  { top: 516, bottom: 570, cities: ['بيت لحم', 'رام الله', 'نابلس', 'الخليل', 'غزة'] },
  { top: 570, bottom: 624, cities: ['طوباس', 'أريحا', 'قلقيلية', 'طولكرم', 'جنين'] },
  { top: 624, bottom: 680, cities: ['خان يونس', 'رفح', 'بئر السبع', 'الرملة', 'اللد', 'سلفيت'] },
];

const DRUM = { top: 694, bottom: 786, left: 180, right: 820 };
const DRUM_CITIES = ['بيت ساحور', 'البيرة', 'أم الفحم', 'أسدود', 'عسقلان', 'دير البلح'];

interface Cell {
  key: string;
  x: number;
  y: number;
  width: number;
  name: string;
  maxFont: number;
}

// RTL reading order: the first city of each list sits on the right.
const DOME_CELLS: Cell[] = BANDS.flatMap((b, bi) => {
  const n = b.cities.length;
  return b.cities.map((name, i) => {
    const fa = 1 - (2 * i) / n;
    const fb = 1 - (2 * (i + 1)) / n;
    const f = (fa + fb) / 2;
    const y = (lineY(b.top, f) + lineY(b.bottom, f)) / 2;
    // Edge tiles are bounded by the curved outline near the text's height, not the band's widest point.
    const m = hw((b.top + b.bottom) / 2);
    const edge = hw(y - 12) - 12;
    const bound = (fv: number) => (Math.abs(fv) === 1 ? Math.sign(fv) * edge : fv * m);
    const a = bound(fa);
    const c = bound(fb);
    return { key: `b${bi}-${i}`, x: 500 + (a + c) / 2, y, width: Math.abs(a - c), name, maxFont: 32 };
  });
});

const DRUM_CELLS: Cell[] = DRUM_CITIES.map((name, i) => {
  const w = (DRUM.right - DRUM.left) / DRUM_CITIES.length;
  return { key: `drum-${i}`, x: DRUM.right - w * (i + 0.5), y: (DRUM.top + DRUM.bottom) / 2, width: w, name, maxFont: 26 };
});

function bandDividers() {
  return BANDS.flatMap((b, bi) => {
    const n = b.cities.length;
    return Array.from({ length: n - 1 }, (_, k) => {
      const f = 1 - (2 * (k + 1)) / n;
      const x1 = 500 + f * hw(b.top), y1 = lineY(b.top, f);
      const x2 = 500 + f * hw(b.bottom), y2 = lineY(b.bottom, f);
      return <line key={`d${bi}-${k}`} x1={x1} y1={y1} x2={x2} y2={y2} />;
    });
  });
}

/** Architectural layer: golden tiled dome on a blue-tiled drum, gold line-work. */
export const DomeStructure = memo(function DomeStructure() {
  const drumCell = (DRUM.right - DRUM.left) / DRUM_CITIES.length;
  return (
    <svg viewBox="0 0 1000 1000" className="absolute inset-0 size-full" aria-hidden focusable="false">
      <defs>
        <radialGradient id="dome-glow" cx="50%" cy="54%" r="50%">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.32" />
          <stop offset="55%" stopColor={GOLD} stopOpacity="0.07" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="dome-gold" cx="38%" cy="22%" r="85%">
          <stop offset="0%" stopColor="#FBEFC8" />
          <stop offset="30%" stopColor={GOLD_LIGHT} />
          <stop offset="68%" stopColor={GOLD} />
          <stop offset="100%" stopColor={GOLD_DEEP} />
        </radialGradient>
        <linearGradient id="drum-blue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1F5B98" />
          <stop offset="100%" stopColor="#133A63" />
        </linearGradient>
        <clipPath id="dome-clip">
          <path d={DOME_PATH} />
        </clipPath>
      </defs>

      <circle cx="500" cy="540" r="470" fill="url(#dome-glow)" />

      {/* finial with crescent */}
      <g fill={GOLD_LIGHT} stroke="none">
        <rect x="496" y="248" width="8" height="62" rx="3" />
        <circle cx="500" cy="282" r="9" />
        <circle cx="500" cy="262" r="6" />
        <path d="M 509 196 A 19 19 0 1 0 509 234 A 15 15 0 1 1 509 196 Z" />
      </g>

      {/* golden dome with tiled grid */}
      <path d={DOME_PATH} fill="url(#dome-gold)" />
      <g clipPath="url(#dome-clip)" fill="none" stroke={GOLD_DEEP} strokeLinecap="round">
        <ellipse cx="410" cy="420" rx="120" ry="70" fill="#FFF8E1" fillOpacity="0.18" stroke="none" />
        <g strokeWidth="2" strokeOpacity="0.55">
          {[CAP_BOTTOM, ...BANDS.slice(1).map((b) => b.top)].map((y) => (
            <path key={y} d={latitudePath(y)} />
          ))}
        </g>
        <g strokeWidth="1.6" strokeOpacity="0.45">{bandDividers()}</g>
      </g>
      <path d={DOME_PATH} fill="none" stroke={GOLD_LIGHT} strokeWidth="4" />

      {/* cornice, blue-tiled drum and base moulding */}
      <rect x="166" y="680" width="668" height="14" rx="4" fill={GOLD} />
      <rect x={DRUM.left} y={DRUM.top} width={DRUM.right - DRUM.left} height={DRUM.bottom - DRUM.top} fill="url(#drum-blue)" stroke={GOLD} strokeWidth="2.5" />
      <g stroke={GOLD} strokeOpacity="0.6" strokeWidth="1.6">
        {Array.from({ length: DRUM_CITIES.length - 1 }, (_, i) => DRUM.left + drumCell * (i + 1)).map((x) => (
          <line key={x} x1={x} y1={DRUM.top + 6} x2={x} y2={DRUM.bottom - 6} />
        ))}
      </g>
      <rect x="166" y="786" width="668" height="10" rx="3" fill={GOLD} />
    </svg>
  );
});

/** Typographic layer: one Palestinian city name per tile; القدس crowns the dome. */
export const DomeNames = memo(function DomeNames() {
  const svgRef = useRef<SVGSVGElement>(null);

  // One-time fit after fonts load: shrink names that would overflow their tile.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let cancelled = false;
    const fit = () => {
      if (cancelled) return;
      svg.querySelectorAll<SVGTextElement>('text[data-target]').forEach((el) => {
        if (typeof el.getComputedTextLength !== 'function') return;
        const target = Number(el.dataset.target);
        const max = Number(el.dataset.max);
        const current = parseFloat(el.getAttribute('font-size') || '20');
        const len = el.getComputedTextLength();
        if (len) el.setAttribute('font-size', Math.min(max, (current * target) / len).toFixed(2));
      });
    };
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) fonts.ready.then(fit);
    else fit();
    return () => {
      cancelled = true;
    };
  }, []);

  const text = (c: Cell, fill: string, weight: number) => (
    <text
      key={c.key}
      x={c.x}
      y={c.y}
      data-target={(c.width * 0.84).toFixed(1)}
      data-max={c.maxFont}
      fontSize={c.maxFont}
      fontFamily="Cairo, sans-serif"
      fontWeight={weight}
      fill={fill}
      direction="rtl"
      textAnchor="middle"
      dominantBaseline="central"
    >
      {c.name}
    </text>
  );

  return (
    <svg ref={svgRef} viewBox="0 0 1000 1000" className="absolute inset-0 size-full" aria-hidden focusable="false">
      <text
        x="500"
        y="368"
        data-target="210"
        data-max="62"
        fontSize="62"
        fontFamily="Cairo, sans-serif"
        fontWeight={800}
        fill={NAVY}
        direction="rtl"
        textAnchor="middle"
        dominantBaseline="central"
      >
        القدس
      </text>
      {DOME_CELLS.map((c) => text(c, NAVY, 700))}
      {DRUM_CELLS.map((c) => text(c, '#F3E2B3', 600))}
    </svg>
  );
});
