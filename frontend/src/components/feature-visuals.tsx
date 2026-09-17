'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  BellRing, CalendarCheck, Check, CheckCheck, Clock, Image as ImageIcon,
  QrCode, ScanLine, Star, Timer, TrendingUp, Waves, Wrench,
} from 'lucide-react';

/**
 * The mock product surfaces in the landing page's feature rows.
 *
 * One shared vocabulary keeps the four panels feeling like one product:
 *  - every panel opens with a live header (pulse dot + label + a status chip on
 *    the right) and ends with a footer line that carries the product promise;
 *  - rows are `min-w-0 flex-1` so they never blow out on a narrow phone;
 *  - everything reveals **once**, on first scroll into view, and the count-up has
 *    a timeout safety net so a stalled frame loop can never leave a number at zero;
 *  - all motion is skipped under `prefers-reduced-motion`.
 *
 * Mock numbers are internally consistent (2 of 4 units paid at Rs 12,500 each is
 * Rs 25,000) - these panels sit next to marketing copy, so wrong arithmetic is a
 * credibility tax.
 */

// ── Motion plumbing ────────────────────────────────────────────────────────

const EASE_OUT_CUBIC = (t: number) => 1 - Math.pow(1 - t, 3);

function useReveal(threshold = 0.25) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  // Resolved in the effect, never during render, so server and client agree.
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReducedMotion(prefersReduced);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        setInView(true);
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView, reducedMotion };
}

/** Eased count-up that always terminates on `target`. */
function useCountUp(target: number, active: boolean, reducedMotion: boolean, duration = 1100) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;

    if (reducedMotion) {
      setValue(target);
      return;
    }

    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * EASE_OUT_CUBIC(t)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    // Safety net: if frames stall (throttled tab, low-power device), still land
    // on the real figure rather than freezing it part-way or at zero.
    const settle = window.setTimeout(() => setValue(target), duration + 200);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, [active, target, duration, reducedMotion]);

  return value;
}

// ── Shared pieces ──────────────────────────────────────────────────────────

type Tone = 'accent' | 'amber' | 'slate' | 'green';

const TONE_PILL: Record<Tone, string> = {
  accent: 'text-accent-700 bg-accent-50 ring-accent-100',
  amber: 'text-amber-700 bg-amber-50 ring-amber-100',
  slate: 'text-gray-600 bg-gray-50 ring-gray-200',
  green: 'text-emerald-700 bg-emerald-50 ring-emerald-100',
};

const TONE_DOT: Record<Tone, string> = {
  accent: 'bg-accent-500',
  amber: 'bg-amber-500',
  slate: 'bg-gray-400',
  green: 'bg-emerald-500',
};

function PulseDot({ tone = 'accent' }: { tone?: Tone }) {
  return (
    <span className="relative flex w-2 h-2 flex-shrink-0" aria-hidden="true">
      <span className={`absolute inline-flex w-full h-full rounded-full opacity-70 animate-ping ${TONE_DOT[tone]}`} />
      <span className={`relative inline-flex w-2 h-2 rounded-full ${TONE_DOT[tone]}`} />
    </span>
  );
}

