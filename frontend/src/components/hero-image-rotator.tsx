'use client';

import React, { useEffect, useState } from 'react';

/**
 * Hero visual - the building photos cycle with a horizontal scroll: the current
 * photo slides out to the left while the next one arrives from the right.
 *
 * The track holds the photos plus a duplicate of the first one. After the last
 * photo we slide onto that identical copy, then rewind to the start with the
 * transition off - because the frame at that moment is a pixel-identical
 * duplicate, the rewind is never visible and the loop reads as endless.
 */

const SLIDES = [
  {
    src: '/building-img.jpg',
    alt: 'Residential apartment building managed with OmniHome',
  },
  {
    src: '/building-img2.jpg',
    alt: 'Modern residential community building at dusk',
  },
  {
    src: '/building-img3.jpg',
    alt: 'Apartment tower with landscaped grounds',
  },
];

const DWELL_MS = 5000; // how long each photo stays on screen
const SLIDE_MS = 900; // how long the horizontal scroll takes

// Duplicate of the first slide, appended so the loop can wrap seamlessly.
const TRACK = [...SLIDES, SLIDES[0]];
const LAST = SLIDES.length; // index of the duplicate

export function HeroImageRotator() {
  const [pos, setPos] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [paused, setPaused] = useState(false);

  // Respect the OS "reduce motion" setting: swap instantly instead of sliding.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Don't burn cycles cycling a hero nobody is looking at.
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (reducedMotion || paused) return;
    const id = window.setInterval(() => setPos((p) => p + 1), DWELL_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion, paused]);

  // Reached the duplicate: rewind to the real first slide with the transition
  // off, so the wrap happens invisibly. Timer (not transitionend) so this also
  // works when the transition is disabled in reduced-motion mode.
  useEffect(() => {
    if (pos !== LAST) return;
    const delay = (reducedMotion ? 0 : SLIDE_MS) + 60;
    const id = window.setTimeout(() => {
      setAnimate(false);
      setPos(0);
    }, delay);
    return () => window.clearTimeout(id);
  }, [pos, reducedMotion]);

  // Re-arm the transition only after the rewound position has actually painted,
  // otherwise the browser would animate the rewind itself.
  useEffect(() => {
    if (animate) return;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimate(true));
    });
    return () => cancelAnimationFrame(raf);
  }, [animate]);

  const duration = animate && !reducedMotion ? SLIDE_MS : 0;

  return (
    <div className="relative aspect-[4/3] overflow-hidden">
      <div
        className="flex h-full"
        style={{
          transform: `translateX(-${pos * 100}%)`,
          transition: duration
            ? `transform ${duration}ms cubic-bezier(0.65, 0, 0.35, 1)`
            : 'none',
        }}
      >
        {TRACK.map((slide, i) => (
          <div key={`${slide.src}-${i}`} className="relative w-full h-full flex-none">
            <img
              src={slide.src}
              alt={i < SLIDES.length ? slide.alt : ''}
              aria-hidden={i >= SLIDES.length}
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
