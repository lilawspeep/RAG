import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import logo from '../assets/alquds-logo.png';
import { DOME_GEOMETRY as G, DomeNames, DomeStructure } from './DomeArt';

/** Displayed emblem width as a fraction of the art stage. */
const LOGO_RATIO = 0.6;
const START_SCALE = 1;
// Scale/offset that place the illustrated dome exactly over the emblem's dome.
const END_SCALE = ((G.logo.domeWidth / G.logo.width) * LOGO_RATIO) / (G.domeWidth / G.viewBox);
const END_DX = ((G.logo.domeBase.x - G.logo.width / 2) / G.logo.width) * LOGO_RATIO * 100;
const END_DY =
  (((G.logo.domeBase.y - G.logo.height / 2) / G.logo.width) * LOGO_RATIO -
    ((G.domeBase.y - G.viewBox / 2) / G.viewBox) * END_SCALE) *
  100;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const ease = (t: number) => t * t * (3 - 2 * t);

export interface HeroFrame {
  artTransform: string;
  namesOpacity: number;
  structureOpacity: number;
  logoOpacity: number;
  logoScale: number;
  introOpacity: number;
}

/** Pure mapping from scroll progress (0..1) to layer styles; reversible by construction. */
export function heroFrame(p: number): HeroFrame {
  const move = ease(seg(p, 0, 0.6));
  const scale = START_SCALE + (END_SCALE - START_SCALE) * move;
  return {
    artTransform: `translate3d(${(END_DX * move).toFixed(3)}%, ${(END_DY * move).toFixed(3)}%, 0) scale(${scale.toFixed(4)})`,
    namesOpacity: (1 - 0.65 * ease(seg(p, 0.05, 0.45))) * (1 - ease(seg(p, 0.45, 0.72))),
    structureOpacity: 1 - ease(seg(p, 0.58, 0.82)),
    logoOpacity: ease(seg(p, 0.48, 0.78)),
    logoScale: 1.05 - 0.05 * ease(seg(p, 0.48, 0.85)),
    introOpacity: 1 - ease(seg(p, 0, 0.18)),
  };
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

export function Hero() {
  const { t, dir } = useI18n();
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const namesRef = useRef<HTMLDivElement>(null);
  const structureRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced) return;
    const section = sectionRef.current;
    if (!section) return;
    let frame = 0;
    let last = -1;

    const apply = () => {
      frame = 0;
      const total = section.offsetHeight - window.innerHeight;
      const p = total > 0 ? clamp01(-section.getBoundingClientRect().top / total) : 0;
      if (Math.abs(p - last) < 0.0005) return;
      last = p;
      const f = heroFrame(p);
      artRef.current!.style.transform = f.artTransform;
      namesRef.current!.style.opacity = f.namesOpacity.toFixed(3);
      structureRef.current!.style.opacity = f.structureOpacity.toFixed(3);
      logoRef.current!.style.opacity = f.logoOpacity.toFixed(3);
      logoRef.current!.style.transform = `scale(${f.logoScale.toFixed(4)})`;
      logoRef.current!.style.visibility = f.logoOpacity > 0.001 ? 'visible' : 'hidden';
      introRef.current!.style.opacity = f.introOpacity.toFixed(3);
      cueRef.current!.style.opacity = f.introOpacity.toFixed(3);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [reduced]);

  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const initial = heroFrame(0);

  return (
    <section
      id="hero"
      ref={sectionRef}
      aria-labelledby="hero-title"
      className={`relative -mt-16 bg-navy text-white ${reduced ? '' : 'h-[230svh]'}`}
    >
      <div className={`${reduced ? 'relative min-h-svh' : 'sticky top-0 h-svh'} overflow-hidden`}>
        <HeroBackdrop />

        <div className="relative mx-auto grid h-full max-w-7xl content-center justify-items-center px-4 pt-16 pb-6 text-center [--stage:min(66svh,94vw,780px)] [grid-template-areas:'eyebrow'_'art'_'text'] lg:grid-cols-[minmax(0,1fr)_auto] lg:content-center lg:items-center lg:gap-x-10 lg:px-8 lg:text-start lg:[--stage:min(84svh,50vw,820px)] lg:[grid-template-areas:'eyebrow_art'_'text_art'] lg:[grid-template-rows:auto_auto]">
          <div
            ref={introRef}
            className="flex items-center gap-3 [grid-area:eyebrow] lg:self-end lg:justify-self-start"
            style={{ opacity: reduced ? 1 : initial.introOpacity }}
          >
            <span className="h-px w-8 bg-gold/60" aria-hidden />
            <p className="text-sm font-bold tracking-wide text-gold-light sm:text-base">{t.hero.eyebrow}</p>
            <span className="h-px w-8 bg-gold/60" aria-hidden />
          </div>

          <div
            role="img"
            aria-label={t.hero.artLabel}
            className="relative mt-[calc(var(--stage)*-0.14)] mb-[calc(var(--stage)*-0.15)] aspect-square w-(--stage) shrink-0 [grid-area:art] lg:-my-[calc(var(--stage)*0.06)]"
          >
            <div
              ref={artRef}
              className="absolute inset-0 will-change-transform"
              style={{ transform: reduced ? 'none' : initial.artTransform }}
            >
              <div ref={structureRef} className="absolute inset-0 will-change-[opacity]">
                <DomeStructure />
              </div>
              <div ref={namesRef} className="absolute inset-0 will-change-[opacity]">
                <DomeNames />
              </div>
            </div>

            {!reduced && (
              <div
                ref={logoRef}
                className="absolute inset-0 grid place-items-center will-change-[opacity,transform]"
                style={{ opacity: 0, visibility: 'hidden' }}
              >
                <LogoPlate />
              </div>
            )}
          </div>

          <div className="relative max-w-3xl [grid-area:text] lg:self-start lg:pt-4">
            {reduced && (
              <div className="mx-auto mb-3 grid size-20 place-items-center lg:mx-0">
                <div className="relative size-20">
                  <LogoPlate />
                </div>
              </div>
            )}
            <h1 id="hero-title" className="text-2xl leading-snug font-extrabold text-balance text-white sm:text-4xl lg:text-[2.75rem] lg:leading-tight xl:text-5xl">
              {t.hero.title}
            </h1>
            <p className="mt-1.5 text-xs font-medium text-gold-light/80 sm:text-sm lg:mt-3 lg:text-end lg:text-base" lang={dir === 'rtl' ? 'en' : 'ar'} dir={dir === 'rtl' ? 'ltr' : 'rtl'}>
              {t.hero.secondaryTitle}
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-lg lg:mx-0 lg:mt-5">{t.hero.subtitle}</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 lg:mt-8 lg:justify-start">
              <Link to="/register" className="btn-gold px-6 py-3 text-base">
                {t.hero.ctaStart}
                <Arrow className="size-4" aria-hidden />
              </Link>
              <Link to="/syllabus" className="btn border border-white/25 px-6 py-3 text-base text-white hover:border-gold hover:bg-white/5">
                {t.hero.ctaSyllabus}
              </Link>
            </div>
          </div>
        </div>

        {!reduced && (
          <div ref={cueRef} className="pointer-events-none absolute inset-x-0 bottom-3 hidden flex-col items-center text-white/50 [@media(min-height:960px)]:sm:flex" aria-hidden>
            <span className="text-xs">{t.hero.scrollHint}</span>
            <ChevronDown className="size-4 animate-bounce" />
          </div>
        )}
      </div>
    </section>
  );
}

