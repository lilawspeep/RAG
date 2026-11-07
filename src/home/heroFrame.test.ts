import { describe, expect, it } from 'vitest';
import { heroFrame } from './Hero';

const scaleOf = (transform: string) => Number(/scale\(([\d.]+)\)/.exec(transform)?.[1]);

describe('hero scroll mapping', () => {
  it('starts with the full name-dome and no logo', () => {
    const f = heroFrame(0);
    expect(f.namesOpacity).toBe(1);
    expect(f.structureOpacity).toBe(1);
    expect(f.logoOpacity).toBe(0);
    expect(f.introOpacity).toBe(1);
  });

  it('ends with the dome scaled down, names gone and the logo fully revealed', () => {
    const f = heroFrame(1);
    expect(f.namesOpacity).toBe(0);
    expect(f.structureOpacity).toBe(0);
    expect(f.logoOpacity).toBe(1);
    expect(f.logoScale).toBeCloseTo(1);
    expect(scaleOf(f.artTransform)).toBeLessThan(scaleOf(heroFrame(0).artTransform));
  });

  it('is a pure function of progress, so scrolling back up reverses it exactly', () => {
    for (const p of [0.1, 0.3, 0.5, 0.65, 0.8]) {
      expect(heroFrame(p)).toEqual(heroFrame(p));
    }
    const forward = [0, 0.25, 0.5, 0.75, 1].map(heroFrame);
    const backward = [1, 0.75, 0.5, 0.25, 0].map(heroFrame).reverse();
    expect(backward).toEqual(forward);
  });

  it('changes monotonically: names fade out while the logo fades in', () => {
    let prev = heroFrame(0);
    for (let i = 1; i <= 50; i++) {
      const f = heroFrame(i / 50);
      expect(f.namesOpacity).toBeLessThanOrEqual(prev.namesOpacity + 1e-9);
      expect(f.logoOpacity).toBeGreaterThanOrEqual(prev.logoOpacity - 1e-9);
      expect(scaleOf(f.artTransform)).toBeLessThanOrEqual(scaleOf(prev.artTransform) + 1e-9);
      prev = f;
    }
  });

  it('clamps progress outside 0..1', () => {
    expect(heroFrame(-1)).toEqual(heroFrame(0));
    expect(heroFrame(2)).toEqual(heroFrame(1));
  });
});
