'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, CreditCard, CalendarRange,
  Users, QrCode, BarChart3, Lock,
  Folder, MessageCircle,
  CheckCircle, ChevronRight, ChevronDown, ArrowRight,
  Menu, X, Wrench, Star, Check, Quote, BadgeCheck,
  Facebook, Twitter, Instagram, Linkedin, Sparkles,
} from 'lucide-react';


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
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ── Feature Row (alternating editorial layout) ────────────────────────────
const featureTints = {
  blue: {
    glow: 'from-blue-200/50 via-blue-100/30 to-transparent',
    chrome: 'from-blue-50/80 to-white',
    frameBorder: 'border-blue-100',
    chromeBorder: 'border-blue-100',
    body: 'bg-gradient-to-br from-blue-50/60 via-white to-white',
  },
  amber: {
    glow: 'from-amber-200/50 via-amber-100/30 to-transparent',
    chrome: 'from-amber-50/80 to-white',
    frameBorder: 'border-amber-100',
    chromeBorder: 'border-amber-100',
    body: 'bg-gradient-to-br from-amber-50/60 via-white to-white',
  },
  purple: {
    glow: 'from-purple-200/50 via-purple-100/30 to-transparent',
    chrome: 'from-purple-50/80 to-white',
    frameBorder: 'border-purple-100',
    chromeBorder: 'border-purple-100',
    body: 'bg-gradient-to-br from-purple-50/60 via-white to-white',
  },
  emerald: {
    glow: 'from-emerald-200/50 via-emerald-100/30 to-transparent',
    chrome: 'from-emerald-50/80 to-white',
    frameBorder: 'border-emerald-100',
    chromeBorder: 'border-emerald-100',
    body: 'bg-gradient-to-br from-emerald-50/60 via-white to-white',
  },
} as const;

type FeatureTint = keyof typeof featureTints;

function FeatureRow({
  index,
  icon: Icon,
  label,
  headline,
  description,
  bullets,
  visual,
  tint = 'blue',
}: {
  index: number;
  icon: React.ElementType;
  label: string;
  headline: string;
  description: string;
  bullets: string[];
  visual: React.ReactNode;
  tint?: FeatureTint;
}) {
  const isReversed = index % 2 === 1;
  const t = featureTints[tint];

  const content = (
    <>
      {/* Label with icon */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-accent-50 flex items-center justify-center text-accent-600">
          <Icon className="w-4.5 h-4.5" />
        </div>
        <span className="text-body-sm font-semibold text-accent-600">{label}</span>
      </div>

      {/* Headline */}
      <h3 className="text-display-sm lg:text-display font-display text-gray-900 mb-4 leading-tight">{headline}</h3>

      {/* Description */}
      <p className="text-body text-gray-700 mb-5 leading-relaxed max-w-md">{description}</p>

      {/* Bullet list — plain dots, not icons */}
      <ul className="space-y-2.5 mb-6">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-3 text-body-sm text-gray-700">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500 mt-2 flex-shrink-0" />
            {b}
          </li>
        ))}
      </ul>

      {/* Learn more link */}
      <button className="inline-flex items-center gap-1 text-body-sm font-semibold text-accent-600 hover:text-accent-700 transition-colors group">
        Learn more
        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </button>
    </>
  );

  const visualCard = (
    <div className="relative group">
      {/* Ambient glow behind the card — tinted */}
      <div className={`absolute -inset-4 bg-gradient-to-br ${t.glow} rounded-[2rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />

      {/* App window frame — tinted border */}
      <div className={`relative rounded-2xl bg-white border shadow-card group-hover:shadow-elevated group-hover:-translate-y-1 transition-all duration-300 overflow-hidden ${t.frameBorder}`}>
        {/* Window chrome */}
        <div className={`flex items-center gap-1.5 px-4 py-3 bg-gradient-to-r border-b ${t.chromeBorder} ${t.chrome}`}>
          <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-200" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
          <span className="ml-2 text-caption-xs font-semibold text-gray-700">{label}</span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-caption-xs font-medium text-accent-600">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-pulse-soft" />
            Live preview
          </span>
        </div>

        {/* Mockup body — tinted wash */}
        <div className={`p-5 lg:p-7 min-h-[260px] flex items-center justify-center ${t.body}`}>
          {visual}
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
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
      open ? 'border-accent-200 bg-accent-50/50 shadow-sm' : 'border-gray-200 bg-white hover:border-accent-200 hover:shadow-sm hover:-translate-y-0.5'
    }`}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 sm:px-6 sm:py-5 text-left"
      >
        <span className={`text-body-sm sm:text-body font-semibold transition-colors ${open ? 'text-accent-800' : 'text-gray-800'}`}>
          {q}
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
  blue: { bg: 'from-blue-50/70 via-white to-white', border: 'border-blue-200 hover:border-blue-400', blob: 'bg-blue-200/40' },
  purple: { bg: 'from-purple-50/70 via-white to-white', border: 'border-purple-200 hover:border-purple-400', blob: 'bg-purple-200/40' },
  emerald: { bg: 'from-emerald-50/70 via-white to-white', border: 'border-emerald-200 hover:border-emerald-400', blob: 'bg-emerald-200/40' },
} as const;

