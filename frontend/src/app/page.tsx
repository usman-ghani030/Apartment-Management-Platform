'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, CreditCard, CalendarRange,
  Users, QrCode, BarChart3, Lock,
  Folder, MessageCircle,
  CheckCircle, ChevronDown, ArrowRight,
  Wrench, Star, Check, Quote, BadgeCheck, Search,
  Facebook, Twitter, Instagram, Linkedin, Sparkles,
  LayoutDashboard,
} from 'lucide-react';
import { auth, getAuthToken } from '@/lib/api';
import { HeroImageRotator } from '@/components/hero-image-rotator';
import {
  AmenitiesShowcase,
  MaintenanceShowcase,
  PaymentsShowcase,
  VisitorsShowcase,
} from '@/components/feature-visuals';


// ── ScrollReveal ──────────────────────────────────────────────────────────
function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.unobserve(entry.target); } },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ── Feature Row (alternating editorial layout, one blue discipline) ────────
function FeatureRow({
  index,
  icon: Icon,
  label,
  headline,
  description,
  bullets,
  visual,
}: {
  index: number;
  icon: React.ElementType;
  label: string;
  headline: string;
  description: string;
  bullets: string[];
  visual: React.ReactNode;
}) {
  const isReversed = index % 2 === 1;

  const content = (
    <>
      {/* Editorial eyebrow: numbered module label */}
      <p className="flex items-center gap-3 text-caption-xs font-semibold text-accent-600 uppercase tracking-widest mb-4">
        <span className="font-display text-title text-[#93c5fd] font-bold tracking-normal" aria-hidden="true">0{index + 1}</span>
        <span className="w-6 h-px bg-accent-300" aria-hidden="true" />
        {label}
      </p>

      {/* Headline */}
      <h3 className="text-display-sm lg:text-display font-display text-gray-900 mb-4 leading-tight tracking-tight">{headline}</h3>

      {/* Description */}
      <p className="text-body text-gray-700 mb-6 leading-relaxed max-w-md">{description}</p>

      {/* Bullet list - quiet check chips */}
      <ul className="space-y-2.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2.5 text-body-sm text-gray-700">
            <span className="mt-0.5 w-4 h-4 rounded-full bg-accent-50 border border-accent-100 flex items-center justify-center flex-shrink-0">
              <Check className="w-2.5 h-2.5 text-accent-600" />
            </span>
            {b}
          </li>
        ))}
      </ul>
    </>
  );

  const visualCard = (
    <div className="relative group">
      {/* Single soft glow - brand blue only */}
      <div className="absolute -inset-6 bg-gradient-to-tr from-[#dbeafe]/60 via-transparent to-transparent rounded-[2.5rem] blur-2xl pointer-events-none" />

      {/* Spec card - layered frame: tinted header, drafting floor, floating mock */}
      <div className="relative rounded-[1.25rem] bg-white ring-1 ring-gray-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_34px_-18px_rgba(15,23,42,0.22)] group-hover:-translate-y-2 group-hover:scale-[1.01] group-hover:ring-accent-200 group-hover:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_32px_60px_-22px_rgba(37,99,235,0.45)] transition-all duration-500 overflow-hidden">
        {/* Signature top rule - draws in on hover, same as the feature grid */}
        <span
          className="absolute top-0 left-0 z-10 h-0.5 w-full bg-gradient-to-r from-accent-500 to-accent-300 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500"
          aria-hidden="true"
        />

        {/* Flat top bar - honest, no traffic lights */}
        <div className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-[#f8faff] to-white border-b border-gray-100">
          <span className="w-8 h-8 rounded-[0.65rem] bg-gradient-to-b from-[#eff6ff] to-[#dbeafe] ring-1 ring-[#bfdbfe]/70 flex items-center justify-center text-accent-700 flex-shrink-0 transition-transform duration-300 group-hover:scale-105">
            <Icon className="w-3.5 h-3.5" />
          </span>
          <span className="text-caption-xs font-semibold text-gray-900 tracking-wide">{label}</span>
          <span className="ml-auto flex items-center gap-2" aria-hidden="true">
            <span className="font-mono text-[10px] font-semibold tracking-[0.16em] text-gray-300">0{index + 1}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-accent-400" />
          </span>
        </div>

        {/* Mockup body on a drafting grid floor */}
        <div className="relative p-6 lg:p-8 min-h-[270px] flex items-center justify-center bg-[#f2f5fb]">
          <span
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage: 'radial-gradient(#dbe3f0 1px, transparent 1px)',
              backgroundSize: '18px 18px',
            }}
            aria-hidden="true"
          />
          {/* Soft top-down vignette so the plate reads as inset, not pasted */}
          <span
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: 'linear-gradient(to bottom, rgba(15,23,42,0.05), transparent 38%)' }}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-white ring-1 ring-gray-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.06),0_18px_38px_-20px_rgba(15,23,42,0.32)] p-5 group-hover:shadow-[0_1px_2px_rgba(15,23,42,0.08),0_24px_48px_-20px_rgba(15,23,42,0.38)] transition-shadow duration-500">
            {visual}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <FadeIn delay={index * 100}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center mb-24">
        {/* Text column */}
        <div className={isReversed ? 'lg:order-2' : 'lg:order-1'}>
          {content}
        </div>
        {/* Visual column */}
        <div className={isReversed ? 'lg:order-1' : 'lg:order-2'}>
          {visualCard}
        </div>
      </div>
    </FadeIn>
  );
}

// ── FAQ item ──────────────────────────────────────────────────────────────
function FAQItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-2xl border transition-all duration-500 overflow-hidden ${
      open ? 'border-accent-200 border-l-4 border-l-accent-500 bg-[#eff6ff]/50 shadow-md' : 'border-gray-200 bg-white hover:border-accent-200 hover:shadow-md hover:-translate-y-0.5'
    }`}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 sm:px-6 sm:py-5 text-left"
      >
        <span className="flex items-baseline gap-3 min-w-0">
          <span className="font-mono text-caption-xs font-semibold text-accent-400 flex-shrink-0" aria-hidden="true">
            Q{String(index + 1).padStart(2, '0')}
          </span>
          <span className={`text-body-sm sm:text-body font-semibold transition-colors ${open ? 'text-accent-800' : 'text-gray-800'}`}>
            {q}
          </span>
        </span>
        <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
          open ? 'bg-accent-600 text-white rotate-180' : 'bg-accent-50 text-accent-600'
        }`}>
          <ChevronDown className="w-4 h-4" />
        </span>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <p className="px-5 sm:px-6 pb-5 text-body-sm text-gray-700 leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

