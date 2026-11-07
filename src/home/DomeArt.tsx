import { memo, useEffect, useRef } from 'react';

/*
 * Geometry is expressed in a 1000×1000 viewBox and mirrors the proportions of the
 * dome inside the official emblem (src/assets/alquds-logo.png, 507×492 px), so the
 * scroll transition can land the illustration exactly on the emblem's dome:
 *   emblem dome: x 160→340 (width 180), base at y 235, apex at y 130.
 *   here:        x 300→700 (width 400), base at y 500, apex at y 267.
 */
export const DOME_GEOMETRY = {
  viewBox: 1000,
  domeWidth: 400,
  domeBase: { x: 500, y: 500 },
  logo: { width: 507, height: 492, domeWidth: 180, domeBase: { x: 250, y: 235 } },
};

const GOLD = '#C5A45D';
const GOLD_LIGHT = '#E8D29C';

// Left half of the dome outline as a cubic Bézier (base → apex); mirrored for the right half.
const P0 = { x: 300, y: 500 };
const P1 = { x: 300, y: 370 };
const P2 = { x: 390, y: 282 };
const P3 = { x: 500, y: 267 };

function bezier(t: number) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return { x: a * P0.x + b * P1.x + c * P2.x + d * P3.x, y: a * P0.y + b * P1.y + c * P2.y + d * P3.y };
}

const DOME_SAMPLES = Array.from({ length: 121 }, (_, i) => bezier(i / 120));

/** Half-width of the dome silhouette at a given height. */
function domeHalfWidth(y: number): number {
  for (let i = 1; i < DOME_SAMPLES.length; i++) {
    const a = DOME_SAMPLES[i - 1], b = DOME_SAMPLES[i];
    if (y <= a.y && y >= b.y) {
      const k = (a.y - y) / (a.y - b.y || 1);
      return 500 - (a.x + (b.x - a.x) * k);
    }
  }
  return 0;
}

interface Row {
  id: string;
  y: number;
  halfWidth: number;
  sag: number;
  maxFont: number;
  cities: string[];
  prominent?: boolean;
  opacity?: number;
}

const domeRow = (id: string, y: number, maxFont: number, cities: string[], extra: Partial<Row> = {}): Row => ({
  id,
  y,
  halfWidth: domeHalfWidth(y) * 0.9,
  sag: 10 + (y - 300) * 0.06,
  maxFont,
  cities,
  ...extra,
});

// A curated selection of Palestinian cities and towns (not an exhaustive list).
const ROWS: Row[] = [
  domeRow('d0', 336, 50, ['القدس'], { prominent: true, sag: 0 }),
  domeRow('d1', 374, 24, ['يافا', 'حيفا', 'عكا']),
  domeRow('d2', 407, 24, ['الناصرة', 'صفد', 'طبريا', 'بيسان']),
  domeRow('d3', 440, 24, ['غزة', 'الخليل', 'نابلس', 'رام الله', 'بيت لحم']),
  domeRow('d4', 474, 23, ['جنين', 'طولكرم', 'قلقيلية', 'أريحا', 'طوباس', 'سلفيت']),
  { id: 'drum', y: 561, halfWidth: 184, sag: 0, maxFont: 23, cities: ['رفح', 'خان يونس', 'دير البلح', 'بئر السبع', 'اللد', 'الرملة'] },
  { id: 'roof', y: 621, halfWidth: 222, sag: 0, maxFont: 18, cities: ['دورا', 'يطا', 'بيت جالا', 'بيت ساحور', 'البيرة', 'بيرزيت'], opacity: 0.85 },
  { id: 'frieze', y: 672, halfWidth: 232, sag: 0, maxFont: 20, cities: ['عسقلان', 'أسدود', 'المجدل', 'أم الفحم', 'شفاعمرو', 'جباليا', 'بيت حانون', 'حلحول'], opacity: 0.85 },
];

const rowPath = (r: Row) => `M ${500 - r.halfWidth} ${r.y} Q 500 ${r.y + r.sag * 2} ${500 + r.halfWidth} ${r.y}`;

const DOME_PATH = `M ${P0.x} ${P0.y} C ${P1.x} ${P1.y} ${P2.x} ${P2.y} ${P3.x} ${P3.y} C ${1000 - P2.x} ${P2.y} ${1000 - P1.x} ${P1.y} ${1000 - P0.x} ${P0.y} Z`;

function ribPath(offset: number) {
  // Meridian from the dome base to the apex, bowing outward proportionally to its offset.
  const x0 = 500 + offset;
  const c1x = 500 + offset * 1.02;
  const c2x = 500 + offset * 0.55;
  return `M ${x0} 500 C ${c1x} 380 ${c2x} 300 500 268`;
}