// ── Pricing Card ──────────────────────────────────────────────────────────
function PricingCard({
  name, price, description, features, popular = false, cta, onCta, tint = 'blue',
}: {
  name: string; price: string; description: string; features: string[]; popular?: boolean; cta: string; onCta: () => void; tint?: keyof typeof pricingTintStyles;
}) {
  const t = pricingTintStyles[tint];
  return (
    <div className={`relative rounded-2xl p-8 border-2 bg-gradient-to-b transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated ${
      popular
        ? `border-accent-500 ${t.bg} shadow-elevated`
        : `${t.border} ${t.bg}`
    }`}>
      {/* Soft corner glow */}
      <div className={`absolute -top-10 -right-10 w-36 h-36 rounded-full ${t.blob} blur-2xl pointer-events-none`} />
      {popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent-600 text-white text-caption-xs font-semibold px-4 py-1 rounded-full shadow-sm">
          Most popular
        </span>
      )}
      <h3 className="text-title font-display text-gray-900 mb-1">{name}</h3>
      <p className="text-body-sm text-gray-700 mb-5">{description}</p>
      <div className="mb-6">
        <span className="text-display-lg font-display text-gray-900">{price}</span>
        {price !== 'Free' && <span className="text-body-sm text-gray-700 ml-1">/month</span>}
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
        className={`w-full py-2.5 rounded-lg text-body-sm font-semibold transition-all ${
          popular
            ? 'bg-accent-600 hover:bg-accent-700 text-white shadow-button'
            : 'bg-gray-50 border border-gray-200 text-gray-700 hover:border-accent-300'
        }`}
      >
        {cta}
      </button>
    </div>
  );
}