// ── Card tint helpers ─────────────────────────────────────────────────────
const testimonialTintStyles = {
  blue: {
    card: 'from-blue-50/60 via-white to-white border-blue-100 hover:border-blue-300',
    watermark: 'text-blue-500/10 group-hover:text-blue-500/25',
  },
  purple: {
    card: 'from-purple-50/60 via-white to-white border-purple-100 hover:border-purple-300',
    watermark: 'text-purple-500/10 group-hover:text-purple-500/25',
  },
  emerald: {
    card: 'from-emerald-50/60 via-white to-white border-emerald-100 hover:border-emerald-300',
    watermark: 'text-emerald-500/10 group-hover:text-emerald-500/25',
  },
} as const;

const pricingTintStyles = {
  blue: { bg: 'from-white to-white', border: 'border-gray-200 hover:border-accent-300', blob: 'bg-[#bfdbfe]/30' },
  purple: { bg: 'from-white to-white', border: 'border-gray-200 hover:border-accent-300', blob: 'bg-[#bfdbfe]/30' },
  emerald: { bg: 'from-white to-white', border: 'border-gray-200 hover:border-accent-300', blob: 'bg-[#bfdbfe]/30' },
} as const;

// ── Pricing Card ──────────────────────────────────────────────────────────
function PricingCard({
  name, price, priceSuffix, description, features, popular = false, cta, onCta, tint = 'blue',
}: {
  name: string; price: string; priceSuffix?: string | null; description: string; features: string[]; popular?: boolean; cta: string; onCta: () => void; tint?: keyof typeof pricingTintStyles;
}) {
  const t = pricingTintStyles[tint];
  const suffix = priceSuffix !== undefined ? priceSuffix : price !== 'Free' ? '/month' : null;
  return (
    <div className={`relative h-full flex flex-col rounded-2xl p-8 border-2 bg-gradient-to-b transition-all duration-500 hover:-translate-y-2 hover:scale-[1.01] ${
      popular
        ? `border-accent-500 ${t.bg} shadow-elevated animate-glow-pulse`
        : `${t.border} ${t.bg} hover:shadow-elevated`
    }`}>
      {/* Soft corner glow */}
      <div className={`absolute -top-10 -right-10 w-36 h-36 rounded-full ${t.blob} blur-2xl pointer-events-none`} />
      {popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-accent-600 to-blue-500 text-white text-caption-xs font-semibold px-4 py-1.5 rounded-full shadow-lg animate-float">
          Most popular
        </span>
      )}
      <h3 className="text-title font-display text-gray-900 mb-1">{name}</h3>
      <p className="text-body-sm text-gray-700 mb-5">{description}</p>
      <div className="mb-6">
        <span className="text-display-lg font-display text-gray-900">{price}</span>
        {suffix && <span className="text-body-sm text-gray-700 ml-1">{suffix}</span>}
      </div>
      <ul className="space-y-3 mb-8">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-3 text-body-sm text-gray-700">
            <CheckCircle className="w-4 h-4 text-accent-500 mt-0.5 flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onCta}
        className={`mt-auto w-full py-2.5 rounded-full text-body-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 ${
          popular
            ? 'bg-accent-600 hover:bg-accent-700 text-white shadow-button'
            : 'bg-white border border-gray-200 text-gray-700 hover:border-accent-300'
        }`}
      >
        {cta}
      </button>
    </div>
  );
}