/** Architectural layer: dome outline, ribs, drum, octagonal arcade. Gold line-work on transparent. */
export const DomeStructure = memo(function DomeStructure() {
  const ribs = [-176, -132, -88, -44, 0, 44, 88, 132, 176];
  const arches = Array.from({ length: 9 }, (_, i) => 262 + i * 53);
  return (
    <svg viewBox="0 0 1000 1000" className="absolute inset-0 size-full" aria-hidden focusable="false">
      <defs>
        <radialGradient id="dome-glow" cx="50%" cy="48%" r="50%">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.28" />
          <stop offset="55%" stopColor={GOLD} stopOpacity="0.06" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="dome-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={GOLD_LIGHT} stopOpacity="0.34" />
          <stop offset="60%" stopColor={GOLD} stopOpacity="0.14" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id="ground-fade" x1="0" x2="1">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0" />
          <stop offset="50%" stopColor={GOLD} stopOpacity="0.9" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </linearGradient>
      </defs>

      <circle cx="500" cy="520" r="420" fill="url(#dome-glow)" />

      <g fill="none" stroke={GOLD} strokeLinecap="round" strokeLinejoin="round">
        {/* finial with crescent */}
        <line x1="500" y1="268" x2="500" y2="212" strokeWidth="3" />
        <circle cx="500" cy="238" r="6" fill={GOLD} stroke="none" />
        <path d="M 507 179 A 13 13 0 1 0 507 205 A 10 10 0 1 1 507 179 Z" fill={GOLD} stroke="none" />

        {/* dome */}
        <path d={DOME_PATH} fill="url(#dome-fill)" strokeWidth="3" />
        {ribs.map((o) => (
          <path key={o} d={ribPath(o)} strokeWidth="1.2" strokeOpacity="0.28" />
        ))}

        {/* cornice and drum */}
        <rect x="289" y="500" width="422" height="11" rx="3" strokeWidth="2.5" fill={GOLD} fillOpacity="0.12" />
        <rect x="300" y="511" width="400" height="78" strokeWidth="2.2" />
        {Array.from({ length: 10 }, (_, i) => 320 + i * 40).map((x) => (
          <line key={x} x1={x} y1="519" x2={x} y2="581" strokeWidth="1" strokeOpacity="0.18" />
        ))}

        {/* sloped roof of the octagonal arcade */}
        <path d="M 300 589 L 700 589 L 756 633 L 244 633 Z" strokeWidth="2.2" fill={GOLD} fillOpacity="0.05" />

        {/* octagonal base with frieze and arcade */}
        <rect x="250" y="633" width="500" height="178" strokeWidth="2.2" />
        <line x1="250" y1="690" x2="750" y2="690" strokeWidth="1.4" strokeOpacity="0.7" />
        <line x1="250" y1="697" x2="750" y2="697" strokeWidth="1" strokeOpacity="0.4" strokeDasharray="10 6" />
        {arches.map((x, i) =>
          i === 4 ? (
            <path key={x} d={`M ${x + 4} 811 L ${x + 4} 752 A 22 22 0 0 1 ${x + 48} 752 L ${x + 48} 811`} strokeWidth="2" />
          ) : (
            <path key={x} d={`M ${x + 10} 805 L ${x + 10} 742 A 16 16 0 0 1 ${x + 42} 742 L ${x + 42} 805`} strokeWidth="1.6" strokeOpacity="0.8" />
          ),
        )}
        <line x1="150" y1="812" x2="850" y2="812" stroke="url(#ground-fade)" strokeWidth="2" />
      </g>
    </svg>
  );
});

/** Typographic layer: Palestinian city names flowing along the dome's latitudes and frieze bands. */
export const DomeNames = memo(function DomeNames() {
  const svgRef = useRef<SVGSVGElement>(null);

  // One-time fit: scale each row's font so the names span their band without overflowing.
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
        if (!len) return;
        el.setAttribute('font-size', Math.min(max, (current * target) / len).toFixed(2));
      });
    };
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) fonts.ready.then(fit);
    else fit();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <svg ref={svgRef} viewBox="0 0 1000 1000" className="absolute inset-0 size-full" aria-hidden focusable="false">
      <defs>
        {ROWS.map((r) => (
          <path key={r.id} id={`city-row-${r.id}`} d={rowPath(r)} />
        ))}
        <linearGradient id="names-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F3E2B3" />
          <stop offset="100%" stopColor={GOLD} />
        </linearGradient>
      </defs>
      {ROWS.map((r) => {
        // Approximate arc length of the quadratic row path, used as the fitting target.
        const target = Math.hypot(r.halfWidth * 2, r.sag * 1.4) * (r.prominent ? 0.72 : 0.97);
        return (
          <text
            key={r.id}
            data-target={target.toFixed(1)}
            data-max={r.maxFont}
            fontFamily="Cairo, sans-serif"
            fontWeight={r.prominent ? 800 : 600}
            fontSize={r.maxFont}
            fill={r.prominent ? '#F6E7BE' : 'url(#names-gold)'}
            fillOpacity={r.opacity ?? 1}
            direction="rtl"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            <textPath href={`#city-row-${r.id}`} startOffset="50%">
              {r.cities.join('  ·  ')}
            </textPath>
          </text>
        );
      })}
    </svg>
  );
});