function Pill({ tone, className = '', children }: { tone: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center justify-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ring-1 ${TONE_PILL[tone]} ${className}`}>
      {children}
    </span>
  );
}

function PanelHeader({
  label,
  sub,
  chip,
  right,
}: {
  label: string;
  sub: string;
  chip?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <PulseDot />
      <div className="min-w-0">
        <p className="text-caption-xs font-semibold uppercase tracking-[0.14em] text-gray-900 truncate">{label}</p>
        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</p>
      </div>
      <div className="ml-auto flex-shrink-0">{right ?? chip}</div>
    </div>
  );
}

/** A white toast that straddles the panel's top edge - that overlap is what
 *  makes the mock read as a live screen rather than a flat card. */
function FloatingChip({ inView, children }: { inView: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`absolute -top-8 -right-3 z-20 flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 ring-1 ring-gray-900/[0.06] shadow-[0_10px_26px_-14px_rgba(15,23,42,0.45)] backdrop-blur transition-all duration-700 ease-out motion-reduce:transition-none ${
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      {children}
    </div>
  );
}

function RowShell({
  inView,
  index,
  baseDelay = 280,
  className = '',
  style,
  children,
}: {
  inView: boolean;
  index: number;
  baseDelay?: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`group/row flex items-center gap-2.5 rounded-xl px-2 py-2 -mx-2 ring-1 ring-transparent transition-all duration-500 ease-out hover:bg-[#f7f9fe] hover:ring-gray-900/[0.04] motion-reduce:transition-none ${className}`}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(8px)',
        transitionDelay: `${baseDelay + index * 90}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Gradient figure used as each panel's headline number. */
function BigFigure({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display font-extrabold tracking-tight text-[1.75rem] leading-none bg-gradient-to-br from-gray-900 via-[#1e3a8a] to-accent-600 bg-clip-text text-transparent tabular-nums">
      {children}
    </span>
  );
}

function FooterNote({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="mt-4 pt-3.5 border-t border-gray-100 flex items-center gap-2 text-[10px] text-gray-500">
      <Icon className="w-3 h-3 text-accent-500 flex-shrink-0" />
      <span className="truncate">{children}</span>
    </div>
  );
}

// ── 01 · Payments ──────────────────────────────────────────────────────────

export function PaymentsShowcase() {
  const { ref, inView, reducedMotion } = useReveal();

  const BILLED = 50000;
  const COLLECTED = 25000;
  const pct = Math.round((COLLECTED / BILLED) * 100);
  const collected = useCountUp(COLLECTED, inView, reducedMotion);

  const ringRadius = 15.5;
  const ringCircumference = 2 * Math.PI * ringRadius;

  const rows = [
    { unit: '101', amount: 12500, status: 'Paid', tone: 'accent' as Tone, note: 'Paid 2 days ago' },
    { unit: '102', amount: 12500, status: 'Overdue', tone: 'amber' as Tone, note: 'Reminder sent' },
    { unit: '103', amount: 12500, status: 'Paid', tone: 'accent' as Tone, note: 'Paid today' },
    { unit: '104', amount: 12500, status: 'Pending', tone: 'slate' as Tone, note: 'Due in 5 days' },
  ];

  const money = (n: number) => n.toLocaleString('en-US');

  return (
    <div ref={ref} className="relative">
      <FloatingChip inView={inView}>
        <span className="w-5 h-5 rounded-full bg-gradient-to-b from-accent-500 to-accent-600 flex items-center justify-center flex-shrink-0 shadow-[0_4px_10px_-4px_rgba(37,99,235,0.9)]">
          <Check className="w-3 h-3 text-white" />
        </span>
        <span className="leading-none">
          <span className="block text-[10px] font-semibold text-gray-900">Payment received</span>
          <span className="block text-[10px] text-gray-500 tabular-nums mt-0.5">Unit 103 · Rs 12,500</span>
        </span>
      </FloatingChip>

      <PanelHeader
        label="September collection"
        sub="4 units billed · auto-generated"
        right={
          <div className="relative w-11 h-11">
            <svg viewBox="0 0 40 40" className="w-11 h-11 -rotate-90">
              <defs>
                <linearGradient id="payRing" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
              </defs>
              <circle cx="20" cy="20" r={ringRadius} fill="none" stroke="#e8eef9" strokeWidth="3.5" />
              <circle
                cx="20"
                cy="20"
                r={ringRadius}
                fill="none"
                stroke="url(#payRing)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={inView ? ringCircumference * (1 - pct / 100) : ringCircumference}
                className="transition-[stroke-dashoffset] duration-[1400ms] ease-out motion-reduce:transition-none"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-accent-700 tabular-nums">
              {pct}%
            </span>
          </div>
        }
      />

      <div className="flex items-end gap-2 flex-wrap">
        <BigFigure>Rs {money(collected)}</BigFigure>
        <span className="text-caption-xs text-gray-400 pb-0.5">of Rs {money(BILLED)}</span>
        <Pill tone="accent" className="ml-auto">
          <TrendingUp className="w-3 h-3" />
          2 paid this week
        </Pill>
      </div>

      {/* Collection rail */}
      <div className="relative mt-4 h-2 rounded-full bg-[#eef2f9] ring-1 ring-inset ring-[#e2e8f4] overflow-hidden">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent-600 via-accent-500 to-accent-400 transition-[width] duration-[1200ms] ease-out motion-reduce:transition-none"
          style={{ width: inView ? `${pct}%` : '0%' }}
        >
          {!reducedMotion && (
            <span className="absolute inset-0 overflow-hidden rounded-full">
              <span className="absolute inset-y-0 w-8 bg-white/45 blur-[3px] animate-shimmer" />
            </span>
          )}
        </span>
      </div>

      <div className="mt-5 space-y-1.5">
        {rows.map((row, i) => (
          <RowShell key={row.unit} inView={inView} index={i}>
            <span className="w-7 h-7 rounded-[0.55rem] bg-gradient-to-b from-[#eff4fd] to-[#e2eafa] ring-1 ring-[#d8e3f6] flex items-center justify-center text-[10px] font-bold text-accent-700 flex-shrink-0">
              {row.unit.slice(-2)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body-sm font-medium text-gray-900 leading-tight truncate">Unit {row.unit}</span>
              <span className="block text-[10px] text-gray-400 mt-0.5 truncate">{row.note}</span>
            </span>
            <span className="text-body-sm text-gray-700 tabular-nums flex-shrink-0">Rs {money(row.amount)}</span>
            <Pill tone={row.tone} className="w-[4.5rem] flex-shrink-0">{row.status}</Pill>
          </RowShell>
        ))}
      </div>

      <FooterNote icon={BellRing}>Reminders sent automatically on the 5th and 15th</FooterNote>
    </div>
  );
}

// ── 02 · Maintenance ───────────────────────────────────────────────────────

export function MaintenanceShowcase() {
  const { ref, inView, reducedMotion } = useReveal();

  const OPEN = 12;
  const RESOLVED = 10;
  const resolved = useCountUp(RESOLVED, inView, reducedMotion, 900);
  const resolutionPct = Math.round((RESOLVED / OPEN) * 100);

  const tickets = [
    {
      title: 'AC not cooling',
      unit: 'Unit 105',
      meta: 'Assigned to Bilal · Due in 4h',
      status: 'Open',
      tone: 'amber' as Tone,
      urgent: true,
      photo: false,
    },
    {
      title: 'Leaking faucet',
      unit: 'Unit 201',
      meta: 'In progress since 09:12',
      status: 'In progress',
      tone: 'accent' as Tone,
      urgent: false,
      photo: false,
    },
    {
      title: 'Light fixture broken',
      unit: 'Unit 304',
      meta: 'Closed by admin · Yesterday',
      status: 'Resolved',
      tone: 'green' as Tone,
      urgent: false,
      photo: true,
    },
  ];

  return (
    <div ref={ref} className="relative">
      <PanelHeader
        label="Service desk"
        sub="12 tickets this month"
        right={
          <Pill tone="accent">
            <CheckCheck className="w-3 h-3" />
            {resolutionPct}% resolved
          </Pill>
        }
      />

      <div className="flex items-end gap-2 flex-wrap">
        <BigFigure>{resolved}</BigFigure>
        <span className="text-caption-xs text-gray-400 pb-0.5">of {OPEN} closed</span>
        <Pill tone="green" className="ml-auto">
          <Timer className="w-3 h-3" />
          Avg 1.8 days
        </Pill>
      </div>

      {/* Resolution rail */}
      <div className="relative mt-4 h-2 rounded-full bg-[#eef2f9] ring-1 ring-inset ring-[#e2e8f4] overflow-hidden">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent-600 via-accent-500 to-accent-400 transition-[width] duration-[1200ms] ease-out motion-reduce:transition-none"
          style={{ width: inView ? `${resolutionPct}%` : '0%' }}
        >
          {!reducedMotion && (
            <span className="absolute inset-0 overflow-hidden rounded-full">
              <span className="absolute inset-y-0 w-8 bg-white/45 blur-[3px] animate-shimmer" />
            </span>
          )}
        </span>
      </div>

      <div className="mt-5 space-y-1.5">
        {tickets.map((ticket, i) => (
          <RowShell key={ticket.title} inView={inView} index={i}>
            {/* Status rail down the leading edge - reads like a ticket in a queue */}
            <span
              className={`w-1 self-stretch rounded-full flex-shrink-0 ${TONE_DOT[ticket.tone]} ${ticket.urgent ? 'opacity-90' : 'opacity-40'}`}
              aria-hidden="true"
            />
            <span className="w-6 h-6 rounded-lg bg-[#f2f5fb] ring-1 ring-[#e5eaf3] flex items-center justify-center flex-shrink-0">
              <Wrench className="w-3 h-3 text-accent-600" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="text-body-sm font-medium text-gray-900 leading-tight truncate">{ticket.title}</span>
                {ticket.urgent && (
                  <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-1 rounded">
                    Urgent
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-gray-400 truncate">{ticket.unit} · {ticket.meta}</span>
                {ticket.photo && (
                  <span className="flex items-center gap-0.5 text-[10px] text-accent-600 flex-shrink-0">
                    <ImageIcon className="w-2.5 h-2.5" />1
                  </span>
                )}
              </span>
            </span>
            <Pill tone={ticket.tone} className="w-[4.75rem] flex-shrink-0">{ticket.status}</Pill>
          </RowShell>
        ))}
      </div>

      <FooterNote icon={Clock}>Photo updates land on the resident&apos;s ticket instantly</FooterNote>
    </div>
  );
}

// ── 03 · Visitors ──────────────────────────────────────────────────────────

const QR_MODULES = 21;

/**
 * A stable pseudo-QR: three finder squares plus a hashed module fill. It is
 * decoration, not a scannable code - but a real-looking pattern is what sells
 * the "scan at the gate" story.
 */
function qrModuleOn(row: number, col: number): boolean {
  const inBox = (r0: number, c0: number) => row >= r0 && row < r0 + 7 && col >= c0 && col < c0 + 7;
  const finder = (r0: number, c0: number) => {
    const r = row - r0;
    const c = col - c0;
    const onRing = r === 0 || r === 6 || c === 0 || c === 6;
    const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
    return onRing || inCore;
  };

  if (inBox(0, 0)) return finder(0, 0);
  if (inBox(0, QR_MODULES - 7)) return finder(0, QR_MODULES - 7);
  if (inBox(QR_MODULES - 7, 0)) return finder(QR_MODULES - 7, 0);

  // Separator columns/rows around the finders stay clear, like a real code.
  const nearBox =
    (row < 8 && col < 8) || (row < 8 && col >= QR_MODULES - 8) || (row >= QR_MODULES - 8 && col < 8);
  if (nearBox) return false;

  return ((row * 31 + col * 17 + row * col * 7) % 5) < 2;
}

export function VisitorsShowcase() {
  const { ref, inView, reducedMotion } = useReveal();

  return (
    <div ref={ref} className="relative">
      <FloatingChip inView={inView}>
        <span className="w-5 h-5 rounded-full bg-gradient-to-b from-accent-500 to-accent-600 flex items-center justify-center flex-shrink-0">
          <ScanLine className="w-3 h-3 text-white" />
        </span>
        <span className="leading-none">
          <span className="block text-[10px] font-semibold text-gray-900">Scanned at Gate 2</span>
          <span className="block text-[10px] text-gray-500 tabular-nums mt-0.5">Ahmed Raza · 09:42</span>
        </span>
      </FloatingChip>

      {/* The pass itself - a perforated stub, like something you'd hold */}
      <div className="relative overflow-hidden rounded-2xl ring-1 ring-gray-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.05),0_16px_32px_-20px_rgba(15,23,42,0.3)]">
        <div className="bg-gradient-to-br from-accent-50 via-white to-white p-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-b from-white to-[#e6eefc] ring-1 ring-[#cfe0f9] flex items-center justify-center flex-shrink-0">
              <QrCode className="w-4.5 h-4.5 text-accent-700" />
            </span>
            <div className="min-w-0">
              <p className="text-body-sm font-semibold text-gray-900 leading-tight truncate">Visitor Pass</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Valid for today · expires in 4h</p>
            </div>
            <span className="ml-auto flex-shrink-0 inline-flex items-center gap-1.5 text-[10px] font-semibold text-accent-700 bg-accent-50 ring-1 ring-accent-100 px-2 py-1 rounded-full">
              <PulseDot />
              Active
            </span>
          </div>

          {/* Code plate with a scanning sweep */}
          <div className="relative mt-3.5 mx-auto w-[8.5rem] h-[8.5rem] rounded-2xl bg-white ring-1 ring-[#e0e8f5] p-2.5 overflow-hidden shadow-[0_10px_24px_-18px_rgba(15,23,42,0.5)]">
            <svg viewBox={`0 0 ${QR_MODULES} ${QR_MODULES}`} className="w-full h-full" role="img" aria-label="Visitor pass QR code">
              {Array.from({ length: QR_MODULES * QR_MODULES }).map((_, i) => {
                const row = Math.floor(i / QR_MODULES);
                const col = i % QR_MODULES;
                if (!qrModuleOn(row, col)) return null;
                return <rect key={i} x={col} y={row} width="1" height="1" rx="0.18" fill="#0f172a" />;
              })}
            </svg>

            {!reducedMotion && (
              <>
                <span className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-accent-400/0 via-accent-400/30 to-accent-400/0 animate-scan" aria-hidden="true" />
                <span className="pointer-events-none absolute inset-x-2 h-px bg-accent-500/80 shadow-[0_0_10px_2px_rgba(59,130,246,0.5)] animate-scan" aria-hidden="true" />
              </>
            )}
          </div>
        </div>

        {/* Perforation - the stub tear line */}
        <div className="relative h-4" aria-hidden="true">
          <span className="absolute inset-x-4 top-1/2 border-t border-dashed border-gray-200" />
          <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#f2f5fb]" />
          <span className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#f2f5fb]" />
        </div>

        <div className="px-4 pb-4 pt-1 space-y-1.5 text-caption-xs">
          {[
            { label: 'Visitor', value: 'Ahmed Raza' },
            { label: 'Unit', value: 'Unit 201' },
            { label: 'Purpose', value: 'Family visit' },
            { label: 'Checked in', value: '09:42 · Gate 2' },
          ].map((row) => (
            <div key={row.label} className="flex justify-between items-baseline gap-3">
              <span className="text-gray-500 flex-shrink-0">{row.label}</span>
              <span className="text-gray-900 font-medium truncate">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      <FooterNote icon={Check}>Auto-expires at midnight - no follow-up needed</FooterNote>
    </div>
  );
}

// ── 04 · Amenities ─────────────────────────────────────────────────────────

const BUSY_DAYS = new Set([3, 4, 5, 6, 11, 12, 18, 19, 20, 25, 26, 27]);
const TODAY = 17;

export function AmenitiesShowcase() {
  const { ref, inView, reducedMotion } = useReveal();

  const SLOTS = 40;
  const BOOKED = 33;
  const bookedPct = Math.round((BOOKED / SLOTS) * 100);
  const booked = useCountUp(BOOKED, inView, reducedMotion, 900);

  // September 2026 starts on a Tuesday - 2 leading blanks before the 1st.
  const cells: (number | null)[] = [
    null, null,
    ...Array.from({ length: 30 }, (_, i) => i + 1),
  ];

  const amenities = [
    { name: 'Clubhouse', slot: '09:00 – 11:00', status: 'Booked', tone: 'accent' as Tone, used: 8, capacity: 8 },
    { name: 'Tennis Court', slot: '13:00 – 15:00', status: 'Booked', tone: 'accent' as Tone, used: 4, capacity: 4 },
    { name: 'Swimming Pool', slot: '17:00 – 19:00', status: 'Available', tone: 'green' as Tone, used: 2, capacity: 8 },
  ];

  return (
    <div ref={ref} className="relative">
      <PanelHeader
        label="September bookings"
        sub="4 facilities · conflict-checked"
        right={
          <Pill tone="accent">
            <CalendarCheck className="w-3 h-3" />
            {bookedPct}% booked
          </Pill>
        }
      />

      {/* Month grid - tinted where the day is filling up */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="text-center text-[9px] font-semibold uppercase tracking-wider text-gray-400">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <span key={`blank-${i}`} />;
          const isToday = day === TODAY;
          const busy = BUSY_DAYS.has(day);
          return (
            <span
              key={day}
              className={`relative flex items-center justify-center h-6 rounded-md text-[10px] font-medium tabular-nums transition-all duration-300 motion-reduce:transition-none ${
                isToday
                  ? 'bg-gradient-to-b from-accent-500 to-accent-600 text-white shadow-[0_6px_14px_-8px_rgba(37,99,235,1)]'
                  : busy
                    ? 'bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-100'
                    : 'text-gray-500 hover:bg-[#f6f8fd]'
              }`}
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? 'scale(1)' : 'scale(0.86)',
                transitionDelay: `${140 + i * 12}ms`,
              }}
            >
              {day}
              {busy && !isToday && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-accent-400" aria-hidden="true" />
              )}
            </span>
          );
        })}
      </div>

      {/* Slot ledger with occupancy bars */}
      <div className="mt-5 space-y-1.5">
        {amenities.map((a, i) => (
          <RowShell key={a.name} inView={inView} index={i} className="items-start py-2.5">
            <span className="w-6 h-6 mt-0.5 rounded-lg bg-[#f2f5fb] ring-1 ring-[#e5eaf3] flex items-center justify-center flex-shrink-0">
              {a.name === 'Swimming Pool' ? (
                <Waves className="w-3 h-3 text-accent-600" />
              ) : (
                <Star className="w-3 h-3 text-accent-600" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body-sm font-medium text-gray-900 leading-tight truncate">{a.name}</span>
              <span className="block text-[10px] text-gray-400 mt-0.5 truncate">{a.slot}</span>
              {/* Occupancy bar */}
              <span className="mt-1.5 flex items-center gap-1.5">
                <span className="relative h-1 flex-1 rounded-full bg-[#eef2f9] overflow-hidden">
                  <span
                    className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none ${
                      a.used === a.capacity ? 'bg-gradient-to-r from-accent-500 to-accent-600' : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                    }`}
                    style={{ width: inView ? `${Math.round((a.used / a.capacity) * 100)}%` : '0%', transitionDelay: `${360 + i * 90}ms` }}
                  />
                </span>
                <span className="text-[9px] text-gray-400 tabular-nums flex-shrink-0">
                  {a.used}/{a.capacity}
                </span>
              </span>
            </span>
            <Pill tone={a.tone} className="w-[4.75rem] flex-shrink-0 mt-0.5">{a.status}</Pill>
          </RowShell>
        ))}
      </div>

      <div className="mt-4 pt-3.5 border-t border-gray-100 flex items-center gap-2 text-[10px] text-gray-500">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" aria-hidden="true" />
        {SLOTS - booked} slots still open this month
      </div>
    </div>
  );
}