// ── Built-in tool tile (bento card: mockup plate up top, copy below) ──────
function SecondaryFeatureCard({
  index,
  icon: Icon,
  title,
  description,
  visual,
  accent = 'blue',
}: {
  index: number;
  icon: React.ElementType;
  title: string;
  description: string;
  visual: React.ReactNode;
  accent?: 'blue' | 'emerald' | 'amber' | 'purple';
}) {
  const accentMap = {
    blue: {
      iconBg: 'bg-gradient-to-br from-accent-500 to-blue-600 shadow-[0_8px_18px_-8px_rgba(37,99,235,0.9)]',
      glow: 'from-accent-300/45',
      rule: 'from-accent-500 to-accent-300',
      num: 'text-accent-300',
    },
    emerald: {
      iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-[0_8px_18px_-8px_rgba(16,185,129,0.9)]',
      glow: 'from-emerald-300/45',
      rule: 'from-emerald-500 to-emerald-300',
      num: 'text-emerald-300',
    },
    amber: {
      iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-[0_8px_18px_-8px_rgba(245,158,11,0.9)]',
      glow: 'from-amber-300/45',
      rule: 'from-amber-500 to-amber-300',
      num: 'text-amber-300',
    },
    purple: {
      iconBg: 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-[0_8px_18px_-8px_rgba(147,51,234,0.85)]',
      glow: 'from-purple-300/45',
      rule: 'from-purple-500 to-purple-300',
      num: 'text-purple-300',
    },
  }[accent];

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-[1.4rem] bg-white ring-1 ring-gray-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_36px_-26px_rgba(15,23,42,0.3)] transition-all duration-500 hover:-translate-y-1.5 hover:ring-accent-200 hover:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_34px_64px_-30px_rgba(37,99,235,0.5)]">
      {/* Signature top rule - draws in on hover, same as the feature rows */}
      <span
        className={`absolute inset-x-0 top-0 z-20 h-[2px] origin-left scale-x-0 bg-gradient-to-r ${accentMap.rule} transition-transform duration-500 group-hover:scale-x-100`}
        aria-hidden="true"
      />

      {/* Corner tint - the only colour outside the icon tile */}
      <span
        className={`pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-gradient-to-br ${accentMap.glow} to-transparent blur-2xl opacity-60 transition-opacity duration-500 group-hover:opacity-100`}
        aria-hidden="true"
      />

      {/* Mockup plate on the drafting-grid floor used by the feature rows */}
      <div className="relative h-48 overflow-hidden border-b border-gray-100 bg-[#f3f6fc]">
        <span
          className="absolute inset-0 opacity-70"
          style={{ backgroundImage: 'radial-gradient(#dbe3f0 1px, transparent 1px)', backgroundSize: '16px 16px' }}
          aria-hidden="true"
        />
        <span
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(to bottom, rgba(15,23,42,0.05), transparent 45%)' }}
          aria-hidden="true"
        />
        <span
          className={`absolute left-4 top-3 font-mono text-[10px] font-semibold tracking-[0.2em] ${accentMap.num}`}
          aria-hidden="true"
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="relative flex h-full items-center justify-center px-4 pb-4 pt-7 transition-transform duration-500 group-hover:-translate-y-1">
          <div className="w-full">{visual}</div>
        </div>
      </div>

      {/* Copy */}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-white ring-1 ring-white/40 transition-transform duration-500 group-hover:scale-110 ${accentMap.iconBg}`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="font-display text-[0.9rem] font-bold leading-snug text-gray-900 sm:text-[0.95rem]">{title}</h3>
        </div>
        <p className="mt-2.5 text-body-sm leading-relaxed text-gray-500">{description}</p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  // Logged-in state so the header/hero don't force a re-login when returning from the dashboard
  const [authState, setAuthState] = useState<'loading' | 'guest' | 'loggedIn'>('loading');
  const [dashboardHref, setDashboardHref] = useState('/dashboard/resident');

  useEffect(() => {
    // If there's no stored token, we're a guest - no network call needed.
    if (!getAuthToken()) {
      setAuthState('guest');
      return;
    }
    let cancelled = false;
    auth.me()
      .then((data) => {
        if (cancelled) return;
        const role = data.memberships[0]?.role;
        setDashboardHref(
          role === 'COMMITTEE_ADMIN' || role === 'SUPER_ADMIN' ? '/dashboard/admin'
          : role === 'SECURITY_GUARD' ? '/dashboard/guard'
          : '/dashboard/resident'
        );
        setAuthState('loggedIn');
      })
      .catch(() => { if (!cancelled) setAuthState('guest'); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scrollspy - highlight the nav link of the section currently in view
  useEffect(() => {
    const sectionIds = ['features', 'pricing', 'faq'];
    const onScroll = () => {
      const pos = window.scrollY + 140;
      let current = '';
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= pos) current = id;
      }
      setActiveSection(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const testimonials = [
    { name: 'Ahmed Raza', role: 'Committee Admin, Gulshan-e-Iqbal Karachi', quote: 'Maintenance collection used to mean knocking on doors all month. Now residents pay through JazzCash and everything is reconciled automatically. What a relief for our committee!', rating: 5, tint: 'blue' },
    { name: 'Fatima Malik', role: 'Resident, Model Town Lahore', quote: 'The gate QR passes are a blessing. No more waiting for the guard to call home before letting guests in - one tap from my phone and my visitors are cleared.', rating: 5, tint: 'purple' },
    { name: 'Usman Khan', role: 'Resident, F-11 Islamabad', quote: 'Raising a maintenance ticket used to mean WhatsApp messages that got lost. Now I just add a photo and track the repair till it is fixed. Finally, things get done.', rating: 5, tint: 'emerald' },
  ];

  const faqs = [
    { q: 'How long does it take to set up my society?', a: 'You can create your society and be fully operational in under 10 minutes. Adding buildings, units, and inviting residents is quick and intuitive.' },
    { q: 'How does pricing work?', a: 'Free for societies with up to 15 units, forever. Beyond that we charge per unit per month - Rs 20/unit for units 16–50, Rs 12/unit for 51–200, and Rs 8/unit for 201–500 - calculated progressively like tax brackets, so the more you grow, the less each extra unit costs. In practice: a 50-unit society pays Rs 700/month, 100 units Rs 1,300/month, 200 units Rs 2,500/month, and 500 units Rs 4,900/month. Societies over 500 units get a custom quote. Every feature is included on every plan.' },
    { q: 'Is my data secure and isolated?', a: 'Absolutely. Every society has a fully isolated database context. Role-based access control ensures only authorized users see specific data. All connections use encryption.' },
    { q: 'Can residents pay maintenance online?', a: 'Yes! We support secure online payment integration. Residents can pay with credit or debit cards. We also support offline payment tracking for societies that prefer cash or bank transfers.' },
    { q: 'What happens when the committee changes?', a: 'We offer a one-click committee transition export. All financial records, audit logs, and documents are packaged into a downloadable archive for the new committee.' },
    { q: 'Do you offer white-label options?', a: 'Yes - for larger societies (custom-quote tier), we offer white-labeling: your society name, colors, and logo, no OmniHome branding.' },
    { q: 'Is there a mobile app?', a: 'OmniHome is fully responsive and works beautifully on all devices - mobile, tablet, and desktop. A native mobile app is planned for a future release.' },
  ];

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ];

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-screen page-canvas">
      {/* ── Background effect ──────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-[#3b82f6]/[0.03] rounded-full blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-[#1e3a8a]/[0.02] rounded-full blur-[150px]" />
      </div>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? 'pt-3' : 'pt-4'
      }`}>
        <div className={`mx-auto max-w-6xl px-4 transition-all duration-500 ${
          scrolled
            ? 'bg-white/90 backdrop-blur-2xl border border-gray-200/50 shadow-[0_2px_4px_rgba(15,23,42,0.04),0_12px_32px_-8px_rgba(15,23,42,0.1)] rounded-2xl'
            : 'bg-white/60 backdrop-blur-xl border border-white/40 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_4px_16px_-4px_rgba(15,23,42,0.06)] rounded-2xl'
        }`}>
          {/* Top accent line */}
          <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-accent-400/40 to-transparent" />

          <div className="h-[4.25rem] flex items-center justify-between px-5">
            {/* Logo */}
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3 group flex-shrink-0">
              <div className="relative">
                <img src="/logo3.png" alt="OmniHome" className="h-9 w-auto object-contain transition-transform duration-300 group-hover:scale-105" />
              </div>
              <div className="flex flex-col">
                <span className="text-body font-bold font-display text-gray-900 leading-tight tracking-tight">
                  Omni<span className="text-accent-600">Home</span>
                </span>
                <span className="text-[9px] font-medium text-gray-400 tracking-[0.08em] uppercase">Community platform</span>
              </div>
            </button>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-0.5">
              {navLinks.map((link) => {
                const active = activeSection === link.href.slice(1);
                return (
                  <button
                    key={link.label}
                    onClick={() => scrollTo(link.href.slice(1))}
                    className={`relative px-4 py-2 text-[13px] font-medium rounded-xl transition-all duration-300 ${
                      active
                        ? 'text-accent-700 bg-accent-50/80'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {link.label}
                  </button>
                );
              })}

              {/* Separator */}
              <span className="w-px h-4 bg-gray-200/80 mx-2.5" aria-hidden="true" />

              <div className="flex items-center gap-2">
                {authState === 'loggedIn' ? (
                  <button
                    onClick={() => router.push(dashboardHref)}
                    className="group inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white bg-gradient-to-r from-accent-600 to-accent-500 hover:from-accent-700 hover:to-accent-600 hover:-translate-y-px transition-all duration-300 shadow-[0_1px_4px_rgba(37,99,235,0.3)] hover:shadow-[0_4px_12px_rgba(37,99,235,0.4)]"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 transition-transform duration-300 group-hover:-rotate-6" />
                    Dashboard
                  </button>
                ) : authState === 'loading' ? null : (
                  <>
                    <button
                      onClick={() => router.push('/login')}
                      className="px-4 py-2 rounded-xl text-[13px] font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all duration-300"
                    >
                      Log in
                    </button>
                    <button
                      onClick={() => router.push('/signup')}
                      className="group relative px-4 py-2 rounded-xl text-[13px] font-semibold text-white overflow-hidden transition-all duration-300 hover:-translate-y-px shadow-[0_1px_4px_rgba(37,99,235,0.3)] hover:shadow-[0_4px_12px_rgba(37,99,235,0.4)]"
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-accent-600 via-accent-500 to-blue-500 bg-[length:200%_auto] animate-gradient-shift" />
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-shimmer-btn bg-[length:200%_100%]" />
                      <span className="relative z-10">Sign up free</span>
                    </button>
                  </>
                )}
              </div>
            </nav>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-all duration-300"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              <span className="relative flex h-5 w-5 items-center justify-center">
                <span className={`absolute h-[1.5px] w-4 rounded-full bg-current transition-all duration-300 ${mobileMenuOpen ? 'rotate-45' : '-translate-y-1'}`} />
                <span className={`absolute h-[1.5px] w-4 rounded-full bg-current transition-all duration-300 ${mobileMenuOpen ? 'opacity-0' : 'opacity-100'}`} />
                <span className={`absolute h-[1.5px] w-4 rounded-full bg-current transition-all duration-300 ${mobileMenuOpen ? '-rotate-45' : 'translate-y-1'}`} />
              </span>
            </button>
          </div>
        </div>

        {/* Mobile nav - floating panel */}
        <div className={`md:hidden px-4 transition-all duration-500 ease-out ${
          mobileMenuOpen ? 'mt-2 opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}>
          <div className="bg-white/95 backdrop-blur-2xl rounded-2xl border border-gray-200/50 shadow-[0_8px_32px_-8px_rgba(15,23,42,0.15)] overflow-hidden">
            <div className="p-3 space-y-1">
              {navLinks.map((link, i) => {
                const active = activeSection === link.href.slice(1);
                return (
                  <button
                    key={link.label}
                    onClick={() => scrollTo(link.href.slice(1))}
                    style={{ transitionDelay: mobileMenuOpen ? `${i * 40}ms` : '0ms' }}
                    className={`flex items-center justify-between w-full text-left text-[13px] font-medium py-2.5 px-3.5 rounded-xl transition-all duration-300 ${
                      mobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
                    } ${
                      active ? 'text-accent-700 bg-accent-50/80' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {link.label}
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-accent-500" />}
                  </button>
                );
              })}
              <div className="h-px bg-gray-100 my-1.5" />
              {authState === 'loggedIn' ? (
                <button onClick={() => router.push(dashboardHref)} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-accent-600 to-accent-500 text-white font-semibold text-[13px] shadow-md">Dashboard</button>
              ) : (
                <div className="space-y-1.5">
                  <button onClick={() => router.push('/login')} className="w-full py-2.5 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 border border-gray-200/60 transition-colors">Log in</button>
                  <button onClick={() => router.push('/signup')} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-accent-600 to-accent-500 text-white font-semibold text-[13px] shadow-md">Sign up free</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-12 md:pt-36 md:pb-16 px-6 overflow-hidden">
        {/* Blueprint grid - architectural texture, faded toward the edges */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(#e8edf5 1px, transparent 1px), linear-gradient(90deg, #e8edf5 1px, transparent 1px)',
            backgroundSize: '36px 36px',
            maskImage: 'radial-gradient(ellipse 90% 80% at 65% 40%, black 0%, transparent 72%)',
            WebkitMaskImage: 'radial-gradient(ellipse 90% 80% at 65% 40%, black 0%, transparent 72%)',
          }}
        />
        {/* Animated floating orbs */}
        <div className="absolute top-[-10%] right-[-8%] w-[36%] h-[50%] bg-[#eff6ff]/70 rounded-full blur-[110px] pointer-events-none animate-float-slow" />
        <div className="absolute bottom-[10%] left-[-5%] w-[25%] h-[35%] bg-[#dbeafe]/40 rounded-full blur-[90px] pointer-events-none animate-float-delayed" />
        <div className="absolute top-[40%] right-[20%] w-[15%] h-[20%] bg-accent-200/20 rounded-full blur-[70px] pointer-events-none animate-float" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-16 items-center">
            {/* Left column */}
            <div>
              <FadeIn>
                <p className="flex items-center gap-3 text-caption-xs font-semibold text-accent-600 uppercase tracking-widest mb-5">
                  <span className="w-8 h-px bg-accent-300" aria-hidden="true" />
                  Property management software
                </p>
              </FadeIn>

              <FadeIn delay={100}>
                <h1 className="text-display-lg md:text-5xl lg:text-[4rem] font-display tracking-tight leading-[1.06] text-gray-900 max-w-xl">
                  The operating system for{' '}
                  <span
                    className="bg-gradient-to-r from-accent-600 via-accent-500 to-blue-500 bg-[length:200%_auto] animate-gradient-shift bg-clip-text text-transparent"
                  >
                    residential communities
                  </span>
                </h1>
              </FadeIn>

              <FadeIn delay={200}>
                <p className="text-body md:text-lg text-gray-700 mt-6 max-w-md leading-relaxed">
                  Replace WhatsApp groups, paper notices, and spreadsheets with one connected platform - for committees, residents, and security.
                </p>
              </FadeIn>

              <FadeIn delay={300}>
                <div className="mt-8">
                  <button
                    onClick={() => router.push(authState === 'loggedIn' ? dashboardHref : '/signup')}
                    className="group relative inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-body-sm font-semibold text-white overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                  >
                    {/* Animated gradient background */}
                    <span className="absolute inset-0 bg-gradient-to-r from-accent-600 via-accent-500 to-blue-500 bg-[length:200%_auto] animate-gradient-shift" />
                    {/* Shimmer overlay */}
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer-btn bg-[length:200%_100%]" />
                    <span className="relative z-10 flex items-center gap-2">
                      {authState === 'loggedIn' ? 'Open your dashboard' : 'Get started free'}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </button>
                  {authState !== 'loggedIn' && (
                <p className="flex items-center gap-1.5 text-caption text-gray-700 mt-3">
                  <Check className="w-3.5 h-3.5 text-accent-500" />
                  Free for up to 15 units · No credit card required
                </p>
                  )}

                  {/* Social proof */}
                  <div className="flex items-center gap-2.5 mt-8">
                    <span className="w-7 h-7 rounded-lg bg-accent-50 border border-accent-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-3.5 h-3.5 text-accent-600" />
                    </span>
                    <p className="text-caption text-gray-700">
                      Trusted by <span className="font-semibold text-gray-900">200+ communities</span> across Pakistan
                    </p>
                  </div>
                </div>
              </FadeIn>
            </div>

            {/* Right column - building photo in the product window frame */}
            <FadeIn delay={200}>
              <div className="relative">
                {/* Ambient glow behind the window - explicit light tint */}
                <div className="absolute -inset-6 bg-gradient-to-tr from-[#dbeafe]/70 via-[#eff6ff]/50 to-transparent rounded-[2.5rem] blur-2xl pointer-events-none" />

                {/* App window frame */}
                <div className="relative rounded-2xl overflow-hidden bg-white shadow-2xl shadow-blue-900/10 ring-1 ring-gray-200/80">
                  <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#fda4af]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#fcd34d]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#6ee7b7]" />
                    <span className="ml-3 text-caption-xs font-semibold text-gray-700">OmniHome</span>
                    <span className="ml-auto inline-flex items-center gap-1.5 text-caption-xs font-medium text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
                      Live
                    </span>
                  </div>
                  {/* Building photos - scroll horizontally, looping endlessly */}
                  <HeroImageRotator />
                </div>

                {/* Floating card: maintenance collected */}
                <div className="absolute -left-4 sm:-left-8 top-[30%] hidden sm:block animate-float-slow">
                  <div className="rounded-xl bg-white pl-4 pr-4 py-3 shadow-elevated ring-1 ring-gray-100 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-accent-50 flex items-center justify-center text-accent-600">
                      <CreditCard className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <p className="text-caption-xs text-gray-700">Maintenance collected</p>
                      <p className="text-body-sm font-semibold text-gray-900">Rs 84,500</p>
                    </div>
                  </div>
                </div>

                {/* Floating card: visitor approved */}
                <div className="absolute -right-3 sm:-right-6 bottom-8 animate-float-slow" style={{ animationDelay: '2s' }}>
                  <div className="rounded-xl bg-white p-3 shadow-elevated ring-1 ring-gray-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-caption-xs font-semibold text-gray-900">Visitor approved</p>
                      <p className="text-caption-xs text-gray-700">Guest pass · Unit 201</p>
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── Trust bar ────────────────────────────────────────────────── */}
      <section className="pb-12 md:pb-14 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 md:divide-x divide-gray-100 border-y border-gray-100/80 py-6 bg-white/50 backdrop-blur-sm rounded-2xl">
            {[
              { icon: Check, title: 'Free up to 15 units', sub: 'Every feature included' },
              { icon: Building2, title: 'Under 10 minutes', sub: 'To set up your society' },
              { icon: Lock, title: 'Role-based access', sub: 'With a full audit trail' },
              { icon: QrCode, title: 'Works on any phone', sub: 'No app download needed' },
            ].map((claim) => (
              <FadeIn key={claim.title} delay={300}>
                <div className="flex items-center gap-3 px-2 md:px-6 py-2 md:py-0 hover:bg-accent-50/50 transition-colors rounded-xl">
                  <div className="w-9 h-9 rounded-lg bg-accent-50 border border-accent-100 flex items-center justify-center text-accent-600 flex-shrink-0">
                    <claim.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-body-sm font-semibold text-gray-900 leading-tight">{claim.title}</p>
                    <p className="text-caption text-gray-700 mt-0.5">{claim.sub}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section id="features" className="py-14 md:py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-caption-xs font-semibold text-accent-600 uppercase tracking-widest mb-3">
              Features
            </p>
            <h2 className="text-display lg:text-display-lg font-display text-gray-900">
              Everything your community needs
            </h2>
            <p className="text-body text-gray-700 max-w-lg mx-auto mt-4">
              From dues to visitors, one platform connects every part of community life.
            </p>
          </div>

          {/* Row 1: Payments - text left, blue tint */}
          <FeatureRow
            index={0}

            icon={CreditCard}
            label="Payments"
            headline="Collect dues, effortlessly"
            description="Generate invoices, accept online payments, and track every transaction. No more chasing residents for monthly maintenance."
            bullets={[
              'Automated monthly invoice generation',
              'Secure online payment integration',
              'Real-time payment reconciliation',
            ]}
            visual={<PaymentsShowcase />}
          />

          {/* Row 2: Maintenance - text right, amber tint */}
          <FeatureRow
            index={1}

            icon={Wrench}
            label="Maintenance"
            headline="Track repairs, start to finish"
            description="Residents submit tickets with photo attachments. Assign, track status, and resolve - all in one place."
            bullets={[
              'Photo attachments with each ticket',
              'Real-time status tracking (Open → In Progress → Resolved)',
              'Assignment & priority management',
            ]}
            visual={<MaintenanceShowcase />}
          />

          {/* Row 3: Visitors - text left */}
          <FeatureRow
            index={2}
            icon={QrCode}
            label="Visitors"
            headline="Gate access, reimagined"
            description="Residents create digital visitor passes with QR codes. Security scans at the gate. Auto-expire on check-out."
            bullets={[
              'QR-coded digital visitor passes',
              'Security guard verification at gate',
              'Auto-revoke on resident move-out',
            ]}
            visual={<VisitorsShowcase />}
          />

          {/* Row 4: Amenities - text right, emerald tint */}
          <FeatureRow
            index={3}

            icon={CalendarRange}
            label="Amenities"
            headline="Book facilities, no conflicts"
            description="Real-time calendar for clubhouse, gym, pool, and more. Automatic conflict detection prevents double-bookings."
            bullets={[
              'Real-time availability calendar',
              'Automatic conflict prevention',
              'Advance notice & duration limits',
            ]}
            visual={<AmenitiesShowcase />}
          />
        </div>
      </section>

      {/* ── Secondary features ──────────────────────────────────────────── */}
      <section className="relative py-16 md:py-20 px-6">
        {/* Faint brand bloom so the tile grid sits on its own plane */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 overflow-hidden" aria-hidden="true">
          <div className="absolute left-1/2 top-0 h-80 w-[44rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[radial-gradient(closest-side,rgba(37,99,235,0.10),transparent)]" />
        </div>

        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <FadeIn>
              <span className="relative inline-flex items-center gap-2 mb-5 rounded-full bg-gradient-to-r from-accent-50 via-white to-accent-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-accent-700 ring-1 ring-accent-100 shadow-[0_12px_26px_-20px_rgba(37,99,235,0.9)]">
                <Sparkles className="w-3.5 h-3.5 text-accent-500" />
                Built-in tools
              </span>
              <h2 className="font-display text-display lg:text-display-lg text-gray-900 leading-[1.08] tracking-tight">
                Everything else,<br className="hidden sm:block" />{' '}
                <span className="bg-gradient-to-r from-accent-700 via-accent-500 to-accent-700 bg-clip-text text-transparent">
                  handled automatically
                </span>
              </h2>
              <p className="text-body-sm text-gray-500 mt-4 max-w-md mx-auto">
                No extra software needed. These come standard with every account.
              </p>
            </FadeIn>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 items-stretch">
            <FadeIn delay={0} className="h-full">
              <SecondaryFeatureCard
                index={5}
                icon={BarChart3}
                title="Instant community polls"
                description="Run votes in seconds. Residents tap to decide, results appear live."
                accent="blue"
                visual={
                  <div className="relative mx-auto w-full max-w-[220px] space-y-2">
                    <span className="absolute -top-4 right-0 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-accent-600 ring-1 ring-accent-100 shadow-sm">
                      <span className="h-1 w-1 rounded-full bg-accent-500 animate-pulse-soft" />
                      Live
                    </span>
                    {[
                      { label: 'New parking policy', pct: 72, meta: '38 of 53 voted' },
                      { label: 'Holiday schedule', pct: 58, meta: '31 of 53 voted' },
                    ].map((poll, i) => (
                      <div key={i} className="rounded-xl bg-white px-3 py-1 shadow-[0_8px_18px_-14px_rgba(15,23,42,0.5)] ring-1 ring-gray-900/[0.05]">
                        <div className="flex items-baseline justify-between gap-2 py-1">
                          <span className="truncate text-[10px] font-semibold text-gray-800">{poll.label}</span>
                          <span className="text-[10px] font-bold tabular-nums text-accent-600">{poll.pct}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-gradient-to-r from-accent-500 to-blue-400" style={{ width: `${poll.pct}%` }} />
                        </div>
                        <p className="py-1 text-[9px] text-gray-400">{poll.meta}</p>
                      </div>
                    ))}
                  </div>
                }
              />
            </FadeIn>
            <FadeIn delay={80} className="h-full">
              <SecondaryFeatureCard
                index={6}
                icon={Users}
                title="Smart resident directory"
                description="Find anyone by name, unit, or building. Know your community."
                accent="emerald"
                visual={
                  <div className="mx-auto w-full max-w-[220px]">
                    <div className="flex items-center gap-1.5 rounded-xl bg-white px-2.5 py-1.5 shadow-[0_8px_18px_-14px_rgba(15,23,42,0.5)] ring-1 ring-gray-900/[0.05]">
                      <Search className="h-2.5 w-2.5 text-gray-400" />
                      <span className="text-[9px] text-gray-400">Search name, unit or building</span>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {[
                        { name: 'Ahmed Raza', unit: 'A-101', role: 'Admin', tone: 'from-emerald-500 to-teal-500 bg-emerald-50 text-emerald-700' },
                        { name: 'Fatima Khan', unit: 'B-204', role: 'Resident', tone: 'from-accent-500 to-blue-500 bg-accent-50 text-accent-700' },
                        { name: 'Bilal Ahmed', unit: 'C-112', role: 'Resident', tone: 'from-accent-500 to-blue-500 bg-accent-50 text-accent-700' },
                      ].map((p, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-1 shadow-[0_8px_18px_-14px_rgba(15,23,42,0.5)] ring-1 ring-gray-900/[0.05]">
                          <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${p.tone.split(' ').slice(0, 2).join(' ')} text-[8px] font-bold text-white`}>
                            {p.name.split(' ').map(w => w[0]).join('')}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[10px] font-semibold text-gray-900">{p.name}</p>
                            <p className="text-[9px] text-gray-500">Unit {p.unit}</p>
                          </div>
                          <span className={`rounded-full px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider ${p.tone.split(' ').slice(2).join(' ')}`}>
                            {p.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                }
              />
            </FadeIn>
            <FadeIn delay={160} className="h-full">
              <SecondaryFeatureCard
                index={7}
                icon={Lock}
                title="Granular access control"
                description="Admins, residents, guards. Everyone sees only what they should."
                accent="purple"
                visual={
                  <div className="mx-auto w-full max-w-[220px]">
                    <div className="mb-2 flex items-center justify-between px-0.5">
                      <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-gray-400">Permissions</span>
                      <span className="rounded-full bg-white px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-purple-600 ring-1 ring-purple-100">3 roles</span>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { role: 'Committee Admin', access: 'Full access', dot: 'bg-purple-500' },
                        { role: 'Resident', access: 'Unit + community', dot: 'bg-accent-500' },
                        { role: 'Security Guard', access: 'Gate + visitors', dot: 'bg-amber-500' },
                      ].map((r, i) => (
                        <div key={i} className="flex items-center gap-2.5 rounded-xl bg-white px-2.5 py-1 shadow-[0_8px_18px_-14px_rgba(15,23,42,0.5)] ring-1 ring-gray-900/[0.05]">
                          <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${r.dot}`} aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[10px] font-semibold text-gray-900">{r.role}</p>
                            <p className="text-[9px] text-gray-500">{r.access}</p>
                          </div>
                          <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100">
                            <Check className="h-2.5 w-2.5 text-emerald-600" />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                }
              />
            </FadeIn>
            <FadeIn delay={240} className="h-full">
              <SecondaryFeatureCard
                index={8}
                icon={Folder}
                title="Secure document vault"
                description="Bylaws, minutes, contracts. Organized and always accessible."
                accent="amber"
                visual={
                  <div className="mx-auto w-full max-w-[220px]">
                    <div className="space-y-1.5">
                      {[
                        { name: 'Bylaws 2024.pdf', size: '2.4 MB', type: 'PDF', tone: 'bg-rose-50 text-rose-600 ring-rose-100' },
                        { name: 'Meeting notes.docx', size: '156 KB', type: 'DOC', tone: 'bg-accent-50 text-accent-600 ring-accent-100' },
                        { name: 'Vendor contract.pdf', size: '890 KB', type: 'PDF', tone: 'bg-rose-50 text-rose-600 ring-rose-100' },
                      ].map((f, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-1 shadow-[0_8px_18px_-14px_rgba(15,23,42,0.5)] ring-1 ring-gray-900/[0.05]">
                          <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg ring-1 ${f.tone}`}>
                            <Folder className="h-2.5 w-2.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[10px] font-semibold text-gray-900">{f.name}</p>
                            <p className="text-[9px] text-gray-500">{f.size}</p>
                          </div>
                          <span className="text-[8px] font-bold uppercase tracking-wider text-gray-400">{f.type}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2.5 flex items-center gap-2 px-0.5">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-200/80">
                        <div className="h-full w-1/4 rounded-full bg-gradient-to-r from-amber-400 to-amber-500" />
                      </div>
                      <span className="text-[8px] font-semibold tabular-nums text-gray-400">1.2 / 5 GB</span>
                    </div>
                  </div>
                }
              />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────────── */}
      <section className="py-14 md:py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-caption-xs font-semibold text-accent-600 uppercase tracking-widest mb-3">
              Loved by communities across Pakistan
            </p>
            <h2 className="text-display lg:text-display-lg font-display text-gray-900">
              What communities say
            </h2>
            <p className="text-body text-gray-700 max-w-lg mx-auto mt-4">
              Real stories from committees and residents who moved their society onto OmniHome.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => {
              const tt = testimonialTintStyles[t.tint as keyof typeof testimonialTintStyles] ?? testimonialTintStyles.blue;
              return (
              <FadeIn key={t.name} delay={i * 120}>
                <div className={`group relative rounded-2xl p-7 bg-gradient-to-b border shadow-sm hover:shadow-elevated hover:-translate-y-2 hover:scale-[1.01] transition-all duration-500 h-full flex flex-col overflow-hidden backdrop-blur-sm ${tt.card}`}>
                  {/* Decorative quote watermark */}
                  <Quote className={`absolute bottom-4 right-4 w-16 h-16 transition-colors duration-500 pointer-events-none ${tt.watermark}`} />

                  {/* Stars + verified pill */}
                  <div className="flex items-center justify-between gap-3 mb-5 relative">
                    <div className="flex gap-1">
                      {Array.from({ length: t.rating }).map((_, j) => (
                        <Star key={j} className="w-4 h-4 fill-accent-500 text-accent-500" />
                      ))}
                    </div>
                    <span className="inline-flex items-center gap-1 text-caption-xs font-semibold text-accent-700 bg-accent-50 border border-accent-100 px-2 py-1 rounded-full shrink-0">
                      <BadgeCheck className="w-3.5 h-3.5" />
                      Verified
                    </span>
                  </div>

                  <p className="text-body-sm text-gray-700 leading-relaxed flex-1 relative">&ldquo;{t.quote}&rdquo;</p>

                  {/* Author - initials avatar + name/role */}
                  <div className="mt-6 pt-5 border-t border-gray-100 flex items-center gap-3 relative">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-accent-500 to-accent-800 text-white flex items-center justify-center text-caption-xs font-bold shadow-sm shrink-0">
                      {t.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-body-sm font-semibold text-gray-900 truncate">{t.name}</p>
                      <p className="text-caption text-gray-700 truncate">{t.role}</p>
                    </div>
                  </div>
                </div>
              </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────── */}
      <section id="pricing" className="py-14 md:py-16 px-6 bg-gradient-to-b from-[#e8f0fd] to-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-caption-xs font-semibold text-accent-600 uppercase tracking-widest mb-3">
              Pricing
            </p>
            <h2 className="text-display lg:text-display-lg font-display text-gray-900">
              Simple pricing that grows with you
            </h2>
            <p className="text-body text-gray-700 mt-4">
              Free up to 15 units. After that, one monthly fee based on your unit count - the rate per unit drops as you grow. Every plan includes every feature.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <FadeIn delay={0}>
              <PricingCard
                name="Starter"
                tint="blue"
                price="Free"
                description="For societies finding their feet."
                features={[
                  'Up to 15 units - free forever',
                  'Every feature included',
                  'Notices, tickets & visitor management',
                  'Billing, invoices & amenities',
                  'Resident directory & documents',
                  'Email support',
                ]}
                cta="Get started"
                onCta={() => router.push('/signup')}
              />
            </FadeIn>
            <FadeIn delay={120}>
              <PricingCard
                name="Growth"
                tint="purple"
                price="Rs 700"
                description="For societies of 16–200 units. Example: a 50-unit society pays Rs 700/mo."
                features={[
                  '50 units → Rs 700/mo · 100 units → Rs 1,300/mo',
                  '200 units → Rs 2,500/mo',
                  'First 15 units always free - you only pay for units 16+',
                  'Per-unit rate drops as you grow: Rs 20 (16–50) → Rs 12 (51–200)',
                  'Every feature included - nothing locked',
                  'Priority support',
                ]}
                popular
                cta="Start free"
                onCta={() => router.push('/signup')}
              />
            </FadeIn>
            <FadeIn delay={240}>
              <PricingCard
                name="Scale"
                tint="emerald"
                price="Rs 3,300"
                description="For societies of 201–500 units. Example: a 300-unit society pays Rs 3,300/mo."
                features={[
                  '300 units → Rs 3,300/mo · 500 units → Rs 4,900/mo',
                  'Top band: Rs 8/unit on units 201–500 - your cheapest units',
                  'Every feature included - nothing locked',
                  'Audit trail & committee-handover export',
                  'Beyond 500 units: custom quote',
                  'Dedicated support',
                ]}
                cta="Start free"
                onCta={() => router.push('/signup')}
              />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <section id="faq" className="py-14 md:py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-14 items-start">
            {/* Left - intro + contact */}
            <div className="lg:col-span-2">
              <FadeIn>
                <p className="flex items-center gap-3 text-caption-xs font-semibold text-accent-600 uppercase tracking-widest mb-3">
                  <span className="w-8 h-px bg-accent-300" aria-hidden="true" />
                  Got questions?
                </p>
                <h2 className="text-display lg:text-display-lg font-display text-gray-900 leading-tight mb-4">
                  Frequently asked questions
                </h2>
                <p className="text-body text-gray-700 leading-relaxed max-w-sm">
                  Everything committees, residents, and guards ask before moving their society to OmniHome.
                </p>
              </FadeIn>

              <FadeIn delay={150}>
                <div
                  className="relative mt-8 rounded-2xl bg-gradient-to-br from-accent-600 via-accent-600 to-accent-700 p-6 text-white overflow-hidden"
                >
                  {/* Dot texture + soft glow - brand blue, matching the site */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                  />
                  <div className="absolute -top-16 -right-16 w-48 h-48 bg-[#93c5fd] rounded-full blur-[90px] opacity-30 pointer-events-none" />

                  <div className="relative flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-body-sm font-semibold">Still have questions?</p>
                      <p className="text-caption text-[#dbeafe]">Our team replies within a day.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push('/signup')}
                    className="relative w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white text-accent-700 text-body-sm font-semibold hover:bg-[#eff6ff] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    Talk to our team
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </FadeIn>
            </div>

            {/* Right - accordion list */}
            <div className="lg:col-span-3">
              <FadeIn delay={120}>
                <div className="space-y-3">
                  {faqs.map((faq, fi) => (
                    <FAQItem key={faq.q} q={faq.q} a={faq.a} index={fi} />
                  ))}
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="py-14 md:py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent-800 via-accent-700 to-blue-900 p-10 md:p-16 text-center shadow-elevated transition-all duration-500 hover:shadow-modal hover:-translate-y-1">
              {/* Animated gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-accent-600/0 via-accent-500/20 to-blue-500/0 bg-[length:200%_100%] animate-gradient-shift pointer-events-none" />
              {/* Single corner glow + blueprint dot texture */}
              <div className="absolute -top-32 -right-20 w-96 h-96 bg-[#60a5fa]/25 rounded-full blur-[110px] pointer-events-none" />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)', backgroundSize: '24px 24px', maskImage: 'radial-gradient(ellipse 80% 90% at 50% 0%, black 0%, transparent 80%)', WebkitMaskImage: 'radial-gradient(ellipse 80% 90% at 50% 0%, black 0%, transparent 80%)' }}
              />
              {/* Hairline top accent */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" aria-hidden="true" />

              <div className="relative">
                {/* Eyebrow chip */}
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 text-white text-caption-xs font-semibold mb-6 ring-1 ring-white/20">
                  <Sparkles className="w-3.5 h-3.5" />
                  Get your society live in under 10 minutes
                </span>

                <h2 className="text-display lg:text-display-lg font-display text-white mb-4">
                  Ready to transform your community?
                </h2>
                <p className="text-body md:text-lg text-[#dbeafe] max-w-lg mx-auto mb-8">
                  Join thousands of communities already using OmniHome. Start free - up to 15 units, no credit card required.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    onClick={() => router.push('/signup')}
                    className="group relative inline-flex items-center gap-2 px-8 py-3.5 bg-white hover:bg-[#eff6ff] text-accent-800 rounded-full text-body-sm font-semibold transition-all shadow-lg hover:shadow-xl overflow-hidden"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-accent-100/50 to-transparent animate-shimmer-btn bg-[length:200%_100%]" />
                    <span className="relative z-10 flex items-center gap-2">
                      Start free
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </button>
                  <button
                    onClick={() => router.push('/login')}
                    className="px-8 py-3.5 rounded-full text-body-sm font-semibold text-white border border-white/40 hover:border-white hover:bg-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    Sign in
                  </button>
                </div>

                {/* Trust row */}
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-3.5 h-3.5 text-[#bfdbfe]" />
                  </span>
                  <p className="flex items-center gap-1.5 text-caption text-[#dbeafe]">
                    <span className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, sj) => (
                        <Star key={sj} className="w-3.5 h-3.5 fill-[#93c5fd] text-[#93c5fd]" />
                      ))}
                    </span>
                    <span className="font-semibold text-white">4.9/5</span>
                    from 200+ communities
                  </p>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="relative bg-[#0c1929] text-white pt-16 pb-8 px-6 overflow-hidden">
        {/* Subtle dot texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        />
        {/* Top accent glow */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-500/50 to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-accent-500/10 rounded-full blur-[80px] pointer-events-none" />

        <div className="max-w-7xl mx-auto relative">
          {/* Top row: logo + newsletter */}
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-10 mb-12">
            <div className="max-w-sm">
              <a href="/" className="inline-flex items-center gap-2.5 mb-4 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500">
                <img src="/logo3.png" alt="OmniHome" className="h-8 w-auto object-contain brightness-0 invert" />
                <span className="text-body font-bold font-display">
                  Omni<span className="text-accent-400">Home</span>
                </span>
              </a>
              <p className="text-body-sm text-gray-400 leading-relaxed">
                The premium platform for residential community management. Purpose-built for apartment complexes, HOAs, and gated communities across Pakistan.
              </p>
              <div className="flex items-center gap-2 mt-5">
                {[
                  { Icon: Facebook, label: 'OmniHome on Facebook' },
                  { Icon: Twitter, label: 'OmniHome on Twitter' },
                  { Icon: Instagram, label: 'OmniHome on Instagram' },
                  { Icon: Linkedin, label: 'OmniHome on LinkedIn' },
                ].map(({ Icon, label }) => (
                  <button
                    key={label}
                    aria-label={label}
                    className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-accent-400 hover:border-accent-500/30 hover:bg-accent-500/10 hover:-translate-y-0.5 transition-all flex items-center justify-center"
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>

            {/* Newsletter */}
            <div className="max-w-sm w-full">
              <h4 className="text-body-sm font-semibold mb-2">Stay updated</h4>
              <p className="text-caption-sm text-gray-400 mb-4">Product updates, tips, and community stories.</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-body-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-all"
                />
                <button className="px-5 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-500 text-white text-body-sm font-semibold transition-all hover:-translate-y-0.5">
                  Subscribe
                </button>
              </div>
            </div>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'FAQ', 'Changelog', 'Roadmap'] },
              { title: 'Company', links: ['About us', 'Blog', 'Careers', 'Contact', 'Partners'] },
              { title: 'Resources', links: ['Documentation', 'Guides', 'API reference', 'Status page'] },
              { title: 'Legal', links: ['Privacy policy', 'Terms of service', 'Cookie policy', 'GDPR'] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-caption-xs font-semibold text-white mb-4 uppercase tracking-widest">
                  {col.title}
                </h4>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link}>
                      <button className="text-body-sm text-gray-400 hover:text-white hover:translate-x-0.5 transition-all inline-block">
                        {link}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-caption-sm text-gray-500">
              &copy; {new Date().getFullYear()} OmniHome. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <button className="text-caption-sm text-gray-500 hover:text-white transition-colors">Privacy</button>
              <button className="text-caption-sm text-gray-500 hover:text-white transition-colors">Terms</button>
              <span className="text-caption-sm text-gray-500 flex items-center gap-1.5">
                Made in Pakistan <span aria-hidden="true">🇵🇰</span>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
