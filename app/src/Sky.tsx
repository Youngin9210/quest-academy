// The world's background: color variables come from <body data-theme>, and
// floating particles from the theme. This is a component with no visible box of
// its own; it SYNCS React state to the page outside React with useEffect.
import { useEffect, useMemo, type CSSProperties } from 'react';
import { themeOf } from './content';

const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

export function Sky({ themeId }: { themeId: string }) {
  // useEffect runs AFTER React has drawn, and again whenever themeId changes.
  useEffect(() => {
    document.body.dataset.theme = themeId;
    const cs = getComputedStyle(document.body);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', cs.getPropertyValue('--bg1').trim() || '#0b1033');
    document.documentElement.style.background = cs.getPropertyValue('--bg2').trim() || '#0b1033';
  }, [themeId]);

  // useMemo keeps the same random particles until the world changes,
  // instead of new random positions on every re-draw.
  const particles = useMemo(() => {
    const items = themeOf(themeId).bgItems;
    return Array.from({ length: 45 }, (_, i) => ({
      key: i, char: items[rand(0, items.length - 1)],
      style: { left: `${rand(0, 100)}%`, top: `${rand(0, 100)}%`, fontSize: `${rand(8, 22)}px`, '--d': `${rand(3, 12)}s`, '--delay': `-${rand(0, 12)}s` } as CSSProperties,
    }));
  }, [themeId]);

  return <div id="sky" aria-hidden="true">{particles.map(p => <span key={p.key} style={p.style}>{p.char}</span>)}</div>;
}