// ── Secondary feature card (pastel-tinted, the page's one tint exception) ──
function SecondaryFeatureCard({
  tint,
  icon: Icon,
  title,
  description,
  tag,
}: {
  tint: 'teal' | 'purple' | 'blue' | 'emerald';
  icon: React.ElementType;
  title: string;
  description: string;
  tag: string;
}) {
  const styles = {
    teal: {
      card: 'from-teal-50 via-white to-teal-50/50 border-teal-100 hover:border-teal-300',
      icon: 'text-teal-600',
      blob: 'bg-teal-200/40',
      watermark: 'text-teal-500/10',
      tag: 'text-teal-700 bg-teal-50 border-teal-100',
    },
    purple: {
      card: 'from-purple-50 via-white to-purple-50/50 border-purple-100 hover:border-purple-300',
      icon: 'text-purple-600',
      blob: 'bg-purple-200/40',
      watermark: 'text-purple-500/10',
      tag: 'text-purple-700 bg-purple-50 border-purple-100',
    },
    blue: {
      card: 'from-blue-50 via-white to-blue-50/50 border-blue-100 hover:border-blue-300',
      icon: 'text-blue-600',
      blob: 'bg-blue-200/40',
      watermark: 'text-blue-500/10',
      tag: 'text-blue-700 bg-blue-50 border-blue-100',
    },
    emerald: {
      card: 'from-emerald-50 via-white to-emerald-50/50 border-emerald-100 hover:border-emerald-300',
      icon: 'text-emerald-600',
      blob: 'bg-emerald-200/40',
      watermark: 'text-emerald-500/10',
      tag: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    },
  }[tint];

  return (
    <div className={`group relative overflow-hidden rounded-2xl p-6 h-full flex flex-col bg-gradient-to-b shadow-sm hover:shadow-elevated hover:-translate-y-1.5 transition-all duration-300 border ${styles.card}`}>
      {/* Soft corner glow */}
      <div className={`absolute -top-12 -right-12 w-36 h-36 rounded-full ${styles.blob} blur-2xl pointer-events-none`} />
      {/* Large faint icon watermark */}
      <Icon className={`absolute -bottom-4 -right-3 w-20 h-20 ${styles.watermark} pointer-events-none transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6`} />

      {/* Icon badge */}
      <div className={`relative w-11 h-11 rounded-xl bg-white shadow-sm ring-1 ring-black/[0.04] flex items-center justify-center ${styles.icon} mb-5 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}>
        <Icon className="w-5 h-5" />
      </div>

      <h3 className="relative text-title-sm font-display text-gray-900 mb-2">{title}</h3>
      <p className="relative text-body-sm text-gray-700 leading-relaxed flex-1">{description}</p>

      {/* Feature tag */}
      <div className={`relative mt-5 inline-flex items-center gap-1.5 w-fit text-caption-xs font-semibold px-2.5 py-1 rounded-full border ${styles.tag}`}>
        <Check className="w-3 h-3" />
        {tag}
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scrollspy — highlight the nav link of the section currently in view
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
    { name: 'Fatima Malik', role: 'Resident, Model Town Lahore', quote: 'The gate QR passes are a blessing. No more waiting for the guard to call home before letting guests in — one tap from my phone and my visitors are cleared.', rating: 5, tint: 'purple' },
    { name: 'Usman Khan', role: 'Resident, F-11 Islamabad', quote: 'Raising a maintenance ticket used to mean WhatsApp messages that got lost. Now I just add a photo and track the repair till it is fixed. Finally, things get done.', rating: 5, tint: 'emerald' },
  ];

  const faqs = [
    { q: 'How long does it take to set up my society?', a: 'You can create your society and be fully operational in under 10 minutes. Adding buildings, units, and inviting residents is quick and intuitive.' },
    { q: 'Is my data secure and isolated?', a: 'Absolutely. Every society has a fully isolated database context. Role-based access control ensures only authorized users see specific data. All connections use encryption.' },
    { q: 'Can residents pay maintenance online?', a: 'Yes! We support secure online payment integration. Residents can pay with credit or debit cards. We also support offline payment tracking for societies that prefer cash or bank transfers.' },
    { q: 'What happens when the committee changes?', a: 'We offer a one-click committee transition export. All financial records, audit logs, and documents are packaged into a downloadable archive for the new committee.' },
    { q: 'Do you offer white-label options?', a: 'Enterprise plans include white-label options — your society name, colors, and logo, no OmniHome branding.' },
    { q: 'Is there a mobile app?', a: 'OmniHome is fully responsive and works beautifully on all devices — mobile, tablet, and desktop. A native mobile app is planned for a future release.' },
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
    <div className="relative min-h-screen bg-surface">
      {/* ── Background effect ──────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-accent-500/[0.03] rounded-full blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-accent-800/[0.02] rounded-full blur-[150px]" />
      </div>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-gray-200 ${
        scrolled ? 'bg-white/85 backdrop-blur-md shadow-sm' : 'bg-white'
      }`}>
        {/* Gradient hairline accent */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent-700 via-accent-400 to-accent-700" />

        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5 group flex-shrink-0">
            <div className="bg-gradient-to-br from-accent-500 to-accent-800 p-2 rounded-xl text-white shadow-sm ring-1 ring-accent-700/20 group-hover:scale-105 group-hover:shadow-md transition-all">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-title-sm font-display text-gray-900">
              Omni<span className="text-accent-600">Home</span>
            </span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const active = activeSection === link.href.slice(1);
              return (
                <button
                  key={link.label}
                  onClick={() => scrollTo(link.href.slice(1))}
                  className={`relative px-3 py-2 text-body rounded-lg transition-colors ${
                    active ? 'text-accent-700 font-semibold' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                  {/* Active underline indicator */}
                  <span className={`absolute left-3 right-3 -bottom-0.5 h-0.5 rounded-full bg-accent-500 transition-all duration-300 ${active ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'}`} />
                </button>
              );
            })}
            <div className="flex items-center gap-3 ml-6">
              <button
                onClick={() => router.push('/login')}
                className="px-5 py-2 rounded-full text-body-sm font-semibold text-white bg-accent-600 hover:bg-accent-700 hover:-translate-y-px transition-all shadow-button hover:shadow-md"
              >
                Log in
              </button>
              <button
                onClick={() => router.push('/signup')}
                className="px-5 py-2 rounded-full text-body-sm font-semibold text-accent-600 border-2 border-accent-600 hover:bg-accent-600 hover:text-white hover:-translate-y-px transition-all"
              >
                Sign up
              </button>
            </div>
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 border border-gray-200 bg-white rounded-lg transition-colors text-gray-500 hover:text-gray-900"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile nav */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileMenuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="px-6 pb-5 space-y-2 bg-white border-b border-gray-200">
            {navLinks.map((link) => {
              const active = activeSection === link.href.slice(1);
              return (
                <button
                  key={link.label}
                  onClick={() => scrollTo(link.href.slice(1))}
                  className={`flex items-center justify-between w-full text-left text-body py-2.5 px-3 rounded-lg transition-colors ${
                    active ? 'text-accent-700 font-semibold bg-accent-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-accent-500" />}
                </button>
              );
            })}
            <hr className="border-gray-200" />
            <button onClick={() => router.push('/login')} className="w-full text-left text-body text-gray-700 hover:text-gray-900 py-2.5 px-3 transition-colors">Log in</button>
            <button onClick={() => router.push('/signup')} className="w-full btn-primary justify-center">Sign up</button>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-12 md:pt-36 md:pb-16 px-6 overflow-hidden bg-white">
        {/* Decorative glows — explicit light tints so the hero stays light in every theme */}
        <div className="absolute top-8 right-[-12%] w-[42%] h-[70%] bg-[#dbeafe]/50 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-30%] left-[-8%] w-[38%] h-[55%] bg-[#eff6ff]/80 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-16 items-center">
            {/* Left column */}
            <div>
              <FadeIn>
                <p className="text-body-sm font-semibold text-accent-600 mb-5">
                  Property management software
                </p>
              </FadeIn>

              <FadeIn delay={100}>
                <h1 className="text-display-lg md:text-5xl lg:text-6xl font-display tracking-tight leading-[1.08] text-gray-900 max-w-xl">
                  The operating system for{' '}
                  <span className="text-accent-600">residential communities</span>
                </h1>
              </FadeIn>

              <FadeIn delay={200}>
                <p className="text-body md:text-lg text-gray-700 mt-6 max-w-md leading-relaxed">
                  Replace WhatsApp groups, paper notices, and spreadsheets with one connected platform — for committees, residents, and security.
                </p>
              </FadeIn>

              <FadeIn delay={300}>
                <div className="mt-8">
                  <button
                    onClick={() => router.push('/signup')}
                    className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-body-sm font-semibold text-white bg-accent-600 hover:bg-accent-700 transition-all shadow-button hover:shadow-lg hover:-translate-y-0.5"
                  >
                    Get started free
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                  <p className="flex items-center gap-1.5 text-caption text-gray-700 mt-3">
                    <Check className="w-3.5 h-3.5 text-accent-500" />
                    14-day free trial · No credit card required
                  </p>

                  {/* Social proof */}
                  <div className="flex items-center gap-3 mt-8">
                    <div className="flex -space-x-2">
                      {['AR', 'FM', 'UK', 'SB'].map((initials, ai) => (
                        <div
                          key={initials}
                          className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-caption-xs font-bold text-white shadow-sm ${ai % 2 ? 'bg-accent-700' : 'bg-accent-500'}`}
                        >
                          {initials}
                        </div>
                      ))}
                    </div>
                    <p className="text-caption text-gray-700">
                      Trusted by <span className="font-semibold text-gray-900">200+ communities</span> across Pakistan
                    </p>
                  </div>
                </div>
              </FadeIn>
            </div>

            {/* Right column — product preview window */}
            <FadeIn delay={200}>
              <div className="relative">
                {/* Ambient glow behind the window — explicit light tints */}
                <div className="absolute -inset-5 bg-gradient-to-tr from-[#bfdbfe]/60 via-[#dbeafe]/40 to-transparent rounded-[2.5rem] blur-2xl pointer-events-none" />

                {/* App window frame */}
                <div className="relative rounded-3xl overflow-hidden bg-white shadow-2xl ring-1 ring-gray-200">
                  <div className="flex items-center gap-1.5 px-5 py-3 border-b border-gray-100">
                    <span className="w-3 h-3 rounded-full bg-red-300" />
                    <span className="w-3 h-3 rounded-full bg-amber-200" />
                    <span className="w-3 h-3 rounded-full bg-emerald-300" />
                    <span className="ml-2 text-caption-xs font-semibold text-gray-700">OmniHome · Live dashboard</span>
                    <span className="ml-auto inline-flex items-center gap-1.5 text-caption-xs font-medium text-accent-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-pulse-soft" />
                      Live
                    </span>
                  </div>
                  <div className="aspect-[4/3]">
                    <img
                      src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=1200&auto=format&fit=crop"
                      alt="Modern apartment building — residential community management"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* Floating card: dues collected */}
                <div className="absolute -left-4 sm:-left-8 top-[30%] hidden sm:block animate-float">
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
                <div className="absolute -right-3 sm:-right-6 bottom-8 animate-float-delayed">
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
      <section className="pb-12 md:pb-14 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { name: 'Capterra', stars: 5 },
              { name: 'G2', stars: 5 },
              { name: 'Trustpilot', stars: 5 },
              { name: 'Google', stars: 5 },
            ].map((platform) => (
              <FadeIn key={platform.name} delay={300}>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-0.5 mb-1.5">
                    {Array.from({ length: platform.stars }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-accent-500 text-accent-500" />
                    ))}
                  </div>
                  <p className="text-caption-xs font-semibold text-gray-700 uppercase tracking-wider">{platform.name}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section id="features" className="py-14 md:py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-display lg:text-display-lg font-display text-gray-900">
              Everything your community needs
            </h2>
            <p className="text-body text-gray-700 max-w-lg mx-auto mt-4">
              From dues to visitors, one platform connects every part of community life.
            </p>
          </div>

          {/* Row 1: Payments — text left, blue tint */}
          <FeatureRow
            index={0}
            tint="blue"
            icon={CreditCard}
            label="Payments"
            headline="Collect dues, effortlessly"
            description="Generate invoices, accept online payments, and track every transaction. No more chasing residents for monthly maintenance."
            bullets={[
              'Automated monthly invoice generation',
              'Secure online payment integration',
              'Real-time payment reconciliation',
            ]}
            visual={
              <div className="space-y-3">
                <div className="flex items-center justify-between text-caption-xs text-gray-700 px-4">
                  <span>Resident</span>
                  <span>Amount</span>
                  <span>Status</span>
                </div>
                {[
                  { name: 'Unit 101', amount: '$120', status: 'Paid', paid: true },
                  { name: 'Unit 102', amount: '$120', status: 'Overdue', paid: false },
                  { name: 'Unit 103', amount: '$120', status: 'Paid', paid: true },
                  { name: 'Unit 104', amount: '$120', status: 'Pending', paid: false },
                ].map((row, ri) => (
                  <div key={ri} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-4 py-2.5 text-body-sm shadow-sm">
                    <span className="text-gray-700 font-medium">{row.name}</span>
                    <span className="text-gray-700">{row.amount}</span>
                    <span className={`text-caption-xs font-medium ${row.paid ? 'text-accent-600' : 'text-amber-600'}`}>{row.status}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between bg-accent-500/10 border border-accent-200/50 rounded-lg px-4 py-2.5 text-body-sm font-semibold text-accent-700">
                  <span>Total collected</span>
                  <span>$480</span>
                  <span>2 / 4 paid</span>
                </div>
              </div>
            }
          />

          {/* Row 2: Maintenance — text right, amber tint */}
          <FeatureRow
            index={1}
            tint="amber"
            icon={Wrench}
            label="Maintenance"
            headline="Track repairs, start to finish"
            description="Residents submit tickets with photo attachments. Assign, track status, and resolve — all in one place."
            bullets={[
              'Photo attachments with each ticket',
              'Real-time status tracking (Open → In Progress → Resolved)',
              'Assignment & priority management',
            ]}
            visual={
              <div className="space-y-3">
                {[
                  { title: 'Leaking faucet', unit: 'Unit 201', status: 'In Progress', urgent: false },
                  { title: 'AC not cooling', unit: 'Unit 105', status: 'Open', urgent: true },
                  { title: 'Light fixture broken', unit: 'Unit 304', status: 'Resolved', urgent: false },
                  { title: 'Gate sensor issue', unit: 'Common', status: 'Assigned', urgent: false },
                ].map((ticket, ti) => (
                  <div key={ti} className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg px-4 py-3 shadow-sm">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ticket.urgent ? 'bg-amber-500' : 'bg-accent-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm font-medium text-gray-700 truncate">{ticket.title}</p>
                      <p className="text-caption-xs text-gray-700">{ticket.unit}</p>
                    </div>
                    <span className={`text-caption-xs font-medium px-2 py-0.5 rounded-full ${
                      ticket.status === 'Resolved' ? 'bg-accent-50 text-accent-600' :
                      ticket.status === 'Open' ? 'bg-amber-50 text-amber-600' :
                      'bg-gray-100 text-gray-700'
                    }`}>{ticket.status}</span>
                  </div>
                ))}
              </div>
            }
          />

          {/* Row 3: Visitors — text left, purple tint */}
          <FeatureRow
            index={2}
            tint="purple"
            icon={QrCode}
            label="Visitors"
            headline="Gate access, reimagined"
            description="Residents create digital visitor passes with QR codes. Security scans at the gate. Auto-expire on check-out."
            bullets={[
              'QR-coded digital visitor passes',
              'Security guard verification at gate',
              'Auto-revoke on resident move-out',
            ]}
            visual={
              <div className="max-w-sm mx-auto">
                {/* Visitor pass mockup */}
                <div className="bg-white rounded-xl p-4 shadow-card border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-accent-50 flex items-center justify-center">
                      <QrCode className="w-5 h-5 text-accent-600" />
                    </div>
                    <div>
                      <p className="text-body-sm font-semibold text-gray-900">Visitor Pass</p>
                      <p className="text-caption-xs text-gray-700">Valid for today</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center mb-3">
                    <div className="w-20 h-20 bg-accent-50 rounded-lg flex items-center justify-center">
                      <div className="w-14 h-14 border-2 border-dashed border-accent-300 rounded" />
                    </div>
                  </div>
                  <div className="space-y-1.5 text-caption-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Visitor</span>
                      <span className="text-gray-700 font-medium">John Doe</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Unit</span>
                      <span className="text-gray-700 font-medium">Unit 201</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Purpose</span>
                      <span className="text-gray-700 font-medium">Family visit</span>
                    </div>
                  </div>
                </div>
              </div>
            }
          />

          {/* Row 4: Amenities — text right, emerald tint */}
          <FeatureRow
            index={3}
            tint="emerald"
            icon={CalendarRange}
            label="Amenities"
            headline="Book facilities, no conflicts"
            description="Real-time calendar for clubhouse, gym, pool, and more. Automatic conflict detection prevents double-bookings."
            bullets={[
              'Real-time availability calendar',
              'Automatic conflict prevention',
              'Advance notice & duration limits',
            ]}
            visual={
              <div className="max-w-sm mx-auto">
                {/* Calendar mini grid */}
                <div className="grid grid-cols-7 gap-1 text-center mb-3">
                  {['Mo','Tu','We','Th','Fr','Sa','Su'].map((d, di) => (
                    <span key={di} className="text-caption-xs text-gray-700 font-medium py-1">{d}</span>
                  ))}
                  {Array.from({ length: 30 }).map((_, ddi) => {
                    const isBooked = [5, 6, 12, 13, 19, 20].includes(ddi);
                    const isToday = ddi === 14;
                    return (
                      <span key={ddi} className={`text-caption-xs py-1.5 rounded ${
                        isToday ? 'bg-accent-600 text-white font-semibold' :
                        isBooked ? 'bg-accent-50 text-accent-600' :
                        'text-gray-700'
                      }`}>{ddi + 1}</span>
                    );
                  })}
                </div>
                <div className="space-y-2">
                  {[
                    { time: '09:00 - 11:00', amenity: 'Clubhouse', status: 'Booked' },
                    { time: '14:00 - 16:00', amenity: 'Tennis Court', status: 'Booked' },
                    { time: '17:00 - 19:00', amenity: 'Swimming Pool', status: 'Available' },
                  ].map((slot, si) => (
                    <div key={si} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-3 py-2 shadow-sm">
                      <div>
                        <p className="text-caption-xs font-medium text-gray-700">{slot.amenity}</p>
                        <p className="text-caption-xs text-gray-700">{slot.time}</p>
                      </div>
                      <span className={`text-caption-xs font-medium ${
                        slot.status === 'Available' ? 'text-accent-600' : 'text-gray-700'
                      }`}>{slot.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            }
          />
        </div>
      </section>

      {/* ── Secondary features (pastel-tinted cards) ──────────────────── */}
      <section className="py-14 md:py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-display lg:text-display-lg font-display text-gray-900">
              Plus, everything else your<br className="hidden sm:block" /> community needs
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <FadeIn delay={0}>
              <SecondaryFeatureCard
                tint="teal"
                icon={BarChart3}
                title="Community polls"
                description="One-click e-voting with transparent results. Replace paper ballots and show-of-hands with digital democracy."
                tag="Instant results"
              />
            </FadeIn>
            <FadeIn delay={100}>
              <SecondaryFeatureCard
                tint="purple"
                icon={Users}
                title="Resident directory"
                description="Searchable, building-grouped directory. Know your neighbors and build real community connections."
                tag="Searchable by building"
              />
            </FadeIn>
            <FadeIn delay={200}>
              <SecondaryFeatureCard
                tint="blue"
                icon={Lock}
                title="Role-based access"
                description="Granular permissions for admins, residents, and guards. Complete audit trail for every action."
                tag="Full audit trail"
              />
            </FadeIn>
            <FadeIn delay={300}>
              <SecondaryFeatureCard
                tint="emerald"
                icon={Folder}
                title="Document storage"
                description="Bylaws, meeting minutes, vendor contracts — all in one secure, organized place."
                tag="Secure cloud storage"
              />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────────── */}
      <section className="py-14 md:py-16 px-6 bg-white">
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
                <div className={`group relative rounded-2xl p-7 bg-gradient-to-b border shadow-sm hover:shadow-elevated hover:-translate-y-1.5 transition-all duration-300 h-full flex flex-col overflow-hidden ${tt.card}`}>
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

                  {/* Author — initials avatar + name/role */}
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
      <section id="pricing" className="py-14 md:py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-display lg:text-display-lg font-display text-gray-900">
              Plans for every community
            </h2>
            <p className="text-body text-gray-700 mt-4">
              Start free. Upgrade when you grow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <FadeIn delay={0}>
              <PricingCard
                name="Starter"
                tint="blue"
                price="Free"
                description="Perfect for small societies getting started."
                features={[
                  'Up to 50 units',
                  'Notices & announcements',
                  'Maintenance ticketing',
                  'Resident directory',
                  'Basic visitor passes',
                  'Email support',
                ]}
                cta="Get started"
                onCta={() => router.push('/signup')}
              />
            </FadeIn>
            <FadeIn delay={120}>
              <PricingCard
                name="Pro"
                tint="purple"
                price="Rs 2,000"
                description="For growing societies with advanced needs."
                features={[
                  'Up to 200 units',
                  'Everything in Starter',
                  'Automated billing & invoices',
                  'JazzCash, Easypaisa & bank payments',
                  'Amenity booking system',
                  'Community polls & voting',
                  'QR code visitor management',
                  'Priority support',
                ]}
                popular
                cta="Start free trial"
                onCta={() => router.push('/signup')}
              />
            </FadeIn>
            <FadeIn delay={240}>
              <PricingCard
                name="Enterprise"
                tint="emerald"
                price="Rs 5,000"
                description="For large societies and multi-community groups."
                features={[
                  'Unlimited units',
                  'Everything in Pro',
                  'Document management',
                  'Audit trail & export',
                  'Multi-society management',
                  'Custom roles & permissions',
                  'Dedicated account manager',
                  'API access',
                  'White-label option',
                ]}
                cta="Contact sales"
                onCta={() => router.push('/signup')}
              />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <section id="faq" className="py-14 md:py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-14 items-start">
            {/* Left — intro + contact */}
            <div className="lg:col-span-2">
              <FadeIn>
                <p className="text-caption-xs font-semibold text-accent-600 uppercase tracking-widest mb-3">
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
                <div className="mt-8 rounded-2xl bg-accent-600 p-6 text-white">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-body-sm font-semibold">Still have questions?</p>
                      <p className="text-caption text-accent-100">Our team replies within a day.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push('/signup')}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-accent-700 text-body-sm font-semibold hover:bg-accent-50 transition-colors"
                  >
                    Talk to our team
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </FadeIn>
            </div>

            {/* Right — accordion list */}
            <div className="lg:col-span-3">
              <FadeIn delay={120}>
                <div className="space-y-3">
                  {faqs.map((faq) => (
                    <FAQItem key={faq.q} q={faq.q} a={faq.a} />
                  ))}
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="py-14 md:py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent-700 via-accent-600 to-accent-800 p-10 md:p-16 text-center shadow-elevated transition-all duration-300 hover:shadow-modal hover:-translate-y-0.5">
              {/* Decorative glows */}
              <div className="absolute -top-24 -right-16 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-accent-400/20 rounded-full blur-3xl pointer-events-none" />

              {/* Faint drifting icons */}
              <Building2 className="absolute top-8 left-8 w-16 h-16 text-white/5 pointer-events-none animate-float" />
              <QrCode className="absolute bottom-8 right-8 w-16 h-16 text-white/5 pointer-events-none animate-float-delayed" />
              <CheckCircle className="absolute bottom-12 left-12 w-12 h-12 text-white/5 pointer-events-none animate-float-delayed" />

              {/* Dot-grid texture */}
              <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:22px_22px] pointer-events-none" />

              <div className="relative">
                {/* Eyebrow chip */}
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 text-white text-caption-xs font-semibold mb-6 ring-1 ring-white/20">
                  <Sparkles className="w-3.5 h-3.5" />
                  Get your society live in under 10 minutes
                </span>

                <h2 className="text-display lg:text-display-lg font-display text-white mb-4">
                  Ready to transform your community?
                </h2>
                <p className="text-body md:text-lg text-accent-100 max-w-lg mx-auto mb-8">
                  Join thousands of communities already using OmniHome. Start your free trial today — no credit card required.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    onClick={() => router.push('/signup')}
                    className="group inline-flex items-center gap-2 px-7 py-3.5 bg-white hover:bg-gray-100 text-accent-700 rounded-xl text-body-sm font-semibold transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]"
                  >
                    Start free trial
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                  <button
                    onClick={() => router.push('/login')}
                    className="px-7 py-3.5 bg-transparent hover:bg-white rounded-xl text-body-sm font-semibold text-white hover:text-accent-600 border-2 border-white/40 hover:border-white transition-all"
                  >
                    Sign in
                  </button>
                </div>

                {/* Trust row */}
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <div className="flex -space-x-2">
                    {['AR', 'FM', 'UK', 'SB'].map((initials, ai) => (
                      <div
                        key={initials}
                        className={`w-7 h-7 rounded-full border-2 border-accent-700 flex items-center justify-center text-caption-xs font-bold text-white ${ai % 2 ? 'bg-accent-400' : 'bg-accent-500'}`}
                      >
                        {initials}
                      </div>
                    ))}
                  </div>
                  <p className="flex items-center gap-1.5 text-caption text-accent-100">
                    <span className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, sj) => (
                        <Star key={sj} className="w-3.5 h-3.5 fill-accent-300 text-accent-300" />
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
      <footer className="relative border-t border-gray-200 bg-white pt-16 pb-10 px-6 overflow-hidden">
        {/* Gradient hairline accent */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent-700 via-accent-400 to-accent-700" />
        {/* Soft background tint */}
        <div className="absolute bottom-[-30%] right-[-10%] w-[42%] h-[55%] bg-[#eff6ff] rounded-full blur-[110px] pointer-events-none" />
        <div className="absolute top-[-25%] left-[-10%] w-[32%] h-[45%] bg-[#dbeafe]/50 rounded-full blur-[110px] pointer-events-none" />

        <div className="max-w-7xl mx-auto relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="bg-gradient-to-br from-accent-500 to-accent-800 p-2 rounded-xl text-white shadow-sm">
                  <Building2 className="w-4 h-4" />
                </div>
                <span className="text-body font-bold font-display text-gray-900">
                  Omni<span className="text-accent-600">Home</span>
                </span>
              </div>
              <p className="text-body-sm text-gray-800 leading-relaxed max-w-xs">
                The premium platform for residential community management. Purpose-built for apartment complexes, HOAs, and gated communities.
              </p>

              {/* Social icons */}
              <div className="flex items-center gap-2 mt-6">
                {[Facebook, Twitter, Instagram, Linkedin].map((Icon, si) => (
                  <button
                    key={si}
                    aria-label="Social link"
                    className="w-9 h-9 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-accent-600 hover:border-accent-300 hover:shadow-sm hover:-translate-y-0.5 transition-all flex items-center justify-center"
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>

            {[
              { title: 'Product', links: ['Features', 'Pricing', 'FAQ', 'Changelog'] },
              { title: 'Company', links: ['About', 'Blog', 'Careers', 'Contact'] },
              { title: 'Legal', links: ['Privacy policy', 'Terms of service', 'Cookie policy', 'GDPR'] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="flex items-center gap-2 text-caption font-semibold text-gray-900 mb-4 uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-500" />
                  {col.title}
                </h4>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link}>
                      <button className="text-body-sm text-gray-800 hover:text-accent-600 transition-colors hover:underline underline-offset-4 decoration-accent-400">
                        {link}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-body-sm text-gray-800">
              &copy; {new Date().getFullYear()} OmniHome. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <button className="text-body-sm text-gray-800 hover:text-accent-600 transition-colors">Privacy policy</button>
              <button className="text-body-sm text-gray-800 hover:text-accent-600 transition-colors">Terms of service</button>
              <span className="text-body-sm text-gray-800 flex items-center gap-1.5">
                Made in Pakistan <span aria-hidden="true">🇵🇰</span>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