/** Official emblem on a warm-white octagonal plate (the PNG's interior is transparent). */
function LogoPlate() {
  const { t } = useI18n();
  const octagon = 'polygon(29.3% 0, 70.7% 0, 100% 29.3%, 100% 70.7%, 70.7% 100%, 29.3% 100%, 0 70.7%, 0 29.3%)';
  return (
    <div className="relative grid place-items-center" style={{ width: `${LOGO_RATIO * 112}%`, aspectRatio: '1' }}>
      <div className="absolute inset-0 bg-gold" style={{ clipPath: octagon }} aria-hidden />
      <div className="absolute inset-[1.2%] bg-warm" style={{ clipPath: octagon }} aria-hidden />
      <img
        src={logo}
        alt={t.hero.logoAlt}
        width={G.logo.width}
        height={G.logo.height}
        decoding="async"
        className="relative h-auto"
        style={{ width: `${100 / 1.12}%` }}
      />
    </div>
  );
}

const HeroBackdrop = () => (
  <div aria-hidden className="pointer-events-none absolute inset-0">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,#1d4f80_0%,#143458_38%,#102a43_72%)]" />
    <div
      className="absolute inset-0 opacity-[0.07]"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cpath d='M24 4 L44 24 L24 44 L4 24 Z' fill='none' stroke='%23C5A45D' stroke-width='1'/%3E%3Cpath d='M24 16 L32 24 L24 32 L16 24 Z' fill='%23C5A45D'/%3E%3C/svg%3E\")",
      }}
    />
    <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-navy to-transparent" />
  </div>
);
